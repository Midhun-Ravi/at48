import { spawn } from 'child_process';
import http from 'http';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/midhu/.gemini/antigravity/brain/c19d0fde-d6ce-40e0-a691-d07fcd0bcdbc';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForServer(port, retries = 30) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        resolve();
      });
      req.on('error', (err) => {
        count++;
        if (count > retries) {
          reject(new Error(`Server did not start after ${retries} attempts: ${err.message}`));
        } else {
          setTimeout(check, 300);
        }
      });
    };
    check();
  });
}

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
  console.log('Starting preview server on port 4173...');
  const preview = spawn('npm.cmd', ['run', 'preview', '--', '--port', '4173', '--host', '127.0.0.1'], {
    shell: true,
    stdio: 'inherit'
  });

  try {
    await waitForServer(4173);
    console.log('Server is ready! Waiting 1s for assets...');
    await sleep(1000);

    // 1. Homepage Desktop & Mobile
    await takeScreenshot(
      'http://127.0.0.1:4173/',
      path.join(ARTIFACT_DIR, 'gate-a-homepage-desktop.png'),
      1280,
      1800
    );
    await takeScreenshot(
      'http://127.0.0.1:4173/',
      path.join(ARTIFACT_DIR, 'gate-a-homepage-mobile-360px.png'),
      360,
      2400
    );

    // 2. Step 1: When are we hitting the road? (/plan)
    await takeScreenshot(
      'http://127.0.0.1:4173/plan',
      path.join(ARTIFACT_DIR, 'gate-a-step1-plan-desktop.png'),
      1280,
      1400
    );
    await takeScreenshot(
      'http://127.0.0.1:4173/plan',
      path.join(ARTIFACT_DIR, 'gate-a-step1-plan-mobile-360px.png'),
      360,
      1800
    );

    // 3. Step 2: Where should we escape to? (/compare)
    await takeScreenshot(
      'http://127.0.0.1:4173/compare',
      path.join(ARTIFACT_DIR, 'gate-a-step2-compare-desktop.png'),
      1280,
      1600
    );
    await takeScreenshot(
      'http://127.0.0.1:4173/compare',
      path.join(ARTIFACT_DIR, 'gate-a-step2-compare-mobile-360px.png'),
      360,
      2600
    );

    // 4. Step 3: What should we explore along the way? (/schedule/mysuru)
    const scheduleUrl = 'http://127.0.0.1:4173/schedule/mysuru?org=Sujil+Kumar&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=6000&adj=30&party=4&stops=maddur-tiffanys';
    await takeScreenshot(
      scheduleUrl,
      path.join(ARTIFACT_DIR, 'gate-a-step3-schedule-desktop.png'),
      1280,
      2200
    );
    await takeScreenshot(
      scheduleUrl,
      path.join(ARTIFACT_DIR, 'gate-a-step3-schedule-mobile-360px.png'),
      360,
      3000
    );

    // 5. Step 4: Ready to hit the road? (/review/mysuru)
    const reviewUrl = 'http://127.0.0.1:4173/review/mysuru?org=Sujil+Kumar&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=6000&adj=30&party=4&stops=maddur-tiffanys';
    await takeScreenshot(
      reviewUrl,
      path.join(ARTIFACT_DIR, 'gate-a-step4-review-desktop.png'),
      1280,
      2600
    );
    await takeScreenshot(
      reviewUrl,
      path.join(ARTIFACT_DIR, 'gate-a-step4-review-mobile-360px.png'),
      360,
      3200
    );

    console.log('All Gate A screenshots captured successfully!');
  } finally {
    console.log('Stopping preview server...');
    preview.kill('SIGTERM');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
