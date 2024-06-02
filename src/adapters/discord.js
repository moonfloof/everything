import { Client } from 'discord.js';
import { insertBookmark } from '../database/bookmarks.js';
import { insertYouTubeLike } from '../database/youtubelikes.js';
import Logger from '../lib/logger.js';
import { getYouTubeVideoSnippet } from './youtube.js';

const log = new Logger('discord');

/** @type {Client} */
let client = null;

/**
 * @returns {Client|null}
 */
export function getDiscordClient() {
	if (!process.env.TOMBOIS_DISCORD_TOKEN || !process.env.TOMBOIS_DISCORD_CHANNELID) {
		log.warn('No token or channel ID provided, bot will not be enabled');
		return null;
	}

	if (client !== null) return client;

	client = new Client({
		partials: ['MESSAGE', 'USER', 'CHANNEL'],
		intents: ['Guilds', 'GuildMessages', 'MessageContent'],
	});

	client.on('ready', () => {
		log.info(`Logged in as ${client.user.tag}!`);
	});

	client.on('messageCreate', handleMessage);

	client.login(process.env.TOMBOIS_DISCORD_TOKEN);

	return client;
}

/**
 * @param {string[]} args
 * @param {import('discord.js').Message} message
 */
async function commandYouTube(args, message) {
	if (args[0] === 'help') {
		await message.reply('Usage: `youtube <URL> [liked date/time]`');
		return;
	}

	const details = await getYouTubeVideoSnippet(args[0]);

	insertYouTubeLike(
		details?.id,
		details?.snippet?.title,
		details?.snippet?.channelTitle || 'N/A',
		process.env.TOMBOIS_DEFAULT_DEVICE_ID,
		args[1],
	);
}

/**
 * @param {string[]} args
 * @param {import('discord.js').Message} message
 */
async function commandBookmark(args, message) {
	if (args[0] === 'help') {
		await message.reply('Usage: `bookmark <URL> <TITLE>`');
		return;
	}

	const [url, ...titleParts] = args;
	const title = titleParts.join(' ').trim();

	if (!url || !title) {
		const error = 'Please provide a url and title';
		await message.reply(error);
		throw new Error(error);
	}

	insertBookmark(title, url, process.env.TOMBOIS_DEFAULT_DEVICE_ID);
}

/**
 * @param {import('discord.js').Message} message
 */
async function handleMessage(message) {
	if (message.channel.id !== process.env.TOMBOIS_DISCORD_CHANNELID) return;
	if (message.author.tag === getDiscordClient()?.user.tag) return;
	if (message.partial) return;
	if (!message.content) return;

	const [command, ...args] = message.content.split(' ');
	try {
		switch (command) {
			case 'youtube': {
				commandYouTube(args, message);
				break;
			}
			case 'bookmark': {
				commandBookmark(args, message);
				break;
			}
			default:
				return;
		}

		await message.react('👍');
	} catch (err) {
		log.error(err);
		await message.react('🛑');
	}
}
