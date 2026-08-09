"use client";

import { Bold, Italic } from "lucide-react";
import type { TextStyleState } from "../types";

const TEXT_STYLE_SIZE_OPTIONS = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];

export function TextStyleControls({
  label,
  style,
  fallbackColor,
  onChange,
}: {
  label: string;
  style: TextStyleState;
  fallbackColor: string;
  onChange: (next: TextStyleState) => void;
}) {
  const resolvedColor = style.color || fallbackColor;
  const updateStyle = (patch: Partial<TextStyleState>) =>
    onChange({ ...style, ...patch });

  return (
    <div className="text-style-control">
      <span className="settings-caption">{label}</span>
      <div className="text-style-row">
        <label className="text-size-select">
          <span className="sr-only">{label}字号</span>
          <select
            value={style.fontSize}
            onChange={(event) =>
              updateStyle({ fontSize: Number(event.target.value) })
            }
            aria-label={`${label}字号`}
          >
            {TEXT_STYLE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={style.bold ? "style-toggle active" : "style-toggle"}
          onClick={() => updateStyle({ bold: !style.bold })}
          aria-pressed={style.bold}
          aria-label={`${label}粗体`}
          title="粗体"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          className={style.italic ? "style-toggle active" : "style-toggle"}
          onClick={() => updateStyle({ italic: !style.italic })}
          aria-pressed={style.italic}
          aria-label={`${label}斜体`}
          title="斜体"
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          className="text-style-reset"
          onClick={() => updateStyle({ color: "" })}
        >
          跟随
        </button>
        <span className="color-input-wrap text-color-input">
          <input
            type="color"
            value={resolvedColor}
            onChange={(event) => updateStyle({ color: event.target.value })}
            aria-label={`${label}颜色`}
          />
          <span>{resolvedColor.toUpperCase()}</span>
        </span>
      </div>
    </div>
  );
}
