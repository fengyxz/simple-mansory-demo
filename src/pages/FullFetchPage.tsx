import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type FileAsset, fetchFileKey } from "../services/fileKeyService";
import { useAllFileKeys } from "../hooks/useAllFileKeys";
import { VideoPreviewDialog } from "../components/VideoPreviewDialog";

export function FullFetchPage() {
  const queryClient = useQueryClient();

  // 使用 React Query 获取所有视频数据
  const {
    data: videos = [],
    isLoading,
    error: queryError,
    refetch,
  } = useAllFileKeys();

  const [readyPreviewKeys, setReadyPreviewKeys] = useState<
    Record<string, boolean>
  >({});
  const [mediaSources, setMediaSources] = useState<Record<string, string>>({});
  const [activeVideoKey, setActiveVideoKey] = useState<string | null>(null);
  const [modalFileKey, setModalFileKey] = useState<string | null>(null);
  const hoverTimersRef = useRef<Map<string, number>>(new Map());
  const PREVIEW_DELAY = 500;

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "加载失败，请稍后重试。"
    : null;

  useEffect(() => {
    const timers = hoverTimersRef.current;
    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  const ensureMediaSource = useCallback(
    async (video: FileAsset) => {
      const key = video.file_key;

      // 先检查本地缓存
      if (mediaSources[key]) {
        return mediaSources[key];
      }

      // 使用 queryClient.fetchQuery 来获取数据，会自动使用缓存
      // 如果缓存中有且未过期，直接返回缓存；否则发起请求并缓存
      const latest = await queryClient.fetchQuery({
        queryKey: ["fileKey", key],
        queryFn: () => fetchFileKey(key),
        staleTime: 5 * 60 * 1000, // 5分钟缓存
      });

      const source = latest?.media_url ?? video.media_url ?? null;
      if (source) {
        setMediaSources((prev) => {
          if (prev[key] === source) {
            return prev;
          }
          return { ...prev, [key]: source };
        });
        return source;
      }
      return null;
    },
    [mediaSources, queryClient]
  );

  const handleHoverStart = useCallback(
    (video: FileAsset) => {
      const { file_key: fileKey } = video;
      if (readyPreviewKeys[fileKey] && mediaSources[fileKey]) {
        setActiveVideoKey(fileKey);
        return;
      }
      const existingTimer = hoverTimersRef.current.get(fileKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timerId = window.setTimeout(() => {
        (async () => {
          const source = await ensureMediaSource(video);
          if (!source) {
            return;
          }
          setReadyPreviewKeys((prev) => ({ ...prev, [fileKey]: true }));
          setActiveVideoKey(fileKey);
        })().finally(() => {
          hoverTimersRef.current.delete(fileKey);
        });
      }, PREVIEW_DELAY);
      hoverTimersRef.current.set(fileKey, timerId);
    },
    [PREVIEW_DELAY, ensureMediaSource, mediaSources, readyPreviewKeys]
  );

  const handleHoverEnd = useCallback((fileKey: string) => {
    const existingTimer = hoverTimersRef.current.get(fileKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      hoverTimersRef.current.delete(fileKey);
    }
    setActiveVideoKey((current) => (current === fileKey ? null : current));
  }, []);

  const handlePreviewClick = useCallback(
    async (video: FileAsset) => {
      setModalFileKey(video.file_key);
      // 预加载视频源（如果还没有的话）
      if (!mediaSources[video.file_key]) {
        const source = await ensureMediaSource(video);
        if (source) {
          setReadyPreviewKeys((prev) => ({ ...prev, [video.file_key]: true }));
        }
      }
    },
    [ensureMediaSource, mediaSources]
  );

  const layout = useMemo(() => {
    if (isLoading) {
      return (
        <p className="text-center text-slate-500" role="status">
          全量加载中...
        </p>
      );
    }

    if (error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      );
    }

    if (videos.length === 0) {
      return (
        <p className="text-center text-slate-500">
          暂无数据，请先在首页创建 fileKey 映射。
        </p>
      );
    }

    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2">
        {videos.map((video) => {
          const mediaSrc = mediaSources[video.file_key];
          const isReady = Boolean(mediaSrc);
          const isActive = isReady && activeVideoKey === video.file_key;

          return (
            <article key={video.file_key} className="group p-1">
              <div
                className="relative aspect-video w-full overflow-hidden rounded-sm bg-slate-200"
                onMouseEnter={() => handleHoverStart(video)}
                onMouseLeave={() => handleHoverEnd(video.file_key)}
              >
                {isActive && mediaSrc ? (
                  <video
                    src={mediaSrc}
                    muted
                    autoPlay
                    loop
                    controls
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : video.cover_url ? (
                  <img
                    src={video.cover_url}
                    alt={`${video.file_key} 封面`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                    暂无封面
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-slate-950/10 via-transparent to-transparent" />
              </div>
              <div className="mt-1 space-y-[2px] text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">
                    {video.file_key}
                  </p>
                  <button
                    type="button"
                    onClick={() => handlePreviewClick(video)}
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
        })}
      </div>
    );
  }, [
    activeVideoKey,
    error,
    handleHoverEnd,
    handleHoverStart,
    handlePreviewClick,
    isLoading,
    mediaSources,
    videos,
  ]);

  return (
    <main className="min-h-[calc(100vh-80px)] bg-white px-4 py-10">
      <div className="mx-auto px-24 space-y-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              全量 FileKey 视频瀑布流
            </h1>
            <p className="mt-1 text-base text-slate-600">
              通过 full-fetch 路由一次性获取全部视频地址，直接展示可预览的 mp4
              播放内容。采用 CSS Grid 实现瀑布流布局。
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            disabled={isLoading}
          >
            {isLoading ? "刷新中..." : "手动刷新"}
          </button>
        </header>

        {layout}
      </div>

      <VideoPreviewDialog
        fileKey={modalFileKey}
        open={Boolean(modalFileKey)}
        fallbackMeta={
          modalFileKey
            ? videos.find((video) => video.file_key === modalFileKey) ?? null
            : null
        }
        onOpenChange={(open) => {
          if (!open) {
            setModalFileKey(null);
          }
        }}
      />
    </main>
  );
}
