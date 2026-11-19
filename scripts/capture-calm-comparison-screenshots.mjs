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
          setTimeout(check, 300);
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
  const port = 4197;
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  const viteProc = spawn(npmCmd, ['run', 'preview', '--', '--port', String(port), '--host', '127.0.0.1'], {
    stdio: 'ignore',
    shell: isWindows,
  });

  try {
    console.log(`Waiting for Vite preview on http://127.0.0.1:${port}...`);
    await waitForServer(port);
    await sleep(2000);

    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Compare Desktop (1280px) - Calm Default View
    await takeScreenshot(
      `${baseUrl}/compare`,
      path.join(ARTIFACT_DIR, 'compare-calm-after-desktop-1280px.png'),
      1280,
      1350,
      false
    );

    // 2. Compare Mobile (375px) - Calm Default View
    await takeScreenshot(
      `${baseUrl}/compare`,
      path.join(ARTIFACT_DIR, 'compare-calm-after-mobile-375px.png'),
      375,
      2100,
      true
    );

    // 3. Compare Desktop (1280px) - Details Expanded View
    await takeScreenshot(
      `${baseUrl}/compare?expand=mysuru`,
      path.join(ARTIFACT_DIR, 'compare-calm-expanded-desktop-1280px.png'),
      1280,
      1750,
      false
    );

    console.log('All comparison redesign screenshots captured successfully!');
  } catch (err) {
    console.error('Screenshot error:', err);
    process.exitCode = 1;
  } finally {
    viteProc.kill();
  }
}

run();
