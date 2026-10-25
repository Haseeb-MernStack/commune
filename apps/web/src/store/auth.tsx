import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from "@commune/shared";
import { api, setAccessToken, tryRefresh } from "../lib/api";

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: PublicUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (await tryRefresh()) {
        try {
          setUser(await api<PublicUser>("/users/me"));
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const apply = (res: AuthResponse) => {
    setAccessToken(res.accessToken);
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
