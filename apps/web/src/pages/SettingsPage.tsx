import { Link } from "react-router-dom";
import AccountData from "../components/AccountData";
import PrivacySettings from "../components/PrivacySettings";
import BlockedUsers from "../components/BlockedUsers";
import ThemeSettings from "../components/ThemeSettings";

export default function SettingsPage() {
  return (
    <>
      <h1 className="page-title">Settings</h1>
      <p className="muted">
        Sounds and push notifications are on the <Link to="/notifications">Notifications</Link>{" "}
        page.
      </p>
      <ThemeSettings />
      <BlockedUsers />
      <PrivacySettings />
      <AccountData />
    </>
  );
}
