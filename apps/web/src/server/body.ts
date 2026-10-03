import { Data, Effect } from "effect";

export class RequestBodyError extends Data.TaggedError("RequestBodyError")<{
  readonly reason: "invalid-json" | "payload-too-large";
}> {}

export const readJsonBody = (request: Request) => Effect.tryPromise({
  async try(signal) {
    const reader = request.body?.getReader();
    if (!reader) throw new RequestBodyError({ reason: "invalid-json" });
    const abort = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", abort, { once: true });
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let text = "";
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 128_000) {
          await reader.cancel();
          throw new RequestBodyError({ reason: "payload-too-large" });
        }
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
      const result: unknown = JSON.parse(text);
      return result;
    } finally {
      signal.removeEventListener("abort", abort);
      reader.releaseLock();
    }
  },
  catch: (error) => error instanceof RequestBodyError ? error : new RequestBodyError({ reason: "invalid-json" }),
});
