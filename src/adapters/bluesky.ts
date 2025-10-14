import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import phin from 'phin';
import { type Entry, insertNote } from '../database/notes.js';
import { config } from '../lib/config.js';
import { minuteMs } from '../lib/formatDate.js';
import Logger from '../lib/logger.js';
import type { Insert } from '../types/database.js';
import type { AuthorFeedResponse, FeedItem, Post } from './blueskyTypes.js';
import { getKawaUrl } from './kawa.js';

const log = new Logger('bluesky');

let recentPosts: AuthorFeedResponse['feed'] = [];

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

async function fetchPosts(): Promise<AuthorFeedResponse> {
	const { username } = config.bluesky;
	const params = new URLSearchParams({ actor: username || '' });
	const response = await phin<AuthorFeedResponse>({
		url: `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?${params.toString()}`,
		method: 'GET',
		parse: 'json',
		headers: {
			'User-Agent': config.versionString,
		},
	});

	return response.body;
}

const getHashtagUrl = (hashtag: string) => `https://bsky.app/hashtag/${hashtag}`;
const getProfileUrl = (handle: string) => `https://bsky.app/profile/${handle}`;
const getBlobUrl = (did: string, cid: string) =>
	getKawaUrl(`https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`);

function parsePostContents(post: Post): string {
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
				contents = encoder.encode(`${start}${getLink(getHashtagUrl(feature.tag))}${end}`);
				break;
			}
			case 'app.bsky.richtext.facet#mention': {
				contents = encoder.encode(`${start}${getLink(getProfileUrl(feature.did))}${end}`);
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

function transformAtUri(post: Post): string {
	const regex = new RegExp(`at:\/\/(?<did>did:plc:[a-z0-9]+)\/${post.record.$type}\/(?<id>[a-z0-9]+)`);

	const match = post.uri.match(regex);
	if (match === null || match.groups === undefined) {
		throw new Error('Invalid bluesky post detected');
	}

	return `https://bsky.app/profile/${post.author.handle ?? match.groups.did}/post/${match.groups.id}`;
}

async function getPostMetadata(item: FeedItem): Promise<Partial<Entry>> {
	const { post, reply, reason } = item;

	const metadata: Partial<Entry> & { description: string } = {
		description: parsePostContents(post),
	};

	if (reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
		metadata.url = transformAtUri(post);
		metadata.type = 'repost';

		// Include embedded images and videos in reposts
		switch (post.record.embed?.$type) {
			case undefined:
				break;
			case 'app.bsky.embed.images': {
				const { images } = post.record.embed;
				if (images.length === 0 || images[0] === undefined) break;

				const blobUrl = await getBlobUrl(post.author.did, images[0].image.ref.$link);
				const altText = images[0].alt;
				metadata.description = `<img class='u-photo' src='${blobUrl}' alt='${altText}' />${metadata.description}`;
				break;
			}
			case 'app.bsky.embed.video': {
				const { embed } = post.record;
				const blobUrl = await getBlobUrl(post.author.did, embed.video.ref.$link);
				metadata.description = `<video class='u-video' src='${blobUrl}' controls></video>${metadata.description}`;
			}
		}

		return metadata;
	}

	// TODO: Refactor embed switches to reuse for posts, replies, and reposts
	if (reply) {
		metadata.url = transformAtUri(reply.parent);
		metadata.type = 'reply';
		return metadata;
	}

	if (!post.record.embed) return metadata;

	switch (post.record.embed.$type) {
		case 'app.bsky.embed.video': {
			metadata.url = await getBlobUrl(post.author.did, post.record.embed.video.ref.$link);
			metadata.type = 'video';
			return metadata;
		}
		case 'app.bsky.embed.images': {
			const { images } = post.record.embed;
			if (images.length === 0 || images[0] === undefined) {
				break;
			}

			metadata.url = await getBlobUrl(post.author.did, images[0].image.ref.$link);
			metadata.type = 'photo';
			return metadata;
		}
	}

	return metadata;
}

export function pollForBlueskyPosts() {
	const { pollInterval, username, includeReplies, includeReposts } = config.bluesky;

	const intervalMs = pollInterval * minuteMs;
	if (intervalMs === 0 || !username) {
		log.warn('Polling is disabled, no posts will be copied');
		return;
	}

	loadPostsFromDisk();

	const copyPosts = async () => {
		const { feed } = await fetchPosts();
		const newPosts = feed.filter(feedPost => {
			// Pinned posts aren't included in the request by default,
			// but exclude them to be certain.
			if (feedPost.reason?.$type === 'app.bsky.feed.defs#reasonPin') return false;

			// Skip reposts if we should exclude them
			if (feedPost.reason?.$type === 'app.bsky.feed.defs#reasonRepost' && !includeReposts)
				return false;

			// Skip reply posts if we should exclude them
			if (feedPost.reply !== undefined && !includeReplies) return false;

			// Otherwise, just check it's not already in recentPosts
			return !recentPosts.some(recentPost => recentPost.post.cid === feedPost.post.cid);
		});

		// Sort by reverse chronological order
		newPosts.sort(
			(a, b) =>
				new Date(a.post.record.createdAt).getTime() -
				new Date(b.post.record.createdAt).getTime(),
		);

		log.info(`Detected ${newPosts.length} new posts`);

		for (const item of newPosts) {
			const { post } = item;
			const syndicationUrl = transformAtUri(post);
			const metadata = await getPostMetadata(item);
			const entry: Insert<Entry> = {
				description: parsePostContents(post),
				title: null,
				url: null,
				type: 'note',
				...metadata,

				status: 'public',
				created_at: post.record.createdAt,
				syndication_json: JSON.stringify([{ name: 'bluesky', url: syndicationUrl }]),
				device_id: config.defaultDeviceId,
			};
			insertNote(entry);
			log.debug(`Inserted new post: '${entry.description.slice(0, 40)}...'`);
		}

		recentPosts = feed;

		savePostsToDisk();
	};

	setInterval(copyPosts, intervalMs);
}
