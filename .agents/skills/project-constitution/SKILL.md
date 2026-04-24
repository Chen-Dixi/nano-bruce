---
name: project-constitution
description: "Create project constitution documents (mission, tech-stack, roadmap) in specs/ directory. Use when: (1) starting a new project, (2) user mentions 'constitution', '宪章', '章程', (3) need to define project mission/target audience/tech gaps, (4) user asks to create specs/mission.md, specs/tech-stack.md, specs/roadmap.md. Must ask questions BEFORE writing any files."
---

# Project Constitution Creator

Create structured project documentation (constitution) based on README.md and AGENTS.md content.

## Workflow

### Step 1: Ask Questions (MANDATORY)

Before writing any files, use AskUserQuestion to confirm:

**Questions to ask (group in ONE call):**

1. **Mission** - What is the project's mission/purpose?
2. **Target Audience** - Who are the intended users?
3. **Tech Stack Gaps** - What technical gaps exist in current implementation?

Do NOT proceed to Step 2 until user confirms all three.

### Step 2: Read Source Documents

Read README.md and AGENTS.md from project root to gather context.

### Step 3: Create Constitution Files

Create three files in `specs/` directory:

#### specs/mission.md

```markdown
---
name: mission
description: [project name] 项目使命与目标
type: project
---

# [Project Name] Mission

## Mission
[项目使命陈述]

## Target Audience
[目标用户描述]

## Core Problem
[系统要解决的核心问题]

## Key Principles
[开发原则，如有]

---

**Why:** [说明为什么这个使命重要]
**How to apply:** [说明如何应用这个使命]
```

#### specs/tech-stack.md

```markdown
---
name: tech-stack
description: [project name] 技术选型与缺口分析
type: project
---

# [Project Name] Tech Stack

## Current Tech Stack

| Layer | Technology | Reason |
|-------|------------|--------|
[技术选型表格]

## Tech Stack Gaps

### P0 - Critical
[必须解决的技术缺口]

### P1 - Important
[应优先解决的缺口]

### P2 - Enhancement
[后续规划的增强]

## Technology Decisions

### Why [Technology A] over [Technology B]?
[技术决策理由]

---

**Why:** [说明技术选型的目的]
**How to apply:** [说明如何应用技术选型]
```

#### specs/roadmap.md

```markdown
---
name: roadmap
description: [project name] 高层实现路径与阶段规划
type: project
---

# [Project Name] Roadmap

## Development Principles

1. **Principle 1** - [描述]
2. **Principle 2** - [描述]

---

## Phase 0: [Foundation Phase] ✅ (已完成)

**Goal:** [阶段目标]

- [x] Task 1
- [x] Task 2

**Output:** [阶段产出]

---

## Phase 1: [Next Phase]

**Goal:** [阶段目标]

### 1.1 [Sub-task]
- [ ] Task description

**Validation:** [如何验证完成]
**Est. Effort:** [预计工作量]

---

## Phase Summary

| Phase | Name | Priority | Dependencies | Status |
|-------|------|----------|--------------|--------|
[阶段表格]

---

**Why:** [说明路线图的目的]
**How to apply:** [说明如何应用路线图]
```

### Step 4: Confirm Completion

Report created files and their locations to user.

## References

See `references/examples.md` for complete constitution examples from real projects.