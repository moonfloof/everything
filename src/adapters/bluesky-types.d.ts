export type BlueskyDid = `did:plc:${string}`;

export interface BlueskyAuthor {
	did: BlueskyDid;
	handle: string;
	displayName?: string;
	avatar?: string;
	createdAt?: string;
}

export interface BlueskyBlob {
	$type: 'blob';
	ref: {
		$link: string;
	};
	mimeType: string;
	size: number;
}

export interface BlueskyEmbedImages {
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
export interface BlueskyEmbedVideo {
	$type: 'app.bsky.embed.video';
	aspectRatio: {
		width: number;
		height: number;
	};
	video: BlueskyBlob;
}

export interface BlueskyEmbedExternal {
	$type: 'app.bsky.embed.external';
	external: {
		description: string;
		title: string;
		uri: string;
		thumb?: BlueskyBlob;
	};
}

export type BlueskyEmbed = BlueskyEmbedImages | BlueskyEmbedVideo | BlueskyEmbedExternal;

export interface BlueskyFacetIndex {
	index: {
		byteStart: number;
		byteEnd: number;
	};
}

export type BlueskyFacetTag = BlueskyFacetIndex & {
	features: [
		{
			$type: 'app.bsky.richtext.facet#tag';
			tag: string;
		},
	];
};

export type BlueskyFacetLink = BlueskyFacetIndex & {
	features: [
		{
			$type: 'app.bsky.richtext.facet#link';
			uri: string;
		},
	];
};

export type BlueskyFacetMention = BlueskyFacetIndex & {
	features: [
		{
			$type: 'app.bsky.richtext.facet#mention';
			did: BlueskyDid;
		},
	];
};

export type BlueskyFacet = BlueskyFacetTag | BlueskyFacetLink | BlueskyFacetMention;

export interface BlueskyPost {
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
	author: BlueskyAuthor;
}

export interface BlueskyReasonRepost {
	$type: 'app.bsky.feed.defs#reasonRepost';
	by: BlueskyAuthor;
	indexedAt: string;
}

export interface BlueskyReasonPin {
	$type: 'app.bsky.feed.defs#reasonPin';
}

export type BlueskyReason = BlueskyReasonRepost | BlueskyReasonPin;

export interface BlueskyAuthorFeedResponse {
	feed: {
		post: BlueskyPost;
		reply?: unknown;
		reason?: BlueskyReason;
	}[];
}
