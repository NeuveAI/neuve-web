import { TOKEN_COLOR, tokenize } from "@workspace/ui/lib/tokenize"

/**
 * Small highlighted mono snippet (card excerpts, source sheet lines). The
 * caller owns layout: it wraps in a card and keeps sideways scrolling in the
 * sheet. Tokens use the brand syntax colours, so light and dark follow.
 */
export function HighlightedCode({ code }: { code: string }) {
  const lines = code.split("\n")
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {tokenize(line).map((token, j) => (
            <span key={j} className={TOKEN_COLOR[token.className]}>
              {token.text}
            </span>
          ))}
          {i < lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </>
  )
}
