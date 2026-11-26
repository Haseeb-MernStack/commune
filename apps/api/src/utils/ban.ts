/** Fields that describe a suspension. A missing end date means the ban is permanent. */
export interface BanFields {
  banned: boolean;
  bannedUntil?: Date | null;
  banReason?: string | null;
}

/** A ban applies while `banned` is set and its end date (if any) has not passed. */
export function isBanned(user: BanFields, now: Date = new Date()): boolean {
  if (!user.banned) return false;
  if (!user.bannedUntil) return true;
  return user.bannedUntil.getTime() > now.getTime();
}

/** What a suspended person is told: the reason and the end date when they are known. */
export function banMessage(user: BanFields): string {
  const base = "This account has been suspended";
  const details: string[] = [];
  if (user.banReason) details.push(`Reason: ${user.banReason}`);
  if (user.bannedUntil) details.push(`Until ${user.bannedUntil.toUTCString()}`);
  return details.length > 0 ? `${base}. ${details.join(". ")}` : base;
}
