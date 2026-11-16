// The web app manifest, kept here for both of its uses: vite.config.ts emits it
// as the static manifest.webmanifest, and AppIdentity swaps in a copy under the
// account's own name at runtime (manifestFor).

/** The app's name until an account picks one, and for signed-out visitors. */
export const DEFAULT_APP_NAME = "MyOS"

// Blank names on purpose (blank, not absent: vite-plugin-pwa fills an absent
// one from package.json). iOS reads the manifest once, at page load, and
// ignores the per-account copy swapped in later; with no name in it, Add to
// Home Screen falls back to apple-mobile-web-app-title, which AppIdentity keeps
// on the account's name. Chrome reads the swapped-in copy, which has one.
export const MANIFEST = {
  name: "",
  short_name: "",
  description: "Evening reflection — habits, wellbeing, goals.",
  theme_color: "#0b0b0f",
  background_color: "#0b0b0f",
  display: "standalone" as const,
  lang: "en",
  icons: [
    { src: "logo192.png", sizes: "192x192", type: "image/png" },
    { src: "logo512.png", sizes: "512x512", type: "image/png" },
    { src: "logo512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}

/**
 * The manifest under `appName`, to serve from a blob URL. A blob has no base
 * to resolve relative URLs against, so each one is made absolute against
 * `appUrl`, the app's root. start_url and scope are what the static manifest
 * resolves to, so browsers see the same app (its id defaults to start_url),
 * only renamed.
 */
export function manifestFor(appName: string, appUrl: string) {
  return {
    ...MANIFEST,
    name: appName,
    short_name: appName,
    start_url: appUrl,
    scope: appUrl,
    icons: MANIFEST.icons.map((icon) => ({ ...icon, src: new URL(icon.src, appUrl).href })),
  }
}
