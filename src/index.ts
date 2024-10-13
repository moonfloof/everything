import './lib/config.js';
import { getDatabase } from './database/database.js';
import { checkMigrations } from './database/migrations.js';
import Logger from './lib/logger.js';

// Servers
import appExternal from './appExternal.js';
import appInternal from './appInternal.js';

import { getDiscordClient } from './adapters/discord.js';
import { pollForFilmActivity } from './adapters/letterboxd.js';
import { pollForPsnActivity } from './adapters/psn.js';
import { pollForGameActivity } from './adapters/steam.js';
import { pollForRetroAchievementsActivity } from './adapters/retroachievements.js';

// Adapters
import { initLocationCache } from './adapters/geocoder.js';
import { pollForLikedVideos } from './adapters/youtube.js';
import { pageCache } from './lib/middleware/cachePage.js';

const log = new Logger('http');

// Always run migrations first
checkMigrations();

// Set up polling adapters
initLocationCache();
pageCache.pollForCacheDeletion();
pollForLikedVideos();
pollForGameActivity();
pollForFilmActivity();
pollForPsnActivity();
pollForRetroAchievementsActivity();

// Start servers
appExternal();
appInternal();

// Start Discord bot
getDiscordClient();

process.on('exit', () => {
	log.info('Exiting - closing database');

	getDatabase().close();
});
