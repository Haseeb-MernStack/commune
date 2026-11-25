import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FREE_POST_LENGTH, PLUS_POST_LENGTH } from "@commune/shared";
import LegalPage, { Section } from "../components/LegalPage";
import "../styles/help.css";

/** One collapsible question. Native <details>: keyboard and screen-reader friendly, no script. */
function Q({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="help-item">
      <summary>{question}</summary>
      <div className="help-answer">{children}</div>
    </details>
  );
}

export default function HelpPage() {
  return (
    <LegalPage
      title="Help and FAQ"
      updated="24 November 2026"
      intro="Quick answers to the questions people ask most. If yours is not here, we are happy to help."
    >
      <Section title="Getting started">
        <Q question="How do I create an account and confirm my email?">
          <p>
            Choose <Link to="/register">Sign up</Link>, or continue with Google if it is offered.
            After you join we email you a confirmation link that works for 24 hours. If you did not
            get it, check your spam folder, then use <strong>Resend link</strong> in the banner at
            the top of the page. To protect inboxes, you can ask for a few links an hour.
          </p>
        </Q>
        <Q question="I forgot my password. What now?">
          <p>
            On the <Link to="/login">log in</Link> page choose{" "}
            <Link to="/forgot-password">Forgot your password?</Link> and enter your email. If an
            account exists, a reset link is on its way. It works once and expires after 1 hour.
            Resetting signs you out on all devices.
          </p>
        </Q>
      </Section>

      <Section title="Posting and talking">
        <Q question="How long can a post be?">
          <p>
            Free accounts can write {FREE_POST_LENGTH} characters per post.{" "}
            <Link to="/plus">Commune Plus</Link> raises that to {PLUS_POST_LENGTH}. You can edit the
            text of your own posts later; an &quot;edited&quot; label then appears.
          </p>
        </Q>
        <Q question="How do I join or create a community?">
          <p>
            Open <Link to="/communities">Communities</Link> to browse, then press{" "}
            <strong>Join</strong>. You must be a member to post inside one. Free accounts can create
            up to 5 communities and Plus members up to 20.
          </p>
        </Q>
        <Q question="How do messages and notifications work?">
          <p>
            Open someone&apos;s profile and press <strong>Message</strong>. Messages can be up to
            1000 characters and are private to the two of you. Chimes and push notifications can be
            turned on or off on the <Link to="/notifications">Notifications</Link> page. On iPhone,
            add Commune to your Home Screen first.
          </p>
        </Q>
      </Section>

      <Section title="Safety and limits">
        <Q question="How do I report a post?">
          <p>
            Press <strong>Report</strong> under any post that is not yours, pick a reason and add
            details if you like. A moderator reviews it. You can report a given post once.
          </p>
        </Q>
        <Q question="Why does Commune say I am doing something too often?">
          <p>
            Some actions have limits that protect the site from spam and abuse, for example changing
            your profile photo (3 times in 24 hours), uploading images, requesting emails and
            sending messages. Wait a little and try again; the message tells you roughly how long.
          </p>
        </Q>
      </Section>

      <Section title="Your account and data">
        <Q question="How do I download my data or hide my followers?">
          <p>
            Go to <Link to="/settings">Settings</Link>. <strong>Download my data</strong> gives you
            a file with your account, posts, comments, likes, purchases and sent messages. The{" "}
            <strong>Privacy</strong> switch hides your followers and following lists from other
            people. See also our <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </Q>
        <Q question="How do I delete my account?">
          <p>
            In <Link to="/settings">Settings</Link> choose <strong>Delete my account</strong> and
            type your username to confirm. This cannot be undone. If you have an active Commune Plus
            subscription, cancel it first from the Plus page. Paid posts that others already bought
            stay available to them, without your name. Details are in the{" "}
            <Link to="/terms">Terms of Service</Link>.
          </p>
        </Q>
      </Section>

      <Section title="Plus and payments">
        <Q question="How do Commune Plus and paid posts work?">
          <p>
            Payments are handled by Lemon Squeezy, so we never see your card. Plus switches on
            within seconds of paying. To update your card, download invoices or cancel, open{" "}
            <Link to="/plus">Commune Plus</Link> and press <strong>Manage billing</strong>; you keep
            Plus until the end of the period you paid for. Plus lowers the fee on paid posts you
            sell from 20% to 10%.
          </p>
        </Q>
      </Section>

      <p className="muted help-contact">
        Still stuck? <Link to="/contact">Contact us</Link> and we will reply by email.
      </p>
    </LegalPage>
  );
}
