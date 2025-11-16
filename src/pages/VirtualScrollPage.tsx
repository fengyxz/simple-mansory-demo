import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useInfiniteFileKeys } from "../hooks/useInfiniteFileKeys";
import { useFileKeysCount } from "../hooks/useFileKeysCount";
import { VideoPreviewDialog } from "../components/VideoPreviewDialog";
import { type FileAsset, fetchFileKey } from "../services/fileKeyService";
import { VideoCard } from "../components/VideoCard";
import { useImageCache } from "../hooks/useImageCache";

// 配置：超过这个数量才启用虚拟化
const VIRTUALIZATION_THRESHOLD = 100;

export function VirtualScrollPage() {
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // 图片缓存 Hook
  const { markAsLoaded, isImageLoaded, preloadImages } = useImageCache();

  // 使用无限查询获取数据
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error: queryError,
  } = useInfiniteFileKeys();

  // 展平所有页面的数据
  const allVideos = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );

  const [mediaSources, setMediaSources] = useState<Record<string, string>>({});
  const [activeVideoKey, setActiveVideoKey] = useState<string | null>(null);
  const [modalFileKey, setModalFileKey] = useState<string | null>(null);
  const hoverTimersRef = useRef<Map<string, number>>(new Map());
  const PREVIEW_DELAY = 500;
  const PULL_THRESHOLD = 120;
  const MAX_PULL_DISTANCE = 180;

  // 虚拟化状态
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // 滚动触发状态
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{
    y: number;
    time: number;
    atBottom: boolean;
  } | null>(null);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down");
  const [scrollSpeed, setScrollSpeed] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const pullDistanceRef = useRef(0);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [columnCount, setColumnCount] = useState(1);
  const measureColsRafIdRef = useRef<number | null>(null);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const {
    data: totalCount,
    isLoading: isTotalCountLoading,
    error: totalCountError,
  } = useFileKeysCount();

  const totalCountDisplay = isTotalCountLoading
    ? "统计中..."
    : totalCountError
    ? "获取失败"
    : `${totalCount ?? 0}`;

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "加载失败，请稍后重试。"
    : null;

  // 是否为触摸设备（移动端），用于关闭虚拟化，减少抖动
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasTouch =
      "ontouchstart" in window ||
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! >
        0;
    setIsTouchDevice(Boolean(hasTouch));
  }, []);

  // 决定是否使用虚拟化：移动端关闭虚拟化，避免滚动抖动
  const shouldVirtualize =
    !isTouchDevice && allVideos.length > VIRTUALIZATION_THRESHOLD;

  // 计算当前实际列数（基于第一行元素的 offsetTop），并做节流
  const measureColumns = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const children = Array.from(grid.children) as HTMLElement[];
    if (children.length === 0) {
      setColumnCount(1);
      return;
    }

    const firstTop = children[0].offsetTop;
    let cols = 0;
    for (const el of children) {
      if (Math.abs(el.offsetTop - firstTop) < 1) {
        cols += 1;
      } else {
        break;
      }
    }

    if (cols <= 0) {
      cols = 1;
    }

    setColumnCount((prev) => (prev !== cols ? cols : prev));
  }, []);

  const scheduleMeasureColumns = useCallback(() => {
    if (typeof window === "undefined") return;
    if (measureColsRafIdRef.current != null) return;

    measureColsRafIdRef.current = window.requestAnimationFrame(() => {
      measureColsRafIdRef.current = null;
      measureColumns();
    });
  }, [measureColumns]);

  // 计算可见范围（简单的虚拟化）
  useEffect(() => {
    if (!shouldVirtualize) return;

    const container = scrollContainerRef.current;
    const grid = gridRef.current;
    if (!container || !grid) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      // 估算每个 item 的高度（包括 gap）
      const estimatedItemHeight = 250;

      // 计算可见范围（加上 overscan）
      const overscan = 20;
      const startIndex = Math.max(
        0,
        Math.floor(scrollTop / estimatedItemHeight) - overscan
      );
      const endIndex = Math.min(
        allVideos.length,
        Math.ceil((scrollTop + containerHeight) / estimatedItemHeight) +
          overscan
      );

      setVisibleRange({ start: startIndex, end: endIndex });
    };

    handleScroll(); // 初始计算
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [shouldVirtualize, allVideos.length]);

  // 检测滚动方向
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let lastScrollTop = container.scrollTop;
    let lastTimestamp = performance.now();

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const now = performance.now();
      const deltaY = currentScrollTop - lastScrollTop;
      const deltaTime = now - lastTimestamp;

      const direction = deltaY > 0 ? "down" : "up";
      setScrollDirection(direction);

      if (deltaTime > 0) {
        const speed = Math.abs(deltaY) / (deltaTime / 1000);
        setScrollSpeed(speed);
        if (import.meta.env.DEV) {
          console.log(
            `📏 滚动速度: ${speed.toFixed(
              2
            )} px/s (方向: ${direction}, Δy=${deltaY.toFixed(
              2
            )} px, Δt=${deltaTime.toFixed(2)} ms)`
          );
        }
      }

      lastScrollTop = currentScrollTop;
      lastTimestamp = now;
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // 监听触摸手势，计算手势速度并在底部强力滑动时加载
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      const distanceToBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const atBottom = distanceToBottom < 2;
      touchStartRef.current = {
        y: touch.clientY,
        time: performance.now(),
        atBottom,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = event.touches[0];
      const deltaY = touchStartRef.current.y - touch.clientY;

      const distanceToBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const atBottomNow = distanceToBottom < 2;
      const canPull =
        (touchStartRef.current.atBottom || atBottomNow) && deltaY > 0;

      if (canPull) {
        const pull = Math.min(MAX_PULL_DISTANCE, deltaY);
        setPullDistance(pull);
        if (event.cancelable) {
          event.preventDefault();
        }
      } else {
        setPullDistance((prev) => (prev !== 0 ? 0 : prev));
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = event.changedTouches[0];
      const endY = touch.clientY;
      const endTime = performance.now();
      const deltaY = touchStartRef.current.y - endY; // 手指向上滑动为正值
      const deltaTime = endTime - touchStartRef.current.time;

      if (deltaTime <= 0) {
        touchStartRef.current = null;
        return;
      }

      const speed = Math.abs(deltaY) / (deltaTime / 1000); // px/s
      setScrollSpeed(speed);
      if (import.meta.env.DEV) {
        console.log(
          `👆 手势速度: ${speed.toFixed(2)} px/s (Δy=${deltaY.toFixed(
            2
          )} px, Δt=${deltaTime.toFixed(2)} ms)`
        );
      }

      const distanceToBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const isSwipeUp = deltaY > 0; // 向上滑动意味着内容向下滚动
      const atBottom = distanceToBottom < 10;
      const SPEED_THRESHOLD = 1200;

      const currentPullDistance = pullDistanceRef.current;
      const shouldTriggerPull =
        currentPullDistance >= PULL_THRESHOLD &&
        hasNextPage &&
        !isFetchingNextPage;

      if (shouldTriggerPull) {
        if (import.meta.env.DEV) {
          console.log(
            `🪝 上拉高度 ${currentPullDistance.toFixed(0)}px，松手加载下一页`
          );
        }
        fetchNextPage();
      } else if (
        atBottom &&
        isSwipeUp &&
        speed > SPEED_THRESHOLD &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        if (import.meta.env.DEV) {
          console.log(
            `⚡️ 手势速度 ${speed.toFixed(
              0
            )} px/s，判定为强力滑到底，触发加载下一页`
          );
        }
        fetchNextPage();
      }

      setPullDistance(0);
      touchStartRef.current = null;
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);
    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // 使用 IntersectionObserver 监听底部哨兵
  useEffect(() => {
    const container = scrollContainerRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!container || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 只有向下滚动且哨兵进入视口时才处理
        if (!entry.isIntersecting || scrollDirection !== "down") return;
        if (!hasNextPage || isFetchingNextPage) return;

        fetchNextPage();
      },
      {
        root: container,
        threshold: 0.01,
        rootMargin: "0px",
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [scrollDirection, hasNextPage, isFetchingNextPage, fetchNextPage]);

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

      if (mediaSources[key]) {
        return mediaSources[key];
      }

      const latest = await queryClient.fetchQuery({
        queryKey: ["fileKey", key],
        queryFn: () => fetchFileKey(key),
        staleTime: 5 * 60 * 1000,
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
      if (mediaSources[fileKey]) {
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
          if (source) {
            setActiveVideoKey(fileKey);
          }
        })().finally(() => {
          hoverTimersRef.current.delete(fileKey);
        });
      }, PREVIEW_DELAY);
      hoverTimersRef.current.set(fileKey, timerId);
    },
    [PREVIEW_DELAY, ensureMediaSource, mediaSources]
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
      if (!mediaSources[video.file_key]) {
        await ensureMediaSource(video);
      }
    },
    [ensureMediaSource, mediaSources]
  );

  // 渲染的视频列表（根据是否虚拟化决定）
  const visibleVideos = shouldVirtualize
    ? allVideos.slice(visibleRange.start, visibleRange.end)
    : allVideos;

  // 基于当前列数，将可见视频按“整行”裁剪，避免最后一行只出现少量元素
  const rowAlignedVideos = useMemo(() => {
    const cols = Math.max(columnCount, 1);
    const total = visibleVideos.length;
    if (total === 0) return visibleVideos;

    const fullRowsCount = Math.floor(total / cols);
    const visibleCount = fullRowsCount * cols;

    // 如果不足一整行，直接保持现状（比如数据很少的场景）
    if (visibleCount === 0) {
      return visibleVideos;
    }

    return visibleVideos.slice(0, visibleCount);
  }, [visibleVideos, columnCount]);

  // 监听重排 / 数据变化 / 窗口尺寸变化，节流计算列数
  useEffect(() => {
    // 初始以及每次可见数据或总数据变更时尝试测量
    scheduleMeasureColumns();
  }, [
    scheduleMeasureColumns,
    allVideos.length,
    visibleRange.start,
    visibleRange.end,
  ]);

  useEffect(() => {
    const handleResize = () => {
      scheduleMeasureColumns();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (measureColsRafIdRef.current != null) {
        cancelAnimationFrame(measureColsRafIdRef.current);
        measureColsRafIdRef.current = null;
      }
    };
  }, [scheduleMeasureColumns]);

  const statsItems = useMemo(
    () => [
      {
        label: "数据总数",
        value:
          totalCountDisplay === "统计中..." || totalCountDisplay === "获取失败"
            ? totalCountDisplay
            : `${totalCountDisplay} 个`,
      },
      { label: "当前已加载", value: `${allVideos.length} 个` },
      {
        label: "当前渲染",
        value: shouldVirtualize
          ? `${visibleVideos.length} 个`
          : allVideos.length === 0
          ? "暂无数据"
          : "全部渲染",
      },
      {
        label: "滚动速度",
        value: `${scrollSpeed.toFixed(0)} px/s`,
      },
      {
        label: "上拉距离",
        value: `${pullDistance.toFixed(0)} px`,
      },
      {
        label: "下一页状态",
        value: hasNextPage
          ? isFetchingNextPage
            ? "加载中..."
            : "尚有更多"
          : "已全部加载",
      },
      {
        label: "当前列数",
        value: `${columnCount} 列`,
      },
    ],
    [
      allVideos.length,
      hasNextPage,
      isFetchingNextPage,
      pullDistance,
      scrollSpeed,
      shouldVirtualize,
      totalCountDisplay,
      visibleVideos.length,
      columnCount,
    ]
  );

  // 预加载即将进入视口的图片
  useEffect(() => {
    if (!shouldVirtualize) return;

    const preloadRange = {
      start: Math.max(0, visibleRange.start - 10),
      end: Math.min(allVideos.length, visibleRange.end + 10),
    };

    const urlsToPreload = allVideos
      .slice(preloadRange.start, preloadRange.end)
      .filter((v) => v.cover_url)
      .map((v) => v.cover_url!);

    preloadImages(urlsToPreload);
  }, [shouldVirtualize, visibleRange, allVideos, preloadImages]);

  return (
    <main className="min-h-[calc(100vh-80px)] bg-white">
      <div className="fixed right-4 top-24 z-40 w-80 max-w-[90vw]">
        {isStatsOpen ? (
          <div className="max-h-[calc(100vh-112px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                实验看板
              </p>
              <button
                type="button"
                onClick={() => setIsStatsOpen(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                收起
              </button>
            </div>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              {statsItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3"
                >
                  <dt className="text-slate-500">{item.label}</dt>
                  <dd className="font-medium text-slate-900 text-right">
                    <span className="line-clamp-2">{item.value}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsStatsOpen(true)}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
            >
              展开实验看板
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollContainerRef}
        className="h-[calc(100vh-80px)] overflow-y-auto px-4 py-4 md:py-10"
      >
        <div className="mx-auto px-4 md:px-24 space-y-4 md:space-y-6">
          <header className="flex flex-col gap-2 md:gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-slate-900">
                视频无限滚动列表
              </h1>

              {import.meta.env.DEV && (
                <p className="text-xs md:text-sm text-slate-400">
                  当前滚动速度：{scrollSpeed.toFixed(2)} px/s
                </p>
              )}
            </div>
          </header>

          {isLoading ? (
            <p className="text-center text-slate-500" role="status">
              加载中...
            </p>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
              {error}
            </div>
          ) : allVideos.length === 0 ? (
            <p className="text-center text-slate-500">
              暂无数据，请先在首页创建 fileKey 映射。
            </p>
          ) : (
            <div
              ref={gridRef}
              className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2"
            >
              {rowAlignedVideos.map((video) => (
                <VideoCard
                  key={video.file_key}
                  video={video}
                  mediaSrc={mediaSources[video.file_key]}
                  isActive={activeVideoKey === video.file_key}
                  onHoverStart={handleHoverStart}
                  onHoverEnd={handleHoverEnd}
                  onPreviewClick={handlePreviewClick}
                  isImageLoaded={
                    video.cover_url ? isImageLoaded(video.cover_url) : false
                  }
                  onImageLoad={markAsLoaded}
                />
              ))}

              {/* 加载下一页时：按当前列数渲染一整行骨架屏，保证“整行出现” */}
              {isFetchingNextPage &&
                Array.from({ length: Math.max(columnCount, 1) }).map(
                  (_item, index) => (
                    <div
                      key={`skeleton-${index}`}
                      className="h-[220px] rounded-xl bg-slate-100 animate-pulse"
                    />
                  )
                )}
            </div>
          )}

          {/* 自定义上拉布局指示 */}
          <div
            className="overflow-hidden"
            style={{
              height: pullDistance,
            }}
          >
            <div className="flex h-full items-center justify-center">
              <div
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  pullDistance >= PULL_THRESHOLD
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {pullDistance >= PULL_THRESHOLD
                  ? "释放即可加载更多"
                  : "上拉以加载更多"}
              </div>
            </div>
          </div>

          {/* 底部哨兵（用于 IntersectionObserver） */}
          <div ref={bottomSentinelRef} style={{ height: 1 }} />

          {/* 加载状态提示 */}
          {allVideos.length > 0 && (
            <div className="mt-8 flex justify-center">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                  <span>正在加载...</span>
                </div>
              ) : hasNextPage ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                  <span>向下滚动加载更多（每次 5 条）</span>
                </div>
              ) : (
                <div className="text-sm text-slate-400">
                  已加载全部 {allVideos.length} 个视频
                </div>
              )}
            </div>
          )}
        </div>

        <VideoPreviewDialog
          fileKey={modalFileKey}
          open={Boolean(modalFileKey)}
          fallbackMeta={
            modalFileKey
              ? allVideos.find((video) => video.file_key === modalFileKey) ??
                null
              : null
          }
          onOpenChange={(open) => {
            if (!open) {
              setModalFileKey(null);
            }
          }}
        />
      </div>
    </main>
  );
}
