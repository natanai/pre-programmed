import type { SemanticReferenceProvider } from "../../engine/references/types";

export const NARRATIVE_SEMANTIC_REFERENCE_PROVIDERS: readonly SemanticReferenceProvider[] = [
  {
    kind: "narrative.node",
    label: "Nodes",
    description: "Authored narrative nodes and the node active in the current run.",
    authorSyntax: "node",
    authorResourceKind: "node",
    defaultProjection: "label",
    candidates: ({ snapshot, state }) => {
      const current = snapshot.nodes.find((node) => node.id === state.currentNodeId);
      return [
        {
          id: "current",
          key: "current-node",
          label: "Current node",
          detail: current ? `Node #${current.nodeNumber}` : "Missing current node",
          aliases: ["current node", "this node"],
          defaultProjection: "label",
          projections: {
            label: current ? `Node #${current.nodeNumber}` : "",
            number: current?.nodeNumber ?? null,
            text: current?.text ?? "",
          },
          author: current ? { resourceKind: "node", resourceId: current.id } : undefined,
          contextual: true,
        },
        ...snapshot.nodes.map((node) => ({
          id: node.id,
          key: `node-${node.nodeNumber}`,
          label: `Node #${node.nodeNumber}`,
          detail: node.text.trim().replace(/\s+/g, " ").slice(0, 72),
          aliases: [`node ${node.nodeNumber}`, `node-${node.nodeNumber}`],
          defaultProjection: "label",
          projections: {
            label: `Node #${node.nodeNumber}`,
            number: node.nodeNumber,
            text: node.text,
          },
          author: { resourceKind: "node", resourceId: node.id },
        })),
      ];
    },
    projectResource: (id, snapshot) => id !== "current" && snapshot.nodes.some((node) => node.id === id)
      ? { resourceKind: "node", resourceId: id }
      : null,
  },
  {
    kind: "narrative.interaction",
    label: "Scene inputs",
    description: "Authored node-specific player inputs and invalid-input definitions.",
    authorSyntax: "input",
    authorResourceKind: "interaction",
    defaultProjection: "label",
    candidates: ({ snapshot }) => snapshot.interactions.map((interaction) => ({
      id: interaction.id,
      key: `input-${interaction.id.slice(0, 8)}`,
      label: interaction.wording || interaction.aliases[0] || "Invalid input response",
      detail: snapshot.nodes.find((node) => node.id === interaction.sourceNodeId)
        ? `Node #${snapshot.nodes.find((node) => node.id === interaction.sourceNodeId)!.nodeNumber}`
        : "Missing source node",
      aliases: [interaction.wording, ...interaction.aliases].filter(Boolean),
      defaultProjection: "label",
      projections: {
        label: interaction.wording || interaction.aliases[0] || "Invalid input response",
      },
      author: { resourceKind: "interaction", resourceId: interaction.id },
    })),
    projectResource: (id, snapshot) => snapshot.interactions.some((interaction) => interaction.id === id)
      ? { resourceKind: "interaction", resourceId: id }
      : null,
  },
];
