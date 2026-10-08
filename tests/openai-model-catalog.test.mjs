import assert from "node:assert/strict";
import { test } from "node:test";
import { describeOpenAIModel, isSupportedResearchModel } from "../src/lib/openai-model-catalog.ts";

test("keeps general Responses models and excludes specialized or snapshot models", () => {
  for (const model of ["gpt-5.6-terra", "gpt-5.6-luna", "gpt-5-mini", "gpt-4.1-mini", "o3", "o4-mini"]) assert.equal(isSupportedResearchModel(model), true, model);
  for (const model of ["gpt-5.6-terra-2026-09-30", "gpt-realtime", "gpt-4o-mini-transcribe", "gpt-image-1", "text-embedding-3-small", "ft:gpt-4.1-mini:enrivea:scanner:1"]) assert.equal(isSupportedResearchModel(model), false, model);
});

test("describes project-specific model aliases without failing the selector", () => {
  assert.deepEqual(describeOpenAIModel("o4-mini"), { id: "o4-mini", label: "O4 Mini", description: "Available to the configured OpenAI API project." });
});
