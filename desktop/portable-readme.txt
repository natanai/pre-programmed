PRE-PROGRAMMED — WINDOWS PORTABLE ENGINE

1. Extract the entire Pre-Programmed folder from the ZIP.
2. Keep everything inside that folder together. Do not move only Pre-Programmed.exe.
3. Open installation.txt. Set AUTHOR_KEY= for your Author password. Launch-sequence captions are authored on the Sort Sequence itself and travel with the .ppgame project.
4. Double-click Pre-Programmed.exe.
5. Type: admin
6. Enter the Author key from installation.txt.

YOUR GAME
Author mode → PROJECT FILE can export your authored game to one .ppgame file or import it into another Pre-Programmed build.

The .ppgame file contains authored project data, synths, generated vector Media, and saved Author locations. It does not contain your Author password. Ordinary image/audio files are separate.

FILE MEDIA
Put ordinary image/audio files anywhere inside the assets folder. Each file needs a neighboring .asset.json sidecar with its stable Media id. Media exported from Author mode already includes the matching sidecar.

Example:
assets\audio\door.ogg
assets\audio\door.ogg.asset.json

LOCAL DATA
The data folder contains this installation's local database and Electron runtime state. The exports folder is the default destination for project-file downloads. installation.txt owns this extracted installation's Author password. The engine keeps its writable runtime state inside this extracted Pre-Programmed folder.

MOVING TO GITHUB / CLOUDFLARE
Export your game as a .ppgame file and bring your assets folder with it. A hosted installation uses a GitHub/Cloudflare ADMIN_KEY secret. You may reuse the AUTHOR_KEY value from installation.txt or choose a different password; the game does not depend on it.

This build does not install Node.js, npm, Git, Electron, Cloudflare tools, or other dependencies on Windows. The required runtime is already inside this folder. It does not require a Cloudflare account or internet connection for local play/authoring.
