# DOS visual target

## Canonical first frame

No boot screen, title, logo, help copy, simulated BIOS text, loading message, or command prompt may appear before the story begins.

The first player-visible words are exactly:

```text
you are born
```

The line follows the normal character-by-character renderer. When it completes, the input line appears as:

```text
U:\>_
```

`U:` means **Universe**. The blinking underscore is the text cursor and is not stored as story text.

## Historical rendering target

The visual reference is the familiar IBM VGA-era DOS text presentation:

- Code Page 437-style glyph repertoire and box drawing
- VGA 80×25 reference mode
- 720×400 reference raster
- 9×16 character-cell proportions
- 16-color VGA text palette capability
- cursor represented as a blinking full-cell-width underline/low scan-line form

The exactness target is the **glyph raster, spacing, palette, cursor behavior, and lack of modern browser chrome**, not a mandatory fixed 720×400 CSS viewport. A literal 80-column framebuffer becomes illegible on phones, so the renderer may fit fewer columns while preserving the same cell/glyph character and pixel behavior.

## Font asset

Do not silently substitute a modern monospace font in a production release and call it exact DOS. The repository must eventually contain a properly licensed local VGA/CP437-compatible font asset. Until that asset is supplied, development uses a monospace fallback and must visibly remain classified as a temporary approximation in author/development documentation only.

## Responsive rule

Mobile is not a scaled screenshot of desktop. Preserve DOS text character rather than shrinking 80 columns until unreadable. Gameplay must have no ordinary page-level horizontal scrolling.
