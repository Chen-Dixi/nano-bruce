# Solid JSX 构建与运行说明

## 为什么需要 Solid JSX 转换

Bun 原生支持 JSX，但默认使用 React 的 JSX runtime（`react/jsx-dev-runtime`）。
OpenTUI 基于 Solid，其 JSX 语义与 React 不同，需要专门的转换插件。

## 两种场景下的 JSX 处理

| 场景 | JSX 由谁处理 | 配置位置 |
|---|---|---|
| `bun src/cli.ts`（开发，直接运行源码） | bunfig.toml 的 preload 注册运行时插件 | `bunfig.toml` |
| `bun scripts/build.ts`（构建打包） | `createSolidTransformPlugin()` 在构建时编译 | `scripts/build.ts` |
| 编译后的可执行文件（`dist/bruce`） | JSX 已编译为普通 JS，无需任何插件 | 无 |

## bunfig.toml 中 preload 的作用

```toml
preload = ["@opentui/solid/preload"]
```

`preload` 让 bun 在启动时先加载指定模块。`@opentui/solid/preload` 的源码：

```ts
import { ensureSolidTransformPlugin } from "./solid-plugin.js"
ensureSolidTransformPlugin()
```

它向 bun 运行时注册 JSX 转换插件，使 bun 在运行时遇到 `.tsx` 文件时，
用 Babel + `babel-preset-solid` 编译 JSX，而非 React 的 `jsxDEV`。

注意：必须在 `packages/app/` 目录下运行 `bun src/cli.ts` 才能读到此 bunfig.toml。
在 monorepo 根目录运行时，根目录的 `bunfig.toml` 已包含同样的 preload 配置。

## tsconfig.json 中 jsxImportSource 的作用

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@opentui/solid"
  }
}
```

`jsxImportSource` 配合 `jsx: "react-jsx"` 使用，指定 JSX 转换时从哪个包导入 runtime 函数。

默认行为（无 `jsxImportSource`）下，TypeScript 从 `react/jsx-runtime` 导入：

```ts
// .tsx 源码
<div>hello</div>

// 默认编译结果
import { jsx as _jsx } from "react/jsx-runtime";
_jsx("div", { children: "hello" });
```

设置 `jsxImportSource: "@opentui/solid"` 后，编译结果改为从 Solid 的 runtime 导入：

```ts
import { jsx as _jsx } from "@opentui/solid/jsx-runtime";
_jsx("div", { children: "hello" });
```

这个配置主要影响 **TypeScript 类型检查**（IDE 中的错误提示、`tsc --noEmit`），
让 TS 知道 JSX 的类型定义来自 `@opentui/solid` 的 `JSX` 命名空间，而非 React 的类型。

实际运行时的 JSX 转换由两套机制分别处理：
- **开发时**：bunfig.toml 的 preload（运行时 Babel 插件）
- **构建时**：`createSolidTransformPlugin()`（构建时 Babel 插件）

两者都绕过了 TS 的 JSX 编译，自己用 `babel-preset-solid` 处理，
所以 `jsxImportSource` 对运行和构建没有实际影响，但对**编辑器里的类型推断和错误提示**是必要的。

## 构建脚本

`scripts/build.ts` 使用 `Bun.build()` API 的 `compile` 模式生成独立可执行文件，
通过 `plugins: [createSolidTransformPlugin()]` 在构建时完成 JSX 转换。

构建产物结构：

```
dist/
├── bruce -> darwin-x64/bruce   # 当前平台的 symlink
└── darwin-x64/
    ├── bruce                    # 可执行文件
    └── bruce.map                # sourcemap
```

支持 `--all` 参数跨平台构建：`bun scripts/build.ts --all`
