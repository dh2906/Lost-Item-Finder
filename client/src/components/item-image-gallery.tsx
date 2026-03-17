import { useState } from "react";
import { ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemImageGalleryProps {
  images?: string[] | null;
  imageUrl?: string | null;
  alt: string;
  className?: string;
}

export function ItemImageGallery({ images, imageUrl, alt, className }: ItemImageGalleryProps) {
  const allImages = [
    ...(images && images.length > 0 ? images : []),
    ...(imageUrl && !(images && images.includes(imageUrl)) ? [imageUrl] : []),
  ].filter(Boolean);

  const [current, setCurrent] = useState(0);

  if (allImages.length === 0) {
    return (
      <div className={cn("flex aspect-[4/3] items-center justify-center bg-muted", className)}>
        <Tag className="h-12 w-12 text-muted-foreground/30" />
      </div>
    );
  }

  if (allImages.length === 1) {
    return (
      <img
        src={allImages[0]}
        alt={alt}
        className={cn("w-full object-cover", className)}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Main image */}
      <img
        src={allImages[current]}
        alt={`${alt} ${current + 1}`}
        className="w-full object-cover aspect-[4/3]"
      />

      {/* Counter */}
      <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
        {current + 1} / {allImages.length}
      </div>

      {/* Prev / Next */}
      <button
        type="button"
        onClick={() => setCurrent((c) => (c - 1 + allImages.length) % allImages.length)}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/60"
        aria-label="이전 이미지"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => setCurrent((c) => (c + 1) % allImages.length)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/60"
        aria-label="다음 이미지"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Thumbnails */}
      <div className="absolute bottom-0 left-0 right-0 flex gap-1.5 bg-gradient-to-t from-black/50 to-transparent p-3 pt-6">
        {allImages.map((src, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrent(idx)}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all",
              idx === current ? "bg-white" : "bg-white/40 hover:bg-white/70"
            )}
            aria-label={`이미지 ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
