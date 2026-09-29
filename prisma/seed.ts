/**
 * Demo data for the rental site: cities, shops, bikes, reviews and one
 * account per role.
 *
 * Run by `prisma db seed` via the `migrations.seed` command in
 * prisma7.config.ts. It builds its own client rather than importing
 * `lib/prisma.ts`, because that module is marked `server-only` and uses the
 * `@/` alias, neither of which applies outside Next.js.
 *
 * Idempotent: users, cities, shops and reviews are upserted on their unique
 * keys, and a shop's bikes are only created when it has none — so running
 * the seed twice changes nothing. All shop names are fictional.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — check .env");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const PASSWORD = "Password1!";

const cities = [
  {
    slug: "siem-reap",
    name: "Siem Reap",
    province: "Siem Reap",
    tagline: "Ride out to Angkor Wat at sunrise and the temples beyond.",
    description:
      "Most visitors rent a scooter to reach the Angkor temples on their own schedule. Rules for riding inside the Angkor Archaeological Park change from time to time, so ask your shop before you set off. The city is flat and easy to ride, with quiet roads out to Kulen, Beng Mealea and the floating villages.",
    sortOrder: 1,
  },
  {
    slug: "phnom-penh",
    name: "Phnom Penh",
    province: "Phnom Penh",
    tagline: "The capital — busy traffic, riverside boulevards, great food.",
    description:
      "Traffic in Phnom Penh is heavy and moves by its own rules, so an automatic scooter is the easiest choice. A bike is handy for crossing the city between the Royal Palace, the markets and Koh Dach island. Always park in guarded parking (usually 1,000 riel).",
    sortOrder: 2,
  },
  {
    slug: "battambang",
    name: "Battambang",
    province: "Battambang",
    tagline: "Colonial town, the bamboo train and endless rice fields.",
    description:
      "Battambang is relaxed and made for day trips by bike: Phnom Sampov and the bat cave at dusk, the bamboo train, Wat Banan and the countryside villages along the Sangker River.",
    sortOrder: 3,
  },
  {
    slug: "kampot",
    name: "Kampot",
    province: "Kampot",
    tagline: "Pepper farms, the river and the road up Bokor Mountain.",
    description:
      "Kampot is one of the best places in Cambodia to ride: a sealed, winding road climbs Bokor Mountain, and quiet lanes lead to pepper farms, caves and the salt fields. Kep is a 30-minute ride away.",
    sortOrder: 4,
  },
  {
    slug: "kep",
    name: "Kep",
    province: "Kep",
    tagline: "Crab market, seaside roads and Kep National Park.",
    description:
      "A small seaside town where a scooter is the easiest way to get between the crab market, the beach and the national park trails.",
    sortOrder: 5,
  },
  {
    slug: "sihanoukville",
    name: "Sihanoukville",
    province: "Preah Sihanouk",
    tagline: "Beaches, and the jumping-off point for the islands.",
    description:
      "Rent a bike to explore Otres and Ream beaches and Ream National Park. Roads around the city centre can be dusty and busy with construction trucks — ride carefully.",
    sortOrder: 6,
  },
];

const users = [
  { email: "admin@example.com", name: "Demo Admin", role: "admin" },
  { email: "owner@example.com", name: "Sokha Chea", role: "owner" },
  { email: "dara.owner@example.com", name: "Dara Heng", role: "owner" },
  { email: "sreymom.owner@example.com", name: "Sreymom Lim", role: "owner" },
  { email: "vuthy.owner@example.com", name: "Vuthy Prak", role: "owner" },
  { email: "tourist@example.com", name: "Emma Walker", role: "user" },
  { email: "kenji@example.com", name: "Kenji Sato", role: "user" },
  { email: "lucas@example.com", name: "Lucas Moreau", role: "user" },
  { email: "mia@example.com", name: "Mia Fischer", role: "user" },
];

type SeedBike = {
  name: string;
  type: string;
  engineCc: number;
  pricePerDay: number;
  quantity: number;
  helmetIncluded?: boolean;
  description?: string;
};

type SeedShop = {
  slug: string;
  name: string;
  city: string;
  owner: string;
  description: string;
  address: string;
  phone: string;
  whatsapp?: string;
  openHours: string;
  depositPolicy: string;
  depositAmount?: number;
  verified?: boolean;
  bikes: SeedBike[];
  reviews: { by: string; rating: number; comment: string }[];
};

const click: SeedBike = {
  name: "Honda Click 125",
  type: "scooter",
  engineCc: 125,
  pricePerDay: 8,
  quantity: 6,
  description: "Automatic, light and easy — the most popular rental scooter in Cambodia. Storage under the seat.",
};
const scoopy: SeedBike = {
  name: "Honda Scoopy 110",
  type: "scooter",
  engineCc: 110,
  pricePerDay: 7,
  quantity: 4,
  description: "Small retro-style automatic, great for the city and for first-time riders.",
};
const dream: SeedBike = {
  name: "Honda Dream 125",
  type: "semi-auto",
  engineCc: 125,
  pricePerDay: 6,
  quantity: 5,
  description: "The classic Cambodian workhorse. Four gears, no clutch, very forgiving on rough roads.",
};
const pcx: SeedBike = {
  name: "Honda PCX 160",
  type: "scooter",
  engineCc: 160,
  pricePerDay: 15,
  quantity: 2,
  description: "Bigger, comfortable automatic for two people or longer day trips. Licence required.",
};
const nmax: SeedBike = {
  name: "Yamaha NMAX 155",
  type: "scooter",
  engineCc: 155,
  pricePerDay: 14,
  quantity: 2,
  description: "Comfortable maxi-scooter with ABS. Good for Bokor Mountain or the ride to Kep.",
};
const crf: SeedBike = {
  name: "Honda CRF250L",
  type: "dirt",
  engineCc: 250,
  pricePerDay: 30,
  quantity: 2,
  description: "Dual-sport dirt bike for countryside trails. Riding gear available on request.",
};
const ebike: SeedBike = {
  name: "Yadea E-Scooter",
  type: "electric",
  engineCc: 0,
  pricePerDay: 6,
  quantity: 3,
  description: "Silent electric scooter with about 60 km of range. Charger included.",
};

const shops: SeedShop[] = [
  {
    slug: "temple-road-rentals",
    name: "Temple Road Rentals",
    city: "siem-reap",
    owner: "owner@example.com",
    description:
      "Family-run shop near the Old Market. Every bike is serviced after each rental, and we give you a free map of the temple loops. English and French spoken.",
    address: "Street 7, near Psar Chas, Siem Reap",
    phone: "+855 12 345 601",
    whatsapp: "+85512345601",
    openHours: "7:00 – 20:00 daily",
    depositPolicy: "cash",
    depositAmount: 100,
    bikes: [click, scoopy, dream, ebike],
    reviews: [
      { by: "tourist@example.com", rating: 5, comment: "Bike was spotless and they took a cash deposit instead of my passport. Great temple map too!" },
      { by: "kenji@example.com", rating: 4, comment: "Good scooter, fair price. Pickup was quick. Helmet was a bit big." },
    ],
  },
  {
    slug: "angkor-scooter-hub",
    name: "Angkor Scooter Hub",
    city: "siem-reap",
    owner: "sreymom.owner@example.com",
    description:
      "Wide choice of automatics and a few dirt bikes for Kulen Mountain. Free hotel delivery within the city.",
    address: "Sivutha Blvd, Siem Reap",
    phone: "+855 12 345 602",
    openHours: "6:30 – 21:00 daily",
    depositPolicy: "cash-or-passport",
    depositAmount: 150,
    bikes: [click, pcx, nmax, crf],
    reviews: [
      { by: "lucas@example.com", rating: 5, comment: "Delivered the NMAX to my guesthouse at 5am for sunrise. Excellent service." },
      { by: "mia@example.com", rating: 4, comment: "Nice bikes. They offered passport or cash, I chose cash — no problem." },
    ],
  },
  {
    slug: "riverside-moto-pp",
    name: "Riverside Moto",
    city: "phnom-penh",
    owner: "vuthy.owner@example.com",
    description:
      "A short walk from Sisowath Quay. Scooters with phone holders and locks, and a short safety briefing for first-timers.",
    address: "Street 130, Daun Penh, Phnom Penh",
    phone: "+855 12 345 603",
    whatsapp: "+85512345603",
    openHours: "8:00 – 19:00 daily",
    depositPolicy: "cash",
    depositAmount: 200,
    bikes: [{ ...click, pricePerDay: 10 }, { ...scoopy, pricePerDay: 9 }, { ...pcx, pricePerDay: 18 }],
    reviews: [
      { by: "kenji@example.com", rating: 5, comment: "The safety briefing was really useful for Phnom Penh traffic. Good bike." },
    ],
  },
  {
    slug: "bkk1-bikes",
    name: "BKK1 Bikes",
    city: "phnom-penh",
    owner: "owner@example.com",
    description: "Long-term and weekly rentals for expats and travellers. Discounts for 7+ days.",
    address: "Street 278, BKK1, Phnom Penh",
    phone: "+855 12 345 604",
    openHours: "9:00 – 18:00, closed Sunday",
    depositPolicy: "passport",
    bikes: [{ ...dream, pricePerDay: 5 }, { ...click, pricePerDay: 9 }],
    reviews: [
      { by: "mia@example.com", rating: 3, comment: "Bike was fine but they insisted on keeping my passport, which I didn't love." },
    ],
  },
  {
    slug: "sangker-river-rentals",
    name: "Sangker River Rentals",
    city: "battambang",
    owner: "dara.owner@example.com",
    description:
      "Rent a Dream or a scooter and ride the countryside loop. We mark the bamboo train, Phnom Sampov and Wat Banan on your map.",
    address: "Street 1, by the Sangker River, Battambang",
    phone: "+855 12 345 605",
    whatsapp: "+85512345605",
    openHours: "7:00 – 19:00 daily",
    depositPolicy: "cash",
    depositAmount: 50,
    bikes: [{ ...dream, pricePerDay: 5 }, { ...scoopy, pricePerDay: 6 }, click],
    reviews: [
      { by: "tourist@example.com", rating: 5, comment: "Cheap, friendly and the countryside map was perfect. Only a $50 deposit." },
      { by: "lucas@example.com", rating: 5, comment: "Rode to Phnom Sampov for the bats. Honda Dream ran perfectly." },
    ],
  },
  {
    slug: "bokor-moto-kampot",
    name: "Bokor Moto",
    city: "kampot",
    owner: "sreymom.owner@example.com",
    description:
      "Bikes chosen for the Bokor Mountain climb — good brakes and tyres checked every morning. Rain ponchos free.",
    address: "Riverside Road, Kampot",
    phone: "+855 12 345 606",
    whatsapp: "+85512345606",
    openHours: "7:30 – 19:30 daily",
    depositPolicy: "none",
    bikes: [click, nmax, { ...crf, pricePerDay: 28 }, dream],
    reviews: [
      { by: "mia@example.com", rating: 5, comment: "No deposit at all, just a photo of my passport. NMAX was perfect for Bokor." },
      { by: "kenji@example.com", rating: 4, comment: "Great bikes for the mountain. Ask for a poncho — it rained on the way down!" },
    ],
  },
  {
    slug: "pepper-trail-rentals",
    name: "Pepper Trail Rentals",
    city: "kampot",
    owner: "dara.owner@example.com",
    description: "Small shop near the Durian roundabout with cheap semi-autos and e-scooters for the pepper farms.",
    address: "Near Durian Roundabout, Kampot",
    phone: "+855 12 345 607",
    openHours: "8:00 – 18:00 daily",
    depositPolicy: "cash-or-passport",
    depositAmount: 80,
    bikes: [{ ...dream, pricePerDay: 5 }, ebike],
    reviews: [],
  },
  {
    slug: "crab-coast-scooters",
    name: "Crab Coast Scooters",
    city: "kep",
    owner: "vuthy.owner@example.com",
    description: "Scooters by the crab market. Ride the coast road or up into Kep National Park.",
    address: "Crab Market Road, Kep",
    phone: "+855 12 345 608",
    openHours: "7:00 – 18:00 daily",
    depositPolicy: "cash",
    depositAmount: 80,
    bikes: [scoopy, click],
    reviews: [
      { by: "lucas@example.com", rating: 4, comment: "Easy rental, nice coastal ride. Bike had a small scratch they noted at pickup." },
    ],
  },
  {
    slug: "otres-beach-bikes",
    name: "Otres Beach Bikes",
    city: "sihanoukville",
    owner: "owner@example.com",
    description: "Beach-side rentals with surfboard racks on request.",
    address: "Otres 1, Sihanoukville",
    phone: "+855 12 345 609",
    openHours: "8:00 – 18:00 daily",
    depositPolicy: "cash",
    depositAmount: 100,
    bikes: [{ ...click, pricePerDay: 9 }, { ...crf, pricePerDay: 32 }],
    reviews: [],
  },
  {
    // Left unverified so the admin queue has something to review.
    slug: "new-wave-rentals",
    name: "New Wave Rentals",
    city: "siem-reap",
    owner: "dara.owner@example.com",
    description: "Newly opened shop on Wat Bo Road with brand-new 2026 scooters.",
    address: "Wat Bo Road, Siem Reap",
    phone: "+855 12 345 610",
    openHours: "7:00 – 21:00 daily",
    depositPolicy: "cash",
    depositAmount: 100,
    verified: false,
    bikes: [{ ...click, pricePerDay: 9 }],
    reviews: [],
  },
];

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  const userIds = new Map<string, string>();
  for (const user of users) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role, name: user.name },
      create: { ...user, password: hash },
      select: { id: true },
    });
    userIds.set(user.email, row.id);
  }
  console.log(`Seeded ${users.length} accounts (password: ${PASSWORD})`);

  const cityIds = new Map<string, string>();
  for (const city of cities) {
    const row = await prisma.city.upsert({
      where: { slug: city.slug },
      update: city,
      create: city,
      select: { id: true },
    });
    cityIds.set(city.slug, row.id);
  }
  console.log(`Seeded ${cities.length} cities`);

  let bikeCount = 0;
  let reviewCount = 0;

  for (const { bikes, reviews, city, owner, verified, ...shop } of shops) {
    const data = {
      ...shop,
      cityId: cityIds.get(city)!,
      ownerId: userIds.get(owner)!,
      verified: verified ?? true,
    };

    const row = await prisma.shop.upsert({
      where: { slug: shop.slug },
      update: data,
      create: data,
      select: { id: true, _count: { select: { bikes: true } } },
    });

    if (row._count.bikes === 0) {
      await prisma.bike.createMany({
        data: bikes.map((bike) => ({ ...bike, shopId: row.id })),
      });
      bikeCount += bikes.length;
    }

    for (const review of reviews) {
      const userId = userIds.get(review.by)!;
      await prisma.review.upsert({
        where: { shopId_userId: { shopId: row.id, userId } },
        update: { rating: review.rating, comment: review.comment },
        create: { shopId: row.id, userId, rating: review.rating, comment: review.comment },
      });
      reviewCount++;
    }
  }
  console.log(`Seeded ${shops.length} shops, ${bikeCount} new bikes, ${reviewCount} reviews`);

  // A couple of bookings so the tourist and owner dashboards are not empty.
  const tourist = userIds.get("tourist@example.com")!;
  if ((await prisma.booking.count({ where: { userId: tourist } })) === 0) {
    const today = new Date(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Phnom_Penh" }).format(new Date()) + "T00:00:00Z",
    );
    const day = (offset: number) => new Date(today.getTime() + offset * 86_400_000);

    const [templeClick, riversideScoopy] = await Promise.all([
      prisma.bike.findFirst({ where: { shop: { slug: "temple-road-rentals" }, name: click.name } }),
      prisma.bike.findFirst({ where: { shop: { slug: "riverside-moto-pp" }, name: scoopy.name } }),
    ]);

    const samples = [
      { bike: templeClick, start: 7, days: 3, status: "confirmed" },
      { bike: riversideScoopy, start: 14, days: 2, status: "pending" },
    ];

    for (const sample of samples) {
      if (!sample.bike) continue;
      await prisma.booking.create({
        data: {
          bikeId: sample.bike.id,
          userId: tourist,
          startDate: day(sample.start),
          endDate: day(sample.start + sample.days - 1),
          days: sample.days,
          totalPrice: sample.bike.pricePerDay * sample.days,
          status: sample.status,
          contactName: "Emma Walker",
          contactPhone: "+44 7700 900123",
          note: "Arriving by bus in the morning.",
        },
      });
    }
    console.log(`Seeded ${samples.length} bookings for tourist@example.com`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
