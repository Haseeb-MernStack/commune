# MongoDB indexes

This is the map of every index in `apps/api/src/models` and the query each
one serves. It is the companion to the review script in
`apps/api/scripts/explain.ts`, which runs the main queries against a local
database and prints whether each one uses an index (`IXSCAN`) or scans the
collection (`COLLSCAN`).

## Checking the main queries

```sh
npm run explain -w @commune/api
# or, from apps/api:
npm run explain
# run the user-specific queries as one person:
npm run explain -w @commune/api -- <username>
```

The script connects to the local database (`MONGODB_URI`), runs the feed,
profile, followers and notification queries, and prints `INDEX` (with the
index name) or `SCAN` for each one. It exits with 1 when any query scans a
collection. A scan means an index is missing or the query changed shape;
report it as a separate issue rather than adding an index in this guide.

## The main queries

| Query | Shape | Index that serves it |
| --- | --- | --- |
| Feed, everyone | `Post.find({}).sort({ _id: -1 })` | `_id` (the default index, read backwards) |
| Feed, people I follow | `Follow.find({ follower }).select("following")`, then `Post.find({ author: { $in: [...] } }).sort({ _id: -1 })` | `{ follower: 1, _id: -1 }`, then `{ author: 1, _id: -1 }` |
| Profile lookup | `User.findOne({ username }).collation({ locale: "en", strength: 2 })` | `{ username: 1 }`, unique, same collation |
| Profile posts | `Post.find({ author }).sort({ _id: -1 })` | `{ author: 1, _id: -1 }` |
| Profile counts | `Follow.countDocuments({ following })`, `Follow.countDocuments({ follower })`, `Post.countDocuments({ author })` | `{ following: 1, _id: -1 }`, `{ follower: 1, _id: -1 }`, `{ author: 1, _id: -1 }` |
| Followers list | `Follow.find({ following }).sort({ _id: -1 })` | `{ following: 1, _id: -1 }` |
| Following list | `Follow.find({ follower }).sort({ _id: -1 })` | `{ follower: 1, _id: -1 }` |
| Notifications | `Notification.find({ user }).sort({ createdAt: -1 }).limit(30)` | `{ user: 1, createdAt: -1 }` |
| Unread count | `Notification.countDocuments({ user, read: false })` | `{ user: 1, read: 1 }` |

## Every index, by model

Every model also has the default `_id` index, which the tables below do not
repeat. "Unique" means MongoDB refuses a second row with the same key;
"TTL" means MongoDB deletes the row once the field passes the given age.

### Post (`apps/api/src/models/Post.ts`)

| Index | Why it exists |
| --- | --- |
| `author` | Looking up one author's posts. |
| `imageUrl` (sparse) | Finding posts by image. |
| `community` | Looking up one community's posts. |
| `{ author: 1, _id: -1 }` | An author's posts, newest first; also the "following" feed and the profile post count. |
| `{ community: 1, _id: -1 }` | A community's posts, newest first. |
| `{ content: "text" }` | Text search. It covers `content` only, not `premiumContent`. |

### User (`apps/api/src/models/User.ts`)

| Index | Why it exists |
| --- | --- |
| `email` (unique) | Sign-in lookup; one account per email. |
| `avatarUrl` (sparse) | Finding users by avatar URL. |
| `googleId` (unique, sparse) | Google sign-in lookup. |
| `{ username: 1 }` (unique, collation `{ locale: "en", strength: 2 }`) | Profile lookup by username, case-insensitive; one username per person. |

### Follow (`apps/api/src/models/Follow.ts`)

| Index | Why it exists |
| --- | --- |
| `{ follower: 1, following: 1 }` (unique) | One follow per pair of people. |
| `{ following: 1, _id: -1 }` | A person's followers, newest first. |
| `{ follower: 1, _id: -1 }` | The people one person follows, newest first. |

### Notification (`apps/api/src/models/Notification.ts`)

| Index | Why it exists |
| --- | --- |
| `{ user: 1, createdAt: -1 }` | My notifications, newest first. |
| `{ user: 1, read: 1 }` | Counting unread notifications and marking them read. |
| `{ post: 1 }` | The post a notification is about. |
| `{ createdAt: 1 }` (TTL, 180 days) | Old notifications are deleted after 180 days. |

### Like (`apps/api/src/models/Like.ts`)

| Index | Why it exists |
| --- | --- |
| `{ post: 1, user: 1 }` (unique) | One like per person per post. |

### Bookmark (`apps/api/src/models/Bookmark.ts`)

| Index | Why it exists |
| --- | --- |
| `{ post: 1, user: 1 }` (unique) | One save per person per post. |
| `{ user: 1, _id: -1 }` | My saved posts, newest save first. |

### Comment (`apps/api/src/models/Comment.ts`)

| Index | Why it exists |
| --- | --- |
| `{ post: 1, _id: 1 }` | A post's comments, oldest first. |

### Community (`apps/api/src/models/Community.ts`)

| Index | Why it exists |
| --- | --- |
| `slug` (unique) | Lookup by `/c/<slug>`; one slug per community. |
| `creator` | Communities started by one person. |
| `{ memberCount: -1, _id: -1 }` | Communities ordered most popular first. |

### Membership (`apps/api/src/models/Membership.ts`)

| Index | Why it exists |
| --- | --- |
| `{ user: 1, community: 1 }` (unique) | One membership per person per community. |
| `{ community: 1 }` | The members of a community. |

### Block (`apps/api/src/models/Block.ts`)

| Index | Why it exists |
| --- | --- |
| `{ blocker: 1, blocked: 1 }` (unique) | One row per pair of people. |
| `{ blocked: 1, kind: 1 }` | "Did this person block me?" checks on follow, like, comment and message. |

### Message (`apps/api/src/models/Message.ts`)

| Index | Why it exists |
| --- | --- |
| `{ conversation: 1, createdAt: -1 }` | A conversation's messages, newest first. |

### Conversation (`apps/api/src/models/Conversation.ts`)

| Index | Why it exists |
| --- | --- |
| `key` (unique) | One conversation per pair of people (the two user ids, sorted and joined). |
| `{ participants: 1, lastMessageAt: -1 }` | My conversations, most recent message first. |

### PostView (`apps/api/src/models/PostView.ts`)

| Index | Why it exists |
| --- | --- |
| `createdAt` (TTL, 90 days) | Rows are removed after 90 days; Insights only looks back 30. |
| `{ post: 1, viewer: 1, day: 1 }` (unique) | One count per viewer per post per day. |
| `{ author: 1, day: 1 }` | Per-author daily totals. |

### RefreshToken (`apps/api/src/models/RefreshToken.ts`)

| Index | Why it exists |
| --- | --- |
| `user` | Finding one person's refresh tokens. |
| `tokenHash` (unique) | Refresh lookup by token. |
| `expiresAt` (TTL, at `expiresAt`) | Tokens are removed once they expire. |

### AuthToken (`apps/api/src/models/AuthToken.ts`)

| Index | Why it exists |
| --- | --- |
| `user` | Finding one person's auth tokens. |
| `tokenHash` (unique) | Lookup by token. |
| `expiresAt` (TTL, at `expiresAt`) | Tokens are removed once they expire. |

### PushSubscription (`apps/api/src/models/PushSubscription.ts`)

| Index | Why it exists |
| --- | --- |
| `user` | A person's push subscriptions. |
| `endpoint` (unique) | One row per push endpoint. |

### Report (`apps/api/src/models/Report.ts`)

| Index | Why it exists |
| --- | --- |
| `{ reporter: 1, post: 1 }` (unique) | Each person can report a given post once; it also blocks report spam. |
| `{ status: 1, _id: -1 }` | The admin queue: the newest reports of a given status. |
| `{ post: 1 }` | The reports on one post. |

### Subscription (`apps/api/src/models/Subscription.ts`)

| Index | Why it exists |
| --- | --- |
| `user` (unique) | One Plus subscription per user. |
| `providerSubscriptionId` (unique) | Lookup by the provider's subscription id. |

### Purchase (`apps/api/src/models/Purchase.ts`)

| Index | Why it exists |
| --- | --- |
| `creator` | Earnings summed per creator. |
| `providerOrderId` (unique) | A webhook delivered twice cannot double-count a purchase. |
| `{ user: 1, post: 1 }` (unique) | A buyer unlocks a given post once. |

### QuotaLog (`apps/api/src/models/QuotaLog.ts`)

| Index | Why it exists |
| --- | --- |
| `{ bucket: 1, subject: 1, createdAt: -1 }` | Counting rows in a time window per bucket and subject. |
| `{ createdAt: 1 }` (TTL, 26 hours) | Rows are removed after 26 hours; the longest window is 24 hours. |

### ContactMessage (`apps/api/src/models/ContactMessage.ts`)

No custom index, only the default `_id` index. It is a small admin-only
collection that is listed, not queried by a field.

### ErrorEvent (`apps/api/src/models/ErrorEvent.ts`)

| Index | Why it exists |
| --- | --- |
| `fingerprint` (unique) | One row per distinct error. |
| `lastSeen` (TTL, 30 days after last occurrence) | Rows expire 30 days after the error was last seen. |
| `{ resolved: 1, lastSeen: -1 }` | Unresolved errors, most recently seen first. |

### NewsCache (`apps/api/src/models/NewsCache.ts`)

| Index | Why it exists |
| --- | --- |
| `topic` (unique) | One cache row per topic. |

## Things to watch

- The text index on `Post` covers `content` only. Search does not find
  words in `premiumContent`.
- The "everyone" feed has no filter, so it reads the default `_id` index
  backwards instead of a compound index. That is fine; a compound index
  would only help if the feed filtered on another field first.
- `ContactMessage` is the only model without a custom index. If it grows
  a query by a field, that field needs an index.
- TTL indexes delete rows on their own schedule (MongoDB checks about
  once a minute), so a row can briefly outlive its expiry.
- If the review script reports a `SCAN`, file the missing index as a
  separate issue; do not add an index silently.
