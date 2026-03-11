import { useEffect, useState } from "react";
import { Map, MapMarker, useKakaoLoader } from "react-kakao-maps-sdk";

interface LocationDisplayProps {
  latitude: string | null | undefined;
  longitude: string | null | undefined;
  height?: string;
}

export function LocationDisplay({ latitude, longitude, height = "250px" }: LocationDisplayProps) {
  const [loading, error] = useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_MAP_KEY || "",
    libraries: ["services"],
  });

  const [address, setAddress] = useState<string>("");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        setPosition({ lat, lng });
      }
    }
  }, [latitude, longitude]);

  // 좌표를 주소로 변환
  useEffect(() => {
    if (!position || !window.kakao?.maps?.services) return;
    
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2Address(position.lng, position.lat, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const addr = result[0].road_address?.address_name || result[0].address?.address_name;
        setAddress(addr || "");
      }
    });
  }, [position]);

  if (!latitude || !longitude) {
    return (
      <div 
        className="bg-secondary/30 rounded-xl flex items-center justify-center border border-border/50"
        style={{ height }}
      >
        <p className="text-muted-foreground text-sm">위치 정보 없음</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div 
        className="bg-secondary/30 rounded-xl flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground text-sm">지도 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="bg-secondary/30 rounded-xl flex items-center justify-center border border-border/50"
        style={{ height }}
      >
        <p className="text-muted-foreground text-sm">지도를 불러올 수 없습니다</p>
      </div>
    );
  }

  if (!position) {
    return (
      <div 
        className="bg-secondary/30 rounded-xl flex items-center justify-center border border-border/50"
        style={{ height }}
      >
        <p className="text-muted-foreground text-sm">잘못된 위치 정보</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden border border-border/50">
        <Map
          center={position}
          style={{ width: "100%", height }}
          level={4}
          draggable={false}
          zoomable={true}
        >
          <MapMarker position={position} />
        </Map>
      </div>
      {address && (
        <p className="text-sm text-muted-foreground">
          📍 {address}
        </p>
      )}
    </div>
  );
}