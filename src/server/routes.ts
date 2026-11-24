import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { type Request, type Response } from 'express';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import multer from 'multer';
import { db } from '../db/index.ts';
import {
  conversations,
  interestRequests,
  listingImages,
  listings,
  messages,
  notifications,
  users,
} from '../db/schema.ts';
import {
  canAccessConversation,
  canCreateInterestRequest,
  filterListings,
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_SIZE_BYTES,
  validateListingInput,
  validateProfileUpdateInput,
  validateRegistrationInput,
  validateUploadedImageMeta,
} from '../shared/validation.ts';
import {
  clearSessionCookie,
  hashPassword,
  optionalAuth,
  requireAuth,
  setSessionCookie,
  toSafeUser,
  verifyCsrfForCookieMutation,
  verifyPassword,
  type AuthRequest,
} from './auth.ts';
import { adminAuth } from './firebase-admin.ts';
import { realtimeHub } from './realtime.ts';
import { ensureSeeded } from './seed.ts';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_IMAGES_PER_LISTING,
  },
});

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function isAllowedImagePath(url: string): boolean {
  if (url.startsWith('/uploads/') || url.startsWith('/src/assets/images/')) {
    return !url.includes('..') && !url.includes('\\');
  }
  return false;
}

async function hydrateListings(rows: Array<typeof listings.$inferSelect>) {
  if (rows.length === 0) return [];
  const listingIds = rows.map((r) => r.id);
  const sellerIds = [...new Set(rows.map((r) => r.sellerId))];

  const [imagesRows, sellerRows] = await Promise.all([
    db
      .select()
      .from(listingImages)
      .where(inArray(listingImages.listingId, listingIds))
      .orderBy(listingImages.displayOrder, listingImages.id),
    db
      .select({
        id: users.id,
        name: users.name,
        collegeName: users.collegeName,
      })
      .from(users)
      .where(inArray(users.id, sellerIds)),
  ]);

  const imagesByListing = new Map<number, string[]>();
  for (const img of imagesRows) {
    if (!imagesByListing.has(img.listingId)) {
      imagesByListing.set(img.listingId, []);
    }
    imagesByListing.get(img.listingId)!.push(img.imageUrl);
  }

  const sellerMap = new Map(sellerRows.map((s) => [s.id, s]));

  return rows.map((row) => {
    const seller = sellerMap.get(row.sellerId);
    const images = imagesByListing.get(row.id) ?? [];
    return {
      id: row.id,
      sellerId: row.sellerId,
      sellerName: seller?.name ?? 'Campus Student',
      collegeName: seller?.collegeName ?? 'University Campus',
      title: row.title,
      description: row.description,
      category: row.category,
      notesFormat: row.notesFormat,
      condition: row.condition,
      price: row.price,
      status: row.status,
      images,
      coverImage: images[0] ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

async function getHydratedListingById(listingId: number) {
  const rows = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!rows[0]) return null;
  const hydrated = await hydrateListings(rows);
  return hydrated[0] ?? null;
}

export function createApiRouter() {
  const router = express.Router();

  // --- Auth & Profile Routes ---
  router.post('/auth/register', async (req: Request, res: Response) => {
    try {
      await ensureSeeded();
      const validation = validateRegistrationInput(req.body ?? {});
      if (!validation.valid || !validation.data) {
        return res.status(400).json({ error: 'Please fix the highlighted fields.', errors: validation.errors });
      }

      const { name, email, password, collegeName, isBuyer, isSeller } = validation.data;
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing[0]) {
        return res.status(409).json({
          error: 'An account with this email already exists.',
          errors: { email: 'This email is already registered.' },
        });
      }

      const passwordHash = hashPassword(password);
      const [created] = await db
        .insert(users)
        .values({
          uid: `local_${crypto.randomUUID()}`,
          name,
          email,
          passwordHash,
          collegeName,
          isBuyer,
          isSeller,
        })
        .returning();

      setSessionCookie(req, res, created.id);
      return res.status(201).json({ user: toSafeUser(created) });
    } catch (err) {
      console.error('Registration failed:', err);
      return res.status(500).json({ error: 'Unable to complete registration. Please try again.' });
    }
  });

  router.post('/auth/login', async (req: Request, res: Response) => {
    try {
      await ensureSeeded();
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = rows[0];
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      setSessionCookie(req, res, user.id);
      return res.json({ user: toSafeUser(user) });
    } catch (err) {
      console.error('Login failed:', err);
      return res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
    }
  });

  router.post('/auth/firebase', async (req: Request, res: Response) => {
    try {
      await ensureSeeded();
      const authHeader = req.headers.authorization;
      const token =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice('Bearer '.length).trim()
          : String(req.body?.idToken ?? '').trim();

      if (!token) {
        return res.status(401).json({ error: 'Missing Google sign-in token.' });
      }

      const decoded = await adminAuth.verifyIdToken(token);
      const email = (decoded.email ?? '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: 'Google account email is required.' });
      }

      const existingByUid = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
      if (existingByUid[0]) {
        setSessionCookie(req, res, existingByUid[0].id);
        return res.json({ user: toSafeUser(existingByUid[0]), needsOnboarding: false });
      }

      const existingByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingByEmail[0]) {
        const [linked] = await db
          .update(users)
          .set({ uid: decoded.uid, updatedAt: new Date() })
          .where(eq(users.id, existingByEmail[0].id))
          .returning();
        setSessionCookie(req, res, linked.id);
        return res.json({ user: toSafeUser(linked), needsOnboarding: false });
      }

      const collegeName = String(req.body?.collegeName ?? '').trim() || 'Campus Community';
      const displayName =
        String(req.body?.name ?? '').trim() || decoded.name || email.split('@')[0] || 'Student';

      const [created] = await db
        .insert(users)
        .values({
          uid: decoded.uid,
          name: displayName,
          email,
          passwordHash: null,
          collegeName,
          isBuyer: true,
          isSeller: true,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: { email, updatedAt: new Date() },
        })
        .returning();

      setSessionCookie(req, res, created.id);
      return res.status(201).json({ user: toSafeUser(created), needsOnboarding: !req.body?.collegeName });
    } catch (err) {
      console.error('Firebase auth exchange failed:', err);
      return res.status(401).json({ error: 'Unable to verify Google Sign-In session.' });
    }
  });

  router.post('/auth/logout', (req: Request, res: Response) => {
    if (!verifyCsrfForCookieMutation(req)) {
      return res.status(403).json({ error: 'Forbidden: Invalid request origin.' });
    }
    clearSessionCookie(req, res);
    return res.json({ ok: true });
  });

  router.get('/auth/me', optionalAuth, async (req: AuthRequest, res: Response) => {
    await ensureSeeded();
    if (!req.authUser) {
      return res.json({ user: null });
    }
    return res.json({ user: req.authUser });
  });

  router.put('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const validation = validateProfileUpdateInput(req.body ?? {});
      if (!validation.valid || !validation.data) {
        return res.status(400).json({ error: 'Please fix the highlighted fields.', errors: validation.errors });
      }

      const [updated] = await db
        .update(users)
        .set({
          name: validation.data.name,
          collegeName: validation.data.collegeName,
          isBuyer: validation.data.isBuyer,
          isSeller: validation.data.isSeller,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.authUser!.id))
        .returning();

      return res.json({ user: toSafeUser(updated) });
    } catch (err) {
      console.error('Profile update failed:', err);
      return res.status(500).json({ error: 'Unable to update profile.' });
    }
  });

  // --- Image Upload Route ---
  router.post('/uploads', requireAuth, (req: AuthRequest, res: Response) => {
    upload.array('images', MAX_IMAGES_PER_LISTING)(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Each image must be 5 MB or smaller.' });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_LISTING} images allowed per upload.` });
          }
        }
        return res.status(400).json({ error: 'Image upload failed. Please check file type and size.' });
      }

      const files = (req.files as Express.Multer.File[]) ?? [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'Please select at least one image file to upload.' });
      }

      for (const file of files) {
        const check = validateUploadedImageMeta(file.mimetype, file.size);
        if (!check.valid) {
          return res.status(400).json({ error: check.error });
        }
      }

      try {
        const urls: string[] = [];
        for (const file of files) {
          const ext = MIME_TO_EXT[file.mimetype] ?? '.jpg';
          const filename = `${crypto.randomUUID()}${ext}`;
          const targetPath = path.resolve(UPLOADS_DIR, filename);
          if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
            return res.status(400).json({ error: 'Invalid upload destination.' });
          }
          await fs.promises.writeFile(targetPath, file.buffer);
          urls.push(`/uploads/${filename}`);
        }
        return res.status(201).json({ urls });
      } catch (saveErr) {
        console.error('Saving uploaded files failed:', saveErr);
        return res.status(500).json({ error: 'Unable to save uploaded images.' });
      }
    });
  });

  // --- Listings Routes ---
  router.get('/listings', async (req: Request, res: Response) => {
    try {
      await ensureSeeded();
      const rows = await db
        .select()
        .from(listings)
        .where(eq(listings.status, 'Active'))
        .orderBy(desc(listings.createdAt), desc(listings.id));

      const hydrated = await hydrateListings(rows);
      const filtered = filterListings(hydrated, {
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        condition: typeof req.query.condition === 'string' ? req.query.condition : undefined,
      });

      return res.json({ listings: filtered });
    } catch (err) {
      console.error('Fetching listings failed:', err);
      return res.status(500).json({ error: 'Unable to load marketplace listings.' });
    }
  });

  router.get('/listings/mine', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureSeeded();
      const rows = await db
        .select()
        .from(listings)
        .where(eq(listings.sellerId, req.authUser!.id))
        .orderBy(desc(listings.createdAt), desc(listings.id));

      const hydrated = await hydrateListings(rows);
      const listingIds = hydrated.map((l) => l.id);

      const reqRows =
        listingIds.length > 0
          ? await db
              .select()
              .from(interestRequests)
              .where(inArray(interestRequests.listingId, listingIds))
          : [];

      const countsByListing = new Map<number, { pending: number; accepted: number }>();
      for (const r of reqRows) {
        if (!countsByListing.has(r.listingId)) {
          countsByListing.set(r.listingId, { pending: 0, accepted: 0 });
        }
        const bucket = countsByListing.get(r.listingId)!;
        if (r.status === 'Pending') bucket.pending += 1;
        if (r.status === 'Accepted') bucket.accepted += 1;
      }

      const enriched = hydrated.map((l) => ({
        ...l,
        pendingRequestsCount: countsByListing.get(l.id)?.pending ?? 0,
        acceptedRequestsCount: countsByListing.get(l.id)?.accepted ?? 0,
      }));

      return res.json({ listings: enriched });
    } catch (err) {
      console.error('Fetching seller listings failed:', err);
      return res.status(500).json({ error: 'Unable to load your seller listings.' });
    }
  });

  router.get('/listings/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureSeeded();
      const listingId = Number(req.params.id);
      if (!Number.isInteger(listingId) || listingId <= 0) {
        return res.status(400).json({ error: 'Invalid listing ID.' });
      }

      const item = await getHydratedListingById(listingId);
      if (!item) {
        return res.status(404).json({ error: 'Listing not found.' });
      }

      let myInterestRequest: {
        id: number;
        status: string;
        conversationId: number | null;
      } | null = null;

      if (req.authUser && req.authUser.id !== item.sellerId) {
        const reqRows = await db
          .select()
          .from(interestRequests)
          .where(
            and(
              eq(interestRequests.listingId, listingId),
              eq(interestRequests.buyerId, req.authUser.id)
            )
          )
          .limit(1);

        if (reqRows[0]) {
          let conversationId: number | null = null;
          if (reqRows[0].status === 'Accepted') {
            const convoRows = await db
              .select({ id: conversations.id })
              .from(conversations)
              .where(eq(conversations.interestRequestId, reqRows[0].id))
              .limit(1);
            conversationId = convoRows[0]?.id ?? null;
          }
          myInterestRequest = {
            id: reqRows[0].id,
            status: reqRows[0].status,
            conversationId,
          };
        }
      }

      return res.json({ listing: item, myInterestRequest });
    } catch (err) {
      console.error('Fetching listing detail failed:', err);
      return res.status(500).json({ error: 'Unable to load listing details.' });
    }
  });

  router.post('/listings', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.authUser!.isSeller) {
        return res.status(403).json({
          error: 'Seller role is required to create listings. Enable Seller role in your Profile.',
        });
      }

      const validation = validateListingInput(req.body ?? {});
      if (!validation.valid || !validation.data) {
        return res.status(400).json({ error: 'Please fix the highlighted fields.', errors: validation.errors });
      }

      for (const url of validation.data.imageUrls) {
        if (!isAllowedImagePath(url)) {
          return res.status(400).json({ error: 'Invalid image path provided.' });
        }
      }

      const createdId = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(listings)
          .values({
            sellerId: req.authUser!.id,
            title: validation.data!.title,
            description: validation.data!.description,
            category: validation.data!.category,
            notesFormat: validation.data!.notesFormat,
            condition: validation.data!.condition,
            price: validation.data!.price,
            status: 'Active',
          })
          .returning();

        for (let i = 0; i < validation.data!.imageUrls.length; i++) {
          await tx.insert(listingImages).values({
            listingId: inserted.id,
            imageUrl: validation.data!.imageUrls[i],
            displayOrder: i,
          });
        }

        return inserted.id;
      });

      const hydrated = await getHydratedListingById(createdId);
      if (hydrated) {
        realtimeHub.broadcastAll('listing:created', hydrated);
      }

      return res.status(201).json({ listing: hydrated });
    } catch (err) {
      console.error('Creating listing failed:', err);
      return res.status(500).json({ error: 'Unable to publish listing right now.' });
    }
  });

  router.put('/listings/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const listingId = Number(req.params.id);
      if (!Number.isInteger(listingId) || listingId <= 0) {
        return res.status(400).json({ error: 'Invalid listing ID.' });
      }

      const existing = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      if (!existing[0]) {
        return res.status(404).json({ error: 'Listing not found.' });
      }
      if (existing[0].sellerId !== req.authUser!.id) {
        return res.status(403).json({ error: 'You can only edit your own listings.' });
      }

      const validation = validateListingInput(req.body ?? {});
      if (!validation.valid || !validation.data) {
        return res.status(400).json({ error: 'Please fix the highlighted fields.', errors: validation.errors });
      }

      for (const url of validation.data.imageUrls) {
        if (!isAllowedImagePath(url)) {
          return res.status(400).json({ error: 'Invalid image path provided.' });
        }
      }

      await db.transaction(async (tx) => {
        await tx
          .update(listings)
          .set({
            title: validation.data!.title,
            description: validation.data!.description,
            category: validation.data!.category,
            notesFormat: validation.data!.notesFormat,
            condition: validation.data!.condition,
            price: validation.data!.price,
            updatedAt: new Date(),
          })
          .where(eq(listings.id, listingId));

        await tx.delete(listingImages).where(eq(listingImages.listingId, listingId));
        for (let i = 0; i < validation.data!.imageUrls.length; i++) {
          await tx.insert(listingImages).values({
            listingId,
            imageUrl: validation.data!.imageUrls[i],
            displayOrder: i,
          });
        }
      });

      const hydrated = await getHydratedListingById(listingId);
      if (hydrated) {
        realtimeHub.broadcastAll('listing:updated', hydrated);
      }

      return res.json({ listing: hydrated });
    } catch (err) {
      console.error('Updating listing failed:', err);
      return res.status(500).json({ error: 'Unable to update listing.' });
    }
  });

  router.post('/listings/:id/mark-sold', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const listingId = Number(req.params.id);
      if (!Number.isInteger(listingId) || listingId <= 0) {
        return res.status(400).json({ error: 'Invalid listing ID.' });
      }

      const existing = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      if (!existing[0]) {
        return res.status(404).json({ error: 'Listing not found.' });
      }
      if (existing[0].sellerId !== req.authUser!.id) {
        return res.status(403).json({ error: 'You can only update your own listings.' });
      }

      await db
        .update(listings)
        .set({ status: 'Sold', updatedAt: new Date() })
        .where(eq(listings.id, listingId));

      realtimeHub.broadcastAll('listing:sold', { id: listingId });
      const hydrated = await getHydratedListingById(listingId);
      return res.json({ listing: hydrated });
    } catch (err) {
      console.error('Marking listing sold failed:', err);
      return res.status(500).json({ error: 'Unable to mark listing as sold.' });
    }
  });

  router.delete('/listings/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const listingId = Number(req.params.id);
      if (!Number.isInteger(listingId) || listingId <= 0) {
        return res.status(400).json({ error: 'Invalid listing ID.' });
      }

      const existing = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      if (!existing[0]) {
        return res.status(404).json({ error: 'Listing not found.' });
      }
      if (existing[0].sellerId !== req.authUser!.id) {
        return res.status(403).json({ error: 'You can only delete your own listings.' });
      }

      await db.delete(listings).where(eq(listings.id, listingId));
      realtimeHub.broadcastAll('listing:deleted', { id: listingId });
      return res.json({ ok: true });
    } catch (err) {
      console.error('Deleting listing failed:', err);
      return res.status(500).json({ error: 'Unable to delete listing.' });
    }
  });

  // --- Interest Request Routes ---
  router.post('/listings/:id/interest', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.authUser!.isBuyer) {
        return res.status(403).json({
          error: 'Buyer role is required to express interest. Enable Buyer role in your Profile.',
        });
      }

      const listingId = Number(req.params.id);
      if (!Number.isInteger(listingId) || listingId <= 0) {
        return res.status(400).json({ error: 'Invalid listing ID.' });
      }

      const listingRows = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      const listing = listingRows[0];
      if (!listing) {
        return res.status(404).json({ error: 'Listing not found.' });
      }

      const existingRows = await db
        .select()
        .from(interestRequests)
        .where(
          and(
            eq(interestRequests.listingId, listingId),
            eq(interestRequests.buyerId, req.authUser!.id)
          )
        )
        .limit(1);

      const eligibility = canCreateInterestRequest({
        listingStatus: listing.status as 'Active' | 'Sold',
        listingSellerId: listing.sellerId,
        buyerId: req.authUser!.id,
        existingRequestStatus: existingRows[0]?.status as 'Pending' | 'Accepted' | 'Declined' | undefined,
      });

      if (!eligibility.allowed) {
        return res.status(409).json({ error: eligibility.reason });
      }

      const result = await db.transaction(async (tx) => {
        const [createdRequest] = await tx
          .insert(interestRequests)
          .values({
            listingId,
            buyerId: req.authUser!.id,
            sellerId: listing.sellerId,
            status: 'Pending',
          })
          .returning();

        const [createdNotification] = await tx
          .insert(notifications)
          .values({
            userId: listing.sellerId,
            type: 'InterestRequest',
            title: 'New Interest Request',
            message: `${req.authUser!.name} (${req.authUser!.collegeName}) is interested in "${listing.title}".`,
            relatedListingId: listingId,
            relatedConversationId: null,
            isRead: false,
          })
          .returning();

        return { createdRequest, createdNotification };
      });

      realtimeHub.sendToUser(listing.sellerId, 'notification:new', result.createdNotification);
      realtimeHub.sendToUsers([listing.sellerId, req.authUser!.id], 'interest:updated', {
        listingId,
        requestId: result.createdRequest.id,
        status: 'Pending',
      });

      return res.status(201).json({
        interestRequest: {
          id: result.createdRequest.id,
          status: result.createdRequest.status,
          conversationId: null,
        },
      });
    } catch (err) {
      console.error('Creating interest request failed:', err);
      return res.status(500).json({ error: 'Unable to send interest request.' });
    }
  });

  router.get('/interest-requests/sent', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const reqRows = await db
        .select()
        .from(interestRequests)
        .where(eq(interestRequests.buyerId, req.authUser!.id))
        .orderBy(desc(interestRequests.createdAt));

      if (reqRows.length === 0) return res.json({ requests: [] });

      const listingIds = [...new Set(reqRows.map((r) => r.listingId))];
      const sellerIds = [...new Set(reqRows.map((r) => r.sellerId))];
      const requestIds = reqRows.map((r) => r.id);

      const [listingRows, sellerRows, imageRows, convoRows] = await Promise.all([
        db.select().from(listings).where(inArray(listings.id, listingIds)),
        db
          .select({ id: users.id, name: users.name, collegeName: users.collegeName })
          .from(users)
          .where(inArray(users.id, sellerIds)),
        db
          .select()
          .from(listingImages)
          .where(inArray(listingImages.listingId, listingIds))
          .orderBy(listingImages.displayOrder, listingImages.id),
        db
          .select()
          .from(conversations)
          .where(inArray(conversations.interestRequestId, requestIds)),
      ]);

      const listingMap = new Map(listingRows.map((l) => [l.id, l]));
      const sellerMap = new Map(sellerRows.map((s) => [s.id, s]));
      const convoMap = new Map(convoRows.map((c) => [c.interestRequestId, c.id]));
      const coverMap = new Map<number, string>();
      for (const img of imageRows) {
        if (!coverMap.has(img.listingId)) coverMap.set(img.listingId, img.imageUrl);
      }

      const enriched = reqRows.map((r) => {
        const listing = listingMap.get(r.listingId);
        const seller = sellerMap.get(r.sellerId);
        return {
          id: r.id,
          listingId: r.listingId,
          listingTitle: listing?.title ?? 'Listing',
          listingPrice: listing?.price ?? 0,
          listingCategory: listing?.category ?? 'Book',
          listingStatus: listing?.status ?? 'Active',
          coverImage: coverMap.get(r.listingId) ?? null,
          sellerId: r.sellerId,
          sellerName: seller?.name ?? 'Seller',
          sellerCollege: seller?.collegeName ?? '',
          status: r.status,
          conversationId: convoMap.get(r.id) ?? null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });

      return res.json({ requests: enriched });
    } catch (err) {
      console.error('Fetching sent interest requests failed:', err);
      return res.status(500).json({ error: 'Unable to load your sent interest requests.' });
    }
  });

  router.get('/interest-requests/received', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const reqRows = await db
        .select()
        .from(interestRequests)
        .where(eq(interestRequests.sellerId, req.authUser!.id))
        .orderBy(desc(interestRequests.createdAt));

      if (reqRows.length === 0) return res.json({ requests: [] });

      const listingIds = [...new Set(reqRows.map((r) => r.listingId))];
      const buyerIds = [...new Set(reqRows.map((r) => r.buyerId))];
      const requestIds = reqRows.map((r) => r.id);

      const [listingRows, buyerRows, convoRows] = await Promise.all([
        db.select().from(listings).where(inArray(listings.id, listingIds)),
        db
          .select({ id: users.id, name: users.name, collegeName: users.collegeName })
          .from(users)
          .where(inArray(users.id, buyerIds)),
        db
          .select()
          .from(conversations)
          .where(inArray(conversations.interestRequestId, requestIds)),
      ]);

      const listingMap = new Map(listingRows.map((l) => [l.id, l]));
      const buyerMap = new Map(buyerRows.map((b) => [b.id, b]));
      const convoMap = new Map(convoRows.map((c) => [c.interestRequestId, c.id]));

      const enriched = reqRows.map((r) => {
        const listing = listingMap.get(r.listingId);
        const buyer = buyerMap.get(r.buyerId);
        return {
          id: r.id,
          listingId: r.listingId,
          listingTitle: listing?.title ?? 'Listing',
          listingPrice: listing?.price ?? 0,
          listingStatus: listing?.status ?? 'Active',
          buyerId: r.buyerId,
          buyerName: buyer?.name ?? 'Student',
          buyerCollege: buyer?.collegeName ?? '',
          status: r.status,
          conversationId: convoMap.get(r.id) ?? null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });

      return res.json({ requests: enriched });
    } catch (err) {
      console.error('Fetching received interest requests failed:', err);
      return res.status(500).json({ error: 'Unable to load incoming interest requests.' });
    }
  });

  router.post(
    '/interest-requests/:id/respond',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const requestId = Number(req.params.id);
        const decision = req.body?.decision;
        if (!Number.isInteger(requestId) || requestId <= 0) {
          return res.status(400).json({ error: 'Invalid interest request ID.' });
        }
        if (decision !== 'Accepted' && decision !== 'Declined') {
          return res.status(400).json({ error: 'Decision must be Accepted or Declined.' });
        }

        const existingRows = await db
          .select()
          .from(interestRequests)
          .where(eq(interestRequests.id, requestId))
          .limit(1);
        const existing = existingRows[0];
        if (!existing) {
          return res.status(404).json({ error: 'Interest request not found.' });
        }
        if (existing.sellerId !== req.authUser!.id) {
          return res.status(403).json({ error: 'Only the listing seller can respond to this request.' });
        }
        if (existing.status !== 'Pending') {
          return res.status(409).json({ error: `This request has already been ${existing.status.toLowerCase()}.` });
        }

        const listingRows = await db
          .select()
          .from(listings)
          .where(eq(listings.id, existing.listingId))
          .limit(1);
        const listingTitle = listingRows[0]?.title ?? 'your requested item';

        const outcome = await db.transaction(async (tx) => {
          const [updatedReq] = await tx
            .update(interestRequests)
            .set({ status: decision, updatedAt: new Date() })
            .where(eq(interestRequests.id, requestId))
            .returning();

          let convoId: number | null = null;
          let buyerNotif: typeof notifications.$inferSelect | null = null;

          if (decision === 'Accepted') {
            const [convo] = await tx
              .insert(conversations)
              .values({
                listingId: existing.listingId,
                interestRequestId: existing.id,
                buyerId: existing.buyerId,
                sellerId: existing.sellerId,
              })
              .onConflictDoNothing()
              .returning();

            if (convo) {
              convoId = convo.id;
            } else {
              const found = await tx
                .select()
                .from(conversations)
                .where(eq(conversations.interestRequestId, existing.id))
                .limit(1);
              convoId = found[0]?.id ?? null;
            }

            const [notif] = await tx
              .insert(notifications)
              .values({
                userId: existing.buyerId,
                type: 'ChatAccepted',
                title: 'Chat Request Accepted',
                message: `${req.authUser!.name} accepted your request for "${listingTitle}". You can now chat privately.`,
                relatedListingId: existing.listingId,
                relatedConversationId: convoId,
                isRead: false,
              })
              .returning();
            buyerNotif = notif;
          }

          return { updatedReq, convoId, buyerNotif };
        });

        if (outcome.buyerNotif) {
          realtimeHub.sendToUser(existing.buyerId, 'notification:new', outcome.buyerNotif);
        }
        realtimeHub.sendToUsers([existing.buyerId, existing.sellerId], 'interest:updated', {
          listingId: existing.listingId,
          requestId,
          status: decision,
          conversationId: outcome.convoId,
        });

        return res.json({
          request: outcome.updatedReq,
          conversationId: outcome.convoId,
        });
      } catch (err) {
        console.error('Responding to interest request failed:', err);
        return res.status(500).json({ error: 'Unable to update interest request.' });
      }
    }
  );

  // --- Conversations & Private Chat Routes ---
  router.get('/conversations', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.authUser!.id;
      const convoRows = await db
        .select()
        .from(conversations)
        .where(or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)))
        .orderBy(desc(conversations.createdAt));

      if (convoRows.length === 0) return res.json({ conversations: [] });

      const listingIds = [...new Set(convoRows.map((c) => c.listingId))];
      const peerIds = [
        ...new Set(convoRows.map((c) => (c.buyerId === userId ? c.sellerId : c.buyerId))),
      ];
      const convoIds = convoRows.map((c) => c.id);

      const [listingRows, peerRows, imageRows, messageRows] = await Promise.all([
        db.select().from(listings).where(inArray(listings.id, listingIds)),
        db
          .select({ id: users.id, name: users.name, collegeName: users.collegeName })
          .from(users)
          .where(inArray(users.id, peerIds)),
        db
          .select()
          .from(listingImages)
          .where(inArray(listingImages.listingId, listingIds))
          .orderBy(listingImages.displayOrder, listingImages.id),
        db
          .select()
          .from(messages)
          .where(inArray(messages.conversationId, convoIds))
          .orderBy(desc(messages.createdAt), desc(messages.id)),
      ]);

      const listingMap = new Map(listingRows.map((l) => [l.id, l]));
      const peerMap = new Map(peerRows.map((p) => [p.id, p]));
      const coverMap = new Map<number, string>();
      for (const img of imageRows) {
        if (!coverMap.has(img.listingId)) coverMap.set(img.listingId, img.imageUrl);
      }

      const lastMsgMap = new Map<number, typeof messages.$inferSelect>();
      for (const msg of messageRows) {
        if (!lastMsgMap.has(msg.conversationId)) {
          lastMsgMap.set(msg.conversationId, msg);
        }
      }

      const enriched = convoRows.map((c) => {
        const listing = listingMap.get(c.listingId);
        const peerId = c.buyerId === userId ? c.sellerId : c.buyerId;
        const peer = peerMap.get(peerId);
        const lastMsg = lastMsgMap.get(c.id);
        return {
          id: c.id,
          listingId: c.listingId,
          listingTitle: listing?.title ?? 'Listing',
          listingPrice: listing?.price ?? 0,
          listingStatus: listing?.status ?? 'Active',
          coverImage: coverMap.get(c.listingId) ?? null,
          myRole: c.buyerId === userId ? 'Buyer' : 'Seller',
          peerId,
          peerName: peer?.name ?? 'Student',
          peerCollege: peer?.collegeName ?? '',
          lastMessage: lastMsg?.body ?? null,
          lastMessageAt: lastMsg?.createdAt ?? c.createdAt,
          createdAt: c.createdAt,
        };
      });

      enriched.sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      return res.json({ conversations: enriched });
    } catch (err) {
      console.error('Fetching conversations failed:', err);
      return res.status(500).json({ error: 'Unable to load conversations.' });
    }
  });

  router.get('/conversations/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const convoId = Number(req.params.id);
      if (!Number.isInteger(convoId) || convoId <= 0) {
        return res.status(400).json({ error: 'Invalid conversation ID.' });
      }

      const convoRows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, convoId))
        .limit(1);
      const convo = convoRows[0];
      if (!convo) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
      if (!canAccessConversation(req.authUser!.id, convo)) {
        return res.status(403).json({ error: 'Forbidden: You are not a participant in this conversation.' });
      }

      const msgRows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, convoId))
        .orderBy(messages.createdAt, messages.id);

      return res.json({ messages: msgRows });
    } catch (err) {
      console.error('Fetching conversation messages failed:', err);
      return res.status(500).json({ error: 'Unable to load messages.' });
    }
  });

  router.post('/conversations/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const convoId = Number(req.params.id);
      if (!Number.isInteger(convoId) || convoId <= 0) {
        return res.status(400).json({ error: 'Invalid conversation ID.' });
      }

      const body = String(req.body?.body ?? '').trim();
      if (body.length < 1 || body.length > 1500) {
        return res.status(400).json({ error: 'Message must be between 1 and 1500 characters.' });
      }

      const convoRows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, convoId))
        .limit(1);
      const convo = convoRows[0];
      if (!convo) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
      if (!canAccessConversation(req.authUser!.id, convo)) {
        return res.status(403).json({ error: 'Forbidden: You are not a participant in this conversation.' });
      }

      const recipientId = convo.buyerId === req.authUser!.id ? convo.sellerId : convo.buyerId;
      const listingRows = await db
        .select({ title: listings.title })
        .from(listings)
        .where(eq(listings.id, convo.listingId))
        .limit(1);
      const listingTitle = listingRows[0]?.title ?? 'listing';

      const result = await db.transaction(async (tx) => {
        const [createdMsg] = await tx
          .insert(messages)
          .values({
            conversationId: convoId,
            senderId: req.authUser!.id,
            body,
          })
          .returning();

        const [createdNotif] = await tx
          .insert(notifications)
          .values({
            userId: recipientId,
            type: 'NewMessage',
            title: 'New Message',
            message: `${req.authUser!.name} sent a message about "${listingTitle}".`,
            relatedListingId: convo.listingId,
            relatedConversationId: convoId,
            isRead: false,
          })
          .returning();

        return { createdMsg, createdNotif };
      });

      realtimeHub.sendToUsers([convo.buyerId, convo.sellerId], 'chat:message', {
        ...result.createdMsg,
        senderName: req.authUser!.name,
      });
      realtimeHub.sendToUser(recipientId, 'notification:new', result.createdNotif);

      return res.status(201).json({ message: result.createdMsg });
    } catch (err) {
      console.error('Sending message failed:', err);
      return res.status(500).json({ error: 'Unable to send message.' });
    }
  });

  // --- Notifications Routes ---
  router.get('/notifications', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, req.authUser!.id))
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(60);

      const unreadCount = rows.filter((n) => !n.isRead).length;
      return res.json({ notifications: rows, unreadCount });
    } catch (err) {
      console.error('Fetching notifications failed:', err);
      return res.status(500).json({ error: 'Unable to load notifications.' });
    }
  });

  router.post('/notifications/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const notifId = Number(req.params.id);
      if (!Number.isInteger(notifId) || notifId <= 0) {
        return res.status(400).json({ error: 'Invalid notification ID.' });
      }

      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, notifId), eq(notifications.userId, req.authUser!.id)));

      return res.json({ ok: true });
    } catch (err) {
      console.error('Marking notification read failed:', err);
      return res.status(500).json({ error: 'Unable to update notification.' });
    }
  });

  router.post('/notifications/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, req.authUser!.id));

      return res.json({ ok: true });
    } catch (err) {
      console.error('Marking all notifications read failed:', err);
      return res.status(500).json({ error: 'Unable to update notifications.' });
    }
  });

  return router;
}
