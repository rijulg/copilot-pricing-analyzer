#!/usr/bin/env python3
"""Regenerates models.js from GitHub's published Copilot pricing data.

Source of truth is the github/docs data file that drives the public pricing
tables, so this stays in sync with the docs page without scraping HTML.
Uses only the Python standard library so it runs on a stock Linux box.
"""

import json
import os
import re
import sys
import urllib.request

DATA_URL = (
    "https://raw.githubusercontent.com/github/docs/main/"
    "data/tables/copilot/models-and-pricing.yml"
)
DOCS_URL = (
    "https://docs.github.com/en/copilot/reference/copilot-billing/"
    "models-and-pricing"
)
MODELS_PATH = os.path.join(os.path.dirname(__file__), "..", "models.js")

# Output grouping order. Within each group source order is preserved.
PROVIDER_ORDER = ["anthropic", "openai", "google", "github", "microsoft", "xai"]
PROVIDER_NAMES = {
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "google": "Google",
    "github": "GitHub",
    "microsoft": "Microsoft",
    "xai": "xAI",
}
PROVIDER_COMMENTS = {
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "google": "Google",
    "github": "Fine-tuned (GitHub)",
    "microsoft": "Microsoft",
    "xai": "xAI",
}


def strip_quotes(value):
    v = value.strip()
    if (v.startswith("'") and v.endswith("'")) or (
        v.startswith('"') and v.endswith('"')
    ):
        return v[1:-1]
    return v


def parse_entries(yaml):
    """Minimal parser for this flat list-of-mappings YAML (no nesting)."""
    entries = []
    current = None
    for raw_line in yaml.split("\n"):
        line = raw_line.rstrip()
        if not line.strip() or line.strip().startswith("#"):
            continue
        m = re.match(r"^- (\w+):\s*(.*)$", line)
        if m:
            current = {}
            entries.append(current)
            current[m.group(1)] = strip_quotes(m.group(2))
            continue
        m = re.match(r"^\s+(\w+):\s*(.*)$", line)
        if m and current is not None:
            current[m.group(1)] = strip_quotes(m.group(2))
    return entries


def price(value):
    n = str(value).replace("$", "").strip()
    if not re.match(r"^\d+(\.\d+)?$", n):
        raise ValueError(f"Unexpected price value: {value}")
    return n


def slug(model):
    s = model.lower()
    s = re.sub(r"^claude\s+", "", s)
    s = re.sub(r"\s+", "-", s)
    return s


def to_model(entry):
    threshold = (entry.get("threshold") or "").strip()
    has_threshold = bool(threshold) and threshold.lower() != "not applicable"
    long_context = (entry.get("tier") or "").lower() == "long context"

    model_id = slug(entry["model"])
    if long_context:
        model_id += "-long"

    name = entry["model"]
    if has_threshold:
        name += " ({})".format(re.sub(r"\s+", "", threshold))

    return {
        "_provider": entry["provider"],
        "id": model_id,
        "name": name,
        "provider": PROVIDER_NAMES.get(entry["provider"], entry["provider"]),
        "tier": entry["category"],
        "input": price(entry["input"]),
        "cached": price(entry["cached_input"]),
        "cacheWrite": price(entry["cache_write"])
        if entry["provider"] == "anthropic"
        else "0",
        "output": price(entry["output"]),
    }


def render(models):
    lines = []
    for provider in PROVIDER_ORDER:
        group = [m for m in models if m["_provider"] == provider]
        if not group:
            continue
        lines.append(f"  // {PROVIDER_COMMENTS[provider]}")
        for m in group:
            lines.append(
                "  {{ id: {id}, name: {name}, provider: {provider}, "
                "tier: {tier}, input: {input}, cached: {cached}, "
                "cacheWrite: {cacheWrite}, output: {output} }},".format(
                    id=json.dumps(m["id"], ensure_ascii=False),
                    name=json.dumps(m["name"], ensure_ascii=False),
                    provider=json.dumps(m["provider"], ensure_ascii=False),
                    tier=json.dumps(m["tier"], ensure_ascii=False),
                    input=m["input"],
                    cached=m["cached"],
                    cacheWrite=m["cacheWrite"],
                    output=m["output"],
                )
            )
    return "\n".join(lines)


def main():
    req = urllib.request.Request(
        DATA_URL, headers={"User-Agent": "copilot-pricing-analyzer"}
    )
    with urllib.request.urlopen(req) as res:
        if res.status != 200:
            raise RuntimeError(f"Failed to fetch pricing data: {res.status}")
        yaml = res.read().decode("utf-8")

    entries = [e for e in parse_entries(yaml) if e.get("model") and e.get("provider")]
    models = [to_model(e) for e in entries if e["provider"] in PROVIDER_ORDER]
    if len(models) < 5:
        raise RuntimeError(
            f"Parsed too few models ({len(models)}); "
            "aborting to avoid clobbering models.js."
        )

    header = "\n".join(
        [
            "// Pricing per 1,000,000 tokens. Source: GitHub Copilot models & pricing docs.",
            f"// {DOCS_URL}",
            "// cacheWrite applies to Anthropic only (0 elsewhere). cached = cached input read.",
            "// Auto-generated daily by scripts/update-models.py — do not edit by hand.",
            "const MODELS = [",
        ]
    )

    # Preserve everything from `const COLORS` onward (presentation config, not docs data).
    tail = (
        '\n\nconst COLORS = ["#2f81f7", "#3fb950", "#d29922", "#f85149", '
        '"#a371f7", "#39c5cf", "#db61a2", "#e3b341"];\n'
    )
    if os.path.exists(MODELS_PATH):
        with open(MODELS_PATH, "r", encoding="utf-8") as f:
            existing = f.read()
        idx = existing.find("const COLORS")
        if idx != -1:
            tail = "\n\n" + existing[idx:].rstrip() + "\n"

    with open(MODELS_PATH, "w", encoding="utf-8") as f:
        f.write(f"{header}\n{render(models)}\n];{tail}")
    print(f"Wrote {len(models)} models to models.js")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # noqa: BLE001
        print(err, file=sys.stderr)
        sys.exit(1)
