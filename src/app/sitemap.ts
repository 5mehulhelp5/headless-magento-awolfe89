import type { MetadataRoute } from "next";
import { getMagentoHttpAuthHeaders } from "@/lib/magento/httpAuth";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://technimark.com";
const MAGENTO_GRAPHQL_URL = process.env.MAGENTO_GRAPHQL_URL!;

async function gqlFetch(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(MAGENTO_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getMagentoHttpAuthHeaders() },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  return json.data;
}

async function getAllProducts(): Promise<
  { url_key: string; updated_at?: string }[]
> {
  const items: { url_key: string; updated_at?: string }[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await gqlFetch(
      `query SitemapProducts($page: Int!) {
        products(filter: {}, pageSize: 100, currentPage: $page, sort: { position: ASC }) {
          page_info { total_pages }
          items { url_key }
        }
      }`,
      { page },
    );
    const result = data?.products;
    if (!result?.items) break;
    items.push(...result.items);
    totalPages = result.page_info?.total_pages || 1;
    page++;
  }
  return items;
}

async function getAllCategories(): Promise<{ url_path: string }[]> {
  const data = await gqlFetch(`
    query SitemapCategories {
      categories(filters: { parent_id: { eq: "2" } }) {
        items {
          url_path
          children {
            url_path
            children {
              url_path
            }
          }
        }
      }
    }
  `);
  const items: { url_path: string }[] = [];
  function flatten(cats: any[]) {
    for (const cat of cats) {
      if (cat.url_path) items.push({ url_path: cat.url_path });
      if (cat.children) flatten(cat.children);
    }
  }
  flatten(data?.categories?.items || []);
  return items;
}

async function getAllBlogPosts(): Promise<
  { identifier: string; publish_time?: string }[]
> {
  const items: { identifier: string; publish_time?: string }[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await gqlFetch(
      `query SitemapBlogPosts($page: Int!) {
        blogPosts(pageSize: 100, currentPage: $page) {
          total_pages
          items { identifier publish_time }
        }
      }`,
      { page },
    );
    const result = data?.blogPosts;
    if (!result?.items) break;
    items.push(...result.items);
    totalPages = result.total_pages || 1;
    page++;
  }
  return items;
}

async function getBlogCategories(): Promise<{ identifier: string }[]> {
  const data = await gqlFetch(`
    query SitemapBlogCategories {
      blogCategories {
        items { identifier }
      }
    }
  `);
  return data?.blogCategories?.items || [];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, blogPosts, blogCategories] =
    await Promise.allSettled([
      getAllProducts(),
      getAllCategories(),
      getAllBlogPosts(),
      getBlogCategories(),
    ]);

  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  entries.push(
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}/blog`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/brands`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  );

  // Products
  if (products.status === "fulfilled") {
    for (const p of products.value) {
      entries.push({
        url: `${SITE_URL}/product/${p.url_key}`,
        changeFrequency: "weekly",
        priority: 0.9,
      });
    }
  }

  // Categories
  if (categories.status === "fulfilled") {
    for (const c of categories.value) {
      entries.push({
        url: `${SITE_URL}/category/${c.url_path}`,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // Blog posts
  if (blogPosts.status === "fulfilled") {
    for (const bp of blogPosts.value) {
      entries.push({
        url: `${SITE_URL}/blog/${bp.identifier}`,
        changeFrequency: "monthly",
        priority: 0.6,
        ...(bp.publish_time && {
          lastModified: new Date(bp.publish_time),
        }),
      });
    }
  }

  // Blog categories
  if (blogCategories.status === "fulfilled") {
    for (const bc of blogCategories.value) {
      entries.push({
        url: `${SITE_URL}/blog/category/${bc.identifier}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
