/** Shop reviews. One per tourist per shop — writing again replaces it. */

import "server-only";

import { prisma } from "@/lib/prisma";

export async function saveReview(input: {
  shopId: string;
  userId: string;
  rating: number;
  comment: string;
}) {
  const { shopId, userId, rating, comment } = input;

  return prisma.review.upsert({
    where: { shopId_userId: { shopId, userId } },
    update: { rating, comment },
    create: { shopId, userId, rating, comment },
    select: { id: true },
  });
}

export async function getUserReview(shopId: string, userId: string) {
  return prisma.review.findUnique({
    where: { shopId_userId: { shopId, userId } },
    select: { rating: true, comment: true },
  });
}
