import type { ProjectSettings } from "../src/engine/project/settings";
import { normalizeProjectSettings } from "../src/engine/project/settings";

export async function loadProjectSettings(db: D1Database): Promise<ProjectSettings> {
  const row = await db.prepare("SELECT settings_json FROM project_meta WHERE id = 1")
    .first<{ settings_json: string }>();
  if (!row?.settings_json) return normalizeProjectSettings({});
  try {
    return normalizeProjectSettings(JSON.parse(row.settings_json));
  } catch {
    return normalizeProjectSettings({});
  }
}

export function projectSettingsStatements(db: D1Database, settings: ProjectSettings) {
  return [
    db.prepare("UPDATE project_meta SET settings_json = ? WHERE id = 1")
      .bind(JSON.stringify(settings)),
  ];
}
