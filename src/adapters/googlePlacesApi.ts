import phin from 'phin';
import { config } from '../lib/config.js';
import { type CheckinPlace, getCachedPlace } from '../database/checkins.js';
import Logger from '../lib/logger.js';

const log = new Logger('google-places');

interface NearbyPlace {
	id: string;
	formattedAddress: string;
	location: {
		latitude: number;
		longitude: number;
	};
	displayName: {
		text: string;
		languageCode: string;
	};
	primaryTypeDisplayName?: {
		text: string;
		languageCode: string;
	};
}

interface NearbyPlacesResponse {
	places: NearbyPlace[];
}

export async function searchNearbyPlaces(lat: number, long: number): Promise<CheckinPlace[]> {
	const { placesApiEnabled, apiKey } = config.google;
	if (placesApiEnabled !== true || !apiKey) {
		log.warn('Attempting to use Places API, but use of this API is not enabled');
		return [];
	}

	const response = await phin<NearbyPlacesResponse>({
		url: 'https://places.googleapis.com/v1/places:searchNearby',
		method: 'POST',
		headers: {
			'User-Agent': config.versionString,
			'Content-Type': 'application/json',
			'X-Goog-Api-Key': apiKey,
			'X-Goog-FieldMask':
				'places.displayName,places.location,places.formattedAddress,places.primaryTypeDisplayName,places.id',
		},
		data: JSON.stringify({
			maxResultCount: 20,
			languageCode: 'en-GB',
			locationRestriction: {
				circle: {
					center: {
						latitude: lat,
						longitude: long,
					},
					radius: 250.0,
				},
			},
			rankPreference: 'DISTANCE',
		}),
		parse: 'json',
	});

	const results = response.body.places;
	log.info(`Called API and got ${results.length} results`);

	return results.map(place =>
		getCachedPlace({
			address: place.formattedAddress,
			category: place.primaryTypeDisplayName?.text ?? 'Other',
			external_id: place.id,
			lat: place.location.latitude,
			long: place.location.longitude,
			name: place.displayName.text,
		}),
	);
}
