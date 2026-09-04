PRE-PROGRAMMED — WINDOWS PORTABLE ENGINE

1. Keep Pre-Programmed.exe and the assets folder together.
2. Double-click Pre-Programmed.exe.
3. Type: admin
4. Local Author key: local

YOUR GAME
Author mode → PROJECT FILE can export your authored game to one .ppgame file or import it into another Pre-Programmed build.

The .ppgame file contains authored project data, synths, generated vector Media, and saved Author locations. Ordinary image/audio files are separate.

FILE MEDIA
Put ordinary image/audio files anywhere inside the assets folder. Each file needs a neighboring .asset.json sidecar with its stable Media id. Media exported from Author mode already includes the matching sidecar.

Example:
assets\audio\door.ogg
assets\audio\door.ogg.asset.json

LOCAL DATA
The engine creates a data folder beside the executable. That is its working local database. Export a .ppgame file before replacing or moving an engine build when you want a portable project reference.

This portable build does not require Node.js, npm, Git, a Cloudflare account, or an internet connection.
