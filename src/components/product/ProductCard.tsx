import Image from "next/image";
import Link from "next/link";
import { QuickAddToCart } from "@/components/cart/QuickAddToCart";
import { formatPrice } from "@/lib/formatPrice";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";

const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect fill='%23f3f4f6' width='400' height='400'/%3E%3Cg transform='translate(150,160)'%3E%3Cpath d='M50 0L93.3 25v50L50 100 6.7 75V25z' fill='none' stroke='%23d1d5db' stroke-width='2'/%3E%3Cpath d='M50 20L73.3 33.3v26.7L50 73.3 26.7 60V33.3z' fill='none' stroke='%23d1d5db' stroke-width='1.5'/%3E%3Ccircle cx='50' cy='46' r='8' fill='none' stroke='%23d1d5db' stroke-width='1.5'/%3E%3C/g%3E%3Ctext x='200' y='240' text-anchor='middle' fill='%239ca3af' font-family='system-ui' font-size='13'%3ENo Image%3C/text%3E%3C/svg%3E";

interface ProductCardProps {
  product: {
    uid: string;
    name: string;
    sku: string;
    url_key: string;
    stock_status: string;
    manufacturer?: number | null;
    small_image: { url: string; label: string | null };
    price_range?: {
      minimum_price: {
        final_price: { value: number; currency: string };
        regular_price: { value: number; currency: string };
        discount: { percent_off: number } | null;
      };
    };
  };
  brandLabel?: string | null;
}

function isPlaceholder(url: string): boolean {
  return !url || url.includes("placeholder") || url.includes("not-found");
}

export function ProductCard({ product, brandLabel }: ProductCardProps) {
  if (!product.price_range?.minimum_price) return null;
  const { final_price, regular_price, discount } =
    product.price_range.minimum_price;
  const hasDiscount = discount && discount.percent_off > 0;
  const imgSrc = isPlaceholder(product.small_image?.url)
    ? PLACEHOLDER_IMAGE
    : proxyMagentoImage(product.small_image.url);
  const isOutOfStock = product.stock_status === "OUT_OF_STOCK";
  const isAvailableToOrder = product.stock_status === "AVAILABLE_TO_ORDER";

  return (
    <div
      className={`group relative flex flex-col rounded-lg border bg-white transition hover:shadow-lg ${
        hasDiscount
          ? "border-red-200/60"
          : "border-gray-200"
      }`}
    >
      {/* Image */}
      <Link
        href={`/product/${product.url_key}`}
        className="relative aspect-square overflow-hidden rounded-t-lg bg-gray-50"
      >
        {imgSrc === PLACEHOLDER_IMAGE ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={product.name}
            className="h-full w-full object-contain p-4"
          />
        ) : (
          <Image
            src={imgSrc}
            alt={product.small_image?.label || product.name}
            fill
            className="object-contain p-2 transition group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        )}
        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {hasDiscount && (
            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              -{Math.round(discount.percent_off)}%
            </span>
          )}
          {isOutOfStock && (
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
              OUT OF STOCK
            </span>
          )}
          {isAvailableToOrder && (
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              AVAILABLE TO ORDER
            </span>
          )}
        </div>
        {/* Sale corner ribbon effect */}
        {hasDiscount && (
          <div className="absolute right-0 top-0 h-16 w-16 overflow-hidden">
            <div className="absolute right-[-20px] top-[8px] w-[80px] rotate-45 bg-red-600 py-0.5 text-center text-[8px] font-bold text-white shadow-sm">
              SALE
            </div>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        {/* Brand */}
        {brandLabel && (
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-600">
            {brandLabel}
          </p>
        )}

        {/* Name */}
        <Link href={`/product/${product.url_key}`}>
          <h3 className="mb-1 text-sm font-medium leading-snug text-gray-900 line-clamp-2 group-hover:text-blue-600">
            {product.name}
          </h3>
        </Link>

        {/* SKU */}
        <p className="mb-2 text-[11px] text-gray-400">SKU: {product.sku}</p>

        {/* Spacer to push price + button to bottom */}
        <div className="mt-auto">
          {/* Price */}
          <div className="mb-2">
            {hasDiscount ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-red-600">
                  ${formatPrice(final_price.value)}
                </span>
                <span className="text-xs text-gray-400 line-through">
                  ${formatPrice(regular_price.value)}
                </span>
              </div>
            ) : (
              <span className="text-lg font-bold text-gray-900">
                ${formatPrice(final_price.value)}
              </span>
            )}
            {hasDiscount && (
              <p className="mt-0.5 text-[10px] font-semibold text-red-600">
                You save ${formatPrice(regular_price.value - final_price.value)}
              </p>
            )}
          </div>

          {/* Add to Cart */}
          <QuickAddToCart sku={product.sku} stockStatus={product.stock_status} />
        </div>
      </div>
    </div>
  );
}
