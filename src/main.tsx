import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./ui/terminalPrompt.css";
import "./author/authorWorkspaceShell.css";
import "./author/authorDesktopSuite.css";
import "./author/workspace/workspacePanelLocations.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
