import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Required for Node.js < 21 which lacks native WebSocket
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL!;
const shouldUseNeonAdapter = /neon\.tech|aws\.neon\.tech|pooler\./i.test(connectionString);

const prisma = shouldUseNeonAdapter
  ? new PrismaClient({
      adapter: new PrismaNeon({ connectionString }),
    } as any)
  : new PrismaClient();

export default prisma;
