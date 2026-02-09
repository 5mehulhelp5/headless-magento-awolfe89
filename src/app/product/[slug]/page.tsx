import { query } from "@/lib/apollo/rsc-client";
import { PRODUCT_DETAIL_QUERY } from "@/lib/graphql/queries/productDetail";
import { CATEGORY_SIBLING_PRODUCTS_QUERY } from "@/lib/graphql/queries/products";
import { getProductSpecs } from "@/lib/magento/productAttributes";
import { getFreeShippingThreshold } from "@/lib/magento/freeShipping";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductTabs } from "@/components/product/ProductTabs";
import { AddToCart } from "@/components/cart/AddToCart";
import { ConfigurableAddToCart } from "@/components/product/ConfigurableAddToCart";
import { StickyBar } from "@/components/product/StickyBar";
import { TierPricing } from "@/components/product/TierPricing";
import { CompareButton } from "@/components/product/CompareButton";
import { RecentlyViewedTracker } from "@/components/product/RecentlyViewedTracker";
import { ShippingEstimator } from "@/components/product/ShippingEstimator";
import { YouMayAlsoLike } from "@/components/product/YouMayAlsoLike";
import { ProductReviews } from "@/components/product/ProductReviews";
import { ProductQA } from "@/components/product/ProductQA";
import { BulkQuoteModal } from "@/components/product/BulkQuoteModal";
import { ContractPricingBanner } from "@/components/product/ContractPricingBanner";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { formatPrice } from "@/lib/formatPrice";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://technimark.com";

// Revalidate product pages every 15 minutes
export const revalidate = 900;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
     
    const { data } = (await query({
      query: PRODUCT_DETAIL_QUERY,
      variables: { urlKey: slug },
    })) as { data: any };
    const product = data.products?.items?.[0];
    const description =
      product?.short_description?.html?.replace(/<[^>]*>/g, "") || "";
    const imageUrl = proxyMagentoImage(product?.small_image?.url);
    return {
      title: product?.name || "Product",
      description,
      openGraph: {
        title: product?.name,
        description,
        type: "website",
        ...(imageUrl && { images: [{ url: imageUrl }] }),
      },
    };
  } catch {
    return { title: "Product" };
  }
}

/** Resolve manufacturer ID → label via aggregation */
async function getManufacturerLabel(
  manufacturerId: number | null,
): Promise<string | null> {
  if (!manufacturerId) return null;
  try {
     
    const { data } = (await query({
      query: MANUFACTURER_LOOKUP_QUERY,
      variables: { manufacturerId: String(manufacturerId) },
      fetchPolicy: "no-cache",
    })) as { data: any };
    const agg = data.products?.aggregations?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => a.attribute_code === "manufacturer",
    );
    const opt = agg?.options?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (o: any) => o.value === String(manufacturerId),
    );
    return opt?.label || null;
  } catch {
    return null;
  }
}

import { gql } from "@apollo/client";
const MANUFACTURER_LOOKUP_QUERY = gql`
  query ManufacturerLookup($manufacturerId: String!) {
    products(
      filter: { manufacturer: { eq: $manufacturerId } }
      pageSize: 1
    ) {
      aggregations {
        attribute_code
        options {
          label
          value
        }
      }
    }
  }
`;

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

   
  const { data } = (await query({
    query: PRODUCT_DETAIL_QUERY,
    variables: { urlKey: slug },
    fetchPolicy: "no-cache",
  })) as { data: any };

  const product = data.products?.items?.[0];

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Product Not Found
        </h1>
        <p className="mb-8 text-gray-600">
          The product you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  // Resolve manufacturer label
  const brandLabel = await getManufacturerLabel(product.manufacturer);

  // Price data
  const priceData = product.price_range?.minimum_price;
  const finalPrice = priceData?.final_price?.value || 0;
  const regularPrice = priceData?.regular_price?.value || 0;
  const discount = priceData?.discount;
  const hasDiscount = discount && discount.percent_off > 0;
  const isOutOfStock = product.stock_status === "OUT_OF_STOCK";
  const isAvailableToOrder = product.stock_status === "AVAILABLE_TO_ORDER";
  const inStock = !isOutOfStock;

  // Best category for breadcrumbs (prefer one with breadcrumbs, skip "Shop By Brand")
  const bestCategory = product.categories
    ?.filter((c: any) => c.breadcrumbs && c.breadcrumbs.length > 0)
    ?.filter((c: any) => !c.url_path?.startsWith("shop-by-brand"))
    ?.[0] || product.categories?.[0];

  // Fetch product specs and free shipping threshold in parallel
  const [specs, freeShippingThreshold] = await Promise.all([
    getProductSpecs(product.sku),
    getFreeShippingThreshold(),
  ]);

  // Extract special attributes from specs
  const mfgSku = specs.find((s) => s.code === "manufacturer_sku")?.value || null;
  const sdsUrl = specs.find((s) => s.code === "sds")?.value || null;
  // SDS document URLs also route through our media proxy for auth
  const sdsProxy = (url: string) =>
    url.startsWith("http") ? proxyMagentoImage(url) : `/api/media/${url.replace(/^\//, "")}`;

  // Fetch sibling products from same category for "You May Also Like"
  let categoryProducts: any[] = [];
  if (bestCategory?.uid) {
    try {
      const { data: siblingData } = (await query({
        query: CATEGORY_SIBLING_PRODUCTS_QUERY,
        variables: { categoryUid: bestCategory.uid, pageSize: 12 },
        fetchPolicy: "no-cache",
      })) as { data: any };
      categoryProducts = siblingData?.products?.items || [];
    } catch {
      // Non-critical — "You May Also Like" will fall back to related_products only
    }
  }

  // Build tabs — always show Description + Specifications at minimum
  const tabs = [];

  // Description tab (always present)
  tabs.push({
    id: "description",
    label: "Description",
    content: product.description?.html || product.short_description?.html || "<p>No description available for this product.</p>",
    type: "html" as const,
  });

  // Details tab (if both description and short_description exist)
  if (product.short_description?.html && product.description?.html) {
    tabs.push({
      id: "details",
      label: "Details",
      content: product.short_description.html,
      type: "html" as const,
    });
  }

  // Specifications tab — pull from REST API with all visible attributes
  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const specsHtml = specs.length > 0
    ? `<table class="w-full text-sm"><tbody>${specs.map((s, i) => `<tr class="${i % 2 === 1 ? "bg-gray-50/60" : ""}"><td class="px-4 py-3 text-gray-400 w-52 font-medium">${escHtml(s.label)}</td><td class="px-4 py-3 font-medium text-gray-900">${escHtml(s.value)}</td></tr>`).join("")}</tbody></table>`
    : `<table class="w-full text-sm"><tbody><tr><td class="px-4 py-3 text-gray-400 w-52 font-medium">Manufacturer</td><td class="px-4 py-3 font-medium text-gray-900">${escHtml(brandLabel || "N/A")}</td></tr><tr class="bg-gray-50/60"><td class="px-4 py-3 text-gray-400 w-52 font-medium">SKU</td><td class="px-4 py-3 font-medium text-gray-900">${escHtml(product.sku)}</td></tr></tbody></table>`;
  tabs.push({
    id: "specs",
    label: "Specifications",
    content: specsHtml,
    type: "specs" as const,
  });

  // Documents tab (SDS sheets, PDFs, etc.)
  const documents: { label: string; url: string; type: string }[] = [];
  if (sdsUrl) {
    // Handle both full URLs and relative paths
    const fullSdsUrl = sdsProxy(sdsUrl);
    documents.push({ label: "Safety Data Sheet (SDS)", url: fullSdsUrl, type: "SDS" });
  }
  // Future: add more document types here from other attributes

  if (documents.length > 0) {
    const docsHtml = `<div class="space-y-3">${documents.map((doc) => `<a href="${escHtml(doc.url)}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition hover:border-red-300 hover:bg-red-50/30"><svg class="h-8 w-8 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg><div><p class="text-sm font-semibold text-gray-900">${escHtml(doc.label)}</p><p class="text-xs text-gray-500">PDF Document &middot; Click to download</p></div><svg class="ml-auto h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></a>`).join("")}</div>`;
    tabs.push({
      id: "documents",
      label: "Documents",
      content: docsHtml,
      type: "html" as const,
    });
  }

  // Q&A tab (SwissUp Askit integration)
  tabs.push({
    id: "qa",
    label: "Q&A",
    type: "component" as const,
    component: <ProductQA sku={product.sku} />,
  });

  // Reviews tab with real data
  const reviewCount = product.review_count || 0;
  const ratingSummary = product.rating_summary || 0;
  const reviewItems = product.reviews?.items || [];
  tabs.push({
    id: "reviews",
    label: `Reviews${reviewCount > 0 ? ` (${reviewCount})` : ""}`,
    type: "component" as const,
    component: (
      <ProductReviews
        sku={product.sku}
        reviewCount={reviewCount}
        ratingSummary={ratingSummary}
        reviews={reviewItems}
      />
    ),
  });

  // Build breadcrumb list for JSON-LD
  const breadcrumbItems = [
    { name: "Home", url: SITE_URL },
    ...(bestCategory?.breadcrumbs?.map(
      (crumb: { category_name: string; category_url_path: string }) => ({
        name: crumb.category_name,
        url: `${SITE_URL}/category/${crumb.category_url_path}`,
      }),
    ) || []),
    ...(bestCategory
      ? [
          {
            name: bestCategory.name,
            url: `${SITE_URL}/category/${bestCategory.url_path}`,
          },
        ]
      : []),
    { name: product.name, url: `${SITE_URL}/product/${product.url_key}` },
  ];

  return (
    <div className="bg-gray-50">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          sku: product.sku,
          image: proxyMagentoImage(product.media_gallery?.[0]?.url || product.small_image?.url),
          description:
            product.short_description?.html?.replace(/<[^>]*>/g, "") || "",
          brand: brandLabel
            ? { "@type": "Brand", name: brandLabel }
            : undefined,
          offers: {
            "@type": "Offer",
            url: `${SITE_URL}/product/${product.url_key}`,
            priceCurrency: priceData?.final_price?.currency || "USD",
            price: finalPrice,
            availability: inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            seller: {
              "@type": "Organization",
              name: "Technimark",
            },
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbItems.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.name,
            item: item.url,
          })),
        }}
      />
      {/* ─── HERO BANNER ─── */}
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(200,16,46,0.06)_0%,transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-7">
          {/* Breadcrumbs */}
          <nav className="mb-4 text-[13px] text-gray-500">
            <Link href="/" className="transition hover:text-red-500">
              Home
            </Link>
            {bestCategory?.breadcrumbs?.map(
              (crumb: {
                category_uid: string;
                category_name: string;
                category_url_path: string;
              }) => (
                <span key={crumb.category_uid}>
                  <span className="mx-2 opacity-40">&rsaquo;</span>
                  <Link
                    href={`/category/${crumb.category_url_path}`}
                    className="transition hover:text-red-500"
                  >
                    {crumb.category_name}
                  </Link>
                </span>
              ),
            )}
            {bestCategory && (
              <>
                <span className="mx-2 opacity-40">&rsaquo;</span>
                <Link
                  href={`/category/${bestCategory.url_path}`}
                  className="transition hover:text-red-500"
                >
                  {bestCategory.name}
                </Link>
              </>
            )}
            <span className="mx-2 opacity-40">&rsaquo;</span>
            <span className="text-gray-400">{product.name}</span>
          </nav>

          {/* Brand tag */}
          {brandLabel && (
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-[1.2px] text-red-500">
              {brandLabel}
            </p>
          )}

          {/* Product title */}
          <h1 className="max-w-3xl text-2xl font-bold leading-tight text-white md:text-[30px]">
            {product.name}
          </h1>

          {/* SKU line */}
          <div className="mt-2.5 flex items-center gap-4 font-mono text-[13px] text-gray-500">
            <span>SKU: {product.sku}</span>
            {mfgSku && (
              <>
                <span className="text-gray-700">|</span>
                <span>MFG SKU: {mfgSku}</span>
              </>
            )}
          </div>

          {/* Star rating (if reviews exist) */}
          {reviewCount > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-0.5" aria-label={`${(ratingSummary / 20).toFixed(1)} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const starValue = (i + 1) * 20;
                  const filled = ratingSummary >= starValue;
                  const partial = !filled && ratingSummary > starValue - 20;
                  return (
                    <svg
                      key={i}
                      className={`h-4 w-4 ${filled ? "text-yellow-400" : partial ? "text-yellow-400" : "text-gray-600"}`}
                      fill={filled ? "currentColor" : partial ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                    >
                      {partial ? (
                        <>
                          <defs>
                            <clipPath id={`star-clip-${i}`}>
                              <rect x="0" y="0" width={`${((ratingSummary - (starValue - 20)) / 20) * 100}%`} height="100%" />
                            </clipPath>
                          </defs>
                          <path
                            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                            fill="none"
                            stroke="currentColor"
                            className="text-gray-600"
                          />
                          <path
                            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                            fill="currentColor"
                            clipPath={`url(#star-clip-${i})`}
                          />
                        </>
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                        />
                      )}
                    </svg>
                  );
                })}
              </div>
              <span className="text-sm font-medium text-gray-400">
                {(ratingSummary / 20).toFixed(1)}
              </span>
              <a
                href="#reviews"
                className="text-sm text-gray-500 transition hover:text-white"
              >
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="mx-auto max-w-7xl px-4 py-9">
        <div className="grid gap-12 md:grid-cols-2">
          {/* LEFT: Gallery */}
          <ProductGallery
            images={product.media_gallery || []}
            hasDiscount={hasDiscount}
            discountPercent={discount?.percent_off}
          />

          {/* RIGHT: Product Info */}
          <div className="flex flex-col">
            {/* Customer pricing banner — hidden when logged in */}
            <ContractPricingBanner />

            {/* ─── PRICE BLOCK ─── */}
            <div
              className={`mb-4 rounded-xl border p-5 shadow-sm ${
                hasDiscount
                  ? "border-red-200/60 bg-gradient-to-br from-white to-red-50/30"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-3">
                    {hasDiscount && (
                      <span className="text-lg text-gray-400 line-through">
                        ${formatPrice(regularPrice)}
                      </span>
                    )}
                    <span
                      className={`text-4xl font-bold tracking-tight ${
                        hasDiscount ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      ${formatPrice(finalPrice)}
                    </span>
                    {hasDiscount && (
                      <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
                        SAVE {Math.round(discount.percent_off)}%
                      </span>
                    )}
                  </div>
                  {hasDiscount && (
                    <p className="mt-1 text-sm font-medium text-red-600">
                      You save ${formatPrice(regularPrice - finalPrice)}
                    </p>
                  )}
                </div>

                {/* Stock badge */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                    isOutOfStock
                      ? "border-red-200/60 bg-red-50/50 text-red-700"
                      : isAvailableToOrder
                        ? "border-amber-200/60 bg-amber-50/50 text-amber-700"
                        : "border-green-200/60 bg-green-50/50 text-green-700"
                  }`}
                >
                  <span
                    className={`h-[7px] w-[7px] rounded-full ${
                      isOutOfStock
                        ? "bg-red-500"
                        : isAvailableToOrder
                          ? "bg-amber-500"
                          : "animate-pulse bg-green-500"
                    }`}
                  />
                  {isOutOfStock
                    ? "Out of Stock"
                    : isAvailableToOrder
                      ? "Available to Order"
                      : "In Stock"}
                </span>
              </div>
            </div>

            {/* Available to Order note */}
            {isAvailableToOrder && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200/60 bg-amber-50/50 px-4 py-3 text-[13px] text-amber-800">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="font-semibold">Available to Order</p>
                  <p className="text-amber-700">This item is not currently in stock but can be ordered. Delivery times may vary — contact us at <a href={`tel:${process.env.NEXT_PUBLIC_COMPANY_PHONE || "847-639-4700"}`} className="font-semibold underline">{process.env.NEXT_PUBLIC_COMPANY_PHONE || "847-639-4700"}</a> for an estimated lead time.</p>
                </div>
              </div>
            )}

            {/* ─── TIER PRICING ─── */}
            <TierPricing
              tiers={product.price_tiers || []}
              basePrice={finalPrice}
            />

            {/* ─── CART ACTIONS ─── */}
            <div className="mb-3">
              {product.configurable_options?.length > 0 ? (
                <ConfigurableAddToCart
                  product={product}
                  basePrice={finalPrice}
                  baseCurrency={priceData?.final_price?.currency || "USD"}
                />
              ) : (
                <AddToCart product={product} />
              )}
            </div>

            {/* Request Bulk Quote */}
            <BulkQuoteModal productName={product.name} sku={product.sku} mfgSku={mfgSku ?? undefined} />

            {/* Tertiary actions */}
            <div className="mb-6 flex flex-wrap gap-5 text-[13px]">
              {sdsUrl && (
                <a
                  href={sdsProxy(sdsUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-red-600 transition hover:text-red-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  SDS Download
                </a>
              )}
              <button className="flex items-center gap-1 text-gray-400 transition hover:text-gray-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
                Wishlist
              </button>
              <CompareButton
                product={{
                  uid: product.uid,
                  url_key: product.url_key,
                  name: product.name,
                  sku: product.sku,
                  image_url: proxyMagentoImage(product.small_image?.url) || "",
                  price: finalPrice,
                  currency: priceData?.final_price?.currency || "USD",
                  stock_status: product.stock_status,
                  manufacturer: brandLabel,
                }}
              />
            </div>

            {/* ─── SHIPPING ESTIMATOR ─── */}
            <ShippingEstimator price={finalPrice} freeShippingThreshold={freeShippingThreshold} />

            {/* ─── PRODUCT INFO CHIPS ─── */}
            {(() => {
              const chips: { label: string; className: string; style?: React.CSSProperties }[] = [];

              // Manufacturer chip
              if (brandLabel) {
                chips.push({
                  label: brandLabel,
                  className: "border-red-200/60 bg-red-50/50 text-red-700",
                });
              }

              // SKU chip
              chips.push({
                label: `SKU: ${product.sku}`,
                className: "border-gray-200 bg-gray-50 text-gray-700",
              });

              // Color chip — only if the product has a color attribute
              // Check specs for a "color" attribute, and use the swatch color if available
              const colorSpec = specs.find((s) => s.code === "color");
              if (colorSpec?.value) {
                // Try to get the hex color from configurable_options swatch_data
                let swatchHex: string | null = null;
                const colorOption = product.configurable_options?.find(
                  (opt: any) => opt.attribute_code === "color",
                );
                if (colorOption?.values) {
                  // Find the swatch matching this color label
                  const match = colorOption.values.find(
                    (v: any) => v.label === colorSpec.value,
                  );
                  if (match?.swatch_data?.value && /^#[0-9a-fA-F]{6}$/i.test(match.swatch_data.value)) {
                    swatchHex = match.swatch_data.value;
                  }
                }

                if (swatchHex) {
                  // Use the actual swatch color for the chip
                  chips.push({
                    label: colorSpec.value,
                    className: "border text-white font-semibold",
                    style: { backgroundColor: swatchHex, borderColor: swatchHex },
                  });
                } else {
                  chips.push({
                    label: colorSpec.value,
                    className: "border-blue-200/60 bg-blue-50/50 text-blue-700",
                  });
                }
              }

              // Also support a generic product_highlights attribute (comma-separated)
              const highlights = specs.find((s) => s.code === "product_highlights");
              if (highlights?.value) {
                highlights.value.split(",").forEach((h) => {
                  const trimmed = h.trim();
                  if (trimmed) {
                    chips.push({
                      label: trimmed,
                      className: "border-gray-200 bg-gray-50 text-gray-700",
                    });
                  }
                });
              }

              if (chips.length === 0) return null;

              return (
                <div className="mb-4 flex flex-wrap gap-2">
                  {chips.map((chip, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.5px] ${chip.className}`}
                      style={chip.style}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              );
            })()}

            {/* ─── QUICK SPECS ─── */}
            <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 bg-gray-900 px-5 py-3">
                <span className="h-3.5 w-[3px] rounded-sm bg-red-600" />
                <h3 className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
                  Key Specifications
                </h3>
              </div>
              <div className="divide-y divide-gray-100 bg-white text-sm">
                {/* Show top specs from REST API, then always show SKU + availability */}
                {specs.slice(0, 6).map((spec, i) => (
                  <div key={spec.code} className={`flex justify-between px-5 py-3 ${i % 2 === 1 ? "bg-gray-50/60" : ""}`}>
                    <span className="text-gray-400">{spec.label}</span>
                    <span className="font-medium text-gray-900 text-right">{spec.value}</span>
                  </div>
                ))}
                {specs.length === 0 && brandLabel && (
                  <div className="flex justify-between px-5 py-3">
                    <span className="text-gray-400">Manufacturer</span>
                    <span className="font-medium text-gray-900">{brandLabel}</span>
                  </div>
                )}
                <div className={`flex justify-between px-5 py-3 ${specs.length % 2 === 1 ? "bg-gray-50/60" : ""}`}>
                  <span className="text-gray-400">SKU</span>
                  <span className="font-medium text-gray-900">{product.sku}</span>
                </div>
                <div className={`flex justify-between px-5 py-3 ${specs.length % 2 === 0 ? "bg-gray-50/60" : ""}`}>
                  <span className="text-gray-400">Availability</span>
                  <span className={`font-medium ${
                    isOutOfStock ? "text-red-600" : isAvailableToOrder ? "text-amber-600" : "text-green-600"
                  }`}>
                    {isOutOfStock ? "Out of Stock" : isAvailableToOrder ? "Available to Order" : "In Stock"}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── CALLOUT STRIP ─── */}
            <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-gray-900 shadow-sm">
              <div className="border-r border-gray-700/50 px-3 py-4 text-center transition hover:bg-gray-800/50">
                <span className="mb-1 block text-lg">
                  <svg className="mx-auto h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2-1 2 1 2-1 2 1 2-1zm0 0h6a1 1 0 011 1v3a1 1 0 01-1 1h-1M6 20a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </span>
                <span className="block text-[13px] font-semibold text-white">Same-Day Ship</span>
                <span className="text-[11px] text-gray-500">Order by 2pm CST</span>
              </div>
              <div className="border-r border-gray-700/50 px-3 py-4 text-center transition hover:bg-gray-800/50">
                <span className="mb-1 block text-lg">
                  <svg className="mx-auto h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
                <span className="block text-[13px] font-semibold text-white">Expert Support</span>
                <span className="text-[11px] text-gray-500">{process.env.NEXT_PUBLIC_COMPANY_PHONE || "847-639-4700"}</span>
              </div>
              <div className="px-3 py-4 text-center transition hover:bg-gray-800/50">
                <span className="mb-1 block text-lg">
                  <svg className="mx-auto h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </span>
                <span className="block text-[13px] font-semibold text-white">Veteran Owned</span>
                <span className="text-[11px] text-gray-500">Since 1994</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── TABS ─── */}
        {tabs.length > 0 && (
          <div className="mt-12">
            <ProductTabs tabs={tabs} />
          </div>
        )}

        {/* ─── YOU MAY ALSO LIKE ─── */}
        <div className="mt-12">
          <YouMayAlsoLike
            relatedProducts={product.related_products || []}
            categoryProducts={categoryProducts}
            currentUrlKey={product.url_key}
            brandLabel={brandLabel}
          />
        </div>

        {/* Track this product view */}
        <RecentlyViewedTracker
          product={{
            url_key: product.url_key,
            name: product.name,
            sku: product.sku,
            image_url: proxyMagentoImage(product.small_image?.url) || "",
            price: finalPrice,
            currency: priceData?.final_price?.currency || "USD",
            manufacturer: brandLabel,
            category_uid: bestCategory?.uid || null,
          }}
        />

        <div className="h-16" />
      </div>

      {/* ─── STICKY BAR ─── */}
      <StickyBar
        name={product.name}
        sku={product.sku}
        price={finalPrice}
        stockStatus={product.stock_status}
      />
    </div>
  );
}
