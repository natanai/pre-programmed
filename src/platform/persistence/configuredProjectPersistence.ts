import type { ProjectPersistence } from "./projectPersistence";
import { cloudflareProjectPersistence } from "./cloudflareProjectPersistence";

/**
 * Platform composition root for authored-project storage.
 *
 * The browser-hosted distribution currently selects Cloudflare. A future local
 * distribution can select a local-file/SQLite implementation here (or through
 * build-time platform selection) without changing App or Author mutation code.
 */
export const configuredProjectPersistence: ProjectPersistence = cloudflareProjectPersistence;
