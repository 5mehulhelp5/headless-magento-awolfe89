import { query } from "@/lib/apollo/rsc-client";
import { ROOT_CATEGORIES_QUERY } from "@/lib/graphql/queries/categories";
import { CATEGORY_PRODUCTS_QUERY } from "@/lib/graphql/queries/products";
import { STORE_CONFIG_QUERY } from "@/lib/graphql/queries/storeConfig";
import { BRANDS_QUERY } from "@/lib/graphql/queries/brands";
import { BLOG_POSTS_QUERY } from "@/lib/graphql/queries/blog";
import { ProductCard } from "@/components/product/ProductCard";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";
import Link from "next/link";
import Image from "next/image";

const PHONE = process.env.NEXT_PUBLIC_COMPANY_PHONE || "847-639-4700";

// Revalidate homepage every hour
export const revalidate = 3600;

export default async function HomePage() {
  const [categoriesResult, productsResult, storeResult, brandsResult, blogResult] =
    await Promise.allSettled([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query({ query: ROOT_CATEGORIES_QUERY }) as Promise<{ data: any }>,
      query({
        query: CATEGORY_PRODUCTS_QUERY,
        variables: {
          categoryUid: "Mg==",
          pageSize: 8,
          currentPage: 1,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as Promise<{ data: any }>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query({ query: STORE_CONFIG_QUERY }) as Promise<{ data: any }>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query({ query: BRANDS_QUERY }) as Promise<{ data: any }>,
      query({
        query: BLOG_POSTS_QUERY,
        variables: { pageSize: 3, sort: ["DESC"] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as Promise<{ data: any }>,
    ]);

  const categories =
    categoriesResult.status === "fulfilled"
      ? categoriesResult.value.data.categories?.items || []
      : [];
  const products =
    productsResult.status === "fulfilled"
      ? productsResult.value.data.products?.items || []
      : [];
  const storeName =
    storeResult.status === "fulfilled"
      ? storeResult.value.data.storeConfig?.store_name || "Technimark"
      : "Technimark";
  const brands =
    brandsResult.status === "fulfilled"
      ? (brandsResult.value.data.categories?.items?.[0]?.children || [])
          .filter((b: { product_count: number }) => b.product_count > 0)
          .sort((a: { product_count: number }, b: { product_count: number }) => b.product_count - a.product_count)
          .slice(0, 8)
      : [];
  const blogPosts =
    blogResult.status === "fulfilled"
      ? blogResult.value.data.blogPosts?.items || []
      : [];

  return (
    <div>
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] text-white">
        <div className="pointer-events-none absolute -left-[10%] -top-[40%] h-[180%] w-1/2 bg-[radial-gradient(ellipse,rgba(200,16,46,0.12)_0%,transparent_70%)]" />
        <div className="pointer-events-none absolute -bottom-[50%] -right-[10%] h-[160%] w-[45%] bg-[radial-gradient(ellipse,rgba(200,16,46,0.08)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h1 className="mb-6 text-4xl font-bold leading-tight md:text-5xl">
                Your{" "}
                <span className="text-red-500">Trusted Partner</span> in
                Electronics Assembly &amp; Soldering Supplies
              </h1>
              <p className="mb-8 text-lg text-gray-300">
                Serving manufacturers for over 30 years with premium soldering
                equipment, ESD protection, fume extraction, and PCB assembly
                consumables.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={
                    categories.length > 0
                      ? `/category/${categories[0].url_path}`
                      : "/"
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition hover:bg-red-700"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                  Browse Products
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-500 px-6 py-3 font-medium text-white transition hover:border-white hover:bg-white/10"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { number: "30+", label: "Years Experience" },
                { number: "10K+", label: "Products In Stock" },
                { number: "70+", label: "Brands Carried" },
                { number: "98%", label: "Customer Satisfaction" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg bg-white/10 p-6 text-center backdrop-blur-sm"
                >
                  <div className="mb-1 text-3xl font-bold text-red-400">
                    {stat.number}
                  </div>
                  <div className="text-sm text-gray-300">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST BAR ─── */}
      <section className="border-b border-gray-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-8 px-4 text-sm text-gray-600 md:justify-between">
          {[
            { icon: "truck", text: "Free Shipping $99+" },
            { icon: "clock", text: "Same-Day Shipping" },
            { icon: "shield", text: "Authorized Distributor" },
            { icon: "headset", text: "Expert Tech Support" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2">
              <TrustIcon type={item.icon} />
              <span className="font-medium">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── WHY TECHNIMARK ─── */}
      <section className="border-b border-gray-200 bg-gray-50 py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">
            Why {storeName}?
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-gray-500">
            Family-owned and veteran-operated since 1994, we bring decades of hands-on expertise to every order.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Veteran-Owned & Family Operated",
                desc: "Built on integrity and service since 1994. We treat every customer like family and stand behind every product we sell.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                ),
                color: "bg-red-100 text-red-600",
              },
              {
                title: "Expert Technical Support",
                desc: `Our team has real-world experience in electronics assembly and can help you choose the right products. Call us at ${PHONE}.`,
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                ),
                color: "bg-amber-100 text-amber-600",
              },
              {
                title: "Same-Day Shipping",
                desc: "Orders placed by 2 PM CST ship the same day. We stock over 10,000 items so you get what you need, when you need it.",
                icon: (
                  <>
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </>
                ),
                color: "bg-green-100 text-green-600",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ${item.color}`}>
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {item.icon}
                  </svg>
                </div>
                <h3 className="mb-2 text-base font-bold text-gray-900">{item.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SHOP BY CATEGORY ─── */}
      {categories.length > 0 && (
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
              Shop by Category
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {categories.map(
                (cat: {
                  uid: string;
                  name: string;
                  url_path: string;
                  children_count: number;
                }) => (
                  <Link
                    key={cat.uid}
                    href={`/category/${cat.url_path}`}
                    className="group flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 text-center transition hover:border-red-300 hover:shadow-md"
                  >
                    <CategoryIcon name={cat.name} className="mb-3 h-12 w-12" />
                    <h3 className="font-semibold text-gray-900 group-hover:text-red-600">
                      {cat.name}
                    </h3>
                    {Number(cat.children_count) > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        {cat.children_count} {Number(cat.children_count) === 1 ? "subcategory" : "subcategories"}
                      </p>
                    )}
                  </Link>
                ),
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── FEATURED BRANDS ─── */}
      {brands.length > 0 && (
        <section className="border-y border-gray-200 bg-gray-50 py-14">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Featured Brands
              </h2>
              <Link
                href="/brands"
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                View All Brands &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {brands.map(
                (brand: {
                  uid: string;
                  name: string;
                  url_path: string;
                  image: string | null;
                  product_count: number;
                }) => (
                  <Link
                    key={brand.uid}
                    href={`/category/${brand.url_path}`}
                    className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:border-red-300 hover:shadow-sm"
                  >
                    {brand.image ? (
                      <Image
                        src={proxyMagentoImage(brand.image)}
                        alt={brand.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded object-contain"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100 text-sm font-bold text-gray-400">
                        {brand.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-red-600">
                        {brand.name}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {brand.product_count} {brand.product_count === 1 ? "product" : "products"}
                      </p>
                    </div>
                  </Link>
                ),
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── FEATURED PRODUCTS ─── */}
      {products.length > 0 && (
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Featured Products
              </h2>
              {categories.length > 0 && (
                <Link
                  href={`/category/${categories[0].url_path}`}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  View All &rarr;
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {products.map((product: any) => (
                <ProductCard key={product.uid} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── LATEST FROM THE BLOG ─── */}
      {blogPosts.length > 0 && (
        <section className="border-t border-gray-200 bg-gray-50 py-14">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Latest from the Blog
              </h2>
              <Link
                href="/blog"
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Read More &rarr;
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {blogPosts.map((post: any) => (
                <BlogPostCard key={post.post_id || post.identifier} post={post} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── CTA BANNER ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] py-14 text-white">
        <div className="pointer-events-none absolute -left-[10%] -top-[40%] h-[180%] w-1/2 bg-[radial-gradient(ellipse,rgba(200,16,46,0.1)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">
            Need Help Choosing the Right Products?
          </h2>
          <p className="mb-8 text-lg text-gray-400">
            Our expert team has decades of experience in electronics assembly.
            We&apos;ll help you find exactly what you need.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/contact"
              className="rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition hover:bg-red-700"
            >
              Talk to an Expert
            </Link>
            <a
              href={`tel:${PHONE}`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 font-medium text-white transition hover:bg-white/10"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
              Call {PHONE}
            </a>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            Mon–Fri, 8am–5pm CST
          </p>
        </div>
      </section>
    </div>
  );
}

function TrustIcon({ type }: { type: string }) {
  const iconClass = "h-5 w-5 text-red-600";
  switch (type) {
    case "truck":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="1" y="3" width="15" height="13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="5.5" cy="18.5" r="2.5" strokeWidth="2" />
          <circle cx="18.5" cy="18.5" r="2.5" strokeWidth="2" />
        </svg>
      );
    case "clock":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "shield":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "headset":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    default:
      return null;
  }
}
