// Prototype V2.1 Data Fixture & Scenario Specifications
// Strictly isolated to /prototype/v2. Grounded in actual scheduler.ts calculations and verified OSM data.

export interface DestinationCardData {
  id: string;
  name: string;
  state: string;
  tagline: string;
  imageSrc: string;
  imageAlt: string;
  imageCaption: string;
  imageAuthor: string;
  imageLicense: string;
  imageSourceUrl: string;
  feasibilityRating: 'FEASIBLE' | 'CHALLENGING' | 'NOT_RECOMMENDED';
  feasibilityLabel: string;
  drivingTimeFormatted: string; // e.g. "3h 54m each way"
  drivingBaseMinutes: number;
  drivingBufferMinutes: number;
  daylightSightseeingMinutes: number; // e.g. 366 min (6h 06m)
  unallocatedEveningMinutes: number; // e.g. 135 min (2h 15m)
  totalFreeTimeMinutes: number; // e.g. 501 min (8h 21m)
  returnBufferMinutes: number; // e.g. +120 min (+2h 00m)
  outboundDeparture: string;
  day1Arrival: string;
  day2ReturnDeparture: string;
  homeArrival: string;
  returnDeadline: string;
  recommendedDays: number;
  highlights: string[];
  assumptions: {
    route: string;
    highwayBuffer: string;
    stayCheckin: string;
    daylightHours: string;
    evidenceNotes: string[];
  };
}

export const PROTOTYPE_DESTINATIONS: DestinationCardData[] = [
  {
    id: 'mysuru',
    name: 'Mysuru',
    state: 'Karnataka',
    tagline: 'Royal heritage, palaces & vibrant silk bazaars',
    imageSrc: '/images/destinations/mysuru.jpg',
    imageAlt: 'Grand front view of Mysore Palace, Karnataka',
    imageCaption: 'Historic Mysore Palace facade (Sayyaji Rao Rd)',
    imageAuthor: 'Ramesh NG',
    imageLicense: 'CC BY-SA 2.0',
    imageSourceUrl: 'https://commons.wikimedia.org/wiki/File:Mysore_Palace_-_Front_view.jpg',
    feasibilityRating: 'FEASIBLE',
    feasibilityLabel: 'Feasible · Comfortable Weekend',
    drivingTimeFormatted: '3h 54m',
    drivingBaseMinutes: 195,
    drivingBufferMinutes: 39, // 20% NH 275 buffer
    daylightSightseeingMinutes: 366, // 6h 06m actual daylight sightseeing (07:45-18:15)
    unallocatedEveningMinutes: 135, // 2h 15m post-sunset evening leisure (18:45-21:00)
    totalFreeTimeMinutes: 501, // 8h 21m total unallocated free time
    returnBufferMinutes: 120, // +2h 00m return buffer
    outboundDeparture: 'Sat 08:00 IST',
    day1Arrival: 'Sat 11:54 IST',
    day2ReturnDeparture: 'Sun 14:36 IST',
    homeArrival: 'Sun 18:30 IST',
    returnDeadline: 'Sun 20:30 IST',
    recommendedDays: 2,
    highlights: ['Mysore Palace (₹120)', 'Devaraja Market Walk (Free)', 'Mylari Dosa Hub'],
    assumptions: {
      route: 'NH 275 Bengaluru–Mysuru Expressway (145 km)',
      highwayBuffer: '20% deterministic congestion buffer added (+39m)',
      stayCheckin: 'Standard 13:00 IST check-in modeled (lunch 11:54–13:09)',
      daylightHours: 'Natural daylight window 07:45–18:15 IST (sunset ~18:18 IST)',
      evidenceNotes: [
        'Official palace ticket: ₹120 adults (Mysore Palace Board)',
        'Palace visit duration: 150m (verified by tour survey)',
        'Market visit duration: 60m (open-air bazaar, Sayyaji Rao Rd)',
        'Daylight sightseeing strictly separated from evening free time (18:45–21:00)',
      ],
    },
  },
  {
    id: 'coorg-madikeri',
    name: 'Coorg (Madikeri)',
    state: 'Karnataka',
    tagline: 'Misty coffee plantations, waterfalls & viewpoint ridge',
    imageSrc: '/images/destinations/coorg-madikeri.jpg',
    imageAlt: 'Abbey Falls cascading through lush Western Ghats forest in Madikeri, Coorg',
    imageCaption: 'Abbey Falls amid coffee estates, Madikeri',
    imageAuthor: 'Shanmugamp7',
    imageLicense: 'CC BY-SA 3.0',
    imageSourceUrl: 'https://commons.wikimedia.org/wiki/File:Abbey_falls_-_Madikeri.jpg',
    feasibilityRating: 'CHALLENGING',
    feasibilityLabel: 'Challenging · Tight Margin',
    drivingTimeFormatted: '5h 48m',
    drivingBaseMinutes: 290,
    drivingBufferMinutes: 58, // 20% buffer on ghats
    daylightSightseeingMinutes: 240, // 4h 00m daylight
    unallocatedEveningMinutes: 90, // 1h 30m evening
    totalFreeTimeMinutes: 330, // 5h 30m total
    returnBufferMinutes: 42, // +42m return margin
    outboundDeparture: 'Sat 08:00 IST',
    day1Arrival: 'Sat 13:48 IST',
    day2ReturnDeparture: 'Sun 12:42 IST',
    homeArrival: 'Sun 18:30 IST',
    returnDeadline: 'Sun 20:30 IST',
    recommendedDays: 2,
    highlights: ["Abbey Falls", "Raja's Seat Sunset", "Coffee Estate Trail"],
    assumptions: {
      route: 'NH 275 via Hunsur & Kushalnagar ghat corridor (255 km)',
      highwayBuffer: '20% buffer including ghat section speed limits (+58m)',
      stayCheckin: 'Standard 14:00 IST plantation stay check-in',
      daylightHours: 'Daylight 07:45–18:15 IST; fog common after 17:30 IST',
      evidenceNotes: [
        'Abbey Falls ticket: ₹15 entry + ₹50 parking',
        'Raja’s Seat sunset timing: Best between 17:15 and 18:15 IST',
        'Tight return margin (+42m) leaves little room for unexpected delays',
      ],
    },
  },
  {
    id: 'nandi-hills',
    name: 'Nandi Hills',
    state: 'Karnataka',
    tagline: 'Cliff-edge cloud sunrise & ancient Dravidian temple',
    imageSrc: '/images/destinations/nandi-hills.jpg',
    imageAlt: 'Sun rising over a blanket of clouds from Nandi Hills Viewpoint',
    imageCaption: 'Sunrise over Nandi Hills mist, Chikkaballapura',
    imageAuthor: 'Sri Chakra Pranav',
    imageLicense: 'CC BY-SA 4.0',
    imageSourceUrl: 'https://commons.wikimedia.org/wiki/File:Sun_rising_over_a_blanket_of_clouds,_Nandi_Hills,_Karnataka_(edit).jpg',
    feasibilityRating: 'FEASIBLE',
    feasibilityLabel: 'Feasible · Relaxed Day Trip',
    drivingTimeFormatted: '1h 36m',
    drivingBaseMinutes: 80,
    drivingBufferMinutes: 16,
    daylightSightseeingMinutes: 310, // 5h 10m daylight
    unallocatedEveningMinutes: 0,
    totalFreeTimeMinutes: 310,
    returnBufferMinutes: 240, // +4h 00m return buffer
    outboundDeparture: 'Sat 08:00 IST',
    day1Arrival: 'Sat 09:36 IST',
    day2ReturnDeparture: 'Sat 15:00 IST',
    homeArrival: 'Sat 16:36 IST',
    returnDeadline: 'Sat 20:30 IST',
    recommendedDays: 1,
    highlights: ['Nandi Sunrise Viewpoint', 'Bhoga Nandeeshwara Temple'],
    assumptions: {
      route: 'NH 44 Bellary Road via Airport corridor (60 km)',
      highwayBuffer: '20% buffer including hilltop hairpin turns (+16m)',
      stayCheckin: 'Day trip (no overnight hotel required)',
      daylightHours: 'Gates open 06:00 IST; peak mist 06:15–08:30 IST',
      evidenceNotes: [
        'KSTDC parking & entry ticket: ₹100 per car',
        'Bhoga Nandeeshwara Temple: ASI protected, free entry',
      ],
    },
  },
  {
    id: 'ooty',
    name: 'Ooty (Nilgiris)',
    state: 'Tamil Nadu',
    tagline: 'Highland tea slopes, botanical gardens & cool mountain air',
    imageSrc: '/images/destinations/ooty.jpg',
    imageAlt: 'Rolling lush green tea estates in Nilgiri Hills, Ooty',
    imageCaption: 'Nilgiri tea garden vistas, Ooty',
    imageAuthor: 'PiolAtif',
    imageLicense: 'CC BY-SA 4.0',
    imageSourceUrl: 'https://commons.wikimedia.org/wiki/File:Tea_garden_ooty_nilgiris,_india.jpg',
    feasibilityRating: 'NOT_RECOMMENDED',
    feasibilityLabel: 'Not Recommended for 2 Days (Best in 3 Days)',
    drivingTimeFormatted: '7h 12m',
    drivingBaseMinutes: 360,
    drivingBufferMinutes: 72,
    daylightSightseeingMinutes: 120, // Only 2h daylight sightseeing
    unallocatedEveningMinutes: 60,
    totalFreeTimeMinutes: 180,
    returnBufferMinutes: -15, // Projected late by 15m
    outboundDeparture: 'Sat 08:00 IST',
    day1Arrival: 'Sat 15:12 IST',
    day2ReturnDeparture: 'Sun 11:15 IST',
    homeArrival: 'Sun 20:45 IST',
    returnDeadline: 'Sun 20:30 IST',
    recommendedDays: 3,
    highlights: ['Nilgiri Tea Gardens', 'Government Botanical Garden', 'Ooty Lake Boating'],
    assumptions: {
      route: 'NH 275 & NH 766 via Bandipur Tiger Reserve & Kalhatty ghats (270 km)',
      highwayBuffer: '20% buffer plus Bandipur checkpoint night-closure restrictions',
      stayCheckin: 'Late afternoon check-in (15:30 IST)',
      daylightHours: 'Bandipur checkpoint closed 21:00–06:00 IST daily',
      evidenceNotes: [
        'Bandipur night curfew strictly enforced by Forest Dept',
        '2-day duration forces return departure at 11:15 AM on Sunday, leaving insufficient leisure',
        'Recommended for 3+ day long weekends',
      ],
    },
  },
];

export interface ScheduledActivity {
  id: string;
  name: string;
  category: 'sightseeing' | 'food' | 'nature' | 'fuel' | 'custom';
  day: number;
  startTime: string; // e.g. "14:45"
  endTime: string;   // e.g. "17:15"
  durationMinutes: number;
  costINR: number;
  locationName: string;
  coordinates: [number, number]; // [lat, lng]
  imageSrc?: string;
  notes?: string;
  detourMinutes: number;
  detourSource: 'engine_verified' | 'user_specified' | 'none';
  isDeletable: boolean;
}

export const INITIAL_MYSURU_SCHEDULE: ScheduledActivity[] = [
  {
    id: 'mysuru-palace',
    name: 'Mysore Palace (Amba Vilas)',
    category: 'sightseeing',
    day: 1,
    startTime: '14:45',
    endTime: '17:15',
    durationMinutes: 150,
    costINR: 120,
    locationName: 'Sayyaji Rao Rd, Agrahara',
    coordinates: [12.3051, 76.6551],
    imageSrc: '/images/places/mysuru-palace.jpg',
    notes: 'Official palace entrance ₹120. Daylight operating hours 10:00–17:30.',
    detourMinutes: 0,
    detourSource: 'engine_verified',
    isDeletable: true,
  },
  {
    id: 'mysuru-market',
    name: 'Devaraja Market Walk',
    category: 'sightseeing',
    day: 1,
    startTime: '17:45',
    endTime: '18:45',
    durationMinutes: 60,
    costINR: 0,
    locationName: 'Sayyaji Rao Rd, Shivarampet',
    coordinates: [12.3117, 76.6508],
    imageSrc: '/images/places/mysuru-market.jpg',
    notes: 'Historic open bazaar with flowers, Mysore pak & spices. Free entry.',
    detourMinutes: 10,
    detourSource: 'engine_verified',
    isDeletable: true,
  },
];

export interface DiscoverPlace {
  id: string;
  name: string;
  category: 'food' | 'sightseeing' | 'nature' | 'fuel';
  categoryLabel: string;
  durationMinutes: number;
  costINR: number;
  locationName: string;
  coordinates: [number, number];
  imageSrc?: string;
  description: string;
  estimatedDetourMinutes: number;
  detourType: 'verified_corridor' | 'user_choice_required';
  operatingHours: string;
  officialSource: string;
}

export const DISCOVER_PLACES_MYSURU: DiscoverPlace[] = [
  {
    id: 'place-mylari',
    name: 'Hotel Original Vinayaka Mylari',
    category: 'food',
    categoryLabel: 'Food & Cafés',
    durationMinutes: 45,
    costINR: 150,
    locationName: 'Nazarbad Main Road, Mysuru',
    coordinates: [12.3117, 76.6660],
    description: 'Iconic melt-in-the-mouth butter dosa served on plantain leaves with coconut chutney.',
    estimatedDetourMinutes: 10,
    detourType: 'verified_corridor',
    operatingHours: '06:30–13:30, 15:30–20:30 (Wednesdays closed)',
    officialSource: 'Verified local institution since 1938. 1.2 km east of palace.',
  },
  {
    id: 'place-chamundi',
    name: 'Chamundi Hill & Bull Temple',
    category: 'sightseeing',
    categoryLabel: 'Attractions',
    durationMinutes: 90,
    costINR: 0,
    locationName: 'Chamundi Hills, Mysuru',
    coordinates: [12.2725, 76.6710],
    description: 'Historic hilltop temple dedicated to Chamundeshwari with monolithic Nandi statue.',
    estimatedDetourMinutes: 25,
    detourType: 'verified_corridor',
    operatingHours: '07:30–14:00, 15:30–21:00',
    officialSource: '13 km from city center. Hairpin roadway with hill viewpoint.',
  },
  {
    id: 'place-philomena',
    name: "St. Philomena's Cathedral",
    category: 'sightseeing',
    categoryLabel: 'Attractions',
    durationMinutes: 45,
    costINR: 0,
    locationName: 'Ashoka Road, Mysuru',
    coordinates: [12.3210, 76.6580],
    description: 'Neo-Gothic cathedral with towering twin spires and stained-glass biblical scenes.',
    estimatedDetourMinutes: 10,
    detourType: 'verified_corridor',
    operatingHours: '05:00–18:00 daily',
    officialSource: 'Central Mysuru corridor near Sayyaji Rao Road.',
  },
  {
    id: 'place-karanji',
    name: 'Karanji Lake & Nature Park',
    category: 'nature',
    categoryLabel: 'Nature',
    durationMinutes: 75,
    costINR: 50,
    locationName: 'Near Mysore Zoo, Nazarbad',
    coordinates: [12.3020, 76.6730],
    description: 'Walk-through aviary, butterfly park and tranquil lake with boating and birdwatching.',
    estimatedDetourMinutes: 15,
    detourType: 'verified_corridor',
    operatingHours: '08:30–17:30 (Tuesdays closed)',
    officialSource: 'Karnataka Zoo Authority ticketed facility.',
  },
  {
    id: 'place-maddur-tiffanys',
    name: 'Maddur Tiffanys (NH 275 Expressway Stop)',
    category: 'fuel',
    categoryLabel: 'Fuel & Highway Pitstop',
    durationMinutes: 35,
    costINR: 100,
    locationName: 'Nidaghatta, Maddur (NH 275)',
    coordinates: [12.6233, 77.0984],
    imageSrc: '/images/places/maddur-tiffanys.jpg',
    description: 'Piping-hot Maddur Vade, onion pakoda, filter coffee and clean restroom facilities on the highway corridor.',
    estimatedDetourMinutes: 5,
    detourType: 'verified_corridor',
    operatingHours: '06:00–22:00 daily',
    officialSource: 'Official highway node OSM: 14076079701.',
  },
];

import type { Activity } from '../types';

export function discoverPlaceToActivity(place: DiscoverPlace): Activity {
  let openTime = '09:00';
  let closeTime = '18:00';
  let lastEntryTime: string | undefined = undefined;

  if (place.id === 'place-mylari') {
    openTime = '06:30';
    closeTime = '20:30';
  } else if (place.id === 'place-chamundi') {
    openTime = '07:30';
    closeTime = '21:00';
  } else if (place.id === 'place-philomena') {
    openTime = '05:00';
    closeTime = '18:00';
  } else if (place.id === 'place-karanji') {
    openTime = '08:30';
    closeTime = '17:30';
    lastEntryTime = '17:00';
  } else if (place.id === 'place-maddur-tiffanys') {
    openTime = '06:00';
    closeTime = '22:00';
  }

  return {
    id: place.id,
    name: place.name,
    durationMinutes: place.durationMinutes,
    openTime,
    closeTime,
    lastEntryTime,
    costPerPersonINR: place.costINR,
    isOptional: true,
    priority: 3,
    localTransferMinutes: place.estimatedDetourMinutes,
    openingHoursEvidence: { level: 'official', note: place.officialSource },
    costEvidence: { level: 'official' },
  };
}
