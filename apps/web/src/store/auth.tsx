import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from "@commune/shared";
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

  const setUser = useCallback((next: PublicUser | null) => {
    cacheUser(next);
    setUserState(next);
  }, []);

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

  const apply = (res: AuthResponse) => {
    setAccessToken(res.accessToken);
    writeSessionHint("1");
    setUser(res.user);
  };

  const login = useCallback(async (input: LoginInput) => {
    apply(await api<AuthResponse>("/auth/login", { method: "POST", body: input }));
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    apply(await api<AuthResponse>("/auth/register", { method: "POST", body: input }));
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    apply(await api<AuthResponse>("/auth/google", { method: "POST", body: { credential } }));
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken(null);
    writeSessionHint("0");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, loginWithGoogle, logout, setUser }),
    [user, loading, login, register, loginWithGoogle, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
