import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./ui/terminalPrompt.css";
import "./ui/notificationLayout.css";
import "./author/authorWorkspaceShell.css";
import "./author/authorDesktopSuite.css";
import { installAuthorNumberInputScrubbing } from "./author/ui/authorNumberInputScrubbing";
import { primeProjectSnapshot } from "./data/api";
import { saveCachedSnapshot } from "./data/localProject";
import { isPlaySessionCompatible, loadPlaySession } from "./data/localPlaySession";
import { immediatelyReachableInventoryAssetIds } from "./features/inventory/playerAssets";
import { preloadImageAssets } from "./platform/assets/preload";
import { installationSettings } from "./platform/installation/settings";
import { UniverseBootstrap } from "./ui/UniverseBootstrap";

installAuthorNumberInputScrubbing();

const playerSessionReady = loadPlaySession();
const projectReady = primeProjectSnapshot().then(async (project) => {
  void playerSessionReady.then((session) => {
    const state = session && isPlaySessionCompatible(project, session) ? session.playState : null;
    return preloadImageAssets(project, immediatelyReachableInventoryAssetIds(project, state));
  }).catch(() => undefined);
  await saveCachedSnapshot(project);
  return project;
});
const installation = installationSettings();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UniverseBootstrap projectReady={projectReady} startButtonText={installation.startButtonText}>
      <App />
    </UniverseBootstrap>
  </StrictMode>,
);
