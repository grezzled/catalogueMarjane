import { z } from "zod";

export const CatalogueTypeSchema = z.enum([
  "weekly",
  "monthly",
  "seasonal",
  "rentree",
  "ramadan",
  "eid",
  "technology",
  "home",
  "food",
  "supermarket",
  "special_promotion",
  "other",
]);

export const CatalogueStatusSchema = z.enum([
  "UPLOADED",
  "PROCESSING",
  "EXTRACTING",
  "ANALYZING",
  "STRUCTURING",
  "GENERATING",
  "REVIEW",
  "PUBLISHED",
  "FAILED",
  "ARCHIVED",
]);

export const ProductSchema = z.object({
  name: z.string(),
  brand: z.string().nullable().optional(),
  category: z.string(),
  subcategory: z.string().nullable().optional(),
  originalPrice: z.number().nullable().optional(),
  salePrice: z.number().nullable().optional(),
  currency: z.string().default("MAD"),
  discountAmount: z.number().nullable().optional(),
  discountPercentage: z.number().nullable().optional(),
  installment: z
    .object({
      amount: z.number(),
      months: z.number(),
    })
    .nullable()
    .optional(),
  features: z.array(z.string()).default([]),
  availabilityText: z.string().nullable().optional(),
  confidence: z.number().default(0.5),
  boundingBox: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .nullable()
    .optional(),
});

export const PageAnalysisSchema = z.object({
  pageNumber: z.number(),
  pageType: z.enum([
    "product_offers",
    "editorial",
    "cover",
    "back_cover",
    "category_overview",
    "mixed",
    "unknown",
  ]),
  category: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  products: z.array(ProductSchema).default([]),
  summary: z.string().nullable().optional(),
  confidence: z.number().default(0.5),
});

export const ArticleGenerationSchema = z.object({
  title: z.string(),
  slug: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  excerpt: z.string(),
  content: z.string(),
  primaryKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  searchIntent: z.string(),
  category: z.string(),
  faq: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    })
  ),
  relatedArticles: z.array(z.string()),
  relatedCategories: z.array(z.string()),
});

export const SEOQualitySchema = z.object({
  seoScore: z.number().min(0).max(100),
  contentQualityScore: z.number().min(0).max(100),
  originalityScore: z.number().min(0).max(100),
  factualAccuracyScore: z.number().min(0).max(100),
  searchIntentScore: z.number().min(0).max(100),
  thinContentRisk: z.number().min(0).max(100),
  keywordStuffingRisk: z.number().min(0).max(100),
  recommendation: z.enum(["publish", "review", "regenerate", "reject"]),
});

export type CatalogueType = z.infer<typeof CatalogueTypeSchema>;
export type CatalogueStatus = z.infer<typeof CatalogueStatusSchema>;
export type ProductData = z.infer<typeof ProductSchema>;
export type PageAnalysis = z.infer<typeof PageAnalysisSchema>;
export type ArticleGeneration = z.infer<typeof ArticleGenerationSchema>;
export type SEOQuality = z.infer<typeof SEOQualitySchema>;

export interface AIProviderConfig {
  provider: "gemini" | "ollama" | "openai";
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface AIResponse {
  content: string;
  model: string;
  tokens?: number;
  duration?: number;
}

export interface PDFExtractionResult {
  text: string;
  pageNumber: number;
  pageCount: number;
}

export interface ProcessingProgress {
  catalogueId: string;
  status: string;
  processedPages: number;
  totalPages: number;
  productsFound: number;
  offersFound: number;
  articlesGenerated: number;
}
