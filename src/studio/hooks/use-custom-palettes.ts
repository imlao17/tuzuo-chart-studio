"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { SavedPalette } from "../types";

const CUSTOM_PALETTES_STORAGE_KEY = "tuzuo-custom-palettes";

export function useCustomPalettes({
  paletteColors,
  setPaletteColors,
  themeId,
  setThemeId,
  setStatus,
  defaultColors,
}: {
  paletteColors: string[];
  setPaletteColors: Dispatch<SetStateAction<string[]>>;
  themeId: string;
  setThemeId: (themeId: string) => void;
  setStatus: (message: string) => void;
  defaultColors: string[];
}) {
  const [customPalettes, setCustomPalettes] = useState<SavedPalette[]>([]);
  const [editingPaletteId, setEditingPaletteId] = useState<string | null>(null);
  const [palettesLoaded, setPalettesLoaded] = useState(false);
  const [paletteName, setPaletteName] = useState("我的配色");
  const paletteStorageWarningRef = useRef(false);

  useEffect(() => {
    let nextPalettes: SavedPalette[] = [];
    try {
      const saved = window.localStorage.getItem(CUSTOM_PALETTES_STORAGE_KEY);
      if (saved) nextPalettes = JSON.parse(saved) as SavedPalette[];
    } catch {
      nextPalettes = [];
    }
    const frame = window.requestAnimationFrame(() => {
      setCustomPalettes(nextPalettes);
      setPalettesLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!palettesLoaded) return;
    try {
      window.localStorage.setItem(
        CUSTOM_PALETTES_STORAGE_KEY,
        JSON.stringify(customPalettes),
      );
      paletteStorageWarningRef.current = false;
    } catch {
      if (!paletteStorageWarningRef.current) {
        paletteStorageWarningRef.current = true;
        setStatus("配色保存失败，请导出项目文件备份");
      }
    }
  }, [customPalettes, palettesLoaded, setStatus]);

  function selectSavedPalette(palette: SavedPalette) {
    setThemeId(palette.id);
    setPaletteColors([...palette.colors]);
    setPaletteName(palette.name);
    setEditingPaletteId(null);
  }

  function editSavedPalette(palette: SavedPalette) {
    setThemeId(palette.id);
    setPaletteColors([...palette.colors]);
    setPaletteName(palette.name);
    setEditingPaletteId(palette.id);
    setStatus(`正在编辑「${palette.name}」`);
  }

  function movePaletteColor(index: number, direction: -1 | 1) {
    setThemeId("custom");
    setPaletteColors((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addPaletteColor() {
    setThemeId("custom");
    setPaletteColors((current) => [
      ...current,
      defaultColors[current.length % defaultColors.length],
    ]);
  }

  function removePaletteColor(index: number) {
    if (paletteColors.length <= 2) return;
    setThemeId("custom");
    setPaletteColors((current) =>
      current.filter((_, colorIndex) => colorIndex !== index),
    );
  }

  function saveCurrentPalette() {
    const name = paletteName.trim() || `自定义配色 ${customPalettes.length + 1}`;
    const existingById = editingPaletteId
      ? customPalettes.find((palette) => palette.id === editingPaletteId)
      : undefined;
    const existingByName = customPalettes.find(
      (palette) => palette.name.toLowerCase() === name.toLowerCase(),
    );
    const existing = existingById ?? existingByName;
    const saved: SavedPalette = {
      id: existing?.id ?? `custom-${Date.now()}`,
      name,
      colors: [...paletteColors],
    };
    setCustomPalettes((current) =>
      existing
        ? current.map((palette) => (palette.id === existing.id ? saved : palette))
        : [...current, saved],
    );
    setThemeId(saved.id);
    setPaletteName(name);
    setEditingPaletteId(saved.id);
    setStatus(existing ? "自定义配色已更新" : "自定义配色已保存");
  }

  function deleteSavedPalette(id: string) {
    setCustomPalettes((current) =>
      current.filter((palette) => palette.id !== id),
    );
    if (editingPaletteId === id) setEditingPaletteId(null);
    if (themeId === id) setThemeId("custom");
  }

  return {
    customPalettes,
    editingPaletteId,
    setEditingPaletteId,
    paletteName,
    setPaletteName,
    selectSavedPalette,
    editSavedPalette,
    movePaletteColor,
    addPaletteColor,
    removePaletteColor,
    saveCurrentPalette,
    deleteSavedPalette,
  };
}
