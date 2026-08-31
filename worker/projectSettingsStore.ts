import type { ProjectSettings } from "../src/engine/project/settings";
import { normalizeProjectSettings } from "../src/engine/project/settings";

export async function loadProjectSettings(db: D1Database): Promise<ProjectSettings> {
  const row = await db.prepare("SELECT settings_json FROM project_meta WHERE id = 1")
    .first<{ settings_json: string }>();
  return normalizeProjectSettings(row?.settings_json ? JSON.parse(row.settings_json) : {});
}

export function projectSettingsStatements(db: D1Database, settings: ProjectSettings) {
  return [
    db.prepare("UPDATE project_meta SET settings_json = ? WHERE id = 1")
      .bind(JSON.stringify(settings)),
  ];
}
