import phin from 'phin';
import { config } from '../lib/config.js';
import Logger from '../lib/logger.js';
const log = new Logger('kawa');

export async function getKawaUrl(inputUrl: string): Promise<string> {
	const { apiBaseUrl, apiKey } = config.kawa;

	if (!(apiBaseUrl && apiKey)) {
		log.info('Base URL or API Key is not set. Returning input URL');
		return inputUrl;
	}

	const response = await phin({
		url: `${apiBaseUrl}/api/convert`,
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'User-Agent': config.versionString,
			'Content-Type': 'application/json',
		},
		parse: 'json',
		data: JSON.stringify({
			url: inputUrl,
		}),
	});

	if (response.statusCode !== 201) {
		log.info('API did not return HTTP 201 Created. Returning input URL');
		return inputUrl;
	}
	if (response.headers.location === undefined) {
		log.info('API did not include Location header. Returning input URL');
		return inputUrl;
	}

	return response.headers.location;
}
