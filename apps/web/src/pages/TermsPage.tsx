import { Link } from "react-router-dom";
import LegalPage, { Section } from "../components/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="21 November 2026"
      intro="These terms are the rules for using Commune. By creating an account or using the site you agree to them. If you do not agree, please do not use Commune."
    >
      <Section title="Your account">
        <p>
          You must be at least 13 years old. Keep your password private and give accurate details.
          You are responsible for what happens under your account. Tell us if you think it was
          accessed without your permission.
        </p>
      </Section>

      <Section title="What you post">
        <p>
          You own what you post. By posting, you let Commune store, display and deliver it to others
          as part of running the service. You promise you have the right to share it.
        </p>
      </Section>

      <Section title="Rules">
        <p>Do not use Commune to:</p>
        <ul>
          <li>harass, threaten or abuse other people, or post hateful content;</li>
          <li>share illegal content, or content that sexualises children;</li>
          <li>spam, run scams, or mislead people about who you are;</li>
          <li>post other people's private information;</li>
          <li>
            break or probe the site, or collect data automatically, including to train AI models;
          </li>
          <li>create fake accounts, or fake likes, follows or other engagement.</li>
        </ul>
        <p>
          We may remove content, suspend or delete accounts that break these rules, and report
          illegal activity. You can report a post from the post menu.
        </p>
      </Section>

      <Section title="Commune Plus and paid posts">
        <p>
          Payments are processed by Lemon Squeezy. Plus renews until you cancel it from the billing
          page, and you keep it until the end of the period you paid for. Prices are shown before
          you pay. Purchases of digital content are generally final once the content has been
          unlocked; contact us if something went wrong and we will look at it fairly. Creators who
          sell posts pay a platform fee shown in their earnings.
        </p>
      </Section>

      <Section title="Open source">
        <p>
          The Commune software is open source under the licence in its repository. These terms cover
          the hosted service at this website, not your rights to use the code.
        </p>
      </Section>

      <Section title="Availability and liability">
        <p>
          We work to keep Commune running but cannot promise it will always be available or free of
          errors. The service is provided "as is". To the extent the law allows, Commune and its
          maintainers are not liable for losses that come from using the service. Nothing here
          limits rights you have by law that cannot be limited.
        </p>
      </Section>

      <Section title="Ending your account">
        <p>
          You can delete your account at any time in <Link to="/settings">Settings</Link>. We may
          suspend or end accounts that break these terms.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update these terms. Using Commune after a change means you accept it. Questions?
          Use the <Link to="/contact">contact form</Link>. How we handle personal data is described
          in the <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
