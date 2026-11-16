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
      const req = http.get(`http://127.0.0.1:${port}/`, () => {
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
  const port = 4185;
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  const viteProc = spawn(npmCmd, ['run', 'preview', '--', '--port', String(port), '--host', '127.0.0.1'], {
    stdio: 'ignore',
    shell: isWindows
  });

  try {
    console.log(`Waiting for Vite preview on http://127.0.0.1:${port}...`);
    await waitForServer(port);
    await sleep(1500);

    const baseUrl = `http://127.0.0.1:${port}`;

    console.log('Capturing Step 2 Compare Screen (Desktop & Mobile)...');
    await takeScreenshot(
      `${baseUrl}/compare`,
      path.join(ARTIFACT_DIR, 'resubmission-step2-compare-desktop.png'),
      1280,
      2200
    );
    await takeScreenshot(
      `${baseUrl}/compare`,
      path.join(ARTIFACT_DIR, 'resubmission-step2-compare-mobile-360px.png'),
      360,
      3000
    );

    console.log('Capturing Step 3 Schedule Screen (Desktop & Mobile)...');
    await takeScreenshot(
      `${baseUrl}/schedule/mysuru`,
      path.join(ARTIFACT_DIR, 'resubmission-step3-schedule-desktop.png'),
      1280,
      2400
    );
    await takeScreenshot(
      `${baseUrl}/schedule/mysuru`,
      path.join(ARTIFACT_DIR, 'resubmission-step3-schedule-mobile-360px.png'),
      360,
      3200
    );

    console.log('Capturing Step 4 Review Screen (Desktop & Mobile)...');
    await takeScreenshot(
      `${baseUrl}/review/mysuru`,
      path.join(ARTIFACT_DIR, 'resubmission-step4-review-desktop.png'),
      1280,
      2200
    );
    await takeScreenshot(
      `${baseUrl}/review/mysuru`,
      path.join(ARTIFACT_DIR, 'resubmission-step4-review-mobile-360px.png'),
      360,
      3000
    );

    console.log('All screenshots captured successfully!');
  } finally {
    if (isWindows) {
      spawn('taskkill', ['/pid', String(viteProc.pid), '/f', '/t']);
    } else {
      viteProc.kill('SIGTERM');
    }
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
