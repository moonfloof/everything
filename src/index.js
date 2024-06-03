import dotenv from 'dotenv';
import { getDatabase } from './database/database.js';
import Logger from './lib/logger.js';

// Servers
import appExternal from './appExternal.js';
import appInternal from './appInternal.js';

// Adapters
import { pollForLikedVideos } from './adapters/youtube.js';
import { pollForGameActivity } from './adapters/steam.js';
import { pollForCacheDeletion } from './lib/middleware/cachePage.js';
import { pollForFilmActivity } from './adapters/letterboxd.js';
import { pollForPsnActivity } from './adapters/psn.js';
import { getDiscordClient } from './adapters/discord.js';

const log = new Logger('http');

// Load .env file
dotenv.config();

// Set up polling adapters
pollForLikedVideos();
pollForGameActivity();
pollForCacheDeletion();
pollForFilmActivity();
pollForPsnActivity();

// Start servers
appExternal();
appInternal();

// Start Discord bot
getDiscordClient();

process.on('exit', () => {
	log.info('Exiting - closing database');

	getDatabase().close();
});
