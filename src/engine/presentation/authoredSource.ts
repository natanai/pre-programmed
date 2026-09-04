export type AuthoredSourceIdentity = {
  /** Author resource-provider kind, e.g. node, interaction, item, variable. */
  resourceKind: string;
  /** Stable durable definition id owned by that resource provider. */
  resourceId: string;
  /** Optional owner-specific focus hints merged into the canonical edit route. */
  focus?: Readonly<Record<string, string>>;
};

export function authoredSource(
  resourceKind: string,
  resourceId: string,
  focus?: Readonly<Record<string, string>>,
): AuthoredSourceIdentity {
  return {
    resourceKind,
    resourceId,
    ...(focus && Object.keys(focus).length ? { focus } : {}),
  };
}
