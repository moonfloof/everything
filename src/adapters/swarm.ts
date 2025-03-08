import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { errors } from '@moonfloof/stdlib';
import phin from 'phin';
import sharp from 'sharp';
import { getCachedPlace, insertCheckin, insertCheckinImage } from '../database/checkins.js';
import { config } from '../lib/config.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import { mediaQueue } from '../lib/mediaFiles.js';
import type { SwarmAccessToken, SwarmCheckinDetails, SwarmPhoto, SwarmPushCheckin } from './swarmTypes.js';
const { ServerError, BadRequestError } = errors;

const log = new Logger('swarm');

interface SwarmConfigData {
	lastCheckinDate?: string;
	oauthToken?: string;
}

let swarmCacheData: SwarmConfigData = {};

const swarmEndpoints = {
	authenticate: () => 'https://foursquare.com/oauth2/authenticate',
	accessToken: () => 'https://foursquare.com/oauth2/access_token',
	checkins: () => 'https://api.foursquare.com/v2/users/self/checkins',
	checkinDetails: ({ checkin_id }: Record<string, string>) =>
		`https://api.foursquare.com/v2/checkins/${checkin_id}`,
} as const;

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

	const response = await phin({
		url,
		method,
		parse: 'json',
	});

	return response.body as T;
}

export function generateAuthenticateUri() {
	const { oauthClientId, oauthClientSecret } = config.swarm;

	if (oauthClientId === undefined || oauthClientSecret === undefined) {
		throw new Error('Swarm - Missing Client ID or Secret, check your .env file');
	}

	const params = new URLSearchParams({
		client_id: oauthClientId,
		response_type: 'code',
		redirect_uri: `${config.serverExternalUri}/api/swarm/callback`,
	});

	return `${swarmEndpoints.authenticate()}?${params.toString()}`;
}

export async function swarmHandleOauthCallback(code: string) {
	const { oauthClientId, oauthClientSecret } = config.swarm;
	if (oauthClientId === undefined || oauthClientSecret === undefined) {
		throw new Error('Swarm - Missing Client ID or Secret, check your .env file');
	}

	const params = {
		client_id: oauthClientId,
		client_secret: oauthClientSecret,
		grant_type: 'authorization_code',
		redirect_uri: `${config.serverExternalUri}/api/swarm/callback`,
		code,
	};

	const response = await callFoursquareAPI<SwarmAccessToken>('accessToken', params);

	swarmCacheData.oauthToken = response.access_token;
	saveSwarmCacheData();
}

export async function convertImageToDatabase(checkin_id: string, buffer: Buffer) {
	const data = await sharp(buffer)
		.resize({ withoutEnlargement: true, width: 960 })
		.avif({ effort: 6, quality: 50 })
		.toBuffer();

	insertCheckinImage({
		checkin_id,
		data,
	});
}

function swarmDownloadPhoto(checkin_id: string, photo: SwarmPhoto) {
	const size = photo.width > photo.height ? '960x720' : '720x960';
	const url = photo.prefix + size + photo.suffix;
	const onComplete = (buffer: Buffer) => convertImageToDatabase(checkin_id, buffer);
	mediaQueue.addToQueue({ url, onComplete });
}

export function swarmHandlePushCheckin(checkin: SwarmPushCheckin, secret: string) {
	const { pushSecret } = config.swarm;

	if (pushSecret === undefined) {
		throw new ServerError('Swarm - Server does not have a push secret set');
	}

	if (secret !== pushSecret) {
		throw new BadRequestError('Swarm - Secret does not match server');
	}

	const { venue } = checkin;

	const place = getCachedPlace({
		external_id: venue.id,
		address: venue.location.formattedAddress.join(', '),
		category: venue.categories[0]?.name ?? 'Other',
		lat: venue.location.lat,
		long: venue.location.lng,
		name: venue.name,
	});

	const newCheckin = insertCheckin({
		created_at: new Date(checkin.createdAt * 1000).toISOString(),
		description: checkin.shout ?? '',
		device_id: config.defaultDeviceId,
		place_id: place.id,
		status: 'public',
	});

	log.info(`20 minute timer has been set to poll checkin ${newCheckin.id} for images`);
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
	log.info('Loading activity and token cache from disk');
	if (existsSync(config.swarm.dataPath) === false) {
		log.info('Cache file does not exist, providing defaults');
		swarmCacheData = {
			lastCheckinDate: new Date().toISOString(),
		};
		saveSwarmCacheData();
		return;
	}

	swarmCacheData = JSON.parse(readFileSync(config.swarm.dataPath).toString());
}
