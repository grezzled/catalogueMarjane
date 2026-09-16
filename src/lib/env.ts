import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AI_PROVIDER: z.enum(["gemini", "ollama", "openai"]).default("gemini"),
  AI_MODEL: z.string().default("gemini-2.0-flash"),
  GEMINI_API_KEY: z.string().optional(),
  OLLAMA_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llava:latest"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-4o"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Catalogue Marjane"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50),
  UPLOAD_DIR: z.string().default("./uploads"),
  UPLOAD_DIR_ORIGINAL: z.string().default("./uploads-original"),
  DATA_DIR: z.string().default("./data"),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_SECRET: z.string().min(32, "ADMIN_SECRET must be at least 32 chars").optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten());
    return envSchema.parse({});
  }
  return parsed.data;
}

export const env = loadEnv();
