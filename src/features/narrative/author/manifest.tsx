import type { AuthorFeatureManifest } from "../../../author/features/types";
import { InteractionEditor } from "./InteractionEditor";
import { NodeEditor } from "./NodeEditor";
import { StructureNavigator } from "./StructureNavigator";
import { narrativeAuthorTools } from "./tools";

export const narrativeAuthorFeature: AuthorFeatureManifest = {
  id: "narrative",
  tools: narrativeAuthorTools,
  renderWorkspace(route, context) {
    if (route.type === "interaction") {
      return <div className="dialogue-authoring-popover">
        <InteractionEditor
          snapshot={context.snapshot}
          playState={context.playState}
          initial={route.interaction}
          initialCommand={route.command}
          fallback={route.fallback}
          onSave={(operations, description) => context.persist(operations, description, true)}
          onCancel={context.leaveCurrentSurface}
        />
      </div>;
    }

    if (route.type === "node") return <NodeEditor
      node={route.node}
      snapshot={context.snapshot}
      onSave={context.persist}
      onCancel={context.leaveCurrentSurface}
    />;

    if (route.type === "structure") return <StructureNavigator
      snapshot={context.snapshot}
      playState={context.playState}
      onOpenNode={(nodeId) => {
        const node = context.snapshot.nodes.find((candidate) => candidate.id === nodeId);
        if (node) context.pushPanel({ type: "node", node });
      }}
      onEditInteraction={(interaction) => context.pushPanel({ type: "interaction", interaction })}
      onClose={context.leaveCurrentSurface}
    />;

    return null;
  },
};
