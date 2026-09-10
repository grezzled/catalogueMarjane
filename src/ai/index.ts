export interface AIProvider {
  name: string;
  analyzeImage(
    imageBase64: string,
    prompt: string,
    model?: string
  ): Promise<string>;
  generateText(prompt: string, model?: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

export class AIProviderFactory {
  static async create(
    provider: string,
    config: Record<string, string | undefined>
  ): Promise<AIProvider> {
    switch (provider) {
      case "gemini": {
        const { GeminiProvider } = await import("./providers/gemini");
        return new GeminiProvider(config.GEMINI_API_KEY, config.AI_MODEL);
      }
      case "ollama": {
        const { OllamaProvider } = await import("./providers/ollama");
        return new OllamaProvider(
          config.OLLAMA_URL || "http://localhost:11434",
          config.OLLAMA_MODEL || "llava:latest"
        );
      }
      case "openai": {
        const { OpenAIProvider } = await import("./providers/openai");
        return new OpenAIProvider(
          config.OPENAI_API_KEY,
          config.OPENAI_BASE_URL,
          config.OPENAI_MODEL
        );
      }
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }
}
