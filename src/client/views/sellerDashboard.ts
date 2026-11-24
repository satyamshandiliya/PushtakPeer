import { escapeHtml, formatPrice, formatRelativeTime, renderImageWithFallback } from '../dom.ts';
import type { AppState, ListingItem } from '../types.ts';

export function renderSellerDashboardView(state: AppState): string {
  const { sellerListings, receivedRequests, user } = state;

  if (!user?.isSeller) {
    return `
      <main class="container py-5">
        <div class="pp-card p-5 text-center mx-auto" style="max-width: 560px;">
          <h1 class="h4 fw-bold mb-2">Seller Role Disabled</h1>
          <p class="small mb-4" style="color: var(--pp-muted);">
            Your account is currently set to Buyer-only. Enable the Seller role in your Profile to list books and notes.
          </p>
          <button type="button" class="btn btn-forest" data-nav="profile">Go to Profile</button>
        </div>
      </main>
    `;
  }

  const pendingRequests = receivedRequests.filter((r) => r.status === 'Pending');
  const activeListings = sellerListings.filter((l) => l.status === 'Active');
  const soldListings = sellerListings.filter((l) => l.status === 'Sold');

  return `
    <main class="container py-4 py-lg-5">
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 class="h2 fw-bold mb-1">Seller Hub</h1>
          <p class="mb-0" style="color: var(--pp-muted);">
            Manage your listings, review buyer requests, and approve private chats.
          </p>
        </div>
        <button type="button" class="btn btn-forest" data-action="open-create-listing">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Create New Listing
        </button>
      </div>

      <section class="pp-card p-4 mb-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2 class="h5 fw-bold mb-0">
            Incoming Interest Requests
            ${
              pendingRequests.length > 0
                ? `<span class="pp-unread-count">${pendingRequests.length}</span>`
                : ''
            }
          </h2>
        </div>

        ${
          receivedRequests.length === 0
            ? `<div class="pp-surface-alt p-4 text-center">
                 <p class="small mb-0" style="color: var(--pp-muted);">
                   No buyer requests yet. When a student clicks "I'm Interested" on your listing, it will appear here in real time.
                 </p>
               </div>`
            : `<div class="d-flex flex-column gap-3">
                 ${receivedRequests
                   .map((req) => {
                     const statusClass =
                       req.status === 'Accepted'
                         ? 'pp-status-accepted'
                         : req.status === 'Declined'
                           ? 'pp-status-declined'
                           : 'pp-status-pending';

                     return `
                       <div class="border rounded-3 p-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style="border-color: var(--pp-border) !important;">
                         <div>
                           <div class="fw-bold mb-1">${escapeHtml(req.buyerName)} <span class="fw-normal small" style="color: var(--pp-muted);">· ${escapeHtml(req.buyerCollege)}</span></div>
                           <div class="small mb-1">
                             Interested in <button type="button" class="btn btn-link p-0 align-baseline fw-semibold text-decoration-none" style="color: var(--pp-forest);" data-view-listing="${req.listingId}">${escapeHtml(req.listingTitle)}</button>
                             <span class="pp-tabular fw-semibold ms-1">(${formatPrice(req.listingPrice)})</span>
                           </div>
                           <div class="small" style="color: var(--pp-muted);">
                             ${escapeHtml(formatRelativeTime(req.createdAt))} · <span class="pp-status-text ${statusClass}">${escapeHtml(req.status)}</span>
                           </div>
                         </div>
                         <div class="d-flex flex-wrap gap-2">
                           ${
                             req.status === 'Pending'
                               ? `<button type="button" class="btn btn-sm btn-forest" data-respond-request="${req.id}" data-decision="Accepted">
                                    Accept &amp; Unlock Chat
                                  </button>
                                  <button type="button" class="btn btn-sm btn-outline-danger" data-respond-request="${req.id}" data-decision="Declined">
                                    Decline
                                  </button>`
                               : req.status === 'Accepted' && req.conversationId
                                 ? `<button type="button" class="btn btn-sm btn-outline-forest" data-open-chat="${req.conversationId}">
                                      Open Chat
                                    </button>`
                                 : ''
                           }
                         </div>
                       </div>
                     `;
                   })
                   .join('')}
               </div>`
        }
      </section>

      <section class="pp-card p-4 mb-4">
        <h2 class="h5 fw-bold mb-3">Active Listings (${activeListings.length})</h2>
        ${
          activeListings.length === 0
            ? `<div class="pp-surface-alt p-4 text-center">
                 <p class="small mb-3" style="color: var(--pp-muted);">You have no active listings right now.</p>
                 <button type="button" class="btn btn-sm btn-forest" data-action="open-create-listing">Post Your First Book or Notes</button>
               </div>`
            : `<div class="row g-3">
                 ${activeListings.map((item) => renderSellerListingCard(item)).join('')}
               </div>`
        }
      </section>

      ${
        soldListings.length > 0
          ? `<section class="pp-card p-4">
               <h2 class="h5 fw-bold mb-3">Sold History (${soldListings.length})</h2>
               <div class="row g-3">
                 ${soldListings.map((item) => renderSellerListingCard(item)).join('')}
               </div>
             </section>`
          : ''
      }
    </main>
  `;
}

function renderSellerListingCard(item: ListingItem): string {
  const isSold = item.status === 'Sold';
  const metaParts = [
    item.category === 'Notes' && item.notesFormat ? `Notes (${item.notesFormat})` : item.category,
  ];
  if (item.condition) metaParts.push(item.condition);

  return `
    <div class="col-md-6 col-lg-4">
      <div class="border rounded-3 h-100 d-flex flex-column overflow-hidden bg-white" style="border-color: var(--pp-border) !important;">
        <div class="pp-media-frame">
          ${renderImageWithFallback(item.coverImage, item.title, item.title)}
        </div>
        <div class="p-3 d-flex flex-column flex-grow-1">
          <div class="small mb-1" style="color: var(--pp-muted);">
            ${escapeHtml(metaParts.join(' · '))} · <span class="${isSold ? 'text-secondary fw-semibold' : 'fw-semibold'}" style="${isSold ? '' : 'color: var(--pp-forest);'}">${escapeHtml(item.status)}</span>
          </div>
          <h3 class="h6 fw-bold mb-1">${escapeHtml(item.title)}</h3>
          <div class="fw-bold pp-tabular mb-3" style="color: var(--pp-forest);">${formatPrice(item.price)}</div>
          <div class="mt-auto d-flex flex-wrap gap-2 pt-2 border-top" style="border-color: var(--pp-border) !important;">
            <button type="button" class="btn btn-sm btn-outline-forest" data-edit-listing="${item.id}">
              Edit
            </button>
            ${
              !isSold
                ? `<button type="button" class="btn btn-sm btn-outline-secondary" data-mark-sold="${item.id}" data-listing-title="${escapeHtml(item.title)}">
                     Mark as Sold
                   </button>`
                : ''
            }
            <button type="button" class="btn btn-sm btn-outline-danger ms-auto" data-delete-listing="${item.id}" data-listing-title="${escapeHtml(item.title)}">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderListingModal(state: AppState): string {
  if (!state.showListingModal) return '';
  const editing = state.editingListing;
  const category = editing?.category ?? 'Book';
  const notesFormat = editing?.notesFormat ?? 'Hardcopy';
  const condition = editing?.condition ?? 'Good';
  const isDigitalNotes = category === 'Notes' && notesFormat === 'Digital';

  return `
    <div class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="listingModalTitle" style="background: rgba(28,36,33,0.48);">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content border-0 shadow-lg" style="border-radius: var(--pp-radius); background-color: var(--pp-surface);">
          <div class="modal-header border-bottom" style="border-color: var(--pp-border) !important;">
            <h2 class="modal-title h5 fw-bold" id="listingModalTitle">
              ${editing ? 'Edit Listing' : 'Create New Listing'}
            </h2>
            <button type="button" class="btn-close" data-action="close-listing-modal" aria-label="Close modal"></button>
          </div>
          <div class="modal-body p-4">
            <div id="listing-form-error" class="alert alert-danger py-2 small d-none" role="alert"></div>
            <form id="pp-listing-form" novalidate>
              <div class="row g-3">
                <div class="col-md-6">
                  <label for="listing-category" class="form-label fw-medium small">Listing Type</label>
                  <select id="listing-category" name="category" class="form-select" required>
                    <option value="Book" ${category === 'Book' ? 'selected' : ''}>Books</option>
                    <option value="Notes" ${category === 'Notes' ? 'selected' : ''}>Notes</option>
                  </select>
                </div>

                <div class="col-md-6 ${category === 'Notes' ? '' : 'd-none'}" id="notes-format-group">
                  <label for="listing-notes-format" class="form-label fw-medium small">Notes Format</label>
                  <select id="listing-notes-format" name="notesFormat" class="form-select">
                    <option value="Hardcopy" ${notesFormat === 'Hardcopy' ? 'selected' : ''}>Hardcopy</option>
                    <option value="Digital" ${notesFormat === 'Digital' ? 'selected' : ''}>Digital</option>
                  </select>
                </div>

                <div class="col-md-6 ${isDigitalNotes ? 'd-none' : ''}" id="condition-group">
                  <label for="listing-condition" class="form-label fw-medium small">Condition</label>
                  <select id="listing-condition" name="condition" class="form-select">
                    <option value="Excellent" ${condition === 'Excellent' ? 'selected' : ''}>Excellent</option>
                    <option value="Good" ${condition === 'Good' ? 'selected' : ''}>Good</option>
                    <option value="Moderate" ${condition === 'Moderate' ? 'selected' : ''}>Moderate</option>
                    <option value="Poor" ${condition === 'Poor' ? 'selected' : ''}>Poor</option>
                  </select>
                </div>

                <div class="col-md-6">
                  <label for="listing-price" class="form-label fw-medium small">Asking Price (₹)</label>
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    id="listing-price"
                    name="price"
                    class="form-control"
                    placeholder="e.g., 450"
                    value="${editing ? escapeHtml(editing.price) : ''}"
                    required
                  />
                </div>

                <div class="col-12">
                  <label for="listing-title" class="form-label fw-medium small">Title</label>
                  <input
                    type="text"
                    id="listing-title"
                    name="title"
                    class="form-control"
                    placeholder="e.g., Operating Systems Concepts (10th Ed) or CS301 Lecture Notes"
                    value="${editing ? escapeHtml(editing.title) : ''}"
                    required
                  />
                </div>

                <div class="col-12">
                  <label for="listing-description" class="form-label fw-medium small">Description</label>
                  <textarea
                    id="listing-description"
                    name="description"
                    rows="4"
                    class="form-control"
                    placeholder="Include edition, syllabus coverage, highlighting/annotations, and preferred campus meetup spot..."
                    required
                  >${editing ? escapeHtml(editing.description) : ''}</textarea>
                </div>

                <div class="col-12">
                  <label for="listing-images-input" class="form-label fw-medium small" id="listing-images-label">
                    ${isDigitalNotes ? 'Preview Images (JPG, PNG, WebP, max 5 MB each)' : 'Photos (JPG, PNG, WebP, max 5 MB each)'}
                  </label>
                  <input
                    type="file"
                    id="listing-images-input"
                    class="form-control"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                  />
                  <div id="listing-images-preview" class="d-flex flex-wrap gap-2 mt-3"></div>
                </div>
              </div>

              <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top" style="border-color: var(--pp-border) !important;">
                <button type="button" class="btn btn-outline-secondary" data-action="close-listing-modal">
                  Cancel
                </button>
                <button type="submit" class="btn btn-forest" id="listing-submit-btn">
                  ${editing ? 'Save Changes' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;
}
