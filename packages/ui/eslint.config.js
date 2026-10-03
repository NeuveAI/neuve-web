//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"
import storybook from "eslint-plugin-storybook"

import { neuveReactRules } from "./eslint/neuve-react-rules.js"

export default [
  ...tanstackConfig,
  ...storybook.configs["flat/recommended"],
  ...neuveReactRules,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "import/consistent-type-specifier-style": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    ignores: ["eslint.config.js", "eslint/**", ".prettierrc", "storybook-static/**"],
  },
]
