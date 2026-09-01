import { useEffect } from "react";
import { isSoftwareKeyboardOpen } from "./viewport";

/**
 * Owns browser/visualViewport synchronization for the terminal shell.
 *
 * Game and Author controllers consume CSS viewport variables but do not need to
 * know how mobile Safari reports keyboard-driven visual viewport changes.
 */
export function useTerminalViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let maximumViewportHeight = viewport?.height ?? window.innerHeight;
    let viewportWidth = viewport?.width ?? window.innerWidth;
    let focusFrame = 0;

    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      if (Math.abs(width - viewportWidth) > 80) {
        maximumViewportHeight = height;
        viewportWidth = width;
      } else {
        maximumViewportHeight = Math.max(maximumViewportHeight, height);
      }
      const active = document.activeElement;
      const editableFocused = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
      root.style.setProperty("--terminal-viewport-height", `${height}px`);
      root.style.setProperty("--terminal-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      root.dataset.keyboardOpen = String(isSoftwareKeyboardOpen({
        viewportHeight: height,
        maximumViewportHeight,
        viewportWidth: width,
        editableFocused,
      }));
    };

    const syncViewportAfterFocus = () => {
      window.cancelAnimationFrame(focusFrame);
      focusFrame = window.requestAnimationFrame(syncViewport);
    };

    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    document.addEventListener("focusin", syncViewportAfterFocus);
    document.addEventListener("focusout", syncViewportAfterFocus);

    return () => {
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      document.removeEventListener("focusin", syncViewportAfterFocus);
      document.removeEventListener("focusout", syncViewportAfterFocus);
      window.cancelAnimationFrame(focusFrame);
      root.style.removeProperty("--terminal-viewport-height");
      root.style.removeProperty("--terminal-viewport-top");
      delete root.dataset.keyboardOpen;
    };
  }, []);
}
