export type DidPerson = `did:plc:${string}`;
export type DidWeb = `did:web:${string}`;
export type AtUri = `at://${DidPerson}/app.bsky.feed.post/${string}`;

export interface Author {
	did: DidPerson;
	handle: string;
	displayName?: string;
	avatar?: string;
	createdAt?: string;
}

export interface EmbedBlob {
	$type: 'blob';
	ref: {
		$link: string;
	};
	mimeType: string;
	size: number;
}

export interface AspectRatio {
	width: number;
	height: number;
}

export interface RecordEmbedImages {
	$type: 'app.bsky.embed.images';
	images: {
		alt?: string;
		aspectRatio: AspectRatio;
		image: EmbedBlob;
	}[];
}
export interface RecordEmbedVideo {
	$type: 'app.bsky.embed.video';
	aspectRatio: AspectRatio;
	video: EmbedBlob;
}

export interface RecordEmbedExternal {
	$type: 'app.bsky.embed.external';
	external: {
		description: string;
		title: string;
		uri: string;
		thumb?: EmbedBlob;
	};
}

export type RecordEmbed = RecordEmbedImages | RecordEmbedVideo | RecordEmbedExternal;

interface PostEmbedVideo {
	$type: 'app.bsky.embed.video#view';
	cid: string;
	playlist: string;
	thumbnail: string;
	aspectRatio: AspectRatio;
}

type PostEmbedExternal = RecordEmbedExternal & {
	$type: 'app.bsky.embed.external#view';
};

interface PostEmbedImages {
	$type: 'app.bsky.embed.images#view';
	images: {
		thumb: string;
		fullsize: string;
		alt?: string;
		aspectRatio: AspectRatio;
	}[];
}

interface GeneratorView {
	$type: 'app.bsky.feed.defs#generatorView';
	uri: AtUri;
	cid: string;
	did: DidWeb;
	creator: Author;
	displayName: string;
	description: string;
	avatar: string;
	likeCount: number;
	labels: unknown[];
	indexedAt: string;
}

interface PostEmbedTextQuote {
	$type: 'app.bsky.embed.record#view';
	record: Post | GeneratorView;
}

interface PostEmbedMediaQuote {
	$type: 'app.bsky.embed.recordWithMedia#view';
	media: PostEmbedImages;
	record: unknown;
}

export type PostEmbed = PostEmbedVideo | PostEmbedExternal | PostEmbedImages | PostEmbedTextQuote | PostEmbedMediaQuote;

export interface FacetIndex {
	index: {
		byteStart: number;
		byteEnd: number;
	};
}

export type FacetTag = FacetIndex & {
	features: [
		{
			$type: 'app.bsky.richtext.facet#tag';
			tag: string;
		},
	];
};

export type FacetLink = FacetIndex & {
	features: [
		{
			$type: 'app.bsky.richtext.facet#link';
			uri: string;
		},
	];
};

export type FacetMention = FacetIndex & {
	features: [
		{
			$type: 'app.bsky.richtext.facet#mention';
			did: DidPerson;
		},
	];
};

export type Facet = FacetTag | FacetLink | FacetMention;

export interface Post {
	uri: AtUri;
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
		embed?: RecordEmbed;
		facets?: Facet[];
	};
	embed?: PostEmbed;
	author: Author;
}

export interface ReasonRepost {
	$type: 'app.bsky.feed.defs#reasonRepost';
	by: Author;
	indexedAt: string;
}

export interface ReasonPin {
	$type: 'app.bsky.feed.defs#reasonPin';
}

export interface Reply {
	root: Post & { $type: 'app.bsky.feed.defs#postView' };
	parent: Post & { $type: 'app.bsky.feed.defs#postView' };
}

export type Reason = ReasonRepost | ReasonPin;

export interface FeedItem {
	post: Post;
	reply?: Reply;
	reason?: Reason;
}

export interface AuthorFeedResponse {
	feed: FeedItem[];
}
