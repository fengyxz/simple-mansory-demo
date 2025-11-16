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
  const imgRef = useRef<HTMLDivElement>(null);

  // 使用外部状态或内部状态
  const isLoaded = externalIsLoaded || internalIsLoaded;

  useEffect(() => {
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
        rootMargin: "200px", // 提前 200px 开始加载
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleLoad = () => {
    setInternalIsLoaded(true);
    onLoad?.();
  };

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {/* 骨架屏 */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse">
          <div className="absolute inset-0 bg-linear-to-r from-slate-200 via-slate-100 to-slate-200 animate-shimmer" />
        </div>
      )}

      {/* 实际图片 */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`${className} ${
            isLoaded ? "opacity-100" : "opacity-0"
          } transition-opacity duration-300`}
          onLoad={handleLoad}
          loading="lazy"
        />
      )}
    </div>
  );
});
