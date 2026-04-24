---
name: feature-spec
description: Create a structured feature specification from roadmap phase. Use when starting new feature work, creating feature specs, or when user says "start next phase" or "create feature spec". Automatically reads roadmap, creates branch, gathers requirements via questions, and produces plan.md, requirements.md, validation.md in specs/YYYY-MM-DD-feature-name/ directory.
---

# Feature Spec Creator

Create structured feature specifications for Nano-Bruce development phases.

## Workflow

1. **Read roadmap** → Find next uncompleted phase in `specs/roadmap.md`
2. **Create branch** → `git checkout -b feat/<phase-name>`
3. **Ask questions** → Use AskUserQuestion to gather all requirements before writing
4. **Create directory** → `specs/YYYY-MM-DD-<feature-name>/`
5. **Write files** → plan.md, requirements.md, validation.md

## Step 1: Find Next Phase

Read `specs/roadmap.md` and identify the first phase with status `📋 规划中` (or similar non-complete marker). Report phase name and summary to user.

If all phases complete, ask user which feature to work on.

## Step 2: Create Branch

```bash
git checkout -b feat/<phase-slug>
```

Use lowercase, hyphen-separated slug from phase name (e.g., "Configuration System" → `feat/configuration-system`).

## Step 3: Gather Requirements (MANDATORY)

**Before writing any files**, use AskUserQuestion tool with all questions grouped in ONE call.

Required questions (adapt to phase context):

1. **Scope** - What is the minimal scope for this phase?
2. **Key decisions** - Any specific implementation decisions already made?
3. **Context** - Any dependencies or constraints from previous phases?
4. **Validation criteria** - How will you know this phase is complete?

Ask for clarifications as needed until requirements are clear.

## Step 4: Create Directory

```bash
mkdir -p specs/YYYY-MM-DD-<feature-name>
```

Use current date and feature slug (e.g., `specs/2026-04-21-configuration-system/`).

## Step 5: Write Files

### plan.md

Numbered task groups with checklist format:

```markdown
# [Feature Name] Plan

## Task Group 1: [Group Name]
- [ ] Task 1.1: Description
- [ ] Task 1.2: Description

## Task Group 2: [Group Name]
- [ ] Task 2.1: Description
...

## Dependencies
- Task X depends on Task Y

## Notes
- Implementation notes
```

### requirements.md

```markdown
# [Feature Name] Requirements

## Scope
- In scope: ...
- Out of scope: ...

## Decisions
- Decision 1: Rationale
- Decision 2: Rationale

## Context
- References: specs/mission.md, specs/tech-stack.md
- Dependencies: ...
- Constraints: ...

## Open Questions
- [ ] Question 1
```

### validation.md

Before writing validation.md, read `specs/tech-stack.md` to identify the project's language/tech stack and select appropriate test framework:

| Tech Stack | Test Framework | Example |
|------------|----------------|---------|
| TypeScript | Vitest | `import { test, expect } from 'vitest'` |
| JavaScript | Vitest / Jest | `import { test, expect } from 'vitest'` |
| Python | pytest | `def test_xxx(): assert ...` |
| Go | Go testing | `func TestXxx(t *testing.T) { ... }` |
| Rust | cargo test | `#[test] fn test_xxx() { ... }` |

Write test cases using the selected framework's syntax:

```markdown
# [Feature Name] Validation

## Success Criteria
- Criterion 1: How to verify
- Criterion 2: How to verify

## Test Framework
- Using: [Framework Name] (based on specs/tech-stack.md)

## Test Cases

### Unit Tests
```[language]
// Example test case using selected framework
test('description', () => {
  expect(true).toBe(true);
});
```

### Integration Tests
- Test 1: Description + expected outcome

## Merge Checklist
- [ ] All tests pass (`npm test` / `pytest` / etc.)
- [ ] Documentation updated
- [ ] No regressions
```

## Reference Alignment

All specs must align with:
- `specs/mission.md` - Ensure feature serves target audience
- `specs/tech-stack.md` - Use approved technology, fill identified gaps

Check alignment before finalizing.

## Keywords

feature spec, start phase, new feature, roadmap, planning, specification, requirements, validation