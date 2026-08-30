import { useEffect, useState } from "react";

const SETTINGS_KEY = "pre-programmed:display-settings";

type DisplaySettings = {
  fontSize: number;
  reduceMotion: boolean;
};

const DEFAULT_SETTINGS: DisplaySettings = { fontSize: 16, reduceMotion: false };

function readSettings(): DisplaySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<DisplaySettings>;
    return {
      fontSize: typeof stored.fontSize === "number" ? Math.min(24, Math.max(12, stored.fontSize)) : 16,
      reduceMotion: Boolean(stored.reduceMotion),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function AuthorSettings({ authorView, onToggleAuthorView }: {
  authorView: boolean;
  onToggleAuthorView: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--terminal-font-size", `${settings.fontSize}px`);
    root.dataset.reduceMotion = String(settings.reduceMotion);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return () => {
      root.style.removeProperty("--terminal-font-size");
      delete root.dataset.reduceMotion;
    };
  }, [settings]);

  return <div className="author-settings" onPointerDown={(event) => event.stopPropagation()}>
    <div className="author-corner-controls">
      <button type="button" className="author-view-toggle" aria-label={authorView ? "Preview player experience" : "Return to Author experience"}
        aria-pressed={authorView} onClick={onToggleAuthorView}><span aria-hidden="true" /></button>
      <button type="button" className="author-settings-gear" aria-label="Author display settings" aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>⚙</button>
    </div>
    {open ? <section className="author-settings-popover" aria-label="Display settings">
      <header><span>DISPLAY SETTINGS</span><button type="button" onClick={() => setOpen(false)}>[X]</button></header>
      <label>TEXT SIZE <span>{settings.fontSize}px</span>
        <input type="range" min={12} max={24} step={1} value={settings.fontSize} onChange={(event) => setSettings({ ...settings, fontSize: Number(event.target.value) })} />
      </label>
      <label className="check-label"><input type="checkbox" checked={settings.reduceMotion} onChange={(event) => setSettings({ ...settings, reduceMotion: event.target.checked })} /> reduce motion</label>
    </section> : null}
  </div>;
}
