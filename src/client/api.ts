import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  ChatMessage,
  ConversationSummary,
  ListingItem,
  NotificationItem,
  ReceivedInterestRequest,
  SentInterestRequest,
  UserProfile,
} from './types.ts';

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string>;

  constructor(message: string, status: number, errors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set('X-Requested-With', 'PushtakPeer');
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data?.error || 'Something went wrong. Please try again.',
      res.status,
      data?.errors
    );
  }
  return data as T;
}

export const api = {
  getMe: () => request<{ user: UserProfile | null }>('/api/auth/me'),

  register: (payload: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    collegeName: string;
    role: 'buyer' | 'seller' | 'both';
  }) =>
    request<{ user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  loginWithGoogle: async () => {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const idToken = await result.user.getIdToken();
    return request<{ user: UserProfile; needsOnboarding: boolean }>('/api/auth/firebase', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({}),
    });
  },

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  updateProfile: (payload: {
    name: string;
    collegeName: string;
    role: 'buyer' | 'seller' | 'both';
  }) =>
    request<{ user: UserProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  uploadImages: (files: FileList | File[]) => {
    const fd = new FormData();
    for (const file of Array.from(files)) {
      fd.append('images', file);
    }
    return request<{ urls: string[] }>('/api/uploads', {
      method: 'POST',
      body: fd,
    });
  },

  getListings: (filters: { q?: string; category?: string; condition?: string }) => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.category && filters.category !== 'All') params.set('category', filters.category);
    if (filters.condition && filters.condition !== 'All') params.set('condition', filters.condition);
    const qs = params.toString();
    return request<{ listings: ListingItem[] }>(`/api/listings${qs ? `?${qs}` : ''}`);
  },

  getMyListings: () => request<{ listings: ListingItem[] }>('/api/listings/mine'),

  getListingDetail: (id: number) =>
    request<{
      listing: ListingItem;
      myInterestRequest: {
        id: number;
        status: 'Pending' | 'Accepted' | 'Declined';
        conversationId: number | null;
      } | null;
    }>(`/api/listings/${id}`),

  createListing: (payload: {
    title: string;
    description: string;
    category: 'Book' | 'Notes';
    notesFormat: 'Hardcopy' | 'Digital' | null;
    condition: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | null;
    price: number;
    imageUrls: string[];
  }) =>
    request<{ listing: ListingItem }>('/api/listings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateListing: (
    id: number,
    payload: {
      title: string;
      description: string;
      category: 'Book' | 'Notes';
      notesFormat: 'Hardcopy' | 'Digital' | null;
      condition: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | null;
      price: number;
      imageUrls: string[];
    }
  ) =>
    request<{ listing: ListingItem }>(`/api/listings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  markListingSold: (id: number) =>
    request<{ listing: ListingItem }>(`/api/listings/${id}/mark-sold`, {
      method: 'POST',
    }),

  deleteListing: (id: number) =>
    request<{ ok: boolean }>(`/api/listings/${id}`, {
      method: 'DELETE',
    }),

  expressInterest: (listingId: number) =>
    request<{
      interestRequest: {
        id: number;
        status: 'Pending' | 'Accepted' | 'Declined';
        conversationId: number | null;
      };
    }>(`/api/listings/${listingId}/interest`, {
      method: 'POST',
    }),

  getSentRequests: () =>
    request<{ requests: SentInterestRequest[] }>('/api/interest-requests/sent'),

  getReceivedRequests: () =>
    request<{ requests: ReceivedInterestRequest[] }>('/api/interest-requests/received'),

  respondToRequest: (requestId: number, decision: 'Accepted' | 'Declined') =>
    request<{ request: unknown; conversationId: number | null }>(
      `/api/interest-requests/${requestId}/respond`,
      {
        method: 'POST',
        body: JSON.stringify({ decision }),
      }
    ),

  getConversations: () =>
    request<{ conversations: ConversationSummary[] }>('/api/conversations'),

  getMessages: (conversationId: number) =>
    request<{ messages: ChatMessage[] }>(`/api/conversations/${conversationId}/messages`),

  sendMessage: (conversationId: number, body: string) =>
    request<{ message: ChatMessage }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  getNotifications: () =>
    request<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications'),

  markNotificationRead: (id: number) =>
    request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),
};

export function createRealtimeClient(onEvent: (event: string, data: any) => void) {
  let ws: WebSocket | null = null;
  let closedIntentionally = false;
  let reconnectTimer: number | null = null;

  function connect() {
    if (closedIntentionally) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    ws = new WebSocket(url);

    ws.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed && typeof parsed.event === 'string') {
          onEvent(parsed.event, parsed.data);
        }
      } catch {
        // Ignore invalid frame
      }
    };

    ws.onclose = () => {
      if (!closedIntentionally) {
        reconnectTimer = window.setTimeout(connect, 2500);
      }
    };
  }

  connect();

  return {
    reconnectWithFreshSession() {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      connect();
    },
    dispose() {
      closedIntentionally = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
