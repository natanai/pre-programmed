const MOBILE_WIDTH = 700;

export function isSoftwareKeyboardOpen({
  viewportHeight,
  maximumViewportHeight,
  viewportWidth,
  editableFocused,
}: {
  viewportHeight: number;
  maximumViewportHeight: number;
  viewportWidth: number;
  editableFocused: boolean;
}) {
  const lostHeight = maximumViewportHeight - viewportHeight;
  const meaningfulReduction = Math.max(120, maximumViewportHeight * 0.18);
  return editableFocused && viewportWidth <= MOBILE_WIDTH && lostHeight >= meaningfulReduction;
}
