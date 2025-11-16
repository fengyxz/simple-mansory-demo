import { supabase } from "../lib/supabaseClient";

export type FileKeyPayload = {
  fileKey: string;
  mediaUrl: string;
};

export type FileAsset = {
  file_key: string;
  media_url: string | null;
  cover_url: string | null;
  created_at: string;
};

export type FileKeysCursor = {
  created_at: string;
  file_key: string;
} | null;

const TABLE_NAME = "file_assets";

export async function saveFileKey({
  fileKey,
  mediaUrl,
}: FileKeyPayload): Promise<void> {
  const { error } = await supabase.from(TABLE_NAME).upsert(
    {
      file_key: fileKey,
      media_url: mediaUrl,
    },
    {
      onConflict: "file_key",
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchFileKey(fileKey: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("file_key, media_url, cover_url, created_at")
    .eq("file_key", fileKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function fetchFileKeysPaginated(
  page: number,
  pageSize: number
): Promise<{
  data: FileAsset[];
  total: number;
}> {
  const currentPage = Math.max(page, 1);
  const limit = Math.max(pageSize, 1);
  const from = (currentPage - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await supabase
    .from(TABLE_NAME)
    .select("file_key, media_url, cover_url, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    data: data ?? [],
    total: count ?? 0,
  };
}

export async function fetchFileKeysByCursor(
  cursor: FileKeysCursor,
  pageSize: number
): Promise<{
  data: FileAsset[];
  total: number;
  cursor: FileKeysCursor;
}> {
  const limit = Math.max(pageSize, 1);

  let query = supabase
    .from(TABLE_NAME)
    .select("file_key, media_url, cover_url, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .order("file_key", { ascending: false })
    .limit(limit);

  if (cursor && cursor.created_at && cursor.file_key) {
    const { created_at, file_key } = cursor;
    // 复合光标：
    // where created_at < cursor_created_at
    //   or (created_at = cursor_created_at and file_key < cursor_file_key)
    query = query.or(
      `and(created_at.lt.${created_at}),and(created_at.eq.${created_at},file_key.lt.${file_key})`
    );
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const items = data ?? [];
  const nextCursor =
    items.length > 0
      ? {
          created_at: items[items.length - 1]!.created_at,
          file_key: items[items.length - 1]!.file_key,
        }
      : null;

  return {
    data: items,
    total: count ?? 0,
    cursor: nextCursor,
  };
}

export async function fetchAllFileKeys(): Promise<FileAsset[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("file_key, media_url, cover_url, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchFileKeysTotalCount(): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE_NAME)
    .select("file_key", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

const COVER_SERVICE_URL =
  (import.meta.env.VITE_COVER_SERVICE_URL as string | undefined)?.replace(
    /\/$/,
    ""
  ) ?? "/cover-service";
const COVER_TIMESTAMP = "00:00:05";

export async function generateCoverForFileKey(
  fileKey: string,
  force: boolean = false
) {
  const response = await fetch(`${COVER_SERVICE_URL}/generate-cover`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileKey, timestamp: COVER_TIMESTAMP, force }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "封面生成服务调用失败");
  }

  const data = (await response.json()) as { coverUrl?: string };
  return data.coverUrl;
}

export async function generateCoverForAll() {
  const all = await fetchAllFileKeys();
  for (const item of all) {
    if (!item.cover_url) {
      await generateCoverForFileKey(item.file_key);
    }
  }
}
