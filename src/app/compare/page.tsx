"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";
import { sanitizeHtml } from "@/lib/cms/parseDirectives";
import {
  getCompareProducts,
  removeFromCompare,
  clearCompare,
  type CompareProduct,
} from "@/lib/compare";
 
import { useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { PRODUCT_FIELDS } from "@/lib/graphql/fragments/product";
import { AddToCart } from "@/components/cart/AddToCart";

const COMPARE_PRODUCTS_QUERY = gql`
  query CompareProducts($skus: [String!]!) {
    products(filter: { sku: { in: $skus } }, pageSize: 4) {
      items {
        ...ProductFields
        description {
          html
        }
      }
    }
  }
  ${PRODUCT_FIELDS}
`;

export default function ComparePage() {
  const [compareItems, setCompareItems] = useState<CompareProduct[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCompareItems(getCompareProducts());
    setMounted(true);

    function onUpdate() {
      setCompareItems(getCompareProducts());
    }
    window.addEventListener("compare-updated", onUpdate);
    return () => window.removeEventListener("compare-updated", onUpdate);
  }, []);

  const skus = compareItems.map((p) => p.sku);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, loading } = useQuery<any>(COMPARE_PRODUCTS_QUERY, {
    variables: { skus },
    skip: skus.length === 0,
  });

  const products = data?.products?.items || [];

  // Order products to match compareItems order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderedProducts: any[] = compareItems
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((ci) => products.find((p: any) => p.sku === ci.sku))
    .filter(Boolean);

  if (!mounted) {
    return (
      <div className="bg-gray-50 pb-16">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800">
          <div className="mx-auto max-w-7xl px-4 py-8">
            <h1 className="text-2xl font-bold text-white">Compare Products</h1>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="h-64 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 pb-16">
      {/* Hero */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <nav className="mb-3 text-sm text-gray-400">
            <Link href="/" className="transition hover:text-white">
              Home
            </Link>
            <span className="mx-2 text-gray-600">/</span>
            <span className="text-gray-200">Compare Products</span>
          </nav>
          <h1 className="text-2xl font-bold text-white md:text-3xl">
            Compare Products
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {compareItems.length} product{compareItems.length !== 1 ? "s" : ""}{" "}
            selected
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {compareItems.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
            <svg
              className="mx-auto mb-4 h-16 w-16 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            <p className="text-lg font-medium text-gray-600">
              No products to compare
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Browse products and click &ldquo;Compare&rdquo; to add them here
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-end">
              <button
                onClick={() => clearCompare()}
                className="text-xs font-medium text-red-600 transition hover:text-red-700"
              >
                Clear All
              </button>
            </div>

            {loading ? (
              <div className="h-96 animate-pulse rounded-xl bg-gray-200" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full min-w-[600px]">
                  {/* Product images + names */}
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="w-40 bg-gray-50 px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Product
                      </th>
                      {orderedProducts.map((product) => (
                        <th
                          key={product.uid}
                          className="relative px-5 py-4 text-center"
                        >
                          <button
                            onClick={() => removeFromCompare(product.uid)}
                            className="absolute right-2 top-2 text-gray-400 transition hover:text-red-500"
                            aria-label="Remove"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                          <Link href={`/product/${product.url_key}`}>
                            <div className="relative mx-auto mb-3 h-28 w-28">
                              <Image
                                src={proxyMagentoImage(product.small_image?.url)}
                                alt={product.name}
                                fill
                                className="object-contain"
                                sizes="112px"
                              />
                            </div>
                            <p className="text-sm font-semibold text-gray-900 hover:text-blue-600 line-clamp-2">
                              {product.name}
                            </p>
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {/* Price */}
                    <CompareRow label="Price">
                      {orderedProducts.map((p) => (
                        <td key={p.uid} className="px-5 py-3 text-center">
                          <span className="text-lg font-bold text-gray-900">
                            $
                            {p.price_range?.minimum_price?.final_price?.value?.toFixed(
                              2,
                            )}
                          </span>
                        </td>
                      ))}
                    </CompareRow>

                    {/* SKU */}
                    <CompareRow label="SKU">
                      {orderedProducts.map((p) => (
                        <td
                          key={p.uid}
                          className="px-5 py-3 text-center font-mono text-sm text-gray-600"
                        >
                          {p.sku}
                        </td>
                      ))}
                    </CompareRow>

                    {/* Availability */}
                    <CompareRow label="Availability">
                      {orderedProducts.map((p) => (
                        <td key={p.uid} className="px-5 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                              p.stock_status !== "OUT_OF_STOCK"
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                p.stock_status !== "OUT_OF_STOCK"
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              }`}
                            />
                            {p.stock_status !== "OUT_OF_STOCK"
                              ? "In Stock"
                              : "Out of Stock"}
                          </span>
                        </td>
                      ))}
                    </CompareRow>

                    {/* Description */}
                    <CompareRow label="Description">
                      {orderedProducts.map((p) => (
                        <td key={p.uid} className="px-5 py-3">
                          {p.short_description?.html ? (
                            <div
                              className="text-xs leading-relaxed text-gray-600 line-clamp-4"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeHtml(p.short_description.html),
                              }}
                            />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      ))}
                    </CompareRow>

                    {/* Add to Cart */}
                    <tr>
                      <td className="bg-gray-50 px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500" />
                      {orderedProducts.map((p) => (
                        <td key={p.uid} className="px-5 py-4 text-center">
                          <AddToCart product={p} />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CompareRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td className="bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </td>
      {children}
    </tr>
  );
}
