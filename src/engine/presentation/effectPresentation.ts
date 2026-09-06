import type { AuthoredSourceIdentity } from "./authoredSource";
import type { EffectEvent } from "../rules/effectRuntime";
import type { ProjectSnapshot } from "../project/model";

/** UI capabilities the application shell offers to feature effect presenters. */
export type EffectPresentationSurface = {
  notify(text: string, anchorLineId?: string, source?: AuthoredSourceIdentity): void;
  /** Append ordinary persistent player-visible text to the terminal history. */
  appendTranscript(text: string, source?: AuthoredSourceIdentity): void;
  /** Append stable media identity; the rendering feature resolves current content. */
  appendInlineAsset(assetId: string, source?: AuthoredSourceIdentity): void;
  /** Open stable media identity; the rendering feature resolves current content. */
  showOverlayAsset(assetId: string, source?: AuthoredSourceIdentity): void;
  /** Run a reusable authored radix presentation on the live player surface. */
  showRadixSequence(sequenceId: string, source?: AuthoredSourceIdentity): void;
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
