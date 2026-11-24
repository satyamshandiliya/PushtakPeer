import crypto from 'crypto';
import { count, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { hashPassword } from './auth.ts';

let seedPromise: Promise<void> | null = null;
let seededDone = false;

async function runSeed(): Promise<void> {
  const existingUsers = await db.select({ total: count() }).from(users);
  if ((existingUsers[0]?.total ?? 0) > 0) {
    seededDone = true;
    return;
  }

  const demoPassHash = hashPassword('Campus@123');

  const [aarav] = await db
    .insert(users)
    .values({
      uid: `local_${crypto.randomUUID()}`,
      name: 'Aarav Sharma',
      email: 'aarav@campus.edu',
      passwordHash: demoPassHash,
      collegeName: 'IIT Delhi',
      isBuyer: true,
      isSeller: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: 'Aarav Sharma' },
    })
    .returning();

  await db
    .insert(users)
    .values({
      uid: `local_${crypto.randomUUID()}`,
      name: 'Priya Nair',
      email: 'priya@campus.edu',
      passwordHash: demoPassHash,
      collegeName: 'IIT Delhi',
      isBuyer: true,
      isSeller: false,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: 'Priya Nair' },
    });

  await db
    .insert(users)
    .values({
      uid: `local_${crypto.randomUUID()}`,
      name: 'Meera Iyer',
      email: 'meera@campus.edu',
      passwordHash: demoPassHash,
      collegeName: 'Delhi University',
      isBuyer: false,
      isSeller: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: 'Meera Iyer' },
    });

  if (aarav) {
    await db
      .update(users)
      .set({ isBuyer: true, isSeller: true })
      .where(eq(users.id, aarav.id));
  }

  seededDone = true;
}

export async function ensureSeeded(): Promise<void> {
  if (seededDone) return;
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('Failed to seed initial PushtakPeer demo data:', err);
    });
  }
  await seedPromise;
}
