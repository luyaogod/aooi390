import { app } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 路径管理器
 * 统一管理开发环境和生产环境的资源路径
 */
class PathManager {
    private isDev: boolean;

    constructor() {
        this.isDev = !app.isPackaged;
    }

    /**
     * 获取应用数据根目录
     * 开发环境: electron/app-data
     * 生产环境: resources/
     */
    public getAppDataRoot(): string {
        return this.isDev
            ? path.join(__dirname, '..', 'electron', 'app-data')
            : process.resourcesPath;
    }

    /**
     * 获取 SQLite 数据库路径
     */
    public getDatabasePath(): string {
        return path.join(this.getAppDataRoot(), 'database', 'app.db');
    }

    /**
     * 获取配置文件路径
     */
    public getConfigPath(): string {
        return path.join(this.getAppDataRoot(), 'config');
    }

    /**
     * 获取特定配置文件路径
     */
    public getConfigFile(fileName: string): string {
        return path.join(this.getConfigPath(), fileName);
    }
}

// 导出单例实例
export const pathManager = new PathManager();

// 导出便捷方法
export const getDatabasePath = (): string => pathManager.getDatabasePath();
export const getConfigPath = (): string => pathManager.getConfigPath();
export const getConfigFile = (fileName: string): string => pathManager.getConfigFile(fileName);
