# Hosting ownership

Pre-Programmed deliberately separates static client hosting from mutable backend state.

- **GitHub Pages** owns the public React client at `https://natanai.github.io/pre-programmed/`.
- **Cloudflare Worker** is API-only at `https://pre-programmed.natanai.workers.dev/api/*`.
- **Cloudflare D1** owns mutable structured game data.
- **GitHub repository** owns source code and binary/static assets.

Normal deployment flow:

1. Work on a feature branch.
2. Merge an approved PR to `main`.
3. The repository's single CI workflow publishes the client to GitHub Pages.
4. Cloudflare's existing Git integration deploys the API Worker from the same `main` commit.

No routine Cloudflare dashboard deployment is expected.

## One-time account setup

1. GitHub repository Settings → Pages → Source → **GitHub Actions**.
2. Cloudflare Worker → Variables and Secrets → add encrypted secret `ADMIN_KEY`.

Do not put the `ADMIN_KEY` value in the repository, issue tracker, PR, or game database.

## Backups

Author mode exposes a `backup` / `/backup` command. The Worker returns an authenticated JSON backup containing SQLite schema definitions and every row from every non-internal D1 table. The browser downloads it as a local file. Backup generation reads D1 directly; GitHub and browser caches are not treated as the backup source.
