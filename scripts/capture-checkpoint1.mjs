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
      url,
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
    stdio: 'inherit',
  });

  try {
    await waitForServer(4173);
    console.log('Server is ready! Waiting 1s for assets...');
    await sleep(1000);

    // 1. 3-Day Trip: Compare Screen with Duration-Aware Recommendations & Curation Section
    const compare3DayUrl =
      'http://127.0.0.1:4173/compare?dep=2026-10-29T08:00&ret=2026-10-31T20:30&party=4&budget=10000';
    await takeScreenshot(
      compare3DayUrl,
      path.join(ARTIFACT_DIR, 'checkpoint1-3day-step2-compare-desktop.png'),
      1280,
      2000
    );
    await takeScreenshot(
      compare3DayUrl,
      path.join(ARTIFACT_DIR, 'checkpoint1-3day-step2-compare-mobile-360px.png'),
      360,
      3200
    );

    // 2. 3-Day Trip: Schedule Screen (Coorg, 3 Days: Day 1, Day 2, Day 3 tabs; clean ending without duplicate share)
    const schedule3DayUrl =
      'http://127.0.0.1:4173/schedule/coorg-madikeri?org=Sujil&mode=group&dep=2026-10-29T08:00&ret=2026-10-31T20:30&pace=balanced&budget=10000&party=4&stops=maddur-tiffanys';
    await takeScreenshot(
      schedule3DayUrl,
      path.join(ARTIFACT_DIR, 'checkpoint1-3day-step3-schedule-desktop.png'),
      1280,
      2200
    );
    await takeScreenshot(
      schedule3DayUrl,
      path.join(ARTIFACT_DIR, 'checkpoint1-3day-step3-schedule-mobile-360px.png'),
      360,
      3000
    );

    // 3. 3-Day Trip: Review Screen (Coorg, Day 1 to Day 3 review cards, Save My Trip, Invitations)
    const review3DayUrl =
      'http://127.0.0.1:4173/review/coorg-madikeri?org=Sujil&mode=group&dep=2026-10-29T08:00&ret=2026-10-31T20:30&pace=balanced&budget=10000&party=4&stops=maddur-tiffanys';
    await takeScreenshot(
      review3DayUrl,
      path.join(ARTIFACT_DIR, 'checkpoint1-3day-step4-review-desktop.png'),
      1280,
      2800
    );
    await takeScreenshot(
      review3DayUrl,
      path.join(ARTIFACT_DIR, 'checkpoint1-3day-step4-review-mobile-360px.png'),
      360,
      3400
    );

    // 4. 4-Day Trip: Schedule Screen (Ooty, 4 Days: Day 1, Day 2, Day 3, Day 4 dynamic tabs)
    const schedule4DayUrl =
      'http://127.0.0.1:4173/schedule/ooty?org=Sujil&mode=group&dep=2026-10-30T07:00&ret=2026-11-02T20:30&pace=balanced&budget=15000&party=4';
    await takeScreenshot(
      schedule4DayUrl,
      path.join(ARTIFACT_DIR, 'checkpoint1-4day-step3-schedule-desktop.png'),
      1280,
      2200
    );
    await takeScreenshot(
      schedule4DayUrl,
      path.join(ARTIFACT_DIR, 'checkpoint1-4day-step3-schedule-mobile-360px.png'),
      360,
      3000
    );

    // 5. 4-Day Trip: Review Screen (Ooty, 4 Days breakdown, hotel stay 3 nights, Bandipur curfew notice)
    const review4DayUrl =
      'http://127.0.0.1:4173/review/ooty?org=Sujil&mode=group&dep=2026-10-30T07:00&ret=2026-11-02T20:30&pace=balanced&budget=15000&party=4';
    await takeScreenshot(
      review4DayUrl,
      path.join(ARTIFACT_DIR, 'checkpoint1-4day-step4-review-desktop.png'),
      1280,
      3000
    );
    await takeScreenshot(
      review4DayUrl,
      path.join(ARTIFACT_DIR, 'checkpoint1-4day-step4-review-mobile-360px.png'),
      360,
      3600
    );

    console.log('All Checkpoint 1 screenshots captured successfully!');
  } finally {
    console.log('Stopping preview server...');
    preview.kill('SIGTERM');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
