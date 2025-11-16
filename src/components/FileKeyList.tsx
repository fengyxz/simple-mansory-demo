import { useEffect, useState } from "react";
import {
  fetchFileKeysPaginated,
  generateCoverForFileKey,
  type FileAsset,
} from "../services/fileKeyService";

const PAGE_SIZE = 5;

export function FileKeyList() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<FileAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, total: count } = await fetchFileKeysPaginated(
          page,
          PAGE_SIZE
        );
        if (ignore) {
          return;
        }
        setItems(data);
        setTotal(count);
      } catch (err) {
        if (ignore) {
          return;
        }
        const errMsg =
          err instanceof Error ? err.message : "加载失败，请稍后重试。";
        setError(errMsg);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [page, refreshIndex]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handlePrev = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNext = () => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handleRegenerateCover = async (fileKey: string) => {
    setActionFeedback(null);
    setActiveKey(fileKey);
    try {
      await generateCoverForFileKey(fileKey, true);
      setActionFeedback({
        type: "success",
        text: `已重新生成 ${fileKey} 的封面，请稍候刷新。`,
      });
      setRefreshIndex((prev) => prev + 1);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "封面生成失败，请重试。";
      setActionFeedback({
        type: "error",
        text: message,
      });
    } finally {
      setActiveKey(null);
    }
  };

  return (
    <section className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            FileKey 分页列表
          </h2>
          <p className="text-sm text-slate-500">
            支持分页浏览 Supabase 中已存储的映射记录。
          </p>
        </div>
        <div className="text-sm text-slate-500">
          第 {page} / {totalPages} 页（共 {total} 条）
        </div>
      </header>

      {actionFeedback && (
        <p
          className={`mt-3 rounded-lg border px-4 py-2 text-sm ${
            actionFeedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
          role="status"
        >
          {actionFeedback.text}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-slate-700">
          <thead>
            <tr className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">封面</th>
              <th className="px-4 py-3">File Key</th>
              <th className="px-4 py-3">MP4 地址</th>
              <th className="px-4 py-3 text-center">操作</th>
              <th className="px-4 py-3 whitespace-nowrap">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  加载中...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-red-500">
                  {error}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  暂无数据，请先创建映射。
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.file_key} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    {item.cover_url ? (
                      <div className="aspect-video w-32 overflow-hidden rounded-lg border border-slate-200">
                        <img
                          src={item.cover_url}
                          alt={`${item.file_key} 封面`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                        暂无封面
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {item.file_key}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <a
                      href={item.media_url ?? ""}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline underline-offset-2"
                    >
                      预览
                    </a>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRegenerateCover(item.file_key)}
                      disabled={activeKey === item.file_key}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeKey === item.file_key
                        ? "生成中..."
                        : "重新生成封面"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <button
          type="button"
          onClick={handlePrev}
          disabled={page === 1 || isLoading}
          className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          上一页
        </button>
        <span>
          每页 {PAGE_SIZE} 条 · 共 {totalPages} 页
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={page === totalPages || isLoading}
          className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </section>
  );
}
