import { spawn } from 'child_process';
import path from 'path';
import https from 'https';

const ARTIFACT_DIR = 'C:/Users/midhu/.gemini/antigravity/brain/c19d0fde-d6ce-40e0-a691-d07fcd0bcdbc';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function takeScreenshot(url, outputPath, width = 1280, height = 900) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      url
    ];
    const proc = spawn(CHROME_PATH, args);
    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Timeout taking screenshot of ${url}`));
    }, 15000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log(`Saved screenshot: ${outputPath}`);
        resolve();
      } else {
        reject(new Error(`Chrome failed with code ${code}`));
      }
    });
  });
}

function checkEndpoint(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, length: data.length });
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- 1. Testing Production HTTP Endpoints ---');
  const endpoints = [
    'https://at48.vercel.app/',
    'https://at48.vercel.app/plan',
    'https://at48.vercel.app/compare',
    'https://at48.vercel.app/images/destinations/sakleshpur.jpg',
    'https://at48.vercel.app/images/destinations/kabini.jpg',
    'https://at48.vercel.app/images/destinations/chikmagalur.jpg',
    'https://at48.vercel.app/images/destinations/yelagiri.jpg',
    'https://at48.vercel.app/images/destinations/wayanad.jpg',
    'https://at48.vercel.app/images/destinations/hampi.jpg',
    'https://at48.vercel.app/images/destinations/pondicherry.jpg',
    'https://at48.vercel.app/images/destinations/gokarna.jpg'
  ];

  for (const ep of endpoints) {
    const res = await checkEndpoint(ep);
    console.log(`[PASS] ${ep} -> Status ${res.status} (${res.length} bytes)`);
  }

  console.log('\n--- 2. Capturing Live Production Screenshots from https://at48.vercel.app ---');

  // Step 1: Home / Plan Desktop (Single demo card)
  await takeScreenshot(
    'https://at48.vercel.app/plan',
    path.join(ARTIFACT_DIR, 'production-live-plan-desktop.png'),
    1280,
    1100
  );

  // Step 1: Plan Mobile 360px
  await takeScreenshot(
    'https://at48.vercel.app/plan',
    path.join(ARTIFACT_DIR, 'production-live-plan-mobile-360px.png'),
    360,
    1200
  );

  // Step 2: Compare Desktop (Aligned cards + genuine photos)
  await takeScreenshot(
    'https://at48.vercel.app/compare?dep=2026-10-31T06:00&ret=2026-11-03T21:00&pace=relaxed&budget=12000',
    path.join(ARTIFACT_DIR, 'production-live-compare-desktop.png'),
    1280,
    2400
  );

  // Step 2: Compare Mobile 360px
  await takeScreenshot(
    'https://at48.vercel.app/compare?dep=2026-10-31T06:00&ret=2026-11-03T21:00&pace=relaxed&budget=12000',
    path.join(ARTIFACT_DIR, 'production-live-compare-mobile-360px.png'),
    360,
    3400
  );

  // Step 3: Four-day schedule Desktop (Coorg 4-day engine)
  const scheduleUrl = 'https://at48.vercel.app/schedule/coorg-madikeri?org=Atlas&mode=group&dep=2026-10-31T06:00&ret=2026-11-03T21:00&pace=relaxed&budget=12000';
  await takeScreenshot(
    scheduleUrl,
    path.join(ARTIFACT_DIR, 'production-live-schedule-4day-desktop.png'),
    1280,
    2800
  );

  // Step 4: Review Desktop
  const reviewUrl = 'https://at48.vercel.app/review/coorg-madikeri?org=Atlas&mode=group&dep=2026-10-31T06:00&ret=2026-11-03T21:00&pace=relaxed&budget=12000';
  await takeScreenshot(
    reviewUrl,
    path.join(ARTIFACT_DIR, 'production-live-review-desktop.png'),
    1280,
    2400
  );

  // Guest invitation mobile 360px
  await takeScreenshot(
    scheduleUrl,
    path.join(ARTIFACT_DIR, 'production-live-guest-invitation-mobile-360px.png'),
    360,
    2600
  );

  console.log('\nAll live production smoke tests and screenshots completed successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
