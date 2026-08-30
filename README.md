# Pre-Programmed

A local-first text RPG whose authenticated author mode edits the exact game being played.

## Hosting

- Public client: `https://natanai.github.io/pre-programmed/`
- API: `https://pre-programmed.natanai.workers.dev/api/*`
- Mutable world state: Cloudflare D1
- Source and binary/static assets: this GitHub repository

See [`docs/HOSTING.md`](docs/HOSTING.md) and [`docs/PROJECT-SPEC.md`](docs/PROJECT-SPEC.md) for the ownership model and foundational constraints.

## Development

```sh
npm install
npm run dev
```

Validation:

```sh
npm run typecheck
npm run build:pages
```

Cloudflare deployment remains automatic from `main` through the connected Workers Build. GitHub Pages is published from the existing CI workflow on pushes to `main`.
