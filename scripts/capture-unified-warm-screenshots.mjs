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
          setTimeout(check, 400);
        }
      });
    };
    check();
  });
}

function takeScreenshot(url, outputPath, width = 1280, height = 900, isMobile = false) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
    ];

    if (isMobile) {
      args.push(
        '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        '--force-device-scale-factor=1'
      );
    }

    args.push(url);

    const proc = spawn(CHROME_PATH, args);
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`Saved screenshot: ${outputPath}`);
        resolve();
      } else {
        reject(new Error(`Chrome failed with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

async function run() {
  const port = 4193;
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  const viteProc = spawn(npmCmd, ['run', 'preview', '--', '--port', String(port), '--host', '127.0.0.1'], {
    stdio: 'ignore',
    shell: isWindows,
  });

  try {
    console.log(`Waiting for Vite preview on http://127.0.0.1:${port}...`);
    await waitForServer(port);
    await sleep(2500);

    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Homepage Desktop & Mobile
    await takeScreenshot(
      `${baseUrl}/`,
      path.join(ARTIFACT_DIR, 'unified-home-desktop.png'),
      1280,
      1350,
      false
    );
    await takeScreenshot(
      `${baseUrl}/`,
      path.join(ARTIFACT_DIR, 'unified-home-mobile-375px.png'),
      375,
      1650,
      true
    );

    // 2. Plan Page Desktop & Mobile
    await takeScreenshot(
      `${baseUrl}/plan`,
      path.join(ARTIFACT_DIR, 'unified-plan-desktop.png'),
      1280,
      1550,
      false
    );
    await takeScreenshot(
      `${baseUrl}/plan`,
      path.join(ARTIFACT_DIR, 'unified-plan-mobile-375px.png'),
      375,
      1750,
      true
    );

    // 3. Destination Comparison Desktop & Mobile
    await takeScreenshot(
      `${baseUrl}/compare`,
      path.join(ARTIFACT_DIR, 'unified-compare-desktop.png'),
      1280,
      1600,
      false
    );
    await takeScreenshot(
      `${baseUrl}/compare`,
      path.join(ARTIFACT_DIR, 'unified-compare-mobile-375px.png'),
      375,
      1900,
      true
    );

    // 4. Trip Builder / Schedule Desktop & Mobile
    await takeScreenshot(
      `${baseUrl}/schedule/mysuru`,
      path.join(ARTIFACT_DIR, 'unified-schedule-desktop.png'),
      1280,
      1600,
      false
    );
    await takeScreenshot(
      `${baseUrl}/schedule/mysuru`,
      path.join(ARTIFACT_DIR, 'unified-schedule-mobile-375px.png'),
      375,
      1800,
      true
    );

    // 5. Review & Share Desktop & Mobile
    await takeScreenshot(
      `${baseUrl}/review/mysuru`,
      path.join(ARTIFACT_DIR, 'unified-review-desktop.png'),
      1280,
      1600,
      false
    );
    await takeScreenshot(
      `${baseUrl}/review/mysuru`,
      path.join(ARTIFACT_DIR, 'unified-review-mobile-375px.png'),
      375,
      1900,
      true
    );

    console.log('All Unified Warm Experience screenshots captured successfully!');
  } catch (err) {
    console.error('Screenshot error:', err);
    process.exitCode = 1;
  } finally {
    viteProc.kill();
  }
}

run();
