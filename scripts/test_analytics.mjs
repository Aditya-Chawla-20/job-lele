import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { attribution, classifyDevice, parseEvent } from "../lib/analytics.ts";

test("traffic attribution uses a valid UTM first and never returns raw referrers", () => {
  assert.deepEqual(attribution("?utm_source=Twitter&utm_campaign=AI_Wave", "https://linkedin.com/path", "job-lele.vercel.app"),
    { source: "x", campaign: "ai_wave" });
  assert.deepEqual(attribution("?utm_campaign=a%40b.com", "https://t.co/id?private=value", "job-lele.vercel.app"),
    { source: "x", campaign: "" });
  assert.deepEqual(attribution("", "https://www.linkedin.com.evil.example/in/person", "job-lele.vercel.app"),
    { source: "other", campaign: "" });
  assert.equal(attribution("", "https://job-lele.vercel.app/?token=abc", "job-lele.vercel.app").source, "direct");
});

test("distinguishes mobile, tablet, desktop and missing information", () => {
  assert.equal(classifyDevice("Android Mobile Chrome", null), "mobile");
  assert.equal(classifyDevice("iPad Mobile Safari", "?1"), "tablet");
  assert.equal(classifyDevice("Windows Chrome", "?0"), "desktop");
  assert.equal(classifyDevice(null, null), "unknown");
});

test("only valid events for known public jobs are stored", () => {
  const ids = new Set(["example-job"]);
  const row = { id: randomUUID(), session: randomUUID(), type: "apply_click", job: "example-job", source: "x", campaign: "night" };
  assert.deepEqual(parseEvent({ ...row, referrer: "do-not-keep" }, ids), row);
  assert.equal(parseEvent({ ...row, job: "unknown-job" }, ids), null);
  assert.equal(parseEvent({ ...row, type: "board_view" }, ids), null);
  assert.equal(parseEvent({ ...row, campaign: "person@example.com" }, ids), null);
  assert.equal(parseEvent({ ...row, session: "personal-id" }, ids), null);
  assert.equal(parseEvent({ ...row, type: "board_view", job: null }, ids)?.type, "board_view");
});
