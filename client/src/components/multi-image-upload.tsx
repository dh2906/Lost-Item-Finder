import { useRef, useState } from "react";
import { Upload, X, Star, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { optimizeImageForUpload } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const MAX_IMAGES = 5;

interface MultiImageUploadProps {
  value: string[];          // base64 배열
  onChange: (images: string[]) => void;
  required?: boolean;
}

export function MultiImageUpload({ value, onChange, required }: MultiImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const { toast } = useToast();

  const addFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const remaining = MAX_IMAGES - value.length;
    if (remaining <= 0) {
      toast({ variant: "destructive", title: `최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.` });
      return;
    }
    const toProcess = arr.slice(0, remaining);
    try {
      const base64s = await Promise.all(toProcess.map((f) => optimizeImageForUpload(f)));
      onChange([...value, ...base64s]);
    } catch {
      toast({ variant: "destructive", title: "이미지 처리 중 오류가 발생했습니다." });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const removeImage = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const setRepresentative = (idx: number) => {
    if (idx === 0) return;
    const next = [...value];
    [next[0], next[idx]] = [next[idx], next[0]];
    onChange(next);
  };

  // 드래그 앤 드롭 순서 변경
  const handleDragStart = (idx: number) => setDraggingIdx(idx);
  const handleDragEnd = () => setDraggingIdx(null);
  const handleItemDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggingIdx === null || draggingIdx === idx) return;
    const next = [...value];
    const [moved] = next.splice(draggingIdx, 1);
    next.splice(idx, 0, moved);
    setDraggingIdx(idx);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <div
        className={cn(
          "relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30",
          value.length >= MAX_IMAGES && "pointer-events-none opacity-50"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          {value.length >= MAX_IMAGES ? `최대 ${MAX_IMAGES}장 업로드됨` : "클릭하거나 드래그하여 사진 추가"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          최대 {MAX_IMAGES}장 · 첫 번째 사진이 대표 이미지로 사용됩니다
        </p>
        {required && value.length === 0 && (
          <p className="mt-2 text-xs font-semibold text-destructive">* 사진은 필수입니다</p>
        )}
      </div>

      {/* Preview grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {value.map((src, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleItemDragOver(e, idx)}
              className={cn(
                "group relative aspect-square cursor-grab overflow-hidden rounded-lg border-2 bg-muted active:cursor-grabbing",
                idx === 0 ? "border-primary" : "border-transparent hover:border-border",
                draggingIdx === idx && "opacity-50"
              )}
            >
              <img src={src} alt={`이미지 ${idx + 1}`} className="h-full w-full object-cover" />

              {/* Representative badge */}
              {idx === 0 && (
                <div className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  대표
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {idx !== 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRepresentative(idx); }}
                    className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-foreground"
                  >
                    <Star className="h-3 w-3" /> 대표로
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <GripVertical className="absolute bottom-1 right-1 h-4 w-4 text-white/70 drop-shadow" />
            </div>
          ))}

          {/* Add more slot */}
          {value.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 text-muted-foreground hover:border-primary/50 hover:text-primary"
            >
              <Upload className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
