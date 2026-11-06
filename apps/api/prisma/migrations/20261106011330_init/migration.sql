-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'program_manager', 'consultant', 'auditor');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('draft', 'active', 'on_hold', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "RequirementState" AS ENUM ('draft', 'approved', 'verified', 'validated');

-- CreateEnum
CREATE TYPE "TestResult" AS ENUM ('pass', 'fail', 'blocked');

-- CreateEnum
CREATE TYPE "NcSeverity" AS ENUM ('minor', 'major', 'critical');

-- CreateEnum
CREATE TYPE "NcState" AS ENUM ('open', 'in_analysis', 'corrective_action', 'closed', 'rejected');

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('public', 'restricted');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed_version" INTEGER NOT NULL DEFAULT 1,
    "chaos" JSONB NOT NULL DEFAULT '{"latencyMs":0,"errorRate":0,"flakyLabels":false}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "mfa_code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pending_approval" BOOLEAN NOT NULL DEFAULT false,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMP(3),
    "org" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "programs" (
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "ProgramStatus" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "classified" BOOLEAN NOT NULL DEFAULT false,
    "budget_eur" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("tenant_id","code")
);

-- CreateTable
CREATE TABLE "milestones" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "program_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "program_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "state" "RequirementState" NOT NULL DEFAULT 'draft',
    "parent_code" TEXT,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("tenant_id","code")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "program_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "expected" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("tenant_id","code")
);

-- CreateTable
CREATE TABLE "requirement_test_cases" (
    "tenant_id" TEXT NOT NULL,
    "requirement_code" TEXT NOT NULL,
    "test_case_code" TEXT NOT NULL,

    CONSTRAINT "requirement_test_cases_pkey" PRIMARY KEY ("tenant_id","requirement_code","test_case_code")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "test_case_code" TEXT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL,
    "result" "TestResult" NOT NULL,
    "evidence_url" TEXT,
    "executed_by" TEXT,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "non_conformities" (
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "program_code" TEXT NOT NULL,
    "severity" "NcSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "state" "NcState" NOT NULL DEFAULT 'open',
    "assignee_id" TEXT,
    "test_run_id" TEXT,

    CONSTRAINT "non_conformities_pkey" PRIMARY KEY ("tenant_id","code")
);

-- CreateTable
CREATE TABLE "documents" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "program_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "classification" "Classification" NOT NULL DEFAULT 'public',
    "file_url" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "diff" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("tenant_id","id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "tenant_id" TEXT NOT NULL,
    "program_code" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "amount_eur" INTEGER NOT NULL,
    "signed_at" DATE NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("tenant_id","program_code","supplier_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "programs_tenant_id_status_idx" ON "programs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "milestones_tenant_id_program_code_idx" ON "milestones"("tenant_id", "program_code");

-- CreateIndex
CREATE INDEX "requirements_tenant_id_program_code_idx" ON "requirements"("tenant_id", "program_code");

-- CreateIndex
CREATE INDEX "test_cases_tenant_id_program_code_idx" ON "test_cases"("tenant_id", "program_code");

-- CreateIndex
CREATE INDEX "test_runs_tenant_id_test_case_code_idx" ON "test_runs"("tenant_id", "test_case_code");

-- CreateIndex
CREATE INDEX "non_conformities_tenant_id_program_code_idx" ON "non_conformities"("tenant_id", "program_code");

-- CreateIndex
CREATE INDEX "documents_tenant_id_program_code_idx" ON "documents"("tenant_id", "program_code");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_at_idx" ON "audit_logs"("tenant_id", "at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_tenant_id_owner_id_fkey" FOREIGN KEY ("tenant_id", "owner_id") REFERENCES "users"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_tenant_id_program_code_fkey" FOREIGN KEY ("tenant_id", "program_code") REFERENCES "programs"("tenant_id", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_tenant_id_program_code_fkey" FOREIGN KEY ("tenant_id", "program_code") REFERENCES "programs"("tenant_id", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_tenant_id_parent_code_fkey" FOREIGN KEY ("tenant_id", "parent_code") REFERENCES "requirements"("tenant_id", "code") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_tenant_id_program_code_fkey" FOREIGN KEY ("tenant_id", "program_code") REFERENCES "programs"("tenant_id", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_test_cases" ADD CONSTRAINT "requirement_test_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_test_cases" ADD CONSTRAINT "requirement_test_cases_tenant_id_requirement_code_fkey" FOREIGN KEY ("tenant_id", "requirement_code") REFERENCES "requirements"("tenant_id", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_test_cases" ADD CONSTRAINT "requirement_test_cases_tenant_id_test_case_code_fkey" FOREIGN KEY ("tenant_id", "test_case_code") REFERENCES "test_cases"("tenant_id", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_tenant_id_test_case_code_fkey" FOREIGN KEY ("tenant_id", "test_case_code") REFERENCES "test_cases"("tenant_id", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_tenant_id_executed_by_fkey" FOREIGN KEY ("tenant_id", "executed_by") REFERENCES "users"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformities" ADD CONSTRAINT "non_conformities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformities" ADD CONSTRAINT "non_conformities_tenant_id_program_code_fkey" FOREIGN KEY ("tenant_id", "program_code") REFERENCES "programs"("tenant_id", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformities" ADD CONSTRAINT "non_conformities_tenant_id_assignee_id_fkey" FOREIGN KEY ("tenant_id", "assignee_id") REFERENCES "users"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_conformities" ADD CONSTRAINT "non_conformities_tenant_id_test_run_id_fkey" FOREIGN KEY ("tenant_id", "test_run_id") REFERENCES "test_runs"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_program_code_fkey" FOREIGN KEY ("tenant_id", "program_code") REFERENCES "programs"("tenant_id", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_actor_id_fkey" FOREIGN KEY ("tenant_id", "actor_id") REFERENCES "users"("tenant_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_program_code_fkey" FOREIGN KEY ("tenant_id", "program_code") REFERENCES "programs"("tenant_id", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_supplier_id_fkey" FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
