import './lib/config/index.js';

// Adapters
import { pollForBlueskyPosts } from './adapters/bluesky.js';
import { getDiscordClient } from './adapters/discord.js';
import { initLocationCache } from './adapters/geocoder.js';
import { pollForFilmActivity } from './adapters/letterboxd.js';
import { pollForPsnActivity } from './adapters/psn.js';
import { pollForRetroAchievementsActivity } from './adapters/retroachievements.js';
import { pollForGameActivity } from './adapters/steam.js';

// Servers
import appExternal from './appExternal.js';
import appInternal from './appInternal.js';

// Others
import { getDatabase } from './database/database.js';
import { checkMigrations } from './database/migrations.js';
import { initConfig } from './lib/config/index.js';
import Logger from './lib/logger.js';
import { convertAllImagesToAvif } from './lib/mediaFiles.js';
import { pageCache } from './lib/middleware/cachePage.js';

const log = new Logger('http');

// Always run migrations first
checkMigrations();

// Set up polling adapters
initConfig();
initLocationCache();
pageCache.pollForCacheDeletion();
pollForGameActivity();
pollForFilmActivity();
pollForPsnActivity();
pollForRetroAchievementsActivity();
pollForBlueskyPosts();

// Start servers
appExternal();
appInternal();

// Start Discord bot
getDiscordClient();

// Convert all non-avif images to avif
convertAllImagesToAvif();

process.on('exit', () => {
	log.info('Exiting - closing database');

	getDatabase().close();
});
