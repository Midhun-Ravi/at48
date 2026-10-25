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

    // 1. New Homepage on Desktop (1280px)
    await takeScreenshot(
      'http://127.0.0.1:4173/',
      path.join(ARTIFACT_DIR, 'feedback-sprint-homepage-desktop.png'),
      1280,
      1800
    );

    // 2. New Homepage on Mobile (360px)
    await takeScreenshot(
      'http://127.0.0.1:4173/',
      path.join(ARTIFACT_DIR, 'feedback-sprint-homepage-mobile-360px.png'),
      360,
      2400
    );

    // 3. Plan Screen (/plan) with space in name and custom budget
    await takeScreenshot(
      'http://127.0.0.1:4173/plan',
      path.join(ARTIFACT_DIR, 'feedback-sprint-plan-screen.png'),
      1280,
      1200
    );

    // 4. Compare Screen (/compare)
    await takeScreenshot(
      'http://127.0.0.1:4173/compare',
      path.join(ARTIFACT_DIR, 'feedback-sprint-compare-screen.png'),
      1280,
      1400
    );

    // 5. Schedule Screen (/schedule/mysuru?org=Sujil+Kumar&mode=group&budget=4500&adj=30&stops=maddur-tiffanys)
    const scheduleUrl = 'http://127.0.0.1:4173/schedule/mysuru?org=Sujil+Kumar&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=4500&adj=30&delay=0&stops=maddur-tiffanys';
    await takeScreenshot(
      scheduleUrl,
      path.join(ARTIFACT_DIR, 'feedback-sprint-schedule-screen.png'),
      1280,
      2200
    );

    // 6. Review Screen (/review/mysuru?org=Sujil+Kumar&mode=group&budget=4500&adj=30&stops=maddur-tiffanys)
    const reviewUrl = 'http://127.0.0.1:4173/review/mysuru?org=Sujil+Kumar&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=4500&adj=30&delay=0&stops=maddur-tiffanys';
    await takeScreenshot(
      reviewUrl,
      path.join(ARTIFACT_DIR, 'feedback-sprint-review-screen.png'),
      1280,
      2600
    );

    // 7. Review Screen Mobile 360px
    await takeScreenshot(
      reviewUrl,
      path.join(ARTIFACT_DIR, 'feedback-sprint-review-mobile-360px.png'),
      360,
      2800
    );

    console.log('All feedback sprint screenshots captured successfully!');
  } finally {
    console.log('Stopping preview server...');
    preview.kill('SIGTERM');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
