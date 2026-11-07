# Commune Plus (subscription) and payments

Plus unlocks: creator Insights, 10% instead of 20% fee on paid posts, 2000-character posts (free: 500),
20 communities (free: 5) and a ✦ badge.

Payments run through **Lemon Squeezy**, a merchant of record: it charges the card, collects and pays sales
tax/VAT, sends receipts and hosts the customer portal. We never see card details.

## How access works (the rules that keep it safe)
- Access comes **only** from Lemon Squeezy webhooks (`User.plusUntil`), never from the browser. Every
  Plus-only API route checks it again on the server.
- Webhooks are verified with HMAC-SHA256 on the raw body. Old or out-of-order webhooks are ignored.
- `plusUntil` = renewal date + 3 days grace (card retries), or the end date once cancelled.
- **Test and live are kept apart.** Lemon Squeezy test mode uses a fake card. With
  `LEMONSQUEEZY_ACCEPT_TEST_MODE` off (the default in production) test-mode checkouts are refused and
  test-mode webhooks are ignored, so nobody can get Plus without really paying.
- Mock mode (no Lemon Squeezy keys) exists only outside production.

## 1. Lemon Squeezy setup
1. Products → New product → pricing **Subscription**, e.g. $5 / month. Copy the **variant id**.
2. Settings → Webhooks → URL `https://<your-api>/api/webhooks/lemonsqueezy`, a signing secret
   (= `LEMONSQUEEZY_WEBHOOK_SECRET`), and these events: `order_created`, `order_refunded`,
   `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`,
   `subscription_expired`, `subscription_paused`, `subscription_unpaused`.
3. Settings → API → create an API key. A key made in **test mode** only works in test mode, and a **live**
   key only in live mode.

## 2. Environment (API project on Vercel / apps/api/.env)
| Variable | Meaning |
| --- | --- |
| `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` | from Lemon Squeezy |
| `LEMONSQUEEZY_VARIANT_ID` | the "unlock a post" product variant |
| `LEMONSQUEEZY_PLUS_VARIANT_ID` | the Plus subscription variant |
| `LEMONSQUEEZY_ACCEPT_TEST_MODE` | `true` while testing, `false` (or unset) on the real site |
| `PLUS_PRICE_LABEL` | optional text, e.g. `$5 / month` |

## 3. Testing (test mode)
1. Use the **test-mode** API key, variant ids and webhook, and set `LEMONSQUEEZY_ACCEPT_TEST_MODE=true`.
2. The Plus page shows a "Test mode" banner. Pay with card `4242 4242 4242 4242`, any future date, any CVC.
3. Check: Plus switches on within seconds, "Manage billing" opens the portal, cancelling keeps Plus until the
   period ends.

## 4. Going live (do these in order)
1. Lemon Squeezy: **Activate your store** (short questionnaire and identity check; approval usually takes a few
   business days). Live mode only appears after approval.
2. Switch the dashboard to **Live mode** (toggle, bottom left). Test products do not carry over: use
   "Copy to Live Mode" or recreate them. The copies get **new variant ids**.
3. Create a **live** API key and a **live** webhook with the same URL, events and a new signing secret.
4. Vercel (API project) → set the live `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`,
   `LEMONSQUEEZY_VARIANT_ID`, `LEMONSQUEEZY_PLUS_VARIANT_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`, and
   `LEMONSQUEEZY_ACCEPT_TEST_MODE=false`. Redeploy the API.
5. **Remove test data** (otherwise test buyers keep Plus and unlocked posts). Run once in mongosh, before
   real sales start:
   ```js
   const ids = db.subscriptions.find({ provider: "lemonsqueezy" }).map((s) => s.user);
   db.users.updateMany({ _id: { $in: ids } }, { $set: { plusUntil: null } });
   db.subscriptions.deleteMany({ provider: "lemonsqueezy" });
   db.purchases.deleteMany({ provider: "lemonsqueezy" });
   ```
6. Make one real purchase with your own card, check Plus switches on, then refund it in Lemon Squeezy.

## 5. Troubleshooting
- **Checkout says "Payments are not open yet"**: the API key is a test-mode key but
  `LEMONSQUEEZY_ACCEPT_TEST_MODE` is off. Use the live key, or switch it on while testing.
- **Paid but no Plus**: Lemon Squeezy → Webhooks → the delivery log. A 401 means a wrong signing secret; a
  200 with `ignored: test_mode` means a test payment on a live-only server.
- **A test checkout opens only for you**: in test mode, Lemon Squeezy sends emails to the store owner and team
  members, and an inactive store can only sell in test mode. Complete step 1 of "Going live".
