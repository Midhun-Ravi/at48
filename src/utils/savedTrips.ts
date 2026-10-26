export interface SavedTrip {
  id: string;
  destinationId: string;
  destinationName: string;
  routeName: string;
  departureDateTime: string;
  returnDeadlineDateTime: string;
  pace: string;
  partySize: number;
  perPersonBudgetINR: number;
  planningMode?: 'solo' | 'group';
  organizerName?: string;
  shareUrl: string;
  savedAt: string; // ISO string
}

const STORAGE_KEY = 'at48_saved_trips';

export function getSavedTrips(): SavedTrip[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (e) {
    console.error('Failed to read saved trips from localStorage', e);
    return [];
  }
}

export function saveTrip(trip: Omit<SavedTrip, 'id' | 'savedAt'>): SavedTrip {
  const existing = getSavedTrips();
  const newTrip: SavedTrip = {
    ...trip,
    id: `trip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };

  try {
    // Avoid exact duplicate URLs
    const filtered = existing.filter(t => t.shareUrl !== trip.shareUrl);
    const updated = [newTrip, ...filtered].slice(0, 20); // Keep latest 20 trips
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to persist trip to localStorage', e);
  }

  return newTrip;
}

export function deleteSavedTrip(id: string): SavedTrip[] {
  const existing = getSavedTrips();
  const updated = existing.filter(t => t.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete saved trip from localStorage', e);
  }
  return updated;
}
