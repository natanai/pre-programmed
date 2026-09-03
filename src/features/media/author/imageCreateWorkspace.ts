import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";

export const mediaImageCreateWorkspace = defineAuthorWorkspace({
  id: "media-image-create",
  matches: (route) => route.type === "feature" && route.feature === "media" && route.workspace === "image-create",
  createDraft: () => ({}),
  buildSpec: ({ context }) => {
    const relayCreatedImage = (result: Parameters<typeof context.completeTask>[0]) => {
      if (result?.type === "resource" && result.kind === "media-image") context.completeTask(result);
    };
    return {
      id: "media-image-create",
      title: "New image",
      context: "Create D1-generated image Media",
      blocks: [{
        type: "status",
        id: "media-image-create-help",
        tone: "info",
        text: "Create a scalable vector on a logical grid. Conventional image files belong under public/assets/ with a stable .asset.json sidecar and become selectable Media after the next build.",
      }],
      actions: [
        {
          id: "media-image-create-vector",
          label: "CREATE VECTOR",
          onAction: () => context.pushTask({
            type: "feature",
            feature: "media",
            workspace: "vector-asset",
            data: { kind: "image", resourceTask: "media-image" },
          }, relayCreatedImage),
        },
      ],
    };
  },
});
