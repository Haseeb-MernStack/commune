import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from "@commune/shared";
import { releasePushOnLogout } from "../lib/push";
import { api, bootSession, readSessionHint, setAccessToken, writeSessionHint } from "../lib/api";

// The last known profile, shown instantly on the next visit while the session is re-checked.
const USER_KEY = "commune_user";
function readCachedUser(): PublicUser | null {
  if (readSessionHint() !== "1") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as PublicUser) : null;
  } catch {
    return null;
  }
}
function cacheUser(user: PublicUser | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // With a cached profile the app renders as logged in straight away (left menu, feed shell)
  // and the session is confirmed in the background. Known guests never wait at all.
  const [user, setUserState] = useState<PublicUser | null>(readCachedUser);
  // Wait only when there is nothing to show yet: first visit (unknown) or a session without a cached profile.
  const [loading, setLoading] = useState(() => {
    const hint = readSessionHint();
    return hint === null || (hint === "1" && readCachedUser() === null);
  });

  const queryClient = useQueryClient();
  // Who the cached data belongs to. Everything in the query cache (feeds, messages, unlocked paid
  // posts, billing) is private to that person, so it must never outlive their session.
  const cacheOwner = useRef<string | null>(user?.id ?? null);

  const setUser = useCallback(
    (next: PublicUser | null) => {
      const nextId = next?.id ?? null;
      if (cacheOwner.current !== null && cacheOwner.current !== nextId) {
        // Signed out, session ended, or a different person signed in on this browser tab.
        queryClient.clear();
      }
      cacheOwner.current = nextId;
      cacheUser(next);
      setUserState(next);
    },
    [queryClient],
  );

  useEffect(() => {
    let alive = true;
    void bootSession().then((res) => {
      if (!alive) return;
      if (res) {
        writeSessionHint("1");
        setUser(res.user);
      } else {
        writeSessionHint("0");
        setUser(null);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [setUser]);

  // Signing out in one tab signs out every tab, so a forgotten tab never stays logged in.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "commune_session" && e.newValue === "0" && cacheOwner.current !== null) {
        setAccessToken(null);
        setUser(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setUser]);

  // A page restored from the back/forward cache is a frozen copy: ask the server who is signed in.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      if (cacheOwner.current === null && readSessionHint() !== "1") return;
      void bootSession().then((res) => {
        if (res) {
          writeSessionHint("1");
          setUser(res.user);
        } else {
          setAccessToken(null);
          writeSessionHint("0");
          setUser(null);
        }
      });
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [setUser]);

  const apply = useCallback(
    (res: AuthResponse) => {
      setAccessToken(res.accessToken);
      writeSessionHint("1");
      setUser(res.user);
    },
    [setUser],
  );

  const login = useCallback(
    async (input: LoginInput) => {
      apply(await api<AuthResponse>("/auth/login", { method: "POST", body: input }));
    },
    [apply],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      apply(await api<AuthResponse>("/auth/register", { method: "POST", body: input }));
    },
    [apply],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      apply(await api<AuthResponse>("/auth/google", { method: "POST", body: { credential } }));
    },
    [apply],
  );

  const logout = useCallback(async () => {
    // While the access token is still valid: stop this device receiving this person's notifications.
    await releasePushOnLogout();
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken(null);
    writeSessionHint("0");
    setUser(null);
  }, [setUser]);

  const value = useMemo(
    () => ({ user, loading, login, register, loginWithGoogle, logout, setUser }),
    [user, loading, login, register, loginWithGoogle, logout, setUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
