import type { APIRoute } from 'astro';

export const prerender = false;

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const UPSTREAM_TIMEOUT_MS = 10 * 1000;
const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type CacheEntry = {
	data: JsonValue;
	expiresAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<JsonValue>>();

function jsonResponse(data: JsonValue, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			...headers,
		},
	});
}

function isValidJsonValue(value: unknown): value is JsonValue {
	if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
		return true;
	}

	if (Array.isArray(value)) {
		return value.every(isValidJsonValue);
	}

	if (typeof value === 'object') {
		return Object.values(value as Record<string, unknown>).every(isValidJsonValue);
	}

	return false;
}

function getCached(username: string): JsonValue | undefined {
	const entry = responseCache.get(username);
	if (!entry) {
		return undefined;
	}

	if (entry.expiresAt <= Date.now()) {
		responseCache.delete(username);
		return undefined;
	}

	return entry.data;
}

function setCached(username: string, data: JsonValue) {
	if (responseCache.size >= MAX_CACHE_ENTRIES && !responseCache.has(username)) {
		const oldestUsername = responseCache.keys().next().value;
		if (oldestUsername) {
			responseCache.delete(oldestUsername);
		}
	}

	responseCache.delete(username);
	responseCache.set(username, {
		data,
		expiresAt: Date.now() + CACHE_TTL_MS,
	});
}

async function fetchContributions(username: string): Promise<JsonValue> {
	const existingRequest = inFlightRequests.get(username);
	if (existingRequest) {
		return existingRequest;
	}

	const request = (async () => {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

		try {
			const upstreamResponse = await fetch(`https://github.com/${username}.contribs`, {
				headers: {
					Accept: 'application/json',
				},
				signal: controller.signal,
			});

			if (!upstreamResponse.ok) {
				throw new Error(`Upstream returned HTTP ${upstreamResponse.status}`);
			}

			let data: unknown;
			try {
				data = await upstreamResponse.json();
			} catch {
				throw new Error('Upstream returned invalid JSON');
			}

			if (!isValidJsonValue(data)) {
				throw new Error('Upstream returned an unsupported JSON value');
			}

			setCached(username, data);
			return data;
		} finally {
			clearTimeout(timeout);
		}
	})();

	inFlightRequests.set(username, request);
	try {
		return await request;
	} finally {
		inFlightRequests.delete(username);
	}
}

export const GET: APIRoute = async ({ params }) => {
	const username = params.username?.trim();
	if (!username || !USERNAME_PATTERN.test(username)) {
		return jsonResponse(
			{ error: 'Invalid GitHub username.' },
			400,
			{ 'Cache-Control': 'no-store' },
		);
	}

	const normalizedUsername = username.toLowerCase();
	const cachedData = getCached(normalizedUsername);
	if (cachedData !== undefined) {
		return jsonResponse(cachedData, 200, {
			'Cache-Control': 'public, max-age=300',
			'X-Contributions-Cache': 'HIT',
		});
	}

	try {
		const data = await fetchContributions(normalizedUsername);
		return jsonResponse(data, 200, {
			'Cache-Control': 'public, max-age=300',
			'X-Contributions-Cache': 'MISS',
		});
	} catch (error) {
		const isTimeout = error instanceof DOMException && error.name === 'AbortError';
		const message = isTimeout ? 'GitHub contribution request timed out.' : 'Unable to fetch GitHub contributions.';
		const status = isTimeout ? 504 : 502;

		console.error('Contribution proxy request failed.', {
			username: normalizedUsername,
			error,
		});

		return jsonResponse({ error: message }, status, { 'Cache-Control': 'no-store' });
	}
};
