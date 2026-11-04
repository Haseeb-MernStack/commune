import {
  useDeviceSubscription,
  useDisablePush,
  useEnablePush,
  usePushStatus,
  useSavePushPreferences,
  useSendTestPush,
} from "../hooks/usePush";
import { needsInstallForPush, pushPermission, pushSupported } from "../lib/push";

/** Turn phone and desktop notifications on or off, and choose which kinds to receive. */
export default function PushSettings() {
  const status = usePushStatus();
  const device = useDeviceSubscription();
  const enable = useEnablePush(status.data?.publicKey ?? null);
  const disable = useDisablePush();
  const save = useSavePushPreferences();
  const test = useSendTestPush();

  // The server has no push keys: do not show a feature that cannot work.
  if (!status.data?.enabled) return null;

  const prefs = status.data.preferences;
  const subscribed = device.data === true;

  let body;
  if (!pushSupported()) {
    body = needsInstallForPush() ? (
      <p className="muted">
        On iPhone, first add Commune to your Home Screen (Share → Add to Home Screen), then open it from
        there to turn on notifications.
      </p>
    ) : (
      <p className="muted">This browser does not support push notifications.</p>
    );
  } else if (needsInstallForPush()) {
    body = (
      <p className="muted">
        On iPhone, add Commune to your Home Screen (Share → Add to Home Screen) and open it from there to
        turn on notifications.
      </p>
    );
  } else if (pushPermission() === "denied" && !subscribed) {
    body = (
      <p className="muted">
        Notifications are blocked for this site. Allow them in your browser's site settings, then come back
        here.
      </p>
    );
  } else if (!subscribed) {
    body = (
      <>
        <p className="muted">Get a notification for new messages, likes, comments and followers, even when Commune is closed.</p>
        <button className="btn" disabled={enable.isPending} onClick={() => enable.mutate()}>
          {enable.isPending ? "Turning on…" : "Turn on notifications"}
        </button>
        {enable.isError && <p className="error small">{enable.error.message}</p>}
      </>
    );
  } else {
    body = (
      <>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.messages}
            onChange={(e) => save.mutate({ ...prefs, messages: e.target.checked })}
          />
          <span>New messages</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.social}
            onChange={(e) => save.mutate({ ...prefs, social: e.target.checked })}
          />
          <span>Likes, comments and new followers</span>
        </label>
        <div className="row">
          <button className="btn btn-outline" disabled={test.isPending} onClick={() => test.mutate()}>
            Send a test
          </button>
          <button className="btn btn-ghost" disabled={disable.isPending} onClick={() => disable.mutate()}>
            Turn off on this device
          </button>
        </div>
        {test.isError && <p className="error small">{test.error.message}</p>}
        {test.isSuccess && <p className="muted small">Sent. It should arrive in a moment.</p>}
      </>
    );
  }

  return (
    <section className="card push-settings" aria-label="Push notifications">
      <h2 className="push-title">Push notifications</h2>
      {body}
    </section>
  );
}
