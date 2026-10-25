import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
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
          setTimeout(check, 400);
        }
      });
    };
    check();
  });
}

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
  console.log('Starting vite preview on port 4173...');
  const preview = spawn('npm.cmd', ['run', 'preview', '--', '--port', '4173', '--host', '127.0.0.1'], {
    shell: true,
    stdio: 'inherit'
  });

  try {
    await waitForServer(4173);
    console.log('Server is ready! Waiting 1s for assets...');
    await sleep(1000);

    // 1. Screen 1 - Positive 18-60h copy
    await takeScreenshot(
      'http://127.0.0.1:4173/',
      path.join(ARTIFACT_DIR, 'ux-sprint-screen1.png'),
      1280,
      900
    );

    // 2. Screen 2 - Compare screen with destination hero photos & independent controls
    // Wait, let's pre-populate localStorage or navigate with realistic query or direct url if needed
    await takeScreenshot(
      'http://127.0.0.1:4173/compare',
      path.join(ARTIFACT_DIR, 'ux-sprint-screen2.png'),
      1280,
      1200
    );

    // 3. Screen 3 - Schedule with place thumbnails and review button
    await takeScreenshot(
      'http://127.0.0.1:4173/schedule/mysuru?org=Sujil&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=6000&adj=30&delay=0&stops=maddur-tiffanys',
      path.join(ARTIFACT_DIR, 'ux-sprint-screen3.png'),
      1280,
      1200
    );

    // 4. Screen 4 - Review & Share screen (desktop full height)
    await takeScreenshot(
      'http://127.0.0.1:4173/review/mysuru?org=Sujil&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=6000&adj=30&delay=0&stops=maddur-tiffanys',
      path.join(ARTIFACT_DIR, 'ux-sprint-screen4-full.png'),
      1280,
      2400
    );

    // 4b. Screen 3 - Schedule screen (full height)
    await takeScreenshot(
      'http://127.0.0.1:4173/schedule/mysuru?org=Sujil&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=6000&adj=30&delay=0&stops=maddur-tiffanys',
      path.join(ARTIFACT_DIR, 'ux-sprint-screen3-full.png'),
      1280,
      2400
    );

    // 5. Screen 4 - Mobile 360px viewport
    await takeScreenshot(
      'http://127.0.0.1:4173/review/mysuru?org=Sujil&mode=group&dep=2026-10-31T08:00&ret=2026-11-01T20:30&pace=balanced&budget=6000&adj=30&delay=0&stops=maddur-tiffanys',
      path.join(ARTIFACT_DIR, 'ux-sprint-screen4-mobile-360px.png'),
      360,
      1400
    );

    // 6. Screen 2 - Mobile 360px viewport
    await takeScreenshot(
      'http://127.0.0.1:4173/compare',
      path.join(ARTIFACT_DIR, 'ux-sprint-screen2-mobile-360px.png'),
      360,
      1400
    );

    console.log('All screenshots captured successfully!');
  } finally {
    console.log('Terminating preview server...');
    preview.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
