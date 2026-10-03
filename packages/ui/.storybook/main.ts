import { fileURLToPath } from "node:url"
import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"

const src = fileURLToPath(new URL("../src", import.meta.url))

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-themes", "@storybook/addon-a11y"],
  core: { disableTelemetry: true },
  viteFinal(viteConfig) {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()]
    viteConfig.resolve = {
      ...viteConfig.resolve,
      alias: [
        ...(Array.isArray(viteConfig.resolve?.alias)
          ? viteConfig.resolve.alias
          : Object.entries(viteConfig.resolve?.alias ?? {}).map(
              ([find, replacement]) => ({ find, replacement })
            )),
        { find: /^@workspace\/ui\/(.*)$/, replacement: `${src}/$1` },
      ],
    }
    return viteConfig
  },
}

export default config
