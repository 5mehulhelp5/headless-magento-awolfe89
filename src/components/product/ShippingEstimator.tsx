"use client";

import { useState, useEffect, useRef } from "react";
import { formatPrice } from "@/lib/formatPrice";

interface ShippingRate {
  carrier: string;
  carrierTitle: string;
  method: string;
  methodTitle: string;
  price: number;
  estimatedDays: string;
}

interface ShippingEstimatorProps {
  sku: string;
  weight: number | null;
  price: number;
  /** Minimum order amount for free shipping, or null if not offered */
  freeShippingThreshold: number | null;
}

export function ShippingEstimator({ sku, weight, price, freeShippingThreshold }: ShippingEstimatorProps) {
  const [zip, setZip] = useState("");
  const [savedZip, setSavedZip] = useState<string | null>(null);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track which zip was last fetched to avoid duplicate requests
  const lastFetchedZip = useRef<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const stored = localStorage.getItem("shipping_zip");
      if (stored) {
        setZip(stored);
        setSavedZip(stored);
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Fetch rates when savedZip changes (initial load from localStorage or user action)
  useEffect(() => {
    if (savedZip && savedZip !== lastFetchedZip.current) {
      fetchRates(savedZip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedZip, sku]);

  async function fetchRates(zipCode: string) {
    if (lastFetchedZip.current === zipCode) return;
    lastFetchedZip.current = zipCode;
    setLoading(true);
    setError(null);
    setRates([]);

    try {
      const res = await fetch("/api/shipping/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, qty: 1, weight, zipCode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to estimate shipping");
      }

      const data = await res.json();
      setRates(data.rates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to estimate shipping rates");
      lastFetchedZip.current = null; // Allow retry
    } finally {
      setLoading(false);
    }
  }

  function handleSaveZip() {
    const trimmed = zip.trim();
    if (trimmed.length >= 5) {
      localStorage.setItem("shipping_zip", trimmed);
      setSavedZip(trimmed);
    }
  }

  const qualifiesForFree = freeShippingThreshold !== null && price >= freeShippingThreshold;

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-gray-900">
        <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2-1 2 1 2-1 2 1 2-1zm0 0h6a1 1 0 011 1v3a1 1 0 01-1 1h-1M6 20a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
        Shipping Estimate
        {savedZip && (
          <span className="ml-auto text-[11px] font-normal text-gray-400">
            to {savedZip}
          </span>
        )}
      </h3>

      {/* Zip code input */}
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="Enter ZIP code"
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && handleSaveZip()}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-red-300 focus:ring-1 focus:ring-red-100"
        />
        <button
          onClick={handleSaveZip}
          disabled={zip.trim().length < 5 || loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
        >
          {loading ? "..." : "Estimate"}
        </button>
      </div>

      {savedZip ? (
        <div className="space-y-0 divide-y divide-gray-100 text-[13px]">
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="ml-2 text-xs text-gray-400">Estimating rates...</span>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="py-3 text-xs text-red-500">{error}</div>
          )}

          {/* No rates found */}
          {!loading && !error && rates.length === 0 && (
            <div className="py-3 text-xs text-gray-400">
              No shipping rates available for this ZIP code. Shipping will be billed on invoice.
            </div>
          )}

          {/* Carrier rates */}
          {!loading && rates.map((rate) => (
            <div key={`${rate.carrier}-${rate.method}`} className="flex items-center justify-between py-2">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-900">
                  {rate.carrierTitle} {rate.methodTitle}
                </span>
              </div>
              {rate.estimatedDays && (
                <span className="mx-3 shrink-0 text-gray-400">
                  Est. {rate.estimatedDays}
                </span>
              )}
              <span className="shrink-0 font-mono text-xs font-semibold text-gray-900">
                ${formatPrice(rate.price)}
              </span>
            </div>
          ))}

          {/* Free shipping eligibility */}
          {!loading && freeShippingThreshold !== null && qualifiesForFree && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-green-700">Free Ground Shipping</span>
              </div>
              <span className="text-xs font-semibold text-green-600">Eligible!</span>
            </div>
          )}
          {!loading && freeShippingThreshold !== null && !qualifiesForFree && (
            <div className="flex items-center justify-between py-2">
              <span className="font-medium text-gray-500">Free Ground</span>
              <span className="text-xs text-gray-400">
                Orders ${freeShippingThreshold}+
              </span>
              <span className="text-xs text-gray-400">
                Add ${formatPrice(freeShippingThreshold - price)} more
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          Enter your ZIP code to see estimated shipping rates.
        </p>
      )}
    </div>
  );
}
