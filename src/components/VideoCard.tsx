import { memo } from "react";
import { type FileAsset } from "../services/fileKeyService";
import { LazyImage } from "./LazyImage";

interface VideoCardProps {
  video: FileAsset;
  mediaSrc: string | undefined;
  isActive: boolean;
  onHoverStart: (video: FileAsset) => void;
  onHoverEnd: (fileKey: string) => void;
  onPreviewClick: (video: FileAsset) => void;
  // 图片缓存相关
  isImageLoaded?: boolean;
  onImageLoad?: (url: string) => void;
}

export const VideoCard = memo(function VideoCard({
  video,
  mediaSrc,
  isActive,
  onHoverStart,
  onHoverEnd,
  onPreviewClick,
  isImageLoaded = false,
  onImageLoad,
}: VideoCardProps) {
  return (
    <article className="group p-1">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-sm bg-slate-200"
        onMouseEnter={() => onHoverStart(video)}
        onMouseLeave={() => onHoverEnd(video.file_key)}
      >
        {/* 封面图片 - 始终在 DOM 中 */}
        {video.cover_url ? (
          <div
            className={`absolute inset-0 ${
              isActive && mediaSrc ? "invisible" : "visible"
            }`}
          >
            <LazyImage
              src={video.cover_url}
              alt={`${video.file_key} 封面`}
              className="h-full w-full object-cover"
              externalIsLoaded={isImageLoaded}
              onLoad={() => onImageLoad?.(video.cover_url)}
            />
          </div>
        ) : (
          <div
            className={`absolute inset-0 flex items-center justify-center text-sm text-slate-500 ${
              isActive && mediaSrc ? "invisible" : "visible"
            }`}
          >
            暂无封面
          </div>
        )}

        {/* 视频 - 只在激活时显示 */}
        {isActive && mediaSrc && (
          <div className="absolute inset-0">
            <video
              src={mediaSrc}
              muted
              autoPlay
              loop
              controls
              playsInline
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-slate-950/10 via-transparent to-transparent" />
      </div>

      <div className="mt-1 space-y-[2px] text-sm text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-slate-900">{video.file_key}</p>
          <button
            type="button"
            onClick={() => onPreviewClick(video)}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 opacity-0 group-hover:opacity-100"
          >
            预览
          </button>
        </div>

        <p className="text-xs text-slate-500">
          {new Date(video.created_at).toLocaleString()}
        </p>
      </div>
    </article>
  );
});

