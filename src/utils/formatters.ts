import type { Destination, FeasibilityResult, UserConstraints } from '../types';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format minutes into a human-readable duration (e.g. 135 -> "2h 15m", 45 -> "45m", 120 -> "2h").
 * If signed is true, prefixes positive numbers with "+".
 */
export function formatDuration(minutes: number, signed = false): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return signed ? '+0m' : '0m';

  const abs = Math.abs(rounded);
  const h = Math.floor(abs / 60);
  const m = abs % 60;

  let body = '';
  if (h > 0 && m > 0) body = `${h}h ${m}m`;
  else if (h > 0) body = `${h}h`;
  else body = `${m}m`;

  if (rounded < 0) return `-${body}`;
  if (signed && rounded > 0) return `+${body}`;
  return body;
}

interface ParsedDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: string;
  monthName: string;
}

/**
 * Parses YYYY-MM-DD or YYYY-MM-DDTHH:mm strictly in IST wall-clock.
 * Device timezone independent.
 */
function parseISTString(isoString: string): ParsedDateTime {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(isoString);
  if (!dateMatch) {
    throw new Error(`Invalid IST date/time format: "${isoString}"`);
  }
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = dateMatch[4] !== undefined ? Number(dateMatch[4]) : 0;
  const minute = dateMatch[5] !== undefined ? Number(dateMatch[5]) : 0;

  const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    year,
    month,
    day,
    hour,
    minute,
    dayOfWeek: DAY_NAMES[dayIndex],
    monthName: MONTH_NAMES[month - 1] ?? '',
  };
}

/**
 * Formats YYYY-MM-DDTHH:mm into "Sat, 24 Oct, 08:30 AM" (IST).
 */
export function formatReadableDateTime(isoString: string): string {
  const p = parseISTString(isoString);
  const ampm = p.hour >= 12 ? 'PM' : 'AM';
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const minuteStr = String(p.minute).padStart(2, '0');
  const hourStr = String(hour12).padStart(2, '0');
  return `${p.dayOfWeek}, ${p.day} ${p.monthName}, ${hourStr}:${minuteStr} ${ampm}`;
}

/**
 * Formats YYYY-MM-DD into "Sat, 24 Oct".
 */
export function formatReadableDate(isoString: string): string {
  const p = parseISTString(isoString);
  return `${p.dayOfWeek}, ${p.day} ${p.monthName}`;
}

/**
 * Formats time portion into "08:30 AM".
 */
export function formatTimelineTime(isoString: string): string {
  const p = parseISTString(isoString);
  const ampm = p.hour >= 12 ? 'PM' : 'AM';
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const minuteStr = String(p.minute).padStart(2, '0');
  const hourStr = String(hour12).padStart(2, '0');
  return `${hourStr}:${minuteStr} ${ampm}`;
}

export interface TripSummaryParams {
  destination: Destination;
  inputs: UserConstraints;
  result: FeasibilityResult;
  originUrl?: string;
}

/**
 * Builds a dynamic, accurate WhatsApp and clipboard summary from scheduler outputs.
 * Never uses mock data or static placeholder values.
 */
export function buildTripSummaryText({
  destination,
  inputs,
  result,
  originUrl,
}: TripSummaryParams): string {
  const totalDriveMinutes = result.outboundDriveMinutes + result.inboundDriveMinutes;
  const lines: string[] = [
    `*@48 — The Weekend Reality Checker*`,
    `*Destination:* ${destination.name} (${destination.routeName})`,
    `*Feasibility Verdict:* ${result.rating}`,
    `${result.ratingExplanation}`,
    ``,
    `🗓 *Trip Window (IST):*`,
    `• Departure: ${formatReadableDateTime(inputs.departureDateTime)}`,
    `• Return Deadline: ${formatReadableDateTime(inputs.returnDeadlineDateTime)}`,
    `• Expected Home: ${formatReadableDateTime(result.homeArrivalTime)}`,
    ``,
    `⏱ *Key Metrics:*`,
    `• Usable Destination Free Time: ${formatDuration(result.destinationSlackMinutes)}`,
    `• Return Deadline Margin: ${formatDuration(result.returnDeadlineMarginMinutes, true)}`,
    `• Round-trip Driving: ${formatDuration(totalDriveMinutes)} (contingency included)`,
    `• Travel Pace: ${inputs.pace.toUpperCase()}`,
    ``,
    `💰 *Estimated Budget:*`,
    `• Cost per person: ₹${result.estimatedCostPerPersonINR.toLocaleString('en-IN')}`,
    `• Total estimated for party of ${inputs.partySize}: ₹${result.estimatedTripTotalINR.toLocaleString('en-IN')}`,
    result.isBudgetExceeded ? `⚠️ Note: Estimated cost exceeds declared budget of ₹${inputs.perPersonBudgetINR.toLocaleString('en-IN')}/person.` : `✓ Within declared budget.`,
  ];

  // Optional adjustments
  const adjustments: string[] = [];
  if (inputs.drivingAdjustmentMinutes !== 0) {
    adjustments.push(`Origin drive adjustment: ${formatDuration(inputs.drivingAdjustmentMinutes, true)}`);
  }
  if (inputs.simulateDelayMinutes > 0) {
    adjustments.push(`Simulating +${inputs.simulateDelayMinutes}m outbound delay`);
  }
  if (inputs.disabledActivityIds.length > 0) {
    const disabledNames = destination.activities
      .filter(a => inputs.disabledActivityIds.includes(a.id))
      .map(a => a.name);
    if (disabledNames.length > 0) {
      adjustments.push(`Skipped optional activities: ${disabledNames.join(', ')}`);
    }
  }

  if (adjustments.length > 0) {
    lines.push(``, `⚙️ *Trip Adjustments:*`, ...adjustments.map(a => `• ${a}`));
  }

  // Key Timeline Itinerary
  const day1Items = result.timeline.filter(t => t.day === 1 && t.category !== 'REST');
  const day2Items = result.timeline.filter(t => t.day === 2 && t.category !== 'REST');

  lines.push(``, `📍 *Itinerary Highlights:*`);
  lines.push(`*Day 1:*`);
  for (const item of day1Items) {
    lines.push(`• ${formatTimelineTime(item.startTime)} - ${formatTimelineTime(item.endTime)}: ${item.label}`);
  }
  lines.push(`*Day 2:*`);
  for (const item of day2Items) {
    lines.push(`• ${formatTimelineTime(item.startTime)} - ${formatTimelineTime(item.endTime)}: ${item.label}`);
  }

  // Warnings / Advisories
  if (result.violations.length > 0) {
    lines.push(``, `⚠️ *Advisories & Constraints:*`);
    for (const v of result.violations) {
      lines.push(`• [${v.severity}] ${v.message}`);
    }
  }

  // Disclaimers & Link
  const link = originUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://at48.vercel.app');
  lines.push(
    ``,
    `ℹ️ _Planning estimates only. Verify live route and attraction hours before departing._`,
    `Plan link: ${link}`
  );

  return lines.join('\n');
}

/**
 * Builds standard WhatsApp Web / mobile share link with encoded summary text.
 */
export function buildWhatsAppShareUrl(summaryText: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
}
