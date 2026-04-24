import { defineConfig } from "prisma/config";
import * as path from "path";

// Electron 进程类型扩展
type ElectronProcess = NodeJS.Process & {
  resourcesPath?: string;
};

// 判断是否在 Electron 打包环境
const electronProcess = process as ElectronProcess;
const isElectronPackaged = typeof electronProcess.resourcesPath !== 'undefined';

// 获取数据库路径
// 注意：路径统一由 electron/utils/paths.ts 管理
// 此处配置主要用于 Prisma CLI 命令（migrate/generate）
const getDatabaseUrl = (): string => {
  // Electron 打包后，数据库在 resources/database/ 目录
  if (isElectronPackaged && electronProcess.resourcesPath) {
    const dbPath = path.join(electronProcess.resourcesPath, "database", "app.db").replace(/\\/g, '/');
    return `file:${dbPath}`;
  }

  // 开发环境，数据库在 electron/app-data/database/ 目录
  return "file:./electron/app-data/database/app.db";
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});
