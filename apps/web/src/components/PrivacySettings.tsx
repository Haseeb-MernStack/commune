import { usePrivacy, useUpdatePrivacy } from "../hooks/useSocial";

/** Settings: who can open your followers and following lists. */
export default function PrivacySettings() {
  const privacy = usePrivacy();
  const save = useUpdatePrivacy();
  const hidden = privacy.data?.hideConnections ?? false;

  return (
    <section className="card privacy-settings" aria-labelledby="privacy-title">
      <h2 id="privacy-title" className="push-title">
        Privacy
      </h2>
      <div className="switch-row">
        <div>
          <p className="switch-label" id="hide-connections-label">
            Hide my followers and following lists
          </p>
          <p className="muted small" id="hide-connections-help">
            When this is on, only you can open the lists of people who follow you and people you
            follow. The counts on your profile stay visible, and you still appear in lists on other
            people's profiles.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-checked={hidden}
          aria-labelledby="hide-connections-label"
          aria-describedby="hide-connections-help"
          disabled={privacy.isLoading || privacy.isError || save.isPending}
          onClick={() => save.mutate({ hideConnections: !hidden })}
        >
          <span className="switch-knob" aria-hidden="true" />
        </button>
      </div>
      <p className="muted small" role="status" aria-live="polite">
        {save.isPending ? "Saving…" : save.isSuccess ? "Saved." : ""}
      </p>
      {(privacy.isError || save.isError) && (
        <p className="error" role="alert">
          {save.isError ? save.error.message : "Could not load your privacy settings."}
        </p>
      )}
    </section>
  );
}
