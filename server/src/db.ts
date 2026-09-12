import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { config } from "./env";

const adapter = new PrismaPg({ connectionString: config.databaseUrl });

export const prisma = new PrismaClient({ adapter });
