import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl } from "./lib.js";

/** Local / CI smoke. Staging SLO runs use slo.js with higher VUs. */
export const options = {
  vus: 5,
  duration: "20s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<800"],
    checks: ["rate>0.95"],
  },
};

export default function () {
  const health = http.get(`${baseUrl()}/health`);
  check(health, { "health 200": (r) => r.status === 200 && r.json("ok") === true });

  const live = http.get(`${baseUrl()}/v1/health`);
  check(live, { "live 200": (r) => r.status === 200 });

  const ready = http.get(`${baseUrl()}/ready`);
  check(ready, { "ready 200": (r) => r.status === 200 && r.json("postgres") === true });

  sleep(0.3);
}
