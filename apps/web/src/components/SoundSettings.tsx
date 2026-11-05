import { playSound, setSoundPrefs, unlockAudio, useSoundPrefs } from "../lib/sound";

/** Turn the notification chimes on or off, set the volume, and listen to them. This device only. */
export default function SoundSettings() {
  const prefs = useSoundPrefs();

  const preview = (kind: "message" | "notification") => {
    unlockAudio(); // this click is the user gesture browsers require
    // The engine may need a moment to start on the very first click.
    window.setTimeout(() => playSound(kind, { force: true }), 60);
  };

  return (
    <section className="card sound-settings" aria-label="Notification sounds">
      <h2 className="push-title">Sounds</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={prefs.enabled}
          onChange={(e) => {
            if (e.target.checked) unlockAudio();
            setSoundPrefs({ enabled: e.target.checked });
          }}
        />
        <span>Play a chime for new messages and notifications</span>
      </label>
      <label className="sound-volume">
        <span>Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(prefs.volume * 100)}
          disabled={!prefs.enabled}
          aria-label="Chime volume"
          onChange={(e) => setSoundPrefs({ volume: Number(e.target.value) / 100 })}
        />
        <span className="muted small">{Math.round(prefs.volume * 100)}%</span>
      </label>
      <div className="row">
        <button className="btn btn-outline" onClick={() => preview("message")}>
          Hear message chime
        </button>
        <button className="btn btn-outline" onClick={() => preview("notification")}>
          Hear notification chime
        </button>
      </div>
      <p className="muted small">Saved on this device. Chimes stay quiet while you are looking at the conversation.</p>
    </section>
  );
}
