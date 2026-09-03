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
      context: "Choose an image source",
      blocks: [{
        type: "status",
        id: "media-image-create-help",
        tone: "info",
        text: "Upload any image file, or create a scalable vector on a logical grid. Both become the same media-image resource after saving.",
      }],
      actions: [
        {
          id: "media-image-create-file",
          label: "UPLOAD FILE",
          onAction: () => context.pushTask({
            type: "feature",
            feature: "media",
            workspace: "asset",
            data: { kind: "image", resourceTask: "media-image" },
          }, relayCreatedImage),
        },
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
