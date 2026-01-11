/**
 * Database Client - Singleton Pattern
 * 
 * Prevents multiple PrismaClient instances during development hot-reloads.
 * Usage: import { prisma } from "~/db.server"
 */

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Singleton pattern: reuse existing client in development
export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

// Also export as default for backward compatibility
export default prisma;
