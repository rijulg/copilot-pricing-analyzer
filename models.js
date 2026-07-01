// Pricing per 1,000,000 tokens. Source: GitHub Copilot models & pricing docs.
// https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing
// cacheWrite applies to Anthropic only (0 elsewhere). cached = cached input read.
// Auto-generated daily by scripts/update-models.py — do not edit by hand.
const MODELS = [
  // Anthropic
  { id: "haiku-4.5", name: "Claude Haiku 4.5", provider: "Anthropic", tier: "Versatile", input: 1.00, cached: 0.10, cacheWrite: 1.25, output: 5.00 },
  { id: "sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", tier: "Versatile", input: 3.00, cached: 0.30, cacheWrite: 3.75, output: 15.00 },
  { id: "sonnet-4.5", name: "Claude Sonnet 4.5", provider: "Anthropic", tier: "Versatile", input: 3.00, cached: 0.30, cacheWrite: 3.75, output: 15.00 },
  { id: "sonnet-4.6", name: "Claude Sonnet 4.6", provider: "Anthropic", tier: "Versatile", input: 3.00, cached: 0.30, cacheWrite: 3.75, output: 15.00 },
  { id: "opus-4.5", name: "Claude Opus 4.5", provider: "Anthropic", tier: "Powerful", input: 5.00, cached: 0.50, cacheWrite: 6.25, output: 25.00 },
  { id: "opus-4.6", name: "Claude Opus 4.6", provider: "Anthropic", tier: "Powerful", input: 5.00, cached: 0.50, cacheWrite: 6.25, output: 25.00 },
  { id: "opus-4.7", name: "Claude Opus 4.7", provider: "Anthropic", tier: "Powerful", input: 5.00, cached: 0.50, cacheWrite: 6.25, output: 25.00 },
  { id: "opus-4.8", name: "Claude Opus 4.8", provider: "Anthropic", tier: "Powerful", input: 5.00, cached: 0.50, cacheWrite: 6.25, output: 25.00 },
  { id: "sonnet-5[^sonnet-5-promo]", name: "Claude Sonnet 5[^sonnet-5-promo]", provider: "Anthropic", tier: "Versatile", input: 2.00, cached: 0.20, cacheWrite: 2.50, output: 10.00 },
  { id: "opus-4.8-(fast-mode)-(preview)", name: "Claude Opus 4.8 (fast mode) (preview)", provider: "Anthropic", tier: "Powerful", input: 10.00, cached: 1.00, cacheWrite: 12.50, output: 50.00 },
  { id: "fable-5", name: "Claude Fable 5", provider: "Anthropic", tier: "Powerful", input: 10.00, cached: 1.00, cacheWrite: 12.50, output: 50.00 },
  // OpenAI
  { id: "gpt-5-mini", name: "GPT-5 mini", provider: "OpenAI", tier: "Lightweight", input: 0.25, cached: 0.025, cacheWrite: 0, output: 2.00 },
  { id: "gpt-5.3-codex", name: "GPT-5.3-Codex", provider: "OpenAI", tier: "Powerful", input: 1.75, cached: 0.175, cacheWrite: 0, output: 14.00 },
  { id: "gpt-5.4", name: "GPT-5.4 (≤272K)", provider: "OpenAI", tier: "Versatile", input: 2.50, cached: 0.25, cacheWrite: 0, output: 15.00 },
  { id: "gpt-5.4-long", name: "GPT-5.4 (>272K)", provider: "OpenAI", tier: "Versatile", input: 5.00, cached: 0.50, cacheWrite: 0, output: 22.50 },
  { id: "gpt-5.4-mini", name: "GPT-5.4 mini", provider: "OpenAI", tier: "Lightweight", input: 0.75, cached: 0.075, cacheWrite: 0, output: 4.50 },
  { id: "gpt-5.4-nano", name: "GPT-5.4 nano", provider: "OpenAI", tier: "Lightweight", input: 0.20, cached: 0.02, cacheWrite: 0, output: 1.25 },
  { id: "gpt-5.5", name: "GPT-5.5 (≤272K)", provider: "OpenAI", tier: "Powerful", input: 5.00, cached: 0.50, cacheWrite: 0, output: 30.00 },
  { id: "gpt-5.5-long", name: "GPT-5.5 (>272K)", provider: "OpenAI", tier: "Powerful", input: 10.00, cached: 1.00, cacheWrite: 0, output: 45.00 },
  // Google
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", tier: "Powerful", input: 1.25, cached: 0.125, cacheWrite: 0, output: 10.00 },
  { id: "gemini-3-flash", name: "Gemini 3 Flash", provider: "Google", tier: "Lightweight", input: 0.50, cached: 0.05, cacheWrite: 0, output: 3.00 },
  { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro (≤200K)", provider: "Google", tier: "Powerful", input: 2.00, cached: 0.20, cacheWrite: 0, output: 12.00 },
  { id: "gemini-3.1-pro-long", name: "Gemini 3.1 Pro (>200K)", provider: "Google", tier: "Powerful", input: 4.00, cached: 0.40, cacheWrite: 0, output: 18.00 },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "Google", tier: "Lightweight", input: 1.50, cached: 0.15, cacheWrite: 0, output: 9.00 },
  // Fine-tuned (GitHub)
  { id: "raptor-mini", name: "Raptor mini", provider: "GitHub", tier: "Versatile", input: 0.25, cached: 0.025, cacheWrite: 0, output: 2.00 },
  // Microsoft
  { id: "mai-code-1-flash", name: "MAI-Code-1-Flash", provider: "Microsoft", tier: "Lightweight", input: 0.75, cached: 0.075, cacheWrite: 0, output: 4.50 },
];

const COLORS = ["#2f81f7", "#3fb950", "#d29922", "#f85149", "#a371f7", "#39c5cf", "#db61a2", "#e3b341"];
