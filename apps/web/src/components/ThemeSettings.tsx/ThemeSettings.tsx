import { useEffect, useState } from "react";
import {
  applyThemePreference,
  getThemePreference,
  watchSystemTheme,
  type ThemePreference,
} from "../lib/theme";

const THEME_CHOICES: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Appearance settings: pick System, Light or Dark. The choice is saved in
 * localStorage and applied straight away, so the page follows it at once. */
export default function ThemeSettings() {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    getThemePreference(),
  );

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
      <p className="muted small">
        System follows your device setting, and changes with it.
      </p>
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
    </section>
  );
}
