const reverseGeocodeCache = new Map<string, string | undefined>();
const pendingReverseGeocodes = new Map<string, Promise<string | undefined>>();
const persistentCacheKey = "findy:kakao-reverse-geocode:v1";
const persistentCacheTtlMs = 24 * 60 * 60 * 1000;
const persistentCacheLimit = 500;

interface PersistentReverseGeocodeEntry {
  address?: string;
  savedAt: number;
}

type PersistentReverseGeocodeCache = Record<string, PersistentReverseGeocodeEntry>;

function getCoordinateKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export function getReverseGeocodeCacheKey(lat: number, lng: number): string {
  return getCoordinateKey(lat, lng);
}

function readPersistentCache(): PersistentReverseGeocodeCache {
  try {
    const rawCache = window.localStorage.getItem(persistentCacheKey);
    if (!rawCache) {
      return {};
    }

    const parsedCache = JSON.parse(rawCache);
    if (!parsedCache || typeof parsedCache !== "object") {
      return {};
    }

    return parsedCache as PersistentReverseGeocodeCache;
  } catch {
    return {};
  }
}

function writePersistentCache(cache: PersistentReverseGeocodeCache): void {
  try {
    const entries = Object.entries(cache)
      .sort(([, left], [, right]) => right.savedAt - left.savedAt)
      .slice(0, persistentCacheLimit);
    window.localStorage.setItem(persistentCacheKey, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Cache failures should never block the user's location selection flow.
  }
}

function getPersistentAddress(key: string): string | undefined {
  const cache = readPersistentCache();
  const entry = cache[key];
  if (!entry) {
    return undefined;
  }

  if (Date.now() - entry.savedAt > persistentCacheTtlMs) {
    delete cache[key];
    writePersistentCache(cache);
    return undefined;
  }

  reverseGeocodeCache.set(key, entry.address);
  return entry.address;
}

function setPersistentAddress(key: string, address: string | undefined): void {
  const cache = readPersistentCache();
  cache[key] = {
    address,
    savedAt: Date.now(),
  };
  writePersistentCache(cache);
}

async function reverseGeocodeFromServer(
  lat: number,
  lng: number,
): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
    });
    const response = await fetch(`/api/geocode/reverse?${params.toString()}`);
    if (!response.ok) {
      return undefined;
    }

    const body = (await response.json()) as { address?: string | null };
    return body.address || undefined;
  } catch {
    return undefined;
  }
}

export function reverseGeocodeKakao(
  lat: number,
  lng: number,
): Promise<string | undefined> {
  const key = getCoordinateKey(lat, lng);
  if (reverseGeocodeCache.has(key)) {
    return Promise.resolve(reverseGeocodeCache.get(key));
  }

  const persistentAddress = getPersistentAddress(key);
  if (persistentAddress !== undefined) {
    return Promise.resolve(persistentAddress);
  }

  const pending = pendingReverseGeocodes.get(key);
  if (pending) {
    return pending;
  }

  const request = reverseGeocodeFromServer(lat, lng).then((serverAddress) => {
    if (serverAddress || !window.kakao?.maps?.services) {
      reverseGeocodeCache.set(key, serverAddress);
      setPersistentAddress(key, serverAddress);
      pendingReverseGeocodes.delete(key);
      return serverAddress;
    }

    return new Promise<string | undefined>((resolve) => {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result: any, status: any) => {
        const address =
          status === window.kakao.maps.services.Status.OK && result?.[0]
            ? result[0].road_address?.address_name || result[0].address?.address_name
            : undefined;

        reverseGeocodeCache.set(key, address);
        setPersistentAddress(key, address);
        pendingReverseGeocodes.delete(key);
        resolve(address);
      });
    });
  });

  pendingReverseGeocodes.set(key, request);
  return request;
}
