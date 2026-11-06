-- AlterTable
ALTER TABLE "requirements" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "evidences" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "test_run_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "tenant_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT NOT NULL DEFAULT '',
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("tenant_id","document_id","version")
);

-- CreateIndex
CREATE INDEX "evidences_tenant_id_test_run_id_idx" ON "evidences"("tenant_id", "test_run_id");

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_tenant_id_test_run_id_fkey" FOREIGN KEY ("tenant_id", "test_run_id") REFERENCES "test_runs"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_document_id_fkey" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "documents"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_author_id_fkey" FOREIGN KEY ("tenant_id", "author_id") REFERENCES "users"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
