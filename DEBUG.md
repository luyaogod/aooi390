# Electron Debug 配置指南

适用于 Vite + Electron + VS Code 项目，支持主进程和渲染进程同时断点调试。

## 依赖

```bash
npm i -D vite-plugin-electron vite-plugin-electron-renderer
```

VS Code 扩展：`ms-vscode.js-debug`（在 `.vscode/extensions.json` 中声明）。

## 1. vite.config.ts — 启动时注入 `--inspect`

```ts
import electron from 'vite-plugin-electron/simple'

electron({
  main: {
    entry: 'electron/main.ts',
    vite: {
      build: {
        sourcemap: true,                      // 必须开启 sourcemap
        rollupOptions: {
          external: ['better-sqlite3', ...],  // 原生模块放这里
        },
      },
    },
    onstart(args) {
      args.startup(['.', '--no-sandbox', '--inspect=5858'])
    },
  },
  preload: {
    input: 'electron/preload.ts',
  },
  renderer: {},
})
```

关键点：
- `sourcemap: true` 让断点能映射回 TS 源码
- `--inspect=5858` 让 Node.js 在 5858 端口等待调试器 attach
- 原生模块（如 `better-sqlite3`）必须 external，否则打包报错

## 2. .vscode/launch.json — 双进程调试配置

```json
{
  "version": "0.2.0",
  "compounds": [
    {
      "name": "Debug All (Main + Renderer)",
      "configurations": ["Debug Main Process", "Debug Renderer"],
      "stopAll": true
    }
  ],
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "attach",
      "port": 5858,
      "cwd": "${workspaceFolder}",
      "outFiles": ["${workspaceFolder}/dist-electron/**/*.js"],
      "sourceMaps": true,
      "resolveSourceMapLocations": [
        "${workspaceFolder}/**",
        "!**/node_modules/**"
      ]
    },
    {
      "name": "Debug Renderer",
      "type": "chrome",
      "request": "attach",
      "port": 9222,
      "webRoot": "${workspaceFolder}/src",
      "urlFilter": "http://localhost:*"
    }
  ]
}
```

配置说明：

| 配置项 | 作用 |
|--------|------|
| `compounds` | 一键同时启动主进程和渲染进程调试 |
| `stopAll: true` | 停止一个时自动停掉另一个 |
| `type: "node"` + `port: 5858` | attach 到主进程的 Node.js Inspector |
| `type: "chrome"` + `port: 9222` | attach 到渲染进程的 Chrome DevTools |
| `outFiles` | 指向编译产物，配合 sourcemap 使用 |
| `resolveSourceMapLocations` | 限制 sourcemap 搜索范围，排除 node_modules 加速解析 |

## 3. .vscode/extensions.json — 推荐扩展

```json
{
  "recommendations": [
    "ms-vscode.js-debug"
  ]
}
```

## 调试流程

1. 终端运行 `npm run dev`（Vite 会自动拉起带 `--inspect=5858` 的 Electron）
2. 在 VS Code 按 `F5`，选择 **Debug All (Main + Renderer)**
3. 主进程：在 `electron/main.ts` 打断点
4. 渲染进程：在 `src/` 下的前端代码打断点
5. 两个进程的断点都会命中，可在 Debug Console 中切换上下文

## 常见问题

**主进程断点不命中？**
- 检查 `dist-electron/**/*.js.map` 是否生成
- 确认 `--inspect=5858` 已注入（看 Electron 窗口标题或终端输出是否有 `ws://127.0.0.1:5858` 字样）

**渲染进程断点不命中？**
- 检查 `port` 是否为 Electron 启动时的 remote-debugging-port（默认 9222 通常无需额外配置）
- 确认 `webRoot` 指向源码目录

**原生模块报错？**
- 在 `rollupOptions.external` 中排除，如 `better-sqlite3`、`pg`、`oracledb`
