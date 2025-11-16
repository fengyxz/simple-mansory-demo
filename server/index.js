import "dotenv/config";
import express from "express";
import path from "path";
import { tmpdir } from "os";
import { createWriteStream } from "fs";
import fs from "fs/promises";
import { pipeline } from "stream/promises";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
console.log("SERVICE KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 8));
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.warn(`[cover-service] Missing env: ${key}`);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
app.use(express.json({ limit: "1mb" }));

function parseTimestampToSeconds(input) {
  if (typeof input !== "string") {
    return 0;
  }
  const parts = input.split(":").map(Number);
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
    return 0;
  }
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatSecondsToTimestamp(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    seconds = 0;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.max(0, Math.floor(seconds % 60));
  return [hours, minutes, secs]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        resolve(null);
      } else {
        resolve(metadata?.format?.duration ?? null);
      }
    });
  });
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.post("/generate-cover", async (req, res) => {
  const { fileKey, timestamp = "00:00:10", force = false } = req.body ?? {};

  if (!fileKey || typeof fileKey !== "string") {
    return res.status(400).json({ error: "fileKey 参数必填" });
  }

  try {
    const { data: asset, error: fetchError } = await supabase
      .from("file_assets")
      .select("media_url, cover_url")
      .eq("file_key", fileKey)
      .single();

    if (fetchError || !asset) {
      return res.status(404).json({ error: "未找到对应 file_key" });
    }

    if (asset.cover_url && !force) {
      return res.json({
        coverUrl: asset.cover_url,
        skipped: true,
        reason: "封面已存在，跳过生成",
      });
    }

    const videoResponse = await fetch(asset.media_url);
    if (!videoResponse.ok || !videoResponse.body) {
      return res.status(502).json({ error: "无法下载视频文件" });
    }

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const tempVideoPath = path.join(tmpdir(), `${fileKey}-${uniqueSuffix}.mp4`);
    const tempCoverPath = path.join(tmpdir(), `${fileKey}-${uniqueSuffix}.jpg`);

    await pipeline(videoResponse.body, createWriteStream(tempVideoPath));

    const durationSeconds = await getVideoDuration(tempVideoPath);
    const requestedSeconds = parseTimestampToSeconds(timestamp);
    const safeDuration =
      typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
        ? Math.max(durationSeconds - 1, 0)
        : null;
    const adjustedSeconds =
      safeDuration === null
        ? requestedSeconds
        : Math.min(requestedSeconds, safeDuration);
    const adjustedTimestamp = formatSecondsToTimestamp(
      Number.isFinite(adjustedSeconds) ? adjustedSeconds : requestedSeconds
    );

    const captureQueue = [adjustedTimestamp, "00:00:05", "00:00:01"].filter(
      (value, index, self) => self.indexOf(value) === index
    );
    let screenshotCreated = false;
    let lastCaptureError;

    for (const currentTimestamp of captureQueue) {
      try {
        await new Promise((resolve, reject) => {
          ffmpeg(tempVideoPath)
            .setStartTime(currentTimestamp)
            .screenshots({
              timestamps: [currentTimestamp],
              filename: path.basename(tempCoverPath),
              folder: path.dirname(tempCoverPath),
              size: "640x360",
            })
            .on("end", resolve)
            .on("error", reject);
        });
        screenshotCreated = true;
        break;
      } catch (error) {
        lastCaptureError = error;
      }
    }

    if (!screenshotCreated) {
      throw lastCaptureError ?? new Error("无法生成封面截图");
    }

    const coverBuffer = await fs.readFile(tempCoverPath);
    const storagePath = `covers/${fileKey}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(storagePath, coverBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("covers").getPublicUrl(storagePath);

    const { error: updateError } = await supabase
      .from("file_assets")
      .update({ cover_url: publicUrl })
      .eq("file_key", fileKey);

    if (updateError) {
      throw updateError;
    }

    res.json({ coverUrl: publicUrl, storagePath });

    await cleanup([tempVideoPath, tempCoverPath]);
  } catch (error) {
    console.error("[cover-service] generate-cover error", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
});

async function cleanup(files) {
  await Promise.all(
    files.map((file) =>
      fs.unlink(file).catch(() => {
        /* ignore */
      })
    )
  );
}

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(
    `[cover-service] listening on http://localhost:${PORT} (ffmpeg: ${ffmpegInstaller.path})`
  );
});
