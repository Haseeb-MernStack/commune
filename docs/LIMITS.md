# Usage limits

Limits that protect the money, the inboxes and the storage behind Commune from bots and abuse.

## Why two kinds of limit

- **Per-IP request limits** (`middleware/rateLimit.ts`) are quick and cheap, but each server
  instance counts on its own, and a bot can change IP. They are the first, rough filter.
- **Database limits** (`services/quota.ts`, collection `quotalogs`) count real uses in MongoDB, so
  every instance shares one count and the limit follows the email address or the account, not
  just the IP. Used for anything that costs money or can hurt a person.

## What is limited

| What | Per | Limit |
| --- | --- | --- |
| Verification or reset email | email address | 3 an hour, 6 a day |
| Verification or reset email | visitor (IP) | 10 an hour, 30 a day |
| All verification and reset emails | whole site | `EMAIL_DAILY_LIMIT` a day (default 100) |
| Contact form | visitor (IP) | 5 a day (a message over the limit is not stored) |
| Contact form | whole site | 30 a day |
| Error alert emails to the owner and new-device sign-in notices | whole site | 5 an hour |
| Image uploads (Cloudinary) | account | 20 an hour, 60 a day |
| Profile photo change or removal | account | 3 in any 24 hours |
| Editing posts | account | 30 an hour, 100 a day |
| Checkout and billing portal (Lemon Squeezy) | account | 10 an hour, 30 a day |

## How it behaves

- Limits are checked **before** anything is created or sent. A refused request does not replace
  the confirmation link a person already has, so a bot cannot cancel real links by spamming.
- "Forgot password" answers the same way whether or not a limit was hit, so it cannot be used to
  discover which emails have accounts. "Resend confirmation" and the contact form tell the person
  to wait.
- Registration never fails because of the email limit: the account is created and the person can
  ask for a new link later.
- Rows expire after 26 hours, so the collection stays tiny.

## Changing them

- Site-wide email cap: set `EMAIL_DAILY_LIMIT` on the API project (match your Resend plan).
- Everything else: `MAIL_LIMITS` in `services/mailQuota.ts`, and `UPLOAD_QUOTA` and
  `CHECKOUT_QUOTA` in `routes/index.ts`.

## Also set in the provider dashboards

Application limits cannot cap a bill by themselves. Also turn on:

- **Resend:** keep the free plan or set a spending cap, and use an API key restricted to
  "Sending access" for your domain.
- **Cloudinary:** set usage alerts and restrict the upload preset to images with a size limit.
- **Lemon Squeezy:** keep webhook signing on (already checked in the API).
- **Vercel:** turn on Spend Management and Firewall rate limiting for `/api/auth/*`.
- **MongoDB Atlas:** keep the IP access list and billing alerts on.
