import { v4 as uuid } from 'uuid';
import { dateDefault } from '../lib/formatDate.js';
import type { Insert, Optional, Update } from '../types/database.js';
import { type Parameters, calculateGetParameters } from './constants.js';
import { getStatement } from './database.js';
import type { EntryStatus } from './notes.js';

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

export interface Checkin {
	id: string;
	place_id: number;
	description: string;
	status: EntryStatus;
	created_at: string;
	updated_at: string;
	device_id: string;
}

type GetCheckin = Checkin & Pick<CheckinPlace, 'name' | 'category' | 'address'>;

export type InsertCheckin = Omit<Checkin, 'id' | 'place_id' | 'updated_at'> &
	Omit<CheckinPlace, 'id' | 'created_at' | 'updated_at'> & {
		place_id: number | undefined;
	};

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

export function insertCheckin(checkin: Insert<Checkin>) {
	const id = uuid();

	return getStatement<Checkin>(
		'insertCheckin',
		`INSERT INTO checkin
		(id, place_id, description, status, created_at, updated_at, device_id)
		VALUES
		($id, $place_id, $description, $status, $created_at, $updated_at, $device_id)
		RETURNING *;`,
	).get({
		...checkin,
		id,
		created_at: dateDefault(checkin.created_at),
		updated_at: dateDefault(checkin.created_at),
	});
}

export function getCheckins(parameters: Partial<Parameters>) {
	return getStatement<GetCheckin>(
		'getCheckins',
		`SELECT
			c.*,
			strftime('%FT%T', c.created_at) as created_at,
			strftime('%FT%T', c.updated_at) as updated_at,
			p.name, p.address, p.category
		FROM checkin AS c
		JOIN checkin_place AS p ON c.place_id = p.id
		WHERE c.id LIKE $id AND c.created_at >= $created_at
		ORDER BY c.created_at DESC
		LIMIT $limit OFFSET $offset`,
	).all(calculateGetParameters(parameters));
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

export function deleteCheckin(id: string) {
	return getStatement('deleteCheckin', 'DELETE FROM checkin WHERE id = $id').run({ id });
}

export function updateCheckin(checkin: Update<Checkin>) {
	const statement = getStatement(
		'updateFilm',
		`UPDATE checkin
		SET description = $description,
		    status = $status,
		    created_at = $created_at,
		    updated_at = $updated_at
		WHERE id = $id`,
	);

	return statement.run({
		...checkin,
		created_at: dateDefault(checkin.created_at),
		updated_at: dateDefault(checkin.updated_at),
	});
}
