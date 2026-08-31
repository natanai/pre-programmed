# Pre-Programmed

Prototype text RPG / authoring engine.

## Run locally

```sh
npm install
npm run dev
```

## Game assets

Put assets you want to assign from the app anywhere under:

```text
public/assets/
```

Recommended organization:

```text
public/assets/sprites/
public/assets/images/
public/assets/audio/
```

The build scans that folder recursively. Supported game-asset formats are PNG, WebP, GIF, SVG, MP3, WAV, and OGG. Files in `public/assets/` are served at the matching `/assets/...` path and appear in the app's repository asset list after the next build/deploy.

## Production

Pushing `main` runs the single GitHub Actions deployment workflow. It builds the client, deploys the Cloudflare Worker, verifies the API, then publishes GitHub Pages.

- App: https://natanai.github.io/pre-programmed/
- API: https://pre-programmed.natanai.workers.dev/api/*
