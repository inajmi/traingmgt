-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TRAINER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AvailStatus" AS ENUM ('Available', 'Limited', 'Holiday', 'Unavailable');

-- CreateEnum
CREATE TYPE "SessionFormat" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('USER', 'SYSTEM_ASSIGNED', 'SYSTEM_ACCEPTED', 'SYSTEM_DECLINED', 'SYSTEM_APPROVED', 'SYSTEM_REJECTED', 'SYSTEM_RESET', 'SYSTEM_REMINDER', 'SYSTEM_SERIES', 'SYSTEM_CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "profession" TEXT,
    "itsId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'TRAINER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trainer" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "itsId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "profession" TEXT,
    "surveyExpertise" TEXT,
    "surveyTopics" TEXT,
    "surveyFormat" TEXT,
    "surveyDayAvailability" TEXT,
    "finalTopics" TEXT,
    "preferredFormat" TEXT,
    "preferredDays" TEXT,
    "preferredTime" TEXT,
    "maxSessions" INTEGER,
    "minNotice" TEXT,
    "languages" TEXT,
    "constraints" TEXT,
    "meetingStatus" TEXT,
    "meetingDate" DATE,
    "willingness" TEXT,
    "freeTraining" TEXT,
    "fee" TEXT,
    "followUp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "status" "AvailStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "format" "SessionFormat" NOT NULL DEFAULT 'IN_PERSON',
    "venue" TEXT,
    "link" TEXT,
    "notes" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "remindedAt" TIMESTAMP(3),
    "seriesId" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionSeries" (
    "id" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "interval" INTEGER NOT NULL,
    "until" DATE NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "startAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "SessionSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTrainer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedById" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "SessionTrainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ThreadParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "body" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Trainer_userId_key" ON "Trainer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Trainer_email_key" ON "Trainer"("email");

-- CreateIndex
CREATE INDEX "Trainer_email_idx" ON "Trainer"("email");

-- CreateIndex
CREATE INDEX "Trainer_userId_idx" ON "Trainer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_trainerId_year_month_key" ON "Availability"("trainerId", "year", "month");

-- CreateIndex
CREATE INDEX "Session_startsAt_idx" ON "Session"("startsAt");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Session_seriesId_idx" ON "Session"("seriesId");

-- CreateIndex
CREATE INDEX "SessionSeries_createdById_idx" ON "SessionSeries"("createdById");

-- CreateIndex
CREATE INDEX "SessionTrainer_trainerId_idx" ON "SessionTrainer"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTrainer_sessionId_trainerId_key" ON "SessionTrainer"("sessionId", "trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "Thread_sessionId_key" ON "Thread"("sessionId");

-- CreateIndex
CREATE INDEX "ThreadParticipant_userId_idx" ON "ThreadParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadParticipant_threadId_userId_key" ON "ThreadParticipant"("threadId", "userId");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Trainer" ADD CONSTRAINT "Trainer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "SessionSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSeries" ADD CONSTRAINT "SessionSeries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTrainer" ADD CONSTRAINT "SessionTrainer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTrainer" ADD CONSTRAINT "SessionTrainer_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTrainer" ADD CONSTRAINT "SessionTrainer_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
