import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { config } from "./env";

const adapter = new PrismaMariaDb(config.databaseUrl);

export const prisma = new PrismaClient({ adapter });
