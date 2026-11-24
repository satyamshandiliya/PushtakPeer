# PushtakPeer — Campus Book & Notes Marketplace

**Tagline:** *Your Campus. Your Books. Your Community.*

PushtakPeer is a full-stack student-to-student marketplace for buying and selling second-hand academic textbooks and study notes (both hardcopy and digital), featuring seller-approved private chat, real-time notifications, and live marketplace updates.

> **Runtime Note:** Because the AI Studio execution container provides a Node.js + PostgreSQL (Cloud SQL) runtime without a `.NET` SDK, this live runnable application implements the full **HTML5, CSS3, Bootstrap 5, and Vanilla JavaScript/TypeScript** frontend (with zero React) backed by a clean modular **Express + TypeScript + Drizzle ORM + PostgreSQL + WebSocket** server and **Firebase Auth + scrypt session authentication**.

---

## Key Features

- **Landing Page & Branding:** Warm off-white & forest-green editorial design with Sign Up, Login, and live marketplace preview.
- **Authentication & Profiles:**
  - Registration with Full Name, Email, Password, Confirm Password, College Name, and Role selection (`Buyer`, `Seller`, or `Both`).
  - Google Sign-In via Firebase Authentication plus server-hashed (`scrypt` + per-user salt) email/password authentication.
  - Profile management to update Name, College Name, and switch roles (`Buyer`, `Seller`, `Both`).
- **Seller Workflow & Listing Rules:**
  - Choose `Books` or `Notes`.
  - **Books:** Require Condition (`Excellent`, `Good`, `Moderate`, `Poor`), Title, Description, Photos, and Asking Price.
  - **Notes:** Require Format (`Hardcopy` or `Digital`).
    - **Hardcopy Notes:** Require Condition, Title, Description, Photos, and Asking Price.
    - **Digital Notes:** Require Title, Description, Preview Images, and Asking Price — **no Condition field**.
  - Safe server-side image uploads (`JPG`, `PNG`, `WebP`, max `5 MB` per file, up to `6` images).
- **Real-Time Marketplace, Notifications & Private Chat (WebSockets):**
  - Newly published listings appear in connected buyers' Marketplace views immediately without refreshing.
  - Simple search bar plus Books/Notes category toggle and Condition filter.
  - **"I'm Interested"** sends an instant notification to the seller and blocks duplicate active requests from the same buyer.
  - Sellers accept or decline incoming requests. Private 1-on-1 chat unlocks **only after seller acceptance**, enforced with server-side participant authorization.
  - Notifications tab with unread badge count, notification types (`New Interest Request`, `Chat Accepted`, `New Message`), timestamps, and direct links.
  - Seller Hub with Active/Sold listings, Edit, Delete (with confirmation), and Mark as Sold (removes item from buyer browsing and blocks new interest requests).

---

## Database Schema (PostgreSQL + Drizzle ORM)

Defined in `src/db/schema.ts`:
- `users`
- `listings`
- `listing_images`
- `interest_requests` (with unique constraint on `(listing_id, buyer_id)`)
- `conversations` (with unique constraint on `interest_request_id`)
- `messages`
- `notifications`

---

## Environment Configuration

The runtime uses Cloud SQL PostgreSQL and Firebase configuration:
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD` (runtime pool)
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` (Drizzle Kit migrations)
- `SESSION_SECRET` (optional; falls back to runtime cryptographic random secret)
- `firebase-applet-config.json` (Firebase client/admin project configuration)

---

## Installation & Running Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Apply database schema (PostgreSQL / Drizzle):**
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   ```
3. **Run unit tests:**
   ```bash
   npx --yes tsx --test src/shared/validation.test.ts
   ```
4. **Start the development server (port 3000):**
   ```bash
   npm run dev
   ```
5. **Production build:**
   ```bash
   npm run build
   npm start
   ```

---

## Seeded Test Accounts & Demo Data

On first launch, PushtakPeer seeds 3 demo student accounts and 4 campus listings (including *Introduction to Algorithms (CLRS) — 3rd Edition*, *Organic Chemistry*, *Engineering Calculus II Handwritten Notes*, and *Operating Systems Digital Notes*):

| Name | Email | Password | College | Role |
| :--- | :--- | :--- | :--- | :--- |
| Aarav Sharma | `aarav@campus.edu` | `Campus@123` | IIT Delhi | Buyer & Seller |
| Priya Nair | `priya@campus.edu` | `Campus@123` | IIT Delhi | Buyer |
| Meera Iyer | `meera@campus.edu` | `Campus@123` | Delhi University | Seller |
