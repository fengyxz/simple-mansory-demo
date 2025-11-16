import { type FileAsset } from "../services/fileKeyService";
import { useFileKey } from "../hooks/useFileKey";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type VideoPreviewDialogProps = {
  fileKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fallbackMeta?: Pick<FileAsset, "created_at"> | null;
};

function VideoPreviewContent({
  fileKey,
  fallbackMeta,
}: {
  fileKey: string;
  fallbackMeta?: Pick<FileAsset, "created_at"> | null;
}) {
  // 使用 React Query hook，自动处理缓存和重复请求
  const { data, isLoading, error } = useFileKey(fileKey);

  if (error) {
    console.error("Failed to fetch media URL:", error);
  }

  const fetchedMediaSrc = data?.media_url ?? null;

  const createdAt = fallbackMeta?.created_at
    ? new Date(fallbackMeta.created_at).toLocaleString()
    : null;

  return (
    <>
      <DialogHeader className="px-6 pt-6">
        <DialogTitle>{fileKey}</DialogTitle>
        <DialogDescription className="break-all">
          {fetchedMediaSrc ?? "媒体地址加载中..."}
        </DialogDescription>
      </DialogHeader>
      <div className="px-6 pb-6">
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          {fetchedMediaSrc && !isLoading ? (
            <video
              key={fetchedMediaSrc}
              src={fetchedMediaSrc}
              controls
              autoPlay
              playsInline
              className="h-full w-full object-contain bg-black"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-200">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-white" />
            </div>
          )}
        </div>
        {createdAt && (
          <p className="mt-3 text-xs text-slate-500">{createdAt}</p>
        )}
      </div>
    </>
  );
}

export function VideoPreviewDialog({
  fileKey,
  open,
  onOpenChange,
  fallbackMeta,
}: VideoPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        {fileKey && (
          <VideoPreviewContent
            key={fileKey}
            fileKey={fileKey}
            fallbackMeta={fallbackMeta}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
