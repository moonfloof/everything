import NodeGeocoder from 'node-geocoder';

let geocoder = null;

/**
 * @returns {NodeGeocoder.Geocoder}
 */
export function getGeocoder() {
	if (geocoder !== null) return geocoder;

	geocoder = NodeGeocoder({
		provider: 'openstreetmap',
	});

	return geocoder;
}
