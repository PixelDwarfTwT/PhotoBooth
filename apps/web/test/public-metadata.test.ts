import assert from "node:assert/strict";
import test from "node:test";
import { createRobotsPolicy } from "../src/lib/robots-policy.ts";
import { getSharePageMetadata } from "../src/lib/share-metadata.ts";

test("share page metadata stays private without including a share token", async () => {
  const metadata = await getSharePageMetadata();

  assert.deepEqual(metadata.robots, {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  });
  assert.equal(JSON.stringify(metadata).includes("token"), false);
});

test("robots lets crawlers observe private share no-index metadata", () => {
  const policy = createRobotsPolicy("https://photo.example.test");

  assert.deepEqual(policy.rules, {
    userAgent: "*",
    allow: "/",
  });
  assert.equal(policy.sitemap, "https://photo.example.test/sitemap.xml");
});
