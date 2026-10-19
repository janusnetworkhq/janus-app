import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const VERIFIED_VIDEOS = [
  "https://vjs.zencdn.net/v/oceans.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://media.w3.org/2010/05/sintel/trailer.mp4",
  "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4",
];

async function main() {
  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL || "redis://:janus@localhost:6379/0");

  console.log("Fetching all videos from database...");
  const videos = await prisma.video.findMany({
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${videos.length} videos. Updating with verified open-source video URLs...`);

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const newUrl = VERIFIED_VIDEOS[i % VERIFIED_VIDEOS.length];

    await prisma.video.update({
      where: { id: video.id },
      data: {
        hlsMasterKey: newUrl,
        status: "READY",
        visibility: "PUBLIC_FEED",
        moderationStatus: "CLEAR",
      },
    });
    console.log(`[${i + 1}/${videos.length}] Video ${video.id} -> ${newUrl}`);
  }

  // Clear all feed caches in Redis
  const keys = await redis.keys("feed:*");
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log(`Cleared ${keys.length} feed cache keys in Redis`);
  }

  const videoKeys = await redis.keys("video:*");
  if (videoKeys.length > 0) {
    await redis.del(...videoKeys);
    console.log(`Cleared ${videoKeys.length} video cache keys in Redis`);
  }

  console.log("All videos updated successfully with working media streams!");
  await prisma.$disconnect();
  await redis.quit();
}

main().catch((err) => {
  console.error("Error updating video URLs:", err);
  process.exit(1);
});
