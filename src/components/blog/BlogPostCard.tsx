import Link from "next/link";
import Image from "next/image";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";

interface BlogPostCardProps {
  post: {
    identifier: string;
    title: string;
    short_filtered_content?: string;
    featured_image?: string;
    featured_list_image?: string;
    first_image?: string;
    publish_time?: string;
    author?: { title: string };
    categories?: { identifier: string; title: string }[];
  };
}

export function BlogPostCard({ post }: BlogPostCardProps) {
  const publishDate = post.publish_time
    ? new Date(post.publish_time).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // Strip HTML and decode entities from excerpt
  const excerpt = post.short_filtered_content
    ?.replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  // featured_image returns full URL from Magento; fallback to first_image
  const imageUrl = proxyMagentoImage(
    post.featured_list_image || post.featured_image || post.first_image,
  );

  return (
    <Link
      href={`/blog/${post.identifier}`}
      className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-md"
    >
      {/* Featured image */}
      {imageUrl ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
          <Image
            src={imageUrl}
            alt={post.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-gray-100">
          <svg
            className="h-10 w-10 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
            />
          </svg>
        </div>
      )}

      <div className="p-5">
        {/* Category badges */}
        {post.categories && post.categories.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {post.categories.slice(0, 2).map((cat) => (
              <span
                key={cat.identifier}
                className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-600"
              >
                {cat.title}
              </span>
            ))}
          </div>
        )}

        <h3 className="line-clamp-2 text-base font-bold text-gray-900 transition group-hover:text-red-600">
          {post.title}
        </h3>

        {excerpt && (
          <p className="mt-2 line-clamp-3 text-sm text-gray-500">{excerpt}</p>
        )}

        {/* Meta */}
        <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
          {publishDate && <span>{publishDate}</span>}
          {post.author?.title && (
            <>
              <span className="text-gray-300">|</span>
              <span>{post.author.title}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
