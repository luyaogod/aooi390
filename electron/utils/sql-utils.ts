import { externalDB } from '../db/clients';
import type { BindParameters } from 'oracledb';

/**
 * Validate that a string is a safe SQL identifier.
 * Only allows alphanumeric + underscore, must start with letter or underscore.
 */
export function validateIdentifier(name: string, label = 'identifier'): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error(`Invalid SQL ${label}: "${name}"`);
    }
    return name;
}

/**
 * Escape a string value for safe SQL literal usage.
 * Doubles single quotes per SQL standard.
 */
export function escapeStr(v: string): string {
    return v.replace(/'/g, "''");
}

// ---- Internal parameter converters ----

function toPgParams(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
    let i = 0;
    return {
        sql: sql.replace(/\?/g, () => `$${++i}`),
        params,
    };
}

function toOracleParams(sql: string, params: unknown[]): { sql: string; params: BindParameters } {
    const bind: Record<string, unknown> = {};
    let i = 0;
    const oraSql = sql.replace(/\?/g, () => {
        const name = `p${i}`;
        bind[name] = params[i];
        i++;
        return `:${name}`;
    });
    return { sql: oraSql, params: bind as BindParameters };
}

// ---- Public safe query functions ----

/**
 * Execute a parameterized SELECT query against the external database.
 * Uses `?` placeholders which are converted to the DB-specific format.
 */
export async function safeQuery(
    sql: string,
    params: unknown[] = [],
): Promise<Record<string, unknown>[]> {
    const dbType = externalDB.dbType;
    if (dbType === 'kingbase') {
        const { sql: pgSql, params: pgParams } = toPgParams(sql, params);
        const result = await externalDB.queryKingbase(pgSql, pgParams);
        return (result.rows ?? []) as Record<string, unknown>[];
    }
    if (dbType === 'oracle') {
        const { sql: oraSql, params: oraParams } = toOracleParams(sql, params);
        const result = await externalDB.queryOracle(oraSql, oraParams);
        return (result.rows ?? []) as Record<string, unknown>[];
    }
    throw new Error(`[sql-utils] Unsupported DB type: ${dbType}`);
}

/**
 * Execute a parameterized DML/DDL statement (INSERT/UPDATE/DELETE etc.).
 * Uses `?` placeholders which are converted to the DB-specific format.
 */
export async function safeExec(
    sql: string,
    params: unknown[] = [],
): Promise<{ rowCount?: number; rowsAffected?: number }> {
    const dbType = externalDB.dbType;
    if (dbType === 'kingbase') {
        const { sql: pgSql, params: pgParams } = toPgParams(sql, params);
        const result = await externalDB.queryKingbase(pgSql, pgParams);
        return { rowCount: (result as { rowCount?: number }).rowCount };
    }
    if (dbType === 'oracle') {
        const { sql: oraSql, params: oraParams } = toOracleParams(sql, params);
        const result = await externalDB.queryOracle(oraSql, oraParams);
        return { rowsAffected: result.rowsAffected };
    }
    throw new Error(`[sql-utils] Unsupported DB type: ${dbType}`);
}

/**
 * Execute a transaction against the external database.
 * The callback receives a parameterized `exec` function.
 *
 * Usage:
 *   await safeTransaction(async (exec) => {
 *     await exec('DELETE FROM t WHERE id = ?', id);
 *     await exec('INSERT INTO t (id, name) VALUES (?, ?)', id, name);
 *   });
 */
export async function safeTransaction<T>(
    fn: (exec: (sql: string, ...params: unknown[]) => Promise<void>) => Promise<T>,
): Promise<T> {
    const dbType = externalDB.dbType;
    if (dbType === 'kingbase') {
        return externalDB.transactionKingbase(async (client) => {
            return fn(async (sql, ...params) => {
                const { sql: pgSql, params: pgParams } = toPgParams(sql, params);
                await client.query(pgSql, pgParams);
            });
        });
    }
    if (dbType === 'oracle') {
        return externalDB.transactionOracle(async (connection) => {
            return fn(async (sql, ...params) => {
                const { sql: oraSql, params: oraParams } = toOracleParams(sql, params);
                await connection.execute(oraSql as string, oraParams);
            });
        });
    }
    throw new Error(`[sql-utils] Unsupported DB type: ${dbType}`);
}
