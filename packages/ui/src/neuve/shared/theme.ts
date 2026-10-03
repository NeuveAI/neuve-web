/**
 * Theme switching without React state.
 *
 * The theme lives on <html> as the `.dark` class (shadcn convention) and in
 * localStorage. Light is the default (user decision), so the first paint is
 * light unless the reader pinned dark. Components never read the theme: icons
 * and labels swap through the `dark:` variant, which keeps server and client
 * markup identical.
 */
export const THEME_STORAGE_KEY = "neuve-theme"

export type Theme = "light" | "dark"

/** Inline, render-blocking script for <head>: applies a pinned theme before paint. */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}`

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode); the class still applies.
  }
}

export function toggleTheme() {
  applyTheme(
    document.documentElement.classList.contains("dark") ? "light" : "dark"
  )
}
