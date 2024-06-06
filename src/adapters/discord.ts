import { Client, type Message, Partials } from 'discord.js';
import { insertBookmark } from '../database/bookmarks.js';
import { insertYouTubeLike } from '../database/youtubelikes.js';
import { config } from '../lib/config.js';
import Logger from '../lib/logger.js';
import { getYouTubeVideoSnippet } from './youtube.js';

const log = new Logger('discord');

let client: Client;

export function getDiscordClient() {
	if (!(config.discord.token && config.discord.channelId)) {
		log.warn('No token or channel ID provided, bot will not be enabled');
		return null;
	}

	if (client) return client;

	client = new Client({
		partials: [Partials.Message, Partials.User, Partials.Channel],
		intents: ['Guilds', 'GuildMessages', 'MessageContent'],
	});

	client.on('ready', client => {
		log.info(`Logged in as ${client.user.tag}!`);
		client.on('messageCreate', message => handleMessage(message, client));
	});

	client.login(config.discord.token);

	return client;
}

async function commandYouTube(args: string[], message: Message) {
	if (args[0] === 'help') {
		await message.reply('Usage: `youtube <URL> [liked date/time]`');
		return;
	}

	const details = await getYouTubeVideoSnippet(args[0]);

	insertYouTubeLike({
		title: details.snippet?.title as string,
		video_id: details.id as string,
		channel: details.snippet?.channelTitle || 'N/A',
		device_id: config.defaultDeviceId,
		created_at: '',
	});
}

async function commandBookmark(args: string[], message: Message) {
	if (args[0] === 'help') {
		await message.reply('Usage: `bookmark <URL> <TITLE>`');
		return;
	}

	const [url, ...titleParts] = args;
	const title = titleParts.join(' ').trim();

	if (!(url && title)) {
		const error = 'Please provide a url and title';
		await message.reply(error);
		throw new Error(error);
	}

	insertBookmark({ title, url, device_id: config.defaultDeviceId, created_at: '' });
}

async function handleMessage(message: Message, client: Client<true>) {
	if (message.channel.id !== config.discord.channelId) return;
	if (message.author.tag === client.user.tag) return;
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
