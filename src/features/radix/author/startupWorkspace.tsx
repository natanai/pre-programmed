import type { AuthorProjectSettingsSection } from "../../../author/features/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";

type RadixStartupDraft = {
  enabled: boolean;
  sequenceId: string;
};

export const radixStartupWorkspace = defineAuthorWorkspace<RadixStartupDraft>({
  id: "radix-startup-settings",
  matches: (route) => route.type === "feature" && route.feature === "radix" && route.workspace === "startup",
  createDraft: (_route, context) => ({ ...context.snapshot.settings.radix.startup }),
  canSave: ({ draft }) => !draft.enabled || Boolean(draft.sequenceId),
  save: async ({ context, draft }) => {
    const settings = {
      ...context.snapshot.settings,
      radix: {
        ...context.snapshot.settings.radix,
        startup: { enabled: draft.enabled, sequenceId: draft.sequenceId },
      },
    };
    const result = await context.persist(
      [{ type: "project.settings", settings }],
      "Changed player launch sort sequence",
    );
    return result.status === "saved" || result.status === "queued"
      ? { accepted: true, draft }
      : { accepted: false };
  },
  buildSpec: ({ context, draft, setDraft }) => ({
    id: "radix-startup-settings",
    title: "PLAYER LAUNCH",
    context: "Optional launch presentation before normal play",
    blocks: [{
      type: "section",
      id: "radix-startup",
      label: "LAUNCH SEQUENCE",
      importance: "primary",
      children: [
        {
          type: "toggle",
          id: "radix-startup-enabled",
          label: "Enabled on app launch",
          checked: draft.enabled,
          onChange: (enabled) => setDraft({ ...draft, enabled }),
          help: "Runs once when the player app opens. It does not count as entering a node.",
        },
        {
          type: "resource",
          id: "radix-startup-sequence",
          label: "Sort sequence",
          kind: "radix-sequence",
          value: draft.sequenceId,
          onChange: (sequenceId) => setDraft({ ...draft, sequenceId }),
          placeholder: "Choose launch sequence",
          allowEmpty: !draft.enabled,
        },
        {
          type: "action-row",
          id: "radix-startup-actions",
          actions: [
            ...(draft.sequenceId ? [{
              id: "radix-startup-preview",
              label: "PREVIEW",
              onAction: () => context.runtime.events([{ type: "radix", sequenceId: draft.sequenceId }]),
            }] : []),
            {
              id: "radix-startup-open-sequences",
              label: "OPEN SORT SEQUENCES",
              onAction: () => context.pushTask({ type: "feature", feature: "radix", workspace: "sequences" }),
            },
          ],
        },
      ],
    }],
  }),
});

export const RADIX_PROJECT_SETTINGS: readonly AuthorProjectSettingsSection[] = [{
  id: "radix-startup",
  label: "LAUNCH SEQUENCE",
  description: "Choose whether a reusable sort presentation runs once when the player app opens.",
  order: 20,
  route: { type: "feature", feature: "radix", workspace: "startup" },
}];
