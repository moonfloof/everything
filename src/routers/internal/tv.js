import express from 'express';
import { getEpisode, getEpisodeList, getSeriesList } from '../../adapters/sonarr.js';
import { countEpisodes, deleteEpisode, getEpisodes, insertEpisode, updateEpisode } from '../../database/tv.js';
import { padString } from '../../lib/formatDate.js';
import handlebarsPagination from '../../lib/handlebarsPagination.js';
import Logger from '../../lib/logger.js';

const log = new Logger('tv');

const router = express.Router();

// FRONTEND

router.get('/list', (req, res) => {
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

router.get('/episode', async (req, res) => {
	try {
		const episodeList = await getEpisodeList(req.query.seriesId);

		res.render('internal/tv-episode', { episodeList });
	} catch (err) {
		log.error(err);
		res.redirect('/');
	}
});

router.post('/episode', async (req, res) => {
	try {
		const episode = await getEpisode(req.body.episodeId);
		const seasonNumber = padString(episode.seasonNumber, 2);
		const episodeNumber = padString(episode.episodeNumber, 2);
		const episodeTitle = `S${seasonNumber}E${episodeNumber} - ${episode.title}`;
		const seriesTitle = `${episode.series.title} (${episode.series.year})`;

		insertEpisode(seriesTitle, episodeTitle, process.env.TOMBOIS_DEFAULT_DEVICE_ID);

		log.info(`Logged episode '${episodeTitle}' from '${seriesTitle}'`);

		res.redirect('/tv/list');
	} catch (err) {
		log.error(err);
		res.redirect('/');
	}
});

router.post('/', (req, res) => {
	const { series_title, episode_title, created_at } = req.body;

	insertEpisode(series_title, episode_title, process.env.TOMBOIS_DEFAULT_DEVICE_ID, created_at);

	log.info(`Logged episode '${episode_title}' from '${series_title}'`);

	res.redirect('/tv/list');
});

router.post('/:id', (req, res) => {
	const { id } = req.params;
	const { crudType, series_title, episode_title, created_at } = req.body;

	switch (crudType) {
		case 'delete':
			deleteEpisode(id);
			break;

		case 'update':
			updateEpisode(id, series_title, episode_title, created_at);
			break;

		default:
			// Do nothing
			break;
	}

	res.redirect('/tv/list');
});

export default router;
