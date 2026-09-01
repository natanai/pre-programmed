export const AUTHOR_DESKTOP_MIN_WIDTH_REM = 20;
export const AUTHOR_DESKTOP_GAME_MIN_WIDTH_REM = 28;
export const AUTHOR_DESKTOP_MAX_VIEWPORT_RATIO = 0.6;
export const AUTHOR_DESKTOP_DEFAULT_MIN_REM = 22;
export const AUTHOR_DESKTOP_DEFAULT_MAX_REM = 30;
export const AUTHOR_DESKTOP_DEFAULT_VIEWPORT_RATIO = 0.28;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function authorDesktopGapPx(viewportWidth: number, remPx = 16) {
  return clamp(viewportWidth * 0.02, remPx, remPx * 2);
}

export function authorDesktopWidthBounds(viewportWidth: number, remPx = 16) {
  const minimum = AUTHOR_DESKTOP_MIN_WIDTH_REM * remPx;
  const gameMinimum = AUTHOR_DESKTOP_GAME_MIN_WIDTH_REM * remPx;
  const gap = authorDesktopGapPx(viewportWidth, remPx);
  const maximumByRatio = viewportWidth * AUTHOR_DESKTOP_MAX_VIEWPORT_RATIO;
  const maximumByGame = viewportWidth - gameMinimum - gap;
  const maximum = Math.max(minimum, Math.min(maximumByRatio, maximumByGame));
  return { minimum, maximum };
}

export function defaultAuthorDesktopWidth(viewportWidth: number, remPx = 16) {
  const preferred = clamp(
    viewportWidth * AUTHOR_DESKTOP_DEFAULT_VIEWPORT_RATIO,
    AUTHOR_DESKTOP_DEFAULT_MIN_REM * remPx,
    AUTHOR_DESKTOP_DEFAULT_MAX_REM * remPx,
  );
  const { minimum, maximum } = authorDesktopWidthBounds(viewportWidth, remPx);
  return clamp(preferred, minimum, maximum);
}

export function clampAuthorDesktopWidth(width: number, viewportWidth: number, remPx = 16) {
  const { minimum, maximum } = authorDesktopWidthBounds(viewportWidth, remPx);
  return clamp(width, minimum, maximum);
}
