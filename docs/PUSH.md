# Push notifications

Notifications on phones and desktops even when Commune is closed: new messages, likes, comments
and new followers. Built on the standard Web Push protocol (no Firebase account or app store).

## How it works

1. On **Notifications**, a person presses **Turn on notifications** (browsers only allow asking
   after a tap). The browser asks permission and creates a subscription with its own push service
   (Google, Mozilla or Apple).
2. The subscription (an address plus two keys) is saved against their account.
3. When something happens, the API sends an **encrypted** message to that address. The push
   service only relays it; the service worker (`public/sw.js`) shows it. Tapping opens the right
   page (the conversation, post or profile).

```
Message saved ─► API ─► push service (Google / Mozilla / Apple) ─► phone ─► service worker ─► notification
```

## Smart behaviour

- **No duplicates:** if the person has Commune open and visible, no push is sent (the realtime
  service knows which tabs are on screen). If the realtime service is unreachable, the push is
  sent anyway.
- **Choices:** people can turn off messages or likes/comments/follows, per account.
- **Tidy:** notifications with the same tag replace each other, so a chat does not stack up.
- **Clean-up:** devices the push service reports as gone are removed; signing out stops
  notifications on that device; at most 10 devices per person.

## Set it up

1. Create a key pair once (anywhere with Node):
   ```
   npx web-push generate-vapid-keys
   ```
2. **Vercel → API project → Environment Variables**:

   | Name | Value |
   | --- | --- |
   | `VAPID_PUBLIC_KEY` | the public key |
   | `VAPID_PRIVATE_KEY` | the private key (mark as **Sensitive**) |
   | `VAPID_SUBJECT` | optional: `mailto:you@example.com` (defaults to your site address) |

   Redeploy the API project. **Keep these keys:** if you change them, every existing subscription
   stops working and people must turn notifications on again. The web project needs no change:
   the public key is served by `GET /api/push/status`.
3. Sign in, open **Notifications**, press **Turn on notifications**, then **Send a test**.

Without the keys the whole feature stays hidden.

## Phones

| Platform | Works when |
| --- | --- |
| Android (Chrome, Edge, Samsung, Firefox) | In the browser, or installed as an app |
| iPhone / iPad (iOS 16.4 or newer) | Only after **Add to Home Screen**, opened from the icon |
| Desktop (Chrome, Edge, Firefox, Safari) | In the browser; the browser may be closed on some systems |

## Security and privacy

- Messages are encrypted from your API to the device (the push service cannot read them).
- Subscription addresses are accepted only from the real push services (Google, Mozilla, Apple,
  Microsoft). Anything else is refused, so nobody can make the API call an arbitrary address.
- A notification can only open pages of this site.
- Notification text includes the sender's name and the start of a message (up to 140
  characters). People who do not want that on a lock screen can turn message notifications off.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No "Push notifications" card on the Notifications page | `VAPID_*` missing on the API project, or not redeployed |
| iPhone shows an install hint | Add Commune to the Home Screen and open it from there |
| "Notifications are blocked" | Allow them in the browser's site settings |
| Test works, real ones do not | The site is open and visible (by design), or that kind is switched off |
| Nothing arrives after changing keys | Old subscriptions are void: turn notifications off and on again |
| A fresh deploy and still no notification | The service worker updates on the next visit; reload once |

## Limits

- No email or digest fallback; delivery is best effort (phones in battery saver may delay it).
- Counts on the app icon (badges) are not set.
