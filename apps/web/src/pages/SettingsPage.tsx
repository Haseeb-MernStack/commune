import { Link } from "react-router-dom";
import AccountData from "../components/AccountData";
import PrivacySettings from "../components/PrivacySettings";

export default function SettingsPage() {
  return (
    <>
      <h1 className="page-title">Settings</h1>
      <p className="muted">
        Sounds and push notifications are on the <Link to="/notifications">Notifications</Link>{" "}
        page.
      </p>
      <PrivacySettings />
      <AccountData />
    </>
  );
}
