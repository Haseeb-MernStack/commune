import type { ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * Usernames are lowercase. An address typed or shared with capitals (/u/Sam, /u/Sam/followers)
 * is sent to the lowercase one (/u/sam) without adding a history entry, so Back still works.
 */
export default function LowercaseUsername({ children }: { children: ReactNode }) {
  const { username = "" } = useParams();
  const { pathname, search, hash } = useLocation();
  const lower = username.toLowerCase();
  if (username === lower) return <>{children}</>;
  return (
    <Navigate
      replace
      to={{ pathname: pathname.replace(/^\/u\/[^/]+/, `/u/${lower}`), search, hash }}
    />
  );
}
