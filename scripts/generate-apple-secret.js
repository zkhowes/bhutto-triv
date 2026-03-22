#!/usr/bin/env node
/**
 * Generate Apple Sign-In client secret (JWT).
 *
 * Apple client secrets are JWTs signed with your .p8 private key.
 * They expire after max 6 months — re-run this script to regenerate.
 *
 * Prerequisites:
 *   npm install jsonwebtoken
 *
 * Usage:
 *   node scripts/generate-apple-secret.js \
 *     --team-id YOUR_TEAM_ID \
 *     --key-id YOUR_KEY_ID \
 *     --service-id YOUR_SERVICE_ID \
 *     --key-file path/to/AuthKey_XXXX.p8
 *
 * Then set APPLE_SECRET in your .env / Vercel dashboard to the output.
 */

const fs = require("fs");
const jwt = require("jsonwebtoken");

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "").replace(/-/g, "_");
    params[key] = args[i + 1];
  }
  return params;
}

const { team_id, key_id, service_id, key_file } = parseArgs();

if (!team_id || !key_id || !service_id || !key_file) {
  console.error(
    "Usage: node generate-apple-secret.js --team-id X --key-id X --service-id X --key-file X"
  );
  process.exit(1);
}

const privateKey = fs.readFileSync(key_file, "utf8");

const token = jwt.sign({}, privateKey, {
  algorithm: "ES256",
  expiresIn: "180d",
  audience: "https://appleid.apple.com",
  issuer: team_id,
  subject: service_id,
  keyid: key_id,
});

console.log("\nApple client secret (valid for 180 days):\n");
console.log(token);
console.log("\nSet this as APPLE_SECRET in your .env and Vercel dashboard.\n");
