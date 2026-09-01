import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MUTATION_HANDLERS } from "../src/engine/project/mutationCatalog";
import { WORKER_FEATURE_PERSISTENCE, workerFeaturesForReset, workerFeaturesForRestore } from "../worker/features/catalog";
import { WORKER_MUTATION_VALIDATOR_BY_TYPE } from "../worker/features/validationCatalog";

const FEATURE_MUTATIONS = [
  "node.upsert",
  "interaction.upsert",
  "interaction.delete",
  "entity.upsert",
  "variable.upsert",
  "computed.upsert",
  "synth.upsert",
] as const;

describe("modular architecture composition roots", () => {
  it("composes optimistic feature mutation handlers without a central feature switch", () => {
    for (const type of FEATURE_MUTATIONS) expect(MUTATION_HANDLERS[type]).toBeTypeOf("function");
  });
  it("registers installed project-data features with Worker persistence", () => {
    expect(WORKER_FEATURE_PERSISTENCE.map((feature) => feature.id)).toEqual(["narrative", "world", "state", "media"]);
  });
  it("delegates feature mutation validation through the feature validator catalog", () => {
    for (const type of FEATURE_MUTATIONS) expect(WORKER_MUTATION_VALIDATOR_BY_TYPE[type]).toBeDefined();
  });
  it("resets Narrative before World but restores World before Narrative", () => {
    const reset = workerFeaturesForReset().map((feature) => feature.id);
    const restore = workerFeaturesForRestore().map((feature) => feature.id);
    expect(reset.indexOf("narrative")).toBeLessThan(reset.indexOf("world"));
    expect(restore.indexOf("world")).toBeLessThan(restore.indexOf("narrative"));
  });
  it("keeps optional feature workspace routes out of central Author navigation", () => {
    const navigationSource = readFileSync(new URL("../src/author/workSurfaceNavigation.ts", import.meta.url), "utf8");
    for (const legacyRoute of ["inventory", "item", "assets", "synth"]) expect(navigationSource).not.toContain(`type: \"${legacyRoute}\"`);
    expect(navigationSource).toContain('type: "feature"');
  });
});
