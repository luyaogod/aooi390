import * as fs from 'fs';
import * as path from 'path';
import JSON5 from 'json5';
import { pathManager } from '../utils/paths';
import logger from '../utils/logger';

// ==================== 类型定义 ====================

/**
 * T100 全局变量配置
 */
export interface T100GlobalConfig {
  /** 配置名称（唯一标识） */
  name: string;
  /** 全局变量 */
  globals: {
    g_user: string;
    g_dept: string;
    g_enterprise: string;
    g_site: string;
    g_lang: string;
    g_dlang: string;
  };
  /** 备注描述 */
  description?: string;
  /** 是否为当前使用的配置 */
  isDefault?: boolean;
}

// ==================== T100GlobalManager ====================

/**
 * T100 全局变量配置管理器
 * 用于管理 t100-global.json5 文件中的配置
 * 支持查询与切换当前使用的配置
 */
export class T100GlobalManager {
  private static instance: T100GlobalManager;
  private configFilePath: string;
  private configs: T100GlobalConfig[] = [];
  private initialized: boolean = false;

  private constructor() {
    this.configFilePath = pathManager.getConfigFile('t100-global.json5');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): T100GlobalManager {
    if (!T100GlobalManager.instance) {
      T100GlobalManager.instance = new T100GlobalManager();
    }
    return T100GlobalManager.instance;
  }

  /**
   * 初始化管理器，加载配置文件
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const configDir = path.dirname(this.configFilePath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      if (!fs.existsSync(this.configFilePath)) {
        await this.saveToFile([]);
      }

      await this.loadFromFile();
      this.initialized = true;
      logger.info('[T100GlobalManager] 初始化成功，配置文件路径: %s', this.configFilePath);
    } catch (error) {
      logger.error(error, '[T100GlobalManager] 初始化失败');
      throw error;
    }
  }

  /**
   * 获取所有配置
   */
  public getAllConfigs(): T100GlobalConfig[] {
    this.ensureInitialized();
    return [...this.configs];
  }

  /**
   * 根据名称获取配置
   */
  public getConfigByName(name: string): T100GlobalConfig | null {
    this.ensureInitialized();
    return this.configs.find(c => c.name === name) || null;
  }

  /**
   * 获取当前激活的配置（isDefault 为 true 的配置）
   */
  public getActiveConfig(): T100GlobalConfig | null {
    this.ensureInitialized();
    return this.configs.find(c => c.isDefault) || null;
  }

  /**
   * 获取配置文件路径
   */
  public getConfigFilePath(): string {
    return this.configFilePath;
  }

  /**
   * 重新加载配置文件
   */
  public async reload(): Promise<void> {
    await this.loadFromFile();
    logger.info('[T100GlobalManager] 配置已重新加载');
  }

  /**
   * 切换当前激活的配置
   * @param name 要激活的配置名称
   */
  public async setActiveConfig(name: string): Promise<boolean> {
    this.ensureInitialized();

    const config = this.configs.find(c => c.name === name);
    if (!config) {
      logger.warn('[T100GlobalManager] 未找到配置: %s', name);
      return false;
    }

    this.clearDefaultFlag();
    config.isDefault = true;

    await this.persist();
    logger.info('[T100GlobalManager] 切换激活配置成功: %s', name);
    return true;
  }

  // ==================== 私有方法 ====================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('[T100GlobalManager] 管理器未初始化，请先调用 initialize()');
    }
  }

  private async loadFromFile(): Promise<void> {
    try {
      const data = await fs.promises.readFile(this.configFilePath, 'utf-8');
      const parsed = JSON5.parse(data) as T100GlobalConfig[];
      this.configs = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.error(error, '[T100GlobalManager] 加载配置文件失败');
      this.configs = [];
    }
  }

  private async persist(): Promise<void> {
    await this.saveToFile(this.configs);
  }

  private async saveToFile(data: T100GlobalConfig[]): Promise<void> {
    await fs.promises.writeFile(
      this.configFilePath,
      JSON5.stringify(data, null, 2),
      'utf-8'
    );
  }

  private clearDefaultFlag(): void {
    this.configs.forEach(c => {
      c.isDefault = false;
    });
  }
}

// ==================== 导出便捷实例 ====================

export const t100GlobalManager = T100GlobalManager.getInstance();
