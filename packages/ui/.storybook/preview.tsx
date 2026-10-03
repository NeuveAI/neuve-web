import type { Preview } from "@storybook/react-vite"
import { withThemeByClassName } from "@storybook/addon-themes"

import "../src/styles/globals.css"

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    a11y: { test: "todo" },
    backgrounds: { disable: true },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
      parentSelector: "html",
    }),
  ],
}

export default preview
