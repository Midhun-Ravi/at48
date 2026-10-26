import type { PacePreference } from '../types';

export interface GuideFreeTimeIdea {
  title: string;
  category: 'relaxation' | 'food' | 'culture' | 'scenic' | 'shopping';
  durationMins: number;
  description: string;
}

export interface DestinationGuide {
  destinationId: string;
  destinationName: string;
  durationDays: number;
  pace: PacePreference;
  whyVisit: string;
  idealDuration: string;
  durationFitVerdict: 'ideal' | 'tight' | 'extended';
  durationNote: string;
  topHighlights: string[];
  recommendedOrder: string[];
  whatToPrioritize: string[];
  whatToSkipIfTight: string[];
  freeTimeIdeas: GuideFreeTimeIdea[];
  practicalCautions: string[];
  paceNote: string;
  isSchedulable: boolean;
}

interface DestinationGuideBase {
  id: string;
  name: string;
  whyVisit: string;
  idealDaysMin: number;
  idealDaysMax: number;
  idealDurationText: string;
  allHighlights: string[];
  oneDayMustSees: string[];
  multiDayMustSees: string[];
  skipsIfTight: string[];
  freeTimePool: GuideFreeTimeIdea[];
  cautions: string[];
  isSchedulable: boolean;
}

const DESTINATION_GUIDE_BASES: Record<string, DestinationGuideBase> = {
  'nandi-hills': {
    id: 'nandi-hills',
    name: 'Nandi Hills',
    whyVisit: 'Famous pre-dawn fortress peak just 60 km north of Bengaluru, celebrated for spectacular misty sunrise viewpoints and 9th-century Chola-Dravidian stone heritage.',
    idealDaysMin: 1,
    idealDaysMax: 1,
    idealDurationText: 'Perfect half-day or 1-day trip (18h window). Multi-day stays are generally unnecessary unless paired with vineyard retreats.',
    allHighlights: [
      'Nandi Sunrise Viewpoint & Tipu\'s Drop cliff edge',
      'Bhoga Nandeeshwara Temple (9th-century Chola Dravidian architecture in Nandi village)',
      'Grover Zampa Vineyards tasting tour (Devanahalli foothills)',
      'Muddenahalli Sir M. Visvesvaraya Memorial Museum',
    ],
    oneDayMustSees: ['Sunrise Viewpoint (06:00 arrival)', 'Bhoga Nandeeshwara Temple courtyard'],
    multiDayMustSees: ['Sunrise Viewpoint', 'Bhoga Nandeeshwara Temple', 'Vineyard tasting lunch', 'Devalapura hill trails'],
    skipsIfTight: [
      'Skip weekend hilltop cafes with 45m queues; grab breakfast on the highway instead.',
      'Skip midday hilltop walks when mist clears and sun becomes harsh.',
    ],
    freeTimePool: [
      { title: 'Chamiers & Foothill Cafe Stop', category: 'food', durationMins: 45, description: 'Quick coffee & south Indian breakfast at Nandi Upachar or Indian Paratha Co on Bellary Road.' },
      { title: 'Temple Tank Photography Walk', category: 'culture', durationMins: 45, description: 'Walk around the ancient stepped Kalyani tank of Bhoga Nandeeshwara temple.' },
      { title: 'Vineyard Lawn Stroll', category: 'relaxation', durationMins: 60, description: 'Relax under grape arbor pergolas before the drive back to the city.' },
    ],
    cautions: [
      'Summit gates open at 06:00 IST. Strict weekend vehicle caps apply; arrive before 05:45 to avoid being turned away.',
      'Monkeys along the summit walkway can be aggressive with visible food items.',
    ],
    isSchedulable: true,
  },
  'mysuru': {
    id: 'mysuru',
    name: 'Mysuru',
    whyVisit: 'The cultural capital of Karnataka, boasting royal Wodeyar palaces, fragrant sandalwood, silk bazaars, world-famous Mysore Pak, and quiet tree-lined boulevards.',
    idealDaysMin: 1,
    idealDaysMax: 3,
    idealDurationText: 'Ideal for 2 to 3 calendar days. Schedulable as a packed 1-day dash via the 10-lane expressway, but best enjoyed over 2 or 3 days for relaxed palace and market exploration.',
    allHighlights: [
      'Mysore Palace (Indo-Saracenic royal interior and evening Sunday illumination)',
      'Devaraja Market (century-old bazaar of flowers, spices, and essential oils)',
      'Chamundi Hill & Sri Chamundeshwari Temple (panoramic city overview)',
      'St. Philomena\'s Cathedral (Neo-Gothic twin spires)',
      'Brindavan Gardens & KRS Dam musical fountains',
      'Ranganathittu Bird Sanctuary (boat safari along Kaveri river islets)',
    ],
    oneDayMustSees: ['Mysore Palace royal grounds', 'Devaraja Market heritage walk'],
    multiDayMustSees: ['Mysore Palace', 'Devaraja Market', 'Chamundi Hill monolithic Nandi', 'Ranganathittu boat safari', 'Mylari Dosa breakfast'],
    skipsIfTight: [
      'Skip Brindavan Gardens on tight return schedules; evening musical fountain traffic adds 90m return delay.',
      'Skip Mysore Zoo if time is constrained, as walking the full campus requires at least 3 hours.',
    ],
    freeTimePool: [
      { title: 'Original Mylari Dosa Tasting', category: 'food', durationMins: 45, description: 'Taste butter-soft benne dose and sagu at legendary Vinayaka Mylari in Nazarbad.' },
      { title: 'Guru Sweet Mart Mysore Pak', category: 'shopping', durationMins: 30, description: 'Buy melt-in-mouth ghee Mysore Pak from the ancestral family shop near the market.' },
      { title: 'Karanji Lake Nature Stroll', category: 'scenic', durationMins: 60, description: 'Quiet walk through the walk-through aviary and butterfly park on eastern lake shore.' },
      { title: 'Heritage Tonga Buggy Ride', category: 'culture', durationMins: 45, description: 'Traditional horse carriage ride around the illuminated palace perimeter at dusk.' },
    ],
    cautions: [
      'Palace entry ticket counters close promptly at 17:00 IST; last entry strictly enforced.',
      'Expressway speed cameras actively monitor the 100 km/h limit; two-wheelers and autos are prohibited from the main carriageway.',
    ],
    isSchedulable: true,
  },
  'coorg-madikeri': {
    id: 'coorg-madikeri',
    name: 'Coorg (Madikeri)',
    whyVisit: 'The "Scotland of India"—misty Western Ghats coffee plantations, thundering waterfalls, Tibetan Buddhist golden temples, and spicy Kodava culinary heritage.',
    idealDaysMin: 2,
    idealDaysMax: 4,
    idealDurationText: 'Ideal for 2 to 4 calendar days. A 1-day trip is not recommended due to 6+ hours of one-way winding ghat driving.',
    allHighlights: [
      'Namdroling Golden Temple (Tibetan Buddhist monastery at Bylakuppe)',
      'Abbey Falls (cascading falls nestled within private coffee & spice estates)',
      'Raja\'s Seat (historic sunset pavilion overlooking panoramic Kodagu valleys)',
      'Dubare Elephant Camp (Kaveri riverfront elephant interaction & coracle rides)',
      'Mandalpatti Peak (off-road 4x4 Jeep trail through ridge winds)',
      'Tala Kaveri (sacred birthplace of the Kaveri river atop Brahmagiri hills)',
    ],
    oneDayMustSees: ['Abbey Falls', 'Raja\'s Seat sunset viewpoint'],
    multiDayMustSees: ['Golden Temple Bylakuppe', 'Abbey Falls', 'Raja\'s Seat', 'Dubare Elephant Camp', 'Plantation nature walk'],
    skipsIfTight: [
      'Skip Mandalpatti Jeep trail if you have less than 3 days, as bumpy dirt tracks consume half a day.',
      'Skip Tala Kaveri on a 2-day trip; it requires an additional 90 km round-trip along narrow ghats.',
    ],
    freeTimePool: [
      { title: 'Estate Coffee & Pepper Tasting', category: 'culture', durationMins: 60, description: 'Guided stroll through arabica, robusta, and cardamom plantations with fresh brew tasting.' },
      { title: 'Bylakuppe Tibetan Momos & Thukpa', category: 'food', durationMins: 45, description: 'Authentic Tibetan steamed dumplings and herbal tea outside the Golden Temple camp.' },
      { title: 'Madikeri Market Spices & Homemade Chocolate', category: 'shopping', durationMins: 45, description: 'Browse fresh Kodava black pepper, wild honey, and dark roasted estate coffee beans.' },
      { title: 'Resort Verandah Sunset Reading', category: 'relaxation', durationMins: 90, description: 'Unwind with filter coffee listening to Western Ghats cicadas and birdsong.' },
    ],
    cautions: [
      'Monsoon landslides (July–Sept) can cause unexpected diversions along the Sampaje and Shiradi ghats.',
      'Dubare elephant interactions are strictly morning-only (09:00 to 11:30 IST); arriving after noon misses the elephants.',
    ],
    isSchedulable: true,
  },
  'ooty': {
    id: 'ooty',
    name: 'Ooty (Nilgiris)',
    whyVisit: 'Queen of Hill Stations—crisp mountain air at 2,240m altitude, UNESCO heritage mountain railway, sprawling tea gardens, and Doddabetta pine forests.',
    idealDaysMin: 2,
    idealDaysMax: 4,
    idealDurationText: 'Ideal for 2 to 4 calendar days. Highway passes through Bandipur and Mudumalai tiger reserves, requiring strict daylight transit.',
    allHighlights: [
      'Doddabetta Peak (highest vantage point in the Nilgiris at 2,637m)',
      'Government Botanical Garden (55 acres of terraced exotic flora and fossil trees)',
      'Nilgiri Mountain Railway (Toy Train heritage steam ride from Coonoor to Ooty)',
      'Pykara Lake & Waterfalls (boating amid eucalyptus groves)',
      'Ooty Lake & Boat House',
      'Tea Factory & Museum (orthodox Nilgiri black tea processing)',
    ],
    oneDayMustSees: ['Doddabetta Peak', 'Government Botanical Garden'],
    multiDayMustSees: ['Doddabetta Peak', 'Botanical Garden', 'Toy Train ride', 'Pykara Lake boating', 'Tea estate walk'],
    skipsIfTight: [
      'Skip Ooty Lake boating on weekends; heavy queues and paddle boats offer less scenic value than Pykara Lake.',
      'Skip Pykara Waterfalls if arriving after 16:00, as boat ticket counters shut early.',
    ],
    freeTimePool: [
      { title: 'Nilgiri Tea & Homemade Fudge Tasting', category: 'food', durationMins: 45, description: 'Sample freshly plucked Orange Pekoe tea and Ooty King Star handmade chocolates on Commercial Road.' },
      { title: 'Pine Forest Nature Photography Walk', category: 'scenic', durationMins: 60, description: 'Walk through towering California redwoods and pine tree rows near Shooting Point.' },
      { title: 'Heritage Club Fireplace Downtime', category: 'relaxation', durationMins: 90, description: 'Enjoy tea by a fireplace in a colonial-era hill club or heritage estate bungalow.' },
    ],
    cautions: [
      'CRITICAL: Bandipur/Mudumalai National Park night curfew is strictly enforced from 21:00 to 06:00 IST. Gates slam shut promptly; no exceptions.',
      'Kalhatti Ghat route has 36 steep hairpin bends; downhill transit is frequently restricted to local vehicles—follow Gudalur route if unfamiliar.',
    ],
    isSchedulable: true,
  },
  'kabini': {
    id: 'kabini',
    name: 'Kabini & Nagarhole',
    whyVisit: 'Premier wildlife sanctuary on the banks of the Kabini River, renowned for India\'s highest concentration of leopards, black panthers, wild Asiatic elephants, and birdlife.',
    idealDaysMin: 2,
    idealDaysMax: 3,
    idealDurationText: '2 to 3 days recommended. Safari schedules operate strictly at dawn (06:00) and dusk (15:30).',
    allHighlights: [
      'Nagarhole National Park boat safari along Kabini riverfront',
      'Open-top Gypsy forest safari through teak and bamboo jungle',
      'Kabini Dam backwaters sunset view',
      'Tribal community craft visits and riverside coracle rides',
    ],
    oneDayMustSees: ['Evening Boat Safari on Kabini reservoir'],
    multiDayMustSees: ['Dawn Jeep Safari', 'Evening Boat Safari', 'Backwaters birdwatching walk', 'Riverside campfire'],
    skipsIfTight: ['Skip midday activities; wildlife retreats during the heat, making morning and evening safaris the only productive times.'],
    freeTimePool: [
      { title: 'Riverside Coracle Drift', category: 'scenic', durationMins: 45, description: 'Gentle circular boat drift along calm backwater reeds looking for marsh crocodiles and egrets.' },
      { title: 'Nature Naturalist Briefing', category: 'culture', durationMins: 45, description: 'Interactive wildlife orientation and pugmark identification session with jungle lodge naturalists.' },
    ],
    cautions: [
      'Safari slots must be reserved in advance through Jungle Lodges or Karnataka Forest Department; walk-ins frequently face full capacity.',
      'Forest entry gates close at 18:00 IST.',
    ],
    isSchedulable: false,
  },
  'sakleshpur': {
    id: 'sakleshpur',
    name: 'Sakleshpur',
    whyVisit: 'Lush, uncommercialized Western Ghats retreat known for the star-shaped Manjarabad Fort, Bisle Ghat viewpoint, railway bridge treks, and cardamon plantations.',
    idealDaysMin: 2,
    idealDaysMax: 3,
    idealDurationText: '2 to 3 days recommended. ~4.5h scenic drive along NH 75 via Hassan.',
    allHighlights: [
      'Manjarabad Fort (18th-century French-designed octagonal star fort built by Tipu Sultan)',
      'Bisle Ghat Viewpoint (three mountain ranges: Kumara Parvatha, Pushpagiri, Dodda Betta)',
      'Mookana Mane Waterfalls (hidden forest cascade)',
      'Hemavathi River reservoir at Gorur',
    ],
    oneDayMustSees: ['Manjarabad Star Fort climb', 'Scenic coffee estate drive'],
    multiDayMustSees: ['Manjarabad Fort', 'Bisle Ghat viewpoint', 'Mookana Mane falls', 'Green Route railway trek viewpoint'],
    skipsIfTight: ['Skip Bisle Ghat if weather is heavily overcast with fog, as panoramic valley visibility drops to zero.'],
    freeTimePool: [
      { title: 'Homestay Akki Rotti Meal', category: 'food', durationMins: 60, description: 'Feast on freshly pressed rice rotis with country chicken curry or coconut vegetable stew.' },
      { title: 'Cardamom & Pepper Drying Yard Visit', category: 'culture', durationMins: 45, description: 'Witness harvest drying techniques and breathe fresh aromatic green cardamom.' },
    ],
    cautions: [
      'Manjarabad Fort requires climbing 250+ stone steps with no handrails; avoid midday sun.',
      'Shiradi Ghat road repairs can occasionally cause slow truck queues along NH 75.',
    ],
    isSchedulable: false,
  },
  'chikmagalur': {
    id: 'chikmagalur',
    name: 'Chikmagalur',
    whyVisit: 'Birthplace of Indian coffee, crowned by Mullayanagiri (Karnataka\'s highest peak at 1,930m), Baba Budangiri holy shrine, and misty coffee estates.',
    idealDaysMin: 2,
    idealDaysMax: 4,
    idealDurationText: 'Ideal for 2 to 3 days. Beautiful 5-hour drive through Hassan and Belur.',
    allHighlights: [
      'Mullayanagiri Peak (stunning ridge walk and sunset viewpoint)',
      'Baba Budangiri & Manikyadhara Falls',
      'Hebbe Falls (twin forest waterfalls reached via forest jeep)',
      'Halebidu & Belur Hoysala Temples (exquisite 12th-century stone carvings en route)',
      'Coffee Museum Chikmagalur',
    ],
    oneDayMustSees: ['Mullayanagiri Peak', 'Belur Hoysala Temple en route'],
    multiDayMustSees: ['Mullayanagiri Peak', 'Baba Budangiri', 'Halebidu Temple', 'Hebbe Falls jeep ride', 'Coffee tasting'],
    skipsIfTight: ['Skip Hebbe Falls on short trips; the forest jeep trek and walk takes 4+ hours of transit.'],
    freeTimePool: [
      { title: 'Fresh Estate Peaberry Coffee Tasting', category: 'food', durationMins: 45, description: 'Sip single-origin washed arabica at a town roastery like Panduranga Coffee.' },
      { title: 'Town Spice & Coffee Shopping', category: 'shopping', durationMins: 45, description: 'Stock up on freshly roasted chicory blends and estate cinnamon quills on MG Road.' },
    ],
    cautions: [
      'Mullayanagiri narrow summit road experiences bumper-to-bumper vehicle jams on weekend mornings; start before 07:00.',
      'Strong winds and thick fog on the peaks require warm windbreakers even in summer.',
    ],
    isSchedulable: false,
  },
  'yelagiri': {
    id: 'yelagiri',
    name: 'Yelagiri Hills',
    whyVisit: 'Quaint and quiet hill station in Tamil Nadu featuring 14 scenic hairpin bends, boating on Punganoor Lake, Swamimalai trekking, and peaceful orchards.',
    idealDaysMin: 1,
    idealDaysMax: 2,
    idealDurationText: '1 to 2 days recommended. Closest hill station escape from east Bengaluru (~160 km via NH 44).',
    allHighlights: [
      '14 Hairpin Bends scenic drive with valley viewpoints',
      'Punganoor Artificial Lake and landscaped park',
      'Swamimalai Peak trek (panoramic 4,338 ft summit trek)',
      'Jalagamparai Waterfalls (Attaru river cascade)',
      'Government Silk Farm & Herbal Farm',
    ],
    oneDayMustSees: ['Hairpin Bends drive', 'Punganoor Lake walk and boating'],
    multiDayMustSees: ['Punganoor Lake', 'Swamimalai morning trek', 'Jalagamparai Falls', 'Telescope Observatory'],
    skipsIfTight: ['Skip Jalagamparai Falls in dry months (Feb–May) when the river dries up to a trickle.'],
    freeTimePool: [
      { title: 'Lakefront Boating & Rose Garden Walk', category: 'relaxation', durationMins: 60, description: 'Quiet paddle boat loop across Punganoor Lake followed by a stroll through the park.' },
      { title: 'Local Forest Honey Tasting', category: 'food', durationMins: 30, description: 'Sample raw wild hill honey and fresh jackfruit sold by hill tribes near the lake.' },
    ],
    cautions: [
      'Hairpin roads are well-paved but feature blind curves; honk and yield to climbing buses.',
      'Nighttime dining options in the hills are limited; plan dinner before 21:00.',
    ],
    isSchedulable: false,
  },
  'wayanad': {
    id: 'wayanad',
    name: 'Wayanad',
    whyVisit: 'Pristine Kerala hill district nestled on the Western Ghats plateau with prehistoric Edakkal rock carvings, heart-shaped Chembra lake, and spice plantations.',
    idealDaysMin: 3,
    idealDaysMax: 4,
    idealDurationText: '3 to 4 days recommended. Transit requires passing through Bandipur/Gundlupet forest corridor (~6.5h).',
    allHighlights: [
      'Edakkal Caves (Neolithic petroglyphs and 1,200m cliff climb)',
      'Chembra Peak & heart-shaped mountain lake (Hridaya Saras)',
      'Banasura Sagar Dam (largest earthen dam in India with island boat cruises)',
      'Soochipara (Sentinel Rock) Waterfalls',
      'Muthanga Wildlife Sanctuary',
    ],
    oneDayMustSees: ['Edakkal Caves', 'Banasura Sagar Dam'],
    multiDayMustSees: ['Edakkal Caves', 'Chembra Peak trek', 'Banasura Dam', 'Soochipara Falls', 'Tea estate factory visit'],
    skipsIfTight: ['Skip Chembra Peak if permits are full or if traveling with elderly relatives, as it requires a steep 3-hour trek.'],
    freeTimePool: [
      { title: 'Kerala Malabar Parotta & Beef/Veg Roast', category: 'food', durationMins: 60, description: 'Authentic Kerala culinary experience with flaky parottas and spiced coconut gravies.' },
      { title: 'Wayanad Cardamom & Spices Depot', category: 'shopping', durationMins: 45, description: 'Direct purchase of organic black pepper, cloves, dried ginger, and vanilla pods.' },
    ],
    cautions: [
      'Passes through the Bandipur forest corridor (NH 766) subject to 21:00 to 06:00 IST night closure.',
      'Edakkal Caves entry ticket sales close at 16:00 IST and involve a steep uphill climb on foot.',
    ],
    isSchedulable: false,
  },
  'hampi': {
    id: 'hampi',
    name: 'Hampi',
    whyVisit: 'Open-air UNESCO World Heritage museum of the 14th-century Vijayanagara Empire, strewn across surreal granite boulder fields and the sacred Tungabhadra River.',
    idealDaysMin: 2,
    idealDaysMax: 4,
    idealDurationText: 'Ideal for 3 to 4 days. ~7 hours drive from Bengaluru via NH 48 and NH 50 expressway.',
    allHighlights: [
      'Virupaksha Temple (active 7th-century Dravidian sanctum on riverside)',
      'Vijaya Vittala Temple & iconic Stone Chariot with musical pillars',
      'Lotus Mahal, Elephant Stables & Royal Enclosure',
      'Matanga Hill sunrise vantage point over temple gopurams',
      'Coracle boat crossing to Anegundi ("Hippy Island")',
      'Hemakuta Hill sunset boulder temples',
    ],
    oneDayMustSees: ['Virupaksha Temple', 'Vittala Temple Stone Chariot', 'Lotus Mahal'],
    multiDayMustSees: ['Virupaksha Temple', 'Vittala Stone Chariot', 'Matanga Hill sunrise', 'Anegundi boulder hike', 'Royal Enclosure'],
    skipsIfTight: ['Skip Anegundi/Sanapur Lake coracle rides if on a tight 2-day schedule to focus on the main UNESCO temple zone.'],
    freeTimePool: [
      { title: 'Bicycle Exploration Along River Ruins', category: 'culture', durationMins: 90, description: 'Rent a bicycle to navigate ancient stone colonnades and riverside paths at your own pace.' },
      { title: 'Mango Tree Cafe Thali Experience', category: 'food', durationMins: 60, description: 'Relaxed garden dining overlooking banana plantations with traditional south Indian thali.' },
    ],
    cautions: [
      'Midday temperatures in the rocky landscape are intense year-round; explore between 06:00–10:30 and 15:30–18:30.',
      'Carry adequate water and sun protection as shaded spots among the ruins are minimal.',
    ],
    isSchedulable: false,
  },
  'pondicherry': {
    id: 'pondicherry',
    name: 'Puducherry (Pondicherry)',
    whyVisit: 'Charming French-Tamil coastal territory featuring mustard-yellow colonial villas, bougainvillea gates, Auroville universal township, and breezy Bay of Bengal beaches.',
    idealDaysMin: 2,
    idealDaysMax: 4,
    idealDurationText: 'Ideal for 2 to 3 days. ~6.5 hours drive from Bengaluru via Krishnagiri and Tiruvannamalai.',
    allHighlights: [
      'White Town (French Quarter colonial heritage architecture walk)',
      'Promenade Beach & Rock Beach seaside walk',
      'Auroville & Matrimandir golden dome viewing',
      'Sri Aurobindo Ashram',
      'Paradise Beach (accessible via Chunnambar backwater boat ride)',
      'French bakeries, creperies, and seaside cafes',
    ],
    oneDayMustSees: ['White Town French Quarter walk', 'Promenade Beach sunset stroll'],
    multiDayMustSees: ['White Town walk', 'Promenade Beach', 'Auroville Matrimandir', 'Paradise Beach boat ride', 'Ashram visit'],
    skipsIfTight: ['Skip Matrimandir inner chamber meditation if not booked 2 weeks in advance; viewing the golden sphere from outside is sufficient.'],
    freeTimePool: [
      { title: 'French Bakery Croissant & Cafe Au Lait', category: 'food', durationMins: 45, description: 'Savor freshly baked buttery croissants and espresso at Baker Street or Cafe des Arts.' },
      { title: 'Evening Promenade Seaside Stroll', category: 'relaxation', durationMins: 60, description: 'Goubert Avenue is pedestrian-only after 18:00; enjoy ocean breeze and sound of waves.' },
      { title: 'Boutique Ceramic & Linen Shopping', category: 'shopping', durationMins: 45, description: 'Explore Auroshikha incense, handmade paper, and ceramic pottery studios.' },
    ],
    cautions: [
      'Promenade road closes to motor traffic every evening from 18:00 to 07:30 IST for pedestrians.',
      'Paradise Beach boat counters experience high weekend queues; visit before 10:00.',
    ],
    isSchedulable: false,
  },
  'gokarna': {
    id: 'gokarna',
    name: 'Gokarna',
    whyVisit: 'Spiritual coastal town where Western Ghats cliffs tumble into pristine Arabian Sea beaches; famous for the sacred Mahabaleshwar Temple, Om Beach, and cliffside trekking.',
    idealDaysMin: 3,
    idealDaysMax: 4,
    idealDurationText: '3 to 4 days recommended. ~9.5 hours drive from Bengaluru; best suited for extended long weekends.',
    allHighlights: [
      'Om Beach (famous auspicious om-shaped double crescent sand cove)',
      'Five Beach Cliff Trek (Kudle -> Om -> Half Moon -> Paradise Beach)',
      'Mahabaleshwar Temple (ancient Atmalinga shrine)',
      'Mirjan Fort (mossy laterite stone fortress nearby)',
      'Kudle Beach shack sunset dining',
    ],
    oneDayMustSees: ['Om Beach viewpoint', 'Kudle Beach sunset'],
    multiDayMustSees: ['Om Beach', 'Five Beach cliff trail', 'Mahabaleshwar Temple', 'Mirjan Fort detour', 'Paradise Beach boat ride'],
    skipsIfTight: ['Skip the full 5-beach cliff trek if short on time; take a quick fishing boat transfer between Om Beach and Paradise Beach instead.'],
    freeTimePool: [
      { title: 'Namaste Cafe Seafood / Veg Lunch', category: 'food', durationMins: 60, description: 'Iconic open-air beachfront restaurant perched on the rocks of Om Beach.' },
      { title: 'Kudle Cliff Sunset Meditation', category: 'relaxation', durationMins: 60, description: 'Watch the sun sink into the Arabian Sea from the cliff path connecting Kudle and Om beach.' },
    ],
    cautions: [
      'Long ~490 km driving distance requires a dedicated travel day or shared driving responsibilities.',
      'High tide and strong riptides make swimming dangerous at certain stretches of Paradise and Half Moon beaches.',
    ],
    isSchedulable: false,
  },
};

/**
 * Generates an intelligent, timing-aware, pace-adapted destination guide.
 * Curated rule-based content guarantees genuine facts without artificial delays or fake AI claims.
 */
export const ALL_DESTINATION_IDS = [
  'mysuru',
  'coorg-madikeri',
  'ooty-nilgiris',
  'nandi-hills',
  'kabini',
  'sakleshpur',
  'chikmagalur',
  'yelagiri',
  'wayanad',
  'hampi',
  'pondicherry',
  'gokarna',
];

export function getDestinationGuide(
  destinationId: string,
  durationDays: number = 2,
  pace: PacePreference = 'balanced'
): DestinationGuide {
  const normalizedId = destinationId === 'ooty-nilgiris' ? 'ooty' : destinationId;
  const base = DESTINATION_GUIDE_BASES[normalizedId] ?? DESTINATION_GUIDE_BASES['mysuru'];
  const clampedDays = Math.max(1, Math.min(4, durationDays));

  // Determine duration fit
  let durationFitVerdict: 'ideal' | 'tight' | 'extended' = 'ideal';
  let durationNote = '';

  if (clampedDays < base.idealDaysMin) {
    durationFitVerdict = 'tight';
    durationNote = `${clampedDays} day(s) is tight for ${base.name}. Expect significant driving relative to on-site exploration. We recommend focusing strictly on top highlights.`;
  } else if (clampedDays > base.idealDaysMax) {
    durationFitVerdict = 'extended';
    durationNote = `${clampedDays} days provides generous leisure time at ${base.name}. Ideal for deep relaxation, off-beat trails, and unrushed local dining.`;
  } else {
    durationFitVerdict = 'ideal';
    durationNote = `${clampedDays} calendar day(s) is an ideal planning window for ${base.name}, offering a comfortable balance between scenic transit and sightseeing.`;
  }

  // Adapt highlights and prioritization based on trip duration
  const whatToPrioritize = clampedDays === 1 ? base.oneDayMustSees : base.multiDayMustSees;
  const topHighlights = clampedDays === 1 ? base.allHighlights.slice(0, 3) : base.allHighlights;

  // Adapt recommended geographical order
  let recommendedOrder: string[] = [];
  if (clampedDays === 1) {
    recommendedOrder = [
      'Morning: Arrive and immediately cover primary signature landmark',
      'Midday: Authentic local lunch break nearby',
      'Afternoon: One scenic walk or cultural market stop',
      'Late Afternoon: Depart for Bengaluru before evening highway rush',
    ];
  } else if (clampedDays === 2) {
    recommendedOrder = [
      'Day 1 Morning: Highway transit with curated breakfast pitstop',
      'Day 1 Afternoon: Hotel settlement & top cultural highlight',
      'Day 1 Evening: Scenic sunset viewpoint or traditional dinner',
      'Day 2 Morning: Early morning nature walk or temple visit',
      'Day 2 Midday: Local bazaar / souvenir stop, followed by departure',
    ];
  } else if (clampedDays === 3) {
    recommendedOrder = [
      'Day 1: Scenic highway transit, hotel check-in & relaxing evening walk',
      'Day 2: Full dedicated day for peak highlights, waterfall trails & nature excursions',
      'Day 3 Morning: Unrushed breakfast, local craft exploration & return drive',
    ];
  } else {
    recommendedOrder = [
      'Day 1: Relaxed outbound journey & scenic corridor orientation',
      'Day 2: Primary signature landmarks & cultural immersion',
      'Day 3: Nature excursions, deeper trails & plantation / water activities',
      'Day 4: Leisurely morning, artisanal shopping & return journey with buffer',
    ];
  }

  // Pace Note
  let paceNote = '';
  if (pace === 'relaxed') {
    paceNote = 'Relaxed Pace: Schedules fewer stops with 60–90m buffers, generous dining intervals, and ample resort downtime.';
  } else if (pace === 'packed') {
    paceNote = 'Packed Pace: Maximizes attraction coverage within operating hours. Requires punctuality and carries higher driving fatigue.';
  } else {
    paceNote = 'Balanced Pace (Recommended): Sensible mix of signature landmarks, 45m meals, and comfortable highway contingencies.';
  }

  return {
    destinationId: destinationId || base.id,
    destinationName: base.name,
    durationDays: clampedDays,
    pace,
    whyVisit: base.whyVisit,
    idealDuration: base.idealDurationText,
    durationFitVerdict,
    durationNote,
    topHighlights,
    recommendedOrder,
    whatToPrioritize,
    whatToSkipIfTight: base.skipsIfTight,
    freeTimeIdeas: base.freeTimePool,
    practicalCautions: base.cautions,
    paceNote,
    isSchedulable: base.isSchedulable,
  };
}
