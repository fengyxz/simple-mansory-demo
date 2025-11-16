import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createFFmpeg,
  fetchFile,
} from "npm:@ffmpeg/ffmpeg@0.12.7";

const ffmpeg = createFFmpeg({
  corePath:
    "https://unpkg.com/@ffmpeg/core@0.12.7/dist/ffmpeg-core.js",
  log: false,
});

let isFfmpegReady = false;

async function ensureFfmpegLoaded() {
  if (!isFfmpegReady) {
    await ffmpeg.load();
    isFfmpegReady = true;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { fileKey, timestamp = "00:00:01.000" } = await req.json();
    if (!fileKey || typeof fileKey !== "string") {
      return new Response(
        JSON.stringify({ error: "fileKey 是必填参数" }),
        { status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "缺少 Supabase 环境变量" }),
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { data: asset, error: fetchError } = await supabase
      .from("file_assets")
      .select("media_url")
      .eq("file_key", fileKey)
      .single();

    if (fetchError || !asset) {
      return new Response(
        JSON.stringify({ error: "未找到对应 file_key" }),
        { status: 404 }
      );
    }

    const videoResponse = await fetch(asset.media_url);
    if (!videoResponse.ok) {
      return new Response(
        JSON.stringify({ error: "无法下载视频文件" }),
        { status: 502 }
      );
    }

    const videoBuffer = new Uint8Array(
      await videoResponse.arrayBuffer()
    );

    await ensureFfmpegLoaded();

    const inputName = `${fileKey}.mp4`;
    const outputName = `${fileKey}.jpg`;

    ffmpeg.FS("writeFile", inputName, await fetchFile(videoBuffer));

    await ffmpeg.run(
      "-i",
      inputName,
      "-ss",
      timestamp,
      "-frames:v",
      "1",
      "-vf",
      "scale=640:-1",
      outputName
    );

    const coverData = ffmpeg.FS("readFile", outputName);

    const storagePath = `covers/${fileKey}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(storagePath, coverData, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: uploadError.message }),
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("covers").getPublicUrl(storagePath);

    const { error: updateError } = await supabase
      .from("file_assets")
      .update({ cover_url: publicUrl })
      .eq("file_key", fileKey);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500 }
      );
    }

    ffmpeg.FS("unlink", inputName);
    ffmpeg.FS("unlink", outputName);

    return new Response(JSON.stringify({ coverUrl: publicUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "未知错误",
      }),
      { status: 500 }
    );
  }
});

