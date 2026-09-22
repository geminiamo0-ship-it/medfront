import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { getHomeStats } from '@/api/users';
import { Logo } from '@/components/Logo';
import { LIBRARY_SOURCES } from '@/lib/nav';

function initials(name?: string): string {
  if (!name) return 'MP';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside]);
  return ref;
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-mp/10 text-mp' : 'text-ink-muted hover:bg-surface2 hover:text-ink'
  }`;

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [libOpen, setLibOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const libRef = useClickOutside<HTMLDivElement>(() => setLibOpen(false));
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenuOpen(false));

  const { data: stats } = useQuery({
    queryKey: ['home-stats'],
    queryFn: getHomeStats,
    staleTime: 60_000,
  });

  const streak = stats?.loginStreak?.current ?? 0;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
          <Link to="/hub" className="mr-2 flex shrink-0 items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="hidden text-lg font-bold tracking-tight text-ink sm:block">
              MedPark
            </span>
          </Link>

          <nav className="flex items-center gap-0.5">
            <NavLink to="/hub" className={navItemClass} end>
              Home
            </NavLink>
            <NavLink to="/dashboard" className={navItemClass}>
              Dashboard
            </NavLink>
            <NavLink to="/contests" className={navItemClass}>
              Contests
            </NavLink>

            <div className="relative" ref={libRef}>
              <button
                type="button"
                onClick={() => setLibOpen((o) => !o)}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/library')
                    ? 'bg-mp/10 text-mp'
                    : 'text-ink-muted hover:bg-surface2 hover:text-ink'
                }`}
              >
                Library
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {libOpen && (
                <div className="absolute left-0 top-12 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop">
                  {LIBRARY_SOURCES.map((s) => (
                    <Link
                      key={s.id}
                      to={`/library?source=${s.id}`}
                      onClick={() => setLibOpen(false)}
                      className="block px-3.5 py-2 text-sm text-ink-soft transition-colors hover:bg-surface2 hover:text-ink"
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1 sm:flex">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-mp" fill="currentColor">
                <path d="M12 2c.5 3-1.5 4.5-2.8 6C7.7 9.6 7 11 7 12.5a5 5 0 0 0 10 0c0-1.2-.4-2.3-1.1-3.2-.3.9-.9 1.5-1.6 1.7.6-2.4-.4-5.2-2.3-6.9.1 1.6-.7 2.7-1.6 3.4C9.5 8 8.6 9.5 8.6 11c0 .3 0 .6.1.9" />
              </svg>
              <span className="text-sm font-semibold text-ink">{streak}</span>
            </div>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5 transition-colors hover:bg-surface2"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mp/10 text-xs font-bold text-mp">
                  {initials(user?.name)}
                </span>
                <span className="hidden max-w-[8rem] truncate text-sm font-medium text-ink-soft sm:block">
                  {user?.name ?? 'Student'}
                </span>
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-ink-faint" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop">
                  <div className="border-b border-line px-3.5 py-2.5">
                    <div className="truncate text-sm font-semibold text-ink">
                      {user?.name ?? 'Student'}
                    </div>
                    <div className="truncate text-xs text-ink-muted">{user?.email}</div>
                  </div>
                  <Link
                    to={user ? `/profile/${user.userId}` : '/hub'}
                    onClick={() => setMenuOpen(false)}
                    className="block px-3.5 py-2 text-sm text-ink-soft transition-colors hover:bg-surface2 hover:text-ink"
                  >
                    Profile
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3.5 py-2 text-sm text-ink-soft transition-colors hover:bg-surface2 hover:text-ink"
                  >
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="block w-full px-3.5 py-2 text-left text-sm text-bad transition-colors hover:bg-bad/5"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  );
}