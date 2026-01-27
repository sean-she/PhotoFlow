-- CreateEnum
CREATE TYPE "AlbumStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AlbumStatus" NOT NULL DEFAULT 'DRAFT',
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "storage_key" TEXT NOT NULL,
    "thumbnail_storage_key" TEXT,
    "album_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "exif_camera_make" TEXT,
    "exif_camera_model" TEXT,
    "exif_datetime_original" TIMESTAMP(3),
    "exif_iso" INTEGER,
    "exif_focal_length" DOUBLE PRECISION,
    "exif_aperture" DOUBLE PRECISION,
    "exif_shutter_speed" TEXT,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_clients" (
    "id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_email" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "album_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "album_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_selections" (
    "id" TEXT NOT NULL,
    "photo_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "selection_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "albums_user_id_idx" ON "albums"("user_id");

-- CreateIndex
CREATE INDEX "albums_status_idx" ON "albums"("status");

-- CreateIndex
CREATE INDEX "albums_created_at_idx" ON "albums"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "photos_storage_key_key" ON "photos"("storage_key");

-- CreateIndex
CREATE INDEX "photos_album_id_idx" ON "photos"("album_id");

-- CreateIndex
CREATE INDEX "photos_storage_key_idx" ON "photos"("storage_key");

-- CreateIndex
CREATE INDEX "photos_created_at_idx" ON "photos"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "album_clients_access_token_key" ON "album_clients"("access_token");

-- CreateIndex
CREATE INDEX "album_clients_access_token_idx" ON "album_clients"("access_token");

-- CreateIndex
CREATE INDEX "album_clients_album_id_idx" ON "album_clients"("album_id");

-- CreateIndex
CREATE INDEX "album_clients_expires_at_idx" ON "album_clients"("expires_at");

-- CreateIndex
CREATE INDEX "photo_selections_photo_id_idx" ON "photo_selections"("photo_id");

-- CreateIndex
CREATE INDEX "photo_selections_client_id_idx" ON "photo_selections"("client_id");

-- CreateIndex
CREATE INDEX "photo_selections_selection_date_idx" ON "photo_selections"("selection_date");

-- CreateIndex
CREATE UNIQUE INDEX "photo_selections_photo_id_client_id_key" ON "photo_selections"("photo_id", "client_id");

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_clients" ADD CONSTRAINT "album_clients_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_selections" ADD CONSTRAINT "photo_selections_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_selections" ADD CONSTRAINT "photo_selections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "album_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
