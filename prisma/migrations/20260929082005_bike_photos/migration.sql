-- CreateTable
CREATE TABLE "bike_photos" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bikeId" TEXT NOT NULL,

    CONSTRAINT "bike_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bike_photos_bikeId_sortOrder_idx" ON "bike_photos"("bikeId", "sortOrder");

-- AddForeignKey
ALTER TABLE "bike_photos" ADD CONSTRAINT "bike_photos_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "bikes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
