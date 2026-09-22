import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getToken, setToken, clearToken } from '@/lib/token';
import {
  getMe,
  login as loginApi,
  logout as logoutApi,
  type AuthUser,
} from '@/api/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** Resolves with the user; throws ApiError on bad credentials. */
  login: (email: string, password: string) => Promise<AuthUser>;
  /** Persist a token returned by register / verify-otp / reset-password. */
  acceptToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await getMe();
      setUser(res.data);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password);
    const token = res.data?.token;
    if (!token) {
      throw new Error('Login did not return a token');
    }
    setToken(token);
    const nextUser: AuthUser = { ...(res.data as AuthUser), token };
    setUser(nextUser);
    return nextUser;
  }, []);

  const acceptToken = useCallback(
    async (token: string) => {
      setToken(token);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      /* ignore — clear locally regardless */
    }
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, acceptToken, logout, refresh }),
    [user, loading, login, acceptToken, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}