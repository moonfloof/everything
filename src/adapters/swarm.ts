import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { errors } from '@moonfloof/stdlib';
import phin from 'phin';
import sharp from 'sharp';
import { getCachedPlace } from '../database/checkinPlace.js';
import { insertCheckin, insertCheckinImage } from '../database/checkins.js';
import { config } from '../lib/config.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { saveImageToBuffer } from '../lib/mediaFiles.js';
import { queue } from '../lib/queue.js';
import { generateSvg } from './openstreetmap.js';
import type {
	SwarmAccessToken,
	SwarmCheckinDetails,
	SwarmPhoto,
	SwarmPushCheckin,
	SwarmSelfDetails,
} from './swarmTypes.js';

const { ServerError, BadRequestError, ForbiddenError } = errors;

const log = new Logger('swarm');

interface SwarmConfigData {
	oauthToken?: string;
}

let swarmCacheData: SwarmConfigData = {};

const swarmEndpoints = {
	authenticate: () => 'https://foursquare.com/oauth2/authenticate',
	accessToken: () => 'https://foursquare.com/oauth2/access_token',
	checkins: () => 'https://api.foursquare.com/v2/users/self/checkins',
	selfDetails: () => 'https://api.foursquare.com/v2/users/self',
	checkinDetails: ({ checkin_id }: Record<string, string>) =>
		`https://api.foursquare.com/v2/checkins/${checkin_id}`,
} as const;

function variablesArePresent(includePush = false) {
	const { oauthClientId, oauthClientSecret, userId, pushSecret } = config.swarm;
	if (oauthClientId === undefined || oauthClientSecret === undefined || userId === undefined) {
		throw new ServerError('Swarm - Missing Client ID, Client Secret, and/or User ID, check your .env file');
	}

	if (includePush && pushSecret === undefined) {
		throw new ServerError('Swarm - Server does not have a push secret set, check your .env file');
	}
}

async function callFoursquareAPI<T>(
	endpoint: keyof typeof swarmEndpoints,
	params: Record<string, string> = {},
	method: 'GET' | 'POST' = 'GET',
): Promise<T> {
	loadCacheData();

	if (endpoint !== 'accessToken') {
		if (swarmCacheData?.oauthToken === undefined) {
			throw new Error('Swarm - You must authenticate with the Foursquare API first!');
		}

		params.oauth_token = swarmCacheData.oauthToken;
		params.v = '20250306';
	}

	const baseUrl = swarmEndpoints[endpoint](params);

	const url = `${baseUrl}?${new URLSearchParams(params).toString()}`;

	log.info(`Making request to ${baseUrl}`);
	const response = await phin({
		url,
		method,
		parse: 'json',
	});

	return response.body as T;
}

export function generateAuthenticateUri() {
	const { oauthClientId } = config.swarm;

	variablesArePresent();

	const params = new URLSearchParams({
		client_id: oauthClientId!,
		response_type: 'code',
		redirect_uri: `${config.serverExternalUri}/api/swarm/callback`,
	});

	return `${swarmEndpoints.authenticate()}?${params.toString()}`;
}

export async function swarmHandleOauthCallback(code: string) {
	const { oauthClientId, oauthClientSecret, userId } = config.swarm;

	variablesArePresent();

	// First, get an access token
	const params = {
		client_id: oauthClientId!,
		client_secret: oauthClientSecret!,
		grant_type: 'authorization_code',
		redirect_uri: `${config.serverExternalUri}/api/swarm/callback`,
		code,
	};

	const { access_token } = await callFoursquareAPI<SwarmAccessToken>('accessToken', params);

	// Second, verify that the user logging in matches the user we want
	// push events for.
	const {
		response: { user },
	} = await callFoursquareAPI<SwarmSelfDetails>('selfDetails');

	if (`${user.id}`.toLowerCase() !== `${userId}`.toLowerCase()) {
		throw new ForbiddenError('Swarm - User logging in does not match required User ID');
	}

	// Finally, update the cache data
	swarmCacheData.oauthToken = access_token;
	saveSwarmCacheData();
}

export function convertImageToThumbnail(buffer: Buffer): Promise<Buffer> {
	return sharp(buffer)
		.resize({ withoutEnlargement: true, fit: 'cover', width: 150, height: 150 })
		.avif({ effort: 6, quality: 50 })
		.toBuffer();
}

export function convertImageToDataAndThumbnail(buffer: Buffer): Promise<[Buffer, Buffer]> {
	return Promise.all([
		sharp(buffer)
			.resize({ withoutEnlargement: true, width: 960 })
			.avif({ effort: 6, quality: 50 })
			.toBuffer(),
		convertImageToThumbnail(buffer),
	]);
}

function swarmDownloadPhoto(checkin_id: string, photo: SwarmPhoto) {
	const size = photo.width > photo.height ? '960x720' : '720x960';
	const url = photo.prefix + size + photo.suffix;
	const task = async () => {
		const buffer = await saveImageToBuffer(url);

		const [data, thumbnail_data] = await convertImageToDataAndThumbnail(buffer);

		insertCheckinImage({
			checkin_id,
			data,
			thumbnail_data,
			lat: null,
			long: null,
			taken_at: photo.createdAt ? new Date(photo.createdAt * 1000).toISOString() : null,
		});
	};
	queue.addToQueue(task);
}

export async function swarmHandlePushCheckin(checkin: SwarmPushCheckin, secret: string, device_id?: string) {
	const { pushSecret, userId } = config.swarm;

	variablesArePresent(true);

	if (secret !== pushSecret) {
		throw new BadRequestError('Swarm - Secret does not match server');
	}

	if (`${checkin.user.id}`.toLowerCase() !== `${userId}`.toLowerCase()) {
		throw new ForbiddenError('Swarm - User does not match required User ID');
	}

	const { venue } = checkin;
	const { lat, lng: long } = venue.location;

	const place = getCachedPlace({
		external_id: venue.id,
		address: venue.location.formattedAddress.join(', '),
		category: venue.categories[0]?.name ?? 'Other',
		lat,
		long,
		name: venue.name,
	});

	const newCheckin = insertCheckin(
		{
			created_at: new Date(checkin.createdAt * 1000).toISOString(),
			description: checkin.shout ?? '',
			device_id: device_id ?? config.defaultDeviceId,
			place_id: place.id,
			status: 'public',
			map_svg: await generateSvg({ checkin: [long, lat] }),
		},
		lat,
		long,
	);

	log.info(`20 minute timer has been set to poll checkin '${newCheckin.id}' for images`);
	setTimeout(async () => {
		const { response } = await callFoursquareAPI<SwarmCheckinDetails>('checkinDetails', {
			checkin_id: checkin.id,
		});

		const photos = response.checkin?.photos;

		if (photos?.count !== undefined && photos?.items !== undefined) {
			for (const photo of photos.items) {
				swarmDownloadPhoto(newCheckin.id, photo);
			}
		}
	}, minuteMs * 20);
}

function saveSwarmCacheData() {
	log.info('Saving activity and token cache to disk');
	const str = JSON.stringify(swarmCacheData, null, 2);
	writeFileSync(config.swarm.dataPath, str);
}

function loadCacheData() {
	// We're already authenticated - no need to reload the data.
	if (swarmCacheData.oauthToken !== undefined) return;

	log.info('Loading activity and token cache from disk');
	if (existsSync(config.swarm.dataPath) === false) {
		log.info('Cache file does not exist, providing defaults');
		swarmCacheData = {};
		saveSwarmCacheData();
		return;
	}

	swarmCacheData = JSON.parse(readFileSync(config.swarm.dataPath).toString());
}
