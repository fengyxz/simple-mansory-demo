import { useCallback, useRef, useState } from "react";

interface ImageCacheEntry {
  url: string;
  isLoaded: boolean;
  timestamp: number;
}

/**
 * 全局图片缓存 Hook
 * 即使组件卸载，图片加载状态也会保留
 */
export function useImageCache() {
  const [cache, setCache] = useState<Map<string, ImageCacheEntry>>(new Map());
  const preloadedImages = useRef<Set<string>>(new Set());

  // 标记图片已加载
  const markAsLoaded = useCallback((url: string) => {
    setCache((prev) => {
      const newCache = new Map(prev);
      newCache.set(url, {
        url,
        isLoaded: true,
        timestamp: Date.now(),
      });
      return newCache;
    });
  }, []);

  // 检查图片是否已加载
  const isImageLoaded = useCallback(
    (url: string) => {
      return cache.get(url)?.isLoaded || false;
    },
    [cache]
  );

  // 预加载图片
  const preloadImage = useCallback(
    (url: string) => {
      if (preloadedImages.current.has(url)) return;

      preloadedImages.current.add(url);

      const img = new Image();
      img.onload = () => {
        markAsLoaded(url);
      };
      img.src = url;
    },
    [markAsLoaded]
  );

  // 批量预加载
  const preloadImages = useCallback(
    (urls: string[]) => {
      urls.forEach((url) => preloadImage(url));
    },
    [preloadImage]
  );

  return {
    markAsLoaded,
    isImageLoaded,
    preloadImage,
    preloadImages,
  };
}
