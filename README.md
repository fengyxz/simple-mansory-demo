## 项目说明：瀑布流、虚拟滚动与懒加载实验台

这个项目是一个围绕「视频资源管理 + 瀑布流布局 + 虚拟滚动 + 懒加载」的实验台，后端使用 Supabase 存储 `file_assets`，前端用 React + React Router + TanStack Query 实现多种列表展示方式，并配合 Node + ffmpeg 自动生成视频封面。

---

## 路由与页面结构

- **根组件 `App.tsx`**
  - 顶部导航：
    - `/` → `HomePage`：表单与分页管理 `file_key` 映射。
    - `/full-fetch` → `FullFetchPage`：全量获取的瀑布流视频列表。
    - `/virtual-scroll` → `VirtualScrollPage`：虚拟滚动 + 无限加载的视频列表。
    - `/layout-explain` → `LayoutExplainPage`：瀑布流布局 & CSS Grid 说明。
  - 使用 React Router 的 `<Routes>` 配置上述页面。

---

## FullFetchPage：全量瀑布流列表

- **文件**：`src/pages/FullFetchPage.tsx`
- **职责**：
  - 一次性获取所有 `file_assets`（适合数据量较小的场景）。
  - 使用 CSS Grid 实现瀑布流布局。
  - 点击卡片上的“预览”按钮可以打开视频预览对话框。
- **数据获取**：
  - 使用自定义 Hook `useAllFileKeys()`（基于 TanStack Query）：
    - `queryKey: ["allFileKeys"]`
    - 内部调用 `fetchAllFileKeys` 与 Supabase 通信。
  - 全量数据直接渲染为列表。
- **瀑布流布局**：
  - Grid 主体使用：
    - `className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2"`
  - 含义：
    - `minmax(300px, 1fr)`：每个卡片宽度最小 300px，多余空间按 1fr 平分。
    - `repeat(auto-fill, ...)`：在可用宽度内尽量放下更多列，自动换行形成瀑布流。
- **卡片组件**：
  - 统一使用 `VideoCard`（`src/components/VideoCard.tsx`）：
    - 封面图片通过 `LazyImage` 实现懒加载与骨架屏。
    - 鼠标悬停短暂延迟后自动播放视频预览。
    - 使用 `React.memo` 减少重复渲染。

---

## VirtualScrollPage：虚拟滚动 + 无限加载 + 懒加载

- **文件**：`src/pages/VirtualScrollPage.tsx`

### 1. 数据加载：TanStack Query 无限加载

- 使用自定义 Hook `useInfiniteFileKeys()`：
  - 基于 `useInfiniteQuery`：
    - `PAGE_SIZE = 5`（每页 5 条）。
    - `getNextPageParam` 根据已加载数量和总数判断是否还有下一页。
  - 页数据在页面中通过：

    ```ts
    const allVideos = useMemo(
      () => data?.pages.flatMap((page) => page.data) ?? [],
      [data]
    );
    ```

    汇总成一个扁平数组。

- 使用 `useFileKeysCount()` 获取总视频数量，用于统计展示：
  - `queryKey: ["fileKeysCount"]`
  - 与列表数据分开，异步获取。

### 2. 列表懒加载：IntersectionObserver 底部哨兵

- 页面底部放置一个“哨兵元素”：

  ```tsx
  <div ref={bottomSentinelRef} style={{ height: 1 }} />
  ```

- 使用 `IntersectionObserver` 监听该元素进入视口：
  - 当哨兵进入视口，且当前滚动方向为向下时，调用 `fetchNextPage()`。
  - 效果：滚动接近底部时才加载下一页，而不是一次性取回所有数据。

### 3. 简易虚拟化：仅渲染视口附近元素

- 常量：`VIRTUALIZATION_THRESHOLD = 100`
  - `allVideos.length <= 100`：不启用虚拟化，直接渲染全部。
  - `allVideos.length > 100`：启用虚拟化。
- 虚拟化核心：
  - 监听 `scrollContainerRef` 的滚动，估算每个 item 的高度（包括间距）。
  - 根据 `scrollTop` 和 `containerHeight` 计算可见索引范围 `visibleRange = { start, end }`，外加 overscan。
  - 渲染的数据为：

    ```ts
    const visibleVideos = shouldVirtualize
      ? allVideos.slice(visibleRange.start, visibleRange.end)
      : allVideos;
    ```

### 4. 行级控制：整行加载（接近 B 站 / YouTube 体验）

- 目标：避免最后一行只显示 1～2 个卡片，而是尽量以“整行”为单位展示。
- 步骤：
  1. **计算当前列数 `columnCount`**：
     - 使用 `gridRef` 获取 Grid 容器 DOM。
     - 遍历第一行元素（`offsetTop` 相同的元素）来统计列数。
     - 使用 `requestAnimationFrame` 做节流，避免频繁布局计算。
  2. **基于列数裁剪可见数据**：

     ```ts
     const cols = Math.max(columnCount, 1);
     const total = visibleVideos.length;
     const fullRowsCount = Math.floor(total / cols);
     const visibleCount = fullRowsCount * cols;
     const rowAlignedVideos =
       visibleCount === 0 ? visibleVideos : visibleVideos.slice(0, visibleCount);
     ```

     - 若不足一整行，则在数据量极少时保持全部渲染（避免空白）。
     - 在数据量较大时以整行渲染，减少“半截行”的观感。

  3. **整行骨架屏**：
     - 当 `isFetchingNextPage` 为 `true` 时，根据当前 `columnCount` 渲染一整行 skeleton 卡片。
     - 用户看到的是“整行骨架 → 整行替换为真实内容”的加载体验。

### 5. 图片懒加载与缓存：`LazyImage` + `useImageCache`

- **Hook：**`src/hooks/useImageCache.ts`
  - `cache: Map<string, { url, isLoaded, timestamp }>`（React state）：
    - 记录某张图片是否已经加载完成。
    - 用于控制是否显示骨架屏。
  - `preloadedImages: Set<string>`（`useRef`）：
    - 记录已经预加载过的 URL，避免重复创建 `Image` 对象。
  - 导出能力：
    - `markAsLoaded(url)`：标记 url 对应图片为已加载。
    - `isImageLoaded(url)`：查询当前缓存状态。
    - `preloadImage(url)` / `preloadImages(urls)`：主动预加载图片。

- **组件：**`src/components/LazyImage.tsx`
  - 使用 `IntersectionObserver` 监听图片元素是否进入视口：
    - 未进入视口 → 仅显示骨架屏；
    - 进入视口 → 设置 `img.src`，开始加载真实图片。
  - 提供骨架屏、加载状态和淡入效果：
    - 骨架类：`bg-slate-200 animate-pulse`。
    - 图片加载完后以渐显方式替代骨架。

- 在 `VideoCard` 中使用：
  - 将 `isImageLoaded(video.cover_url)` 结果透传给 `LazyImage` 作为 `externalIsLoaded`。
  - 在图片 `onLoad` 回调中调用 `markAsLoaded`，让缓存状态在组件卸载 / 重新挂载时仍可复用。

- **图片预加载与虚拟化结合**：
  - 启用虚拟化时，根据 `visibleRange` 前后额外扩展一段索引范围：

    ```ts
    const preloadRange = {
      start: Math.max(0, visibleRange.start - 10),
      end: Math.min(allVideos.length, visibleRange.end + 10),
    };
    ```

  - 对该范围内的 `cover_url` 调用 `preloadImages`，提前加载即将进入视口的图片。

> 说明：图片内容本身的缓存仍然由浏览器的 HTTP 缓存机制控制（`Cache-Control`、`ETag` 等）；`useImageCache` 主要缓存“加载状态”，用于控制 UI 行为和减少视觉闪烁。

### 6. 右侧实验面板

- 固定在右侧的一个可折叠面板，用于展示实时状态：
  - 总数据量（单独查询的 count）。
  - 已加载的视频数量（`allVideos.length`）。
  - 当前渲染数量（虚拟化时为 `visibleVideos.length`，否则为“全部渲染”）。
  - 滚动速度（px/s）。
  - 上拉距离（用于移动端上拉手势实验）。
  - 下一页状态（`hasNextPage`、`isFetchingNextPage`）。
  - 当前列数（`columnCount`）。
- 方便观察调整虚拟化、分页、懒加载策略对 UI 行为的影响。

---

## LayoutExplainPage：瀑布流 & Grid 布局说明

- **文件**：`src/pages/LayoutExplainPage.tsx`
- **用途**：
  - 解释当前项目为何使用
    `grid-cols-[repeat(auto-fill,minmax(300px,1fr))]` 来做瀑布流。
  - 通过两个并排示例直观对比 `auto-fill` 与 `auto-fit`：
    - 左侧：`repeat(auto-fill, minmax(120px, 1fr))`
    - 右侧：`repeat(auto-fit, minmax(120px, 1fr))`
  - 解释：
    - `auto-fill`：保留空轨道，更适合列数稳定、未来可能填充更多 item 的场景。
    - `auto-fit`：折叠空轨道，让现有元素自动拉宽填满一行，更适合希望减少最后一行留白的布局。
  - 总结为何当前视频瀑布流选择 `auto-fill`：在视频数量多、行数丰富的情况下，列数稳定、视觉更平衡。

---

## VideoPreviewDialog：视频预览对话框

- **文件**：`src/components/VideoPreviewDialog.tsx`
- **职责**：
  - 根据传入的 `fileKey` 获取对应视频播放地址，并在对话框中预览视频。
  - 使用自定义 Hook `useFileKey(fileKey)`（基于 TanStack Query）来读取单条记录。
  - 利用 React Query 的缓存特性避免重复请求同一 `fileKey`。
  - 与 `FileAsset` 数据结合，显示辅助信息（如标题、封面等）。

---

## 封面生成服务：Node + ffmpeg

- **文件**：`server/index.js`
- **依赖**：`express`、`fluent-ffmpeg`、`@ffmpeg-installer/ffmpeg`、`@supabase/supabase-js`
- **接口**：`POST /generate-cover`
  - 请求体：
    - `fileKey: string`（必填）
    - `timestamp?: string`，格式 `"HH:MM:SS"`，默认 `"00:00:10"`
    - `force?: boolean`，是否强制重新生成封面。
- **处理流程**：
  1. 根据 `fileKey` 查询 Supabase `file_assets` 表，获取 `media_url` 和 `cover_url`。
  2. 若存在 `cover_url` 且 `force !== true`，直接返回已有封面，跳过生成。
  3. 使用 `fetch(media_url)` 下载视频到系统临时目录。
  4. 使用 `ffprobe` 获取视频总时长，校正截帧时间，避免选在结尾导致失败。
  5. 使用 `ffmpeg.screenshots` 在多备选时间点（调整后的时间点、5 秒、1 秒）依次尝试截帧，生成封面图片。
  6. 读取本地生成的 JPG，上传至 Supabase Storage `covers` bucket（支持 upsert）。
  7. 调用 `getPublicUrl` 获取封面的公开访问地址，将其写回 `file_assets.cover_url` 字段。
  8. 清理临时文件（视频文件与封面文件）。

> 前端通过调用该服务为 `fileKey` 生成封面，再由 `FullFetchPage` / `VirtualScrollPage` 使用 `cover_url` 渲染懒加载图片。

---

## 缓存与性能策略概览

- **HTTP 缓存（浏览器 & CDN）**
  - 由图片服务 / Supabase Storage 的响应头（`Cache-Control`、`ETag`、`Last-Modified` 等）控制。
  - 浏览器会自动决定图片是否从本地缓存中直接读取，前端代码无需关心细节。

- **React Query 缓存**
  - `useAllFileKeys`、`useInfiniteFileKeys`、`useFileKey`、`useFileKeysCount` 均配置了合适的 `staleTime` 等参数。
  - 避免重复请求相同数据，列表切换/返回时直接复用之前的查询结果。

- **图片加载状态缓存（`useImageCache`）**
  - 缓存的是“是否加载过”这类元信息，而非图片二进制内容。
  - 主要作用：
    - 防止虚拟化/重排导致已加载图片再次显示 skeleton。
    - 配合预加载，使即将进入视口的图片提前加载，滚动时更平滑。

- **虚拟化与行级控制**
  - 对大数据量时仅渲染视口附近元素，降低 DOM 数量。
  - 基于 `columnCount` 的行级裁剪与整行 skeleton，使 UI 更接近实战产品（YouTube / B 站推荐流）的展示方式。

---

## 未来可扩展方向（建议）

- 将图片懒加载中的骨架屏效果与主题统一封装，支持暗色模式与更多占位风格。
- 在 `VirtualScrollPage` 中增加基于列数的分页策略（例如每次加载整行的倍数），进一步贴近 B 站的 5 列布局体验。
- 若需要离线浏览或极端大规模图片缓存，可以在现有 `useImageCache` 基础上增加 IndexedDB 层，对派生资源（缩略图/LQIP）做持久化缓存。

# Supabase FileKey Storage

该项目提供一个最小实现：将本地输入的 `fileKey` 与线上 mp4 地址写入 Supabase，充当远程 server，方便后续项目直接读取映射关系。

## 快速开始

1. 安装依赖
   ```bash
   pnpm install
   ```
2. 在项目根目录创建 `.env`，配置 Supabase 信息与封面服务地址
   ```bash
   VITE_SUPABASE_URL=你的项目URL
   VITE_SUPABASE_ANON_KEY=你的anon key
   # 可选：前端调用封面服务的地址（开发默认 /cover-service，经由 Vite 代理到 4000 端口）
   VITE_COVER_SERVICE_URL=/cover-service
   ```
3. 启动本地开发
   ```bash
   pnpm dev
   ```

## Supabase 表结构

在 Supabase SQL Editor 执行：

```sql
create table if not exists public.file_assets (
  file_key text primary key,
  media_url text not null,
  created_at timestamptz not null default now()
);
```

前端通过 `upsert` 写入数据，因此重复的 `fileKey` 会被覆盖更新。

## 使用方式

- 在页面表单中输入 `fileKey` 与完整的 mp4 URL
- 点击「保存到 Supabase」，成功后会读取最新写入结果
- 其他项目可直接调用 Supabase PostgREST API 或客户端 SDK，查询 `file_assets` 表即可得到 mp4 地址

## 目录概览

- `src/lib/supabaseClient.ts`：统一初始化 Supabase 客户端
- `src/services/fileKeyService.ts`：封装写入、单条查询与分页查询逻辑
- `src/hooks/useFileKey.ts`：React Query hook，获取单个 fileKey 数据（带缓存）
- `src/hooks/useAllFileKeys.ts`：React Query hook，获取所有 fileKeys（带缓存）
- `src/hooks/useInfiniteFileKeys.ts`：React Query 无限查询 hook，支持分页懒加载
- `src/components/FileKeyForm.tsx`：输入表单与交互
- `src/components/FileKeyList.tsx`：分页浏览已存映射
- `src/components/VideoPreviewDialog.tsx`：视频预览 Modal 组件
- `src/pages/HomePage.tsx`：表单 + 分页列表页面
- `src/pages/FullFetchPage.tsx`：`/full-fetch` 全量查询 + 瀑布流视频展示
- `src/pages/VirtualScrollPage.tsx`：`/virtual-scroll` 虚拟滚动列表 + 无限加载
- `src/App.tsx`：应用布局与路由

### 页面路由

- `/` - 表单与分页列表（适合管理和添加数据）
- `/full-fetch` - 全量瀑布流（适合小规模数据快速浏览）
- `/virtual-scroll` - 虚拟滚动列表（**推荐用于大规模数据**，类似 YouTube）

## TanStack Query (React Query) 缓存

项目集成了 TanStack Query v5 来管理服务端状态和接口缓存：

- **自动缓存**：相同的 `fileKey` 请求会被自动缓存，避免重复请求
- **缓存时间**：
  - 单个 fileKey 数据：5 分钟内视为新鲜数据
  - 所有 fileKeys 列表：2 分钟内视为新鲜数据
  - 缓存保留时间：10 分钟后自动清理
- **智能去重**：多个组件同时请求相同数据时，只会发起一次网络请求
- **后台更新**：数据过期后，下次访问会在后台自动重新获取

主要 hooks：

- `useFileKey(fileKey)`：获取单个 fileKey 的详细信息（包括 media_url）
- `useAllFileKeys()`：获取所有 fileKeys 列表（全量加载）
- `useInfiniteFileKeys()`：无限查询，支持分页懒加载（推荐用于大规模数据）

配置位于 `src/main.tsx` 中的 `QueryClient`。

## TanStack Virtual 虚拟滚动

项目集成了 TanStack Virtual v3 来实现高性能虚拟滚动：

- **虚拟化渲染**：只渲染可见区域的 DOM 节点，大幅提升性能
- **无限滚动**：结合 React Query 的 `useInfiniteQuery`，自动分页加载
- **智能预渲染**：预渲染上下 3 行，确保流畅滚动体验
- **按行虚拟化**：每行 4 列的网格布局，优化大规模数据展示

特点：

- 支持数千条数据流畅滚动
- 内存占用低，只保留可见区域的 DOM
- 自动检测滚动位置，触发下一页加载
- 类似 YouTube 的无限滚动体验

访问 `/virtual-scroll` 路由体验虚拟滚动列表。

## Tailwind CSS 4 说明

- 项目基于 Tailwind CSS 4，入口样式为 `src/index.css`
- 通过 `@import "tailwindcss";` 启用内置层，并使用 `@theme` 定制字体、`@layer base` 覆盖全局样式
- 如需新增主题变量，可在 `@theme` 中声明，例如 `--color-brand: #000`

## 本地封面生成服务（可选）

`server/` 目录提供了一个使用 Express + FFmpeg 的 Node 服务，用于批量拉取 mp4 并生成封面图，适合在本地或自建服务器上运行：

1. 安装依赖
   ```bash
   cd server
   pnpm install
   ```
2. 配置环境变量（可直接在 shell 中导出）
   ```bash
   export SUPABASE_URL=https://your-project.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   export PORT=4000
   ```
3. 启动服务
   ```bash
   pnpm dev
   ```
4. 通过 HTTP 调用 `POST /generate-cover` 触发封面生成：
   ```bash
   curl http://localhost:4000/generate-cover \
     -H "Content-Type: application/json" \
     -d '{"fileKey":"video-bunny-001","timestamp":"00:00:02"}'
   ```

服务会自动：

- 根据 `file_key` 查询 `file_assets` 获取 mp4 地址；
- 下载视频到临时目录，调用 FFmpeg 截取指定时间的缩略图；
- 将封面上传至 Supabase Storage `covers/`，并更新 `file_assets.cover_url`；
- 返回最新的 `coverUrl`。

默认截取视频第 30 秒作为封面（可通过请求 body `timestamp` 调整），若传 `force: true` 会强制重新生成，即使已有封面。前端的 “生成缺失封面” 按钮将请求体设为 `{ fileKey, timestamp: "00:00:30", force: true }`，确保重新拉取最新封面。

可将前端的 “生成缺失封面” 按钮对接到该服务，实现一键批量修复。
前端通过 `VITE_COVER_SERVICE_URL` 环境变量指向该服务（默认 `http://localhost:4000`），请确保服务启动后再在页面点击按钮。
