import { useState } from "react";
import { FileKeyForm } from "../components/FileKeyForm";
import { FileKeyList } from "../components/FileKeyList";
import { generateCoverForAll } from "../services/fileKeyService";

export function HomePage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleGenerateCovers = async () => {
    setStatusMessage(null);
    setIsGenerating(true);
    try {
      await generateCoverForAll();
      setStatusMessage("已触发缺失封面生成，请稍后刷新列表。");
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "生成封面失败，请重试。";
      setStatusMessage(errMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-80px)] bg-white px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">
              Supabase 文件映射服务
            </h1>
            <p className="text-base text-slate-600">
              使用 Supabase 作为远程 server，将 fileKey 与对应的 mp4
              线上地址存储， 后续项目可直接通过 Supabase API 读取这份映射表。
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              一键补齐所有缺失的封面，后台将调用 Edge Function 使用 FFmpeg
              生成缩略图。
            </p>
            <button
              type="button"
              onClick={handleGenerateCovers}
              disabled={isGenerating}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isGenerating ? "生成中..." : "生成缺失封面"}
            </button>
          </div>

          {statusMessage && (
            <p
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700"
              role="status"
            >
              {statusMessage}
            </p>
          )}
        </section>

        <FileKeyForm />
        <FileKeyList />
      </div>
    </main>
  );
}
