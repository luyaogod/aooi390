import { externalDB } from '../db/clients';
import { 
    Ooba,
    Oobb,
    Oobc,
    Oobd,
    Oobh,
    Oobx,
    Oobi,
    Oobj,
    Oobk

} from '@prisma/client';

/** 
 * @param entFrom 来源集团代码
 * @param entTo   目标集团代码
 * @returns     校验结果：entFrom与entTo的E-COM参数是否一致
*/
async function ooaaEcomChk(entFrom: string, entTo: string): Promise<boolean> {
    const paramCodes = ['E-COM-0001', 'E-COM-0002', 'E-COM-0003', 'E-COM-0004', 'E-COM-0005', 'E-COM-0008'];

    const fromResult = await externalDB.query(
        `SELECT ooaa001, ooaa002 FROM ooaa_t WHERE ooaaent = '${entFrom}' AND ooaa001 IN ('${paramCodes.join("','")}')`
    );
    const toResult = await externalDB.query(
        `SELECT ooaa001, ooaa002 FROM ooaa_t WHERE ooaaent = '${entTo}' AND ooaa001 IN ('${paramCodes.join("','")}')`
    );

    const fromMap: Record<string, string> = {};
    for (const row of fromResult.rows as Record<string, unknown>[]) {
        fromMap[row['ooaa001'] as string] = String(row['ooaa002']);
    }

    const toMap: Record<string, string> = {};
    for (const row of toResult.rows as Record<string, unknown>[]) {
        toMap[row['ooaa001'] as string] = String(row['ooaa002']);
    }

    for (const code of paramCodes) {
        if (fromMap[code] !== toMap[code]) {
            return false;
        }
    }

    return true;
}

/** 
 * @param oobx001 单据别
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function oobx001Chk(oobx001: string, entTo: string): Promise<boolean> {
    // Step 1: 检查 oobx001 在 oobx_t 表中是否存在
    const countResult = await externalDB.query(
        `SELECT COUNT(*) AS cnt FROM oobx_t WHERE oobxent = '${entTo}' AND oobx001 = '${oobx001}'`
    );
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);

    if (count === 0) {
        return false; 
    }

    // Step 2: 根据参数 E-COM-0001 校验 oobx001 长度
    const paramResult = await externalDB.query(
        `SELECT ooaa002 FROM ooaa_t WHERE ooaaent = '${entTo}' AND ooaa001 = 'E-COM-0001'`
    );
    const rows = paramResult.rows as Record<string, unknown>[];

    if (rows.length === 0) {
        return false; 
    }

    const paramValue = Number(rows[0]['ooaa002']);
    return oobx001.length === paramValue;
}

/** 
 * @param oobx002 模组别
 * @returns     校验结果
*/
async function oobx002Chk(oobx002: string): Promise<boolean> {
    const countResult = await externalDB.query(
        `SELECT COUNT(*) AS cnt FROM gzzj_t WHERE gzzj001 = '${oobx002}'`
    );
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    
    return count > 0;
}

/** 
 * @param oobx003 单据性质
 * @returns     校验结果
*/
async function oobx003Chk(oobx003: string): Promise<boolean> {
    const countResult = await externalDB.query(
        `SELECT COUNT(*) AS cnt FROM gzcb_t WHERE gzcb001 = '24' AND gzcb002 = '${oobx003}'`
    );
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);

    return count > 0;
}

/** 
 * @param oobx004 作业编号
 * @param oobx003 单据性质
 * @returns     校验结果
*/
async function oobx004Chk(oobx004: string, oobx003: string): Promise<boolean> {
    if (oobx004 === 'MULTI'){
        return true;
    }
    const countResult = await externalDB.query(
        `SELECT COUNT(*) AS cnt FROM gzzz_t WHERE gzzz001 = '${oobx004}'`
    );
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    

    if (count === 0) {
        return false; 
    }

    const gzzaResult = await externalDB.query(
        `
        SELECT COUNT(gzza001), gzzz006, gzza002
        FROM gzza_t 
        LEFT JOIN gzzz_t ON gzza001 = gzzz002
        WHERE gzzz001 = '${oobx004}'
        `
    );

    const rows = gzzaResult.rows as Record<string, unknown>[];

    if (rows.length === 0) {
        return false; // 无数据
    }

    const gzza001Count = Number(rows[0]['gzza001']);

    if (gzza001Count === 0) {
        return false; // 无数据
    }

    const gzzz006 = rows[0]['gzzz006'];

    if (gzzz006 !== oobx003) {
        return false; // 单据性质不匹配
    }

    const gzzz002 = rows[0]['gzzz002'];

    if (gzzz002 !== 'T' && gzzz002 !== 'Q') {
        return false; // 仅允许 T 或 Q
    }

    return true;
}

/** 
 * @param oobx007 所剩流水号长度
 * @param oobx001 单据别
 * @param oobx006 期别码
 * @param dlang   当前语言
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function oobx007Chk(oobx007: number | null, oobx001: string, oobx006: string, dlang: string, entTo: string): Promise<boolean> {
    const expected = await oobx007Get(oobx001, oobx006, dlang, entTo);
    return String(oobx007 ?? '') === expected;
}

/** 
 * @param oobx008 编码结果
 * @param oobx001 单据别
 * @param oobx005 控制组类型
 * @param oobx006 期别码
 * @param oobx007 所剩流水号长度
 * @param dlang   当前语言
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function oobx008Chk(oobx008: string | null, oobx001: string, oobx005: string, oobx006: string, oobx007: string, dlang: string, entTo: string): Promise<boolean> {
    const expected = await oobx008Get(oobx001, oobx005, oobx006, oobx007, dlang, entTo);
    return String(oobx008 ?? '') === expected;
}

/** 
 * @param oobx001 单据别
 * @param oobx006 期别码
 * @param dlang   当前语言
 * @param entTo   集团代码
 * @returns     oobx007 所剩流水号长度
*/
async function oobx007Get( oobx001: string, oobx006: string, dlang: string, entTo: string): Promise<string> {
    // 如果 oobx001 或 oobx006 为空，返回空字符串（对应 4GL cl_null 检查）
    if (!oobx001 || !oobx006) {
        return '';
    }   

    // 获取参数 E-COM-0001~0005
    const paramResult = await externalDB.query(
        `SELECT ooaa001, ooaa002 FROM ooaa_t WHERE ooaaent = '${entTo}' AND ooaa001 IN ('E-COM-0001','E-COM-0002','E-COM-0003','E-COM-0004','E-COM-0005')`
    );
    const paramRows = paramResult.rows as Record<string, unknown>[];

    const paramMap: Record<string, string> = {};
    for (const row of paramRows) {
        paramMap[row['ooaa001'] as string] = String(row['ooaa002']);
    }

    const ecom001 = Number(paramMap['E-COM-0001'] ?? 0);
    const ecom002 = paramMap['E-COM-0002'] || '';
    const ecom003 = Number(paramMap['E-COM-0003'] ?? 0);
    const ecom004 = paramMap['E-COM-0004'] || '';
    const ecom005 = Number(paramMap['E-COM-0005'] ?? 0);

    // 查询 gzcbl_t 获取字段长度
    let l_length = 0;
    const lengthResult = await externalDB.query(
        `SELECT LENGTH(gzcbl004) AS col_length FROM gzcbl_t WHERE gzcbl001 = '14' AND gzcbl002 = '${oobx006}' AND gzcbl003 = '${dlang}'`
    );
    const lengthRows = lengthResult.rows as Record<string, unknown>[];
    if (lengthRows.length > 0 && lengthRows[0]['col_length'] != null) {
        l_length = Number(lengthRows[0]['col_length']);
    }

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

    return String(r_oobx007);
}


/** 
 * @param oobx001 单据别
 * @param oobx005 控制组类型
 * @param oobx006 期别码
 * @param oobx007 所剩流水号长度
 * @param dlang   当前语言
 * @param entTo   集团代码
 * @returns     oobx008 编码结果
*/
async function oobx008Get(oobx001: string, oobx005: string, oobx006: string, oobx007: string, dlang: string, entTo: string): Promise<string> {
    let r_oobx008 = '';

    // 如果 oobx001 或 oobx006 为空，或 oobx005 不为 'Y'，返回空字符串
    if (!oobx001 || !oobx006 || oobx005 !== 'Y') {
        return r_oobx008;
    }

    // 获取参数 E-COM-0001~0005, 0008
    const paramResult = await externalDB.query(
        `SELECT ooaa001, ooaa002 FROM ooaa_t WHERE ooaaent = '${entTo}' AND ooaa001 IN ('E-COM-0001','E-COM-0002','E-COM-0003','E-COM-0004','E-COM-0005','E-COM-0008')`
    );
    const paramRows = paramResult.rows as Record<string, unknown>[];

    const paramMap: Record<string, string> = {};
    for (const row of paramRows) {
        paramMap[row['ooaa001'] as string] = String(row['ooaa002']);
    }

    const ecom001 = paramMap['E-COM-0001'] || '';
    const ecom002 = paramMap['E-COM-0002'] || '';
    const ecom003 = paramMap['E-COM-0003'] || '';
    const ecom004 = paramMap['E-COM-0004'] || '';
    const ecom008 = paramMap['E-COM-0008'] || '';

    // 获取期别对应语言描述
    const gzcblResult = await externalDB.query(
        `SELECT gzcbl004 FROM gzcbl_t WHERE gzcbl001 = '14' AND gzcbl002 = '${oobx006}' AND gzcbl003 = '${dlang}'`
    );
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
        p_oobx007 = await oobx007Get(oobx001, oobx006, dlang, entTo);
    }

    for (let i = 0; i < Number(p_oobx007); i++) {
        r_oobx008 += '9';
    }

    return r_oobx008;
}



/** 
 * @param oobc003 控制组编号
 * @param oobc004 控制组类型
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function oobc003Chk(oobc003: string, oobc004: string, entTo: string): Promise<boolean> {

    if (oobc004 === '8') {
        // 员工类型控制组 v_ooag001
        const countResult = await externalDB.query(
            `SELECT COUNT(*) AS cnt FROM ooag_t WHERE ooagent = '${entTo}' AND ooag001 = '${oobc003}'`
        );
        const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
        return count > 0;
    } else if (oobc004 === '7'){
        // 部门类型控制组 v_ooeg001
        const countResult = await externalDB.query(
            `SELECT COUNT(*) AS cnt FROM ooeg_t WHERE ooeg001 = '${oobc003}' AND ooegent = '${entTo}'`
        );
        const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
        return count > 0;
    } else{
        //  一般控制组 v_ooha001_5
        const countResult = await externalDB.query(
            `SELECT COUNT(*) AS cnt FROM ooha_t WHERE oohaent = '${entTo}' AND ooha001 = '${oobc003}' AND ooha002 = '${oobc004}'`
        );
        const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
        return count > 0;
    }
}

/** 
 * @param oobd003 生命周期类型
 * @param oobd004 生命周期编号
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function oobd004Chk(oobd003: string, oobd004: string, entTo: string): Promise<boolean> {
    // ACC 应用分类码
    const countResult = await externalDB.query(
        `
        SELECT COUNT(*) AS cnt FROM oocq_t
        WHERE oocqent = '${entTo}'
        AND oocq001 = '${oobd003}'
        AND oocq002 = '${oobd004}'
        `
    )
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    return count > 0;
}

/** 
 * @param ooba001 参照表编号
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function ooba001Chk(ooba001: string, entTo: string): Promise<boolean> {
    const countResult = await externalDB.query(
        `
        SELECT COUNT(*) AS cnt FROM ooal_t
        WHERE ooal001 ='3'
        AND ooal002 = '${ooba001}'
        AND ooalent = '${entTo}'
        `
    );

    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    return count > 0;
}

/** 
 * @param ooba002 单据别编号
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function ooba002Chk(ooba002: string, entTo: string): Promise<boolean> {
    const countResult = await externalDB.query(
        `
        SELECT COUNT(*) AS cnt FROM oobx_t
        WHERE oobxent = '${entTo}'
        AND oobx001 = '${ooba002}'
        `
    );
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    return count > 0;
}

/** 
 * @param oobb004 字段编号
 * @param ooba002 单据别编号
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function oobb004Chk(oobb004: string, ooba002: string, entTo: string): Promise<boolean> {
    // v_dzeb001_2
    const countResult = await externalDB.query(
        `
        SELECT COUNT(*) AS cnt FROM dzeb_t,dzac_t LEFT JOIN gzzz_t ON dzac001 = gzzz002 
        WHERE dzeb002 = dzac002 AND dzeb001 = dzac005 AND dzeb002 = '${ooba002}' AND gzzz001 IN (SELECT oobl002 FROM oobl_t WHERE oobl001= '${oobb004}' AND ooblent = '${entTo}')
        `
    );
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    return count > 0;
}

/** 
 * @param oobh003 产品分类
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function oobh003Chk(oobh003: string, entTo: string): Promise<boolean> {
    const countResult = await externalDB.query(
        `
        SELECT COUNT(*) AS cnt FROM rtax_t
        WHERE rtaxent = '${entTo}'
        AND (rtax001 = '${oobh003}' OR '${oobh003}' =' ')
        `
    );
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    return count > 0;
}

/** 
 * @param oobj003 产品编号
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function oobj003Chk(oobj003: string, entTo: string): Promise<boolean> {
    // ACC 应用分类码
    const countResult = await externalDB.query(
        `
        SELECT COUNT(*) AS cnt FROM oocq_t
        WHERE oocqent = '${entTo}'
        AND oocq001 = '220'
        AND oocq002 = '${oobj003}'
        `
    )
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    return count > 0;
}

/** 
 * @param ooba002 单据别编号
 * @param oobi003 单身理由码
 * @param entTo   集团代码
 * @returns     校验结果
*/
async function oobi003Chk(ooba002: string, oobi003: string, entTo: string): Promise<boolean> {

    const accResult = await externalDB.query(
        `
        SELECT gzcb004
        FROM gzcb_t,oobx_t
        WHERE gzcb001 = 24
        AND gzcb002 = oobx003
        AND oobx001 = '${ooba002}'
        AND oobxent = '${entTo}'
        `
    );

    const rows = accResult.rows as Record<string, unknown>[];

    if (rows.length === 0) {
        return false; // 无数据
    }

    const acc = rows[0]['gzcb004'];

    const countResult = await externalDB.query(
        `
        SELECT COUNT(*) AS cnt FROM oocq_t
        WHERE oocqent = '${entTo}'
        AND oocq001 = '${acc}'
        AND oocq002 = '${oobi003}'
        `
    )
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    return count > 0;
}

/**
 * @param entFrom 来源集团代码
 * @param entTo   目标集团代码
 * @param dlang   当前语言
*/
async function validate(entFrom: string, entTo: string, dlang: string) {
    // oobx_t: 直接遍历，校验单据别字段
    const oobxResult = await externalDB.query(
        `SELECT * FROM oobx_t WHERE oobxent = '${entFrom}'`
    );
    for (const row of oobxResult.rows as Oobx[]) {
        oobx001Chk(row.oobx001, entTo);
        oobx002Chk(row.oobx002 ?? '');
        oobx003Chk(row.oobx003 ?? '');
        oobx004Chk(row.oobx004 ?? '', row.oobx003 ?? '');
        oobx007Chk(row.oobx007, row.oobx001, row.oobx006 ?? '', dlang, entTo);
        oobx008Chk(row.oobx008, row.oobx001, row.oobx005 ?? '', row.oobx006 ?? '', String(row.oobx007 ?? ''), dlang, entTo);
    }

    // ooba_t: 直接遍历，校验参照表字段
    const oobaResult = await externalDB.query(
        `SELECT * FROM ooba_t WHERE oobaent = '${entFrom}'`
    );
    for (const row of oobaResult.rows as Ooba[]) {
        ooba001Chk(row.ooba001, entTo);
        ooba002Chk(row.ooba002, entTo);
    }

    // oobb_t JOIN ooba_t: 校验字段编号
    const oobbResult = await externalDB.query(
        `SELECT * FROM oobb_t LEFT JOIN ooba_t ON oobb001 = ooba001 AND oobb002 = ooba002 AND oobbent = oobaent WHERE oobbent = '${entFrom}'`
    );
    for (const row of oobbResult.rows as (Oobb & Ooba)[]) {
        oobb004Chk(row.oobb004 ?? '', row.ooba002, entTo);
    }

    // oobc_t JOIN ooba_t: 校验控制组
    const oobcResult = await externalDB.query(
        `SELECT * FROM oobc_t LEFT JOIN ooba_t ON oobc001 = ooba001 AND oobc002 = ooba002 AND oobcent = oobaent WHERE oobcent = '${entFrom}'`
    );
    for (const row of oobcResult.rows as (Oobc & Ooba)[]) {
        oobc003Chk(row.oobc003, row.oobc004 ?? '', entTo);
    }

    // oobd_t JOIN ooba_t: 校验生命周期
    const oobdResult = await externalDB.query(
        `SELECT * FROM oobd_t LEFT JOIN ooba_t ON oobd001 = ooba001 AND oobd002 = ooba002 AND oobdent = oobaent WHERE oobdent = '${entFrom}'`
    );
    for (const row of oobdResult.rows as (Oobd & Ooba)[]) {
        oobd004Chk(row.oobd003, row.oobd004, entTo);
    }

    // oobh_t JOIN ooba_t: 校验产品分类
    const oobhResult = await externalDB.query(
        `SELECT * FROM oobh_t LEFT JOIN ooba_t ON oobh001 = ooba001 AND oobh002 = ooba002 AND oobhent = oobaent WHERE oobhent = '${entFrom}'`
    );
    for (const row of oobhResult.rows as (Oobh & Ooba)[]) {
        oobh003Chk(row.oobh003, entTo);
    }

    // oobi_t JOIN ooba_t: 校验单身理由码
    const oobiResult = await externalDB.query(
        `SELECT * FROM oobi_t LEFT JOIN ooba_t ON oobi001 = ooba001 AND oobi002 = ooba002 AND oobient = oobaent WHERE oobient = '${entFrom}'`
    );
    for (const row of oobiResult.rows as (Oobi & Ooba)[]) {
        oobi003Chk(row.ooba002, row.oobi003, entTo);
    }

    // oobj_t JOIN ooba_t: 校验库存标签F
    const oobjResult = await externalDB.query(
        `SELECT * FROM oobj_t LEFT JOIN ooba_t ON oobj001 = ooba001 AND oobj002 = ooba002 AND oobjent = oobaent WHERE oobjent = '${entFrom}'`
    );
    for (const row of oobjResult.rows as (Oobj & Ooba)[]) {
        oobj003Chk(row.oobj003, entTo);
    }

    // oobj_t JOIN oobk_t: 校验库存标签T
    const oobkResult = await externalDB.query(
        `SELECT * FROM oobk_t LEFT JOIN ooba_t ON oobk001 = ooba001 AND oobk002 = ooba002 AND oobkent = oobaent WHERE oobkent = '${entFrom}'`
    );
    for (const row of oobkResult.rows as (Oobk & Ooba)[]) {
        oobj003Chk(row.oobk003, entTo);
    }
}
