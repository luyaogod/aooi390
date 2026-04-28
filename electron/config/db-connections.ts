import * as fs from 'fs';
import * as path from 'path';
import JSON5 from 'json5';
import { pathManager } from '../utils/paths';
import logger from '../utils/logger';
import type { ExternalDBType, KingbaseConfig, OracleConfig } from '../db/clients';

// ==================== 类型定义 ====================

/**
 * 数据库连接配置基础接口
 */
export interface DBConnection {
  /** 连接名称（唯一标识） */
  name: string;
  /** 数据库类型 */
  type: ExternalDBType;
  /** 连接配置 */
  config: KingbaseConfig | OracleConfig;
  /** 是否默认连接 */
  isDefault?: boolean;
  /** 备注描述 */
  description?: string;
}

/**
 * 创建连接请求（不包含系统自动生成的字段）
 */
export interface CreateConnectionRequest {
  name: string;
  type: ExternalDBType;
  config: KingbaseConfig | OracleConfig;
  isDefault?: boolean;
  description?: string;
}

/**
 * 更新连接请求
 */
export interface UpdateConnectionRequest {
  name?: string;
  type?: ExternalDBType;
  config?: KingbaseConfig | OracleConfig;
  isDefault?: boolean;
  description?: string;
}

// ==================== DBConnectionManager ====================

/**
 * 数据库连接配置管理器
 * 用于管理 db-connections.json 文件中的连接配置
 * 支持增删改查操作，自动处理文件读写
 */
export class DBConnectionManager {
  private static instance: DBConnectionManager;
  private configFilePath: string;
  private connections: DBConnection[] = [];
  private initialized: boolean = false;

  private constructor() {
    this.configFilePath = pathManager.getConfigFile('db-connections.json5');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): DBConnectionManager {
    if (!DBConnectionManager.instance) {
      DBConnectionManager.instance = new DBConnectionManager();
    }
    return DBConnectionManager.instance;
  }

  /**
   * 初始化管理器，加载配置文件
   * 如果文件不存在，会创建默认的空配置文件
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 确保配置目录存在
      const configDir = path.dirname(this.configFilePath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // 如果配置文件不存在，创建默认配置
      if (!fs.existsSync(this.configFilePath)) {
        await this.saveToFile([]);
      }

      // 加载配置
      await this.loadFromFile();
      this.initialized = true;
      logger.info('[DBConnectionManager] 初始化成功，配置文件路径: %s', this.configFilePath);
    } catch (error) {
      logger.error(error, '[DBConnectionManager] 初始化失败');
      throw error;
    }
  }

  /**
   * 获取所有连接配置
   */
  public getAllConnections(): DBConnection[] {
    this.ensureInitialized();
    return [...this.connections];
  }

  /**
   * 根据名称获取连接配置
   * @param name 连接名称
   */
  public getConnectionByName(name: string): DBConnection | null {
    this.ensureInitialized();
    return this.connections.find(conn => conn.name === name) || null;
  }

  /**
   * 根据类型获取连接配置列表
   * @param type 数据库类型
   */
  public getConnectionsByType(type: ExternalDBType): DBConnection[] {
    this.ensureInitialized();
    return this.connections.filter(conn => conn.type === type);
  }

  /**
   * 获取默认连接配置
   */
  public getDefaultConnection(): DBConnection | null {
    this.ensureInitialized();
    return this.connections.find(conn => conn.isDefault) || null;
  }

  /**
   * 创建新的连接配置
   * @param request 创建请求
   */
  public async createConnection(request: CreateConnectionRequest): Promise<DBConnection> {
    this.ensureInitialized();

    // 检查名称是否重复
    if (this.connections.some(conn => conn.name === request.name)) {
      throw new Error(`连接名称"${request.name}"已存在`);
    }

    // 如果设置为默认，取消其他默认连接
    if (request.isDefault) {
      this.clearDefaultFlag();
    }

    const connection: DBConnection = {
      name: request.name,
      type: request.type,
      config: request.config,
      isDefault: request.isDefault || false,
      description: request.description,
    };

    this.connections.push(connection);
    await this.persist();

    logger.info('[DBConnectionManager] 创建连接成功: %s', connection.name);
    return connection;
  }

  /**
   * 更新连接配置
   * @param name 连接名称
   * @param request 更新请求
   */
  public async updateConnection(name: string, request: UpdateConnectionRequest): Promise<DBConnection | null> {
    this.ensureInitialized();

    const index = this.connections.findIndex(conn => conn.name === name);
    if (index === -1) {
      logger.warn('[DBConnectionManager] 未找到连接: %s', name);
      return null;
    }

    const connection = this.connections[index];

    // 如果设置为默认，取消其他默认连接
    if (request.isDefault === true) {
      this.clearDefaultFlag();
    }

    // 更新字段
    if (request.name !== undefined) connection.name = request.name;
    if (request.type !== undefined) connection.type = request.type;
    if (request.config !== undefined) connection.config = request.config;
    if (request.isDefault !== undefined) connection.isDefault = request.isDefault;
    if (request.description !== undefined) connection.description = request.description;

    await this.persist();
    logger.info('[DBConnectionManager] 更新连接成功: %s', connection.name);
    return connection;
  }

  /**
   * 删除连接配置
   * @param name 连接名称
   */
  public async deleteConnection(name: string): Promise<boolean> {
    this.ensureInitialized();

    const index = this.connections.findIndex(conn => conn.name === name);
    if (index === -1) {
      logger.warn('[DBConnectionManager] 未找到连接: %s', name);
      return false;
    }

    const connection = this.connections[index];
    this.connections.splice(index, 1);
    await this.persist();

    logger.info('[DBConnectionManager] 删除连接成功: %s', connection.name);
    return true;
  }

  /**
   * 设置默认连接
   * @param name 连接名称
   */
  public async setDefaultConnection(name: string): Promise<boolean> {
    this.ensureInitialized();

    const connection = this.connections.find(conn => conn.name === name);
    if (!connection) {
      logger.warn('[DBConnectionManager] 未找到连接: %s', name);
      return false;
    }

    this.clearDefaultFlag();
    connection.isDefault = true;

    await this.persist();
    logger.info('[DBConnectionManager] 设置默认连接成功: %s', connection.name);
    return true;
  }

  /**
   * 测试连接配置是否有效（仅验证配置格式）
   * 实际连接测试需要调用 ExternalDBManager
   * @param type 数据库类型
   * @param config 连接配置
   */
  public validateConfig(type: ExternalDBType, config: KingbaseConfig | OracleConfig): { valid: boolean; message?: string } {
    if (type === 'kingbase') {
      const kbConfig = config as KingbaseConfig;
      if (!kbConfig.host) return { valid: false, message: 'Kingbase 主机地址不能为空' };
      if (!kbConfig.port) return { valid: false, message: 'Kingbase 端口不能为空' };
      if (!kbConfig.database) return { valid: false, message: 'Kingbase 数据库名不能为空' };
      if (!kbConfig.user) return { valid: false, message: 'Kingbase 用户名不能为空' };
      if (!kbConfig.password) return { valid: false, message: 'Kingbase 密码不能为空' };
    } else {
      const oraConfig = config as OracleConfig;
      if (!oraConfig.user) return { valid: false, message: 'Oracle 用户名不能为空' };
      if (!oraConfig.password) return { valid: false, message: 'Oracle 密码不能为空' };
      if (!oraConfig.connectString) return { valid: false, message: 'Oracle 连接字符串不能为空' };
    }
    return { valid: true };
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
    logger.info('[DBConnectionManager] 配置已重新加载');
    this.initialized = true;
  }

  /**
   * 导出配置为 JSON 字符串
   */
  public exportToJSON(): string {
    this.ensureInitialized();
    return JSON5.stringify(this.connections, null, 2);
  }

  /**
   * 从 JSON/JSON5 字符串导入配置（会覆盖现有配置）
   * @param jsonString JSON/JSON5 字符串
   */
  public async importFromJSON(jsonString: string): Promise<void> {
    try {
      const data = JSON5.parse(jsonString);
      if (!Array.isArray(data)) {
        throw new Error('无效的连接配置文件格式，应为数组');
      }
      this.connections = data as DBConnection[];
      await this.persist();
      logger.info('[DBConnectionManager] 导入配置成功，共 %d 个连接', this.connections.length);
    } catch (error) {
      logger.error(error, '[DBConnectionManager] 导入配置失败');
      throw error;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 确保管理器已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('[DBConnectionManager] 管理器未初始化，请先调用 initialize()');
    }
  }

  /**
   * 从文件加载配置
   */
  private async loadFromFile(): Promise<void> {
    try {
      const data = await fs.promises.readFile(this.configFilePath, 'utf-8');
      const parsed = JSON5.parse(data) as DBConnection[];
      this.connections = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.error(error, '[DBConnectionManager] 加载配置文件失败');
      this.connections = [];
    }
  }

  /**
   * 保存配置到文件
   */
  private async persist(): Promise<void> {
    await this.saveToFile(this.connections);
  }

  /**
   * 保存数据到文件
   */
  private async saveToFile(data: DBConnection[]): Promise<void> {
    await fs.promises.writeFile(
      this.configFilePath,
      JSON5.stringify(data, null, 2),
      'utf-8'
    );
  }

  /**
   * 清除所有连接的默认标记
   */
  private clearDefaultFlag(): void {
    this.connections.forEach(conn => {
      conn.isDefault = false;
    });
  }
}

// ==================== 导出便捷实例 ====================

export const dbConnectionManager = DBConnectionManager.getInstance();
