-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `profession` VARCHAR(191) NULL,
    `itsId` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'TRAINER') NOT NULL DEFAULT 'TRAINER',
    `status` ENUM('PENDING', 'ACTIVE', 'REJECTED', 'DISABLED') NOT NULL DEFAULT 'PENDING',
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `tokenVersion` INTEGER NOT NULL DEFAULT 0,
    `lastLoginAt` DATETIME(3) NULL,
    `accessRoleId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_accessRoleId_idx`(`accessRoleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessRole` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccessRole_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessRolePermission` (
    `id` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `permission` ENUM('SETTINGS_MANAGE', 'USERS_MANAGE', 'ROLES_MANAGE', 'TRAINERS_MANAGE', 'SESSIONS_MANAGE', 'REGISTRATIONS_MANAGE') NOT NULL,

    UNIQUE INDEX `AccessRolePermission_roleId_permission_key`(`roleId`, `permission`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSetting` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `smtpHost` VARCHAR(191) NULL,
    `smtpPort` INTEGER NOT NULL DEFAULT 587,
    `smtpSecure` BOOLEAN NOT NULL DEFAULT false,
    `smtpUser` VARCHAR(191) NULL,
    `smtpPassEncrypted` TEXT NULL,
    `smtpFrom` VARCHAR(191) NULL,
    `sessionTimeoutMinutes` INTEGER NOT NULL DEFAULT 10080,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Trainer` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `itsId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `profession` VARCHAR(191) NULL,
    `surveyExpertise` TEXT NULL,
    `surveyTopics` TEXT NULL,
    `surveyFormat` TEXT NULL,
    `surveyDayAvailability` TEXT NULL,
    `finalTopics` TEXT NULL,
    `preferredFormat` TEXT NULL,
    `preferredDays` TEXT NULL,
    `preferredTime` TEXT NULL,
    `maxSessions` INTEGER NULL,
    `minNotice` TEXT NULL,
    `languages` TEXT NULL,
    `constraints` TEXT NULL,
    `meetingStatus` VARCHAR(191) NULL,
    `meetingDate` DATE NULL,
    `willingness` TEXT NULL,
    `freeTraining` TEXT NULL,
    `fee` VARCHAR(191) NULL,
    `followUp` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Trainer_userId_key`(`userId`),
    UNIQUE INDEX `Trainer_email_key`(`email`),
    INDEX `Trainer_email_idx`(`email`),
    INDEX `Trainer_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Availability` (
    `id` VARCHAR(191) NOT NULL,
    `trainerId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` VARCHAR(191) NOT NULL,
    `status` ENUM('Available', 'Limited', 'Holiday', 'Unavailable') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Availability_trainerId_year_month_key`(`trainerId`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `topic` TEXT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `format` ENUM('IN_PERSON', 'ONLINE', 'HYBRID') NOT NULL DEFAULT 'IN_PERSON',
    `venue` VARCHAR(191) NULL,
    `link` TEXT NULL,
    `notes` TEXT NULL,
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `remindedAt` DATETIME(3) NULL,
    `seriesId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Session_startsAt_idx`(`startsAt`),
    INDEX `Session_status_idx`(`status`),
    INDEX `Session_seriesId_idx`(`seriesId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionSeries` (
    `id` VARCHAR(191) NOT NULL,
    `frequency` VARCHAR(191) NOT NULL,
    `interval` INTEGER NOT NULL,
    `until` DATE NOT NULL,
    `dayOfWeek` INTEGER NULL,
    `dayOfMonth` INTEGER NULL,
    `startAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,

    INDEX `SessionSeries_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionTrainer` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `trainerId` VARCHAR(191) NOT NULL,
    `status` ENUM('ASSIGNED', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'ASSIGNED',
    `assignedById` VARCHAR(191) NOT NULL,
    `respondedAt` DATETIME(3) NULL,

    INDEX `SessionTrainer_trainerId_idx`(`trainerId`),
    UNIQUE INDEX `SessionTrainer_sessionId_trainerId_key`(`sessionId`, `trainerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Thread` (
    `id` VARCHAR(191) NOT NULL,
    `subject` TEXT NULL,
    `sessionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Thread_sessionId_key`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreadParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `lastReadAt` DATETIME(3) NULL,

    INDEX `ThreadParticipant_userId_idx`(`userId`),
    UNIQUE INDEX `ThreadParticipant_threadId_userId_key`(`threadId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `senderUserId` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `kind` ENUM('USER', 'SYSTEM_ASSIGNED', 'SYSTEM_ACCEPTED', 'SYSTEM_DECLINED', 'SYSTEM_APPROVED', 'SYSTEM_REJECTED', 'SYSTEM_RESET', 'SYSTEM_REMINDER', 'SYSTEM_SERIES', 'SYSTEM_CANCELLED') NOT NULL DEFAULT 'USER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_threadId_createdAt_idx`(`threadId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_accessRoleId_fkey` FOREIGN KEY (`accessRoleId`) REFERENCES `AccessRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessRolePermission` ADD CONSTRAINT `AccessRolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `AccessRole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Trainer` ADD CONSTRAINT `Trainer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Availability` ADD CONSTRAINT `Availability_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `Trainer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `SessionSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionSeries` ADD CONSTRAINT `SessionSeries_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionTrainer` ADD CONSTRAINT `SessionTrainer_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionTrainer` ADD CONSTRAINT `SessionTrainer_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `Trainer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionTrainer` ADD CONSTRAINT `SessionTrainer_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Thread` ADD CONSTRAINT `Thread_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreadParticipant` ADD CONSTRAINT `ThreadParticipant_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `Thread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreadParticipant` ADD CONSTRAINT `ThreadParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `Thread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderUserId_fkey` FOREIGN KEY (`senderUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
