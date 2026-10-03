import { realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { Data, Effect, Schema } from "effect"

export class EditorReferenceError extends Data.TaggedError(
  "EditorReferenceError"
)<{
  readonly reason:
    "invalid-reference" | "file-unavailable" | "outside-repository"
}> {}
const Reference = Schema.Struct({
  source: Schema.Struct({
    repository: Schema.NonEmptyString,
    revision: Schema.NonEmptyString,
  }),
  citation: Schema.Struct({
    path: Schema.NonEmptyString,
    startLine: Schema.Number,
    endLine: Schema.Number,
  }),
})
export const editorReference = (input: unknown) =>
  Effect.gen(function* () {
    const reference = yield* Schema.decodeUnknownEffect(Reference)(input).pipe(
      Effect.mapError(
        () => new EditorReferenceError({ reason: "invalid-reference" })
      )
    )
    const { source, citation } = reference
    if (
      !isAbsolute(source.repository) ||
      source.repository.includes("\0") ||
      !/^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(source.revision) ||
      isAbsolute(citation.path) ||
      citation.path.includes("\0") ||
      citation.path.split(/[\\/]/).includes("..") ||
      !Number.isSafeInteger(citation.startLine) ||
      !Number.isSafeInteger(citation.endLine) ||
      citation.startLine < 1 ||
      citation.endLine < citation.startLine
    )
      return yield* Effect.fail(
        new EditorReferenceError({ reason: "invalid-reference" })
      )
    const [repository, file] = yield* Effect.tryPromise({
      try: () =>
        Promise.all([
          realpath(source.repository),
          realpath(resolve(source.repository, citation.path)),
        ]),
      catch: () => new EditorReferenceError({ reason: "file-unavailable" }),
    })
    const local = relative(repository, file)
    if (
      local === "" ||
      local === ".." ||
      local.startsWith(`..${sep}`) ||
      isAbsolute(local)
    )
      return yield* Effect.fail(
        new EditorReferenceError({ reason: "outside-repository" })
      )
    const metadata = yield* Effect.tryPromise({
      try: () => stat(file),
      catch: () => new EditorReferenceError({ reason: "file-unavailable" }),
    })
    if (!metadata.isFile())
      return yield* Effect.fail(
        new EditorReferenceError({ reason: "file-unavailable" })
      )
    // Official URI contract: https://code.visualstudio.com/docs/configure/command-line#opening-vs-code-with-urls
    const encodedPath = file.split(sep).map(encodeURIComponent).join("/")
    return {
      source,
      citation,
      uri: `vscode://file${encodedPath}:${citation.startLine}:1`,
      freshness: "local-working-file" as const,
    }
  })
