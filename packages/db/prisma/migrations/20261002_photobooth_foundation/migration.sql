-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ThemeStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('FRAME', 'STICKER', 'THUMBNAIL', 'POSE_ILLUSTRATION');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('EDITOR', 'ADMINISTRATOR');

-- CreateTable
CREATE TABLE "themes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnail_asset_id" UUID,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "status" "ThemeStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "theme_id" UUID,
    "asset_type" "AssetType" NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "alt_text" VARCHAR(500) NOT NULL,
    "license_note" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frames" (
    "id" UUID NOT NULL,
    "theme_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "asset_id" UUID NOT NULL,
    "layout_config" JSONB NOT NULL,
    "is_limited" BOOLEAN NOT NULL DEFAULT false,
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "frames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filters" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "filter_key" VARCHAR(80) NOT NULL,
    "config" JSONB NOT NULL,
    "preview_asset_id" UUID,
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pose_guides" (
    "id" UUID NOT NULL,
    "theme_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "instruction" TEXT NOT NULL,
    "asset_id" UUID,
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pose_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "delete_token_hash" CHAR(64) NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "consent_version" VARCHAR(50) NOT NULL,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "credential_hash" CHAR(64) NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'EDITOR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "themes_slug_key" ON "themes"("slug");

-- CreateIndex
CREATE INDEX "themes_status_starts_at_ends_at_idx" ON "themes"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "assets_storage_key_key" ON "assets"("storage_key");

-- CreateIndex
CREATE INDEX "assets_theme_id_status_idx" ON "assets"("theme_id", "status");

-- CreateIndex
CREATE INDEX "assets_asset_type_status_sort_order_idx" ON "assets"("asset_type", "status", "sort_order");

-- CreateIndex
CREATE INDEX "frames_theme_id_status_sort_order_idx" ON "frames"("theme_id", "status", "sort_order");

-- CreateIndex
CREATE INDEX "frames_asset_id_idx" ON "frames"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "filters_filter_key_key" ON "filters"("filter_key");

-- CreateIndex
CREATE INDEX "filters_status_sort_order_idx" ON "filters"("status", "sort_order");

-- CreateIndex
CREATE INDEX "filters_preview_asset_id_idx" ON "filters"("preview_asset_id");

-- CreateIndex
CREATE INDEX "pose_guides_theme_id_status_sort_order_idx" ON "pose_guides"("theme_id", "status", "sort_order");

-- CreateIndex
CREATE INDEX "pose_guides_asset_id_idx" ON "pose_guides"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_hash_key" ON "share_links"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_delete_token_hash_key" ON "share_links"("delete_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_storage_key_key" ON "share_links"("storage_key");

-- CreateIndex
CREATE INDEX "share_links_expires_at_deleted_at_idx" ON "share_links"("expires_at", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_credential_hash_key" ON "admin_users"("credential_hash");

-- CreateIndex
CREATE INDEX "admin_users_role_idx" ON "admin_users"("role");

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_thumbnail_asset_id_fkey" FOREIGN KEY ("thumbnail_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frames" ADD CONSTRAINT "frames_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frames" ADD CONSTRAINT "frames_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filters" ADD CONSTRAINT "filters_preview_asset_id_fkey" FOREIGN KEY ("preview_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pose_guides" ADD CONSTRAINT "pose_guides_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pose_guides" ADD CONSTRAINT "pose_guides_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
