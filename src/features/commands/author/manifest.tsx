import type { AuthorFeatureManifest } from "../../../author/features/types";
import {
  COMMAND_PROJECT_SETTINGS_SECTION,
  renderCommandSettingsWorkspace,
} from "./CommandSettings";

export const commandsAuthorFeature: AuthorFeatureManifest = {
  id: "commands",
  projectSettings: COMMAND_PROJECT_SETTINGS_SECTION,
  renderWorkspace: renderCommandSettingsWorkspace,
};
