import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/midhu/.gemini/antigravity/brain/c19d0fde-d6ce-40e0-a691-d07fcd0bcdbc';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function takeScreenshot(url, outputPath, width = 1280, height = 900, timeBudget = 6000) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--virtual-time-budget=${timeBudget}`,
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      url
    ];
    const proc = spawn(CHROME_PATH, args);
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`Saved screenshot: ${outputPath}`);
        resolve();
      } else {
        reject(new Error(`Chrome failed with code ${code}`));
      }
    });
  });
}

async function run() {
  console.log('Verifying live production at https://at48.vercel.app...');

  // 1. Live Homepage Desktop & Mobile
  await takeScreenshot(
    'https://at48.vercel.app/',
    path.join(ARTIFACT_DIR, 'final-production-homepage-desktop.png'),
    1280,
    1800
  );
  await takeScreenshot(
    'https://at48.vercel.app/',
    path.join(ARTIFACT_DIR, 'final-production-homepage-mobile-360px.png'),
    360,
    2400
  );

  // 2. Live Step 1 (/plan)
  await takeScreenshot(
    'https://at48.vercel.app/plan',
    path.join(ARTIFACT_DIR, 'final-production-step1-plan-desktop.png'),
    1280,
    1400
  );

  // 3. Live Step 2 (/compare)
  await takeScreenshot(
    'https://at48.vercel.app/compare',
    path.join(ARTIFACT_DIR, 'final-production-step2-compare-desktop.png'),
    1280,
    1600
  );

  // 4. Live Step 3 (/schedule/mysuru)
  const scheduleUrl = 'https://at48.vercel.app/schedule/mysuru?org=Sujil+Kumar&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=6000&adj=30&party=4&stops=maddur-tiffanys';
  await takeScreenshot(
    scheduleUrl,
    path.join(ARTIFACT_DIR, 'final-production-step3-schedule-desktop.png'),
    1280,
    2200
  );

  // 5. Live Step 4 (/review/mysuru)
  const reviewUrl = 'https://at48.vercel.app/review/mysuru?org=Sujil+Kumar&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=6000&adj=30&party=4&stops=maddur-tiffanys';
  await takeScreenshot(
    reviewUrl,
    path.join(ARTIFACT_DIR, 'final-production-step4-review-desktop.png'),
    1280,
    2600
  );

  console.log('All live production screenshots captured successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
