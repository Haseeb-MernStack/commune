import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

/** A centred empty state: a large icon, a short message and an optional action. */
export default function EmptyState({
  icon,
  message,
  children,
}: {
  icon: IconName;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={32} />
      <p className="muted">{message}</p>
      {children}
    </div>
  );
}
