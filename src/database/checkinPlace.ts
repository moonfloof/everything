import type { Optional } from '../types/database.js';
import { getStatement } from './database.js';

export interface CheckinPlace {
	id: number;
	name: string;
	category: string;
	address: Optional<string>;
	lat: Optional<number>;
	long: Optional<number>;
	external_id: Optional<string>;
	created_at: string;
	updated_at: string;
}

export function insertPlace(place: Omit<CheckinPlace, 'id' | 'created_at' | 'updated_at'>): CheckinPlace {
	const insert = getStatement<CheckinPlace>(
		'insertPlace',
		`INSERT INTO checkin_place
			(name, address, category, lat, long, external_id)
		VALUES
			($name, $address, $category, $lat, $long, $external_id)
		RETURNING *;`,
	).get(place);

	if (insert === undefined) {
		throw new Error(`Could not insert new place called '${place.name}' to checkin`);
	}

	return insert;
}

export function getCachedPlace(place: Omit<CheckinPlace, 'id' | 'created_at' | 'updated_at'>): CheckinPlace {
	const exists = getStatement<CheckinPlace>(
		'getCachedPlace',
		`SELECT * FROM checkin_place
		WHERE
		    external_id = $external_id OR (
		    abs(lat - $lat) < 0.004
		AND abs(long - $long) < 0.004
		AND name = $name)
		LIMIT 1;`,
	).get(place);

	if (exists !== undefined) {
		return exists;
	}

	return insertPlace(place);
}

export function getNearestPlaces(parameters: Partial<CheckinPlace> = {}) {
	return getStatement<CheckinPlace & { distance: Optional<number> }>(
		'getNearestPlaces',
		`SELECT
			*,
			round(6371 * acos(
				cos(radians($lat)) * cos(radians(lat)) *
				cos(radians(long) - radians($long)) +
				sin(radians($lat)) * sin(radians(lat))
			), 3) AS distance,
			name || ' (' || category || ')' AS name
		FROM checkin_place
		ORDER BY distance IS NULL, distance ASC, updated_at DESC
		LIMIT 20;`,
	).all({
		lat: parameters.lat,
		long: parameters.long,
	});
}

export function getPlaceCategories() {
	return getStatement<{ value: string; label: string }>(
		'getPlaceCategories',
		`SELECT category AS value, category AS label
		FROM checkin_place
		GROUP BY category
		ORDER BY category ASC;`,
	).all();
}
