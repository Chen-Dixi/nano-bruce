## Nano-Bruce Agent Map

Purpose: this file is a compact map for agents and new contributors.
It is not a full handbook. Source-of-truth details live in `docs/`.

### 1) Repository intent

- This repository contains two independent implementations of similar Bruce agent ideas:
  - `bruce-ts/`: active TypeScript implementation (current focus)
  - `bruce-py/`: historical Python implementation (kept for reference, low activity)
- Do not assume cross-directory runtime dependencies between `bruce-ts/` and `bruce-py/`.

### 2) Where to read first

- Start here for architecture overview: `ARCHITECTURE.md`
- Then read structured docs:
  - `docs/design-docs/index.md`
  - `docs/product-specs/index.md`
  - `docs/exec-plans/active/` (current execution plans)
  - `docs/exec-plans/completed/` (finished plans and outcomes)
  - `docs/references/` (external references for LLM/agent work)

### 3) Priority of truth (important)

When information conflicts, use this order:

1. Code + tests
2. Active execution plans in `docs/exec-plans/active/`
3. Product specs in `docs/product-specs/`
4. Design docs in `docs/design-docs/`
5. This `AGENTS.md` map

### 4) Engineering rules for generated code

- Keep changes small and composable; avoid broad speculative rewrites.
- Prefer explicit types and readable naming over compact clever code.
- Preserve existing public interfaces unless change is required and documented.
- Add brief, meaningful comments only where logic is not obvious.
- Avoid hidden behavior: no silent fallback without logging or explicit error output.
- Use deterministic behavior for retries and ordering whenever possible.

### 5) Code style defaults

- Follow existing style in touched module; do not reformat unrelated files.
- Keep functions focused; split when function does multiple unrelated tasks.
- Validate external/tool input early; return structured errors.
- Keep side effects isolated behind clear boundaries (tool calls, I/O, network).
- Prefer schema-driven input contracts for tools.

### 6) Validation and quality gates

For every non-trivial change, run and record:

1. Build/type checks for changed package(s)
2. Relevant tests for changed behavior
3. At least one realistic end-to-end scenario when agent loop behavior changes

If a check cannot be run, document why in the related plan file.

### 7) Agent planning workflow

- Before coding sizable work:
  - create or update one plan under `docs/exec-plans/active/`
  - define scope, risks, and verification checklist
- After completion:
  - move/update plan to `docs/exec-plans/completed/`
  - capture what changed, what failed, and follow-ups

### 8) Failure-handling baseline for agent features

- Classify failures before reacting:
  - transient (timeout/rate-limit)
  - recoverable (validation/schema mismatch)
  - terminal (missing capability or incompatible contract)
- Use bounded retries with backoff for transient failures.
- Replan after repeated failure; do not loop forever.
- Emit clear execution traces for debugging.

### 9) Documentation update policy

Update docs when you change:

- architecture boundaries -> `ARCHITECTURE.md` + `docs/design-docs/`
- behavior/spec -> `docs/product-specs/`
- execution process or reliability policy -> `docs/exec-plans/` or top-level docs in `docs/`

### 10) Suggested first read path for new agents

1. `AGENTS.md` (this map)
2. `ARCHITECTURE.md`
3. `docs/design-docs/index.md`
4. `docs/PLANS.md`
5. Target package docs (`bruce-ts/ARCHITECTURE.md` etc.)

Keep this file short and navigational. Move deep details into `docs/`.
