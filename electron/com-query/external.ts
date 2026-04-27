import { externalDB } from '../db/clients';

/**
 * 查询企业编号以及对应的数据库schema
 * @returns [{'8888': 'dsdemo'}, {'9999': 'dsdata'}]
*/
export async function queryEnt(): Promise<Record<string, string>[]>{
    const result = await externalDB.query('SELECT gzou001, gzou003 FROM gzou_t');
    return result.rows as Record<string, string>[];
}