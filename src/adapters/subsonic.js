import phin from 'phin';
import crypto from 'crypto';

import dotenv from 'dotenv';

dotenv.config();

const getPassword = () => {
	const salt = crypto.randomBytes(5).toString('base64url');

	const password = crypto
		.createHash('md5')
		.update(`${process.env.TOMBOIS_SUBSONIC_PASSWORD}${salt}`)
		.digest('hex');

	return {
		password,
		salt,
	};
};

const getBaseParams = () => {
	const { password, salt } = getPassword();
	return {
		u: process.env.TOMBOIS_SUBSONIC_USERNAME,
		v: '1.15.0',
		c: 'tombo.is',
		t: password,
		s: salt,
		f: 'json',
	};
};

export const getAlbumList = async (page = 0) => {
	const params = new URLSearchParams({
		...getBaseParams(),
		type: 'newest',
		size: 500,
		offset: Math.floor(page) * 500,
	}).toString();

	const url = new URL(`/rest/getAlbumList2?${params}`, process.env.TOMBOIS_SUBSONIC_URL);

	const response = await phin({ url, parse: 'json' });

	return response.body['subsonic-response']?.albumList2.album;
};

export const getAllAlbums = async () => {
	let albums = [];
	let lastResponseLength = 1;
	let page = 0;

	while (lastResponseLength > 0 || page < 10) {
		const albumResponse = await getAlbumList(page);
		lastResponseLength = albumResponse.length;
		albums = albums.concat(albumResponse);
		page++;
	}

	return albums;
};

export const getAlbumTracks = async (albumId) => {
	const params = new URLSearchParams({
		...getBaseParams(),
		id: albumId,
	});

	const url = new URL(`/rest/getAlbum?${params}`, process.env.TOMBOIS_SUBSONIC_URL);

	const response = await phin({ url, parse: 'json' });

	return response.body['subsonic-response']?.album;
};

export const scrobbleTrack = async (trackId, timestamp) => {
	const params = new URLSearchParams({
		...getBaseParams(),
		id: trackId,
		time: timestamp,
	});

	const url = new URL(`/rest/scrobble?${params}`, process.env.TOMBOIS_SUBSONIC_URL);

	const response = await phin({ url, parse: 'json' });

	return response.body;
};
