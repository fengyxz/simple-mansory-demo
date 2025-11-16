import type React from "react";

export const LayoutExplainPage: React.FC = () => {
  return (
    <main className="min-h-[calc(100vh-80px)] bg-white">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">瀑布流布局说明</h1>
          <p className="text-slate-600">
            这里解释当前项目中使用的瀑布流思路，并通过可视化示例对比
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              auto-fill
            </code>
            与
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              auto-fit
            </code>
            的差异。
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">
            1. 当前瀑布流是怎么做的？
          </h2>
          <p className="text-sm leading-relaxed text-slate-700">
            在{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              FullFetchPage
            </code>
            和{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              VirtualScrollPage
            </code>{" "}
            里，我们用的是 CSS Grid 的 “自适应列宽”：
          </p>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
            <code>grid-cols-[repeat(auto-fill,minmax(300px,1fr))]</code>
          </pre>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              <span className="font-semibold">minmax(300px, 1fr)</span>：
              每个卡片最小宽度 300px，最大可以拉伸到剩余空间的 1 等分。
            </li>
            <li>
              <span className="font-semibold">repeat(auto-fill, ...)</span>：
              在容器宽度允许的情况下尽量放下更多列，超出就自动换行。
            </li>
            <li>
              卡片高度由内容决定，再加上垂直间距{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                gap
              </code>
              ，整体看起来就是瀑布流效果。
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">
            2. auto-fill vs auto-fit 的区别
          </h2>
          <p className="text-sm text-slate-700">
            两者语法非常像，但行为有细微区别，特别是在一行放不满时：
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            {/* auto-fill 示例 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                示例 A：auto-fill
              </h3>
              <p className="text-xs text-slate-600">
                使用{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                  grid-cols-[repeat(auto-fill,minmax(120px,1fr))]
                </code>
                。当一行放不满时，浏览器仍然为“潜在列”预留轨道，导致看起来好像有“隐形列”。
              </p>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 max-w-xl mx-auto">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-16 rounded-md bg-sky-500/80 text-center text-xs font-medium text-white flex items-center justify-center"
                    >
                      auto-fill {idx + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* auto-fit 示例 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                示例 B：auto-fit
              </h3>
              <p className="text-xs text-slate-600">
                使用{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                  grid-cols-[repeat(auto-fit,minmax(120px,1fr))]
                </code>
                。一行放不满时，会“折叠”掉空列，让现有 item 自动拉宽填满整行。
              </p>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 max-w-xl mx-auto">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-16 rounded-md bg-emerald-500/80 text-center text-xs font-medium text-white flex items-center justify-center"
                    >
                      auto-fit {idx + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
            <li>
              <span className="font-semibold">auto-fill</span>
              ：更适合你希望保留“列轨道”的场景，比如未来会有更多 item 进来。
            </li>
            <li>
              <span className="font-semibold">auto-fit</span>
              ：更适合希望最后一行自动撑满、减少“空白感”的场景。
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">
            3. 为什么这里选择 auto-fill？
          </h2>
          <p className="text-sm text-slate-700">
            对于视频瀑布流，卡片数量通常较多，整行很少“只剩一两个”。使用{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              auto-fill
            </code>{" "}
            可以让列数更加稳定，避免窗口稍微缩放就频繁改变行内卡片数量，视觉上更平衡。
          </p>
          <p className="text-sm text-slate-700">
            同时，配合{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              gap
            </code>{" "}
            和卡片内部的自适应高度，你看到的就是“宽度最小 300px
            的自适应瀑布流”，而不需要额外的 JS 布局计算。
          </p>
        </section>
      </div>
    </main>
  );
};
