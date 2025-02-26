import express from 'express';
import { getEpisode, getEpisodeList, getSeriesList } from '../../adapters/sonarr.js';
import { countEpisodes, deleteEpisode, getEpisodes, insertEpisode, updateEpisode } from '../../database/tv.js';
import { config } from '../../lib/config.js';
import { padString } from '../../lib/formatDate.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import Logger from '../../lib/logger.js';
import type { RequestFrontend } from '../../types/express.js';

const log = new Logger('tv');

const router = express.Router();

// FRONTEND

router.get('/list', (req: RequestFrontend, res) => {
	const { page = 0 } = req.query;
	const pagination = handlebarsPagination(page, countEpisodes());

	const episodes = getEpisodes({ page });

	res.render('internal/tv', { episodes, pagination });
});

// CRUD

router.get('/', async (_req, res) => {
	try {
		const seriesList = await getSeriesList();

		res.render('internal/tv-series', { seriesList });
	} catch (err) {
		log.error(err);
		res.redirect('/');
	}
});

router.get('/episode', async (req: RequestFrontend, res) => {
	try {
		const episodeList = await getEpisodeList(req.query.seriesId);

		res.render('internal/tv-episode', { episodeList });
	} catch (err) {
		log.error(err);
		res.redirect('/');
	}
});

router.post('/episode', async (req: RequestFrontend, res) => {
	try {
		const episode = await getEpisode(req.body.episodeId);
		const seasonNumber = padString(episode.seasonNumber, 2);
		const episodeNumber = padString(episode.episodeNumber, 2);
		const episode_title = `S${seasonNumber}E${episodeNumber} - ${episode.title}`;
		const series_title = `${episode.series.title} (${episode.series.year})`;
		const duration_secs = episode.runtime === 0 ? null : episode.runtime * 60;

		insertEpisode({
			series_title,
			episode_title,
			duration_secs,
			device_id: config.defaultDeviceId,
			created_at: '',
		});

		log.info(`Logged episode '${episode_title}' from '${series_title}'`);

		res.redirect('/tv/list');
	} catch (err) {
		log.error(err);
		res.redirect('/');
	}
});

router.post('/', (req: RequestFrontend, res) => {
	const { series_title, episode_title, duration_secs, created_at } = req.body;

	insertEpisode({
		series_title,
		episode_title,
		duration_secs: duration_secs?.trim() ? Number(duration_secs) : null,
		device_id: config.defaultDeviceId,
		created_at,
	});

	log.info(`Logged episode '${episode_title}' from '${series_title}'`);

	res.redirect('/tv/list');
});

router.post('/:id', (req: RequestFrontend, res) => {
	const { id } = req.params;
	const { crudType, series_title, episode_title, duration_secs, created_at } = req.body;

	switch (crudType) {
		case 'delete': {
			deleteEpisode(id);
			break;
		}

		case 'update': {
			updateEpisode({
				id,
				series_title,
				episode_title,
				duration_secs: duration_secs?.trim() ? Number(duration_secs) : null,
				created_at,
			});
			break;
		}

		default:
			// Do nothing
			break;
	}

	res.redirect('/tv/list');
});

export default router;
