"use client";

import Image from "next/image";
import { useState, useRef, useCallback } from "react";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";

interface GalleryImage {
  url: string;
  label: string | null;
  position: number;
  disabled: boolean;
}

interface ProductGalleryProps {
  images: GalleryImage[];
  hasDiscount?: boolean;
  discountPercent?: number;
}

const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Crect fill='%23fafafa' width='600' height='600'/%3E%3Cg transform='translate(225,240)'%3E%3Cpath d='M75 0L140 37.5v75L75 150 10 112.5V37.5z' fill='none' stroke='%23d1d5db' stroke-width='2'/%3E%3Cpath d='M75 30L110 50v40L75 110 40 90V50z' fill='none' stroke='%23d1d5db' stroke-width='1.5'/%3E%3Ccircle cx='75' cy='70' r='12' fill='none' stroke='%23d1d5db' stroke-width='1.5'/%3E%3C/g%3E%3Ctext x='300' y='360' text-anchor='middle' fill='%239ca3af' font-family='system-ui' font-size='14'%3ENo Image Available%3C/text%3E%3C/svg%3E";

function isPlaceholder(url: string): boolean {
  return !url || url.includes("placeholder") || url.includes("not-found");
}

export function ProductGallery({
  images,
  hasDiscount,
  discountPercent,
}: ProductGalleryProps) {
  const activeImages = images
    .filter((img) => !img.disabled)
    .sort((a, b) => a.position - b.position)
    .map((img) => ({ ...img, url: proxyMagentoImage(img.url) }));

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const imgRef = useRef<HTMLDivElement>(null);
  const selected = activeImages[selectedIndex] || activeImages[0];
  const usePlaceholder = !selected || isPlaceholder(selected?.url);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }, []);

  return (
    <div className="sticky top-6">
      {/* Main image */}
      <div
        ref={imgRef}
        className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        onMouseEnter={() => !usePlaceholder && setZooming(true)}
        onMouseLeave={() => setZooming(false)}
        onMouseMove={handleMouseMove}
      >
        {usePlaceholder ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={PLACEHOLDER_SVG}
            alt="No image available"
            className="h-full w-full object-contain p-8"
          />
        ) : (
          <>
            {/* Normal view */}
            <Image
              src={selected.url}
              alt={selected.label || "Product image"}
              fill
              className={`object-contain p-4 transition-opacity duration-200 ${
                zooming ? "opacity-0" : "opacity-100"
              }`}
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
            {/* Zoomed view */}
            {zooming && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${selected.url})`,
                  backgroundSize: "200%",
                  backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                  backgroundRepeat: "no-repeat",
                }}
              />
            )}
          </>
        )}

        {/* Sale badge */}
        {hasDiscount && discountPercent && discountPercent > 0 && (
          <span className="absolute left-3 top-3 rounded-md bg-red-600 px-3 py-1 text-sm font-bold text-white shadow-md">
            SALE
          </span>
        )}

        {/* Zoom hint */}
        {!usePlaceholder && !zooming && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
            </svg>
            Hover to zoom
          </span>
        )}
      </div>

      {/* Thumbnails */}
      {activeImages.length > 1 && (
        <div className="mt-3 flex gap-2.5 overflow-x-auto">
          {activeImages.map((img, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              aria-label={img.label || `View image ${index + 1}`}
              className={`relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-lg border-2 bg-white transition ${
                index === selectedIndex
                  ? "border-red-600"
                  : "border-gray-200 hover:border-red-300"
              }`}
            >
              <Image
                src={img.url}
                alt={img.label || `Thumbnail ${index + 1}`}
                fill
                className="object-contain p-1"
                sizes="68px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
