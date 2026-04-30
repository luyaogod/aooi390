import ExcelJS from 'exceljs';
import { externalDB, appDB } from '../db/clients';
import logger from '../utils/logger';
import { dbConnectionManager } from '../config/db-connections';
import { Oobx } from '@prisma/client';

/** 表名 → Prisma 模型名映射（注意：Prisma 模型名首字母大写） */
const tableModelMap: Record<string, string> = {
    gzzj_t: 'Gzzj',
    gzzol_t: 'Gzzol',
    gzcb_t: 'Gzcb',
    gzcbl_t: 'Gzcbl',
    gzzal_t: 'Gzzal',
    gzzz_t: 'Gzzz',
    gzza_t: 'Gzza',
};

const allTables = Object.keys(tableModelMap);

/** 各表的拉取 SQL */
const extractQueries: { table: string; sql: string }[] = [
    { table: 'gzzj_t', sql: 'SELECT * FROM gzzj_t' },
    { table: 'gzzol_t', sql: 'SELECT * FROM gzzol_t' },
    { table: 'gzcb_t', sql: "SELECT * FROM gzcb_t WHERE gzcb001 = '24'" },
    { table: 'gzcbl_t', sql: "SELECT * FROM gzcbl_t WHERE gzcbl001 IN (SELECT gzcb001 FROM gzcb_t WHERE gzcb001 = '24') ORDER BY gzcbl001" },
    { table: 'gzzal_t', sql: "SELECT * FROM gzzal_t WHERE gzzal001 IN (SELECT gzza_t.gzza001 FROM gzzz_t INNER JOIN gzza_t ON gzzz002 = gzza001 WHERE gzza002 IN ('T','Q')) ORDER BY gzzal001" },
    { table: 'gzzz_t', sql: "SELECT * FROM gzzz_t WHERE gzzz002 IN (SELECT gzza001 FROM gzza_t WHERE gzza002 IN ('T','Q') ) ORDER BY gzzz001" },
    { table: 'gzza_t', sql: "SELECT gzza_t.* FROM gzza_t WHERE gzza002 IN ('T','Q') ORDER BY gzza001" },
];

/** Prisma 标量字段类型 */
type ScalarType = 'Int' | 'Float' | 'String' | 'Boolean' | 'DateTime' | 'BigInt' | 'Decimal' | 'Json' | 'Bytes';

interface FieldMeta {
    name: string;
    type: ScalarType;
    isRequired: boolean;
}

/** 从 Prisma runtime 获取模型的字段类型映射 */
function getModelFieldMap(modelName: string): Record<string, FieldMeta> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = appDB.getPrisma() as any;

    // Prisma v6: _runtimeDataModel.models[modelName].fields
    let modelFields: any[] | undefined;
    const runtime = prisma._runtimeDataModel;
    if (runtime?.models?.[modelName]?.fields) {
        modelFields = runtime.models[modelName].fields;
    }
    // 兜底：尝试 _dmmf
    if (!modelFields && prisma._dmmf?.datamodel?.models) {
        const dmmfModel = prisma._dmmf.datamodel.models.find((m: any) => m.name === modelName);
        if (dmmfModel) modelFields = dmmfModel.fields;
    }

    if (!modelFields) {
        logger.error({ runtimeKeys: runtime ? Object.keys(runtime.models || {}) : 'undefined' },
            '[genAooi200] 无法获取模型字段: %s', modelName);
        return {};
    }

    const map: Record<string, FieldMeta> = {};
    for (const field of modelFields) {
        if (field.kind === 'scalar') {
            map[field.name] = {
                name: field.name,
                type: field.type as ScalarType,
                isRequired: field.isRequired,
            };
        }
    }
    logger.debug({ modelName, fieldNames: Object.keys(map) },
        '[genAooi200] %s 字段映射: %d 个字段', modelName, Object.keys(map).length);
    return map;
}

/** 将外部 DB 的行数据转换为 Prisma 期望的类型 */
function convertRow(row: Record<string, unknown>, fieldMap: Record<string, FieldMeta>): Record<string, unknown> {
    const converted: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(row)) {
        // Oracle 返回大写列名，Kingbase 返回小写，统一转小写后匹配 Prisma 字段名
        const meta = fieldMap[key.toLowerCase()];
        if (!meta) {
            // 字段不在模型中（可能是 JOIN 带来的额外列），跳过
            continue;
        }
        // 处理 null / undefined / 空字符串——可选字段统一转为 null
        if (raw === null || raw === undefined || raw === '') {
            converted[key] = meta.isRequired ? raw : null;
            continue;
        }
        switch (meta.type) {
            case 'Int':
                converted[key] = Number.isNaN(Number(raw)) ? null : Number(raw);
                break;
            case 'Float':
                converted[key] = Number.isNaN(Number(raw)) ? null : Number(raw);
                break;
            case 'DateTime':
                converted[key] = new Date(raw as string);
                if ((converted[key] as Date).toString() === 'Invalid Date') {
                    converted[key] = null;
                }
                break;
            case 'Boolean':
                converted[key] = raw === 'true' || raw === '1' || raw === true;
                break;
            case 'BigInt':
                converted[key] = BigInt(raw as string);
                break;
            case 'Decimal':
                converted[key] = String(raw);
                break;
            case 'Json':
                converted[key] = typeof raw === 'string' ? JSON.parse(raw) : raw;
                break;
            default:
                // String, Bytes
                converted[key] = String(raw);
        }
    }
    return converted;
}

/** modelName → Prisma client 属性名（首字母小写） */
function toClientName(modelName: string): string {
    return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/** 同步单张表 */
async function syncTable(table: string, sql: string): Promise<number> {
    const prisma = appDB.getPrisma();
    const modelName = tableModelMap[table];        // schema 名，如 Gzzj
    const clientName = toClientName(modelName);     // client 名，如 gzzj

    // 构建字段类型映射
    const fieldMap = getModelFieldMap(modelName);
    logger.debug({ fieldCount: Object.keys(fieldMap).length }, '[genAooi200] %s 模型字段映射', modelName);

    logger.debug({ sql }, '[genAooi200] 查询外部数据库: %s', table);
    const result = await externalDB.query(sql);
    const rawRows = result.rows as Record<string, unknown>[];
    logger.info({ table, rowCount: rawRows.length }, '[genAooi200] %s 查询完成', table);

    if (rawRows.length === 0) {
        logger.warn('[genAooi200] %s 无数据，跳过', table);
        return 0;
    }

    // 诊断：打印第一行的 key，用于排查列名大小写问题
    logger.debug({ sampleKeys: Object.keys(rawRows[0]), fieldMapKeys: Object.keys(fieldMap) },
        '[genAooi200] %s 外部列名 vs 模型字段名', table);

    // 类型转换
    const rows = rawRows.map(row => convertRow(row, fieldMap));

    // 写入 SQLite：清旧数据 + 插入新数据
    await prisma.$transaction(async (tx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txn = tx as any;
        await txn[clientName].deleteMany();
        await txn[clientName].createMany({ data: rows });
    });

    logger.info({ table, rowCount: rows.length }, '[genAooi200] %s 同步完成', table);
    return rows.length;
}

/**
 * 清空 SQLite 中所有 gen-aooi200 相关表数据
 */
export async function cleanSqliteTables(): Promise<void> {
    const prisma = appDB.getPrisma();
    logger.info('[genAooi200] 开始清空 SQLite 相关表');

    for (const table of allTables) {
        const modelName = tableModelMap[table];
        const clientName = toClientName(modelName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (prisma as any)[clientName].deleteMany();
        logger.info({ table, count: result.count }, '[genAooi200] 清空 %s', table);
    }

    logger.info('[genAooi200] SQLite 相关表清空完成');
}

/**
 * 从外部数据库同步 gen-aooi200 相关表到内部 SQLite
 * 每次执行前先清空本地数据，再拉取新数据
 * @param connectionName 要切换的外部数据库连接名称（可选，不传则使用当前连接或默认连接）
 * @returns 各表同步行数汇总
 */
export async function genAooi200(connectionName?: string): Promise<{ table: string; count: number }[]> {
    await ensureConnected(connectionName);
    logger.info('[genAooi200] 开始同步数据');

    // 先清空本地表，再拉取新数据
    await cleanSqliteTables();

    const results: { table: string; count: number }[] = [];

    for (const { table, sql } of extractQueries) {
        const count = await syncTable(table, sql);
        results.push({ table, count });
    }

    const total = results.reduce((sum, r) => sum + r.count, 0);
    logger.info({ total, results }, '[genAooi200] 全部同步完成');
    return results;
}

/**
 * 切换到指定的外部数据库连接
 * @param connectionName 连接名称
 */
export async function switchExternalConnection(connectionName: string): Promise<void> {
    await dbConnectionManager.initialize();
    const conn = dbConnectionManager.getConnectionByName(connectionName);

    if (!conn) {
        throw new Error(`未找到外部数据库连接: ${connectionName}`);
    }

    await externalDB.connect(
        conn.type === 'kingbase'
            ? { type: 'kingbase', config: conn.config as import('../db/clients').KingbaseConfig }
            : { type: 'oracle', config: conn.config as import('../db/clients').OracleConfig },
    );

    logger.info('[genAooi200] 已切换到外部数据库连接: %s', connectionName);
}

/**
 * 导出 AOOI200 导入模板 Excel 文件
 * 第一行 A-C 列：单据别、名称、作业编号，黄色底纹加粗
 */
export async function exportAooi200Template(filePath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    const headers = ['单据别', '名称', '作业编号'];
    const headerRow = sheet.getRow(1);

    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' },
        };
    });

    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 15;

    await workbook.xlsx.writeFile(filePath);
    logger.info('[genAooi200] 模板导出成功: %s', filePath);
}

/** 确保外部数据库已连接 */
async function ensureConnected(connectionName?: string): Promise<void> {
    if (connectionName) {
        await switchExternalConnection(connectionName);
        return;
    }

    if (externalDB.isConnected) {
        return;
    }

    await dbConnectionManager.initialize();
    const defaultConn = dbConnectionManager.getDefaultConnection();

    if (!defaultConn) {
        throw new Error('未找到默认外部数据库连接配置');
    }

    await externalDB.connect(
        defaultConn.type === 'kingbase'
            ? { type: 'kingbase', config: defaultConn.config as import('../db/clients').KingbaseConfig }
            : { type: 'oracle', config: defaultConn.config as import('../db/clients').OracleConfig },
    );

    logger.info('[genAooi200] 外部数据库已连接: %s', defaultConn.name);
}


// ==================== Aooi200QueryService ====================

/** 查询模式：external-外部数据库 | internal-内部 SQLite */
export type QueryMode = 'external' | 'internal';

/**
 * AOOI200 数据查询服务
 * 支持双模式：从外部数据库（Oracle/Kingbase）查询，或从内部 SQLite 查询
 */
export class Aooi200QueryService {
    private mode: QueryMode;

    constructor(mode: QueryMode = 'internal') {
        this.mode = mode;
    }

    /** 切换查询模式 */
    setMode(mode: QueryMode): void {
        this.mode = mode;
    }

    /** 获取当前查询模式 */
    getMode(): QueryMode {
        return this.mode;
    }

    /** 执行 SQL 查询：根据模式路由到外部 DB 或内部 SQLite */
    private async query(sql: string): Promise<Record<string, unknown>[]> {
        if (this.mode === 'external') {
            const result = await externalDB.query(sql);
            return result.rows as Record<string, unknown>[];
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (appDB.getPrisma() as any).$queryRawUnsafe(sql) as Promise<Record<string, unknown>[]>;
        }
    }

    /**
     * 根据作业编号查询单据性质
     * @param gzzz001 作业编号
     * @returns 单据性质 (gzzz006)
     */
    async gzzz006Get(gzzz001: string): Promise<string> {
        logger.debug({ mode: this.mode, gzzz001 }, '[Aooi200Query] gzzz006Get: 查询作业编号对应的单据性质');
        const sql = `
            SELECT DISTINCT gzzz006
            FROM gzzz_t
            LEFT OUTER JOIN gzzal_t ON gzzz001 = gzzal001 AND gzzal002 = 'zh_CN'
            , gzza_t
            WHERE 1=1
              AND gzzz002 = gzza001
              AND gzza002 IN ('T','Q')
              AND gzzzstus = 'Y'
              AND gzzz001 = '${gzzz001}'
            ORDER BY gzzz001, gzzal003
        `;
        logger.debug({ sql }, '[Aooi200Query] gzzz006Get: 查询 SQL');
        const rows = await this.query(sql);
        return rows.length > 0 ? String(rows[0]['gzzz006'] ?? '') : '';
    }

    /**
     * 根据单据性质查询模组
     * @param gzcb002 单据性质
     * @returns 模组 (gzcb003)
     */
    async gzcb004Get(gzcb002: string): Promise<string> {
        logger.debug({ mode: this.mode, gzcb002 }, '[Aooi200Query] gzcb004Get: 查询单据性质对应的模组');
        const sql = `
            SELECT DISTINCT gzcb003
            FROM gzcb_t
            LEFT OUTER JOIN gzcbl_t ON gzcb001 = gzcbl001 AND gzcb002 = gzcbl002 AND gzcbl003 = 'zh_CN'
            WHERE 1=1
              AND gzcb001 = '24'
              AND gzcb002 = '${gzcb002}'
            ORDER BY gzcb002
        `;
        logger.debug({ sql }, '[Aooi200Query] gzcb004Get: 查询 SQL');
        const rows = await this.query(sql);
        return rows.length > 0 ? String(rows[0]['gzcb003'] ?? '') : '';
    }

    /**
     * 校验作业编号是否存在且有效
     * @param gzzz001 作业编号
     * @returns 存在且有效则返回 true
     */
    async gzzz001Chk(gzzz001: string): Promise<boolean> {
        logger.debug({ mode: this.mode, gzzz001 }, '[Aooi200Query] gzzz001Chk: 校验作业编号是否存在');
        const sql = `
            SELECT COUNT(*) AS cnt
            FROM gzzz_t
            LEFT OUTER JOIN gzzal_t ON gzzz001 = gzzal001 AND gzzal002 = 'zh_CN'
            , gzza_t
            WHERE 1=1
              AND gzzz002 = gzza001
              AND gzza002 IN ('T','Q')
              AND gzzz001 = '${gzzz001}'
        `;
        logger.debug({ sql }, '[Aooi200Query] gzzz001Chk: 查询 SQL');
        const rows = await this.query(sql);
        const count = Number(rows[0]?.cnt ?? 0);
        logger.debug({ count }, '[Aooi200Query] gzzz001Chk: 查询结果');
        return count > 0;
    }
}

// ==================== Excel 导入 ====================

/** Excel 导入行：Oobx 字段 + oobxl003（名称，对应 Oobxl 表） */
export type OobxImportRow = Oobx & { oobxl003: string };

/**
 * 从 Excel 模板读取用户导入的数据，转换为 Oobx 行
 * A列→oobx001, B列→oobxl003, C列→oobx004
 * oobx003 通过 gzzz006Get(oobx004) 获取，oobx002 通过 gzcb004Get(oobx003) 获取
 * @param filePath Excel 文件路径
 * @param mode     查询模式（默认 internal，从内部 SQLite 查）
 * @returns Oobx 导入行数组
 */
export async function importAooi200Template(filePath: string, mode: QueryMode = 'internal'): Promise<OobxImportRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(1);
    if (!sheet) {
        throw new Error('Excel 文件中未找到工作表');
    }

    // 先收集原始数据（eachRow 同步，但后续查库是异步的）
    const rawRows: { oobx001: string; oobxl003: string; oobx004: string }[] = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 跳过表头
        const oobx001 = String(row.getCell(1).value ?? '').trim();
        if (!oobx001) return; // 跳过空行
        rawRows.push({
            oobx001,
            oobxl003: String(row.getCell(2).value ?? '').trim(),
            oobx004: String(row.getCell(3).value ?? '').trim(),
        });
    });

    logger.info({ count: rawRows.length }, '[genAooi200] 从 Excel 读取到 %d 行数据', rawRows.length);

    // 异步查库填充 oobx003、oobx002
    const svc = new Aooi200QueryService(mode);
    const rows: OobxImportRow[] = [];

    for (const raw of rawRows) {
        const oobx003 = raw.oobx004 ? await svc.gzzz006Get(raw.oobx004) : '';
        const oobx002 = oobx003 ? await svc.gzcb004Get(oobx003) : '';

        rows.push({
            oobxent: 0,
            oobx001: raw.oobx001,
            oobx002: oobx002 || null,
            oobx003: oobx003 || null,
            oobx004: raw.oobx004 || null,
            oobx005: 'Y',
            oobx006: '6',
            oobxstus: 'Y',
            oobxl003: raw.oobxl003,
        } as OobxImportRow);
    }

    logger.info({ count: rows.length }, '[genAooi200] Excel 导入解析完成，共 %d 行', rows.length);
    return rows;
}

/**
 * 将解析后的 Oobx 导入数据导出为 Excel（A-M 列）
 * A:空 B:流水号(从1开始) C:oobxstus D:oobx001 E:oobxl003 F-M:oobx002-oobx009
 * @param rows     Oobx 导入行数组
 * @param filePath 输出文件路径
 */
export async function exportAooi200Result(rows: OobxImportRow[], filePath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    // 表头
    const headers = ['', '流水号', '状态', '单据别', '名称', '模组别', '单据性质', '对应作业编号', '自动编码否', '期别码', '所剩流水号长度', '编码结果', '于aoor700揭露'];
    const headerRow = sheet.getRow(1);
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    });

    // 数据行
    rows.forEach((row, idx) => {
        const r = sheet.getRow(idx + 2);
        r.getCell(1).value = '';                    // A: 空
        r.getCell(2).value = idx + 1;               // B: 流水号
        r.getCell(3).value = row.oobxstus;          // C
        r.getCell(4).value = row.oobx001;           // D
        r.getCell(5).value = row.oobxl003;          // E
        r.getCell(6).value = row.oobx002;           // F
        r.getCell(7).value = row.oobx003;           // G
        r.getCell(8).value = row.oobx004;           // H
        r.getCell(9).value = row.oobx005;           // I
        r.getCell(10).value = row.oobx006;          // J
        r.getCell(11).value = row.oobx007;          // K
        r.getCell(12).value = row.oobx008;          // L
        r.getCell(13).value = row.oobx009;          // M
    });

    // 列宽
    sheet.getColumn(1).width = 4;
    sheet.getColumn(2).width = 8;
    sheet.getColumn(3).width = 6;
    for (let i = 4; i <= 13; i++) {
        sheet.getColumn(i).width = 16;
    }

    await workbook.xlsx.writeFile(filePath);
    logger.info('[genAooi200] 处理结果导出成功: %s，共 %d 行', filePath, rows.length);
}