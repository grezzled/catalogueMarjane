import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Every AI call must go through the worker queue: API routes may only
    // enqueue jobs (services/jobs.ts), never touch AI providers or the
    // AI-running services directly.
    files: ["src/app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/services/processing", "@/services/articles", "@/services/page-analysis"],
              message:
                "AI work must go through the AIJob queue (services/jobs.ts) — never call AI services directly from API routes.",
            },
            {
              group: ["@/ai", "@/ai/*"],
              message:
                "AI providers must only be used inside services/, dispatched by the worker — never from API routes.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
