/**
 * The administrator's view: every shop, verified or not, and the switch that
 * decides whether tourists can see it.
 */

import "server-only";

import { prisma } from "@/lib/prisma";

export async function listAllShops() {
  return prisma.shop.findMany({
    // Shops waiting for review first.
    orderBy: [{ verified: "asc" }, { createdAt: "desc" }],
    include: {
      city: { select: { name: true } },
      owner: { select: { name: true, email: true } },
      _count: { select: { bikes: true } },
    },
  });
}

export async function setShopVerified(shopId: string, verified: boolean) {
  const { count } = await prisma.shop.updateMany({
    where: { id: shopId },
    data: { verified },
  });
  return count === 1;
}

export async function siteStats() {
  const [shops, pendingShops, bikes, bookings, pendingBookings, users] =
    await Promise.all([
      prisma.shop.count({ where: { verified: true } }),
      prisma.shop.count({ where: { verified: false } }),
      prisma.bike.count({ where: { active: true } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "pending" } }),
      prisma.user.count(),
    ]);

  return { shops, pendingShops, bikes, bookings, pendingBookings, users };
}
