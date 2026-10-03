/**
 * Placeholder syntax tokenizer, ported from the design source so the diff
 * matches the approved artboards exactly. It is intentionally tiny and
 * language-agnostic. The diff surface consumes `Array<CodeToken>` only, so a
 * Shiki-backed highlighter (e.g. @pierre/diffs worker highlighting) can replace
 * this function without touching the row components.
 */
export type TokenClass = "kw" | "st" | "fn" | "cm" | "nu" | "id" | "pl"

export interface CodeToken {
  text: string
  className: TokenClass
}

const KEYWORD =
  /^(export|async|function|const|await|return|if|import|from|let|new|true|false|null)$/

const TOKEN =
  /(\/\/.*$)|('[^']*'|"[^"]*"|`[^`]*`)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|(\d+)|(\s+)|([^\sA-Za-z_$\d'"`]+)/g

export function tokenize(code: string): Array<CodeToken> {
  const out: Array<CodeToken> = []
  for (const match of code.matchAll(TOKEN)) {
    const [whole, comment, string, call, word, number] = match
    if (comment) out.push({ text: comment, className: "cm" })
    else if (string) out.push({ text: string, className: "st" })
    else if (call)
      out.push({ text: call, className: KEYWORD.test(call) ? "kw" : "fn" })
    else if (word)
      out.push({ text: word, className: KEYWORD.test(word) ? "kw" : "id" })
    else if (number) out.push({ text: number, className: "nu" })
    else out.push({ text: whole, className: "pl" })
  }
  return out
}

export const TOKEN_COLOR: Record<TokenClass, string> = {
  kw: "text-syn-kw",
  st: "text-syn-st",
  fn: "text-syn-fn",
  cm: "text-syn-cm italic",
  nu: "text-syn-nu",
  id: "text-syn-id",
  pl: "text-syn-pl",
}
