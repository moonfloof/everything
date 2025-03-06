import phin from 'phin';
import { type CheckinPlace, getCachedPlace } from '../database/checkins.js';
import { config } from '../lib/config.js';
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

/*

# Searching process documentation - to be implemented if more than 5000 requests
# are made in one month (very unlikely).

Because the Google Places API is billed, we want to make as few requests to it
as reasonably possible and HEAVILY cache instead. This relies on two database
tables. One for cached places, and another for searched coordinates and their
radii.

When we call the API, we're given a total of 20 places within the radius of our
location. Without knowing how many total places are actually within 500 metres,
we should make note of the distance the furthest place away is. When caching
these results, record all places in the database as-is, and separately record
our current location with this maximum radius. When we make subsequent requests
to the `searchNearbyPlaces` function, if our radius has any area not already
covered by previous searches: perform another search using the API, merge or
ignore any previously caches places, and add our maximum search radius as
another entry. Therefore, we should eventually find that calling
`searchNearbyPlaces` doesn't need to call the Google API, thus saving request
credits.

*/

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
