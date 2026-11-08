-- CreateEnum
CREATE TYPE "NcCommentKind" AS ENUM ('comment', 'quick', 'closure');

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "non_conformities" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "nc_comments" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "nc_code" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "kind" "NcCommentKind" NOT NULL DEFAULT 'comment',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_comments_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateIndex
CREATE INDEX "nc_comments_tenant_id_nc_code_idx" ON "nc_comments"("tenant_id", "nc_code");

-- AddForeignKey
ALTER TABLE "nc_comments" ADD CONSTRAINT "nc_comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nc_comments" ADD CONSTRAINT "nc_comments_tenant_id_nc_code_fkey" FOREIGN KEY ("tenant_id", "nc_code") REFERENCES "non_conformities"("tenant_id", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nc_comments" ADD CONSTRAINT "nc_comments_tenant_id_author_id_fkey" FOREIGN KEY ("tenant_id", "author_id") REFERENCES "users"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
