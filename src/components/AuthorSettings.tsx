import { useEffect, useState } from "react";

const SETTINGS_KEY = "pre-programmed:display-settings";

export type DisplaySettings = {
  fontSize: number;
  reduceMotion: boolean;
  textSpeedMultiplier: number;
};

const DEFAULT_SETTINGS: DisplaySettings = { fontSize: 16, reduceMotion: false, textSpeedMultiplier: 1 };

export function readDisplaySettings(): DisplaySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<DisplaySettings>;
    return {
      fontSize: typeof stored.fontSize === "number" ? Math.min(24, Math.max(12, stored.fontSize)) : 16,
      reduceMotion: Boolean(stored.reduceMotion),
      textSpeedMultiplier: typeof stored.textSpeedMultiplier === "number"
        ? Math.min(4, Math.max(.25, stored.textSpeedMultiplier))
        : 1,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function AuthorSettings({ authorView, showAuthorViewToggle, visible = true, onToggleAuthorView, onTextSpeedMultiplierChange }: {
  authorView: boolean;
  showAuthorViewToggle: boolean;
  visible?: boolean;
  onToggleAuthorView: () => void;
  onTextSpeedMultiplierChange: (multiplier: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(readDisplaySettings);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--terminal-font-size", `${settings.fontSize}px`);
    root.dataset.reduceMotion = String(settings.reduceMotion);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    onTextSpeedMultiplierChange(settings.textSpeedMultiplier);
    return () => {
      root.style.removeProperty("--terminal-font-size");
      delete root.dataset.reduceMotion;
    };
  }, [settings, onTextSpeedMultiplierChange]);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  if (!visible) return null;

  return <div className="author-settings" onPointerDown={(event) => event.stopPropagation()}>
    <div className="author-corner-controls">
      {showAuthorViewToggle ? <button type="button" className="author-view-toggle" aria-label={authorView ? "Preview player experience" : "Return to Author experience"}
        aria-pressed={authorView} onClick={onToggleAuthorView}><span aria-hidden="true" /></button> : null}
      <button type="button" className="author-settings-gear" aria-label="Display settings" aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>⚙</button>
    </div>
    {open ? <section className="author-settings-popover" aria-label="Display settings">
      <header><span>DISPLAY SETTINGS</span><button type="button" onClick={() => setOpen(false)}>[X]</button></header>
      <label>TEXT SIZE <span>{settings.fontSize}px</span>
        <input type="range" min={12} max={24} step={1} value={settings.fontSize} onChange={(event) => setSettings({ ...settings, fontSize: Number(event.target.value) })} />
      </label>
      <label>TEXT SPEED <span>{settings.textSpeedMultiplier.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")}×</span>
        <input type="range" min={.25} max={4} step={.25} value={settings.textSpeedMultiplier} onChange={(event) => setSettings({ ...settings, textSpeedMultiplier: Number(event.target.value) })} />
      </label>
      <label className="check-label"><input type="checkbox" checked={settings.reduceMotion} onChange={(event) => setSettings({ ...settings, reduceMotion: event.target.checked })} /> reduce motion</label>
    </section> : null}
  </div>;
}
