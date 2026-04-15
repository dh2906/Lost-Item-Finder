import type { LocationFilterScope } from "@shared/routes";
import type { Item } from "@shared/schema";

type LocationFilterInput = {
  useLocationFilter?: boolean;
  locationScope?: LocationFilterScope;
  locationText?: string;
  latitude?: string | null;
  longitude?: string | null;
  radiusKm?: number;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type LocationContext = {
  sido: string | null;
  sigungu: string | null;
  dong: string | null;
};

const DEFAULT_RADIUS_KM = 3;

function normalizeWhitespace(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparisonText(value?: string | null): string | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\s+/g, "").toLowerCase();
}

function isSidoToken(token: string): boolean {
  return /(특별시|광역시|특별자치시|특별자치도|자치시|자치도|도|시)$/.test(token);
}

function isSigunguToken(token: string): boolean {
  return /(시|군|구)$/.test(token);
}

function isDongToken(token: string): boolean {
  return /(동|읍|면|가)$/.test(token);
}

function canonicalizeScopeLabel(
  value: string | null,
  scope: Exclude<LocationFilterScope, "radius">
): string | null {
  const normalized = normalizeComparisonText(value);
  if (!normalized) {
    return null;
  }

  if (scope === "sido") {
    return normalized.replace(
      /(특별자치시|특별자치도|특별시|광역시|자치시|자치도|시|도)$/,
      ""
    );
  }

  return normalized;
}

function extractLocationContext(value?: string | null): LocationContext {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return { sido: null, sigungu: null, dong: null };
  }

  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

  const sidoIndex = tokens.findIndex(isSidoToken);
  const sido = sidoIndex >= 0 ? tokens[sidoIndex] : null;

  const sigunguTokens: string[] = [];
  for (let index = sidoIndex >= 0 ? sidoIndex + 1 : 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isDongToken(token)) {
      break;
    }

    if (isSigunguToken(token)) {
      sigunguTokens.push(token);
      continue;
    }

    if (sigunguTokens.length > 0) {
      break;
    }
  }

  const sigungu =
    sigunguTokens.length > 0
      ? sigunguTokens.join(" ")
      : tokens.find((token) => isSigunguToken(token) && token !== sido) ?? null;

  const dong = tokens.find(isDongToken) ?? null;

  return { sido, sigungu, dong };
}

export function parseCoordinate(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getFilterCoordinates(
  input: Pick<LocationFilterInput, "latitude" | "longitude">
): Coordinate | null {
  const latitude = parseCoordinate(input.latitude);
  const longitude = parseCoordinate(input.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

export function calculateDistanceKm(from: Coordinate, to: Coordinate): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getDistanceKmBetween(
  item: Pick<Item, "latitude" | "longitude">,
  input: Pick<LocationFilterInput, "latitude" | "longitude">
): number | null {
  const itemCoordinates = getFilterCoordinates(item);
  const filterCoordinates = getFilterCoordinates(input);

  if (!itemCoordinates || !filterCoordinates) {
    return null;
  }

  return calculateDistanceKm(filterCoordinates, itemCoordinates);
}

export function matchesLocationFilter(
  item: Pick<Item, "location" | "latitude" | "longitude">,
  filter?: LocationFilterInput,
  precomputedDistanceKm?: number | null
): boolean {
  if (!filter?.useLocationFilter) {
    return true;
  }

  const scope = filter.locationScope ?? "radius";

  if (scope === "radius") {
    const distanceKm =
      precomputedDistanceKm ?? getDistanceKmBetween(item, filter);

    if (distanceKm === null) {
      return false;
    }

    return distanceKm <= (filter.radiusKm ?? DEFAULT_RADIUS_KM);
  }

  const requestedContext = extractLocationContext(filter.locationText);
  const itemContext = extractLocationContext(item.location);
  const requestedLabel = canonicalizeScopeLabel(requestedContext[scope], scope);
  const candidateLabel = canonicalizeScopeLabel(itemContext[scope], scope);

  if (!requestedLabel) {
    return false;
  }

  if (candidateLabel) {
    return candidateLabel === requestedLabel;
  }

  const normalizedItemLocation = normalizeComparisonText(item.location);
  return normalizedItemLocation?.includes(requestedLabel) ?? false;
}
