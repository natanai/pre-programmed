import type { EffectEvent } from "../rules/effectRuntime";
import type { ProjectSnapshot } from "../project/model";

/** UI capabilities the application shell offers to feature effect presenters. */
export type EffectPresentationSurface = {
  notify(text: string, anchorLineId?: string): void;
  appendInlineAsset(assetPath: string): void;
  showOverlayAsset(assetPath: string): void;
};

export type EffectPresentationContext = {
  snapshot: ProjectSnapshot;
  anchorLineId?: string;
  surface: EffectPresentationSurface;
};

export type EffectEventPresenter = (
  event: EffectEvent,
  context: EffectPresentationContext,
) => boolean;
