export type AppRoute =
  | 'landing'
  | 'login'
  | 'register'
  | 'marketplace'
  | 'listing-detail'
  | 'buyer-hub'
  | 'seller-hub'
  | 'messages'
  | 'notifications'
  | 'profile';

export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  collegeName: string;
  isBuyer: boolean;
  isSeller: boolean;
  createdAt: string;
}

export interface ListingItem {
  id: number;
  sellerId: number;
  sellerName: string;
  collegeName: string;
  title: string;
  description: string;
  category: 'Book' | 'Notes';
  notesFormat: 'Hardcopy' | 'Digital' | null;
  condition: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | null;
  price: number;
  status: 'Active' | 'Sold';
  images: string[];
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
  pendingRequestsCount?: number;
  acceptedRequestsCount?: number;
}

export interface SentInterestRequest {
  id: number;
  listingId: number;
  listingTitle: string;
  listingPrice: number;
  listingCategory: string;
  listingStatus: string;
  coverImage: string | null;
  sellerId: number;
  sellerName: string;
  sellerCollege: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  conversationId: number | null;
  createdAt: string;
}

export interface ReceivedInterestRequest {
  id: number;
  listingId: number;
  listingTitle: string;
  listingPrice: number;
  listingStatus: string;
  buyerId: number;
  buyerName: string;
  buyerCollege: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  conversationId: number | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: number;
  listingId: number;
  listingTitle: string;
  listingPrice: number;
  listingStatus: string;
  coverImage: string | null;
  myRole: 'Buyer' | 'Seller';
  peerId: number;
  peerName: string;
  peerCollege: string;
  lastMessage: string | null;
  lastMessageAt: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  createdAt: string;
}

export interface NotificationItem {
  id: number;
  userId: number;
  type: 'InterestRequest' | 'ChatAccepted' | 'NewMessage';
  title: string;
  message: string;
  relatedListingId: number | null;
  relatedConversationId: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface AppState {
  route: AppRoute;
  user: UserProfile | null;
  authReady: boolean;
  listings: ListingItem[];
  listingsLoading: boolean;
  filters: {
    q: string;
    category: 'All' | 'Book' | 'Notes';
    condition: 'All' | 'Excellent' | 'Good' | 'Moderate' | 'Poor';
  };
  selectedListingId: number | null;
  selectedListing: ListingItem | null;
  selectedListingInterest: {
    id: number;
    status: 'Pending' | 'Accepted' | 'Declined';
    conversationId: number | null;
  } | null;
  sellerListings: ListingItem[];
  sentRequests: SentInterestRequest[];
  receivedRequests: ReceivedInterestRequest[];
  conversations: ConversationSummary[];
  activeConversationId: number | null;
  activeMessages: ChatMessage[];
  notifications: NotificationItem[];
  unreadNotifications: number;
  editingListing: ListingItem | null;
  showListingModal: boolean;
}
