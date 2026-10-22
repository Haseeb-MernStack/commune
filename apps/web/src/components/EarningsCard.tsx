import { formatPrice, useEarnings } from "../hooks/usePayments";

/** Shown to a creator on their own profile: what paid posts have earned. */
export default function EarningsCard() {
  const earnings = useEarnings(true);
  if (!earnings.data) return null;
  const e = earnings.data;
  return (
    <div className="earnings" aria-label="Your earnings from paid posts">
      <div>
        <span className="muted">Your earnings</span>
        <strong>{formatPrice(e.netCents, e.currency)}</strong>
      </div>
      <div>
        <span className="muted">Sales</span>
        <strong>{e.sales}</strong>
      </div>
      <div>
        <span className="muted">Platform fee</span>
        <strong>{formatPrice(e.feeCents, e.currency)}</strong>
      </div>
    </div>
  );
}
