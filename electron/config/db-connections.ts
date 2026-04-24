import * as fs from 'fs';
import * as path from 'path';
import { pathManager } from '../utils/paths';
import type { ExternalDBType, KingbaseConfig, OracleConfig } from '../db/clients';

// ==================== 类型定义 ====================

/**
 * 数据库连接配置基础接口
 */
export interface DBConnection {
  /** 连接唯一标识 */
  id: string;
  /** 连接名称（显示用） */
  name: string;
  /** 数据库类型 */
  type: ExternalDBType;
  /** 连接配置 */
  config: KingbaseConfig | OracleConfig;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
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

/**
 * 连接配置文件结构
 */
interface DBConnectionsFile {
  /** 配置文件版本 */
  version: string;
  /** 连接列表 */
  connections: DBConnection[];
  /** 最后更新时间 */
  lastUpdated: string;
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
    this.configFilePath = pathManager.getConfigFile('db-connections.json');
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
        await this.saveToFile({
          version: '1.0.0',
          connections: [],
          lastUpdated: new Date().toISOString(),
        });
      }

      // 加载配置
      await this.loadFromFile();
      this.initialized = true;
      console.log('[DBConnectionManager] 初始化成功，配置文件路径:', this.configFilePath);
    } catch (error) {
      console.error('[DBConnectionManager] 初始化失败:', error);
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
   * 根据 ID 获取连接配置
   * @param id 连接 ID
   */
  public getConnectionById(id: string): DBConnection | null {
    this.ensureInitialized();
    return this.connections.find(conn => conn.id === id) || null;
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

    // 生成唯一 ID
    const id = this.generateId();

    // 如果设置为默认，取消其他默认连接
    if (request.isDefault) {
      this.clearDefaultFlag();
    }

    const now = new Date().toISOString();
    const connection: DBConnection = {
      id,
      name: request.name,
      type: request.type,
      config: request.config,
      createdAt: now,
      updatedAt: now,
      isDefault: request.isDefault || false,
      description: request.description,
    };

    this.connections.push(connection);
    await this.persist();

    console.log('[DBConnectionManager] 创建连接成功:', connection.name);
    return connection;
  }

  /**
   * 更新连接配置
   * @param id 连接 ID
   * @param request 更新请求
   */
  public async updateConnection(id: string, request: UpdateConnectionRequest): Promise<DBConnection | null> {
    this.ensureInitialized();

    const index = this.connections.findIndex(conn => conn.id === id);
    if (index === -1) {
      console.warn('[DBConnectionManager] 未找到连接:', id);
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

    connection.updatedAt = new Date().toISOString();

    await this.persist();
    console.log('[DBConnectionManager] 更新连接成功:', connection.name);
    return connection;
  }

  /**
   * 删除连接配置
   * @param id 连接 ID
   */
  public async deleteConnection(id: string): Promise<boolean> {
    this.ensureInitialized();

    const index = this.connections.findIndex(conn => conn.id === id);
    if (index === -1) {
      console.warn('[DBConnectionManager] 未找到连接:', id);
      return false;
    }

    const connection = this.connections[index];
    this.connections.splice(index, 1);
    await this.persist();

    console.log('[DBConnectionManager] 删除连接成功:', connection.name);
    return true;
  }

  /**
   * 设置默认连接
   * @param id 连接 ID
   */
  public async setDefaultConnection(id: string): Promise<boolean> {
    this.ensureInitialized();

    const connection = this.connections.find(conn => conn.id === id);
    if (!connection) {
      console.warn('[DBConnectionManager] 未找到连接:', id);
      return false;
    }

    this.clearDefaultFlag();
    connection.isDefault = true;
    connection.updatedAt = new Date().toISOString();

    await this.persist();
    console.log('[DBConnectionManager] 设置默认连接成功:', connection.name);
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
   * 导出配置为 JSON 字符串
   */
  public exportToJSON(): string {
    this.ensureInitialized();
    return JSON.stringify({
      version: '1.0.0',
      connections: this.connections,
      lastUpdated: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * 从 JSON 字符串导入配置（会覆盖现有配置）
   * @param jsonString JSON 字符串
   */
  public async importFromJSON(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString) as DBConnectionsFile;
      if (!data.connections || !Array.isArray(data.connections)) {
        throw new Error('无效的连接配置文件格式');
      }
      this.connections = data.connections;
      await this.persist();
      console.log('[DBConnectionManager] 导入配置成功，共', this.connections.length, '个连接');
    } catch (error) {
      console.error('[DBConnectionManager] 导入配置失败:', error);
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
      const parsed = JSON.parse(data) as DBConnectionsFile;
      this.connections = parsed.connections || [];
    } catch (error) {
      console.error('[DBConnectionManager] 加载配置文件失败:', error);
      this.connections = [];
    }
  }

  /**
   * 保存配置到文件
   */
  private async persist(): Promise<void> {
    const data: DBConnectionsFile = {
      version: '1.0.0',
      connections: this.connections,
      lastUpdated: new Date().toISOString(),
    };
    await this.saveToFile(data);
  }

  /**
   * 保存数据到文件
   */
  private async saveToFile(data: DBConnectionsFile): Promise<void> {
    await fs.promises.writeFile(
      this.configFilePath,
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
