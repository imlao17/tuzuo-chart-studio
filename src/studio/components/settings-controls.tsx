"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import {
  SETTINGS_SECTION_META,
  settingsSectionMatches,
  type SettingsSectionId,
} from "../settings/registry";

export function SettingsSection({
  id,
  icon,
  open,
  hidden,
  query,
  onToggle,
  children,
}: {
  id: SettingsSectionId;
  icon: ReactNode;
  open: boolean;
  hidden?: boolean;
  query: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (hidden) return null;
  const meta = SETTINGS_SECTION_META[id];
  const searchMatch = Boolean(query.trim()) && settingsSectionMatches(id, query);

  return (
    <section
      className={`settings-section${searchMatch ? " is-search-match" : ""}`}
      data-setting-section={id}
    >
      <button
        type="button"
        className="settings-section-trigger"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="settings-section-title">
          {icon}
          {meta.title}
        </span>
        <ChevronDown
          size={15}
          className={open ? "settings-chevron is-open" : "settings-chevron"}
        />
      </button>
      {open && <div className="settings-section-body">{children}</div>}
    </section>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}
