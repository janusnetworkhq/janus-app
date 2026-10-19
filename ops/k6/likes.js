import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl, firstFeedVideoId, jsonHeaders, pick, tokenPool } from "./lib.js";

/** Staging target: 200 RPS likes. Default is a safe local rate. */
export const options = {
  scenarios: {
    likes: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.LIKE_RPS || 10),
      timeUnit: "1s",
      duration: __ENV.DURATION || "20s",
      preAllocatedVUs: 10,
      maxVUs: Number(__ENV.MAX_VUS || 40),
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<400"],
  },
};

export function setup() {
  const students = tokenPool("STUDENT", 20);
  return { students, videoId: __ENV.VIDEO_ID || firstFeedVideoId(students[0]) };
}

export default function (data) {
  if (!data.videoId) {
    sleep(0.2);
    return;
  }
  const res = http.post(`${baseUrl()}/v1/videos/${data.videoId}/like`, "{}", {
    headers: jsonHeaders(pick(data.students, __ITER)),
  });
  check(res, { "like 2xx": (r) => r.status === 200 || r.status === 201 });
}
