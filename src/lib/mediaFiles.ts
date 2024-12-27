import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { basename } from 'node:path';
import phin from 'phin';
import sharp from 'sharp';
import { config } from './config.js';
import Logger from './logger.js';

const log = new Logger('media');

type ImageType = 'game' | 'film';
type ImagePath = `hero-${string}` | `library-${string}` | `poster-${string}`;

export const getImageDir = (type: ImageType): `public/${ImageType}-images/` => `public/${type}-images/`;
export const getImagePath = (type: ImageType, path: ImagePath) => `${getImageDir(type)}${path}.avif`;

export async function saveImageToDisk(url: string, path: string) {
	if (existsSync(path)) return;

	const response = await phin({
		method: 'GET',
		headers: {
			'User-Agent': config.versionString,
		},
		url,
		parse: 'none',
	});

	if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) return;
	if (response.errored !== null) return;

	log.info(`Saving '${path}' (${Math.round(response.body.byteLength / 1024)} kB)`);
	await convertImageToAvif(response.body, path);
}

export function deleteIfExists(type: ImageType, path: ImagePath) {
	const actualPath = getImagePath(type, path);
	if (!existsSync(actualPath)) return;

	rmSync(actualPath);
}

function convertImageToAvif(imagedata: Buffer, outputPath: string) {
	return sharp(imagedata)
		.resize({ withoutEnlargement: true, fit: 'inside', width: 1280, height: 720 })
		.avif({ effort: 6, quality: 50 })
		.toFile(outputPath);
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
		await convertImageToAvif(buffer, getImagePath(type, name));
		rmSync(path);
	}
}

export async function convertAllImagesToAvif() {
	for (const type of ['game', 'film'] as ImageType[]) {
		await convertAllImagesOfTypeToAvif(type);
	}
}
