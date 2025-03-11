import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { basename } from 'node:path';
import phin from 'phin';
import sharp, { type Sharp } from 'sharp';
import { config } from './config.js';
import Logger from './logger.js';
import { queue } from './queue.js';

const log = new Logger('media');

type ImageType = 'game' | 'film';
type ImagePath = `hero-${string}` | `library-${string}` | `poster-${string}`;

export const getImageDir = (type: ImageType): `public/${ImageType}-images/` => `public/${type}-images/`;
export const getImagePath = (type: ImageType, path: ImagePath) => `${getImageDir(type)}${path}.avif`;

export async function saveImageToBuffer(url: string) {
	log.info(`Saving image '${url}'`);
	const response = await phin({
		method: 'GET',
		headers: {
			'User-Agent': config.versionString,
		},
		url,
		parse: 'none',
	});

	if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
		throw new Error(`Non-2XX response code received: '${response.statusCode}'`);
	}

	if (response.errored !== null) {
		throw response.errored;
	}

	return response.body;
}

export function saveImageToDisk(url: string, path: string) {
	if (existsSync(path)) return;
	const task = async () => {
		const buffer = await saveImageToBuffer(url);
		await convertImageToAvif(buffer).toFile(path);
	};
	queue.addToQueue(task);
}

export function deleteIfExists(type: ImageType, path: ImagePath) {
	const actualPath = getImagePath(type, path);
	if (!existsSync(actualPath)) return;

	rmSync(actualPath);
}

export function convertImageToAvif(imagedata: Buffer): Sharp {
	return sharp(imagedata)
		.resize({ withoutEnlargement: true, fit: 'inside', width: 1280, height: 720 })
		.avif({ effort: 6, quality: 50 });
}

async function convertAllImagesOfTypeToAvif(type: ImageType) {
	const dir = getImageDir(type);
	for (const file of readdirSync(dir, { recursive: false })) {
		const filename = file.toString();
		if (!filename.endsWith('.jpg')) continue;

		const path = `${dir}${filename}`;
		const buffer = readFileSync(path);
		const name = basename(filename, '.jpg') as ImagePath;

		// Convert and remove original
		log.info(`Converting '${filename}' to AVIF`);
		await convertImageToAvif(buffer).toFile(getImagePath(type, name));
		rmSync(path);
	}
}

export async function convertAllImagesToAvif() {
	for (const type of ['game', 'film'] as ImageType[]) {
		await convertAllImagesOfTypeToAvif(type);
	}
}
