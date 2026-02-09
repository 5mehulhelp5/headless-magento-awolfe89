"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLazyQuery } from "@apollo/client/react";
import { SEARCH_SUGGESTIONS_QUERY } from "@/lib/graphql/queries/search";
import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/formatPrice";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";

interface SuggestionProduct {
  uid: string;
  name: string;
  url_key: string;
  small_image: { url: string; label: string } | null;
  price_range: {
    minimum_price: {
      final_price: { value: number; currency: string };
    };
  };
}

export function SearchBar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fetchSuggestions, { data, loading }] = useLazyQuery<any>(
    SEARCH_SUGGESTIONS_QUERY,
    { fetchPolicy: "cache-first" },
  );

  const products: SuggestionProduct[] = data?.products?.items || [];
  const totalCount: number = data?.products?.total_count || 0;

  // Debounced search
  const debouncedSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.trim().length < 2) {
        setShowSuggestions(false);
        return;
      }
      debounceRef.current = setTimeout(() => {
        fetchSuggestions({ variables: { search: q.trim() } });
        setShowSuggestions(true);
        setHighlightIndex(-1);
      }, 300);
    },
    [fetchSuggestions],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);
    debouncedSearch(val);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      setShowSuggestions(false);
      router.push(`/search?q=${encodeURIComponent(q)}`);
      setSearchQuery("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || products.length === 0) return;

    // items = products + "See all" link
    const itemCount = products.length + 1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % itemCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev <= 0 ? itemCount - 1 : prev - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      if (highlightIndex < products.length) {
        // Navigate to product
        const p = products[highlightIndex];
        router.push(`/product/${p.url_key}`);
      } else {
        // "See all results"
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
      setShowSuggestions(false);
      setSearchQuery("");
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="search"
          value={searchQuery}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (searchQuery.trim().length >= 2 && products.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder="Search products, brands, categories..."
          className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-4 pr-12 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
        />
        <button
          type="submit"
          className="absolute right-1 top-1 rounded-md bg-red-600 p-1.5 text-white transition hover:bg-red-700"
          aria-label="Search"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>

      {/* Suggestions dropdown */}
      {showSuggestions && searchQuery.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          {loading && products.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-red-600" />
              Searching...
            </div>
          ) : products.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              No products found for &ldquo;{searchQuery.trim()}&rdquo;
            </div>
          ) : (
            <>
              <div className="max-h-[360px] overflow-y-auto">
                {products.map((product, idx) => {
                  const price =
                    product.price_range?.minimum_price?.final_price?.value;
                  const imageUrl = proxyMagentoImage(product.small_image?.url);

                  return (
                    <Link
                      key={product.uid}
                      href={`/product/${product.url_key}`}
                      onClick={() => {
                        setShowSuggestions(false);
                        setSearchQuery("");
                      }}
                      className={`flex items-center gap-3 px-4 py-2.5 transition ${
                        idx === highlightIndex
                          ? "bg-gray-100"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded border border-gray-100 object-contain"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-100 bg-gray-50">
                          <svg
                            className="h-5 w-5 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                          >
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
                            />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {product.name}
                        </p>
                        {price != null && (
                          <p className="text-xs font-semibold text-red-600">
                            ${formatPrice(price)}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {totalCount > 0 && (
                <Link
                  href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                  onClick={() => {
                    setShowSuggestions(false);
                    setSearchQuery("");
                  }}
                  className={`flex items-center justify-center gap-2 border-t border-gray-100 px-4 py-3 text-sm font-medium text-red-600 transition ${
                    highlightIndex === products.length
                      ? "bg-gray-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  See all {totalCount} results
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
