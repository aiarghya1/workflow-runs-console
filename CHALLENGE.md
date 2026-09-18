# Fullstack Live Challenge

## Context

You are building a small internal tool for an AI operations team.

The team runs AI workflows for enterprise users. Some runs fail. Operators need a simple internal console to inspect workflow runs and retry failed ones safely.

## Goal

Build a thin but working fullstack solution.

Focus on:
- clear thinking
- sensible scope
- working software
- good use of AI tools
- tradeoff awareness

Do not overengineer.

## Allowed

- Cursor or any AI IDE features
- internet search and documentation
- any libraries you can justify quickly

## Timebox

You will get `60 minutes` of build time.

## Stack

Use the stack provided by the interviewer.

If no stack is provided, choose a stack you can deliver in quickly.

## Core Features

Build a small app with these capabilities:

1. Show a list of workflow runs.
2. Each run should include:
   - `id`
   - `workflowName`
   - `status` with values `success`, `running`, or `failed`
   - `startedAt`
   - `latencyMs`
   - `tokenCount`
   - `retries`
3. Support filtering by `status`.
4. Support search by `workflowName`.
5. Clicking a run should show more details.
6. A failed run should have a `Retry` action.
7. Prevent duplicate retries if the user clicks retry multiple times quickly.
8. Show clear loading, success, and error states.

## Run Details

Each run should also have step-level information such as:
- `ingest`
- `retrieve`
- `generate`
- `review`

For each step, show:
- step name
- step status
- optional error message

## Constraints

- In-memory data is enough.
- No authentication is needed.
- No database is needed.
- Styling can stay minimal.
- Prefer a thin, complete slice over a broad incomplete solution.

## What We Are Looking For

As you work, explain:
- how you understand the problem
- what you are prioritizing first
- what you are delegating to AI
- what you are validating manually
- what you are intentionally skipping due to time

## If You Finish Early

Pick one of these:
- retry only the failed step, not the full run
- add a small test suite
- add simple logging or observability
- improve the state model for future extensibility

## Discussion After Build

Be ready to explain:
- your architecture
- your data flow
- your state management choices
- how you handled retry safety
- what you would improve for production
- where AI helped and where it was risky

## Deliverable

A working project or a partial but usable working slice that demonstrates the core flow:
- list runs
- inspect one run
- retry a failed run safely
