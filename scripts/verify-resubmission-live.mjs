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
    }, 20000);

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
        resolve({ status: res.statusCode, length: data.length, body: data });
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('=== Step 1: Testing Live Production HTTP Endpoints ===');
  const endpoints = [
    'https://at48.vercel.app/',
    'https://at48.vercel.app/plan',
    'https://at48.vercel.app/compare',
    'https://at48.vercel.app/schedule/mysuru',
    'https://at48.vercel.app/review/mysuru',
  ];

  for (const ep of endpoints) {
    const res = await checkEndpoint(ep);
    if (res.status === 200) {
      console.log(`[PASS] ${ep} -> Status ${res.status} (${res.length} bytes)`);
    } else {
      throw new Error(`Endpoint ${ep} failed with status ${res.status}`);
    }
  }

  console.log('\n=== Step 2: Verifying Live Production JS Bundle Content ===');
  const indexHtml = await checkEndpoint('https://at48.vercel.app/');
  const match = indexHtml.body.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!match) throw new Error('Could not find index-*.js in live HTML');
  const jsPath = match[1];
  console.log(`Live bundle found: ${jsPath}`);
  const bundle = await checkEndpoint(`https://at48.vercel.app${jsPath}`);
  console.log(`Live bundle downloaded: ${bundle.length} bytes`);

  const assertions = [
    { label: 'Uses "projected late" copy', pattern: 'projected late' },
    { label: 'Contains "What if the drive takes longer?"', pattern: 'What if the drive takes longer?' },
    { label: 'Contains "Weekend Trip Feasibility"', pattern: 'Weekend Trip Feasibility' },
    { label: 'Contains "Trade-Off Impact of"', pattern: 'Trade-Off Impact of' },
  ];

  for (const a of assertions) {
    const found = bundle.body.includes(a.pattern);
    if (a.not ? !found : found) {
      console.log(`[PASS] Bundle content: ${a.label}`);
    } else {
      throw new Error(`Bundle content failed assertion: ${a.label} (found=${found})`);
    }
  }

  console.log('\n=== Step 3: Capturing Live Production Screenshots from https://at48.vercel.app ===');

  // Compare desktop & mobile
  await takeScreenshot(
    'https://at48.vercel.app/compare',
    path.join(ARTIFACT_DIR, 'production-live-compare-desktop.png'),
    1280,
    2200
  );
  await takeScreenshot(
    'https://at48.vercel.app/compare',
    path.join(ARTIFACT_DIR, 'production-live-compare-mobile-360px.png'),
    360,
    3000
  );

  // Schedule Mysuru desktop
  await takeScreenshot(
    'https://at48.vercel.app/schedule/mysuru?v=1&dep=2026-10-31T08:00&ret=2026-11-01T20:30&party=2&budget=6000',
    path.join(ARTIFACT_DIR, 'production-live-schedule-desktop.png'),
    1280,
    2200
  );

  // Review Mysuru desktop
  await takeScreenshot(
    'https://at48.vercel.app/review/mysuru?v=1&dep=2026-10-31T08:00&ret=2026-11-01T20:30&party=2&budget=6000',
    path.join(ARTIFACT_DIR, 'production-live-review-desktop.png'),
    1280,
    2200
  );

  console.log('\n=== ALL LIVE PRODUCTION SMOKE TESTS PASSED! ===');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
