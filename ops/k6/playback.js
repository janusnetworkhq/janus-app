import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl, jsonHeaders, pick, tokenPool } from "./lib.js";

/**
 * Vault grant SLO: > 99.9% success excluding 403 (no grant).
 * Denied playback must stay VAULT_DENIED — that is a security check, not a failure.
 */
export const options = {
  scenarios: {
    playback: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.PLAYBACK_RPS || 5),
      timeUnit: "1s",
      duration: __ENV.DURATION || "20s",
      preAllocatedVUs: 5,
      maxVUs: Number(__ENV.MAX_VUS || 20),
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<300"],
    checks: ["rate>0.99"],
  },
};

export function setup() {
  return { recruiters: tokenPool("RECRUITER", 8), assetId: __ENV.ASSET_ID || "missing-asset" };
}

export default function (data) {
  const res = http.post(`${baseUrl()}/v1/vault/assets/${data.assetId}/playback`, "{}", {
    headers: jsonHeaders(pick(data.recruiters, __ITER)),
    responseCallback: http.expectedStatuses(200, 403),
  });
  const denied = res.status === 403 && res.json("error.code") === "VAULT_DENIED";
  const granted = res.status === 200 && typeof res.json("url") === "string";
  check(res, {
    "playback granted or denied": () => granted || denied,
  });
  sleep(0.05);
}
