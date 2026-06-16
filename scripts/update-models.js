#!/usr/bin/env node
// Regenerates models.js from GitHub's published Copilot pricing data.
// Source of truth is the github/docs data file that drives the public pricing
// tables, so this stays in sync with the docs page without scraping HTML.
const fs = require("fs");
const path = require("path");

const DATA_URL =
  "https://raw.githubusercontent.com/github/docs/main/data/tables/copilot/models-and-pricing.yml";
const DOCS_URL =
  "https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing";
const MODELS_PATH = path.join(__dirname, "..", "models.js");

// Output grouping order. Within each group source order is preserved.
const PROVIDER_ORDER = ["anthropic", "openai", "google", "github", "microsoft", "xai"];
const PROVIDER_NAMES = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft",
  xai: "xAI",
};
const PROVIDER_COMMENTS = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  github: "Fine-tuned (GitHub)",
  microsoft: "Microsoft",
  xai: "xAI",
};

function stripQuotes(value) {
  const v = value.trim();
  if (
    (v.startsWith("'") && v.endsWith("'")) ||
    (v.startsWith('"') && v.endsWith('"'))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

// Minimal parser for this flat list-of-mappings YAML (no nested structures).
function parseEntries(yaml) {
  const entries = [];
  let current = null;
  for (const rawLine of yaml.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    let m = line.match(/^- (\w+):\s*(.*)$/);
    if (m) {
      current = {};
      entries.push(current);
      current[m[1]] = stripQuotes(m[2]);
      continue;
    }
    m = line.match(/^\s+(\w+):\s*(.*)$/);
    if (m && current) current[m[1]] = stripQuotes(m[2]);
  }
  return entries;
}

function price(value) {
  const n = String(value).replace("$", "").trim();
  if (!/^\d+(\.\d+)?$/.test(n)) throw new Error(`Unexpected price value: ${value}`);
  return n;
}

function slug(model) {
  return model
    .toLowerCase()
    .replace(/^claude\s+/, "")
    .replace(/\s+/g, "-");
}

function toModel(entry) {
  const threshold = (entry.threshold || "").trim();
  const hasThreshold = threshold && threshold.toLowerCase() !== "not applicable";
  const longContext = (entry.tier || "").toLowerCase() === "long context";

  let id = slug(entry.model);
  if (longContext) id += "-long";

  let name = entry.model;
  if (hasThreshold) name += ` (${threshold.replace(/\s+/g, "")})`;

  return {
    _provider: entry.provider,
    id,
    name,
    provider: PROVIDER_NAMES[entry.provider] || entry.provider,
    tier: entry.category,
    input: price(entry.input),
    cached: price(entry.cached_input),
    cacheWrite: entry.provider === "anthropic" ? price(entry.cache_write) : "0",
    output: price(entry.output),
  };
}

function render(models) {
  const lines = [];
  for (const provider of PROVIDER_ORDER) {
    const group = models.filter((m) => m._provider === provider);
    if (!group.length) continue;
    lines.push(`  // ${PROVIDER_COMMENTS[provider]}`);
    for (const m of group) {
      lines.push(
        `  { id: ${JSON.stringify(m.id)}, name: ${JSON.stringify(m.name)}, ` +
          `provider: ${JSON.stringify(m.provider)}, tier: ${JSON.stringify(m.tier)}, ` +
          `input: ${m.input}, cached: ${m.cached}, cacheWrite: ${m.cacheWrite}, output: ${m.output} },`
      );
    }
  }
  return lines.join("\n");
}

async function main() {
  const res = await fetch(DATA_URL, {
    headers: { "User-Agent": "copilot-pricing-analyzer" },
  });
  if (!res.ok) throw new Error(`Failed to fetch pricing data: ${res.status}`);
  const yaml = await res.text();

  const entries = parseEntries(yaml).filter((e) => e.model && e.provider);
  const models = entries
    .filter((e) => PROVIDER_ORDER.includes(e.provider))
    .map(toModel);
  if (models.length < 5) {
    throw new Error(`Parsed too few models (${models.length}); aborting to avoid clobbering models.js.`);
  }

  const header = [
    "// Pricing per 1,000,000 tokens. Source: GitHub Copilot models & pricing docs.",
    `// ${DOCS_URL}`,
    "// cacheWrite applies to Anthropic only (0 elsewhere). cached = cached input read.",
    "// Auto-generated daily by scripts/update-models.js — do not edit by hand.",
    "const MODELS = [",
  ].join("\n");

  // Preserve everything from `const COLORS` onward (presentation config, not docs data).
  let tail =
    '\n\nconst COLORS = ["#2f81f7", "#3fb950", "#d29922", "#f85149", "#a371f7", "#39c5cf", "#db61a2", "#e3b341"];\n';
  if (fs.existsSync(MODELS_PATH)) {
    const existing = fs.readFileSync(MODELS_PATH, "utf8");
    const idx = existing.indexOf("const COLORS");
    if (idx !== -1) tail = "\n\n" + existing.slice(idx).replace(/\s*$/, "") + "\n";
  }

  fs.writeFileSync(MODELS_PATH, `${header}\n${render(models)}\n];${tail}`);
  console.log(`Wrote ${models.length} models to models.js`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
