import { externalDB } from '../db/clients';
import {
    Oobx,
    Ooba,
    Oobb,
    Oobc,
    Oobd,
    Oobh,
    Oobi,
    Oobj,
    Oobk

} from '@prisma/client';
import { dbConnectionManager } from '../config/db-connections';
import logger from '../utils/logger';
import { queryEnt } from '../com-query/external';

/** 校验错误信息 */
export interface ValidateError {
    table: string;      // 表名
    field: string;      // 字段名
    label: string;      // 字段中文名
    value: string;      // 实际值
    message: string;    // 错误描述
}

/** 校验模式：collect-收集所有错误 | failFast-遇错即停 */
export type ValidateMode = 'collect' | 'failFast';

/** 添加校验错误，failFast 模式下返回 true 表示应立即终止 */
function pushError(errors: ValidateError[], err: ValidateError | null, mode: ValidateMode): boolean {
    if (err) {
        errors.push(err);
        return mode === 'failFast';
    }
    return false;
}

/** 解析 ent→schema 映射 */
async function resolveSchemaMap(): Promise<Record<string, string>> {
    const entRows = await queryEnt();
    const schemaMap: Record<string, string> = {};
    for (const row of entRows) {
        schemaMap[String(row.gzou001)] = String(row.gzou003);
    }
    logger.debug({ schemaMap }, 'resolveSchemaMap: ent→schema 映射');
    return schemaMap;
}

/** 
 * 校验来源集团与目标集团的 E-COM 参数是否一致
 * @param entFrom    来源集团代码
 * @param entTo      目标集团代码
 * @param schemaFrom 来源集团 schema
 * @param schemaTo   目标集团 schema
 * @returns     校验结果列表：不一致的 E-COM 参数（可能多条）
*/
async function ooaaEcomChk(entFrom: string, entTo: string, schemaFrom: string, schemaTo: string): Promise<ValidateError[]> {
    logger.debug({ entFrom, entTo, schemaFrom, schemaTo }, 'ooaaEcomChk: 开始校验 E-COM 参数双集团一致性');
    const paramCodes = ['E-COM-0001', 'E-COM-0002', 'E-COM-0003', 'E-COM-0004', 'E-COM-0005', 'E-COM-0008'];
    const errors: ValidateError[] = [];

    const sql_ooaa_from = `SELECT ooaa001, ooaa002 FROM ${schemaFrom}.ooaa_t WHERE ooaaent = '${entFrom}' AND ooaa001 IN ('${paramCodes.join("','")}')`;
    logger.debug({ sql: sql_ooaa_from }, 'ooaaEcomChk: 查询来源集团 E-COM 参数');
    const fromResult = await externalDB.query(sql_ooaa_from);
    const sql_ooaa_to = `SELECT ooaa001, ooaa002 FROM ${schemaTo}.ooaa_t WHERE ooaaent = '${entTo}' AND ooaa001 IN ('${paramCodes.join("','")}')`;
    logger.debug({ sql: sql_ooaa_to }, 'ooaaEcomChk: 查询目标集团 E-COM 参数');
    const toResult = await externalDB.query(sql_ooaa_to);

    const fromMap: Record<string, string> = {};
    for (const row of fromResult.rows as Record<string, unknown>[]) {
        fromMap[row['ooaa001'] as string] = String(row['ooaa002']);
    }

    const toMap: Record<string, string> = {};
    for (const row of toResult.rows as Record<string, unknown>[]) {
        toMap[row['ooaa001'] as string] = String(row['ooaa002']);
    }

    logger.debug({ fromMap, toMap }, 'ooaaEcomChk: 双集团 E-COM 参数值');

    for (const code of paramCodes) {
        if (fromMap[code] !== toMap[code]) {
            errors.push({
                table: 'ooaa_t',
                field: code,
                label: 'E-COM参数',
                value: `${fromMap[code] ?? ''} → ${toMap[code] ?? ''}`,
                message: `[ooaa_t] E-COM参数 ${code}：来源集团 [${entFrom}] 值为 [${fromMap[code] ?? ''}]，目标集团 [${entTo}] 值为 [${toMap[code] ?? ''}]，不一致`
            });
        }
    }

    if (errors.length > 0) {
        logger.warn({ errorCount: errors.length, errors }, 'ooaaEcomChk: E-COM 参数双集团一致性校验失败');
    } else {
        logger.debug('ooaaEcomChk: E-COM 参数双集团一致性校验通过');
    }

    return errors;
}

/** 
 * 校验单据别在目标集团是否存在，且长度是否符合 E-COM-0001 参数设定
 * @param oobx001  单据别
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobx001Chk(oobx001: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobx001, entTo, schemaTo }, 'oobx001Chk: 校验单据别在目标集团是否存在及长度');
    const sql_oobx_count = `SELECT COUNT(*) AS cnt FROM ${schemaTo}.oobx_t WHERE oobxent = '${entTo}' AND oobx001 = '${oobx001}'`;
    logger.debug({ sql: sql_oobx_count }, 'oobx001Chk: 查询单据别是否存在');
    const countResult = await externalDB.query(sql_oobx_count);
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);

    if (count === 0) {
        logger.warn({ oobx001, entTo }, 'oobx001Chk: 单据别在目标集团中不存在');
        return { table: 'oobx_t', field: 'oobx001', label: '单据别', value: oobx001, message: `[oobx_t] 单据别 [${oobx001}] 在目标集团 [${entTo}] 中不存在` };
    }

    const sql_ooaa_ecom0001 = `SELECT ooaa002 FROM ${schemaTo}.ooaa_t WHERE ooaaent = '${entTo}' AND ooaa001 = 'E-COM-0001'`;
    logger.debug({ sql: sql_ooaa_ecom0001 }, 'oobx001Chk: 查询 E-COM-0001 参数');
    const paramResult = await externalDB.query(sql_ooaa_ecom0001);
    const rows = paramResult.rows as Record<string, unknown>[];

    if (rows.length === 0) {
        logger.warn({ entTo }, 'oobx001Chk: 目标集团未配置参数 E-COM-0001');
        return { table: 'oobx_t', field: 'oobx001', label: '单据别', value: oobx001, message: `[oobx_t] 目标集团 [${entTo}] 未配置参数 E-COM-0001（单据别长度），无法校验单据别长度` };
    }

    const paramValue = Number(rows[0]['ooaa002']);
    logger.debug({ oobx001, actualLen: oobx001.length, expectedLen: paramValue }, 'oobx001Chk: 单据别长度校验');
    if (oobx001.length !== paramValue) {
        logger.warn({ oobx001, actualLen: oobx001.length, expectedLen: paramValue }, 'oobx001Chk: 单据别长度与参数设定值不符');
        return { table: 'oobx_t', field: 'oobx001', label: '单据别', value: oobx001, message: `[oobx_t] 单据别 [${oobx001}] 长度 ${oobx001.length} 与参数 E-COM-0001 设定值 ${paramValue} 不符` };
    }
    logger.debug({ oobx001 }, 'oobx001Chk: 校验通过');
    return null;
}

/** 
 * @param oobx002 模组别
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobx002Chk(oobx002: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobx002, schemaTo }, 'oobx002Chk: 校验模组别是否存在');
    const sql_gzzj_count = `SELECT COUNT(*) AS cnt FROM ${schemaTo}.gzzj_t WHERE gzzj001 = '${oobx002}'`;
    logger.debug({ sql: sql_gzzj_count }, 'oobx002Chk: 查询模组别是否存在');
    const countResult = await externalDB.query(sql_gzzj_count);
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    
    if (count === 0) {
        logger.warn({ oobx002 }, 'oobx002Chk: 模组别不存在');
        return { table: 'oobx_t', field: 'oobx002', label: '模组别', value: oobx002, message: `[oobx_t] 模组别 [${oobx002}] 在系统编码表(gzzj_t)中不存在` };
    }
    logger.debug({ oobx002 }, 'oobx002Chk: 校验通过');
    return null;
}

/** 
 * @param oobx003  单据性质
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobx003Chk(oobx003: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobx003, schemaTo }, 'oobx003Chk: 校验单据性质是否存在');
    const sql_gzcb_count = `SELECT COUNT(*) AS cnt FROM ${schemaTo}.gzcb_t WHERE gzcb001 = '24' AND gzcb002 = '${oobx003}'`;
    logger.debug({ sql: sql_gzcb_count }, 'oobx003Chk: 查询单据性质是否存在');
    const countResult = await externalDB.query(sql_gzcb_count);
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);

    if (count === 0) {
        logger.warn({ oobx003 }, 'oobx003Chk: 单据性质不存在');
        return { table: 'oobx_t', field: 'oobx003', label: '单据性质', value: oobx003, message: `[oobx_t] 单据性质 [${oobx003}] 在一般分类码表(gzcb_t, 分类码号=24)中不存在` };
    }
    logger.debug({ oobx003 }, 'oobx003Chk: 校验通过');
    return null;
}

/** 
 * @param oobx004  作业编号
 * @param oobx003  单据性质
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobx004Chk(oobx004: string, oobx003: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobx004, oobx003, schemaTo }, 'oobx004Chk: 校验对应作业编号');
    if (oobx004 === 'MULTI'){
        logger.debug('oobx004Chk: 作业编号为 MULTI，跳过校验');
        return null;
    }
    const sql_gzzz_count = `SELECT COUNT(*) AS cnt FROM ${schemaTo}.gzzz_t WHERE gzzz001 = '${oobx004}'`;
    logger.debug({ sql: sql_gzzz_count }, 'oobx004Chk: 查询作业编号是否存在');
    const countResult = await externalDB.query(sql_gzzz_count);
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);

    if (count === 0) {
        logger.warn({ oobx004 }, 'oobx004Chk: 对应作业编号不存在');
        return { table: 'oobx_t', field: 'oobx004', label: '对应作业编号', value: oobx004, message: `[oobx_t] 对应作业编号 [${oobx004}] 在程序编码表(gzzz_t)中不存在` };
    }

    const sql_gzza_join = `
        SELECT COUNT(gzza001), gzzz006, gzza002
        FROM ${schemaTo}.gzza_t 
        LEFT JOIN ${schemaTo}.gzzz_t ON gzza001 = gzzz002
        WHERE gzzz001 = '${oobx004}'
        `;
    logger.debug({ sql: sql_gzza_join }, 'oobx004Chk: 查询作业编号关联的程序模块');
    const gzzaResult = await externalDB.query(sql_gzza_join);

    const rows = gzzaResult.rows as Record<string, unknown>[];

    if (rows.length === 0) {
        logger.warn({ oobx004 }, 'oobx004Chk: 作业编号关联的程序模块查询无结果');
        return { table: 'oobx_t', field: 'oobx004', label: '对应作业编号', value: oobx004, message: `[oobx_t] 对应作业编号 [${oobx004}] 关联的程序模块(gzza_t)查询无结果` };
    }

    const gzza001Count = Number(rows[0]['gzza001']);

    if (gzza001Count === 0) {
        logger.warn({ oobx004 }, 'oobx004Chk: 作业编号关联的程序模块查询无结果');
        return { table: 'oobx_t', field: 'oobx004', label: '对应作业编号', value: oobx004, message: `[oobx_t] 对应作业编号 [${oobx004}] 关联的程序模块(gzza_t)查询无结果` };
    }

    const gzzz006 = rows[0]['gzzz006'];

    if (gzzz006 !== oobx003) {
        logger.warn({ oobx004, gzzz006, oobx003 }, 'oobx004Chk: 作业编号的单据性质与当前单据性质不匹配');
        return { table: 'oobx_t', field: 'oobx004', label: '对应作业编号', value: oobx004, message: `[oobx_t] 对应作业编号 [${oobx004}] 的单据性质 [${gzzz006}] 与当前单据性质 [${oobx003}] 不匹配` };
    }

    const gzzz002 = rows[0]['gzzz002'];

    if (gzzz002 !== 'T' && gzzz002 !== 'Q') {
        logger.warn({ oobx004, gzzz002 }, 'oobx004Chk: 作业编号的程序类型不合法');
        return { table: 'oobx_t', field: 'oobx004', label: '对应作业编号', value: oobx004, message: `[oobx_t] 对应作业编号 [${oobx004}] 的程序类型 [${gzzz002}] 不合法，仅允许 T(交易) 或 Q(查询)` };
    }

    logger.debug({ oobx004 }, 'oobx004Chk: 校验通过');

    return null;
}

/** 
 * @param oobx007  所剩流水号长度
 * @param oobx001  单据别
 * @param oobx006  期别码
 * @param dlang    当前语言
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobx007Chk(oobx007: number | null, oobx001: string, oobx006: string, dlang: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobx007, oobx001, oobx006, dlang, entTo, schemaTo }, 'oobx007Chk: 校验所剩流水号长度');
    const expected = await oobx007Get(oobx001, oobx006, dlang, entTo, schemaTo);
    if (String(oobx007 ?? '') !== expected) {
        logger.warn({ oobx007, expected }, 'oobx007Chk: 所剩流水号长度与计算值不符');
        return { table: 'oobx_t', field: 'oobx007', label: '所剩流水号长度', value: String(oobx007 ?? ''), message: `[oobx_t] 所剩流水号长度 [${oobx007 ?? ''}] 与根据 E-COM 参数计算值 [${expected}] 不符` };
    }
    logger.debug({ oobx007, expected }, 'oobx007Chk: 校验通过');
    return null;
}

/** 
 * @param oobx008  编码结果
 * @param oobx001  单据别
 * @param oobx005  控制组类型
 * @param oobx006  期别码
 * @param oobx007  所剩流水号长度
 * @param dlang    当前语言
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobx008Chk(oobx008: string | null, oobx001: string, oobx005: string, oobx006: string, oobx007: string, dlang: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobx008, oobx001, oobx005, oobx006, oobx007, dlang, entTo, schemaTo }, 'oobx008Chk: 校验编码结果');
    const expected = await oobx008Get(oobx001, oobx005, oobx006, oobx007, dlang, entTo, schemaTo);
    if (String(oobx008 ?? '') !== expected) {
        logger.warn({ oobx008, expected }, 'oobx008Chk: 编码结果与计算值不符');
        return { table: 'oobx_t', field: 'oobx008', label: '编码结果', value: String(oobx008 ?? ''), message: `[oobx_t] 编码结果 [${oobx008 ?? ''}] 与根据单据别/控制组/期别码/流水号长度计算值 [${expected}] 不符` };
    }
    logger.debug({ oobx008, expected }, 'oobx008Chk: 校验通过');
    return null;
}

/** 
 * @param oobx001  单据别
 * @param oobx006  期别码
 * @param dlang    当前语言
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     oobx007 所剩流水号长度
*/
async function oobx007Get( oobx001: string, oobx006: string, dlang: string, entTo: string, schemaTo: string): Promise<string> {
    logger.debug({ oobx001, oobx006, dlang, entTo, schemaTo }, 'oobx007Get: 计算所剩流水号长度');
    // 如果 oobx001 或 oobx006 为空，返回空字符串（对应 4GL cl_null 检查）
    if (!oobx001 || !oobx006) {
        logger.debug('oobx007Get: 单据别或期别码为空，返回空字符串');
        return '';
    }   

    // 获取参数 E-COM-0001~0005
    const sql_ooaa_params_007 = `SELECT ooaa001, ooaa002 FROM ${schemaTo}.ooaa_t WHERE ooaaent = '${entTo}' AND ooaa001 IN ('E-COM-0001','E-COM-0002','E-COM-0003','E-COM-0004','E-COM-0005')`;
    logger.debug({ sql: sql_ooaa_params_007 }, 'oobx007Get: 查询 E-COM 参数');
    const paramResult = await externalDB.query(sql_ooaa_params_007);
    const paramRows = paramResult.rows as Record<string, unknown>[];

    const paramMap: Record<string, string> = {};
    for (const row of paramRows) {
        paramMap[row['ooaa001'] as string] = String(row['ooaa002']);
    }

    logger.debug({ paramMap }, 'oobx007Get: E-COM 参数值');

    const ecom001 = Number(paramMap['E-COM-0001'] ?? 0);
    const ecom002 = paramMap['E-COM-0002'] || '';
    const ecom003 = Number(paramMap['E-COM-0003'] ?? 0);
    const ecom004 = paramMap['E-COM-0004'] || '';
    const ecom005 = Number(paramMap['E-COM-0005'] ?? 0);

    // 查询 gzcbl_t 获取字段长度
    let l_length = 0;
    const sql_gzcbl_length = `SELECT LENGTH(gzcbl004) AS col_length FROM ${schemaTo}.gzcbl_t WHERE gzcbl001 = '14' AND gzcbl002 = '${oobx006}' AND gzcbl003 = '${dlang}'`;
    logger.debug({ sql: sql_gzcbl_length }, 'oobx007Get: 查询期别字段长度');
    const lengthResult = await externalDB.query(sql_gzcbl_length);
    const lengthRows = lengthResult.rows as Record<string, unknown>[];
    if (lengthRows.length > 0 && lengthRows[0]['col_length'] != null) {
        l_length = Number(lengthRows[0]['col_length']);
    }

    logger.debug({ ecom001, ecom002, ecom003, ecom004, ecom005, l_length, oobx006 }, 'oobx007Get: 计算流水号长度的参数');

    // 计算流水号长度
    let r_oobx007: number;
    if (oobx006 === '0') {
        r_oobx007 = ecom005 - ecom003 - ecom001;
    } else {
        r_oobx007 = ecom005 - ecom003 - ecom001 - l_length;
    }

    if (ecom002 === 'Y') {
        r_oobx007 -= 1;
    }
    if (ecom004 === 'Y') {
        r_oobx007 -= 1;
    }

    logger.debug({ r_oobx007 }, 'oobx007Get: 计算完成');
    return String(r_oobx007);
}


/** 
 * @param oobx001  单据别
 * @param oobx005  控制组类型
 * @param oobx006  期别码
 * @param oobx007  所剩流水号长度
 * @param dlang    当前语言
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     oobx008 编码结果
*/
async function oobx008Get(oobx001: string, oobx005: string, oobx006: string, oobx007: string, dlang: string, entTo: string, schemaTo: string): Promise<string> {
    logger.debug({ oobx001, oobx005, oobx006, oobx007, dlang, entTo, schemaTo }, 'oobx008Get: 计算编码结果');
    let r_oobx008 = '';

    // 如果 oobx001 或 oobx006 为空，或 oobx005 不为 'Y'，返回空字符串
    if (!oobx001 || !oobx006 || oobx005 !== 'Y') {
        logger.debug({ oobx001, oobx006, oobx005 }, 'oobx008Get: 条件不满足，返回空字符串');
        return r_oobx008;
    }

    // 获取参数 E-COM-0001~0005, 0008
    const sql_ooaa_params_008 = `SELECT ooaa001, ooaa002 FROM ${schemaTo}.ooaa_t WHERE ooaaent = '${entTo}' AND ooaa001 IN ('E-COM-0001','E-COM-0002','E-COM-0003','E-COM-0004','E-COM-0005','E-COM-0008')`;
    logger.debug({ sql: sql_ooaa_params_008 }, 'oobx008Get: 查询 E-COM 参数');
    const paramResult = await externalDB.query(sql_ooaa_params_008);
    const paramRows = paramResult.rows as Record<string, unknown>[];

    const paramMap: Record<string, string> = {};
    for (const row of paramRows) {
        paramMap[row['ooaa001'] as string] = String(row['ooaa002']);
    }

    logger.debug({ paramMap }, 'oobx008Get: E-COM 参数值');

    const ecom001 = paramMap['E-COM-0001'] || '';
    const ecom002 = paramMap['E-COM-0002'] || '';
    const ecom003 = paramMap['E-COM-0003'] || '';
    const ecom004 = paramMap['E-COM-0004'] || '';
    const ecom008 = paramMap['E-COM-0008'] || '';

    // 获取期别对应语言描述
    const sql_gzcbl_desc = `SELECT gzcbl004 FROM ${schemaTo}.gzcbl_t WHERE gzcbl001 = '14' AND gzcbl002 = '${oobx006}' AND gzcbl003 = '${dlang}'`;
    logger.debug({ sql: sql_gzcbl_desc }, 'oobx008Get: 查询期别语言描述');
    const gzcblResult = await externalDB.query(sql_gzcbl_desc);
    const gzcblRows = gzcblResult.rows as Record<string, unknown>[];
    const l_gzcbl004 = gzcblRows.length > 0 ? String(gzcblRows[0]['gzcbl004']) : '';

    // 截取单据别前 ecom001 位
    const ecom001Num = Number(ecom001);
    const l_oobx001 = oobx001.substring(0, ecom001Num);

    // 单别/据点
    if (ecom008 === '1') {
        for (let i = 0; i < Number(ecom003); i++) {
            r_oobx008 += 'S';
        }
        if (ecom002 === 'Y') {
            r_oobx008 += '-';
        }
        r_oobx008 += l_oobx001;
    } else {
        r_oobx008 += l_oobx001;
        if (ecom002 === 'Y') {
            r_oobx008 += '-';
        }
        for (let i = 0; i < Number(ecom003); i++) {
            r_oobx008 += 'S';
        }
    }

    if (ecom004 === 'Y') {
        r_oobx008 += '-';
    }

    // 期别
    if (oobx006 !== '0') {
        r_oobx008 += l_gzcbl004;
    }

    // 流水号
    let p_oobx007 = oobx007;
    if (!p_oobx007) {
        p_oobx007 = await oobx007Get(oobx001, oobx006, dlang, entTo, schemaTo);
    }

    for (let i = 0; i < Number(p_oobx007); i++) {
        r_oobx008 += '9';
    }

    logger.debug({ r_oobx008 }, 'oobx008Get: 计算完成');
    return r_oobx008;
}



/** 
 * @param oobc003  控制组编号
 * @param oobc004  控制组类型
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobc003Chk(oobc003: string, oobc004: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobc003, oobc004, entTo, schemaTo }, 'oobc003Chk: 校验控制组编号');

    if (oobc004 === '8') {
        // 员工类型控制组 v_ooag001
        const sql_ooag_count = `SELECT COUNT(*) AS cnt FROM ${schemaTo}.ooag_t WHERE ooagent = '${entTo}' AND ooag001 = '${oobc003}'`;
        logger.debug({ sql: sql_ooag_count }, 'oobc003Chk: 查询员工类型控制组');
        const countResult = await externalDB.query(sql_ooag_count);
        const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
        if (count === 0) {
            logger.warn({ oobc003, oobc004: '8' }, 'oobc003Chk: 员工类型控制组编号不存在');
            return { table: 'oobc_t', field: 'oobc003', label: '控制组编号', value: oobc003, message: `[oobc_t] 控制组编号(员工类型) [${oobc003}] 在员工数据表(ooag_t)中不存在` };
        }
    } else if (oobc004 === '7'){
        // 部门类型控制组 v_ooeg001
        const sql_ooeg_count = `SELECT COUNT(*) AS cnt FROM ${schemaTo}.ooeg_t WHERE ooeg001 = '${oobc003}' AND ooegent = '${entTo}'`;
        logger.debug({ sql: sql_ooeg_count }, 'oobc003Chk: 查询部门类型控制组');
        const countResult = await externalDB.query(sql_ooeg_count);
        const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
        if (count === 0) {
            logger.warn({ oobc003, oobc004: '7' }, 'oobc003Chk: 部门类型控制组编号不存在');
            return { table: 'oobc_t', field: 'oobc003', label: '控制组编号', value: oobc003, message: `[oobc_t] 控制组编号(部门类型) [${oobc003}] 在部门数据表(ooeg_t)中不存在` };
        }
    } else{
        //  一般控制组 v_ooha001_5
        const sql_ooha_count = `SELECT COUNT(*) AS cnt FROM ${schemaTo}.ooha_t WHERE oohaent = '${entTo}' AND ooha001 = '${oobc003}' AND ooha002 = '${oobc004}'`;
        logger.debug({ sql: sql_ooha_count }, 'oobc003Chk: 查询一般类型控制组');
        const countResult = await externalDB.query(sql_ooha_count);
        const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
        if (count === 0) {
            logger.warn({ oobc003, oobc004 }, 'oobc003Chk: 一般类型控制组编号不存在');
            return { table: 'oobc_t', field: 'oobc003', label: '控制组编号', value: oobc003, message: `[oobc_t] 控制组编号(一般类型) [${oobc003}]（控制组类型 [${oobc004}]）在一般控制组表(ooha_t)中不存在` };
        }
    }
    logger.debug({ oobc003, oobc004 }, 'oobc003Chk: 校验通过');
    return null;
}

/** 
 * @param oobd003  生命周期类型
 * @param oobd004  生命周期编号
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobd004Chk(oobd003: string, oobd004: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobd003, oobd004, entTo, schemaTo }, 'oobd004Chk: 校验生命周期编号');
    // ACC 应用分类码
    const sql_oocq_oobd = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.oocq_t
        WHERE oocqent = '${entTo}'
        AND oocq001 = '${oobd003}'
        AND oocq002 = '${oobd004}'
        `;
    logger.debug({ sql: sql_oocq_oobd }, 'oobd004Chk: 查询生命周期编号');
    const countResult = await externalDB.query(sql_oocq_oobd)
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ oobd003, oobd004 }, 'oobd004Chk: 生命周期编号不存在');
        return { table: 'oobd_t', field: 'oobd004', label: '生命周期编号', value: oobd004, message: `[oobd_t] 生命周期编号 [${oobd004}]（生命周期类型 [${oobd003}]）在应用分类码表(oocq_t)中不存在` };
    }
    logger.debug({ oobd003, oobd004 }, 'oobd004Chk: 校验通过');
    return null;
}

/** 
 * @param ooba001  参照表编号
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function ooba001Chk(ooba001: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ ooba001, entTo, schemaTo }, 'ooba001Chk: 校验参照表编号');
    const sql_ooal_count = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.ooal_t
        WHERE ooal001 ='3'
        AND ooal002 = '${ooba001}'
        AND ooalent = '${entTo}'
        `;
    logger.debug({ sql: sql_ooal_count }, 'ooba001Chk: 查询参照表编号');
    const countResult = await externalDB.query(sql_ooal_count);

    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ ooba001 }, 'ooba001Chk: 参照表编号不存在');
        return { table: 'ooba_t', field: 'ooba001', label: '参照表编号', value: ooba001, message: `[ooba_t] 参照表编号 [${ooba001}] 在参照表定义表(ooal_t, 类别=3)中不存在` };
    }
    logger.debug({ ooba001 }, 'ooba001Chk: 校验通过');
    return null;
}

/** 
 * @param ooba002  单据别编号
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function ooba002Chk(ooba002: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ ooba002, entTo, schemaTo }, 'ooba002Chk: 校验单据别编号');
    const sql_oobx_count_ooba = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.oobx_t
        WHERE oobxent = '${entTo}'
        AND oobx001 = '${ooba002}'
        `;
    logger.debug({ sql: sql_oobx_count_ooba }, 'ooba002Chk: 查询单据别编号');
    const countResult = await externalDB.query(sql_oobx_count_ooba);
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ ooba002 }, 'ooba002Chk: 单据别编号不存在');
        return { table: 'ooba_t', field: 'ooba002', label: '单据别编号', value: ooba002, message: `[ooba_t] 单据别编号 [${ooba002}] 在单据别定义表(oobx_t)中不存在` };
    }
    logger.debug({ ooba002 }, 'ooba002Chk: 校验通过');
    return null;
}

/** 
 * @param oobb004  字段编号
 * @param ooba002  单据别编号
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobb004Chk(oobb004: string, ooba002: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobb004, ooba002, entTo, schemaTo }, 'oobb004Chk: 校验字段编号');
    // v_dzeb001_2
    const sql_dzeb_count = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.dzeb_t,${schemaTo}.dzac_t LEFT JOIN ${schemaTo}.gzzz_t ON dzac001 = gzzz002 
        WHERE dzeb002 = dzac002 AND dzeb001 = dzac005 AND dzeb002 = '${ooba002}' AND gzzz001 IN (SELECT oobl002 FROM ${schemaTo}.oobl_t WHERE oobl001= '${oobb004}' AND ooblent = '${entTo}')
        `;
    logger.debug({ sql: sql_dzeb_count }, 'oobb004Chk: 查询字段编号');
    const countResult = await externalDB.query(sql_dzeb_count);
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ oobb004, ooba002 }, 'oobb004Chk: 字段编号校验不通过');
        return { table: 'oobb_t', field: 'oobb004', label: '字段编号', value: oobb004, message: `[oobb_t] 字段编号 [${oobb004}] 对应的作业程序在字段默认值关联视图(v_dzeb001_2)中校验不通过` };
    }
    logger.debug({ oobb004 }, 'oobb004Chk: 校验通过');
    return null;
}

/** 
 * @param oobh003  产品分类
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobh003Chk(oobh003: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobh003, entTo, schemaTo }, 'oobh003Chk: 校验产品分类');
    const sql_rtax_count = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.rtax_t
        WHERE rtaxent = '${entTo}'
        AND (rtax001 = '${oobh003}' OR '${oobh003}' =' ')
        `;
    logger.debug({ sql: sql_rtax_count }, 'oobh003Chk: 查询产品分类');
    const countResult = await externalDB.query(sql_rtax_count);
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ oobh003 }, 'oobh003Chk: 产品分类不存在');
        return { table: 'oobh_t', field: 'oobh003', label: '产品分类', value: oobh003, message: `[oobh_t] 产品分类 [${oobh003}] 在产品分类表(rtax_t)中不存在` };
    }
    logger.debug({ oobh003 }, 'oobh003Chk: 校验通过');
    return null;
}

/** 
 * @param oobj003  库存标签编号
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @param table    表名（默认 oobj_t）
 * @param field    字段名（默认 oobj003）
 * @param label    字段中文名（默认 库存标签编号F）
 * @returns     校验结果
*/
async function oobj003Chk(oobj003: string, entTo: string, schemaTo: string, table = 'oobj_t', field = 'oobj003', label = '库存标签编号F'): Promise<ValidateError | null> {
    logger.debug({ oobj003, entTo, schemaTo, table, field, label }, 'oobj003Chk: 校验库存标签编号');
    // ACC 应用分类码
    const sql_oocq_oobj = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.oocq_t
        WHERE oocqent = '${entTo}'
        AND oocq001 = '220'
        AND oocq002 = '${oobj003}'
        `;
    logger.debug({ sql: sql_oocq_oobj }, 'oobj003Chk: 查询库存标签编号');
    const countResult = await externalDB.query(sql_oocq_oobj)
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ [field]: oobj003, table }, 'oobj003Chk: 库存标签编号不存在');
        return { table, field, label, value: oobj003, message: `[${table}] ${label} [${oobj003}] 在应用分类码表(oocq_t, ACC=220)中不存在` };
    }
    logger.debug({ [field]: oobj003 }, 'oobj003Chk: 校验通过');
    return null;
}

/** 
 * @param ooba002  单据别编号
 * @param oobi003  单身理由码
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobi003Chk(ooba002: string, oobi003: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ ooba002, oobi003, entTo, schemaTo }, 'oobi003Chk: 校验单身理由码');

    const sql_gzcb_acc = `
        SELECT gzcb004
        FROM ${schemaTo}.gzcb_t,${schemaTo}.oobx_t
        WHERE gzcb001 = 24
        AND gzcb002 = oobx003
        AND oobx001 = '${ooba002}'
        AND oobxent = '${entTo}'
        `;
    logger.debug({ sql: sql_gzcb_acc }, 'oobi003Chk: 查询单身理由码 ACC 类别');
    const accResult = await externalDB.query(sql_gzcb_acc);

    const rows = accResult.rows as Record<string, unknown>[];

    if (rows.length === 0) {
        logger.warn({ oobi003, ooba002 }, 'oobi003Chk: 单身理由码对应的应用分类码查询无结果');
        return { table: 'oobi_t', field: 'oobi003', label: '单身理由码', value: oobi003, message: `[oobi_t] 单身理由码 [${oobi003}] 对应的应用分类码(gzcb_t)查询无结果，无法确定 ACC 类别` };
    }

    const acc = rows[0]['gzcb004'];

    const sql_oocq_oobi = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.oocq_t
        WHERE oocqent = '${entTo}'
        AND oocq001 = '${acc}'
        AND oocq002 = '${oobi003}'
        `;
    logger.debug({ sql: sql_oocq_oobi }, 'oobi003Chk: 查询单身理由码是否存在');
    const countResult = await externalDB.query(sql_oocq_oobi)
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ oobi003, acc }, 'oobi003Chk: 单身理由码在应用分类码表中不存在');
        return { table: 'oobi_t', field: 'oobi003', label: '单身理由码', value: oobi003, message: `[oobi_t] 单身理由码 [${oobi003}]（ACC [${acc}]）在应用分类码表(oocq_t)中不存在` };
    }
    logger.debug({ oobi003, acc }, 'oobi003Chk: 校验通过');
    return null;
}

/**
 * @param entFrom  来源集团代码
 * @param entTo    目标集团代码
 * @param dlang    当前语言
 * @param ooba001  参照表编号
 * @param mode     校验模式：collect-收集所有错误 | failFast-遇错即停
*/
export async function validate(entFrom: string, entTo: string, dlang: string, ooba001: string, mode: ValidateMode = 'collect'): Promise<ValidateError[]> {
    logger.info({ entFrom, entTo, dlang, ooba001, mode }, 'validate: 开始执行校验');
    const errors: ValidateError[] = [];

    // 解析 ent→schema 映射
    const schemaMap = await resolveSchemaMap();
    const schemaFrom = schemaMap[entFrom] || entFrom;
    const schemaTo = schemaMap[entTo] || entTo;
    logger.debug({ schemaFrom, schemaTo }, 'validate: schema 解析结果');

    // ooaa_t: 校验 E-COM 参数双集团一致性
    logger.debug('validate: 校验 ooaa_t E-COM 参数双集团一致性');
    const ecomErrors = await ooaaEcomChk(entFrom, entTo, schemaFrom, schemaTo);
    for (const err of ecomErrors) {
        if (pushError(errors, err, mode)) return errors;
    }

    // oobx_t: 直接遍历，校验单据别字段
    logger.debug('validate: 校验 oobx_t 单据别字段');
    const sql_oobx_all = `SELECT * FROM ${schemaFrom}.oobx_t WHERE oobxent = '${entFrom}'`;
    logger.debug({ sql: sql_oobx_all }, 'validate: 查询 oobx_t');
    const oobxResult = await externalDB.query(sql_oobx_all);
    logger.debug({ rowCount: oobxResult.rows?.length }, 'validate: oobx_t 查询行数');
    for (const row of oobxResult.rows as Oobx[]) {
        if (pushError(errors, await oobx001Chk(row.oobx001, entTo, schemaTo), mode)) return errors;
        if (pushError(errors, await oobx002Chk(row.oobx002 ?? '', schemaTo), mode)) return errors;
        if (pushError(errors, await oobx003Chk(row.oobx003 ?? '', schemaTo), mode)) return errors;
        if (pushError(errors, await oobx004Chk(row.oobx004 ?? '', row.oobx003 ?? '', schemaTo), mode)) return errors;
        if (pushError(errors, await oobx007Chk(row.oobx007, row.oobx001, row.oobx006 ?? '', dlang, entTo, schemaTo), mode)) return errors;
        if (pushError(errors, await oobx008Chk(row.oobx008, row.oobx001, row.oobx005 ?? '', row.oobx006 ?? '', String(row.oobx007 ?? ''), dlang, entTo, schemaTo), mode)) return errors;
    }

    // ooba_t: 直接遍历，校验参照表字段
    logger.debug('validate: 校验 ooba_t 参照表字段');
    const sql_ooba_all = `SELECT * FROM ${schemaFrom}.ooba_t WHERE oobaent = '${entFrom}'`;
    logger.debug({ sql: sql_ooba_all }, 'validate: 查询 ooba_t');
    const oobaResult = await externalDB.query(sql_ooba_all);
    logger.debug({ rowCount: oobaResult.rows?.length }, 'validate: ooba_t 查询行数');
    for (const row of oobaResult.rows as Ooba[]) {
        if (pushError(errors, await ooba001Chk(row.ooba001, entTo, schemaTo), mode)) return errors;
        if (pushError(errors, await ooba002Chk(row.ooba002, entTo, schemaTo), mode)) return errors;
    }

    // oobb_t JOIN ooba_t: 校验字段编号
    logger.debug('validate: 校验 oobb_t 字段编号');
    const sql_oobb_join = `SELECT * FROM ${schemaFrom}.oobb_t LEFT JOIN ${schemaFrom}.ooba_t ON oobb001 = ooba001 AND oobb002 = ooba002 AND oobbent = oobaent WHERE oobbent = '${entFrom}' AND ooba001 = '${ooba001}'`;
    logger.debug({ sql: sql_oobb_join }, 'validate: 查询 oobb_t');
    const oobbResult = await externalDB.query(sql_oobb_join);
    logger.debug({ rowCount: oobbResult.rows?.length }, 'validate: oobb_t 查询行数');
    for (const row of oobbResult.rows as (Oobb & Ooba)[]) {
        if (pushError(errors, await oobb004Chk(row.oobb004 ?? '', row.ooba002, entTo, schemaTo), mode)) return errors;
    }

    // oobc_t JOIN ooba_t: 校验控制组
    logger.debug('validate: 校验 oobc_t 控制组');
    const sql_oobc_join = `SELECT * FROM ${schemaFrom}.oobc_t LEFT JOIN ${schemaFrom}.ooba_t ON oobc001 = ooba001 AND oobc002 = ooba002 AND oobcent = oobaent WHERE oobcent = '${entFrom}' AND ooba001 = '${ooba001}'`;
    logger.debug({ sql: sql_oobc_join }, 'validate: 查询 oobc_t');
    const oobcResult = await externalDB.query(sql_oobc_join);
    logger.debug({ rowCount: oobcResult.rows?.length }, 'validate: oobc_t 查询行数');
    for (const row of oobcResult.rows as (Oobc & Ooba)[]) {
        if (pushError(errors, await oobc003Chk(row.oobc003, row.oobc004 ?? '', entTo, schemaTo), mode)) return errors;
    }

    // oobd_t JOIN ooba_t: 校验生命周期
    logger.debug('validate: 校验 oobd_t 生命周期');
    const sql_oobd_join = `SELECT * FROM ${schemaFrom}.oobd_t LEFT JOIN ${schemaFrom}.ooba_t ON oobd001 = ooba001 AND oobd002 = ooba002 AND oobdent = oobaent WHERE oobdent = '${entFrom}' AND ooba001 = '${ooba001}'`;
    logger.debug({ sql: sql_oobd_join }, 'validate: 查询 oobd_t');
    const oobdResult = await externalDB.query(sql_oobd_join);
    logger.debug({ rowCount: oobdResult.rows?.length }, 'validate: oobd_t 查询行数');
    for (const row of oobdResult.rows as (Oobd & Ooba)[]) {
        if (pushError(errors, await oobd004Chk(row.oobd003, row.oobd004, entTo, schemaTo), mode)) return errors;
    }

    // oobh_t JOIN ooba_t: 校验产品分类
    logger.debug('validate: 校验 oobh_t 产品分类');
    const sql_oobh_join = `SELECT * FROM ${schemaFrom}.oobh_t LEFT JOIN ${schemaFrom}.ooba_t ON oobh001 = ooba001 AND oobh002 = ooba002 AND oobhent = oobaent WHERE oobhent = '${entFrom}' AND ooba001 = '${ooba001}'`;
    logger.debug({ sql: sql_oobh_join }, 'validate: 查询 oobh_t');
    const oobhResult = await externalDB.query(sql_oobh_join);
    logger.debug({ rowCount: oobhResult.rows?.length }, 'validate: oobh_t 查询行数');
    for (const row of oobhResult.rows as (Oobh & Ooba)[]) {
        if (pushError(errors, await oobh003Chk(row.oobh003, entTo, schemaTo), mode)) return errors;
    }

    // oobi_t JOIN ooba_t: 校验单身理由码
    logger.debug('validate: 校验 oobi_t 单身理由码');
    const sql_oobi_join = `SELECT * FROM ${schemaFrom}.oobi_t LEFT JOIN ${schemaFrom}.ooba_t ON oobi001 = ooba001 AND oobi002 = ooba002 AND oobient = oobaent WHERE oobient = '${entFrom}' AND ooba001 = '${ooba001}'`;
    logger.debug({ sql: sql_oobi_join }, 'validate: 查询 oobi_t');
    const oobiResult = await externalDB.query(sql_oobi_join);
    logger.debug({ rowCount: oobiResult.rows?.length }, 'validate: oobi_t 查询行数');
    for (const row of oobiResult.rows as (Oobi & Ooba)[]) {
        if (pushError(errors, await oobi003Chk(row.ooba002, row.oobi003, entTo, schemaTo), mode)) return errors;
    }

    // oobj_t JOIN ooba_t: 校验库存标签F
    logger.debug('validate: 校验 oobj_t 库存标签F');
    const sql_oobj_join = `SELECT * FROM ${schemaFrom}.oobj_t LEFT JOIN ${schemaFrom}.ooba_t ON oobj001 = ooba001 AND oobj002 = ooba002 AND oobjent = oobaent WHERE oobjent = '${entFrom}' AND ooba001 = '${ooba001}'`;
    logger.debug({ sql: sql_oobj_join }, 'validate: 查询 oobj_t');
    const oobjResult = await externalDB.query(sql_oobj_join);
    logger.debug({ rowCount: oobjResult.rows?.length }, 'validate: oobj_t 查询行数');
    for (const row of oobjResult.rows as (Oobj & Ooba)[]) {
        if (pushError(errors, await oobj003Chk(row.oobj003, entTo, schemaTo), mode)) return errors;
    }

    // oobk_t JOIN ooba_t: 校验库存标签T
    logger.debug('validate: 校验 oobk_t 库存标签T');
    const sql_oobk_join = `SELECT * FROM ${schemaFrom}.oobk_t LEFT JOIN ${schemaFrom}.ooba_t ON oobk001 = ooba001 AND oobk002 = ooba002 AND oobkent = oobaent WHERE oobkent = '${entFrom}' AND ooba001 = '${ooba001}'`;
    logger.debug({ sql: sql_oobk_join }, 'validate: 查询 oobk_t');
    const oobkResult = await externalDB.query(sql_oobk_join);
    logger.debug({ rowCount: oobkResult.rows?.length }, 'validate: oobk_t 查询行数');
    for (const row of oobkResult.rows as (Oobk & Ooba)[]) {
        if (pushError(errors, await oobj003Chk(row.oobk003, entTo, schemaTo, 'oobk_t', 'oobk003', '库存标签编号T'), mode)) return errors;
    }

    if (errors.length > 0) {
        logger.warn({ errorCount: errors.length, errors }, 'validate: 校验完成，存在错误');
    } else {
        logger.info('validate: 全部校验通过');
    }
    return errors;
}

// ==================== SyncAooi200Service ====================

/** 校验结果 */
export interface Aooi200ValidateResult {
    success: boolean;
    errors: ValidateError[];
    message: string;
}

/**
 * Aooi200 校验服务
 * 校验来源集团与目标集团之间的数据一致性
 */
export class SyncAooi200Service {
    /**
     * 获取所有 ENT 编号列表
     */
    public async getEntList(): Promise<number[]> {
        await this.ensureConnected();

        try {
            const result = await externalDB.query('SELECT gzou001 FROM gzou_t');
            const rows = result.rows as Record<string, unknown>[];
            return rows.map(row => Number(row.gzou001)).filter(n => !isNaN(n));
        } catch (error) {
            logger.error(error, '[SyncAooi200Service] 查询ENT列表失败');
            throw error;
        }
    }

    /**
     * 获取参照表编号列表（从 ooal_t 查询，按 ENT 过滤）
     * @param ent 集团代码
     */
    public async getOoba001List(ent: number): Promise<string[]> {
        await this.ensureConnected();

        try {
            const schemaMap = await resolveSchemaMap();
            const schema = schemaMap[String(ent)] || String(ent);
            const result = await externalDB.query(`SELECT ooal002 FROM ${schema}.ooal_t WHERE ooal001 = 3 AND ooalent = ${ent}`);
            const rows = result.rows as Record<string, unknown>[];
            return rows.map(row => String(row.ooal002));
        } catch (error) {
            logger.error(error, '[SyncAooi200Service] 查询参照表编号列表失败');
            throw error;
        }
    }

    /**
     * 执行 E-COM 参数双集团一致性检查
     * @param entFrom 来源集团代码
     * @param entTo   目标集团代码
     */
    public async runEcomCheck(entFrom: string, entTo: string): Promise<Aooi200ValidateResult> {
        await this.ensureConnected();

        try {
            const schemaMap = await resolveSchemaMap();
            const schemaFrom = schemaMap[entFrom] || entFrom;
            const schemaTo = schemaMap[entTo] || entTo;
            const errors = await ooaaEcomChk(entFrom, entTo, schemaFrom, schemaTo);
            const success = errors.length === 0;
            const message = success
                ? 'E-COM 参数双集团一致性检查通过'
                : `E-COM 参数检查完成，共 ${errors.length} 项不一致`;

            return { success, errors, message };
        } catch (error) {
            logger.error(error, '[SyncAooi200Service] E-COM 参数检查失败');
            return {
                success: false,
                errors: [],
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 执行校验
     */
    public async runValidate(
        entFrom: string,
        entTo: string,
        dlang: string,
        ooba001: string,
        mode: ValidateMode = 'collect'
    ): Promise<Aooi200ValidateResult> {
        await this.ensureConnected();

        try {
            const errors = await validate(entFrom, entTo, dlang, ooba001, mode);
            const success = errors.length === 0;
            const message = success
                ? '全部校验通过'
                : `校验完成，共 ${errors.length} 项错误`;

            return { success, errors, message };
        } catch (error) {
            logger.error(error, '[SyncAooi200Service] 执行校验失败');
            return {
                success: false,
                errors: [],
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 确保外部数据库已连接
     */
    private async ensureConnected(): Promise<void> {
        if (externalDB.isConnected) {
            return;
        }

        try {
            await dbConnectionManager.initialize();
            const defaultConn = dbConnectionManager.getDefaultConnection();

            if (!defaultConn) {
                throw new Error('未找到默认外部数据库连接配置');
            }

            await externalDB.connect(
                defaultConn.type === 'kingbase'
                    ? { type: 'kingbase', config: defaultConn.config as import('../db/clients').KingbaseConfig }
                    : { type: 'oracle', config: defaultConn.config as import('../db/clients').OracleConfig }
            );

            logger.info('[SyncAooi200Service] 外部数据库已连接: %s', defaultConn.name);
        } catch (error) {
            logger.error(error, '[SyncAooi200Service] 连接外部数据库失败');
            throw error;
        }
    }
}

// ==================== 导出便捷实例 ====================

export const syncAooi200Service = new SyncAooi200Service();
