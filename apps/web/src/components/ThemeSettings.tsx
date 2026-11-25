import { useEffect, useState } from "react";
import {
  applyThemePreference,
  getThemePreference,
  watchSystemTheme,
  type ThemePreference,
} from "../lib/theme"; import { readTextSize, setTextSize, type TextSize } from "../lib/text-size";

const THEME_CHOICES: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Appearance settings: pick System, Light or Dark. The choice is saved in
 * localStorage and applied straight away, so the page follows it at once. */
export default function ThemeSettings() {
  const [preference, setPreference] = useState<ThemePreference>(() => getThemePreference()); const [textSize, setTextSizeState] = useState<TextSize>(() => readTextSize());

  useEffect(() => {
    applyThemePreference(preference);
    if (preference !== "system") {
      return;
    }
    return watchSystemTheme(() => {
      applyThemePreference("system");
    });
  }, [preference]);

  return (
    <section className="card theme-settings" aria-labelledby="theme-title">
      <h2 id="theme-title" className="push-title">
        Appearance
      </h2>
      <p className="muted small">System follows your device setting, and changes with it.</p>
      <div className="theme-choices" role="radiogroup" aria-label="Theme">
        {THEME_CHOICES.map((choice) => (
          <label key={choice.value} className="theme-choice">
            <input
              type="radio"
              name="theme"
              value={choice.value}
              checked={preference === choice.value}
              onChange={() => setPreference(choice.value)}
            />
            {choice.label}
          </label>
        ))}
      </div>
    <p className="muted small">Text size: Small is 93%, Default is 100% and Large is 112% of the usual size.</p><div className="theme-choices" role="radiogroup" aria-label="Text size">{([{ value: "small", label: "Small" }, { value: "default", label: "Default" }, { value: "large", label: "Large" }] as const).map((choice) => (<label key={choice.value} className="theme-choice"><input type="radio" name="text-size" value={choice.value} checked={textSize === choice.value} onChange={() => { setTextSizeState(choice.value); setTextSize(choice.value); }} />{choice.label}</label>))}</div></section>
  );
}
