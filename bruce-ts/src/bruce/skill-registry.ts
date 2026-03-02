/**
 * Skill 注册表（Registry 模式）：从指定目录发现并缓存所有 skill
 *
 * 不依赖 Python 的 skills_ref，用 gray-matter 解析 SKILL.md 的 YAML frontmatter，
 * 得到 name、description 等，并生成 <available_skills> XML 供 PromptBuilder 使用。
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/** 从 SKILL.md frontmatter 解析出的技能元数据 */
export interface SkillProperties {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
}

export class SkillRegistry {
  readonly skillsDir: string;
  private validateOnLoad: boolean;
  /** 缓存：skill 名称 -> { 目录路径, 属性 } */
  private skills = new Map<string, { dir: string; props: SkillProperties }>();

  constructor(skillsDir: string, validateOnLoad = true) {
    this.skillsDir = path.resolve(skillsDir);
    this.validateOnLoad = validateOnLoad;
  }

  /** 扫描 skillsDir 下每个子目录，有 SKILL.md 或 skill.md 则解析并缓存；返回已加载的 skill 名称列表 */
  load(): string[] {
    this.skills.clear();
    if (!fs.existsSync(this.skillsDir) || !fs.statSync(this.skillsDir).isDirectory()) {
      return [];
    }

    const loaded: string[] = [];
    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const ent of entries) {
      const subdir = path.join(this.skillsDir, ent.name);
      const skillMd = path.join(subdir, "SKILL.md");
      const skillMdLower = path.join(subdir, "skill.md");
      const skillPath = fs.existsSync(skillMd) ? skillMd : (fs.existsSync(skillMdLower) ? skillMdLower : null);
      if (!skillPath) continue;

      try {
        const content = fs.readFileSync(skillPath, "utf-8");
        const parsed = matter(content);
        const data = parsed.data as Record<string, unknown>;
        const name = typeof data.name === "string" ? data.name.trim() : "";
        const description = typeof data.description === "string" ? data.description.trim() : "";
        if (!name || !description) continue;
        if (this.validateOnLoad && name !== ent.name) continue; // directory name must match skill name

        const props: SkillProperties = { name, description };
        if (typeof data.license === "string") props.license = data.license;
        if (typeof data.compatibility === "string") props.compatibility = data.compatibility;

        this.skills.set(name, { dir: subdir, props });
        loaded.push(name);
      } catch {
        continue;
      }
    }

    return loaded;
  }

  getAvailableSkillsXml(skillNames?: string[] | null): string {
    if (this.skills.size === 0) this.load();

    const entries = skillNames
      ? skillNames.filter((n) => this.skills.has(n)).map((n) => this.skills.get(n)!)
      : [...this.skills.values()];

    if (entries.length === 0) return "<available_skills>\n</available_skills>";

    const lines: string[] = ["<available_skills>"];
    for (const { dir, props } of entries) {
      const skillMd = path.join(dir, "SKILL.md");
      const location = fs.existsSync(skillMd) ? skillMd : path.join(dir, "skill.md");
      lines.push("<skill>");
      lines.push("<name>");
      lines.push(escapeXml(props.name));
      lines.push("</name>");
      lines.push("<description>");
      lines.push(escapeXml(props.description));
      lines.push("</description>");
      lines.push("<location>");
      lines.push(location);
      lines.push("</location>");
      lines.push("</skill>");
    }
    lines.push("</available_skills>");
    return lines.join("\n");
  }

  getSkillProperties(name: string): SkillProperties | null {
    if (this.skills.size === 0) this.load();
    return this.skills.get(name)?.props ?? null;
  }

  getSkillDir(name: string): string | null {
    if (this.skills.size === 0) this.load();
    return this.skills.get(name)?.dir ?? null;
  }

  listSkills(): string[] {
    if (this.skills.size === 0) this.load();
    return [...this.skills.keys()];
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
