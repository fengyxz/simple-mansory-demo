import { memo, useEffect, useRef, useState } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  // 外部控制的加载状态（用于虚拟化场景）
  externalIsLoaded?: boolean;
  onLoad?: () => void;
}

export const LazyImage = memo(function LazyImage({
  src,
  alt,
  className = "",
  externalIsLoaded = false,
  onLoad,
}: LazyImageProps) {
  const [internalIsLoaded, setInternalIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const hasLoadedOnce = useRef(false);

  // 使用外部状态或内部状态，一旦加载过就永远认为已加载
  const isLoaded = externalIsLoaded || internalIsLoaded || hasLoadedOnce.current;

  // 检测是否为触摸设备（移动端）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasTouch =
      "ontouchstart" in window ||
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 0;
    setIsTouchDevice(Boolean(hasTouch));
  }, []);

  useEffect(() => {
    const container = imgRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        // 移动端减少预加载距离，避免同时加载太多图片
        rootMargin: isTouchDevice ? "50px" : "200px",
        threshold: 0.01,
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [isTouchDevice]);

  const handleLoad = () => {
    hasLoadedOnce.current = true;
    setInternalIsLoaded(true);
    onLoad?.();
  };

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {/* 骨架屏：移动端静态灰色，桌面端保留动画 */}
      {!isLoaded && (
        <div
          className={`absolute inset-0 bg-slate-200 ${
            isTouchDevice ? "" : "animate-pulse"
          }`}
        >
          {!isTouchDevice && (
            <div className="absolute inset-0 bg-linear-to-r from-slate-200 via-slate-100 to-slate-200 animate-shimmer" />
          )}
        </div>
      )}

      {/* 实际图片 */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`${className} ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${isTouchDevice ? "" : "transition-opacity duration-300"}`}
          onLoad={handleLoad}
          loading="lazy"
          style={{
            WebkitBackfaceVisibility: "hidden",
            backfaceVisibility: "hidden",
            WebkitTransform: "translate3d(0,0,0)",
            transform: "translate3d(0,0,0)",
          }}
        />
      )}
    </div>
  );
});
