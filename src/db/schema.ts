import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    collegeName: text('college_name').notNull(),
    isBuyer: boolean('is_buyer').notNull().default(true),
    isSeller: boolean('is_seller').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_users_email').on(table.email),
    uniqueIndex('uq_users_uid').on(table.uid),
  ]
);

export const listings = pgTable(
  'listings',
  {
    id: serial('id').primaryKey(),
    sellerId: integer('seller_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(), // 'Book' | 'Notes'
    notesFormat: text('notes_format'), // 'Hardcopy' | 'Digital' | null
    condition: text('condition'), // 'Excellent' | 'Good' | 'Moderate' | 'Poor' | null
    price: doublePrecision('price').notNull(),
    status: text('status').notNull().default('Active'), // 'Active' | 'Sold'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_listings_seller_id').on(table.sellerId),
    index('idx_listings_status_category').on(table.status, table.category),
  ]
);

export const listingImages = pgTable(
  'listing_images',
  {
    id: serial('id').primaryKey(),
    listingId: integer('listing_id')
      .references(() => listings.id, { onDelete: 'cascade' })
      .notNull(),
    imageUrl: text('image_url').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_listing_images_listing_id').on(table.listingId)]
);

export const interestRequests = pgTable(
  'interest_requests',
  {
    id: serial('id').primaryKey(),
    listingId: integer('listing_id')
      .references(() => listings.id, { onDelete: 'cascade' })
      .notNull(),
    buyerId: integer('buyer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sellerId: integer('seller_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').notNull().default('Pending'), // 'Pending' | 'Accepted' | 'Declined'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_interest_requests_seller_id').on(table.sellerId),
    index('idx_interest_requests_buyer_id').on(table.buyerId),
    uniqueIndex('uq_interest_requests_listing_buyer').on(table.listingId, table.buyerId),
  ]
);

export const conversations = pgTable(
  'conversations',
  {
    id: serial('id').primaryKey(),
    listingId: integer('listing_id')
      .references(() => listings.id, { onDelete: 'cascade' })
      .notNull(),
    interestRequestId: integer('interest_request_id')
      .references(() => interestRequests.id, { onDelete: 'cascade' })
      .notNull(),
    buyerId: integer('buyer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sellerId: integer('seller_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_conversations_interest_request_id').on(table.interestRequestId),
    index('idx_conversations_buyer_id').on(table.buyerId),
    index('idx_conversations_seller_id').on(table.sellerId),
  ]
);

export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    senderId: integer('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_messages_conversation_id').on(table.conversationId)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(), // 'InterestRequest' | 'ChatAccepted' | 'NewMessage'
    title: text('title').notNull(),
    message: text('message').notNull(),
    relatedListingId: integer('related_listing_id').references(() => listings.id, {
      onDelete: 'set null',
    }),
    relatedConversationId: integer('related_conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_notifications_user_id_read').on(table.userId, table.isRead)]
);

export const usersRelations = relations(users, ({ many }) => ({
  listings: many(listings),
  sentRequests: many(interestRequests, { relationName: 'buyerRequests' }),
  receivedRequests: many(interestRequests, { relationName: 'sellerRequests' }),
  notifications: many(notifications),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  seller: one(users, {
    fields: [listings.sellerId],
    references: [users.id],
  }),
  images: many(listingImages),
  interestRequests: many(interestRequests),
  conversations: many(conversations),
}));

export const listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(listings, {
    fields: [listingImages.listingId],
    references: [listings.id],
  }),
}));

export const interestRequestsRelations = relations(interestRequests, ({ one }) => ({
  listing: one(listings, {
    fields: [interestRequests.listingId],
    references: [listings.id],
  }),
  buyer: one(users, {
    fields: [interestRequests.buyerId],
    references: [users.id],
    relationName: 'buyerRequests',
  }),
  seller: one(users, {
    fields: [interestRequests.sellerId],
    references: [users.id],
    relationName: 'sellerRequests',
  }),
  conversation: one(conversations, {
    fields: [interestRequests.id],
    references: [conversations.interestRequestId],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  listing: one(listings, {
    fields: [conversations.listingId],
    references: [listings.id],
  }),
  interestRequest: one(interestRequests, {
    fields: [conversations.interestRequestId],
    references: [interestRequests.id],
  }),
  buyer: one(users, {
    fields: [conversations.buyerId],
    references: [users.id],
  }),
  seller: one(users, {
    fields: [conversations.sellerId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
