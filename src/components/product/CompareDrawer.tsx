"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";
import {
  getCompareProducts,
  removeFromCompare,
  clearCompare,
  type CompareProduct,
} from "@/lib/compare";

export function CompareDrawer() {
  const [items, setItems] = useState<CompareProduct[]>([]);

  useEffect(() => {
    function onUpdate() {
      setItems(getCompareProducts());
    }
    // Initial load via rAF to avoid synchronous setState in effect body
    const id = requestAnimationFrame(onUpdate);
    window.addEventListener("compare-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("compare-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Compare ({items.length}/4)
        </span>

        <div className="flex flex-1 items-center gap-3 overflow-x-auto">
          {items.map((item) => (
            <div
              key={item.uid}
              className="group relative flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="relative h-8 w-8 overflow-hidden rounded bg-white">
                <Image
                  src={proxyMagentoImage(item.image_url)}
                  alt={item.name}
                  fill
                  className="object-contain"
                  sizes="32px"
                />
              </div>
              <span className="max-w-[120px] truncate text-xs font-medium text-gray-700">
                {item.name}
              </span>
              <button
                onClick={() => removeFromCompare(item.uid)}
                className="ml-1 text-gray-400 transition hover:text-red-500"
                aria-label={`Remove ${item.name}`}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => clearCompare()}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 transition hover:bg-gray-50"
          >
            Clear
          </button>
          <Link
            href="/compare"
            className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition ${
              items.length >= 2
                ? "bg-red-600 hover:bg-red-700"
                : "pointer-events-none bg-gray-300"
            }`}
          >
            Compare Now
          </Link>
        </div>
      </div>
    </div>
  );
}
