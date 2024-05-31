import Database from 'better-sqlite3';

let db = null;
const statements = {};

/**
 * @export
 * @returns {Database.Database}
 */
export function getDatabase() {
	if (db !== null) return db;

	db = new Database(process.env.TOMBOIS_SQLITE_LOCATION);

	return db;
}

/**
 * @export
 * @param {string} name
 * @param {string} statement
 * @return {Database.Statement}
 */
export function getStatement(name, statement) {
	if (statements[name] !== undefined) {
		return statements[name];
	}

	const database = getDatabase();
	statements[name] = database.prepare(statement);

	return statements[name];
}
