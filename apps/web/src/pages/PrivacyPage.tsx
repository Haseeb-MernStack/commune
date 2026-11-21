import { Link } from "react-router-dom";
import LegalPage, { Section } from "../components/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="21 November 2026"
      intro="Commune is an open source community platform. This page explains what we collect, why, who helps us run the site, and the choices you have. The source code is public, so you can check how your data is handled."
    >
      <Section title="What we collect">
        <p>
          <strong>Your account:</strong> your username, email address, and a password stored only as
          a one-way hash (or your Google account's ID if you sign in with Google). Optional: a bio
          and a profile photo.
        </p>
        <p>
          <strong>What you do on Commune:</strong> posts, comments, likes, follows, communities you
          join, private messages, notifications, and the purchases and Commune Plus subscription you
          make.
        </p>
        <p>
          <strong>Technical data:</strong> your IP address and browser details, used to keep the
          site secure, limit abuse and find errors.
        </p>
        <p>
          We do not collect your card details. Payments are handled by our payment provider (below).
        </p>
      </Section>

      <Section title="How we use it">
        <p>
          To run your account and show your content, send the emails you ask for (confirming your
          address, resetting a password), deliver messages and notifications, process payments,
          protect the site from spam and abuse, and improve how Commune works.
        </p>
      </Section>

      <Section title="Who else handles data">
        <p>We use a small number of providers to run the service:</p>
        <ul>
          <li>Vercel and Render, to host the website and the live-messaging server.</li>
          <li>MongoDB Atlas, to store the database.</li>
          <li>Cloudinary, to store and deliver uploaded images.</li>
          <li>Resend, to send emails.</li>
          <li>
            Lemon Squeezy, which sells Commune Plus and paid posts and handles payment details.
          </li>
          <li>Google, for sign-in with Google, Google Analytics and Google AdSense.</li>
        </ul>
        <p>We do not sell your personal data.</p>
      </Section>

      <Section title="Cookies and similar storage">
        <p>
          <strong>Essential:</strong> a secure, httpOnly cookie keeps you signed in. Your browser
          also stores a few preferences (such as sound settings) on your device.
        </p>
        <p>
          <strong>Analytics and advertising:</strong> Google Analytics and Google AdSense may set
          cookies to measure visits and show ads. Where the law requires it, they stay off until you
          accept. You can change your choice at any time by clearing this site's storage in your
          browser, or manage ad personalisation in your Google account.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <p>
          In <Link to="/settings">Settings</Link> you can download a copy of your data and delete
          your account. Deleting removes your posts, comments, likes, follows and messages and
          anonymises your account. We keep payment records because the law requires it, and posts
          that other people have already paid for stay available to them, without your name.
        </p>
        <p>
          Depending on where you live you may also have the right to access, correct or object to
          the use of your data. <Link to="/contact">Contact us</Link> and we will help.
        </p>
      </Section>

      <Section title="How long we keep data">
        <p>
          We keep your data while your account is open. When you delete your account, personal data
          is erased as described above. Backups are encrypted and replaced on a rolling schedule.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Passwords are hashed, sessions use short-lived tokens, traffic is encrypted, and requests
          are rate limited. No service is perfectly secure, so please use a strong, unique password.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Commune is not meant for children under 13, and we do not knowingly collect their data.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we change this policy we will update the date above and, for significant changes, tell
          you on the site.
        </p>
      </Section>
    </LegalPage>
  );
}
