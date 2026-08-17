import { describe, expect, test } from "bun:test";
import { serializationQueue } from "../../src/middleware/serialization.ts";

describe("Integration: serializationQueue", () => {
	test("executes asynchronous tasks sequentially for the same slot", async () => {
		const order: number[] = [];

		const task1 = serializationQueue.execute("test-slot", async () => {
			await Bun.sleep(20);
			order.push(1);
			return "result-1";
		});

		const task2 = serializationQueue.execute("test-slot", async () => {
			await Bun.sleep(5);
			order.push(2);
			return "result-2";
		});

		const [res1, res2] = await Promise.all([task1, task2]);

		expect(res1).toBe("result-1");
		expect(res2).toBe("result-2");
		expect(order).toEqual([1, 2]);
	});

	test("recovers gracefully from task errors without locking future executions", async () => {
		let task2Executed = false;

		const failedTask = serializationQueue.execute("failing-slot", async () => {
			throw new Error("Deliberate failure in task 1");
		});

		const subsequentTask = serializationQueue.execute("failing-slot", async () => {
			task2Executed = true;
			return "recovered";
		});

		await expect(failedTask).rejects.toThrow("Deliberate failure in task 1");
		const result = await subsequentTask;
		expect(task2Executed).toBe(true);
		expect(result).toBe("recovered");
	});

	test("different slots run independently", async () => {
		const slotA = serializationQueue.execute("slot-a", async () => "A");
		const slotB = serializationQueue.execute("slot-b", async () => "B");

		expect(await slotA).toBe("A");
		expect(await slotB).toBe("B");
	});
});
