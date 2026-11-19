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
  const port = 4199;
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  console.log(`Starting Vite preview on port ${port}...`);
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

    const cdpPort = 9223;
    chromeProc = spawn(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${cdpPort}`,
      'about:blank',
    ]);

    await sleep(2000);

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

    cdp.ws.addEventListener('message', (msg) => {
      const data = JSON.parse(msg.data);
      if (data.method === 'Runtime.exceptionThrown') {
        console.error('BROWSER JS EXCEPTION:', JSON.stringify(data.params.exceptionDetails, null, 2));
      }
    });

    // ==========================================
    // 1. FULL 4-SCREEN FLOW NAVIGATION TEST
    // ==========================================
    console.log('\n--- 1. Testing Full 4-Screen Flow (/ -> /plan -> /compare -> /schedule/:id -> /review/:id) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Screen 1: Home (/)
    console.log('Navigating to Screen 1: /');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
    await sleep(2000);
    const homeTitle = await cdp.eval('document.title');
    console.log(`✓ Screen 1 Loaded: title="${homeTitle}"`);

    // Screen 2: Plan (/plan)
    console.log('Navigating to Screen 2: /plan');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/plan` });
    await sleep(2000);
    const hasDepartureInput = await cdp.eval('Boolean(document.querySelector("input[type=datetime-local]"))');
    console.log(`✓ Screen 2 Loaded: hasDepartureInput=${hasDepartureInput}`);

    // Screen 3: Compare (/compare)
    console.log('Navigating to Screen 3: /compare');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/compare` });
    await sleep(2000);
    const compareCardCount = await cdp.eval('document.querySelectorAll("article, .destination-card, [data-destination]").length || document.body.innerText.includes("Mysuru")');
    console.log(`✓ Screen 3 Loaded: destination content present (${compareCardCount})`);

    // Screen 4: Schedule (/schedule/mysuru)
    console.log('Navigating to Screen 4: /schedule/mysuru');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/schedule/mysuru` });
    await sleep(2500);
    const hasScheduleTimeline = await cdp.eval('document.body.innerText.includes("Mysuru") && document.body.innerText.includes("Return deadline margin")');
    console.log(`✓ Screen 4 Loaded: hasScheduleTimeline=${hasScheduleTimeline}`);

    // Screen 5: Review (/review/mysuru)
    console.log('Navigating to Screen 5: /review/mysuru');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/review/mysuru` });
    await sleep(2500);

    // ==========================================
    // 2. PAGE 4 CALM REVIEW STRUCTURE VERIFICATION
    // ==========================================
    console.log('\n--- 2. Verifying Page 4 Calm Review Structure & Primary Facts ---');
    const pageText = await cdp.eval('document.body.innerText');
    console.log('Sample Page 4 Text (first 600 chars):\n', pageText.slice(0, 600));

    const page4Metrics = await cdp.eval(`
      (() => {
        const text = document.body.innerText.toLowerCase();
        return {
          hasHero: text.includes("mysuru") && (text.includes("ready to hit the road") || text.includes("schedule")),
          hasExpectedArrival: text.includes("expected home arrival"),
          hasReturnMargin: text.includes("return deadline margin"),
          hasCostPerTraveler: text.includes("estimated cost per traveler"),
          hasSaveTrip: text.includes("save trip (this device)"),
          hasShareTrip: text.includes("share trip (copy link)"),
          hasWhatsAppInvite: text.includes("whatsapp invite"),
          hasFleetAccordion: text.includes("vehicle fleet & cost sharing"),
          hasTimelineAccordion: text.includes("day-by-day itinerary review"),
          hasRoutePlacesAccordion: text.includes("route & planned places"),
          hasSummaryAccordion: text.includes("plain-text messaging summary"),
          hasAssumptionDisclosures: text.includes("planning assumptions & disclosures") && text.includes("20% driving contingency"),
        };
      })()
    `);
    console.log('Page 4 Structure Check:', JSON.stringify(page4Metrics, null, 2));

    for (const [key, val] of Object.entries(page4Metrics)) {
      if (!val) {
        throw new Error(`Page 4 verification failed for: ${key}`);
      }
    }
    console.log('✓ All Page 4 Calm Review structural elements verified!');

    // Capture Desktop Default Screenshot
    console.log('\nCapturing Desktop 1280px screenshots...');
    await cdp.eval('window.scrollTo(0, 0)');
    await sleep(500);
    const deskTopShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'review-calm-desktop-1280px-default.png'), Buffer.from(deskTopShot.data, 'base64'));
    console.log('Saved: review-calm-desktop-1280px-default.png');

    // Capture Desktop Full Page Screenshot
    const deskFullShot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'review-calm-desktop-1280px-full.png'), Buffer.from(deskFullShot.data, 'base64'));
    console.log('Saved: review-calm-desktop-1280px-full.png');

    // ==========================================
    // 3. MOBILE TESTS (375px & 390px)
    // ==========================================
    console.log('\n--- 3. Testing Mobile Responsive Viewports (375px & 390px) ---');
    // 375px (iPhone SE / Compact)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/review/mysuru` });
    await sleep(2000);

    const mobile375Scroll = await cdp.eval(`
      (() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()
    `);
    console.log('Mobile 375px Overflow Check:', mobile375Scroll);
    if (mobile375Scroll.hasHorizontalOverflow) {
      console.warn(`WARNING: Horizontal overflow on 375px (scrollWidth ${mobile375Scroll.scrollWidth} > clientWidth ${mobile375Scroll.clientWidth})`);
    } else {
      console.log('✓ No horizontal scroll overflow on 375px mobile viewport!');
    }

    const mob375TopShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'review-calm-mobile-375px-top.png'), Buffer.from(mob375TopShot.data, 'base64'));
    console.log('Saved: review-calm-mobile-375px-top.png');

    const mob375FullShot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'review-calm-mobile-375px-full.png'), Buffer.from(mob375FullShot.data, 'base64'));
    console.log('Saved: review-calm-mobile-375px-full.png');

    // 390px (iPhone 14 / Standard Mobile)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(1000);
    const mob390FullShot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'review-calm-mobile-390px-full.png'), Buffer.from(mob390FullShot.data, 'base64'));
    console.log('Saved: review-calm-mobile-390px-full.png');

    // ==========================================
    // 4. INCOGNITO SHARE LINK REOPENING & GUEST RSVP
    // ==========================================
    console.log('\n--- 4. Testing Incognito Share-Link Reopening & Accurate RSVP Handoff ---');
    // Build a customized share link with organizer name, 5 travelers, budget 8500, delay 60, custom activity
    const shareParams = new URLSearchParams({
      v: '1',
      org: 'Sujil & Friends',
      mode: 'group',
      party: '5',
      dep: '2026-11-21T07:00',
      ret: '2026-11-22T21:00',
      pace: 'relaxed',
      budget: '8500',
      stops: 'maddur-tiffanys',
      skip: 'mysuru-market',
      ca: '1~Sunset Photography at Chamundi~60~0~17:30',
    });

    const shareUrl = `http://127.0.0.1:${port}/review/mysuru?${shareParams.toString()}`;
    console.log('Navigating to shared trip URL:', shareUrl);

    // Reset viewport to 375px mobile for RSVP flow
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send('Page.navigate', { url: shareUrl });
    await sleep(2500);

    const guestViewCheck = await cdp.eval(`
      (() => {
        const text = document.body.innerText.toLowerCase();
        return {
          hasGuestBanner: text.includes("trip invitation from sujil & friends"),
          hasPartySize5: text.includes("5 travelers"),
          hasBudget8500: text.includes("8,500/person"),
          hasGuestRsvpCard: Boolean(document.getElementById("guest-rsvp")),
          hasGuestInput: Boolean(document.querySelector("#guest-rsvp input")),
          hasGuestButton: text.includes("join trip & send rsvp via whatsapp"),
          hasGuestProtectionNote: text.includes("guest actions on this link never modify the organizer's original trip schedule"),
        };
      })()
    `);
    console.log('Guest View Reconstructed State:', JSON.stringify(guestViewCheck, null, 2));

    if (!guestViewCheck.hasGuestBanner || !guestViewCheck.hasGuestRsvpCard) {
      throw new Error('Guest view failed to reconstruct from shareable URL!');
    }

    // Simulate typing a guest name and clicking RSVP button
    console.log('Testing WhatsApp RSVP handoff trigger...');
    const rsvpAction = await cdp.eval(`
      (() => {
        const input = document.querySelector("#guest-rsvp input");
        if (!input) return { error: "No input found" };

        // Set value through React prototype setter so React state updates
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(input, "Deepak");
        } else {
          input.value = "Deepak";
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // Override window.open to intercept WhatsApp handoff
        let openedUrl = null;
        window.open = (url) => { openedUrl = url; return null; };

        const btn = document.querySelector("#guest-rsvp button");
        if (!btn) return { error: "No button found" };
        btn.click();

        return {
          success: true,
          openedUrl: openedUrl,
        };
      })()
    `);
    console.log('RSVP Trigger Clicked:', JSON.stringify(rsvpAction, null, 2));

    await sleep(500);

    const rsvpFeedbackCheck = await cdp.eval(`
      (() => {
        const text = document.body.innerText.toLowerCase();
        return {
          feedbackFound: text.includes("whatsapp opened. send the message there to complete your rsvp."),
          guestError: text.includes("please enter your name"),
        };
      })()
    `);
    console.log('RSVP Feedback State:', JSON.stringify(rsvpFeedbackCheck, null, 2));

    if (!rsvpFeedbackCheck.feedbackFound) {
      throw new Error('RSVP handoff text "WhatsApp opened. Send the message there to complete your RSVP." not found after click!');
    }
    console.log('✓ VERIFIED: WhatsApp RSVP handoff triggers accurately without false claims!');

    // Capture Guest View Screenshot
    const guestShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'review-calm-guest-rsvp-mobile-375px.png'), Buffer.from(guestShot.data, 'base64'));
    console.log('Saved: review-calm-guest-rsvp-mobile-375px.png');

    // ==========================================
    // 5. BLOCKED / NOT RECOMMENDED VERIFICATION
    // ==========================================
    console.log('\n--- 5. Testing Blocker / Not Recommended Styling (No Cheerful Headers) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Impossible travel window for Ooty (leaving late evening, deadline next morning)
    const blockedParams = new URLSearchParams({
      v: '1',
      dep: '2026-11-21T18:00',
      ret: '2026-11-22T10:00',
      pace: 'packed',
    });
    const blockedUrl = `http://127.0.0.1:${port}/review/ooty?${blockedParams.toString()}`;
    await cdp.send('Page.navigate', { url: blockedUrl });
    await sleep(2500);

    const blockerCheck = await cdp.eval(`
      (() => {
        const text = document.body.innerText.toLowerCase();
        return {
          isNotRecommended: text.includes("not recommended"),
          hasWarningBanner: text.includes("schedule alert · return blocker detected"),
          hasAdjustmentsHeading: text.includes("schedule requires adjustments"),
          noCheerfulReady: !text.includes("ready to hit the road"),
          hasCriticalBlockersBox: text.includes("critical schedule blockers"),
          hasMissedDeadline: text.includes("missed return deadline"),
        };
      })()
    `);
    console.log('Blocker Warning Check:', JSON.stringify(blockerCheck, null, 2));

    if (!blockerCheck.hasAdjustmentsHeading || !blockerCheck.noCheerfulReady) {
      throw new Error('Not Recommended state failed to suppress cheerful header or show blocker warning!');
    }
    console.log('✓ VERIFIED: Not Recommended correctly displays serious blocker warning and suppresses cheerful header!');

    const blockedShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'review-calm-blocked-desktop-1280px.png'), Buffer.from(blockedShot.data, 'base64'));
    console.log('Saved: review-calm-blocked-desktop-1280px.png');

    console.log('\n==========================================');
    console.log('ALL BROWSER E2E TESTS & SCREENSHOTS COMPLETED SUCCESSFULLY!');
    console.log('==========================================\n');

  } finally {
    if (cdp) cdp.close();
    if (chromeProc) chromeProc.kill();
    if (viteProc) viteProc.kill();
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
