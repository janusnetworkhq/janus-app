import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl, jsonHeaders, pick, tokenPool } from "./lib.js";

/**
 * Feed SLO (docs/06): p95 TTFB < 200 ms on staging with warm Redis.
 * Local/dev allows 300 ms (MVP definition of done).
 */
const p95 = __ENV.SLO_STRICT === "1" ? "p(95)<200" : "p(95)<300";

export const options = {
  scenarios: {
    feed: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.FEED_RPS || 20),
      timeUnit: "1s",
      duration: __ENV.DURATION || "30s",
      preAllocatedVUs: 20,
      maxVUs: Number(__ENV.MAX_VUS || 80),
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: [p95],
    checks: ["rate>0.99"],
  },
};

export function setup() {
  const students = tokenPool("STUDENT", 20);
  return { students };
}

export default function (data) {
  const res = http.get(`${baseUrl()}/v1/feed?limit=10`, {
    headers: jsonHeaders(pick(data.students, __ITER)),
  });
  check(res, {
    "feed 200": (r) => r.status === 200,
    "feed items": (r) => Array.isArray(r.json("items")),
  });
  sleep(0.05);
}
