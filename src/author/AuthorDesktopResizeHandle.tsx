import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  authorDesktopWidthBounds,
  clampAuthorDesktopWidth,
  defaultAuthorDesktopWidth,
} from "./desktopLayout";

const DESKTOP_QUERY = "(min-width: 1000px) and (pointer: fine)";
const WIDTH_STORAGE_KEY = "pre-programmed:author-desktop-width";
const WIDTH_PROPERTY = "--author-desktop-suite-width";

type DragState = {
  pointerId: number;
  startX: number;
  startWidth: number;
  latestWidth: number;
};

function rootRemPx() {
  if (typeof window === "undefined") return 16;
  const value = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(value) && value > 0 ? value : 16;
}

function readInitialWidth() {
  if (typeof window === "undefined") return 448;
  const viewportWidth = window.innerWidth;
  const remPx = rootRemPx();
  try {
    const stored = Number.parseFloat(window.localStorage.getItem(WIDTH_STORAGE_KEY) ?? "");
    if (Number.isFinite(stored)) return clampAuthorDesktopWidth(stored, viewportWidth, remPx);
  } catch {
    // Display preferences are optional; private browsing can reject storage.
  }
  return defaultAuthorDesktopWidth(viewportWidth, remPx);
}

export function AuthorDesktopResizeHandle() {
  const [desktopActive, setDesktopActive] = useState(() => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches);
  const [width, setWidth] = useState(readInitialWidth);
  const [bounds, setBounds] = useState(() => {
    if (typeof window === "undefined") return authorDesktopWidthBounds(1440);
    return authorDesktopWidthBounds(window.innerWidth, rootRemPx());
  });
  const widthRef = useRef(width);
  const dragRef = useRef<DragState | null>(null);

  const setLiveWidth = (candidate: number) => {
    const next = clampAuthorDesktopWidth(candidate, window.innerWidth, rootRemPx());
    widthRef.current = next;
    setWidth(next);
    return next;
  };

  const persistWidth = (next: number) => {
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(next)));
    } catch {
      // A rejected local preference must never block Author work.
    }
  };

  const resetWidth = () => {
    const next = setLiveWidth(defaultAuthorDesktopWidth(window.innerWidth, rootRemPx()));
    persistWidth(next);
  };

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const synchronizeViewport = () => {
      const active = media.matches;
      const nextBounds = authorDesktopWidthBounds(window.innerWidth, rootRemPx());
      setDesktopActive(active);
      setBounds(nextBounds);
      setWidth((current) => {
        const next = clampAuthorDesktopWidth(current, window.innerWidth, rootRemPx());
        widthRef.current = next;
        return next;
      });
    };
    synchronizeViewport();
    media.addEventListener("change", synchronizeViewport);
    window.addEventListener("resize", synchronizeViewport);
    return () => {
      media.removeEventListener("change", synchronizeViewport);
      window.removeEventListener("resize", synchronizeViewport);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (desktopActive) root.style.setProperty(WIDTH_PROPERTY, `${width}px`);
    else root.style.removeProperty(WIDTH_PROPERTY);
    return () => root.style.removeProperty(WIDTH_PROPERTY);
  }, [desktopActive, width]);

  useEffect(() => () => {
    delete document.documentElement.dataset.authorResizing;
  }, []);

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    persistWidth(drag.latestWidth);
    dragRef.current = null;
    delete document.documentElement.dataset.authorResizing;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!desktopActive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: widthRef.current,
      latestWidth: widthRef.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.documentElement.dataset.authorResizing = "true";
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const next = setLiveWidth(drag.startWidth + event.clientX - drag.startX);
    drag.latestWidth = next;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!desktopActive) return;
    const step = event.shiftKey ? 64 : 16;
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = widthRef.current - step;
    if (event.key === "ArrowRight") next = widthRef.current + step;
    if (event.key === "Home") next = bounds.minimum;
    if (event.key === "End") next = bounds.maximum;
    if (event.key === "Enter") {
      event.preventDefault();
      resetWidth();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    const clamped = setLiveWidth(next);
    persistWidth(clamped);
  };

  return <div
    className="author-desktop-resize-handle"
    role="separator"
    aria-label="Resize Author panel"
    aria-orientation="vertical"
    aria-valuemin={Math.round(bounds.minimum)}
    aria-valuemax={Math.round(bounds.maximum)}
    aria-valuenow={Math.round(width)}
    aria-valuetext={`${Math.round(width)} pixels wide`}
    tabIndex={desktopActive ? 0 : -1}
    title="Drag to resize Author panel. Double-click or press Enter to reset."
    onDoubleClick={resetWidth}
    onKeyDown={handleKeyDown}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={finishDrag}
    onPointerCancel={finishDrag}
  />;
}
