import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider } from "../index";

export interface GeminiOptions {
  /**
   * Explicit opt-in for the billable key. Defaults to false.
   * The paid key is NEVER touched unless this is exactly `true`.
   */
  usePaidKey?: boolean;
  /** Overrides process.env.GEMINI_PAID_KEY (tests only). */
  paidKey?: string;
}

export class GeminiProvider implements AIProvider {
  name = "gemini";
  private keys: string[];
  private paidKey: string | null;
  private model: string;
  /** True only when the billable key is armed for this instance. */
  readonly usingPaidKey: boolean;

  constructor(apiKey?: string, model?: string, opts?: GeminiOptions) {
    if (!apiKey) throw new Error("GEMINI_API_KEY is required");
    this.keys = apiKey.split(",").map((k) => k.trim()).filter(Boolean);
    if (this.keys.length === 0) throw new Error("GEMINI_API_KEY is required");

    // SAFETY: default FREE. Paid key is wired only on explicit opt-in.
    const optedIn = opts?.usePaidKey === true;
    const candidate = (opts?.paidKey ?? process.env.GEMINI_PAID_KEY ?? "").trim();
    this.paidKey = optedIn && candidate.length > 0 ? candidate : null;
    this.usingPaidKey = this.paidKey !== null;
    this.model = model || "gemini-2.0-flash";
  }

  /** Key labels only — never the key material. Safe to log. */
  private attemptKeys(): { key: string; label: string; paid: boolean }[] {
    const free = this.keys.map((key, i) => ({ key, label: `free key ${i}`, paid: false }));
    if (this.paidKey) {
      return [{ key: this.paidKey, label: "PAID key", paid: true }, ...free];
    }
    return free;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const first = this.paidKey ?? this.keys[0];
      if (!first) return false;
      const genAI = new GoogleGenerativeAI(first);
      const model = genAI.getGenerativeModel({ model: this.model });
      await model.generateContent("test");
      return true;
    } catch {
      return false;
    }
  }

  async analyzeImage(
    imageBase64: string,
    prompt: string,
    model?: string
  ): Promise<string> {
    const candidates = this.attemptKeys();
    if (this.usingPaidKey) {
      console.log("[Gemini] BILLABLE paid key armed — requests may incur cost.");
    }
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < candidates.length; attempt++) {
      const { key, label, paid } = candidates[attempt];
      const genAI = new GoogleGenerativeAI(key);
      const genModel = genAI.getGenerativeModel({
        model: model || this.model,
      });

      const imageParts = [
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg",
          },
        },
      ];

      try {
        const result = await genModel.generateContent([
          prompt,
          ...imageParts,
        ]);
        return result.response.text();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const msg = lastError.message;
        const isQuota = msg.includes("429") || msg.includes("quota");
        if (isQuota && attempt < candidates.length - 1) {
          console.log(`[Gemini] ${label} quota exceeded, rotating...`);
          continue;
        }
        // Paid failures fall back to free quota when available — free
        // failures never escalate to paid within one call.
        if (paid && attempt < candidates.length - 1) {
          console.log(`[Gemini] ${label} failed (${msg.slice(0, 120)}), falling back to free tier...`);
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  async generateText(prompt: string, model?: string): Promise<string> {
    const candidates = this.attemptKeys();
    if (this.usingPaidKey) {
      console.log("[Gemini] BILLABLE paid key armed — requests may incur cost.");
    }
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < candidates.length; attempt++) {
      const { key, label, paid } = candidates[attempt];
      const genAI = new GoogleGenerativeAI(key);
      const genModel = genAI.getGenerativeModel({
        model: model || this.model,
      });

      try {
        const result = await genModel.generateContent(prompt);
        return result.response.text();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const msg = lastError.message;
        const isQuota = msg.includes("429") || msg.includes("quota");
        if (isQuota && attempt < candidates.length - 1) {
          console.log(`[Gemini] ${label} quota exceeded, rotating...`);
          continue;
        }
        if (paid && attempt < candidates.length - 1) {
          console.log(`[Gemini] ${label} failed (${msg.slice(0, 120)}), falling back to free tier...`);
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }
}
