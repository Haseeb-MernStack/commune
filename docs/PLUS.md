# Commune Plus (subscription) setup

Plus unlocks: creator Insights, 10% instead of 20% fee on paid posts, 2000-character posts (free: 500),
20 communities (free: 5) and a ✦ badge.

## 1. Lemon Squeezy
1. Products → New product → pricing **Subscription**, e.g. $5 / month. Publish it (test mode first).
2. Copy the **variant id** of that product.
3. Settings → Webhooks: edit the webhook you already use for paid posts (URL `https://<api>/api/payments/webhook`,
   same signing secret) and tick the events `subscription_created`, `subscription_updated`,
   `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`,
   `subscription_unpaused` besides `order_created` and `order_refunded`.

## 2. Environment (API project on Vercel / apps/api/.env)
- `LEMONSQUEEZY_PLUS_VARIANT_ID` = the variant id above
- `PLUS_PRICE_LABEL` (optional, display text) and `PLUS_FEE_PERCENT` (optional, default 10)
Redeploy the API.

## 3. Behaviour
- Local dev with no Lemon Squeezy keys: **mock mode**, "Upgrade" instantly grants 30 days (never in production).
- Access is driven only by webhooks: `User.plusUntil` = renewal date + 3 days grace (or the end date once cancelled).
- Stale/out-of-order webhooks are ignored. "Manage billing" opens a fresh Lemon Squeezy customer-portal link.
- Test the whole flow in Lemon Squeezy **test mode** (card 4242 4242 4242 4242) before going live.
