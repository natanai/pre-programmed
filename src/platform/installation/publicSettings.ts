export type InstallationPublicSettings = {
  initializeUniverseText: string;
};

const DEFAULT_INSTALLATION_TEXT: InstallationPublicSettings = {
  initializeUniverseText: "initialize universe",
};

export function parseInstallationPublicText(text: string): InstallationPublicSettings {
  let initializeUniverseText = DEFAULT_INSTALLATION_TEXT.initializeUniverseText;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim().toUpperCase();
    if (name === "INITIALIZE_UNIVERSE_TEXT") {
      initializeUniverseText = line.slice(separator + 1).trim();
    }
  }
  return { initializeUniverseText };
}

/**
 * Read public installation-owned player wording from the current platform.
 * Hosted/local browser builds receive public/engine-text.txt as an ordinary
 * static file. The portable desktop host serves the same URL from its external
 * installation.txt, exposing only public wording and never the Author key.
 */
export async function loadInstallationPublicSettings(): Promise<InstallationPublicSettings> {
  try {
    const url = new URL(import.meta.env.BASE_URL + "engine-text.txt", window.location.origin);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return { ...DEFAULT_INSTALLATION_TEXT };
    return parseInstallationPublicText(await response.text());
  } catch {
    return { ...DEFAULT_INSTALLATION_TEXT };
  }
}
