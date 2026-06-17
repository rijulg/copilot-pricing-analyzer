# Copilot Pricing Analyzer

Compares GitHub Copilot models by **total cost to finish a task**, not price per prompt. A pricier model can win if it needs fewer prompts to get the job done.

Set how many prompts each model needs, and the chart shows where the cheaper-per-prompt model stops being cheaper overall (the break-even point). It also accounts for context growing with each follow-up prompt.

Pricing comes from [GitHub's models-and-pricing page](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing) and is stored in `models.js`. A daily GitHub Action (`scripts/update-models.py`) regenerates it from the source data and commits any changes.

## Run

Open `index.html`, or serve the folder:

```sh
python3 -m http.server 8765
```

Model selections live in the URL, so any comparison is a shareable link.
