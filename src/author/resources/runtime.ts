import type { ProjectSnapshot } from "../../game/model";
import { getAuthorResourceProvider } from "../features/registry";
import type { AuthorTaskCompletion, AuthorTaskRoute } from "../tasks/types";
import type { AuthorResourceTools } from "./types";

export function buildAuthorResourceTools(
  snapshot: ProjectSnapshot,
  pushTask: (route: AuthorTaskRoute, onComplete?: AuthorTaskCompletion) => string,
): AuthorResourceTools {
  const options = (kind: string) => getAuthorResourceProvider(kind)?.list(snapshot) ?? [];

  return {
    options,
    label: (kind) => getAuthorResourceProvider(kind)?.label ?? kind,
    canCreate: (kind) => Boolean(getAuthorResourceProvider(kind)?.createRoute),
    canEdit: (kind, value) => {
      const provider = getAuthorResourceProvider(kind);
      const resource = provider?.list(snapshot).find((option) => option.value === value);
      return Boolean(provider?.editRoute && resource && provider.editRoute(resource));
    },
    create(kind, onCreated) {
      const provider = getAuthorResourceProvider(kind);
      const route = provider?.createRoute?.();
      if (!provider || !route) return;
      pushTask(route, (result) => {
        if (result?.type === "resource" && result.kind === kind) onCreated(result);
      });
    },
    edit(kind, value, onComplete) {
      const provider = getAuthorResourceProvider(kind);
      if (!provider?.editRoute) return;
      const resource = provider.list(snapshot).find((option) => option.value === value);
      if (!resource) return;
      const route = provider.editRoute(resource);
      if (route) pushTask(route, onComplete);
    },
  };
}
