"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type HistoryEntry<T> = {
  fingerprint: string;
  value: T;
};

type HistoryState<T> = {
  entries: HistoryEntry<T>[];
  index: number;
};

export function useProjectHistory<T>({
  snapshot,
  fingerprint,
  enabled,
  applySnapshot,
  debounceMs = 350,
  limit = 60,
}: {
  snapshot: T;
  fingerprint: string;
  enabled: boolean;
  applySnapshot: (value: T, message: string) => void;
  debounceMs?: number;
  limit?: number;
}) {
  const skipFingerprintRef = useRef<string | null>(null);
  const snapshotRef = useRef(snapshot);
  const applySnapshotRef = useRef(applySnapshot);
  const [history, setHistory] = useState<HistoryState<T>>({
    entries: [],
    index: -1,
  });

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    applySnapshotRef.current = applySnapshot;
  }, [applySnapshot]);

  useEffect(() => {
    if (!enabled) return;
    if (skipFingerprintRef.current === fingerprint) {
      skipFingerprintRef.current = null;
      return;
    }

    const timeout = window.setTimeout(() => {
      setHistory((currentHistory) => {
        const current = currentHistory.entries[currentHistory.index];
        if (current?.fingerprint === fingerprint) return currentHistory;

        const nextEntries = currentHistory.entries.slice(
          0,
          currentHistory.index + 1,
        );
        nextEntries.push({ fingerprint, value: snapshotRef.current });
        if (nextEntries.length > limit) nextEntries.shift();
        return {
          entries: nextEntries,
          index: nextEntries.length - 1,
        };
      });
    }, history.entries.length ? debounceMs : 0);

    return () => window.clearTimeout(timeout);
  }, [debounceMs, enabled, fingerprint, history.entries.length, limit]);

  const canUndo = history.index > 0;
  const canRedo =
    history.index >= 0 && history.index < history.entries.length - 1;

  const applyEntry = useCallback(
    (nextIndex: number, message: string) => {
      const entry = history.entries[nextIndex];
      if (!entry) return;
      skipFingerprintRef.current = entry.fingerprint;
      setHistory((currentHistory) => ({
        ...currentHistory,
        index: nextIndex,
      }));
      applySnapshotRef.current(entry.value, message);
    },
    [history.entries],
  );

  const applyCheckpoint = useCallback(
    (value: T, nextFingerprint: string, message: string) => {
      skipFingerprintRef.current = nextFingerprint;
      setHistory((currentHistory) => {
        const baseEntries = currentHistory.entries.length
          ? currentHistory.entries.slice(0, currentHistory.index + 1)
          : [{ fingerprint, value: snapshotRef.current }];
        if (baseEntries.at(-1)?.fingerprint !== nextFingerprint) {
          baseEntries.push({ fingerprint: nextFingerprint, value });
        }
        if (baseEntries.length > limit) baseEntries.shift();
        return {
          entries: baseEntries,
          index: baseEntries.length - 1,
        };
      });
      applySnapshotRef.current(value, message);
    },
    [fingerprint, limit],
  );

  const undo = useCallback(
    () => applyEntry(history.index - 1, "已撤销"),
    [applyEntry, history.index],
  );
  const redo = useCallback(
    () => applyEntry(history.index + 1, "已重做"),
    [applyEntry, history.index],
  );

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    applyCheckpoint,
  };
}
