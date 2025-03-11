import Logger from './logger.js';

const log = new Logger('queue');

type QueueItem = () => Promise<void> | void;

class Queue {
	private queue: QueueItem[] = [];

	public async addToQueue(item: QueueItem) {
		const skip = this.queue.length > 0;
		this.queue.push(item);

		if (skip) return;

		while (this.queue.length > 0) {
			if (this.queue[0] === undefined) {
				return;
			}

			const task = this.queue[0];

			try {
				await task();
			} catch (err) {
				log.error(err);
			}

			this.queue.shift();
		}
	}
}

export const queue = new Queue();
