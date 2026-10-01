/**
 * ---------------------------------------------------------------------------
 * Voyahub seed catalogue
 * ---------------------------------------------------------------------------
 *
 * Deterministic, dependency-free seed data for the self-inventory catalogue:
 * destinations, products, ticket variants, pricing rules, inventory, coupons,
 * demo customers and a sample of paid orders with issued tickets.
 *
 * The content targets the European and North American markets: pricing in USD
 * and EUR, timezone-correct service dates, and copy written in the locale each
 * product actually serves.
 */

export type SeedDestination = {
  slug: string;
  name: string;
  level: 'COUNTRY' | 'REGION' | 'CITY' | 'ATTRACTION';
  countryCode: string;
  timezone: string;
  latitude: number;
  longitude: number;
  isPopular?: boolean;
  sortWeight?: number;
  description?: string;
  heroImageUrl?: string;
};

export type SeedTicketType = {
  code: string;
  name: string;
  description?: string;
  basePriceCents: number;
  compareAtCents?: number;
  costCents: number;
  currency?: string;
  taxBps?: number;
  feeBps?: number;
  inventoryMode?: 'PER_DATE' | 'PER_SLOT' | 'PER_NIGHT' | 'PER_HOUR' | 'UNLIMITED';
  maxPerOrder?: number;
  minPerOrder?: number;
  isRefundable?: boolean;
  isTransferable?: boolean;
  requiresPassport?: boolean;
  capacity?: number;
  timeSlots?: string[];
  netPriceCents?: number;
};

export type SeedPriceRule = {
  scope: 'PRODUCT' | 'TICKET_TYPE';
  ticketCode?: string;
  kind:
    | 'DATE_RANGE'
    | 'DAY_OF_WEEK'
    | 'SEASON'
    | 'LEAD_TIME'
    | 'QUANTITY_BREAK'
    | 'FLASH_SALE'
    | 'EARLY_BIRD';
  name: string;
  priority?: number;
  conditions: Record<string, unknown>;
  adjustment: Record<string, unknown>;
  minQuantity?: number;
  startsAt?: string;
  endsAt?: string;
};

export type SeedProduct = {
  slug: string;
  type:
    | 'ATTRACTION_TICKET'
    | 'ACTIVITY'
    | 'TOUR'
    | 'DAY_TRIP'
    | 'PACKAGE'
    | 'HOTEL_ROOM'
    | 'TRANSFER'
    | 'GUIDED_TOUR'
    | 'CRUISE'
    | 'RESTAURANT'
    | 'VEHICLE_RENTAL';
  fulfillment?: 'INSTANT_TICKET' | 'CONFIRMATION' | 'ON_SITE_PAYMENT';
  destinationSlug: string;
  merchantSlug?: string;
  latitude: number;
  longitude: number;
  addressLine?: string;
  meetingPoint?: string;
  timezone: string;
  defaultLocale?: string;
  summary: string;
  description: string;
  highlights: string[];
  includes: string[];
  excludes: string[];
  amenities?: string[];
  audience?: string[];
  languages?: string[];
  instantConfirm?: boolean;
  mobileTicket?: boolean;
  freeCancellation?: boolean;
  skipTheLine?: boolean;
  ticketOnly?: boolean;
  wheelchairAccessible?: boolean;
  durationMinutes?: number;
  minAge?: number;
  maxAge?: number;
  tags: string[];
  media: { url: string; altText: string }[];
  /** Extra locales beyond the default one. */
  translations?: {
    locale: string;
    name: string;
    summary: string;
    highlights?: string[];
  }[];
  ticketTypes: SeedTicketType[];
  priceRules?: SeedPriceRule[];
  cancellationPolicy?: {
    freeCancelHours: number;
    tiers: { minHoursBefore: number; refundBps: number }[];
    adminFeeCents: number;
    description: string;
  };
  /** Deterministic review seeding so ratings look real. */
  reviews?: { rating: number; title: string; body: string; author: string; daysAgo: number }[];
};

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

export const DESTINATIONS: SeedDestination[] = [
  // Countries / regions (ancestors for search by country)
  { slug: 'united-states', name: 'United States', level: 'COUNTRY', countryCode: 'US', timezone: 'America/New_York', latitude: 39.8283, longitude: -98.5795 },
  { slug: 'united-kingdom', name: 'United Kingdom', level: 'COUNTRY', countryCode: 'GB', timezone: 'Europe/London', latitude: 54.0, longitude: -2.0 },
  { slug: 'france', name: 'France', level: 'COUNTRY', countryCode: 'FR', timezone: 'Europe/Paris', latitude: 46.2276, longitude: 2.2137 },
  { slug: 'italy', name: 'Italy', level: 'COUNTRY', countryCode: 'IT', timezone: 'Europe/Rome', latitude: 41.8719, longitude: 12.5674 },
  { slug: 'spain', name: 'Spain', level: 'COUNTRY', countryCode: 'ES', timezone: 'Europe/Madrid', latitude: 40.4637, longitude: -3.7492 },
  { slug: 'netherlands', name: 'Netherlands', level: 'COUNTRY', countryCode: 'NL', timezone: 'Europe/Amsterdam', latitude: 52.1326, longitude: 5.2913 },

  // Cities
  { slug: 'new-york', name: 'New York', level: 'CITY', countryCode: 'US', timezone: 'America/New_York', latitude: 40.7128, longitude: -74.006, isPopular: true, sortWeight: 1, description: 'Iconic skyline, world-class museums and Broadway.', heroImageUrl: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1200&q=80' },
  { slug: 'los-angeles', name: 'Los Angeles', level: 'CITY', countryCode: 'US', timezone: 'America/Los_Angeles', latitude: 34.0522, longitude: -118.2437, isPopular: true, sortWeight: 2, description: 'The city of dreams, from the Hollywood Sign to the Pacific.', heroImageUrl: 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=1200&q=80' },
  { slug: 'san-francisco', name: 'San Francisco', level: 'CITY', countryCode: 'US', timezone: 'America/Los_Angeles', latitude: 37.7749, longitude: -122.4194, isPopular: true, sortWeight: 3, description: 'Golden Gate views, foggy hills and tech campuses.', heroImageUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&q=80' },
  { slug: 'las-vegas', name: 'Las Vegas', level: 'CITY', countryCode: 'US', timezone: 'America/Los_Angeles', latitude: 36.1699, longitude: -115.1398, isPopular: true, sortWeight: 8, description: 'Resorts, shows and non-stop entertainment.', heroImageUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80' },
  { slug: 'chicago', name: 'Chicago', level: 'CITY', countryCode: 'US', timezone: 'America/Chicago', latitude: 41.8781, longitude: -87.6298, isPopular: true, sortWeight: 10, description: 'Deep-dish pizza, avant-garde architecture and the lake.', heroImageUrl: 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=1200&q=80' },
  { slug: 'miami', name: 'Miami', level: 'CITY', countryCode: 'US', timezone: 'America/New_York', latitude: 25.7617, longitude: -80.1918, isPopular: true, sortWeight: 12, description: 'Art Deco, beaches and Latin nightlife.', heroImageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80' },

  { slug: 'london', name: 'London', level: 'CITY', countryCode: 'GB', timezone: 'Europe/London', latitude: 51.5074, longitude: -0.1278, isPopular: true, sortWeight: 4, description: 'Royal landmarks, world-class museums and West End shows.', heroImageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=80' },
  { slug: 'edinburgh', name: 'Edinburgh', level: 'CITY', countryCode: 'GB', timezone: 'Europe/London', latitude: 55.9533, longitude: -3.1883, isPopular: true, sortWeight: 14, description: 'Castles, cobblestones and the Scottish Highlands beyond.', heroImageUrl: 'https://images.unsplash.com/photo-1506377585622-bedcbb027afc?w=1200&q=80' },

  { slug: 'paris', name: 'Paris', level: 'CITY', countryCode: 'FR', timezone: 'Europe/Paris', latitude: 48.8566, longitude: 2.3522, isPopular: true, sortWeight: 5, description: 'The City of Light, from the Louvre to Montmartre.', heroImageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80' },
  { slug: 'nice', name: 'Nice', level: 'CITY', countryCode: 'FR', timezone: 'Europe/Paris', latitude: 43.7102, longitude: 7.2620, isPopular: true, sortWeight: 16, description: 'Promenade des Anglais and the Côte d’Azur.', heroImageUrl: 'https://images.unsplash.com/photo-1530841377377-3ff06c0ca713?w=1200&q=80' },

  { slug: 'rome', name: 'Rome', level: 'CITY', countryCode: 'IT', timezone: 'Europe/Rome', latitude: 41.9028, longitude: 12.4964, isPopular: true, sortWeight: 6, description: 'The Eternal City — Colosseum, Vatican and Trastevere.', heroImageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200&q=80' },
  { slug: 'florence', name: 'Florence', level: 'CITY', countryCode: 'IT', timezone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, isPopular: true, sortWeight: 18, description: 'Renaissance art, Duomo Brunelleschi and Tuscan food.', heroImageUrl: 'https://images.unsplash.com/photo-1543429776-2782fc586c70?w=1200&q=80' },
  { slug: 'venice', name: 'Venice', level: 'CITY', countryCode: 'IT', timezone: 'Europe/Rome', latitude: 45.4408, longitude: 12.3155, isPopular: true, sortWeight: 20, description: 'Canals, gondolas and St Mark’s Basilica.', heroImageUrl: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=1200&q=80' },

  { slug: 'barcelona', name: 'Barcelona', level: 'CITY', countryCode: 'ES', timezone: 'Europe/Madrid', latitude: 41.3851, longitude: 2.1734, isPopular: true, sortWeight: 7, description: 'Gaudí architecture, beaches and tapas culture.', heroImageUrl: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200&q=80' },
  { slug: 'madrid', name: 'Madrid', level: 'CITY', countryCode: 'ES', timezone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038, isPopular: true, sortWeight: 22, description: 'Prado Museum, Royal Palace and late-night tapas.', heroImageUrl: 'https://images.unsplash.com/photo-1558452998-6a7e6c7dbd03?w=1200&q=80' },
  { slug: 'seville', name: 'Seville', level: 'CITY', countryCode: 'ES', timezone: 'Europe/Madrid', latitude: 37.3891, longitude: -5.9845, isPopular: true, sortWeight: 26, description: 'Moorish palaces, flamenco and orange-blossom courtyards.', heroImageUrl: 'https://images.unsplash.com/photo-1558642084-fd07fae5282e?w=1200&q=80' },

  { slug: 'amsterdam', name: 'Amsterdam', level: 'CITY', countryCode: 'NL', timezone: 'Europe/Amsterdam', latitude: 52.3676, longitude: 4.9041, isPopular: true, sortWeight: 9, description: 'Canal houses, the Van Gogh Museum and bike lanes.', heroImageUrl: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1200&q=80' },
];

// ---------------------------------------------------------------------------
// Merchants (stage-2 "partner" inventory)
// ---------------------------------------------------------------------------

export const MERCHANTS = [
  { name: 'Voyahub Experiences', slug: 'voyahub-direct', description: 'Platform-owned experiences operated by the Voyahub team.', commissionBps: 0, countryCode: 'US', status: 'ACTIVE' as const },
  { name: 'Big Apple Attractions', slug: 'big-apple-attractions', description: 'Official tickets for New York’s top attractions.', commissionBps: 1200, countryCode: 'US', status: 'ACTIVE' as const },
  { name: 'Côte d’Azur Transfers', slug: 'cote-azur-transfers', description: 'Private drivers and transfers along the Riviera.', commissionBps: 1500, countryCode: 'FR', status: 'ACTIVE' as const },
  { name: 'Tuscany Slow Travel', slug: 'tuscany-slow-travel', description: 'Small-group tours led by local historians.', commissionBps: 1800, countryCode: 'IT', status: 'ACTIVE' as const },
  { name: 'Albaicina Transfers', slug: 'albaicina-transfers', description: 'Airport and intercity transfers in Spain.', commissionBps: 1500, countryCode: 'ES', status: 'ACTIVE' as const },
];
