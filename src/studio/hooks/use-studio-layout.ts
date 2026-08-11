"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "tuzuo-studio-layout";
const NARROW_QUERY = "(max-width: 1020px)";

type LayoutPreferences = {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  dataPanelHeight: number;
};

const DEFAULT_LAYOUT: LayoutPreferences = {
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  leftPanelWidth: 244,
  rightPanelWidth: 328,
  dataPanelHeight: 320,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function loadLayoutPreferences(isNarrowViewport: boolean) {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  let stored: Partial<LayoutPreferences> = {};
  if (saved) {
    try {
      stored = JSON.parse(saved) as Partial<LayoutPreferences>;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    leftPanelCollapsed: isNarrowViewport
      ? true
      : typeof stored.leftPanelCollapsed === "boolean"
        ? stored.leftPanelCollapsed
        : DEFAULT_LAYOUT.leftPanelCollapsed,
    rightPanelCollapsed: isNarrowViewport
      ? true
      : typeof stored.rightPanelCollapsed === "boolean"
        ? stored.rightPanelCollapsed
        : DEFAULT_LAYOUT.rightPanelCollapsed,
    leftPanelWidth: clamp(
      Number(stored.leftPanelWidth) || DEFAULT_LAYOUT.leftPanelWidth,
      220,
      360,
    ),
    rightPanelWidth: clamp(
      Number(stored.rightPanelWidth) || DEFAULT_LAYOUT.rightPanelWidth,
      292,
      420,
    ),
    dataPanelHeight: clamp(
      Number(stored.dataPanelHeight) || DEFAULT_LAYOUT.dataPanelHeight,
      220,
      720,
    ),
  } satisfies LayoutPreferences;
}

export function useStudioLayout() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const frame = window.requestAnimationFrame(() => {
      setLayout(loadLayoutPreferences(media.matches));
      setIsNarrowViewport(media.matches);
      hydratedRef.current = true;
    });

    const onChange = (event: MediaQueryListEvent) => {
      setIsNarrowViewport(event.matches);
      if (event.matches) {
        setLayout((current) => ({
          ...current,
          leftPanelCollapsed: true,
          rightPanelCollapsed: true,
        }));
      } else {
        setLayout(loadLayoutPreferences(false));
      }
    };
    media.addEventListener("change", onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || isNarrowViewport) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [isNarrowViewport, layout]);

  const togglePanel = (side: "left" | "right") => {
    setLayout((current) => {
      if (side === "left") {
        const opening = current.leftPanelCollapsed;
        return {
          ...current,
          leftPanelCollapsed: !current.leftPanelCollapsed,
          rightPanelCollapsed:
            isNarrowViewport && opening ? true : current.rightPanelCollapsed,
        };
      }
      const opening = current.rightPanelCollapsed;
      return {
        ...current,
        rightPanelCollapsed: !current.rightPanelCollapsed,
        leftPanelCollapsed:
          isNarrowViewport && opening ? true : current.leftPanelCollapsed,
      };
    });
  };

  const startPanelResize = (
    side: "left" | "right",
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (isNarrowViewport) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth =
      side === "left" ? layout.leftPanelWidth : layout.rightPanelWidth;
    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = clamp(
        side === "left" ? startWidth + delta : startWidth - delta,
        side === "left" ? 220 : 292,
        side === "left" ? 360 : 420,
      );
      setLayout((current) => ({
        ...current,
        [side === "left" ? "leftPanelWidth" : "rightPanelWidth"]: nextWidth,
      }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const startDataResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = layout.dataPanelHeight;
    const onMove = (moveEvent: PointerEvent) => {
      const maxHeight = Math.max(300, window.innerHeight * 0.68);
      setLayout((current) => ({
        ...current,
        dataPanelHeight: clamp(
          startHeight + startY - moveEvent.clientY,
          220,
          maxHeight,
        ),
      }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return {
    ...layout,
    isNarrowViewport,
    togglePanel,
    closePanels: () =>
      setLayout((current) => ({
        ...current,
        leftPanelCollapsed: true,
        rightPanelCollapsed: true,
      })),
    startPanelResize,
    startDataResize,
  };
}
