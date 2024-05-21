/**
 * @param {T[]} arr
 * @param {(element: T, index: number, input: T[]) => Promise<void>} fn
 * @template T
 */
export async function asyncForEach (arr, fn) {
	for (let i = 0; i < arr.length; i++) {
		await fn(arr[i], i, arr);
	}
}
