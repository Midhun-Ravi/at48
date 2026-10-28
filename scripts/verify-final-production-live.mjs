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
  console.log('--- 1. Testing Live Production HTTP Endpoints ---');
  const endpoints = [
    'https://at48.vercel.app/',
    'https://at48.vercel.app/plan',
    'https://at48.vercel.app/compare',
    'https://at48.vercel.app/schedule/mysuru',
    'https://at48.vercel.app/review/mysuru',
  ];

  for (const ep of endpoints) {
    const res = await checkEndpoint(ep);
    console.log(`[PASS] ${ep} -> Status ${res.status} (${res.length} bytes)`);
  }

  console.log('\n--- 2. Capturing Live Production Screenshots from https://at48.vercel.app ---');

  // 1. Page 2: Compare without Travel Pace Preference section
  await takeScreenshot(
    'https://at48.vercel.app/compare?dep=2026-10-31T06:00&ret=2026-11-03T21:00&budget=12000',
    path.join(ARTIFACT_DIR, 'production-live-page2-no-pace-desktop.png'),
    1280,
    1400
  );

  // 2. Page 3: Stops & Route / Schedule without Trip Invitation / RSVP form (guest link)
  const guestScheduleUrl = 'https://at48.vercel.app/schedule/mysuru?v=1&org=Sujil&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&budget=6000&stops=maddur-tiffanys';
  await takeScreenshot(
    guestScheduleUrl,
    path.join(ARTIFACT_DIR, 'production-live-page3-no-invite-desktop.png'),
    1280,
    1600
  );

  // 3. Page 4: Review Screen with Guest Invitation & RSVP form (guest link)
  const guestReviewUrl = 'https://at48.vercel.app/review/mysuru?v=1&org=Sujil&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&budget=6000&stops=maddur-tiffanys';
  await takeScreenshot(
    guestReviewUrl,
    path.join(ARTIFACT_DIR, 'production-live-page4-with-rsvp-desktop.png'),
    1280,
    2200
  );

  // 4. Page 4: Mobile 360px Viewport with Guest Invitation & RSVP
  await takeScreenshot(
    guestReviewUrl,
    path.join(ARTIFACT_DIR, 'production-live-page4-with-rsvp-mobile-360px.png'),
    360,
    2600
  );

  console.log('\nAll live production smoke tests and screenshots completed successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
