"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getCustomerToken } from "@/lib/auth/token";
import { revokeAndClear } from "@/lib/auth/logout";

const navLinks = [
  { label: "Dashboard", href: "/account" },
  { label: "My Products", href: "/account/reorder" },
  { label: "Profile", href: "/account/profile" },
  { label: "Orders", href: "/account/orders" },
  { label: "Reviews", href: "/account/reviews" },
  { label: "Addresses", href: "/account/addresses" },
  { label: "Shipping Accounts", href: "/account/shipping-accounts" },
  { label: "Quick Order", href: "/quick-order" },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function checkAuth() {
      const token = getCustomerToken();
      if (token) {
        setReady(true);
      } else {
        // Small delay to avoid redirect race during login navigation
        const timer = setTimeout(() => {
          if (!getCustomerToken()) {
            router.replace("/customer/login");
          } else {
            setReady(true);
          }
        }, 100);
        return timer;
      }
    }

    const timer = checkAuth();

    // Re-check when auth state changes (e.g., login just set the token)
    function onAuthChange() {
      if (getCustomerToken()) setReady(true);
    }
    window.addEventListener("auth-change", onAuthChange);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("auth-change", onAuthChange);
    };
  }, [router]);

  function handleSignOut() {
    revokeAndClear().then(() => router.replace("/"));
  }

  if (!ready) {
    return (
      <div className="bg-gray-50 pb-16">
        <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
          <div className="mx-auto max-w-7xl px-4 py-10">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-700" />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pt-8">
          <div className="animate-pulse space-y-4">
            <div className="h-48 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 pb-16">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
        <div className="relative mx-auto max-w-7xl px-4 py-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(200,16,46,0.06)_0%,transparent_60%)]" />
          <div className="relative">
            <h1 className="text-3xl font-bold text-white">My Account</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 pt-8">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {/* Sidebar header */}
              <div className="flex items-center gap-2 bg-gray-900 px-5 py-3">
                <span className="h-3.5 w-[3px] rounded-sm bg-red-600" />
                <h2 className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
                  Navigation
                </h2>
              </div>

              {/* Nav links */}
              <nav className="p-2">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? "bg-red-50 font-semibold text-red-600"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {/* Sign Out */}
                <button
                  onClick={handleSignOut}
                  className="mt-1 block w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  Sign Out
                </button>
              </nav>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
