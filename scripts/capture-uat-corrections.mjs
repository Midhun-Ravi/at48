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

    // 1. Coastal Explorer Input Screen (Step 1)
    const planUrl = 'http://127.0.0.1:4173/plan';
    await takeScreenshot(
      planUrl,
      path.join(ARTIFACT_DIR, 'coastal-explorer-step1-plan-desktop.png'),
      1280,
      1200
    );
    await takeScreenshot(
      planUrl,
      path.join(ARTIFACT_DIR, 'coastal-explorer-step1-plan-mobile-360px.png'),
      360,
      1600
    );

    // 2. Coastal Explorer Compare Screen with Gate 2 List Rows (Step 2)
    const compareUrl =
      'http://127.0.0.1:4173/compare?dep=2026-10-24T06:30&ret=2026-10-27T21:30&party=3&budget=8000';
    await takeScreenshot(
      compareUrl,
      path.join(ARTIFACT_DIR, 'coastal-explorer-step2-compare-desktop.png'),
      1280,
      2200
    );
    await takeScreenshot(
      compareUrl,
      path.join(ARTIFACT_DIR, 'coastal-explorer-step2-compare-mobile-360px.png'),
      360,
      3200
    );

    // 3. Coastal Explorer Schedule Screen with Gate 3 Day Tabs, Gate 4 Custom Activity, Gate 5 Map, Gate 6 Pitstops (Step 3)
    const scheduleUrl =
      'http://127.0.0.1:4173/schedule/mysuru?org=Sujil&mode=group&dep=2026-10-24T06:30&ret=2026-10-27T21:30&pace=balanced&budget=8000&party=3&stops=maddur-tiffanys&ca=2~Resort%20Pool%20%26%20Spa%20Relaxation~90~500;3~Sunset%20Coffee%20Walk~60~150';
    await takeScreenshot(
      scheduleUrl,
      path.join(ARTIFACT_DIR, 'coastal-explorer-step3-schedule-desktop.png'),
      1280,
      2600
    );
    await takeScreenshot(
      scheduleUrl,
      path.join(ARTIFACT_DIR, 'coastal-explorer-step3-schedule-mobile-360px.png'),
      360,
      3600
    );

    // 4. Coastal Explorer Review Screen (Step 4)
    const reviewUrl =
      'http://127.0.0.1:4173/review/mysuru?org=Sujil&mode=group&dep=2026-10-24T06:30&ret=2026-10-27T21:30&pace=balanced&budget=8000&party=3&stops=maddur-tiffanys&ca=2~Resort%20Pool%20%26%20Spa%20Relaxation~90~500;3~Sunset%20Coffee%20Walk~60~150';
    await takeScreenshot(
      reviewUrl,
      path.join(ARTIFACT_DIR, 'coastal-explorer-step4-review-desktop.png'),
      1280,
      2400
    );
    await takeScreenshot(
      reviewUrl,
      path.join(ARTIFACT_DIR, 'coastal-explorer-step4-review-mobile-360px.png'),
      360,
      3400
    );

    console.log('All UAT correction screenshots captured successfully!');
  } finally {
    console.log('Terminating preview server...');
    preview.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
