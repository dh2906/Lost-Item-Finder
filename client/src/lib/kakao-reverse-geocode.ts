const reverseGeocodeCache = new Map<string, string | undefined>();
const pendingReverseGeocodes = new Map<string, Promise<string | undefined>>();

function getCoordinateKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export function getReverseGeocodeCacheKey(lat: number, lng: number): string {
  return getCoordinateKey(lat, lng);
}

export function reverseGeocodeKakao(
  lat: number,
  lng: number,
): Promise<string | undefined> {
  if (!window.kakao?.maps?.services) {
    return Promise.resolve(undefined);
  }

  const key = getCoordinateKey(lat, lng);
  if (reverseGeocodeCache.has(key)) {
    return Promise.resolve(reverseGeocodeCache.get(key));
  }

  const pending = pendingReverseGeocodes.get(key);
  if (pending) {
    return pending;
  }

  const request = new Promise<string | undefined>((resolve) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      const address =
        status === window.kakao.maps.services.Status.OK && result?.[0]
          ? result[0].road_address?.address_name || result[0].address?.address_name
          : undefined;

      reverseGeocodeCache.set(key, address);
      pendingReverseGeocodes.delete(key);
      resolve(address);
    });
  });

  pendingReverseGeocodes.set(key, request);
  return request;
}
