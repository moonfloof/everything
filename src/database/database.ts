import SqliteDatabase, { type Database, type Statement } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';

let db: Database | null = null;

// biome-ignore lint/suspicious/noExplicitAny: Statements can be of any kind, as long as it's a statement.
const statements: Record<string, Statement<unknown[], any>> = {};

export function getDatabase(): Database {
	if (db !== null) return db;

	db = new SqliteDatabase(process.env.TOMBOIS_SQLITE_LOCATION);
	db.function('uuid', () => uuid());

	return db;
}

export function getStatement<T>(name: string, statement: string): Statement<unknown[], T> {
	if (statements[name] !== undefined) {
		return statements[name];
	}

	const database = getDatabase();
	statements[name] = database.prepare(statement);

	return statements[name];
}
