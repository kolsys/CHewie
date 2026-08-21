#!/usr/bin/env node
// Builds CHewie (via build-static.mjs) and syncs the result to an S3-compatible
// bucket: deletes whatever currently lives under the target prefix, then
// uploads the fresh build. Replaces the manual "build -> open S3 console ->
// delete old files -> upload new ones" routine.
//
// Credentials and bucket config come from environment variables, normally
// via a git-ignored .env file (see .env.example) — never from the command
// line or repo, so they can't leak into shell history or git history.
//
// Usage:
//   npm run deploy:static -- --base-url=https://your-bucket.example/chewie/
//   # or set DEPLOY_BASE_URL in .env and just:
//   npm run deploy:static
//
// Required env vars (put these in .env, which is git-ignored):
//   DEPLOY_S3_ENDPOINT             e.g. https://s3.<region>.amazonaws.com
//   DEPLOY_S3_REGION               e.g. us-east-1
//   DEPLOY_S3_BUCKET
//   DEPLOY_S3_ACCESS_KEY_ID
//   DEPLOY_S3_SECRET_ACCESS_KEY
//
// Optional env vars:
//   DEPLOY_BASE_URL              same as --base-url, read if the flag is absent
//   DEPLOY_S3_FORCE_PATH_STYLE   default: false (set true for e.g. MinIO)
//
// Options:
//   --base-url=URL   required (or set DEPLOY_BASE_URL). Forwarded to
//                    build-static.mjs; also used to derive the default
//                    upload prefix (its URL path).
//   --prefix=PATH    S3 key prefix to upload under (default: --base-url's path)
//   --out-dir=DIR    build output dir (default: dist), forwarded to build
//   --skip-build     reuse an existing build in --out-dir instead of rebuilding
//   --skip-clean     don't delete existing remote objects under the prefix
//   --dry-run        print planned uploads/deletions, touch nothing remote
//   --yes, -y        skip the confirmation prompt before deleting
//   --dotenv=FILE    path to the env file to load (default: .env)
//                    (named --dotenv, not --env-file, since the latter is a
//                    native Node CLI flag that Node intercepts before this
//                    script ever sees it)
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg === "-y") {
      args.yes = true;
      continue;
    }
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (match) args[match[1]] = match[2] ?? true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const envFile = path.resolve(rootDir, args.dotenv || ".env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const baseUrlRaw = args["base-url"] || process.env.DEPLOY_BASE_URL;
if (!baseUrlRaw) {
  console.error(
    "Missing base URL. Pass --base-url or set DEPLOY_BASE_URL, e.g.:\n" +
      "  npm run deploy:static -- --base-url=https://your-bucket.example/chewie/\n"
  );
  process.exit(1);
}
const baseUrl = baseUrlRaw.endsWith("/") ? baseUrlRaw : `${baseUrlRaw}/`;

const outDir = path.resolve(rootDir, args["out-dir"] || "dist");

function derivePrefix(url) {
  const pathname = new URL(url).pathname.replace(/^\/+/, "");
  if (!pathname) return "";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}
const prefix = args.prefix !== undefined ? String(args.prefix).replace(/^\/+/, "") : derivePrefix(baseUrl);

const bucket = process.env.DEPLOY_S3_BUCKET;
const accessKeyId = process.env.DEPLOY_S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.DEPLOY_S3_SECRET_ACCESS_KEY;
const endpoint = process.env.DEPLOY_S3_ENDPOINT;
const region = process.env.DEPLOY_S3_REGION;
const forcePathStyle = /^true$/i.test(process.env.DEPLOY_S3_FORCE_PATH_STYLE || "");

const missing = [
  !bucket && "DEPLOY_S3_BUCKET",
  !accessKeyId && "DEPLOY_S3_ACCESS_KEY_ID",
  !secretAccessKey && "DEPLOY_S3_SECRET_ACCESS_KEY",
  !endpoint && "DEPLOY_S3_ENDPOINT",
  !region && "DEPLOY_S3_REGION",
].filter(Boolean);
if (missing.length) {
  console.error(
    `Missing required env var(s): ${missing.join(", ")}\n\n` +
      `Set them in ${path.relative(rootDir, envFile)} (git-ignored) — see .env.example.\n`
  );
  process.exit(1);
}

if (!args["skip-build"]) {
  const buildArgs = [path.join(rootDir, "scripts", "build-static.mjs"), `--base-url=${baseUrl}`, `--out-dir=${outDir}`];
  if (args["config-out"]) buildArgs.push(`--config-out=${args["config-out"]}`);
  execFileSync(process.execPath, buildArgs, { cwd: rootDir, stdio: "inherit" });
}

if (!existsSync(outDir)) {
  console.error(`Build output dir not found: ${outDir}`);
  process.exit(1);
}

const configOutPath = path.resolve(rootDir, args["config-out"] || path.join(outDir, "clickhouse-http-default-response.xml"));
const EXCLUDED_FILES = new Set([path.basename(configOutPath)]);

function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, base));
    } else if (!EXCLUDED_FILES.has(path.relative(base, full))) {
      out.push(full);
    }
  }
  return out;
}

const localFiles = walk(outDir);
if (!localFiles.length) {
  console.error(`No uploadable files found in ${outDir} (after excluding ${[...EXCLUDED_FILES].join(", ")})`);
  process.exit(1);
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

function contentTypeFor(file) {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function toKey(file) {
  return prefix + path.relative(outDir, file).split(path.sep).join("/");
}

async function main() {
  const { S3Client, ListObjectsV2Command, DeleteObjectsCommand, PutObjectCommand } = await import(
    "@aws-sdk/client-s3"
  );

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  console.log(`Bucket:   ${bucket}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Prefix:   ${prefix || "(root)"}`);
  console.log(`Files:    ${localFiles.length} to upload from ${path.relative(rootDir, outDir)}\n`);

  if (!args["skip-clean"]) {
    const existingKeys = [];
    let ContinuationToken;
    do {
      const page = await s3.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken })
      );
      for (const obj of page.Contents || []) existingKeys.push(obj.Key);
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);

    if (existingKeys.length) {
      console.log(`${existingKeys.length} existing object(s) under this prefix will be deleted:`);
      for (const key of existingKeys.slice(0, 20)) console.log(`  - ${key}`);
      if (existingKeys.length > 20) console.log(`  ... and ${existingKeys.length - 20} more`);

      if (args["dry-run"]) {
        console.log("\n(dry run, skipping delete)");
      } else {
        if (!args.yes && process.stdin.isTTY) {
          const ok = await confirm(`\nDelete these ${existingKeys.length} object(s) from s3://${bucket}/${prefix}? [y/N] `);
          if (!ok) {
            console.log("Aborted.");
            process.exit(1);
          }
        }
        for (let i = 0; i < existingKeys.length; i += 1000) {
          const batch = existingKeys.slice(i, i + 1000);
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: { Objects: batch.map((Key) => ({ Key })) },
            })
          );
        }
        console.log(`Deleted ${existingKeys.length} object(s).`);
      }
    } else {
      console.log("No existing objects under this prefix.");
    }
  }

  console.log(`\nUploading ${localFiles.length} file(s)...`);
  if (args["dry-run"]) {
    for (const file of localFiles) console.log(`  (dry run) would upload ${toKey(file)}`);
  } else {
    for (const file of localFiles) {
      const key = toKey(file);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: createReadStream(file),
          ContentLength: statSync(file).size,
          ContentType: contentTypeFor(file),
        })
      );
      console.log(`  uploaded ${key}`);
    }
  }

  console.log(`\nDone. Assets served from: ${baseUrl}`);
  if (existsSync(configOutPath)) {
    console.log(`ClickHouse config snippet: ${path.relative(rootDir, configOutPath)}`);
  }
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
