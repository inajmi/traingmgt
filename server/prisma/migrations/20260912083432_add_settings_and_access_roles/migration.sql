-- CreateEnum
CREATE TYPE "PermissionKey" AS ENUM ('SETTINGS_MANAGE', 'USERS_MANAGE', 'ROLES_MANAGE', 'TRAINERS_MANAGE', 'SESSIONS_MANAGE', 'REGISTRATIONS_MANAGE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessRoleId" TEXT;

-- CreateTable
CREATE TABLE "AccessRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permission" "PermissionKey" NOT NULL,

    CONSTRAINT "AccessRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "smtpHost" TEXT,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpUser" TEXT,
    "smtpPassEncrypted" TEXT,
    "smtpFrom" TEXT,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 10080,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRole_name_key" ON "AccessRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRolePermission_roleId_permission_key" ON "AccessRolePermission"("roleId", "permission");

-- CreateIndex
CREATE INDEX "User_accessRoleId_idx" ON "User"("accessRoleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRolePermission" ADD CONSTRAINT "AccessRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
