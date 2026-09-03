// Minimal OpenAI-compatible chat client with tool calling.
// Works with OpenAI, DeepSeek, Qwen, GLM, Kimi, Ollama, LM Studio, any /v1 endpoint.
const BASE = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const KEY = process.env.LLM_API_KEY || '';
const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

async function chat(messages, tools, onDelta) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages, tools: tools?.length ? tools : undefined })
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message;
}

module.exports = { chat, MODEL };
