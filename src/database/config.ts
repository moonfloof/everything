import type { ConfigKey } from '../lib/config/config.js';
import { getStatement } from './database.js';

interface Config {
	key: string;
	value: string | null;
	updated_at: number;
}

export function getConfigValue(key: ConfigKey) {
	return getStatement<Config>('getConfigValue', 'SELECT * FROM config WHERE key = $key;').get({ key })?.value;
}

export function setConfigValue(key: ConfigKey, value: Config['value']) {
	const properties: Config = {
		key,
		value,
		updated_at: Date.now(),
	};

	return getStatement(
		'setConfigValue',
		`INSERT INTO config
		(key, value, updated_at)
		VALUES
		($key, $value, $updated_at)
		ON CONFLICT (key) DO UPDATE SET value = $value, updated_at = $updated_at;`,
	).run(properties);
}
