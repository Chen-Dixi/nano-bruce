# Bruce

具备技能调用能力的 Agent 框架，基于 Anthropic Agent Skills 协议。

## Skill 选择与执行流程

系统「选择并执行」一个 Skill 的流程如下。

### 1. 选择 Skill

- 系统提示中包含 `<available_skills>`，列出每个 skill 的 **name**、**description**、**location**（SKILL.md 路径）。
- 模型根据用户意图和 description 决定使用哪个 skill。

### 2. 在系统中执行 Skill

执行方式有两种，模型可任选其一：

**方式 A：`load_skill(skill_name)`（推荐）**

1. 模型调用工具 `load_skill(skill_name)`（例如 `load_skill("internal-comms")`）。
2. 系统从 SkillRegistry 按名称找到该 skill，读取其 `SKILL.md` 完整内容。
3. 将内容与 skill 目录路径一并返回给模型。
4. 模型按 SKILL.md 的步骤执行（如需示例文件，再调用 `read_file(skill_dir/examples/xxx.md)`）。

**方式 B：`read_file(location)`**

1. 模型根据 `<available_skills>` 里的 `<location>` 直接调用 `read_file(location)`。
2. 系统读取该路径文件内容并返回。
3. 模型按 SKILL.md 说明执行，后续可用 `read_file` 读取同 skill 下的其他文件。

### 3. 可用工具小结

| 工具 | 作用 |
|------|------|
| `list_skills` | 列出已加载的 skill 名称与描述 |
| `load_skill(skill_name)` | 按名称加载并返回完整 SKILL.md，用于选择后执行 |
| `read_file(path)` | 读取 skills 目录下任意文件（SKILL.md、examples/*、references/*、assets/* 等） |
| `run_skill_script(skill_name, script_name, args?)` | 安全执行 skill 内 `scripts/` 目录下的脚本（.py / .sh / .js） |

执行 = 模型在拿到 skill 说明后，按说明与用户多轮对话、调用 `read_file` 获取资源，或调用 `run_skill_script` 执行脚本，最终完成任务。

---

## Skill 目录结构（协议扩展）

每个 skill 除 `SKILL.md` 外，可包含以下目录，Agent 均可使用：

| 目录 | 用途 | Agent 使用方式 |
|------|------|----------------|
| **scripts/** | 可执行脚本（Python、Bash、JavaScript） | `run_skill_script(skill_name, script_name, args)` 安全执行，限制在 scripts/ 下、扩展名白名单、超时 |
| **references/** | 参考文档（REFERENCE.md、FORMS.md、领域文档等） | `read_file(skill_dir/references/xxx.md)` 按需加载 |
| **assets/** | 静态资源（模板、图片、数据文件） | `read_file` 读取文本类资源；二进制/图片视实现而定 |
| **examples/** | 示例文件（如 internal-comms 的 3p-updates.md） | `read_file(skill_dir/examples/xxx.md)` |

脚本执行安全策略：

- 仅允许运行路径在 **skill 的 scripts/ 下** 的文件，禁止路径穿越。
- 仅允许扩展名：**.py**、**.sh**、**.bash**、**.js**、**.mjs**。
- 使用子进程、**无 shell**（参数以列表传入），超时 60 秒，参数数量上限 32。
