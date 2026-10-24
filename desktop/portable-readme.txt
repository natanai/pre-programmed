PRE-PROGRAMMED — WINDOWS PORTABLE ENGINE

1. Extract the entire Pre-Programmed folder from the ZIP.
2. Keep Pre-Programmed.exe, installation.txt, assets, and _engine together. You normally never need to open _engine.
3. Open installation.txt. Set AUTHOR_KEY= for your Author password and START_BUTTON_TEXT= for the first button shown before the terminal.
4. Double-click Pre-Programmed.exe.
5. Type: admin
6. Enter the Author key from installation.txt.

UPDATING WITHOUT LOSING YOUR GAME
1. Close Pre-Programmed. Export a .ppgame backup in Author mode first if possible.
2. Extract the NEW ZIP into a separate empty folder; do not replace only Pre-Programmed.exe.
3. Copy _engine/data, assets, and installation.txt FROM YOUR OLD FOLDER into the NEW folder. Keep their contents. The old folder is your safety backup.
4. Open Pre-Programmed.exe in the NEW folder and check your Characters, aliases, and Nodes before deleting the old folder.

IMPORTANT: The Pre-Programmed.exe beside installation.txt is only a launcher. The actual application is inside _engine, and your saved game is inside _engine/data. Replacing only the top-level EXE will NOT update the Author tools. An imported .ppgame also cannot update the engine; always open it in the newly extracted engine first.

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
The _engine folder contains the bundled runtime plus this installation's local database, Electron state, cache, and logs. installation.txt owns this extracted installation's Author password and pre-terminal start button text. Downloads use a normal Windows Save As dialog, so there is no engine-owned exports folder.

MOVING TO GITHUB / CLOUDFLARE
Export your game as a .ppgame file and bring your assets folder with it. A hosted installation uses a GitHub/Cloudflare ADMIN_KEY secret. You may reuse the AUTHOR_KEY value from installation.txt or choose a different password; the game does not depend on it.

This build does not install Node.js, npm, Git, Electron, Cloudflare tools, or other dependencies on Windows. The required runtime is already inside this folder. It does not require a Cloudflare account or internet connection for local play/authoring.
