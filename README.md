# aooi399

基于 Electron + Vite + React + TypeScript 的桌面应用，集成 Prisma ORM 支持 SQLite（本地）和外部数据库（Kingbase/Oracle）。

---

## 技术栈

| 技术 | 版本 |
|------|------|
| Electron | ^30.0.1 |
| Vite | ^5.1.6 |
| React | ^18.2.0 |
| TypeScript | ^5.2.2 |
| Prisma | ^6.19.0 |

---

## 可用命令

### 开发环境

```bash
# 启动开发服务器（热重载）
npm run dev
```

### 构建与打包

```bash
# 完整构建：生成 Prisma Client + 类型检查 + Vite 构建 + Electron 打包
npm run build

# 仅预览生产构建（不打包 Electron）
npm run preview
```

### 代码检查

```bash
# ESLint 检查
npm run lint
```

---

## 打包输出

执行 `npm run build` 后，打包文件位于：

```
release/${version}/
├── win-unpacked/              # 免安装版目录
│   └── aooi399.exe            # 可直接运行的可执行文件
└── aooi399-Windows-${version}-Setup.exe  # 安装包
```

---

## 项目结构

```
├── electron/           # Electron 主进程代码
│   ├── main.ts         # 主进程入口
│   ├── preload.ts      # 预加载脚本
│   ├── db/             # 数据库客户端
│   ├── core/           # 数据库同步逻辑
│   ├── config/         # 连接配置
│   └── app-data/       # 应用数据（数据库、配置）
├── src/                # 渲染进程（React）
├── prisma/             # Prisma 模型与迁移
├── dist/               # 渲染进程构建输出
├── dist-electron/      # 主进程构建输出
└── release/            # Electron Builder 打包输出
```

---

## 数据库支持

- **SQLite**：本地应用数据库（通过 Prisma + better-sqlite3）
- **Kingbase**：外部 PostgreSQL 兼容数据库（通过 pg）
- **Oracle**：外部 Oracle 数据库（通过 oracledb）

---

## 注意事项

1. **构建前确保 Prisma Client 已生成**：`build` 脚本会自动执行 `prisma generate`
2. **Windows 打包**：生成的 `.exe` 运行前需确保没有同名进程在运行
3. **asar 配置**：Prisma 相关模块已通过 `asarUnpack` 解压，确保运行时模块加载正常