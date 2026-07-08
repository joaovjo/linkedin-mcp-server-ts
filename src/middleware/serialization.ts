type AsyncFn<T> = () => Promise<T>;

class SerializationQueue {
	private queue: Map<string, Promise<unknown>> = new Map();

	async execute<T>(slot: string, fn: AsyncFn<T>): Promise<T> {
		const prev = this.queue.get(slot) ?? Promise.resolve();
		const next = prev.then(() => fn());
		this.queue.set(slot, next);
		return await next;
	}

	clear(): void {
		this.queue.clear();
	}
}

export const serializationQueue = new SerializationQueue();
