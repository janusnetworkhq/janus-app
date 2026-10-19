import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl, firstFeedVideoId, jsonHeaders, pick, tokenPool } from "./lib.js";

/**
 * Combined SLO verification matching docs/06 and docs/07:
 *  1. GET /feed     — staging 2k RPS (set FEED_RPS=2000)
 *  2. POST /likes   — staging 200 RPS
 *  3. POST /playback — staging 20 RPS
 *
 * Defaults stay small so `pnpm k6:slo` is safe against local Postgres.
 */
const strict = __ENV.SLO_STRICT === "1";

export const options = {
  scenarios: {
    feed: {
      executor: "constant-arrival-rate",
      exec: "feed",
      rate: Number(__ENV.FEED_RPS || 15),
      timeUnit: "1s",
      duration: __ENV.DURATION || "30s",
      preAllocatedVUs: 15,
      maxVUs: Number(__ENV.MAX_VUS || 60),
      startTime: "0s",
    },
    likes: {
      executor: "constant-arrival-rate",
      exec: "likes",
      rate: Number(__ENV.LIKE_RPS || 5),
      timeUnit: "1s",
      duration: __ENV.DURATION || "30s",
      preAllocatedVUs: 5,
      maxVUs: 20,
      startTime: "0s",
    },
    playback: {
      executor: "constant-arrival-rate",
      exec: "playback",
      rate: Number(__ENV.PLAYBACK_RPS || 3),
      timeUnit: "1s",
      duration: __ENV.DURATION || "30s",
      preAllocatedVUs: 3,
      maxVUs: 12,
      startTime: "0s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{scenario:feed}": [strict ? "p(95)<200" : "p(95)<300"],
    "http_req_duration{scenario:playback}": ["p(95)<300"],
    checks: ["rate>0.98"],
  },
};

export function setup() {
  const students = tokenPool("STUDENT", 20);
  const recruiters = tokenPool("RECRUITER", 8);
  return {
    students,
    recruiters,
    videoId: __ENV.VIDEO_ID || firstFeedVideoId(students[0]),
    assetId: __ENV.ASSET_ID || "missing-asset",
  };
}

export function feed(data) {
  const res = http.get(`${baseUrl()}/v1/feed?limit=10`, {
    headers: jsonHeaders(pick(data.students, __ITER)),
  });
  check(res, { "feed 200": (r) => r.status === 200 });
}

export function likes(data) {
  if (!data.videoId) {
    sleep(0.1);
    return;
  }
  const res = http.post(`${baseUrl()}/v1/videos/${data.videoId}/like`, "{}", {
    headers: jsonHeaders(pick(data.students, __ITER)),
  });
  check(res, { "like ok": (r) => r.status === 200 || r.status === 201 });
}

export function playback(data) {
  const res = http.post(`${baseUrl()}/v1/vault/assets/${data.assetId}/playback`, "{}", {
    headers: jsonHeaders(pick(data.recruiters, __ITER)),
    responseCallback: http.expectedStatuses(200, 403),
  });
  const denied = res.status === 403;
  const granted = res.status === 200;
  check(res, { "playback expected": () => granted || denied });
}
