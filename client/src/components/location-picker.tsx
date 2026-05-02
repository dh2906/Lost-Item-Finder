import { useState, useEffect, useCallback, useRef } from "react";
import { Map, MapMarker, useKakaoLoader } from "react-kakao-maps-sdk";
import { Locate, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LocationPickerProps {
  value?: { latitude: string; longitude: string };
  onChange: (location: {
    latitude: string;
    longitude: string;
    address?: string;
    placeName?: string;
  }) => void;
  height?: string;
}

interface MarkerPosition {
  lat: number;
  lng: number;
}

export function LocationPicker({ value, onChange, height = "300px" }: LocationPickerProps) {
  const [loading, error] = useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_MAP_KEY || "",
    libraries: ["services", "clusterer", "drawing"],
  });

  useEffect(() => {
    if (error) {
      console.error("[LocationPicker] Kakao Maps 로드 에러:", error);
    }
  }, [loading, error]);
  const [position, setPosition] = useState<MarkerPosition | null>(null);
  const [address, setAddress] = useState<string>("");
  const [placeKeyword, setPlaceKeyword] = useState("");
  const [placeSearchMessage, setPlaceSearchMessage] = useState("");
  const [isLocating, setIsLocating] = useState(true);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const mapRef = useRef<kakao.maps.Map | null>(null);

  const syncCoordinates = useCallback(
    (nextPosition: MarkerPosition, nextAddress?: string, nextPlaceName?: string) => {
      onChange({
        latitude: nextPosition.lat.toFixed(6),
        longitude: nextPosition.lng.toFixed(6),
        address: nextAddress,
        placeName: nextPlaceName ?? nextAddress,
      });
    },
    [onChange],
  );

  const getAddressFromCoords = useCallback((lat: number, lng: number) => {
    const nextPosition = { lat, lng };
    if (!window.kakao?.maps?.services) {
      syncCoordinates(nextPosition);
      return;
    }

    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const addr = result[0].road_address?.address_name || result[0].address?.address_name;
        setAddress(addr || "");
        syncCoordinates(nextPosition, addr || undefined);
        return;
      }
      syncCoordinates(nextPosition);
    });
  }, [syncCoordinates]);

  // 초기 위치 설정 (GPS 또는 기본값)
  useEffect(() => {
    if (value?.latitude && value?.longitude) {
      const nextPosition = {
        lat: parseFloat(value.latitude),
        lng: parseFloat(value.longitude),
      };
      setPosition(nextPosition);
      getAddressFromCoords(nextPosition.lat, nextPosition.lng);
      setIsLocating(false);
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nextPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setPosition(nextPosition);
          getAddressFromCoords(nextPosition.lat, nextPosition.lng);
          setIsLocating(false);
        },
        () => {
          const nextPosition = {
            lat: 37.5665,
            lng: 126.978,
          };
          setPosition(nextPosition);
          getAddressFromCoords(nextPosition.lat, nextPosition.lng);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      const nextPosition = { lat: 37.5665, lng: 126.978 };
      setPosition(nextPosition);
      getAddressFromCoords(nextPosition.lat, nextPosition.lng);
      setIsLocating(false);
    }
  }, [getAddressFromCoords, syncCoordinates, value]);

  const handlePositionChange = (marker: any) => {
    const pos = marker.getPosition();
    const newPosition = { lat: pos.getLat(), lng: pos.getLng() };
    setPosition(newPosition);
    getAddressFromCoords(newPosition.lat, newPosition.lng);
  };

  const handleMapClick = (_: any, mouseEvent: any) => {
    const latlng = mouseEvent.latLng;
    const newPosition = { lat: latlng.getLat(), lng: latlng.getLng() };
    setPosition(newPosition);
    getAddressFromCoords(newPosition.lat, newPosition.lng);
  };

  const handleDragEnd = (marker: any) => {
    handlePositionChange(marker);
  };

  const goToCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 서비스를 지원하지 않습니다.");
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPosition(newPosition);
        getAddressFromCoords(newPosition.lat, newPosition.lng);
        setIsGettingLocation(false);
      },
      (err) => {
        console.error("위치 가져오기 실패:", err);
        alert("현재 위치를 가져올 수 없습니다. 위치 권한을 확인해주세요.");
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePlaceSearch = () => {
    const keyword = placeKeyword.trim();
    if (!keyword) {
      setPlaceSearchMessage("찾을 장소명을 입력해 주세요.");
      return;
    }

    if (!window.kakao?.maps?.services) {
      setPlaceSearchMessage("장소 검색을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setIsSearchingPlace(true);
    setPlaceSearchMessage("");

    const places = new window.kakao.maps.services.Places();
    places.keywordSearch(keyword, (results: any[], status: any) => {
      setIsSearchingPlace(false);

      if (status !== window.kakao.maps.services.Status.OK || !results?.[0]) {
        setPlaceSearchMessage("검색 결과가 없어요. 주소나 지명을 조금 더 자세히 입력해 주세요.");
        return;
      }

      const firstResult = results[0];
      const nextPosition = {
        lat: Number(firstResult.y),
        lng: Number(firstResult.x),
      };
      const nextAddress =
        firstResult.road_address_name || firstResult.address_name || keyword;
      const nextPlaceName = firstResult.place_name || keyword;

      setPosition(nextPosition);
      setAddress(
        nextAddress && nextPlaceName && !nextAddress.includes(nextPlaceName)
          ? `${nextAddress} - ${nextPlaceName}`
          : nextAddress || nextPlaceName
      );
      syncCoordinates(nextPosition, nextAddress, nextPlaceName);
      mapRef.current?.panTo(new window.kakao.maps.LatLng(nextPosition.lat, nextPosition.lng));
      setPlaceSearchMessage(`${nextPlaceName} 위치를 적용했어요.`);
    });
  };

  if (loading || isLocating) {
    return (
        <div 
          className="flex items-center justify-center rounded-[var(--radius)] bg-secondary/50"
          style={{ height }}
        >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground text-sm">
            {isLocating ? "현재 위치 찾는 중..." : "지도 로딩 중..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    console.error("[LocationPicker] 렌더링 에러:", error);
    return (
        <div 
          className="flex items-center justify-center rounded-[var(--radius)] border border-border/70 bg-secondary/40"
          style={{ height }}
        >
        <div className="max-w-sm px-5 text-center">
          <p className="font-semibold text-foreground">지도를 불러오지 못했어요</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            장소명은 아래 입력칸에 직접 적어도 등록할 수 있어요. 잠시 후 다시 시도하거나 주소를 자세히 남겨 주세요.
          </p>
        </div>
      </div>
    );
  }

  if (!position) {
    return (
        <div 
          className="flex items-center justify-center rounded-[var(--radius)] bg-secondary/50"
          style={{ height }}
        >
        <p className="text-muted-foreground">위치 정보 없음</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[18px] border border-border/70 bg-white p-3 shadow-sm">
        <label htmlFor="place-search" className="text-sm font-semibold text-foreground">
          장소명으로 위치 찾기
        </label>
        <div className="mt-2 flex gap-2">
          <Input
            id="place-search"
            value={placeKeyword}
            onChange={(event) => setPlaceKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handlePlaceSearch();
              }
            }}
            placeholder="예: CGV 평택고덕, 천안역"
            className="h-11 rounded-lg"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 rounded-lg px-4"
            onClick={handlePlaceSearch}
            disabled={isSearchingPlace}
          >
            <Search className="mr-2 h-4 w-4" />
            찾기
          </Button>
        </div>
        {placeSearchMessage ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {placeSearchMessage}
          </p>
        ) : null}
      </div>
      <div className="relative overflow-hidden rounded-[var(--radius)] border border-primary/15 bg-white/88 shadow-[0_18px_32px_-24px_hsl(var(--primary)/0.18)]">
        <Map
          center={position}
          isPanto={true}
          style={{ width: "100%", height }}
          level={4}
          onClick={handleMapClick}
          onCreate={(map) => {
            mapRef.current = map;
          }}
        >
          <MapMarker
            position={position}
            draggable
            onDragEnd={handleDragEnd}
          />
        </Map>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute left-4 top-4 z-10 rounded-full border border-primary/10 !bg-white text-foreground shadow-card hover:!bg-white"
          onClick={(e) => {
            e.stopPropagation();
            goToCurrentLocation();
          }}
          title="현재 위치로 이동"
        >
          <Locate className={`w-5 h-5 ${isGettingLocation ? "animate-pulse" : ""}`} />
        </Button>
      </div>
      {address && (
        <div className="flex items-center gap-2 rounded-[16px] border border-primary/10 bg-[hsl(var(--primary-light))] px-3 py-2 text-sm text-foreground/85">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">선택한 위치: {address}</span>
        </div>
      )}
      <p className="rounded-[14px] border border-border/60 bg-white/72 px-3 py-2 text-sm font-medium leading-6 text-foreground/78">
        지도를 클릭하거나 마커를 움직여 위치를 조정하세요.
      </p>
    </div>
  );
}
