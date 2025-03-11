import { dateDefault } from '../lib/formatDate.js';
import type { Optional, Update } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
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

export function getCheckinPlaceById(id: number) {
	return getStatement<CheckinPlace>('getCheckinPlaceById', 'SELECT * FROM checkin_place WHERE id = $id').get({
		id,
	});
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
		LIMIT 50;`,
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

export function getCheckinPlaces(parameters: Parameters = {}) {
	return getStatement<CheckinPlace>(
		'getCheckinPlaces',
		`SELECT
			*,
			strftime('%FT%T', created_at) as created_at,
			strftime('%FT%T', updated_at) as updated_at
		FROM checkin_place
		WHERE id LIKE $id AND created_at >= $created_at
		ORDER BY $created_at DESC
		LIMIT $limit OFFSET $offset`,
	).all(calculateGetParameters(parameters));
}

export function countCheckinPlaces() {
	const statement = getStatement<{ total: number }>(
		'countCheckinPlaces',
		'SELECT COUNT(id) AS total FROM checkin_place;',
	);
	return statement.get()?.total ?? 0;
}

export function deleteCheckinPlace(checkin_place_id: number) {
	const statement = getStatement('deleteCheckinPlace', 'DELETE FROM checkin_place WHERE id = $id;');
	return statement.run({ id: checkin_place_id });
}

export function updateCheckinPlace(place: Update<CheckinPlace>) {
	const statement = getStatement(
		'updateCheckinPlace',
		`UPDATE checkin_place
		SET name = $name,
		    category = $category,
		    address = $address,
		    lat = $lat,
		    long = $long,
		    external_id = $external_id,
		    created_at = $created_at,
		    updated_at = $updated_at
		WHERE id = $id;`,
	);

	return statement.run({
		...place,
		created_at: dateDefault(place.created_at),
		updated_at: dateDefault(place.updated_at),
	});
}
