import { AuthorToolIndex, type AuthorToolGroup } from "../AuthorToolIndex";
import type { AuthorPanelRoute } from "../workSurfaceNavigation";
import { WorkspacePanel } from "./WorkspacePanel";
import { Inventory } from "../../features/inventory/ui/Inventory";
import { ItemEditor } from "../../features/inventory/author/ItemEditor";
import { AssetExplorer } from "../../features/media/author/AssetExplorer";
import { SynthPanel } from "../../features/media/author/SynthPanel";
import { InteractionEditor } from "../../features/narrative/author/InteractionEditor";
import { NodeEditor } from "../../features/narrative/author/NodeEditor";
import { StructureNavigator } from "../../features/narrative/author/StructureNavigator";
import { DefinitionsPanel } from "../../features/state/author/DefinitionsPanel";
import type { EffectEvent } from "../../game/effects";
import type {
  AuthorBookmark,
  MutationOperation,
  PlayState,
  ProjectSnapshot,
} from "../../game/model";

type Persist = (
  operations: MutationOperation[],
  description: string,
  closeAfterSave?: boolean,
) => Promise<void>;

/**
 * Composition root for focused Author workspaces.
 *
 * App owns the live game session and navigation state; this host owns which
 * feature workspace renders for the current Author route. Keeping this list in
 * one Author-only composition layer prevents the application root from
 * importing every editor as the feature set grows.
 */
export function AuthorWorkspaceHost({
  panel,
  inventoryOpen,
  toolGroups,
  snapshot,
  playState,
  authorMode,
  authorToken,
  persist,
  leaveCurrentSurface,
  pushPanel,
  onInventoryState,
  onInventoryOutput,
  onEvents,
  onSnapshot,
  onRestore,
}: {
  panel: AuthorPanelRoute | null;
  inventoryOpen: boolean;
  toolGroups: AuthorToolGroup[];
  snapshot: ProjectSnapshot;
  playState: PlayState;
  authorMode: boolean;
  authorToken: string;
  persist: Persist;
  leaveCurrentSurface: () => void;
  pushPanel: (route: AuthorPanelRoute) => void;
  onInventoryState: (state: PlayState) => void;
  onInventoryOutput: (text: string) => void;
  onEvents: (events: EffectEvent[]) => void;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
  onRestore: (bookmark: AuthorBookmark) => void;
}) {
  if (panel?.type === "interaction") {
    return <div className="dialogue-authoring-popover">
      <InteractionEditor
        snapshot={snapshot}
        playState={playState}
        initial={panel.interaction}
        initialCommand={panel.command}
        fallback={panel.fallback}
        onSave={(operations, description) => persist(operations, description, true)}
        onCancel={leaveCurrentSurface}
      />
    </div>;
  }

  if (panel?.type === "tools") return <AuthorToolIndex groups={toolGroups} />;

  if (inventoryOpen) return <Inventory
    snapshot={snapshot}
    state={playState}
    authorMode={authorMode}
    onState={onInventoryState}
    onOutput={onInventoryOutput}
    onEvents={onEvents}
    onEditItem={(item) => pushPanel({ type: "item", item })}
    onCreateItem={() => pushPanel({ type: "item" })}
    onSave={persist}
    onClose={leaveCurrentSurface}
  />;

  if (panel?.type === "node") return <NodeEditor
    node={panel.node}
    snapshot={snapshot}
    onSave={persist}
    onCancel={leaveCurrentSurface}
  />;

  if (panel?.type === "definitions") return <DefinitionsPanel
    snapshot={snapshot}
    onSave={persist}
    onClose={leaveCurrentSurface}
  />;

  if (panel?.type === "structure") return <StructureNavigator
    snapshot={snapshot}
    playState={playState}
    onOpenNode={(nodeId) => {
      const node = snapshot.nodes.find((candidate) => candidate.id === nodeId);
      if (node) pushPanel({ type: "node", node });
    }}
    onEditInteraction={(interaction) => pushPanel({ type: "interaction", interaction })}
    onClose={leaveCurrentSurface}
  />;

  if (panel?.type === "assets") return <AssetExplorer
    snapshot={snapshot}
    onClose={leaveCurrentSurface}
  />;

  if (panel?.type === "synth") return <SynthPanel
    snapshot={snapshot}
    onSave={persist}
    onClose={leaveCurrentSurface}
  />;

  if (panel?.type === "workspace") return <WorkspacePanel
    token={authorToken}
    snapshot={snapshot}
    playState={playState}
    initialView={panel.view}
    onSave={persist}
    onSnapshot={onSnapshot}
    onRestore={onRestore}
    onClose={leaveCurrentSurface}
  />;

  if (panel?.type === "item") return <ItemEditor
    snapshot={snapshot}
    initial={panel.item}
    onSave={persist}
    onCancel={leaveCurrentSurface}
  />;

  return null;
}
