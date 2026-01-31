import { errors } from '@moonfloof/stdlib';
import { v4 as uuid } from 'uuid';
import { convertImageToThumbnail } from '../adapters/swarm.js';
import { timeago } from '../adapters/timeago.js';
import { config } from '../lib/config.js';
import { dateDefault, dayMs, minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { shortSummary, unsafe_stripTags } from '../lib/strings.js';
import type { Insert, Optional, Update } from '../types/database.js';
import type { CheckinPlace } from './checkinPlace.js';
import { calculateGetParameters, DEFAULT_DAYS, type Parameters } from './constants.js';
import { getStatement } from './database.js';
import { ENTRY_STATUS, type EntryStatus } from './notes.js';

const { ServerError, NotFoundError } = errors;

const log = new Logger('checkin');

export interface Checkin {
	id: string;
	place_id: number;
	description: string;
	status: EntryStatus;
	created_at: string;
	updated_at: string;
	device_id: string;
	map_svg: Optional<string>;
}

export interface CheckinImage {
	id: string;
	checkin_id: string;
	data: Buffer;

	// Optional fields
	thumbnail_data: Optional<Buffer>;
	lat: Optional<number>;
	long: Optional<number>;
	taken_at: Optional<string>;
}

type GetCheckin = Checkin & Pick<CheckinPlace, 'name' | 'category' | 'address' | 'lat' | 'long'>;

export type InsertCheckin = Omit<Checkin, 'id' | 'place_id' | 'updated_at'> &
	Omit<CheckinPlace, 'id' | 'created_at' | 'updated_at'> & {
		place_id: number | undefined;
	};

export function insertCheckin(checkin: Insert<Checkin>, lat?: number | null, long?: number | null) {
	const id = uuid();

	// Location override
	const { privateLat, privateLong, privateRadius } = config.location;
	if (privateLat !== 0 && privateLong !== 0 && privateRadius !== 0 && lat && long) {
		const latDiff = Math.abs(lat - privateLat);
		const longDiff = Math.abs(long - privateLong);
		if (latDiff < privateRadius && longDiff < privateRadius) {
			log.warn("Location is within private region - automatically setting status to 'private'");
			checkin.status = 'private';
		}
	}

	const insert = getStatement<Checkin>(
		'insertCheckin',
		`INSERT INTO checkin
		(id, place_id, description, status, map_svg, created_at, updated_at, device_id)
		VALUES
		($id, $place_id, $description, $status, $map_svg, $created_at, $updated_at, $device_id)
		RETURNING *;`,
	).get({
		...checkin,
		id,
		created_at: dateDefault(checkin.created_at),
		updated_at: dateDefault(checkin.created_at),
	});

	if (insert === undefined) {
		throw new Error('Adding checkin was not successful!');
	}

	return insert;
}

export function getCheckinImageData(image_id: CheckinImage['id']): CheckinImage['data'] | undefined {
	const result = getStatement<Pick<CheckinImage, 'data'>>(
		'getCheckinImageData',
		'SELECT data FROM checkin_image WHERE id = $image_id',
	).get({ image_id });
	return result?.data;
}

async function convertImageDataToThumbnail(image_id: CheckinImage['id'], data: Buffer): Promise<Buffer> {
	const thumbnail_data = await convertImageToThumbnail(data);

	const result = getStatement(
		'updateCheckinImageThumbnail',
		'UPDATE checkin_image SET thumbnail_data = $thumbnail_data WHERE id = $image_id;',
	).run({ thumbnail_data, image_id });

	if (result.changes === 0) {
		throw new ServerError(`Could not generate thumbnail for image '${image_id}'`);
	}

	return thumbnail_data;
}

export function getCheckinImageThumbnailData(image_id: CheckinImage['id']): Promise<Buffer> {
	const result = getStatement<Pick<CheckinImage, 'data' | 'thumbnail_data'>>(
		'getCheckinImageThumbnailData',
		'SELECT data, thumbnail_data FROM checkin_image WHERE id = $image_id',
	).get({ image_id });

	if (result === undefined) {
		throw new NotFoundError(`Image '${image_id}' does not exist`);
	}

	if (result.thumbnail_data === null) {
		return convertImageDataToThumbnail(image_id, result.data);
	}

	return Promise.resolve(result.thumbnail_data);
}

function getCheckinImages(checkin_id: CheckinImage['checkin_id']) {
	return getStatement<Pick<CheckinImage, 'id' | 'lat' | 'long'>>(
		'getCheckinImages',
		'SELECT id, lat, long FROM checkin_image WHERE checkin_id = $checkin_id ORDER BY taken_at ASC',
	).all({ checkin_id });
}

export function deleteCheckinImage(id: string) {
	const statement = getStatement('deleteCheckinImage', 'DELETE FROM checkin_image WHERE id = $id');
	return statement.run({ id });
}

interface CheckinParameters {
	status: EntryStatus | '%';
}

export function getCheckins(parameters: Partial<Parameters & CheckinParameters> = {}) {
	const params = {
		...calculateGetParameters(parameters),
		status: parameters.status || ENTRY_STATUS.PUBLIC,
		created_at_max: new Date().toISOString(),
	};

	if (params.status === ENTRY_STATUS.PUBLIC && params.id === '%') {
		const locationDelayMs = config.location.delayMins * minuteMs;
		const days = (parameters.days ?? DEFAULT_DAYS) * dayMs + locationDelayMs;

		params.created_at = new Date(Date.now() - days).toISOString();
		params.created_at_max = new Date(Date.now() - locationDelayMs).toISOString();
	}

	return getStatement<GetCheckin>(
		'getCheckins',
		`SELECT
			c.*,
			strftime('%FT%T', c.created_at) as created_at,
			strftime('%FT%T', c.updated_at) as updated_at,
			p.name, p.address, p.category, p.lat, p.long
		FROM checkin AS c
		JOIN checkin_place AS p ON c.place_id = p.id
		WHERE c.id LIKE $id
		  AND status LIKE $status
		  AND c.created_at >= $created_at
		  AND c.created_at <= $created_at_max
		ORDER BY c.created_at DESC
		LIMIT $limit OFFSET $offset`,
	)
		.all(params)
		.map(checkin => ({
			...checkin,
			summary: shortSummary(unsafe_stripTags(checkin.description)),
			timeago: timeago.format(new Date(checkin.created_at)),
			images: getCheckinImages(checkin.id),
		}));
}

export function deleteCheckin(id: string) {
	return getStatement('deleteCheckin', 'DELETE FROM checkin WHERE id = $id').run({ id });
}

export function countCheckins(status: EntryStatus | '%' = ENTRY_STATUS.PUBLIC) {
	const statement = getStatement<{ total: number }>(
		'countCheckins',
		'SELECT COUNT(id) AS total FROM checkin WHERE status LIKE $status;',
	);
	return statement.get({ status })?.total || 0;
}

export function updateCheckin(checkin: Update<Omit<Checkin, 'map_svg'>>) {
	const statement = getStatement(
		'updateCheckin',
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

export function insertCheckinImage(image: Insert<CheckinImage>) {
	const insert = getStatement<CheckinImage>(
		'insertCheckinImage',
		`INSERT INTO checkin_image
			(checkin_id, data, thumbnail_data, lat, long, taken_at)
		VALUES
			($checkin_id, $data, $thumbnail_data, $lat, $long, $taken_at)
		RETURNING *;`,
	).get(image);

	if (insert === undefined) {
		throw new ServerError('Image could not be saved');
	}

	return insert;
}
