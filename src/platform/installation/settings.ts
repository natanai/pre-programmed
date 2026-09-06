export type InstallationSettings = {
  startButtonText: string;
};

declare global {
  interface Window {
    __PRE_PROGRAMMED_INSTALLATION__?: Partial<InstallationSettings>;
  }
}

const DEFAULT_INSTALLATION_SETTINGS: InstallationSettings = {
  startButtonText: "INITIALIZE UNIVERSE",
};

/**
 * Installation-owned presentation that exists before the authored player runtime.
 * Portable desktop injects this value from installation.txt. Hosted/local browser
 * builds fall back to the neutral engine default unless their platform injects it.
 */
export function installationSettings(): InstallationSettings {
  const configured = typeof window !== "undefined" ? window.__PRE_PROGRAMMED_INSTALLATION__ : undefined;
  const startButtonText = typeof configured?.startButtonText === "string"
    ? configured.startButtonText.trim()
    : "";
  return {
    startButtonText: startButtonText || DEFAULT_INSTALLATION_SETTINGS.startButtonText,
  };
}
