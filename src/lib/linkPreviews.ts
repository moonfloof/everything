import phin from 'phin';
import sax, { type QualifiedAttribute } from 'sax';
import { convertImageToThumbnail } from '../adapters/swarm.js';
import type { LinkPreview } from '../database/linkpreview.js';
import type { Optional } from '../types/database.js';
import { config } from './config/index.js';
import Logger from './logger.js';
import { saveImageToBuffer } from './mediaFiles.js';

const log = new Logger('linkpreview');

export async function downloadWebPage(url: string) {
	log.info(`Downloading web page '${url}'`);
	const response = await phin({
		method: 'GET',
		headers: {
			'User-Agent': config.versionString,
		},
		followRedirects: true,
		url,
		parse: 'string',
	});

	if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
		throw new Error(`Non-2XX response code received: '${response.statusCode}'`);
	}

	if (response.errored !== null) {
		throw response.errored;
	}

	return response.body;
}

type PageTag = {
	name: string;
	text?: string;
	attributes: {
		[key: string]: string | QualifiedAttribute;
	};
};

function parseHtmlForTags(html: string, tags: string[]): Promise<PageTag[]> {
	const parser = sax.parser(false, { lowercase: true, noscript: true, normalize: true, trim: true });
	const items: PageTag[] = [];

	let currentTag: string | null = null;

	return new Promise((resolve, reject) => {
		parser.onopentag = node => {
			if (!tags.includes(node.name)) return;
			currentTag = node.name;
			items.push({ name: node.name, attributes: node.attributes });
		};

		parser.ontext = text => {
			if (items.length === 0 || currentTag === null) return;
			items[items.length - 1].text = text;
		};

		parser.oncdata = text => {
			if (items.length === 0 || currentTag === null) return;
			items[items.length - 1].text = text;
		};

		parser.onclosetag = () => {
			currentTag = null;
		};

		parser.onend = () => resolve(items);
		parser.onerror = err => reject(err);

		parser.write(html).close();
	});
}

function getValueForAttribute(attribute: string | QualifiedAttribute | undefined): string | undefined {
	if (attribute === undefined) return undefined;
	if (typeof attribute === 'string') return attribute;
	return attribute.value;
}

function getMetaTagHasName(tag: PageTag, name: string): PageTag | undefined {
	if (tag.attributes.property === name) return tag;
	if (tag.attributes.name === name) return tag;

	return undefined;
}

function getDescriptionForPage(tags: PageTag[]): string | null {
	const orderedTags: { value: string; order: number }[] = [];

	for (const tag of tags) {
		const value = getValueForAttribute(tag.attributes.content);

		if (tag.name === 'meta' && getMetaTagHasName(tag, 'og:description') && value !== undefined) {
			orderedTags.push({ order: 0, value });
		}

		if (tag.name === 'meta' && getMetaTagHasName(tag, 'twitter:description') && value !== undefined) {
			orderedTags.push({ order: 1, value });
		}

		if (tag.name === 'meta' && getMetaTagHasName(tag, 'description') && value !== undefined) {
			orderedTags.push({ order: 2, value });
		}
	}

	if (orderedTags.length === 0) return null;
	orderedTags.sort((a, b) => a.order - b.order);
	return orderedTags[0].value;
}

function getTitleForPage(tags: PageTag[]): string | null {
	const orderedTags: { value: string; order: number }[] = [];

	for (const tag of tags) {
		const value = getValueForAttribute(tag.attributes.content);

		if (tag.name === 'meta' && getMetaTagHasName(tag, 'og:title') && value !== undefined) {
			orderedTags.push({ order: 0, value });
		}

		if (tag.name === 'meta' && getMetaTagHasName(tag, 'title') && value !== undefined) {
			orderedTags.push({ order: 1, value });
		}

		if (tag.name === 'title' && tag.text !== undefined && tag.text !== '') {
			orderedTags.push({ order: 2, value: tag.text });
		}
	}

	if (orderedTags.length === 0) return null;
	orderedTags.sort((a, b) => a.order - b.order);
	return orderedTags[0].value;
}

function getImageUrlForPage(tags: PageTag[]): string | null {
	const orderedTags: { value: string; order: number }[] = [];

	for (const tag of tags) {
		const value = getValueForAttribute(tag.attributes.content);

		if (tag.name === 'meta' && getMetaTagHasName(tag, 'og:image:url') && value !== undefined) {
			orderedTags.push({ order: 0, value });
		}

		if (tag.name === 'meta' && getMetaTagHasName(tag, 'og:image') && value !== undefined) {
			orderedTags.push({ order: 1, value });
		}

		if (tag.name === 'meta' && getMetaTagHasName(tag, 'twitter:image') && value !== undefined) {
			orderedTags.push({ order: 2, value });
		}
	}

	if (orderedTags.length === 0) return null;
	orderedTags.sort((a, b) => a.order - b.order);
	return orderedTags[0].value;
}

/**
 * Loads a page, looks for meta tags (w/ fallbacks), converts found image, then
 * inserts into the database
 */
export async function fetchLinkPreview(
	url: string,
	titleOverride?: string,
	descriptionOverride?: string,
	imageUrlOverride?: string,
): Promise<LinkPreview> {
	const linkPreview: LinkPreview & { imageUrl: Optional<string> } = {
		url,
		description: null,
		title: null,
		thumbnail_data: null,
		imageUrl: null,
	};

	// Download the page if any one override is not provided
	if (!(titleOverride && descriptionOverride && imageUrlOverride)) {
		const body = await downloadWebPage(url);
		const tags = await parseHtmlForTags(body, ['meta', 'title']);

		linkPreview.description = getDescriptionForPage(tags)?.replace(/\n+/g, '<br>') ?? null;
		linkPreview.title = getTitleForPage(tags);
		linkPreview.imageUrl = getImageUrlForPage(tags);
	}

	if (titleOverride !== undefined && titleOverride !== '') {
		linkPreview.title = titleOverride;
	}

	if (descriptionOverride !== undefined && descriptionOverride !== '') {
		linkPreview.description = descriptionOverride;
	}

	if (imageUrlOverride !== undefined && imageUrlOverride !== '') {
		linkPreview.imageUrl = imageUrlOverride;
	}

	if (linkPreview.imageUrl !== null) {
		try {
			const image = await saveImageToBuffer(linkPreview.imageUrl);
			linkPreview.thumbnail_data = await convertImageToThumbnail(image);
		} catch (err) {
			log.error(err);
		}
	}

	return linkPreview;
}
