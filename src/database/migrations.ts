import fs from 'node:fs';
import path from 'node:path';
import { dateDefault } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { getDatabase, getStatement } from './database.js';
const log = new Logger('migrations');

export function checkMigrations() {
	// Step 1: Make sure migration table exists, run hard-coded migration.
	migrationsTableExists();

	// Step 2: Get all executed migrations
	const existingMigrations = getMigrations();

	// Step 3: Filter them from the list of all migrations
	const availableMigrations = fs.readdirSync('migrations');
	availableMigrations.sort();

	const requiredMigrations = availableMigrations.filter(m => !existingMigrations.includes(m));

	if (requiredMigrations.length === 0) {
		log.info('Up to date!');
		return;
	}

	// Step 4: Run remaining migrations
	for (const migration of requiredMigrations) {
		log.info(`Running migration for '${migration}'`);
		const sql = fs.readFileSync(path.join('migrations', migration), 'utf-8');
		getDatabase().exec(sql);
		insertMigration(migration);
	}
}

function migrationsTableExists() {
	log.info('Checking migration table exists');
	const sql = fs.readFileSync(path.join('migrations', '2024-06-10-set-up-migrations.sql'), 'utf-8');
	getDatabase().exec(sql);
}

function getMigrations() {
	return getStatement<{ migration_name: string }>('getMigrations', 'SELECT migration_name FROM migrations')
		.all()
		.map(m => m.migration_name);
}

function insertMigration(migration_name: string, created_at?: string) {
	const statement = getStatement(
		'insertMigration',
		`INSERT INTO migrations
		(migration_name, created_at)
		VALUES
		($migration_name, $created_at)`,
	);

	return statement.run({
		migration_name,
		created_at: dateDefault(created_at),
	});
}
