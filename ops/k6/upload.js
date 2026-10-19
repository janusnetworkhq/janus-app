import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl, jsonHeaders, pick, tokenPool } from "./lib.js";

/** Presign only (docs/06). Does not PUT bytes. Default rate stays small. */
export const options = {
  scenarios: {
    upload: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.UPLOAD_RPS || 5),
      timeUnit: "1s",
      duration: __ENV.DURATION || "20s",
      preAllocatedVUs: 5,
      maxVUs: Number(__ENV.MAX_VUS || 20),
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.95"],
  },
};

export function setup() {
  return { students: tokenPool("STUDENT", 10) };
}

export default function (data) {
  const res = http.post(
    `${baseUrl()}/v1/uploads`,
    JSON.stringify({
      kind: "FEED_VIDEO",
      contentType: "video/mp4",
      byteSize: 1_000_000,
      durationMs: 15_000,
      caption: "k6",
    }),
    { headers: jsonHeaders(pick(data.students, __ITER)) },
  );
  check(res, { "presign 201/200": (r) => r.status === 200 || r.status === 201 });
  sleep(0.05);
}
