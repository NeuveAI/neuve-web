import { mkdtemp, rm, symlink, writeFile, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { dispatchComment, type HarnessUpdate } from "./index"
import { editorReference } from "./references"

const root = await mkdtemp(join(tmpdir(), "neuve-acp-verify-"))
const sdk = import.meta.resolve("@agentclientprotocol/sdk")
const fake = join(root, "agent.ts")
await writeFile(
  fake,
  `import * as acp from ${JSON.stringify(sdk)};
import { Writable } from "node:stream";
await Bun.write(${JSON.stringify(join(root, "pid"))}, String(process.pid));
if(process.env.NEUVE_REVIEW_TOKEN) throw new Error("Human credential leaked to harness");
acp.agent({name:"external-verification-agent"})
.onRequest(acp.methods.agent.initialize,()=>({protocolVersion:acp.PROTOCOL_VERSION,agentCapabilities:{}}))
.onRequest(acp.methods.agent.session.new,()=>({sessionId:"session-1"}))
.onRequest(acp.methods.agent.session.prompt,async ({client,params})=>{
 await client.notify(acp.methods.client.session.update,{sessionId:params.sessionId,update:{sessionUpdate:"agent_message_chunk",content:{type:"text",text:"I inspected the correction."}}});
 await client.notify(acp.methods.client.session.update,{sessionId:params.sessionId,update:{sessionUpdate:"tool_call",toolCallId:"tool-1",title:"Inspect source",status:"completed"}});
 if(process.argv.includes("--block")) await new Promise(()=>{});
 return {stopReason:"end_turn"};
}).connect(acp.ndJsonStream(Writable.toWeb(process.stdout),Bun.stdin.stream()));
`
)
const comment = {
  commandId: "c1",
  unitId: "u1",
  revisionId: "r1",
  body: "Inspect the permission change",
  intent: "request-changes" as const,
}
const target = { command: process.execPath, cwd: root, args: [fake] }
process.env.NEUVE_REVIEW_TOKEN = "sentinel-human-review-secret";
const events: HarnessUpdate[] = []
try {
  const result = await Effect.runPromise(
    dispatchComment(target, comment, {
      onUpdate: async (event) => {
        events.push(event)
      },
    })
  )
  if (
    result.reply !== "I inspected the correction." ||
    result.stopReason !== "end_turn" ||
    events.map((event) => event.kind).join(",") !==
      "session-started,agent-message,tool-status,prompt-finished" ||
    events.some(
      (event) => event.commandId !== "c1" || event.sessionId !== "session-1"
    )
  )
    throw new Error("ACP reply or correlation failed")
  const abort = new AbortController()
  const interrupted = Effect.runPromise(
    dispatchComment({ ...target, args: [fake, "--block"] }, comment, {
      onUpdate: async (event) => {
        if (event.kind === "tool-status") abort.abort()
      },
    }),
    { signal: abort.signal }
  ).then(
    () => false,
    () => true
  )
  if (!(await interrupted)) throw new Error("ACP interruption did not fail")
  const pid = Number(await readFile(join(root, "pid"), "utf8"))
  let exited = false
  try {
    process.kill(pid, 0)
  } catch {
    exited = true
  }
  if (!exited) throw new Error("ACP interruption orphaned subprocess")
  await writeFile(join(root, "file #1.ts"), "local source\n")
  const source = { repository: root, revision: "a".repeat(40) }
  const citation = { path: "file #1.ts", startLine: 1, endLine: 1 }
  const navigation = await Effect.runPromise(
    editorReference({ source, citation })
  )
  if (
    !navigation.uri.includes("file%20%231.ts:1:1") ||
    navigation.freshness !== "local-working-file"
  )
    throw new Error("Editor URI or freshness invalid")
  await symlink("/etc/passwd", join(root, "escape"))
  const escaped = await Effect.runPromise(
    editorReference({ source, citation: { ...citation, path: "escape" } }).pipe(
      Effect.flip
    )
  )
  if (escaped.reason !== "outside-repository")
    throw new Error("Symlink escaped captured repository")
  console.log(
    JSON.stringify({
      acpRoundtrip: true,
      correlatedUpdates: events.length,
      cancellationCleanup: true,
      referenceNavigation: true,
      symlinkRejected: true,
    })
  )
} finally {
  await rm(root, { recursive: true, force: true })
}
