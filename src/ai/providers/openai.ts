import OpenAI from "openai";
import type { AIProvider } from "../index";

export class OpenAIProvider implements AIProvider {
  name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, baseUrl?: string, model?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      baseURL: baseUrl || process.env.OPENAI_BASE_URL,
    });
    this.model = model || "gpt-4o";
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
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
    const response = await this.client.chat.completions.create({
      model: model || this.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    return response.choices[0]?.message?.content || "";
  }

  async generateText(prompt: string, model?: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: model || this.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
    });

    return response.choices[0]?.message?.content || "";
  }
}
