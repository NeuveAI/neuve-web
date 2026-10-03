// @ts-check
/**
 * Neuve React rules, shared by every package in this monorepo.
 *
 * 1. useState is banned: all state lives in jotai atoms.
 * 2. Every useEffect / useLayoutEffect needs a one-line justification comment
 *    directly above it, starting with "Effect:", that cites why React's
 *    "You Might Not Need an Effect" guidance allows it (for example,
 *    subscribing to an external system).
 */

const STATE_MESSAGE =
  "useState is banned in Neuve: keep state in jotai atoms (see packages/ui/src/neuve/*/atoms.ts)."

const EFFECT_HOOKS = new Set(["useEffect", "useLayoutEffect"])

/** @param {import("estree").CallExpression} node */
function effectName(node) {
  const callee = node.callee
  if (callee.type === "Identifier" && EFFECT_HOOKS.has(callee.name))
    return callee.name
  if (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    EFFECT_HOOKS.has(callee.property.name)
  )
    return callee.property.name
  return null
}

/** @type {import("eslint").Rule.RuleModule} */
const effectJustification = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require an `// Effect: <why>` comment above every useEffect/useLayoutEffect.",
    },
    schema: [],
    messages: {
      missing:
        '{{name}} needs a one-line `// Effect: …` comment directly above it citing why "You Might Not Need an Effect" allows it.',
    },
  },
  create(context) {
    const source = context.sourceCode
    return {
      CallExpression(node) {
        const name = effectName(node)
        if (!name) return
        /** @type {import("estree").Node} */
        let statement = node
        // Walk up to the enclosing statement so the comment can sit above it.
        // @ts-expect-error parent is added by ESLint
        while (
          statement.parent &&
          statement.parent.type !== "BlockStatement" &&
          statement.parent.type !== "Program"
        ) {
          // @ts-expect-error parent is added by ESLint
          statement = statement.parent
        }
        const comments = source.getCommentsBefore(statement)
        const last = comments.at(-1)
        const justified =
          last !== undefined &&
          /^\s*Effect:\s*\S/.test(last.value) &&
          last.loc !== undefined &&
          last.loc !== null &&
          statement.loc !== undefined &&
          statement.loc !== null &&
          statement.loc.start.line - last.loc.end.line <= 1
        if (!justified)
          context.report({ node, messageId: "missing", data: { name } })
      },
    }
  },
}

/** @type {import("eslint").Linter.Config[]} */
export const neuveReactRules = [
  {
    plugins: {
      neuve: { rules: { "effect-justification": effectJustification } },
    },
    rules: {
      "neuve/effect-justification": "error",
      // Selectors (not no-restricted-imports) so `import * as React` stays legal.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value='react'] > ImportSpecifier[imported.name='useState']",
          message: STATE_MESSAGE,
        },
        {
          selector:
            "MemberExpression[object.name='React'][property.name='useState']",
          message: STATE_MESSAGE,
        },
      ],
    },
  },
]

export default neuveReactRules
