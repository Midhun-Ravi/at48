import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/midhu/.gemini/antigravity/brain/c19d0fde-d6ce-40e0-a691-d07fcd0bcdbc';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function takeScreenshot(url, outputPath, width = 1280, height = 900, timeBudget = 4000) {
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
  console.log('Capturing verified production screenshots from https://at48.vercel.app ...');

  // 1. Live Screen 1
  await takeScreenshot(
    'https://at48.vercel.app/',
    path.join(ARTIFACT_DIR, 'production-live-screen1.png'),
    1280,
    900
  );

  // 2. Live Screen 2 (Compare with all 4 photos)
  await takeScreenshot(
    'https://at48.vercel.app/compare',
    path.join(ARTIFACT_DIR, 'production-live-screen2.png'),
    1280,
    1400
  );

  // 3. Live Screen 3 (Schedule with map, pitstop thumbnail, review button)
  const scheduleUrl = 'https://at48.vercel.app/schedule/mysuru?org=Sujil&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=6000&adj=30&delay=0&stops=maddur-tiffanys';
  await takeScreenshot(
    scheduleUrl,
    path.join(ARTIFACT_DIR, 'production-live-screen3.png'),
    1280,
    2200,
    5000
  );

  // 4. Live Screen 4 (Review & Share screen full height)
  const reviewUrl = 'https://at48.vercel.app/review/mysuru?org=Sujil&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=6000&adj=30&delay=0&stops=maddur-tiffanys';
  await takeScreenshot(
    reviewUrl,
    path.join(ARTIFACT_DIR, 'production-live-screen4.png'),
    1280,
    2400
  );

  // 5. Live Screen 4 Mobile 360px viewport
  await takeScreenshot(
    reviewUrl,
    path.join(ARTIFACT_DIR, 'production-live-screen4-mobile-360px.png'),
    360,
    2600
  );

  // 6. Direct guest invitation link on production (Incognito/fresh test)
  await takeScreenshot(
    'https://at48.vercel.app/schedule/coorg-madikeri?org=Atlas&mode=group&dep=2026-10-31T07:00&ret=2026-11-01T21:00&pace=relaxed&budget=8000',
    path.join(ARTIFACT_DIR, 'production-live-guest-invitation.png'),
    1280,
    1400
  );

  console.log('All live production screenshots captured successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
