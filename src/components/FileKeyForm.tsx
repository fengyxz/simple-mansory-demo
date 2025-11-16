import { type FormEvent, useState } from "react";
import { saveFileKey, fetchFileKey } from "../services/fileKeyService";

type FormState = {
  fileKey: string;
  mediaUrl: string;
};

export function FileKeyForm() {
  const [form, setForm] = useState<FormState>({
    fileKey: "",
    mediaUrl: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);

  const handleChange = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setFetchedUrl(null);
    setIsLoading(true);

    try {
      if (!/^https?:\/\/.+\.mp4(\?.*)?$/.test(form.mediaUrl)) {
        throw new Error("请输入合法的 mp4 线上地址");
      }

      await saveFileKey(form);
      setMessage("已将 fileKey 对应的 mp4 地址写入 Supabase。");

      const latest = await fetchFileKey(form.fileKey);
      setFetchedUrl(latest?.media_url ?? null);
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "未知错误，请稍后重试。";
      setMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">
          文件 key / MP4 地址映射
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          将 fileKey 与线上 mp4 地址存入 Supabase，供后续项目读取。
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          File Key
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-slate-900 focus:outline-none"
            placeholder="例如：face-scan-001"
            value={form.fileKey}
            onChange={(event) => handleChange("fileKey")(event.target.value)}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          MP4 地址
          <input
            type="url"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-slate-900 focus:outline-none"
            placeholder="https://example.com/path/video.mp4"
            value={form.mediaUrl}
            onChange={(event) => handleChange("mediaUrl")(event.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isLoading ? "写入中..." : "保存到 Supabase"}
        </button>
      </form>

      {message && (
        <p className="mt-4 text-sm text-slate-700" role="status">
          {message}
        </p>
      )}

      {fetchedUrl && (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium">最新存储结果：</p>
          <p className="break-all text-slate-600">{fetchedUrl}</p>
        </div>
      )}
    </section>
  );
}

