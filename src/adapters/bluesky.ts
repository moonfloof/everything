import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import phin from 'phin';
import { config } from '../lib/config.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';

import { type Entry, insertNote } from '../database/notes.js';
import type { Insert } from '../types/database.js';

const log = new Logger('bluesky');

type BlueskyDid = `did:plc:${string}`;

interface BlueskyBlob {
	$type: 'blob';
	ref: {
		$link: string;
	};
	mimeType: string;
	size: number;
}

interface BlueskyEmbedImages {
	$type: 'app.bsky.embed.images';
	images: {
		alt?: string;
		aspectRatio: {
			width: number;
			height: number;
		};
		image: BlueskyBlob;
	}[];
}
interface BlueskyEmbedVideo {
	$type: 'app.bsky.embed.video';
	aspectRatio: {
		width: number;
		height: number;
	};
	video: BlueskyBlob;
}

interface BlueskyEmbedExternal {
	$type: 'app.bsky.embed.external';
	external: {
		description: string;
		title: string;
		uri: string;
		thumb?: BlueskyBlob;
	};
}

type BlueskyEmbed = BlueskyEmbedImages | BlueskyEmbedVideo | BlueskyEmbedExternal;

interface BlueskyFacetIndex {
	index: {
		byteStart: number;
		byteEnd: number;
	};
}

type BlueskyFacetTag = BlueskyFacetIndex & {
	features: [
		{
			$type: 'app.bsky.richtext.facet#tag';
			tag: string;
		},
	];
};

type BlueskyFacetLink = BlueskyFacetIndex & {
	features: [
		{
			$type: 'app.bsky.richtext.facet#link';
			uri: string;
		},
	];
};

type BlueskyFacetMention = BlueskyFacetIndex & {
	features: [
		{
			$type: 'app.bsky.richtext.facet#mention';
			did: BlueskyDid;
		},
	];
};

type BlueskyFacet = BlueskyFacetTag | BlueskyFacetLink | BlueskyFacetMention;

interface BlueskyPost {
	uri: string;
	cid: string;
	replyCount: number;
	repostCount: number;
	likeCount: number;
	quoteCount: number;
	indexedAt: string;
	record: {
		$type: 'app.bsky.feed.post';
		createdAt: string;
		text: string;
		embed?: BlueskyEmbed;
		facets?: BlueskyFacet[];
	};
	author: {
		did: BlueskyDid;
		handle: string;
		displayName: string;
		avatar: string | undefined;
		createdAt: string;
	};
}

interface BlueskyAuthorFeedResponse {
	feed: {
		post: BlueskyPost;
		reply: unknown;
	}[];
}

let recentPosts: BlueskyAuthorFeedResponse['feed'] = [];

function loadPostsFromDisk() {
	log.info('Loading posts from disk');
	if (existsSync(config.bluesky.dataPath) === false) {
		log.debug('Cache file does not exist, providing defaults');
		recentPosts = [];
		return;
	}

	const contents = JSON.parse(readFileSync(config.bluesky.dataPath).toString());

	recentPosts = contents.recentPosts || [];
}

function savePostsToDisk() {
	log.info('Saving posts to disk');
	const str = JSON.stringify({ recentPosts }, null, '\t');
	writeFileSync(config.bluesky.dataPath, str);
}

async function fetchPosts(): Promise<BlueskyAuthorFeedResponse> {
	const { username } = config.bluesky;
	const params = new URLSearchParams({ actor: username || '' });
	const response = await phin<BlueskyAuthorFeedResponse>({
		url: `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?${params.toString()}`,
		method: 'GET',
		parse: 'json',
		headers: {
			'User-Agent': config.versionString,
		},
	});

	return response.body;
}

function parsePostContents(post: BlueskyPost): string {
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	// Step 1: Replace facets in reverse order
	let contents = encoder.encode(post.record.text);
	const sortedFacets = [...(post.record.facets ?? [])];
	sortedFacets.sort((a, b) => b.index.byteEnd - a.index.byteEnd);

	for (const {
		index,
		features: [feature],
	} of sortedFacets) {
		const start = decoder.decode(contents.slice(0, index.byteStart));
		const middle = decoder.decode(contents.slice(index.byteStart, index.byteEnd));
		const end = decoder.decode(contents.slice(index.byteEnd));
		const getLink = (href: string) => `<a href='${href}' target='_blank' rel='noopener'>${middle}</a>`;

		switch (feature.$type) {
			case 'app.bsky.richtext.facet#link': {
				contents = encoder.encode(`${start}${getLink(feature.uri)}${end}`);
				break;
			}
			case 'app.bsky.richtext.facet#tag': {
				contents = encoder.encode(
					`${start}${getLink(`https://bsky.app/hashtag/${feature.tag}`)}${end}`,
				);
				break;
			}
			case 'app.bsky.richtext.facet#mention': {
				contents = encoder.encode(
					`${start}${getLink(`https://bsky.app/profile/${feature.did}`)}${end}`,
				);
				break;
			}
			default:
				break;
		}
	}

	// Step 2: Replace new-lines with paragraph tags
	const finalContents = decoder.decode(contents).replace(/\n\n/g, '</p><p>');

	return `<p>${finalContents}</p>`;
}

function transformAtUri(post: BlueskyPost): string {
	const regex = new RegExp(`at:\/\/(?<did>did:plc:[a-z0-9]+)\/${post.record.$type}\/(?<id>[a-z0-9]+)`);

	const match = post.uri.match(regex);
	if (match === null || match.groups === undefined) {
		throw new Error('Invalid bluesky post detected');
	}

	return `https://bsky.app/profile/${match.groups.did}/post/${match.groups.id}`;
}

function getBlobUrl(post: BlueskyPost): { url: string | null; type: Entry['type'] } {
	if (!post.record.embed) return { url: null, type: 'note' };

	let link: string | null = null;
	let type: Entry['type'] | null = 'note';

	switch (post.record.embed.$type) {
		case 'app.bsky.embed.video': {
			link = post.record.embed.video.ref.$link;
			type = 'video';
			break;
		}
		case 'app.bsky.embed.images': {
			if (post.record.embed.images.length === 0) {
				break;
			}

			link = post.record.embed.images[0].image.ref.$link;
			type = 'photo';
			break;
		}
		default:
			return { url: null, type };
	}

	return { url: `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${post.author.did}&cid=${link}`, type };
}

export function pollForBlueskyPosts() {
	const { pollInterval, username, includeReplies } = config.bluesky;

	const intervalMs = pollInterval * minuteMs;
	if (intervalMs === 0 || !username) {
		log.warn('Polling is disabled, no posts will be copied');
		return;
	}

	loadPostsFromDisk();

	const copyPosts = async () => {
		const { feed } = await fetchPosts();
		const newPosts = feed.filter(feedPost => {
			// Skip reply posts if we should exclude them
			if (feedPost.reply !== undefined && !includeReplies) return false;

			// Otherwise, just check it's not already in recentPosts
			return !recentPosts.some(recentPost => recentPost.post.cid === feedPost.post.cid);
		});

		log.info(`Detected ${newPosts.length} new posts`);

		for (const { post } of newPosts) {
			const syndicationUrl = transformAtUri(post);
			const { url, type } = getBlobUrl(post);
			const entry: Insert<Entry> = {
				title: null,
				description: parsePostContents(post),
				created_at: post.record.createdAt,
				status: 'public',
				syndication_json: JSON.stringify([{ name: 'bluesky', url: syndicationUrl }]),
				device_id: config.defaultDeviceId,
				url,
				type,
			};
			insertNote(entry);
			log.debug(`Inserted new post: '${entry.description.slice(0, 40)}...'`);
		}

		recentPosts = feed;

		savePostsToDisk();
	};

	setInterval(copyPosts, intervalMs);
}
