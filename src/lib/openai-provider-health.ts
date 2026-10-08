import { isSupportedResearchModel } from "./openai-model-catalog.ts";

export class OpenAIProviderHealthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAIProviderHealthError";
    this.status = status;
  }
}

export async function verifyOpenAIProvider(apiKey: string) {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(12000) });
  } catch {
    throw new OpenAIProviderHealthError("OpenAI could not be reached. The existing credential was not changed.", 503);
  }
  if (response.status === 401 || response.status === 403) throw new OpenAIProviderHealthError("OpenAI rejected this API key or its project permissions. The existing credential was not changed.", 400);
  if (!response.ok) throw new OpenAIProviderHealthError(`OpenAI validation is temporarily unavailable (${response.status}). The existing credential was not changed.`, 503);
  const body = await response.json() as { data?: { id?: string }[] };
  const models = [...new Set((body.data ?? []).map(item => item.id ?? "").filter(isSupportedResearchModel))].sort();
  if (!models.length) throw new OpenAIProviderHealthError("This OpenAI project has no compatible Responses model. The existing credential was not changed.", 400);
  return models;
}
