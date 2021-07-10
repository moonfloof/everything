import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db = null;

/**
 * @returns {Promise<sqlite3.Database>}
 */
export async function getDatabase () {
	if (db !== null) return db;

	db = await open({
		filename: process.env.TOMBOIS_SQLITE_LOCATION,
		driver: sqlite3.Database,
	});

	return db;
}
