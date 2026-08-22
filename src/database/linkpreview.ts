import type { Optional } from '../types/database.js';
import { calculateGetParameters, type Parameters } from './constants.js';
import { getStatement } from './database.js';

export interface LinkPreview {
	url: string;
	title: Optional<string>;
	description: Optional<string>;
	thumbnail_data: Optional<Buffer>;
}

export interface ImageBase64 {
	imageBase64: string | null;
}

export type LinkPreviewWithImage = LinkPreview & ImageBase64;

function insertLinkPreview(record: LinkPreview) {
	const statement = getStatement(
		'insertLinkPreview',
		`INSERT INTO link_preview
		(url, title, description, thumbnail_data)
		VALUES
		($url, $title, $description, $thumbnail_data)`,
	);

	return statement.run(record);
}

export function selectOrInsertLinkPreview(record: LinkPreview): LinkPreview {
	const select = getLinkPreviewForUrl(record.url);
	if (select !== undefined) return select;

	insertLinkPreview(record);
	return record;
}

function getDataUrlForImage(row: LinkPreview): string | null {
	if (row.thumbnail_data === null) return null;

	return `data:image/avif;base64,${row.thumbnail_data.toString('base64')}`;
}

export function getLinkPreviews(parameters: Parameters = {}) {
	const statement = getStatement<LinkPreview & { id: string }>(
		'getLinkPreviews',
		`SELECT *, url as id FROM link_preview
		WHERE url LIKE $id
		LIMIT $limit OFFSET $offset`,
	);

	return statement.all(calculateGetParameters(parameters)).map(row => ({
		...row,
		htmlEncodedUrl: encodeURIComponent(row.url),
		imageBase64: getDataUrlForImage(row),
	}));
}

export function getLinkPreviewForUrl(url: string | undefined): LinkPreviewWithImage | undefined {
	if (url === undefined || url.trim() === '') return undefined;

	const statement = getStatement<LinkPreview>(
		'getLinkPreviewForUrl',
		`SELECT * FROM link_preview
		WHERE url = $url`,
	);

	const row = statement.get({ url });

	if (row === undefined) return undefined;

	return {
		...row,
		imageBase64: getDataUrlForImage(row),
	};
}

export function countLinkPreviews() {
	const statement = getStatement<{ total: number }>(
		'countLinkPreviews',
		'SELECT COUNT(*) as total FROM link_preview',
	);

	return statement.get()?.total ?? 0;
}

export function deleteLinkPreview(url: string) {
	const statement = getStatement('deleteLinkPreview', 'DELETE FROM link_preview WHERE url = $url');

	return statement.run({ url });
}

export function updateLinkPreview(record: LinkPreview) {
	const statement = getStatement(
		'updateLinkPreview',
		`UPDATE link_preview
		SET title = $title,
		    description = $description,
		    thumbnail_data = $thumbnail_data
		WHERE url = $url`,
	);

	return statement.run(record);
}
