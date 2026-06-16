# Prompts
All prompts used in setting up this repo. Each run is a new chat session to keep the context window short.

## First run
Run with Claude Sonnet 4.6 with Autopilot approvals

>  setup a hello world github static HTML page repo


## Second run
Run with Claude Opus 4.8 with Autopilot approvals

> I want to figure out after how many prompts an expensive model is cheaper than a cheaper model. Let's say with claude sonnet pus 4.6 I need to run 2 prompts, and with claude opus 4.8 I only need to run 1 prompt so it might actually be cheaper.
to this end I want to set up a simple web app that does the following:
    1. pull the pricing details of models from https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing
    2. allow comparing two or more models

> let's break down the file into separate html+css+js as per github static page implementation so that we can have this a bit more manageable

## Third run
Run with Claude Opus 4.8 with Autopilot approvals

> The input boxes are taking too much space on the screen. We need to make the chart more prominent, and the important thing within the chart should be the price difference as we use that as the breaking point calculation.
The prompts to finish task can probably just be sliders per model, and model selection can just be below the chart as adding sliders + text input on the right hand side.
Rest of the config can just be at the bottom as it is less important.
The header is taking too much space as well, let's compact it. And let's add a clean title and ico file.

## Fourth run
Run with Claude Opus 4.8 with Autopilot approvals

> The prompts slider area still takes too much space, so is the add model thingy. The breakeven points are only displayed for one model, we should have multiple breakpoints when there are more than two models, let's use the most expensive model to calculate breakeven points. The alignment of the header title is off. The token profile does need to be folded, it's already at the bottom. The UI should take the whole screen, and not be restricted to some fixed width.

## Fifth run

Run with Claude Opus 4.8 with Autopilot approvals

> Let's put the models selection in the query params so that we have a deep link to any two comparisons. The chart font is way too big, and the chart's height is way too much. The title on the chart also takes way too much space, that can just be summarized below the chart along with the total cost rankings. The price difference is also being only calculated between two models, which is confusing.

## Sixth run

Run with Claude Opus 4.8 with Autopilot approvals

> Let's make the input and output tokens a bit more realistic, you can use the examples from the prompts here. And add the maths as a write up at the bottom of the webapp.

> Let's add the derivation with the chosen params alongside the maths.

> Ok, it's clear now that we are not accounting for context explosion. Let's account for that in our maths and modelling.

## Seventh run

Run with Claude Opus 4.8 with Autopilot approvals

> Let's add a very short readme quickly explaining what's happening here. It should not read like LLM garbage, it should be very short and to the point.