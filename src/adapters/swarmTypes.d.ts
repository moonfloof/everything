export interface SwarmAccessToken {
	access_token: string;
}

interface SwarmUser {
	id: string;
	firstName: string;
	handle: string;
	privateProfile: boolean;
	gender: string;
	address: string;
	city: string;
	state: string;
	countryCode: string;
	relationship: string;
	photo: {
		prefix: string;
		suffix: string;
	};
	birthday: number;
}

export interface SwarmPhoto {
	id: string;
	createdAt: number;
	prefix: string;
	suffix: string;
	width: number;
	height: number;
	user: SwarmUser;
	visibility: string;
}

interface SwarmSticker {
	id: string;
	name: string;
	image: {
		prefix: string;
		sizes: number[];
		name: string;
	};
	stickerType: string;
	group: {
		name: string;
		index: number;
	};
	pickerPosition: {
		page: number;
		index: number;
	};
	teaseText: string;
	unlockText: string;
	bonusText?: string;
	points?: number;
	bonusStatus?: string;
}

export interface SwarmPushCheckin {
	id: string;
	createdAt: number;
	type: 'checkin' | string;
	visibility: 'closeFriends' | 'public' | 'private';
	shout?: string;
	timeZoneOffset: number; // minutes
	user: SwarmUser;
	venue: {
		id: string;
		name: string;
		location: {
			lat: number;
			lng: number;
			labeledLatLngs: {
				label: string;
				lat: number;
				lng: number;
			}[];
			postalCode: string;
			cc: string;
			city: string;
			state: string;
			country: string;
			formattedAddress: string[];
		};
		categories: {
			id: string;
			name: string;
			pluralName: string;
			shortName: string;
			icon: {
				prefix: string;
				suffix: string;
			};
			categoryCode: number;
			mapIcon: string;
			primary: boolean;
		}[];
		createdAt: number;
	};
}

interface SwarmMeta {
	code: number;
	requestId: string;
}

interface SwarmNotification {
	type: string;
	item: {
		unreadCount: number;
	};
}

export interface SwarmCheckinDetails {
	meta: SwarmMeta;
	notifications: SwarmNotification[];
	response: {
		checkin: SwarmPushCheckin & {
			source: {
				name: string;
				url: string;
			};
			photos: {
				count: number;
				items: SwarmPhoto[];
			};
			checkinShortUrl?: string;
			like?: boolean;
			sticker?: SwarmSticker;
			isMayor?: false;
			score: {
				total: number;
				scores: {
					icon: string;
					message: string;
					points: number;
				}[];
			};
			showStickerUpsell?: boolean;
			unlockedStickers: SwarmSticker[];
		};
	};
}

export interface SwarmSelfDetails {
	meta: SwarmMeta;
	notifications: SwarmNotification[];
	response: {
		user: SwarmUser;
	};
}
