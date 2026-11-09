import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '../../node_modules/.prisma/postgres-client/index.js';

const TABLES = [
  'User',
  'Customer',
  'MaterialRate',
  'MachineRate',
  'LabourRate',
  'RFQ',
  'Part',
  'PartOperation',
  'Quote',
  'QuoteVolumeTier',
  'QuoteRateSnapshot',
  'AiExtraction',
  'HistoricalQuote',
  'AuditLog',
] as const;
const EXPECTED_FOREIGN_KEYS = 14;

const DATE_COLUMNS: Record<(typeof TABLES)[number], string[]> = {
  User: ['createdAt', 'updatedAt'],
  Customer: ['createdAt', 'updatedAt'],
  MaterialRate: ['effectiveFrom', 'effectiveTo', 'createdAt', 'updatedAt'],
  MachineRate: ['effectiveFrom', 'effectiveTo', 'createdAt', 'updatedAt'],
  LabourRate: ['effectiveFrom', 'effectiveTo', 'createdAt', 'updatedAt'],
  RFQ: ['targetDueDate', 'receivedDate', 'createdAt', 'updatedAt'],
  Part: ['createdAt', 'updatedAt'],
  PartOperation: ['createdAt', 'updatedAt'],
  Quote: ['approvedAt', 'createdAt', 'updatedAt'],
  QuoteVolumeTier: ['createdAt'],
  QuoteRateSnapshot: ['capturedAt'],
  AiExtraction: ['createdAt'],
  HistoricalQuote: ['quotedDate', 'createdAt'],
  AuditLog: ['createdAt'],
};

const BOOLEAN_COLUMNS: Partial<Record<(typeof TABLES)[number], string[]>> = {
  MaterialRate: ['isActive'],
  MachineRate: ['isActive'],
  LabourRate: ['isActive'],
  Quote: ['requiresApproval'],
  AiExtraction: ['reviewed'],
};

const SQLITE_EXPORT = String.raw`
import json, sqlite3, sys
path = sys.argv[1]
tables = json.loads(sys.argv[2])
conn = sqlite3.connect('file:' + path.replace('\\', '/') + '?mode=ro', uri=True)
conn.row_factory = sqlite3.Row
violations = [tuple(row) for row in conn.execute('PRAGMA foreign_key_check')]
result = {'foreignKeyViolations': violations, 'tables': {}}
for table in tables:
    columns = [row['name'] for row in conn.execute('PRAGMA table_info("' + table + '")')]
    rows = [dict(row) for row in conn.execute('SELECT * FROM "' + table + '" ORDER BY "id"')]
    result['tables'][table] = {'columns': columns, 'rows': rows}
print(json.dumps(result, separators=(',', ':'), ensure_ascii=False))
conn.close()
`;

type ExportTable = {
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
};

type SqliteExport = {
  foreignKeyViolations: unknown[];
  tables: Record<(typeof TABLES)[number], ExportTable>;
};

const quoteIdentifier = (identifier: string): string => {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error('Unexpected SQLite identifier in migration export');
  }
  return `"${identifier}"`;
};

function readSqliteSource(): SqliteExport {
  const sourcePath = resolve(process.cwd(), '..', 'prisma', 'dev.db');
  const output = execFileSync(
    process.env.PYTHON ?? 'python',
    ['-c', SQLITE_EXPORT, sourcePath, JSON.stringify(TABLES)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(output) as SqliteExport;
}

function normalizeSourceValue(
  table: (typeof TABLES)[number],
  column: string,
  value: unknown,
): unknown {
  if (BOOLEAN_COLUMNS[table]?.includes(column)) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    throw new Error(`Invalid source boolean found in ${table}.${column}`);
  }
  if (value === null || !DATE_COLUMNS[table].includes(column)) return value;
  const millis =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Date.parse(value)
        : Number.NaN;
  if (!Number.isFinite(millis)) {
    throw new Error(`Invalid source timestamp found in ${table}.${column}`);
  }
  return millis;
}

function normalizePostgresValue(
  table: (typeof TABLES)[number],
  column: string,
  value: unknown,
): unknown {
  if (BOOLEAN_COLUMNS[table]?.includes(column)) {
    if (typeof value !== 'boolean') {
      throw new Error(`Invalid PostgreSQL boolean found in ${table}.${column}`);
    }
    return value;
  }
  if (value === null || !DATE_COLUMNS[table].includes(column)) return value;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`Invalid PostgreSQL timestamp found in ${table}.${column}`);
  }
  return value.getTime();
}

function normalizeRow(
  table: (typeof TABLES)[number],
  columns: string[],
  row: Record<string, unknown>,
  normalizeValue: (table: (typeof TABLES)[number], column: string, value: unknown) => unknown,
): unknown[] {
  return columns.map((column) => normalizeValue(table, column, row[column]));
}

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    if (typeof code === 'string' && /^[A-Z0-9]+$/.test(code)) return code;
  }
  return error instanceof Error ? error.name : 'UnknownError';
}

// async function verifySourceRows(
//   source: SqliteExport,
//   getRows: (
//     table: (typeof TABLES)[number],
//     columns: string[],
//   ) => Promise<Array<Record<string, unknown>>>,
// ): Promise<Record<string, number>> {
//   const counts: Record<string, number> = {};
//   for (const table of TABLES) {
//     const { columns, rows: sourceRows } = source.tables[table];
//     const targetRows = await getRows(table, columns);
//     if (targetRows.length !== sourceRows.length) {
//       throw new Error(`Row count mismatch in ${table}`);
//     }
//     for (let index = 0; index < sourceRows.length; index += 1) {
//       const expected = normalizeRow(table, columns, sourceRows[index], normalizeSourceValue);
//       const actual = normalizeRow(table, columns, targetRows[index], normalizePostgresValue);
//       if (JSON.stringify(actual) !== JSON.stringify(expected)) {
//         throw new Error(`Data mismatch in ${table}`);
//       }
//     }
//     counts[table] = targetRows.length;
//   }
//   return counts;
// }

async function verifySourceRows(
  source: SqliteExport,
  getRows: (
    table: (typeof TABLES)[number],
    columns: string[],
  ) => Promise<Array<Record<string, unknown>>>,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const table of TABLES) {
    const { columns, rows: sourceRows } = source.tables[table];
    const targetRows = await getRows(table, columns);

    // Index PostgreSQL records by their primary key.
    const targetById = new Map<string, Record<string, unknown>>();

    for (const row of targetRows) {
      if (typeof row.id !== 'string') {
        throw new Error(`Invalid PostgreSQL ID found in ${table}`);
      }

      if (targetById.has(row.id)) {
        throw new Error(`Duplicate PostgreSQL ID found in ${table}`);
      }

      targetById.set(row.id, row);
    }

    // Every SQLite source record must exist and match in PostgreSQL.
    // Additional valid PostgreSQL records are allowed.
    for (const sourceRow of sourceRows) {
      const sourceId = sourceRow.id;

      if (typeof sourceId !== 'string') {
        throw new Error(`Invalid SQLite source ID found in ${table}`);
      }

      const targetRow = targetById.get(sourceId);

      if (!targetRow) {
        throw new Error(`Missing source row in ${table}: ${sourceId}`);
      }

      const expected = normalizeRow(
        table,
        columns,
        sourceRow,
        normalizeSourceValue,
      );

      const actual = normalizeRow(
        table,
        columns,
        targetRow,
        normalizePostgresValue,
      );

      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Data mismatch in ${table}: ${sourceId}`);
      }
    }

    counts[table] = targetRows.length;
  }

  return counts;
}


async function main(): Promise<void> {
  if (!/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol');
  }

  const source = readSqliteSource();
  if (source.foreignKeyViolations.length > 0) {
    throw new Error('SQLite source has foreign-key violations; import stopped');
  }

  for (const table of TABLES) {
    const entry = source.tables[table];
    if (!entry || !entry.columns.includes('id')) {
      throw new Error(`SQLite source table ${table} is missing or has no id column`);
    }
    for (const row of entry.rows) {
      if (entry.columns.some((column) => !(column in row))) {
        throw new Error(`SQLite source table ${table} has an incomplete row`);
      }
    }
  }

  const prisma = new PrismaClient({ log: ['error'] });
  try {
    if (process.argv.includes('--verify-only')) {
      const counts = await verifySourceRows(source, async (table, columns) => {
        const selectedColumns = columns.map(quoteIdentifier).join(', ');
        return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT ${selectedColumns} FROM ${quoteIdentifier(table)} ORDER BY "id"`,
        );
      });
      const postgresTables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = current_schema()
        ORDER BY tablename
      `;
      const expectedTables = [...TABLES].sort();
      const actualTables = postgresTables
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .sort();
      if (
        actualTables.length !== expectedTables.length ||
        actualTables.some((name, index) => name !== expectedTables[index]) ||
        !postgresTables.some(({ tablename }) => tablename === '_prisma_migrations')
      ) {
        throw new Error('PostgreSQL application table set does not match the migration schema');
      }

      const foreignKeys = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM pg_constraint
        WHERE contype = 'f'
          AND connamespace = current_schema()::regnamespace
          AND convalidated
      `;
      const validatedForeignKeys = Number(foreignKeys[0]?.count ?? 0);
      if (validatedForeignKeys !== EXPECTED_FOREIGN_KEYS) {
        throw new Error('PostgreSQL foreign-key constraints are missing or unvalidated');
      }

      console.log(
        JSON.stringify({
          status: 'verified',
          mode: 'read-only',
          counts,
          applicationTableCount: actualTables.length,
          prismaMigrationTable: true,
          validatedForeignKeyCount: validatedForeignKeys,
          allFieldsMatch: true,
        }),
      );
      return;
    }

    const before = await Promise.all(
      TABLES.map(async (table) => {
        const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*)::bigint AS "count" FROM ${quoteIdentifier(table)}`,
        );
        return [table, Number(rows[0].count)] as const;
      }),
    );
    const populated = before.filter(([, count]) => count !== 0);
    if (populated.length > 0) {
      throw new Error('PostgreSQL application tables are not empty; import stopped');
    }

    await prisma.$transaction(
      async (tx) => {
        for (const table of TABLES) {
          const rows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
            `SELECT COUNT(*)::bigint AS "count" FROM ${quoteIdentifier(table)}`,
          );
          if (Number(rows[0].count) !== 0) {
            throw new Error('PostgreSQL application tables are not empty; import stopped');
          }
        }

        for (const table of TABLES) {
          const entry = source.tables[table];
          const columns = entry.columns;
          if (columns.some((column) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(column))) {
            throw new Error(`Unexpected column identifier in ${table}`);
          }

          for (let start = 0; start < entry.rows.length; start += 100) {
            const batch = entry.rows.slice(start, start + 100);
            const names = columns.map(quoteIdentifier).join(', ');
            const valueRows = batch.map((_, rowIndex) => {
              const placeholders = columns.map(
                (_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`,
              );
              return `(${placeholders.join(', ')})`;
            });
            const values = batch.flatMap((row) =>
              columns.map((column) => {
                const value = row[column];
                if (BOOLEAN_COLUMNS[table]?.includes(column)) {
                  if (value === true || value === 1) return true;
                  if (value === false || value === 0) return false;
                  throw new Error(`Invalid source boolean found in ${table}.${column}`);
                }
                if (value === null || !DATE_COLUMNS[table].includes(column)) return value;
                const millis =
                  typeof value === 'number'
                    ? value
                    : typeof value === 'string'
                      ? Date.parse(value)
                      : Number.NaN;
                if (!Number.isFinite(millis)) {
                  throw new Error(`Invalid source timestamp found in ${table}.${column}`);
                }
                return new Date(millis);
              }),
            );
            await tx.$executeRawUnsafe(
              `INSERT INTO ${quoteIdentifier(table)} (${names}) VALUES ${valueRows.join(', ')}`,
              ...values,
            );
          }
        }

        await verifySourceRows(source, async (table, columns) => {
          const selectedColumns = columns.map(quoteIdentifier).join(', ');
          return tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT ${selectedColumns} FROM ${quoteIdentifier(table)} ORDER BY "id"`,
          );
        });
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    const counts = await verifySourceRows(source, async (table, columns) => {
      const selectedColumns = columns.map(quoteIdentifier).join(', ');
      return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT ${selectedColumns} FROM ${quoteIdentifier(table)} ORDER BY "id"`,
      );
    });
    console.log(JSON.stringify({ status: 'verified', counts }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Verification failed:');

  if (error instanceof Error) {
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
