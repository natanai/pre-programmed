import { useEffect, useMemo, useState } from "react";
import type { AuthorProjectSettingsSection } from "../features/types";

function TerminalSettings({ context }: { context: Parameters<AuthorProjectSettingsSection["render"]>[0] }) {
  const [prompt, setPrompt] = useState(context.snapshot.settings.terminalPrompt);
  const [baseline, setBaseline] = useState(context.snapshot.settings.terminalPrompt);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => prompt !== baseline, [baseline, prompt]);

  useEffect(() => {
    context.setWorkspaceDirty(dirty);
    return () => context.setWorkspaceDirty(false);
  }, [context.setWorkspaceDirty, dirty]);

  const save = async () => {
    const terminalPrompt = prompt.trim().slice(0, 32);
    if (!terminalPrompt) return;
    const settings = { ...context.snapshot.settings, terminalPrompt };
    setSaving(true);
    try {
      const result = await context.persist(
        [{ type: "project.settings", settings }],
        "Changed project terminal settings",
      );
      if (result.status === "saved" || result.status === "queued") {
        setPrompt(terminalPrompt);
        setBaseline(terminalPrompt);
        context.setWorkspaceDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return <div className="project-setting-card">
    <h3>TERMINAL PROMPT</h3>
    <p className="project-settings-description">
      Player-facing prompt text for this game. This is project data, not an engine constant.
    </p>
    <label>PROMPT
      <input
        value={prompt}
        maxLength={32}
        onChange={(event) => setPrompt(event.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
    </label>
    <div className="project-setting-actions">
      <button type="button" disabled={!dirty || saving || !prompt.trim()} onClick={() => void save()}>
        [{saving ? "SAVING..." : "SAVE"}]
      </button>
    </div>
  </div>;
}

export const PROJECT_GENERAL_SETTINGS: readonly AuthorProjectSettingsSection[] = [
  {
    id: "project-terminal",
    label: "TERMINAL",
    description: "Project-wide player terminal identity and presentation defaults.",
    order: 10,
    render: (context) => <TerminalSettings context={context} />,
  },
];
