import type { AuthorPlatform } from "./authorPlatform";
import { cloudflareAuthorPlatform } from "../cloudflare/cloudflareAuthorPlatform";

/**
 * Application composition point for Author-session services.
 *
 * Hosted builds currently select Cloudflare. A future local distribution can
 * replace this selection without changing Author workspaces or feature code.
 */
export const configuredAuthorPlatform: AuthorPlatform = cloudflareAuthorPlatform;
