import { Router } from 'express';
import { pageCache } from '../../lib/middleware/cachePage.js';
import type { RequestFrontend } from '../../types/express.js';

const router = Router();

router.get('/', (req: RequestFrontend<{ hasError?: string }>, res) => {
	res.render('internal/cache', {
		cachedPages: [...pageCache.cache].sort((a, b) => a[0].localeCompare(b[0])),
		hasError: req.query.hasError !== undefined,
	});
});

router.post('/delete', (req: RequestFrontend<object, { url: string }>, res) => {
	try {
		const { url } = req.body;
		pageCache.deleteCacheEntry(url);
		res.redirect('/cache');
	} catch (_err) {
		res.redirect('/cache?hasError');
	}
});

router.post('/delete-all', (_req, res) => {
	pageCache.purgeAllCache();
	res.redirect('/cache');
});

export default router;
