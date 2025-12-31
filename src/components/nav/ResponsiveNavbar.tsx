'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

import MaterialButton from '@/components/ui/MaterialButton';
import { signOut } from '@/app/_actions/auth';

type NavItem = { href: string; label: string };

type Props = {
  userEmail: string | null;
};

export default function ResponsiveNavbar({ userEmail }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuMounted, setIsMenuMounted] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  const items: NavItem[] = useMemo(
    () => [
      { href: '/', label: 'Home' },
      { href: '/trips', label: 'Trips' },
      { href: '/account', label: 'Account' },
    ],
    []
  );

  const letter = (userEmail?.trim()?.[0] ?? 'U').toUpperCase();

  const openMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsMenuMounted(true);
    setIsMenuOpen(true);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsMenuMounted(false);
      closeTimeoutRef.current = null;
    }, 300);
  };

  return (
    <>
      <div className="mx-auto flex h-full w-full items-center justify-between gap-3 px-4 md:px-6 lg:max-w-7xl lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-[#E3E3E3]">
          <span className="text-2xl">TravelTab</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm text-[#C4C7C5] md:flex">
          {items.map((it) => (
            <Link key={it.href} href={it.href} className="hover:text-[#E3E3E3]">
              {it.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-[#E3E3E3] transition-colors hover:bg-white/10 md:hidden"
            aria-label="Open menu"
            onClick={openMenu}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Auth actions (desktop only; mobile inside drawer) */}
          <div className="hidden items-center gap-3 md:flex">
            {userEmail ? (
              <>
                <div
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#2A2A2A] text-sm font-semibold text-[#E3E3E3]"
                  aria-label="User avatar"
                >
                  {letter}
                </div>
                <form action={signOut}>
                  <MaterialButton variant="text" type="submit">
                    Sign out
                  </MaterialButton>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">
                  <MaterialButton variant="text">Log in</MaterialButton>
                </Link>
                <Link href="/signup">
                  <MaterialButton variant="filled">Sign up</MaterialButton>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile overlay + drawer */}
      {isMenuMounted ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={closeMenu}
          role="presentation"
        >
          <div
            className={
              'fixed top-0 right-0 z-50 h-full w-70 bg-[#1E1E1E] shadow-2xl ' +
              'transform transition-transform duration-300 ' +
              (isMenuOpen ? 'translate-x-0' : 'translate-x-full')
            }
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Navigation"
          >
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="text-base font-semibold text-[#E3E3E3]">Menu</div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-[#E3E3E3] hover:bg-white/10"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={closeMenu}
                  className="border-b border-white/10 p-4 text-lg text-[#E3E3E3] hover:bg-white/5"
                >
                  {it.label}
                </Link>
              ))}
            </nav>

            <div className="mt-2 border-t border-white/10">
              <div className="p-4">
                {userEmail ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#E3E3E3]">Signed in</div>
                      <div className="truncate text-sm text-[#C4C7C5]">{userEmail}</div>
                    </div>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2A2A2A] text-sm font-semibold text-[#E3E3E3]">
                      {letter}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link href="/login" onClick={closeMenu} className="block">
                      <MaterialButton variant="tonal" className="w-full">
                        Log in
                      </MaterialButton>
                    </Link>
                    <Link href="/signup" onClick={closeMenu} className="block">
                      <MaterialButton variant="filled" className="w-full">
                        Sign up
                      </MaterialButton>
                    </Link>
                  </div>
                )}

                {userEmail ? (
                  <form action={signOut} className="mt-3" onSubmit={closeMenu}>
                    <MaterialButton variant="text" type="submit" className="w-full">
                      Sign out
                    </MaterialButton>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
