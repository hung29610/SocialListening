'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import { type AuthSessionState, shouldInvalidateSession } from '@/lib/authSessionState';

interface User {
  id: number;
  email: string;
  full_name: string;
  is_superuser: boolean;
  current_organization_id: number | null;
}

interface Organization {
  id: number;
  name: string;
  slug: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  permissions: string[];
  isLoading: boolean;
  isHydrating: boolean;
  sessionState: AuthSessionState;
  readinessReason: string | null;
  hasPermission: (permission: string) => boolean;
  switchOrganization: (orgId: number) => Promise<void>;
  refreshContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  organizations: [],
  currentOrganization: null,
  permissions: [],
  isLoading: false,
  isHydrating: false,
  sessionState: 'UNAUTHENTICATED',
  readinessReason: null,
  hasPermission: () => false,
  switchOrganization: async () => {},
  refreshContext: async () => {},
});

/** Parse JWT payload without verifying signature — fast, no network */
function parseJwt(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/** Read cached user from localStorage (set at login time) */
function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem('cached_user');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem('cached_user', JSON.stringify(user));
    else localStorage.removeItem('cached_user');
  } catch {}
}

const CURRENT_AUTH_STORAGE_VERSION = '1.0.0';

function ensureAuthStorageVersion() {
  if (typeof window === 'undefined') return;
  try {
    const version = localStorage.getItem('nope_auth_storage_version');
    if (!version) {
      localStorage.setItem('nope_auth_storage_version', CURRENT_AUTH_STORAGE_VERSION);
      return;
    }
    if (version !== CURRENT_AUTH_STORAGE_VERSION) {
      localStorage.setItem('nope_auth_storage_version', CURRENT_AUTH_STORAGE_VERSION);
      console.warn('[Auth] Storage version updated. Existing auth session preserved.');
    }
  } catch (err) {
    // ignore
  }
}

function clearInvalidAuthSession() {
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('cached_user');
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize from cache IMMEDIATELY — no async, no loading state
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    ensureAuthStorageVersion();
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    // Check token not expired
    const payload = parseJwt(token);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      clearInvalidAuthSession();
      return null;
    }
    return getCachedUser();
  });

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Never blocks initial render
  const [isHydrating, setIsHydrating] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('access_token');
  });
  const [sessionState, setSessionState] = useState<AuthSessionState>(() => {
    if (typeof window === 'undefined') return 'UNAUTHENTICATED';
    return localStorage.getItem('access_token')
      ? 'AUTHENTICATED_NOT_READY'
      : 'UNAUTHENTICATED';
  });
  const [readinessReason, setReadinessReason] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const bgFetchRef = useRef<AbortController | null>(null);

  const backendUrl = API_BASE_URL.replace(/\/+$/, '');
  const apiUrl = (path: string) => backendUrl ? `${backendUrl}${path}` : path;

  const invalidateSession = () => {
    clearInvalidAuthSession();
    setUser(null);
    setOrganizations([]);
    setPermissions([]);
    setSessionState('UNAUTHENTICATED');
    setReadinessReason(null);
    setIsHydrating(false);
    if (pathname.startsWith('/dashboard')) {
      window.location.href = '/login?expired=1';
    }
  };

  const readBoundedReadiness = async (signal: AbortSignal): Promise<string> => {
    try {
      const response = await fetch(apiUrl('/readyz'), { signal, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      return typeof body?.reason_code === 'string'
        ? body.reason_code
        : 'APPLICATION_NOT_READY';
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
      return 'READINESS_UNAVAILABLE';
    }
  };

  const fetchContext = async (showLoader = false) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      setUser(null);
      setCachedUser(null);
      setSessionState('UNAUTHENTICATED');
      setIsHydrating(false);
      return;
    }

    if (showLoader) setIsLoading(true);

    // Cancel any in-flight request
    bgFetchRef.current?.abort();
    bgFetchRef.current = new AbortController();

    try {
      const identityResponse = await fetch(apiUrl('/api/auth/me'), {
        headers: { Authorization: `Bearer ${token}` },
        signal: bgFetchRef.current.signal,
        cache: 'no-store',
      });

      if (shouldInvalidateSession(identityResponse.status)) {
        invalidateSession();
        return;
      }

      if (!identityResponse.ok) {
        setSessionState('AUTHENTICATED_NOT_READY');
        setReadinessReason(
          identityResponse.status === 503
            ? await readBoundedReadiness(bgFetchRef.current.signal)
            : `IDENTITY_HTTP_${identityResponse.status}`,
        );
        return;
      }

      const identity = await identityResponse.json();
      setUser(identity);
      setCachedUser(identity);

      const contextResponse = await fetch(apiUrl('/api/auth/me/context'), {
        headers: { Authorization: `Bearer ${token}` },
        signal: bgFetchRef.current.signal,
        cache: 'no-store',
      });

      if (shouldInvalidateSession(contextResponse.status)) {
        invalidateSession();
        return;
      }

      if (contextResponse.ok) {
        const data = await contextResponse.json();
        if (data.user) {
          setUser(data.user);
          setCachedUser(data.user);
        }
        setOrganizations(data.organizations || []);
        setPermissions(data.permissions || []);
        setSessionState('AUTHENTICATED_READY');
        setReadinessReason(null);
        return;
      }

      setOrganizations([]);
      setPermissions([]);
      setSessionState('AUTHENTICATED_NOT_READY');
      setReadinessReason(
        contextResponse.status === 503
          ? await readBoundedReadiness(bgFetchRef.current.signal)
          : `CONTEXT_HTTP_${contextResponse.status}`,
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // Intentional cancel
      // Network error — keep cached user, don't block
      setSessionState('AUTHENTICATED_NOT_READY');
      setReadinessReason('READINESS_UNAVAILABLE');
      console.warn('[Auth] Background session bootstrap failed; preserving authentication');
    } finally {
      setIsHydrating(false);
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      // No token — clear everything instantly, no loading
      setUser(null);
      setSessionState('UNAUTHENTICATED');
      setIsHydrating(false);
      if (pathname.startsWith('/dashboard')) {
        router.replace('/login');
      }
      return;
    }

    // Check expiry instantly from JWT without network
    const payload = parseJwt(token);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      clearInvalidAuthSession();
      setUser(null);
      setSessionState('UNAUTHENTICATED');
      setIsHydrating(false);
      router.replace('/login?expired=1');
      return;
    }

    // Fetch fresh context in background WITHOUT blocking UI
    fetchContext(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount — not on every pathname change

  useEffect(() => {
    if (sessionState !== 'AUTHENTICATED_NOT_READY') return;
    const retry = window.setInterval(() => fetchContext(false), 30_000);
    return () => window.clearInterval(retry);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState]);

  const currentOrganization = user?.current_organization_id
    ? organizations.find(o => o.id === user.current_organization_id) || null
    : null;

  const hasPermission = (permission: string) => {
    if (user?.is_superuser) return true;
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  };

  const switchOrganization = async (orgId: number) => {
    console.warn('Switch organization API not implemented yet');
  };

  return (
    <AuthContext.Provider value={{
      user,
      organizations,
      currentOrganization,
      permissions,
      isLoading,
      isHydrating,
      sessionState,
      readinessReason,
      hasPermission,
      switchOrganization,
      refreshContext: () => fetchContext(true),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
