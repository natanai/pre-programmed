import type { AuthorFeatureManifest } from "../../../author/features/types";
import { radixEffectAdapter } from "./ruleAdapters";
import { RADIX_TEXT_CUE_AUTHOR_ADAPTERS } from "./textCueAdapters";
import {
  RADIX_PROJECT_SETTINGS,
  radixSequenceEditorWorkspace,
  radixSequenceListWorkspace,
} from "./workspaces";

export const radixAuthorFeature: AuthorFeatureManifest = {
  id: "radix",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "radix") return null;
    if (route.workspace === "sequences") return "Radix sequences";
    if (route.workspace === "sequence") {
      const sequence = snapshot.settings.radix.sequences.find((candidate) => candidate.id === route.data?.sequenceId);
      return sequence?.label || "New radix sequence";
    }
    return null;
  },
  effects: [radixEffectAdapter],
  textCues: RADIX_TEXT_CUE_AUTHOR_ADAPTERS,
  projectSettings: RADIX_PROJECT_SETTINGS,
  resources: [{
    kind: "radix-sequence",
    label: "Radix Sequence",
    pluralLabel: "Radix Sequences",
    list: (snapshot) => snapshot.settings.radix.sequences.map((sequence) => ({
      id: sequence.id,
      value: sequence.id,
      label: sequence.label,
      detail: `${sequence.arraySize} values · base ${sequence.radix} · ${sequence.widthMode}`,
    })),
    createRoute: () => ({
      type: "feature",
      feature: "radix",
      workspace: "sequence",
      data: { sequenceId: "new", resourceTask: "radix-sequence" },
    }),
    editRoute: (resource) => ({
      type: "feature",
      feature: "radix",
      workspace: "sequence",
      data: { sequenceId: resource.id, resourceTask: "radix-sequence" },
    }),
  }],
  tools: (context) => [{
    groupId: "presentation",
    groupLabel: "PRESENTATION",
    groupOrder: 35,
    toolOrder: 10,
    tool: {
      id: "radix-sequences",
      label: "RADIX SEQUENCES",
      description: "Create reusable sorting visuals for startup, nodes, responses, and other authored effects.",
      searchText: "radix sort sorting loading universe startup transition thinking procedural visualization sound",
      onSelect: () => context.pushTask({ type: "feature", feature: "radix", workspace: "sequences" }),
    },
  }],
  terminalShortcuts: [{
    commands: ["/radix", "radix"],
    route: { type: "feature", feature: "radix", workspace: "sequences" },
  }],
  workspaces: [radixSequenceListWorkspace, radixSequenceEditorWorkspace],
};
