import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider } from "../index";

export class GeminiProvider implements AIProvider {
  name = "gemini";
  private keys: string[];
  private currentKeyIndex = 0;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    if (!apiKey) throw new Error("GEMINI_API_KEY is required");
    this.keys = apiKey.split(",").map((k) => k.trim()).filter(Boolean);
    this.model = model || "gemini-2.0-flash";
  }

  private getKey(): string {
    return this.keys[this.currentKeyIndex];
  }

  private rotateKey(): string {
    if (this.keys.length > 1) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
      console.log(`Rotated to Gemini API key index ${this.currentKeyIndex}`);
    }
    return this.getKey();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const genAI = new GoogleGenerativeAI(this.getKey());
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
    const lastKeyIndex = this.currentKeyIndex;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const key = attempt === 0 ? this.getKey() : this.rotateKey();
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
      } catch (error: any) {
        lastError = error;
        const isQuota = error?.message?.includes("429") || error?.message?.includes("quota");
        if (isQuota && attempt < this.keys.length - 1) {
          console.log(`Gemini key ${attempt} quota exceeded, rotating...`);
          continue;
        }
        throw error;
      }
    }

    this.currentKeyIndex = lastKeyIndex;
    throw lastError;
  }

  async generateText(prompt: string, model?: string): Promise<string> {
    const lastKeyIndex = this.currentKeyIndex;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const key = attempt === 0 ? this.getKey() : this.rotateKey();
      const genAI = new GoogleGenerativeAI(key);
      const genModel = genAI.getGenerativeModel({
        model: model || this.model,
      });

      try {
        const result = await genModel.generateContent(prompt);
        return result.response.text();
      } catch (error: any) {
        lastError = error;
        const isQuota = error?.message?.includes("429") || error?.message?.includes("quota");
        if (isQuota && attempt < this.keys.length - 1) {
          console.log(`Gemini key ${attempt} quota exceeded, rotating...`);
          continue;
        }
        throw error;
      }
    }

    this.currentKeyIndex = lastKeyIndex;
    throw lastError;
  }
}