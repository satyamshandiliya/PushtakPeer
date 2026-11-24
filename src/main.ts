import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css';
import { ApiError, api, createRealtimeClient } from './client/api.ts';
import { escapeHtml, showToast } from './client/dom.ts';
import type { AppRoute, AppState, ChatMessage, ListingItem, NotificationItem } from './client/types.ts';
import { renderLoginView, renderRegisterView } from './client/views/auth.ts';
import { renderBuyerActivityView } from './client/views/buyerActivity.ts';
import { renderLandingView } from './client/views/landing.ts';
import { renderListingDetailView } from './client/views/listingDetail.ts';
import { renderMarketplaceView } from './client/views/marketplace.ts';
import { renderMessagesView } from './client/views/messages.ts';
import { renderNavbar } from './client/views/navbar.ts';
import { renderNotificationsView } from './client/views/notifications.ts';
import { renderProfileView } from './client/views/profile.ts';
import { renderListingModal, renderSellerDashboardView } from './client/views/sellerDashboard.ts';
import { validateListingInput, validateRegistrationInput, validateUploadedImageMeta } from './shared/validation.ts';

const state: AppState = {
  route: 'landing',
  user: null,
  authReady: false,
  listings: [],
  listingsLoading: true,
  filters: {
    q: '',
    category: 'All',
    condition: 'All',
  },
  selectedListingId: null,
  selectedListing: null,
  selectedListingInterest: null,
  sellerListings: [],
  sentRequests: [],
  receivedRequests: [],
  conversations: [],
  activeConversationId: null,
  activeMessages: [],
  notifications: [],
  unreadNotifications: 0,
  editingListing: null,
  showListingModal: false,
};

let authError = '';
let registerFieldErrors: Record<string, string> = {};
let profileSavedBanner = false;
let profileError = '';
let modalImageUrls: string[] = [];
let confirmDialogState: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmVariant: 'danger' | 'forest';
  onConfirm: () => Promise<void>;
} | null = null;

const realtime = createRealtimeClient((event, data) => {
  handleRealtimeEvent(event, data);
});

function handleRealtimeEvent(event: string, data: any) {
  if (event === 'listing:created') {
    const newItem = data as ListingItem;
    if (!state.listings.some((l) => l.id === newItem.id)) {
      state.listings = [newItem, ...state.listings];
      if (state.route === 'marketplace' || state.route === 'landing') {
        render();
      }
      if (!state.user || state.user.id !== newItem.sellerId) {
        showToast(`New listing posted: ${newItem.title}`, 'info');
      }
    }
  } else if (event === 'listing:updated') {
    const updated = data as ListingItem;
    state.listings = state.listings.map((l) => (l.id === updated.id ? updated : l));
    if (state.selectedListing?.id === updated.id) {
      state.selectedListing = updated;
    }
    if (state.route === 'marketplace' || state.route === 'listing-detail') {
      render();
    }
  } else if (event === 'listing:sold' || event === 'listing:deleted') {
    const id = Number(data?.id);
    state.listings = state.listings.filter((l) => l.id !== id);
    if (state.selectedListing?.id === id) {
      if (event === 'listing:sold') {
        state.selectedListing = { ...state.selectedListing, status: 'Sold' };
      } else {
        state.selectedListing = null;
        if (state.route === 'listing-detail') {
          navigate('marketplace');
          return;
        }
      }
    }
    if (state.route === 'marketplace' || state.route === 'listing-detail' || state.route === 'landing') {
      render();
    }
  } else if (event === 'notification:new') {
    const notif = data as NotificationItem;
    if (!state.notifications.some((n) => n.id === notif.id)) {
      state.notifications = [notif, ...state.notifications];
      state.unreadNotifications = state.notifications.filter((n) => !n.isRead).length;
      showToast(notif.message, 'info');
      render();
    }
  } else if (event === 'interest:updated') {
    if (state.user) {
      void refreshUserActivityData();
      if (state.route === 'listing-detail' && state.selectedListingId === Number(data?.listingId)) {
        void openListingDetail(state.selectedListingId);
      }
    }
  } else if (event === 'chat:message') {
    const msg = data as ChatMessage;
    if (state.activeConversationId === msg.conversationId) {
      if (!state.activeMessages.some((m) => m.id === msg.id)) {
        state.activeMessages = [...state.activeMessages, msg];
        render();
        scrollChatToBottom();
      }
    }
    state.conversations = state.conversations.map((c) =>
      c.id === msg.conversationId
        ? { ...c, lastMessage: msg.body, lastMessageAt: msg.createdAt }
        : c
    );
    if (state.route === 'messages') {
      render();
      scrollChatToBottom();
    }
  }
}

function scrollChatToBottom() {
  window.requestAnimationFrame(() => {
    const thread = document.getElementById('pp-chat-thread');
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  });
}

function parseRouteFromHash(): { route: AppRoute; id?: number } {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!raw || raw === '') return { route: 'landing' };
  const [segment, param] = raw.split('/');
  if (segment === 'listing' && param && Number(param) > 0) {
    return { route: 'listing-detail', id: Number(param) };
  }
  const validRoutes: AppRoute[] = [
    'landing',
    'login',
    'register',
    'marketplace',
    'buyer-hub',
    'seller-hub',
    'messages',
    'notifications',
    'profile',
  ];
  if (validRoutes.includes(segment as AppRoute)) {
    return { route: segment as AppRoute };
  }
  return { route: 'landing' };
}

async function navigate(route: AppRoute, paramId?: number) {
  authError = '';
  registerFieldErrors = {};
  profileSavedBanner = false;
  profileError = '';

  const protectedRoutes: AppRoute[] = [
    'buyer-hub',
    'seller-hub',
    'messages',
    'notifications',
    'profile',
  ];
  if (protectedRoutes.includes(route) && !state.user) {
    state.route = 'login';
    window.location.hash = '#/login';
    render();
    return;
  }

  state.route = route;
  if (route === 'listing-detail' && paramId) {
    window.location.hash = `#/listing/${paramId}`;
    await openListingDetail(paramId);
    return;
  }

  window.location.hash = route === 'landing' ? '#/' : `#/${route}`;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });

  if (route === 'marketplace' || route === 'landing') {
    await loadListings();
  } else if (route === 'buyer-hub') {
    await Promise.all([loadSentRequests(), loadConversations()]);
    render();
  } else if (route === 'seller-hub') {
    await Promise.all([loadSellerListings(), loadReceivedRequests()]);
    render();
  } else if (route === 'messages') {
    await loadConversations();
    if (!state.activeConversationId && state.conversations.length > 0) {
      await selectConversation(state.conversations[0].id);
    } else if (state.activeConversationId) {
      await selectConversation(state.activeConversationId);
    } else {
      render();
    }
  } else if (route === 'notifications') {
    await loadNotifications();
    render();
  }
}

async function loadListings() {
  state.listingsLoading = true;
  render();
  try {
    const res = await api.getListings(state.filters);
    state.listings = res.listings;
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Unable to load listings.', 'error');
  } finally {
    state.listingsLoading = false;
    render();
  }
}

async function openListingDetail(listingId: number) {
  state.route = 'listing-detail';
  state.selectedListingId = listingId;
  state.selectedListing = null;
  state.selectedListingInterest = null;
  render();
  try {
    const res = await api.getListingDetail(listingId);
    state.selectedListing = res.listing;
    state.selectedListingInterest = res.myInterestRequest;
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Listing not found.', 'error');
    await navigate('marketplace');
    return;
  }
  render();
}

async function loadSellerListings() {
  try {
    const res = await api.getMyListings();
    state.sellerListings = res.listings;
  } catch {
    // Ignore transient
  }
}

async function loadSentRequests() {
  try {
    const res = await api.getSentRequests();
    state.sentRequests = res.requests;
  } catch {
    // Ignore transient
  }
}

async function loadReceivedRequests() {
  try {
    const res = await api.getReceivedRequests();
    state.receivedRequests = res.requests;
  } catch {
    // Ignore transient
  }
}

async function loadConversations() {
  try {
    const res = await api.getConversations();
    state.conversations = res.conversations;
  } catch {
    // Ignore transient
  }
}

async function selectConversation(convoId: number) {
  state.activeConversationId = convoId;
  try {
    const res = await api.getMessages(convoId);
    state.activeMessages = res.messages;
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Unable to open conversation.', 'error');
  }
  render();
  scrollChatToBottom();
}

async function loadNotifications() {
  if (!state.user) return;
  try {
    const res = await api.getNotifications();
    state.notifications = res.notifications;
    state.unreadNotifications = res.unreadCount;
  } catch {
    // Ignore transient
  }
}

async function refreshUserActivityData() {
  if (!state.user) return;
  await Promise.all([
    loadNotifications(),
    loadConversations(),
    state.user.isBuyer ? loadSentRequests() : Promise.resolve(),
    state.user.isSeller ? Promise.all([loadSellerListings(), loadReceivedRequests()]) : Promise.resolve(),
  ]);
  render();
}

function openListingModal(listing: ListingItem | null) {
  state.editingListing = listing;
  modalImageUrls = listing ? [...listing.images] : [];
  state.showListingModal = true;
  render();
  renderModalImagePreviews();
}

function closeListingModal() {
  state.showListingModal = false;
  state.editingListing = null;
  modalImageUrls = [];
  render();
}

function renderModalImagePreviews() {
  const container = document.getElementById('listing-images-preview');
  if (!container) return;
  if (modalImageUrls.length === 0) {
    container.innerHTML = `<span class="small" style="color: var(--pp-muted);">No images selected yet.</span>`;
    return;
  }
  container.innerHTML = modalImageUrls
    .map(
      (url, idx) => `
        <div class="position-relative border rounded overflow-hidden" style="width: 92px; height: 70px;">
          <img src="${escapeHtml(url)}" alt="Preview ${idx + 1}" class="w-100 h-100 object-fit-cover" referrerpolicy="no-referrer" />
          <button
            type="button"
            class="btn btn-sm btn-danger position-absolute top-0 end-0 p-0 d-flex align-items-center justify-content-center"
            style="width: 22px; height: 22px; min-height: 22px; border-radius: 0 0 0 6px;"
            data-remove-modal-img="${idx}"
            aria-label="Remove image ${idx + 1}"
          >
            <i class="bi bi-x" aria-hidden="true"></i>
          </button>
        </div>
      `
    )
    .join('');

  container.querySelectorAll<HTMLButtonElement>('[data-remove-modal-img]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeModalImg);
      modalImageUrls.splice(idx, 1);
      renderModalImagePreviews();
    });
  });
}

function renderConfirmDialog(): string {
  if (!confirmDialogState) return '';
  const btnClass = confirmDialogState.confirmVariant === 'danger' ? 'btn-danger' : 'btn-forest';
  return `
    <div class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle" style="background: rgba(28,36,33,0.48);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg" style="border-radius: var(--pp-radius); background-color: var(--pp-surface);">
          <div class="modal-header border-bottom" style="border-color: var(--pp-border) !important;">
            <h2 class="modal-title h5 fw-bold" id="confirmDialogTitle">${escapeHtml(confirmDialogState.title)}</h2>
            <button type="button" class="btn-close" id="confirm-cancel-x" aria-label="Cancel"></button>
          </div>
          <div class="modal-body">
            <p class="mb-0 small">${escapeHtml(confirmDialogState.body)}</p>
          </div>
          <div class="modal-footer border-top" style="border-color: var(--pp-border) !important;">
            <button type="button" class="btn btn-outline-secondary" id="confirm-cancel-btn">Cancel</button>
            <button type="button" class="btn ${btnClass}" id="confirm-ok-btn">${escapeHtml(confirmDialogState.confirmLabel)}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderFooter(): string {
  return `
    <footer class="border-top mt-5 py-4" style="border-color: var(--pp-border) !important;">
      <div class="container d-flex flex-wrap justify-content-between align-items-center gap-2 small" style="color: var(--pp-muted);">
        <span>© ${new Date().getFullYear()} PushtakPeer · Student Book &amp; Notes Marketplace</span>
        <span>Peer-to-peer campus exchange · No commissions or platform fees</span>
      </div>
    </footer>
  `;
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  let bodyHtml = '';
  switch (state.route) {
    case 'landing':
      bodyHtml = renderLandingView(state);
      break;
    case 'login':
      bodyHtml = renderLoginView(authError);
      break;
    case 'register':
      bodyHtml = renderRegisterView(authError, registerFieldErrors);
      break;
    case 'marketplace':
      bodyHtml = renderMarketplaceView(state);
      break;
    case 'listing-detail':
      bodyHtml = renderListingDetailView(state);
      break;
    case 'buyer-hub':
      bodyHtml = renderBuyerActivityView(state);
      break;
    case 'seller-hub':
      bodyHtml = renderSellerDashboardView(state);
      break;
    case 'messages':
      bodyHtml = renderMessagesView(state);
      break;
    case 'notifications':
      bodyHtml = renderNotificationsView(state);
      break;
    case 'profile':
      bodyHtml = renderProfileView(state, profileSavedBanner, profileError);
      break;
  }

  root.innerHTML = `
    <div class="d-flex flex-column min-vh-100">
      ${renderNavbar(state)}
      <div class="flex-grow-1">
        ${bodyHtml}
      </div>
      ${renderFooter()}
      ${renderListingModal(state)}
      ${renderConfirmDialog()}
      <div id="pp-toast-container" class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 1090;"></div>
    </div>
  `;

  bindEvents();
  if (state.showListingModal) {
    renderModalImagePreviews();
  }
}

function bindEvents() {
  // Navigation triggers
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const target = el.dataset.nav as AppRoute;
      if (target) void navigate(target);
    });
  });

  // View listing detail buttons
  document.querySelectorAll<HTMLElement>('[data-view-listing]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = Number(el.dataset.viewListing);
      if (id > 0) void navigate('listing-detail', id);
    });
  });

  // Open create listing modal
  document.querySelectorAll<HTMLElement>('[data-action="open-create-listing"]').forEach((el) => {
    el.addEventListener('click', () => openListingModal(null));
  });

  document.querySelectorAll<HTMLElement>('[data-action="close-listing-modal"]').forEach((el) => {
    el.addEventListener('click', () => closeListingModal());
  });

  // Login Form
  const loginForm = document.getElementById('pp-login-form') as HTMLFormElement | null;
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const btn = document.getElementById('login-submit-btn') as HTMLButtonElement | null;
    if (!email || !password) {
      authError = 'Please enter both email and password.';
      render();
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Signing in...';
    }
    try {
      const res = await api.login({ email, password });
      state.user = res.user;
      authError = '';
      realtime.reconnectWithFreshSession();
      await refreshUserActivityData();
      showToast(`Welcome back, ${res.user.name}!`, 'success');
      await navigate('marketplace');
    } catch (err) {
      authError = err instanceof Error ? err.message : 'Unable to sign in.';
      render();
    }
  });

  // Demo credential fill buttons
  document.querySelectorAll<HTMLButtonElement>('[data-fill-demo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const emailInput = document.getElementById('login-email') as HTMLInputElement | null;
      const passInput = document.getElementById('login-password') as HTMLInputElement | null;
      if (emailInput && passInput) {
        emailInput.value = btn.dataset.fillDemo ?? '';
        passInput.value = 'Campus@123';
      }
    });
  });

  // Google Sign-In button
  document.getElementById('google-signin-btn')?.addEventListener('click', async () => {
    try {
      const res = await api.loginWithGoogle();
      state.user = res.user;
      authError = '';
      realtime.reconnectWithFreshSession();
      await refreshUserActivityData();
      showToast(`Signed in as ${res.user.name}`, 'success');
      if (res.needsOnboarding) {
        await navigate('profile');
      } else {
        await navigate('marketplace');
      }
    } catch (err) {
      authError = err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.';
      render();
    }
  });

  // Register Form
  const regForm = document.getElementById('pp-register-form') as HTMLFormElement | null;
  regForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(regForm);
    const payload = {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      collegeName: String(formData.get('collegeName') ?? ''),
      password: String(formData.get('password') ?? ''),
      confirmPassword: String(formData.get('confirmPassword') ?? ''),
      role: (formData.get('role') as 'buyer' | 'seller' | 'both') ?? 'both',
    };

    const clientCheck = validateRegistrationInput(payload);
    if (!clientCheck.valid) {
      registerFieldErrors = clientCheck.errors;
      authError = 'Please review the highlighted fields.';
      render();
      // Preserve user inputs after re-render
      (document.getElementById('reg-name') as HTMLInputElement).value = payload.name;
      (document.getElementById('reg-email') as HTMLInputElement).value = payload.email;
      (document.getElementById('reg-college') as HTMLInputElement).value = payload.collegeName;
      return;
    }

    const btn = document.getElementById('register-submit-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating account...';
    }

    try {
      const res = await api.register(payload);
      state.user = res.user;
      authError = '';
      registerFieldErrors = {};
      realtime.reconnectWithFreshSession();
      await refreshUserActivityData();
      showToast(`Welcome to PushtakPeer, ${res.user.name}!`, 'success');
      await navigate('marketplace');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        registerFieldErrors = err.errors;
      }
      authError = err instanceof Error ? err.message : 'Unable to register.';
      render();
    }
  });

  // Marketplace Search & Filters
  const filterForm = document.getElementById('pp-filter-form') as HTMLFormElement | null;
  filterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const searchInput = document.getElementById('market-search') as HTMLInputElement | null;
    state.filters.q = searchInput?.value.trim() ?? '';
    void loadListings();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-filter-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filters.category = (btn.dataset.filterCategory as 'All' | 'Book' | 'Notes') ?? 'All';
      void loadListings();
    });
  });

  const condSelect = document.getElementById('market-condition') as HTMLSelectElement | null;
  condSelect?.addEventListener('change', () => {
    state.filters.condition = condSelect.value as AppState['filters']['condition'];
    void loadListings();
  });

  document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
    state.filters = { q: '', category: 'All', condition: 'All' };
    void loadListings();
  });

  // Listing Detail Gallery Thumbnails
  document.querySelectorAll<HTMLButtonElement>('[data-gallery-thumb]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.galleryThumb;
      const mainImg = document.querySelector('#detail-main-media img') as HTMLImageElement | null;
      if (url && mainImg) {
        mainImg.src = url;
      }
    });
  });

  // Express Interest ("I'm Interested")
  const interestBtn = document.getElementById('express-interest-btn') as HTMLButtonElement | null;
  interestBtn?.addEventListener('click', async () => {
    const listingId = Number(interestBtn.dataset.listingId);
    interestBtn.disabled = true;
    interestBtn.textContent = 'Sending request...';
    try {
      const res = await api.expressInterest(listingId);
      state.selectedListingInterest = res.interestRequest;
      showToast('Interest request sent! The seller was notified.', 'success');
      await loadSentRequests();
      render();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to send request.', 'error');
      interestBtn.disabled = false;
      interestBtn.textContent = "I'm Interested";
    }
  });

  // Open Chat from Detail / Buyer Hub / Seller Hub
  document.querySelectorAll<HTMLElement>('[data-open-chat]').forEach((el) => {
    el.addEventListener('click', async () => {
      const convoId = Number(el.dataset.openChat);
      if (convoId > 0) {
        state.activeConversationId = convoId;
      }
      await navigate('messages');
    });
  });

  // Seller Hub: Respond to Interest Request (Accept / Decline)
  document.querySelectorAll<HTMLButtonElement>('[data-respond-request]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const reqId = Number(btn.dataset.respondRequest);
      const decision = btn.dataset.decision as 'Accepted' | 'Declined';
      btn.disabled = true;
      try {
        const res = await api.respondToRequest(reqId, decision);
        showToast(
          decision === 'Accepted'
            ? 'Request accepted! Private chat is now unlocked.'
            : 'Interest request declined.',
          decision === 'Accepted' ? 'success' : 'info'
        );
        await Promise.all([loadReceivedRequests(), loadConversations()]);
        if (decision === 'Accepted' && res.conversationId) {
          state.activeConversationId = res.conversationId;
        }
        render();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to respond.', 'error');
        btn.disabled = false;
      }
    });
  });

  // Seller Hub: Edit, Mark as Sold, Delete Listing
  document.querySelectorAll<HTMLButtonElement>('[data-edit-listing]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.editListing);
      const target = state.sellerListings.find((l) => l.id === id) ?? null;
      if (target) openListingModal(target);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-mark-sold]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.markSold);
      const title = btn.dataset.listingTitle ?? 'this listing';
      confirmDialogState = {
        title: 'Mark Listing as Sold',
        body: `Mark "${title}" as sold? It will be removed from buyer marketplace browsing and stop receiving new interest requests.`,
        confirmLabel: 'Confirm Mark as Sold',
        confirmVariant: 'forest',
        onConfirm: async () => {
          await api.markListingSold(id);
          showToast('Listing marked as sold.', 'success');
          await Promise.all([loadSellerListings(), loadListings()]);
        },
      };
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-delete-listing]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.deleteListing);
      const title = btn.dataset.listingTitle ?? 'this listing';
      confirmDialogState = {
        title: 'Delete Listing',
        body: `Are you sure you want to permanently delete "${title}"? This will also remove any associated requests and chats.`,
        confirmLabel: 'Delete Permanently',
        confirmVariant: 'danger',
        onConfirm: async () => {
          await api.deleteListing(id);
          showToast('Listing deleted.', 'info');
          await Promise.all([loadSellerListings(), loadListings(), loadReceivedRequests()]);
        },
      };
      render();
    });
  });

  // Confirm Dialog Handlers
  document.getElementById('confirm-cancel-btn')?.addEventListener('click', () => {
    confirmDialogState = null;
    render();
  });
  document.getElementById('confirm-cancel-x')?.addEventListener('click', () => {
    confirmDialogState = null;
    render();
  });
  document.getElementById('confirm-ok-btn')?.addEventListener('click', async () => {
    if (!confirmDialogState) return;
    const action = confirmDialogState.onConfirm;
    confirmDialogState = null;
    try {
      await action();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed.', 'error');
    }
    render();
  });

  // Create / Edit Listing Modal Dynamic Behavior & Submit
  const catSelect = document.getElementById('listing-category') as HTMLSelectElement | null;
  const formatSelect = document.getElementById('listing-notes-format') as HTMLSelectElement | null;
  const syncListingModalFields = () => {
    const cat = catSelect?.value ?? 'Book';
    const format = formatSelect?.value ?? 'Hardcopy';
    const formatGroup = document.getElementById('notes-format-group');
    const condGroup = document.getElementById('condition-group');
    const imagesLabel = document.getElementById('listing-images-label');

    if (cat === 'Notes') {
      formatGroup?.classList.remove('d-none');
      if (format === 'Digital') {
        condGroup?.classList.add('d-none');
        if (imagesLabel) {
          imagesLabel.textContent = 'Preview Images (JPG, PNG, WebP, max 5 MB each)';
        }
      } else {
        condGroup?.classList.remove('d-none');
        if (imagesLabel) {
          imagesLabel.textContent = 'Photos (JPG, PNG, WebP, max 5 MB each)';
        }
      }
    } else {
      formatGroup?.classList.add('d-none');
      condGroup?.classList.remove('d-none');
      if (imagesLabel) {
        imagesLabel.textContent = 'Photos (JPG, PNG, WebP, max 5 MB each)';
      }
    }
  };

  catSelect?.addEventListener('change', syncListingModalFields);
  formatSelect?.addEventListener('change', syncListingModalFields);

  const imgInput = document.getElementById('listing-images-input') as HTMLInputElement | null;
  imgInput?.addEventListener('change', async () => {
    const files = imgInput.files;
    if (!files || files.length === 0) return;
    const errBox = document.getElementById('listing-form-error');
    errBox?.classList.add('d-none');

    for (const file of Array.from(files)) {
      const check = validateUploadedImageMeta(file.type, file.size);
      if (!check.valid) {
        if (errBox) {
          errBox.textContent = check.error ?? 'Invalid file.';
          errBox.classList.remove('d-none');
        }
        imgInput.value = '';
        return;
      }
    }

    try {
      const uploaded = await api.uploadImages(files);
      modalImageUrls = [...modalImageUrls, ...uploaded.urls].slice(0, 6);
      renderModalImagePreviews();
      showToast(`${uploaded.urls.length} image(s) uploaded.`, 'success');
    } catch (err) {
      if (errBox) {
        errBox.textContent = err instanceof Error ? err.message : 'Image upload failed.';
        errBox.classList.remove('d-none');
      }
    } finally {
      imgInput.value = '';
    }
  });

  const listingForm = document.getElementById('pp-listing-form') as HTMLFormElement | null;
  listingForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('listing-form-error');
    errBox?.classList.add('d-none');

    const fd = new FormData(listingForm);
    const category = String(fd.get('category') ?? 'Book') as 'Book' | 'Notes';
    const notesFormat =
      category === 'Notes'
        ? (String(fd.get('notesFormat') ?? 'Hardcopy') as 'Hardcopy' | 'Digital')
        : null;
    const condition =
      category === 'Book' || notesFormat === 'Hardcopy'
        ? (String(fd.get('condition') ?? 'Good') as 'Excellent' | 'Good' | 'Moderate' | 'Poor')
        : null;

    const payload = {
      title: String(fd.get('title') ?? ''),
      description: String(fd.get('description') ?? ''),
      category,
      notesFormat,
      condition,
      price: Number(fd.get('price') ?? 0),
      imageUrls: modalImageUrls,
    };

    const check = validateListingInput(payload);
    if (!check.valid || !check.data) {
      const firstErr = Object.values(check.errors)[0] ?? 'Please fill out all required fields.';
      if (errBox) {
        errBox.textContent = firstErr;
        errBox.classList.remove('d-none');
      }
      return;
    }

    const btn = document.getElementById('listing-submit-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = state.editingListing ? 'Saving...' : 'Publishing...';
    }

    try {
      if (state.editingListing) {
        await api.updateListing(state.editingListing.id, check.data);
        showToast('Listing updated successfully.', 'success');
      } else {
        await api.createListing(check.data);
        showToast('Listing published to marketplace!', 'success');
      }
      closeListingModal();
      await Promise.all([loadSellerListings(), loadListings()]);
      if (state.route !== 'seller-hub' && state.route !== 'marketplace') {
        await navigate('seller-hub');
      } else {
        render();
      }
    } catch (err) {
      if (errBox) {
        errBox.textContent = err instanceof Error ? err.message : 'Unable to save listing.';
        errBox.classList.remove('d-none');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = state.editingListing ? 'Save Changes' : 'Publish Listing';
      }
    }
  });

  // Messages: Conversation Select & Send Message
  document.querySelectorAll<HTMLButtonElement>('[data-select-conversation]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const convoId = Number(btn.dataset.selectConversation);
      if (convoId > 0) void selectConversation(convoId);
    });
  });

  const chatForm = document.getElementById('pp-chat-form') as HTMLFormElement | null;
  chatForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeConversationId) return;
    const input = document.getElementById('chat-message-input') as HTMLInputElement | null;
    const body = input?.value.trim() ?? '';
    if (!body) return;
    const btn = document.getElementById('chat-send-btn') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    try {
      const res = await api.sendMessage(state.activeConversationId, body);
      if (!state.activeMessages.some((m) => m.id === res.message.id)) {
        state.activeMessages = [...state.activeMessages, res.message];
      }
      state.conversations = state.conversations.map((c) =>
        c.id === state.activeConversationId
          ? { ...c, lastMessage: res.message.body, lastMessageAt: res.message.createdAt }
          : c
      );
      if (input) input.value = '';
      render();
      scrollChatToBottom();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send message.', 'error');
      if (btn) btn.disabled = false;
    }
  });

  // Notifications Actions
  document.getElementById('mark-all-read-btn')?.addEventListener('click', async () => {
    await api.markAllNotificationsRead();
    state.notifications = state.notifications.map((n) => ({ ...n, isRead: true }));
    state.unreadNotifications = 0;
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-mark-notif-read]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.markNotifRead);
      await api.markNotificationRead(id);
      state.notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      state.unreadNotifications = state.notifications.filter((n) => !n.isRead).length;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-notif-open-chat]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const convoId = Number(btn.dataset.notifOpenChat);
      const notifId = Number(btn.dataset.notifId);
      if (notifId > 0) await api.markNotificationRead(notifId);
      await loadNotifications();
      state.activeConversationId = convoId;
      await navigate('messages');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-notif-review]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const notifId = Number(btn.dataset.notifReview);
      if (notifId > 0) await api.markNotificationRead(notifId);
      await loadNotifications();
      await navigate('seller-hub');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-notif-listing]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const listingId = Number(btn.dataset.notifListing);
      const notifId = Number(btn.dataset.notifId);
      if (notifId > 0) await api.markNotificationRead(notifId);
      await loadNotifications();
      await navigate('listing-detail', listingId);
    });
  });

  // Profile Update & Logout
  const profileForm = document.getElementById('pp-profile-form') as HTMLFormElement | null;
  profileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    profileSavedBanner = false;
    profileError = '';
    const fd = new FormData(profileForm);
    const payload = {
      name: String(fd.get('name') ?? '').trim(),
      collegeName: String(fd.get('collegeName') ?? '').trim(),
      role: (fd.get('role') as 'buyer' | 'seller' | 'both') ?? 'both',
    };
    const btn = document.getElementById('profile-save-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }
    try {
      const res = await api.updateProfile(payload);
      state.user = res.user;
      profileSavedBanner = true;
      showToast('Profile updated!', 'success');
      render();
    } catch (err) {
      profileError = err instanceof Error ? err.message : 'Unable to update profile.';
      render();
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await api.logout();
    state.user = null;
    state.notifications = [];
    state.unreadNotifications = 0;
    state.conversations = [];
    state.sentRequests = [];
    state.receivedRequests = [];
    state.sellerListings = [];
    realtime.reconnectWithFreshSession();
    showToast('You have been logged out.', 'info');
    await navigate('landing');
  });
}

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const autostart = params.get('autostart') === '1';

  const parsedHash = parseRouteFromHash();
  state.route = autostart && parsedHash.route === 'landing' ? 'marketplace' : parsedHash.route;
  if (parsedHash.id) state.selectedListingId = parsedHash.id;

  render();

  try {
    const [meRes, listingsRes] = await Promise.all([api.getMe(), api.getListings(state.filters)]);
    state.user = meRes.user;
    state.listings = listingsRes.listings;
    state.listingsLoading = false;
    state.authReady = true;

    if (state.user) {
      realtime.reconnectWithFreshSession();
      await refreshUserActivityData();
    }

    if (state.route === 'listing-detail' && state.selectedListingId) {
      await openListingDetail(state.selectedListingId);
      return;
    }
    if (
      ['buyer-hub', 'seller-hub', 'messages', 'notifications', 'profile'].includes(state.route) &&
      !state.user
    ) {
      state.route = 'login';
    }
    if (state.route === 'messages' && state.conversations.length > 0 && !state.activeConversationId) {
      await selectConversation(state.conversations[0].id);
      return;
    }
  } catch (err) {
    state.listingsLoading = false;
    state.authReady = true;
    console.error('Bootstrap error:', err);
  }

  render();

  window.addEventListener('hashchange', () => {
    const next = parseRouteFromHash();
    if (next.route !== state.route || next.id !== state.selectedListingId) {
      void navigate(next.route, next.id);
    }
  });
}

void bootstrap();
