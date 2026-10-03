/**
 * Editor deep links for "Open in VS Code / Cursor / Zed". Paths are
 * repository-relative until the BFF supplies the local checkout root, so the
 * editors resolve them against their open workspace.
 */
export type EditorName = "VS Code" | "Cursor" | "Zed"

const SCHEME: Record<EditorName, string> = {
  "VS Code": "vscode://file/",
  Cursor: "cursor://file/",
  Zed: "zed://file/",
}

export function editorHref(editor: EditorName, path: string): string {
  return `${SCHEME[editor]}${path.split("/").map(encodeURIComponent).join("/")}`
}
