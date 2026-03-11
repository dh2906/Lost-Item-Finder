import { useState, useEffect, useCallback, useRef } from "react";
import { Map, MapMarker, useKakaoLoader } from "react-kakao-maps-sdk";
import { Locate } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationPickerProps {
  value?: { latitude: string; longitude: string };
  onChange: (location: { latitude: string; longitude: string; address?: string }) => void;
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

  // 디버깅 로그
  useEffect(() => {
    console.log("[LocationPicker] 상태:", {
      loading,
      error,
      appkey: import.meta.env.VITE_KAKAO_MAP_KEY ? `설정됨 (${import.meta.env.VITE_KAKAO_MAP_KEY.slice(0, 8)}...)` : "없음"
    });
    if (error) {
      console.error("[LocationPicker] Kakao Maps 로드 에러:", error);
    }
  }, [loading, error]);
  const [position, setPosition] = useState<MarkerPosition | null>(null);
  const [address, setAddress] = useState<string>("");
  const [isLocating, setIsLocating] = useState(true);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const mapRef = useRef<kakao.maps.Map | null>(null);

  // 초기 위치 설정 (GPS 또는 기본값)
  useEffect(() => {
    if (value?.latitude && value?.longitude) {
      setPosition({
        lat: parseFloat(value.latitude),
        lng: parseFloat(value.longitude),
      });
      setIsLocating(false);
      return;
    }

    // GPS로 현재 위치 가져오기
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setIsLocating(false);
        },
        () => {
          // GPS 실패 시 기본 위치 (서울 시청)
          setPosition({
            lat: 37.5665,
            lng: 126.978,
          });
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setPosition({ lat: 37.5665, lng: 126.978 });
      setIsLocating(false);
    }
  }, [value]);

  // 좌표를 주소로 변환
  const getAddressFromCoords = useCallback((lat: number, lng: number) => {
    if (!window.kakao?.maps?.services) return;
    
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const addr = result[0].road_address?.address_name || result[0].address?.address_name;
        setAddress(addr || "");
      }
    });
  }, []);

  // 마커 이동 시
  const handlePositionChange = (marker: any) => {
    const pos = marker.getPosition();
    const newPosition = { lat: pos.getLat(), lng: pos.getLng() };
    setPosition(newPosition);
    getAddressFromCoords(newPosition.lat, newPosition.lng);
    onChange({
      latitude: newPosition.lat.toFixed(6),
      longitude: newPosition.lng.toFixed(6),
      address: address,
    });
  };

  // 지도 클릭 시
  const handleMapClick = (_: any, mouseEvent: any) => {
    const latlng = mouseEvent.latLng;
    const newPosition = { lat: latlng.getLat(), lng: latlng.getLng() };
    setPosition(newPosition);
    getAddressFromCoords(newPosition.lat, newPosition.lng);
  };

  // 마커 드래그 종료 시
  const handleDragEnd = (marker: any) => {
    handlePositionChange(marker);
  };

  // 현재 위치로 이동
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
        onChange({
          latitude: newPosition.lat.toFixed(6),
          longitude: newPosition.lng.toFixed(6),
        });
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

  if (loading || isLocating) {
    return (
      <div 
        className="bg-secondary/30 rounded-xl flex items-center justify-center"
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
        className="bg-destructive/10 rounded-xl flex items-center justify-center border border-destructive/20"
        style={{ height }}
      >
        <div className="text-center p-4">
          <p className="text-destructive mb-2">지도를 불러올 수 없습니다</p>
          <p className="text-sm text-muted-foreground mb-2">
            에러: {String(error)}
          </p>
          <p className="text-sm text-muted-foreground">
            VITE_KAKAO_MAP_KEY: {import.meta.env.VITE_KAKAO_MAP_KEY ? "설정됨" : "없음"}
          </p>
        </div>
      </div>
    );
  }

  if (!position) {
    return (
      <div 
        className="bg-secondary/30 rounded-xl flex items-center justify-center"
        style={{ height }}
      >
        <p className="text-muted-foreground">위치 정보 없음</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden border border-border/50 relative">
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
        {/* 현재 위치 버튼 */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-4 left-4 z-10 rounded-full shadow-lg bg-white/90 hover:bg-white"
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
        <p className="text-sm text-muted-foreground">
          📍 {address}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        지도를 클릭하거나 마커를 드래그하여 위치를 변경하세요
      </p>
    </div>
  );
}