import assert from "node:assert/strict";
import test from "node:test";
import { OpenAIProviderHealthError, verifyOpenAIProvider } from "../src/lib/openai-provider-health.ts";

test("validates a credential and returns only compatible research models", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ data: [{ id: "gpt-5-mini" }, { id: "dall-e-3" }] }));
  assert.deepEqual(await verifyOpenAIProvider("fixture-key"), ["gpt-5-mini"]);
});

test("rejects unauthorized credentials without accepting curated fallbacks", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "invalid" }, { status: 401 }));
  await assert.rejects(verifyOpenAIProvider("invalid-key"), error => error instanceof OpenAIProviderHealthError && error.status === 400 && /not changed/.test(error.message));
});

test("rejects projects with no compatible Responses model", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ data: [{ id: "dall-e-3" }] }));
  await assert.rejects(verifyOpenAIProvider("fixture-key"), /no compatible Responses model/);
});
