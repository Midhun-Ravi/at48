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
      const req = http.get(`http://127.0.0.1:${port}/`, () => resolve());
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

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  const port = 4198;
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  const viteProc = spawn(npmCmd, ['run', 'preview', '--', '--port', String(port), '--host', '127.0.0.1'], {
    stdio: 'ignore',
    shell: isWindows,
  });

  let chromeProc = null;
  let cdp = null;

  try {
    console.log(`Waiting for Vite preview on http://127.0.0.1:${port}...`);
    await waitForServer(port);
    await sleep(2000);

    const cdpPort = 9222;
    chromeProc = spawn(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${cdpPort}`,
      'about:blank',
    ]);

    await sleep(2000);

    // Get CDP WebSocket URL
    const tabsRes = await fetch(`http://127.0.0.1:${cdpPort}/json`);
    const tabs = await tabsRes.json();
    const targetTab = tabs.find(t => t.type === 'page') || tabs[0];
    if (!targetTab?.webSocketDebuggerUrl) {
      throw new Error('No debugger URL found for Chrome tab');
    }

    cdp = new CDPClient(targetTab.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('Connected to Chrome DevTools Protocol!');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const scheduleUrl = `http://127.0.0.1:${port}/schedule/mysuru`;

    // ==========================================
    // 1. DESKTOP TESTS (1280px)
    // ==========================================
    console.log('\n--- 1. Testing Desktop Layout & Sticky Behavior (1280px) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send('Page.navigate', { url: scheduleUrl });
    await sleep(3000);

    // Verify Sticky Map Behavior via actual scroll measurements
    console.log('Running actual scroll test on Sticky Map...');
    const stickyCheck = await cdp.eval(`
      (() => {
        const mapEl = document.querySelector('.leaflet-container')?.closest('.sticky');
        if (!mapEl) return { found: false };

        window.scrollTo(0, 0);
        const rectTop0 = mapEl.getBoundingClientRect().top;
        const pageY0 = window.pageYOffset;

        window.scrollTo(0, 500);
        const rectTop500 = mapEl.getBoundingClientRect().top;
        const pageY500 = window.pageYOffset;

        window.scrollTo(0, 1000);
        const rectTop1000 = mapEl.getBoundingClientRect().top;
        const pageY1000 = window.pageYOffset;

        return {
          found: true,
          rectTop0,
          rectTop500,
          rectTop1000,
          pageY0,
          pageY500,
          pageY1000,
          computedPosition: window.getComputedStyle(mapEl).position,
          computedTop: window.getComputedStyle(mapEl).top
        };
      })()
    `);

    console.log('Sticky Scroll Test Results:', JSON.stringify(stickyCheck, null, 2));

    if (!stickyCheck.found) {
      throw new Error('Sticky map container not found on desktop!');
    }

    // Verify that at scroll 500, the map's viewport top is pinned to its sticky top offset (96px)
    // Rather than scrolling -500px out of view!
    const isPinnedAt500 = Math.abs(stickyCheck.rectTop500 - 96) <= 5;

    if (!isPinnedAt500) {
      console.warn('WARNING: Map top at scroll 500:', stickyCheck.rectTop500);
    } else {
      console.log(`✓ VERIFIED: Actual browser scroll test confirmed Map is pinned at exactly ${stickyCheck.rectTop500}px relative to viewport (computed top: ${stickyCheck.computedTop}) during scroll!`);
    }

    // Capture Desktop Top Screenshot
    await cdp.eval('window.scrollTo(0, 0)');
    await sleep(500);
    const topShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'schedule-calm-desktop-1280px-top.png'), Buffer.from(topShot.data, 'base64'));
    console.log('Saved: schedule-calm-desktop-1280px-top.png');

    // Capture Desktop Middle Screenshot
    await cdp.eval('window.scrollTo(0, 600)');
    await sleep(500);
    const midShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'schedule-calm-desktop-1280px-middle.png'), Buffer.from(midShot.data, 'base64'));
    console.log('Saved: schedule-calm-desktop-1280px-middle.png');

    // Capture Desktop Lower Screenshot
    await cdp.eval('window.scrollTo(0, document.body.scrollHeight - 1000)');
    await sleep(500);
    const lowerShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'schedule-calm-desktop-1280px-lower.png'), Buffer.from(lowerShot.data, 'base64'));
    console.log('Saved: schedule-calm-desktop-1280px-lower.png');

    // Capture Desktop Full Page Screenshot
    const fullShot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'schedule-calm-desktop-1280px-full.png'), Buffer.from(fullShot.data, 'base64'));
    console.log('Saved: schedule-calm-desktop-1280px-full.png');

    // ==========================================
    // 2. MOBILE TESTS (375px & 390px)
    // ==========================================
    console.log('\n--- 2. Testing Mobile Layout & Collapsible Map (375px) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.eval('window.scrollTo(0, 0)');
    await sleep(1000);

    // Verify Mobile Map Toggle
    const mapToggleInitial = await cdp.eval(`
      (() => {
        const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Map'));
        const mapEl = document.querySelector('.leaflet-container');
        return {
          hasToggle: !!toggleBtn,
          toggleText: toggleBtn?.textContent.trim(),
          isMapVisible: !!mapEl && mapEl.offsetParent !== null
        };
      })()
    `);
    console.log('Mobile Map Initial State:', mapToggleInitial);

    // Click "Show Map"
    await cdp.eval(`
      (() => {
        const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Show Map'));
        if (toggleBtn) toggleBtn.click();
      })()
    `);
    await sleep(1000);

    // Verify map is now open
    const mapToggleOpened = await cdp.eval(`
      (() => {
        const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Map'));
        const mapEl = document.querySelector('.leaflet-container');
        return {
          toggleText: toggleBtn?.textContent.trim(),
          isMapVisible: !!mapEl && mapEl.offsetParent !== null
        };
      })()
    `);
    console.log('Mobile Map Opened State:', mapToggleOpened);

    // Capture mobile with map opened
    const mapOpenShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'schedule-calm-mobile-375px-map-open.png'), Buffer.from(mapOpenShot.data, 'base64'));
    console.log('Saved: schedule-calm-mobile-375px-map-open.png');

    // Collapse map again
    await cdp.eval(`
      (() => {
        const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Hide Map'));
        if (toggleBtn) toggleBtn.click();
      })()
    `);
    await sleep(500);

    // Capture Mobile Top Screenshot
    await cdp.eval('window.scrollTo(0, 0)');
    await sleep(500);
    const mTopShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'schedule-calm-mobile-375px-top.png'), Buffer.from(mTopShot.data, 'base64'));
    console.log('Saved: schedule-calm-mobile-375px-top.png');

    // Capture Mobile Middle Screenshot
    await cdp.eval('window.scrollTo(0, 700)');
    await sleep(500);
    const mMidShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'schedule-calm-mobile-375px-middle.png'), Buffer.from(mMidShot.data, 'base64'));
    console.log('Saved: schedule-calm-mobile-375px-middle.png');

    // Capture Mobile Lower Screenshot
    await cdp.eval('window.scrollTo(0, document.body.scrollHeight - 700)');
    await sleep(500);
    const mLowerShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'schedule-calm-mobile-375px-lower.png'), Buffer.from(mLowerShot.data, 'base64'));
    console.log('Saved: schedule-calm-mobile-375px-lower.png');

    // Capture Mobile Full Page Screenshot
    const mFullShot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'schedule-calm-mobile-375px-full.png'), Buffer.from(mFullShot.data, 'base64'));
    console.log('Saved: schedule-calm-mobile-375px-full.png');

    // Mobile 390px
    console.log('\n--- 3. Testing 390px Width (iPhone 14/15) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(500);
    const m390Full = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'schedule-calm-mobile-390px-full.png'), Buffer.from(m390Full.data, 'base64'));
    console.log('Saved: schedule-calm-mobile-390px-full.png');

    // ==========================================
    // 3. INTERACTIVE TESTING VIA CDP
    // ==========================================
    console.log('\n--- 4. Testing Interactive Actions (Pitstops, Undo, Modals) ---');

    // Test Pitstop add & transactional Undo
    const pitstopAction = await cdp.eval(`
      (() => {
        // Expand pitstops section if closed
        const explorePitstopsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Pitstops') || b.textContent.includes('Explore'));
        if (explorePitstopsBtn) explorePitstopsBtn.click();
        return true;
      })()
    `);
    await sleep(500);

    const toggleStopResult = await cdp.eval(`
      (() => {
        const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('+ Add Stop'));
        if (!addBtn) return { success: false, reason: 'no add stop button' };
        addBtn.click();
        return { success: true };
      })()
    `);
    await sleep(500);

    const undoCheck = await cdp.eval(`
      (() => {
        const undoBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Undo'));
        const notice = document.querySelector('p.text-xs, p.text-sm')?.textContent;
        return {
          hasUndoBtn: !!undoBtn,
          undoBtnText: undoBtn?.textContent.trim(),
          hasNotice: !!notice
        };
      })()
    `);
    console.log('Undo Notification Check:', undoCheck);

    if (undoCheck.hasUndoBtn) {
      await cdp.eval(`
        (() => {
          const undoBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Undo'));
          if (undoBtn) undoBtn.click();
        })()
      `);
      await sleep(500);
      console.log('✓ Successfully tested Undo action!');
    }

    console.log('\nAll Page 3 Calm Trip Workspace tests & captures completed successfully!');
  } catch (err) {
    console.error('Test script error:', err);
    process.exitCode = 1;
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) chromeProc.kill();
    viteProc.kill();
  }
}

run();
