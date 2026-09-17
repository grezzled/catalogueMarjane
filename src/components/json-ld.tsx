interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbListJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cataloguemarjane.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface ProductOfferJsonLd {
  salePrice: number | null;
  catalogueSlug: string;
  startDate: string;
  endDate: string;
}

export interface ProductReviewJsonLd {
  author: string;
  rating: number;
  title: string | null;
  content: string;
  createdAt: string;
}

export function ProductJsonLd({
  name,
  slug,
  image,
  brand,
  category,
  offers,
  reviewSummary,
  reviews,
}: {
  name: string;
  slug: string;
  image: string | null;
  brand: string | null;
  category: string;
  offers: ProductOfferJsonLd[];
  reviewSummary?: { count: number; average: number | null } | null;
  reviews?: ProductReviewJsonLd[];
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cataloguemarjane.com";
  const now = new Date();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(image ? { image: image.startsWith("http") ? image : `${baseUrl}${image}` } : {}),
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    category,
    url: `${baseUrl}/produit/${slug}`,
    offers: offers
      .filter((o) => o.salePrice != null)
      .map((o) => ({
        "@type": "Offer",
        price: o.salePrice,
        priceCurrency: "MAD",
        availability:
          new Date(o.startDate) <= now && new Date(o.endDate) >= now
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        url: `${baseUrl}/catalogue-marjane/${o.catalogueSlug}`,
      })),
    ...(reviewSummary && reviewSummary.count > 0 && reviewSummary.average != null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewSummary.average.toFixed(1),
            reviewCount: reviewSummary.count,
          },
        }
      : {}),
    ...((reviews ?? []).length > 0
      ? {
          review: (reviews ?? []).slice(0, 10).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            datePublished: r.createdAt.slice(0, 10),
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            ...(r.title ? { name: r.title } : {}),
            reviewBody: r.content,
          })),
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
