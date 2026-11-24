import { escapeHtml, formatPrice, formatTimestamp, renderImageWithFallback } from '../dom.ts';
import type { AppState } from '../types.ts';

export function renderListingDetailView(state: AppState): string {
  const item = state.selectedListing;
  const user = state.user;
  const interest = state.selectedListingInterest;

  if (!item) {
    return `
      <main class="container py-5 text-center">
        <div class="spinner-border text-success" role="status">
          <span class="visually-hidden">Loading listing...</span>
        </div>
      </main>
    `;
  }

  const images = item.images.length > 0 ? item.images : [item.coverImage ?? ''];
  const isOwner = user?.id === item.sellerId;
  const metaParts = [
    item.category === 'Notes' && item.notesFormat
      ? `Notes · ${item.notesFormat}`
      : item.category,
  ];
  if (item.condition) metaParts.push(`${item.condition} condition`);
  metaParts.push(item.status === 'Sold' ? 'Sold' : 'Available');

  let actionBlock = '';
  if (!user) {
    actionBlock = `
      <button type="button" class="btn btn-forest w-100 btn-lg" data-nav="login">
        Login to Express Interest
      </button>
      <p class="small text-center mt-2 mb-0" style="color: var(--pp-muted);">
        Sign in as a buyer to contact ${escapeHtml(item.sellerName)}.
      </p>
    `;
  } else if (isOwner) {
    actionBlock = `
      <div class="pp-surface-alt p-3 small mb-3">
        This is your own listing. Manage edits, incoming buyer requests, or mark it sold in Seller Hub.
      </div>
      <button type="button" class="btn btn-outline-forest w-100" data-nav="seller-hub">
        Go to Seller Hub
      </button>
    `;
  } else if (item.status === 'Sold') {
    actionBlock = `
      <div class="alert alert-secondary mb-0 small" role="status">
        This item has already been marked as sold by the seller.
      </div>
    `;
  } else if (interest?.status === 'Pending') {
    actionBlock = `
      <button type="button" class="btn btn-outline-forest w-100 btn-lg" disabled>
        <i class="bi bi-hourglass-split me-1" aria-hidden="true"></i>Interest Request Pending
      </button>
      <p class="small text-center mt-2 mb-0" style="color: var(--pp-muted);">
        Waiting for ${escapeHtml(item.sellerName)} to accept your request. You'll get a notification once chat unlocks.
      </p>
    `;
  } else if (interest?.status === 'Accepted') {
    actionBlock = `
      <button
        type="button"
        class="btn btn-forest w-100 btn-lg"
        data-open-chat="${interest.conversationId ?? ''}"
      >
        <i class="bi bi-chat-dots me-2" aria-hidden="true"></i>Open Private Chat
      </button>
      <p class="small text-center mt-2 mb-0" style="color: var(--pp-forest);">
        Your request was accepted. Message ${escapeHtml(item.sellerName)} directly.
      </p>
    `;
  } else if (interest?.status === 'Declined') {
    actionBlock = `
      <div class="alert alert-light border small mb-0" role="status">
        Your interest request for this listing was declined by the seller.
      </div>
    `;
  } else if (!user.isBuyer) {
    actionBlock = `
      <div class="pp-surface-alt p-3 small mb-3">
        Your account is currently Seller-only. Enable the Buyer role in your Profile to request items.
      </div>
      <button type="button" class="btn btn-outline-forest w-100" data-nav="profile">
        Update Roles in Profile
      </button>
    `;
  } else {
    actionBlock = `
      <button
        type="button"
        class="btn btn-forest w-100 btn-lg"
        id="express-interest-btn"
        data-listing-id="${item.id}"
      >
        I'm Interested
      </button>
      <p class="small text-center mt-2 mb-0" style="color: var(--pp-muted);">
        Sends an instant request to ${escapeHtml(item.sellerName)}. Private chat unlocks once accepted.
      </p>
    `;
  }

  return `
    <main class="container py-4 py-lg-5">
      <div class="mb-4">
        <button type="button" class="btn btn-link text-decoration-none p-0 fw-semibold" style="color: var(--pp-forest);" data-nav="marketplace">
          <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>Back to Marketplace
        </button>
      </div>

      <div class="row g-4 g-lg-5 align-items-start">
        <div class="col-lg-7">
          <div class="pp-card mb-3">
            <div class="pp-media-frame" id="detail-main-media">
              ${renderImageWithFallback(images[0], item.title, item.title)}
            </div>
          </div>
          ${
            images.length > 1
              ? `<div class="d-flex flex-wrap gap-2">
                   ${images
                     .map(
                       (url, idx) => `
                         <button
                           type="button"
                           class="p-0 border rounded overflow-hidden bg-white"
                           style="width: 88px; height: 66px; border-color: var(--pp-border) !important;"
                           data-gallery-thumb="${escapeHtml(url)}"
                           aria-label="View photo ${idx + 1}"
                         >
                           <img src="${escapeHtml(url)}" alt="${escapeHtml(item.title)} thumbnail ${idx + 1}" class="w-100 h-100 object-fit-cover" referrerpolicy="no-referrer" />
                         </button>
                       `
                     )
                     .join('')}
                 </div>`
              : ''
          }
        </div>

        <div class="col-lg-5">
          <div class="pp-card p-4">
            <div class="small mb-2" style="color: var(--pp-muted);">
              ${escapeHtml(metaParts.join(' · '))}
            </div>
            <h1 class="h3 fw-bold mb-2">${escapeHtml(item.title)}</h1>
            <div class="fs-2 fw-bold pp-tabular mb-4" style="color: var(--pp-forest);">
              ${formatPrice(item.price)}
            </div>

            <div class="mb-4">
              ${actionBlock}
            </div>

            <div class="border-top pt-3 mb-3" style="border-color: var(--pp-border) !important;">
              <h2 class="h6 fw-bold mb-2">Description</h2>
              <p class="mb-0" style="color: var(--pp-ink); white-space: pre-line;">${escapeHtml(item.description)}</p>
            </div>

            <div class="border-top pt-3" style="border-color: var(--pp-border) !important;">
              <h2 class="h6 fw-bold mb-2">Seller Details</h2>
              <div class="small" style="color: var(--pp-ink);">
                <div class="fw-semibold">${escapeHtml(item.sellerName)}</div>
                <div style="color: var(--pp-muted);">${escapeHtml(item.collegeName)}</div>
                <div class="mt-1" style="color: var(--pp-muted);">Listed ${escapeHtml(formatTimestamp(item.createdAt))}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  `;
}
