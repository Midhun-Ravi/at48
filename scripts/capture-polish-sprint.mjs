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
    proc.on('error', reject);
  });
}

async function run() {
  const port = 4188;
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  const viteProc = spawn(npmCmd, ['run', 'preview', '--', '--port', String(port), '--host', '127.0.0.1'], {
    stdio: 'ignore',
    shell: isWindows
  });

  try {
    console.log(`Waiting for Vite preview on http://127.0.0.1:${port}...`);
    await waitForServer(port);
    await sleep(2000);

    const baseUrl = `http://127.0.0.1:${port}/prototype/v2`;

    // 1. Page 2: Destination Selection Desktop
    await takeScreenshot(
      `${baseUrl}?step=1`,
      path.join(ARTIFACT_DIR, 'polish-page2-desktop.png'),
      1280,
      1200
    );

    // 2. Page 2: Destination Selection Mobile
    await takeScreenshot(
      `${baseUrl}?step=1&view=mobile`,
      path.join(ARTIFACT_DIR, 'polish-page2-mobile-375px.png'),
      375,
      1300
    );

    // 3. Page 3: Connected Trip Workspace Desktop
    await takeScreenshot(
      `${baseUrl}?step=2`,
      path.join(ARTIFACT_DIR, 'polish-page3-desktop.png'),
      1280,
      1050
    );

    // 4. Page 3: Mobile Bottom Sheet Itinerary & Map
    await takeScreenshot(
      `${baseUrl}?step=2&view=mobile`,
      path.join(ARTIFACT_DIR, 'polish-page3-mobile-375px.png'),
      375,
      812
    );

    // 5. Add Place / Discover Places Panel
    await takeScreenshot(
      `${baseUrl}?step=2&tab=discover`,
      path.join(ARTIFACT_DIR, 'polish-add-place.png'),
      1280,
      1050
    );

    // 6. Edit Visit: Traveler-Controlled Visit Scheduling Editor Modal
    await takeScreenshot(
      `${baseUrl}?step=2&modal=visit`,
      path.join(ARTIFACT_DIR, 'polish-edit-visit.png'),
      1280,
      950
    );

    // 7. Make This Trip Fit: Move Activity Between Days Modal
    await takeScreenshot(
      `${baseUrl}?step=2&modal=move`,
      path.join(ARTIFACT_DIR, 'polish-make-fit.png'),
      1280,
      950
    );

    console.log('Successfully captured all 7 Polish Sprint screenshots!');
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
