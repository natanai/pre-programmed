# Hosting ownership

Pre-Programmed deliberately separates static client hosting from mutable backend state while using one deployment owner.

- **GitHub Pages** owns the public React client at `https://natanai.github.io/pre-programmed/`.
- **Cloudflare Worker** is API-only at `https://pre-programmed.natanai.workers.dev/api/*`.
- **Cloudflare D1** owns mutable structured game data.
- **GitHub repository** owns source code and binary/static assets.
- **GitHub Actions** is the sole production deployment owner for both the Pages client and the Cloudflare Worker.

Normal deployment flow:

1. Work on a feature branch.
2. Merge an approved PR to `main`.
3. The existing CI workflow tests, typechecks, and builds the client.
4. GitHub Actions deploys the Cloudflare API Worker with Wrangler using repository secrets.
5. The workflow verifies that `/api/health` is current JSON from the D1-backed API.
6. Only after the Worker verifies successfully does GitHub Actions publish the client to GitHub Pages.

This ordering prevents a newer client from being published against a stale API. A production workflow is not successful unless both deployments succeed.

No routine Cloudflare dashboard deployment is expected. Cloudflare Workers Builds / Git integration is not a deployment owner and should be disabled after the first successful GitHub-owned Worker deployment is verified.

## One-time account setup — completed

The required account setup has already been completed:

- GitHub repository Settings → Pages → Source is **GitHub Actions**.
- Cloudflare Worker has an encrypted secret named `ADMIN_KEY`.
- GitHub Actions repository secrets contain `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for non-interactive Wrangler deployment.

Do not ask for, reveal, log, commit, or store any of those secret values in the repository, issue tracker, PR, frontend bundle, or game database.

## Backups

Author mode exposes a `backup` / `/backup` command. The Worker returns an authenticated JSON backup containing SQLite schema definitions and every row from every non-internal D1 table. The browser downloads it as a local file. Backup generation reads D1 directly; GitHub and browser caches are not treated as the backup source.
