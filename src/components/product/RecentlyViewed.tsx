"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getRecentlyViewed, type RecentProduct } from "@/lib/recentlyViewed";
import { formatPrice } from "@/lib/formatPrice";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";

interface Props {
  /** Exclude current product from the list */
  excludeUrlKey?: string;
  maxItems?: number;
}

export function RecentlyViewed({ excludeUrlKey, maxItems = 6 }: Props) {
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const all = getRecentlyViewed().filter(
        (p) => p.url_key !== excludeUrlKey,
      );
      setItems(all.slice(0, maxItems));
    });
    return () => cancelAnimationFrame(id);
  }, [excludeUrlKey, maxItems]);

  if (items.length === 0) return null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h2 className="shrink-0 text-xl font-bold text-gray-900">
          Recently Viewed
        </h2>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {items.map((item) => (
          <Link
            key={item.url_key}
            href={`/product/${item.url_key}`}
            className="group overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-md"
          >
            <div className="relative aspect-square bg-gray-50">
              <Image
                src={proxyMagentoImage(item.image_url)}
                alt={item.name}
                fill
                className="object-contain p-2 transition group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, 16vw"
              />
            </div>
            <div className="p-2.5">
              <p className="text-[11px] leading-snug text-gray-900 line-clamp-2 group-hover:text-blue-600">
                {item.name}
              </p>
              <p className="mt-1 text-xs font-bold text-gray-900">
                ${formatPrice(item.price)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
