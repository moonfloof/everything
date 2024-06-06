import NodeGeocoder from 'node-geocoder';

let geocoder: NodeGeocoder.Geocoder;

export function getGeocoder() {
	if (geocoder) return geocoder;

	geocoder = NodeGeocoder({
		provider: 'openstreetmap',
	});

	return geocoder;
}
