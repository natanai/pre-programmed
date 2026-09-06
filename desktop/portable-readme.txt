PRE-PROGRAMMED — WINDOWS PORTABLE ENGINE

1. Extract the entire Pre-Programmed folder from the ZIP.
2. Keep everything inside that folder together. Do not move only Pre-Programmed.exe.
3. Open installation.txt. Set AUTHOR_KEY= for your Author password and START_BUTTON_TEXT= for the first button shown before the terminal.
4. Double-click Pre-Programmed.exe.
5. Type: admin
6. Enter the Author key from installation.txt.

YOUR GAME
Author mode → PROJECT FILE can export your authored game to one .ppgame file or import it into another Pre-Programmed build.

The .ppgame file contains authored project data, synths, generated vector Media, and saved Author locations. It does not contain your Author password. Ordinary image/audio files are separate.

FILE MEDIA
Put ordinary image/audio files anywhere inside the assets folder. No JSON setup is required. On startup, the engine discovers supported files and assigns each bare file a deterministic stable Media id from its relative path.

When the assets folder is writable, the engine also creates a neighboring .asset.json identity receipt automatically. New receipts contain only the stable id. Keep that receipt with the file if you later move or rename the file so authored references continue pointing to the same Media resource.

Example after first launch:
assets\audio\door.ogg
assets\audio\door.ogg.asset.json

Media exported from Author mode includes the matching identity receipt automatically. Name, presentation, and editor settings remain in authored project data; the receipt is only file identity.

LOCAL DATA
The data folder contains this installation's local database and Electron runtime state. The exports folder is the default destination for project-file downloads. installation.txt owns this extracted installation's Author password and pre-terminal start button text. The engine keeps its writable runtime state inside this extracted Pre-Programmed folder.

MOVING TO GITHUB / CLOUDFLARE
Export your game as a .ppgame file and bring your assets folder with it. A hosted installation uses a GitHub/Cloudflare ADMIN_KEY secret. You may reuse the AUTHOR_KEY value from installation.txt or choose a different password; the game does not depend on it.

This build does not install Node.js, npm, Git, Electron, Cloudflare tools, or other dependencies on Windows. The required runtime is already inside this folder. It does not require a Cloudflare account or internet connection for local play/authoring.
