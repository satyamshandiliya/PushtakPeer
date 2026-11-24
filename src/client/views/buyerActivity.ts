import { escapeHtml, formatPrice, formatRelativeTime, renderImageWithFallback } from '../dom.ts';
import type { AppState } from '../types.ts';

export function renderBuyerActivityView(state: AppState): string {
  const { sentRequests, conversations } = state;
  const acceptedConvos = conversations.filter((c) => c.myRole === 'Buyer');

  return `
    <main class="container py-4 py-lg-5">
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 class="h2 fw-bold mb-1">My Buyer Activity</h1>
          <p class="mb-0" style="color: var(--pp-muted);">
            Track your interest requests and jump into seller-approved private chats.
          </p>
        </div>
        <button type="button" class="btn btn-outline-forest" data-nav="marketplace">
          Browse More Books &amp; Notes
        </button>
      </div>

      <div class="row g-4">
        <div class="col-lg-7">
          <section class="pp-card p-4 h-100">
            <h2 class="h5 fw-bold mb-3">Sent Interest Requests</h2>
            ${
              sentRequests.length === 0
                ? `<div class="pp-surface-alt p-4 text-center">
                     <p class="small mb-2" style="color: var(--pp-muted);">You haven't expressed interest in any listings yet.</p>
                     <button type="button" class="btn btn-sm btn-forest" data-nav="marketplace">Explore Marketplace</button>
                   </div>`
                : `<div class="d-flex flex-column gap-3">
                     ${sentRequests
                       .map((req) => {
                         const statusClass =
                           req.status === 'Accepted'
                             ? 'pp-status-accepted'
                             : req.status === 'Declined'
                               ? 'pp-status-declined'
                               : 'pp-status-pending';
                         const statusIcon =
                           req.status === 'Accepted'
                             ? 'bi-check-circle'
                             : req.status === 'Declined'
                               ? 'bi-x-circle'
                               : 'bi-clock';

                         return `
                           <div class="border rounded-3 p-3 d-flex flex-column flex-sm-row gap-3 align-items-sm-center" style="border-color: var(--pp-border) !important;">
                             <div style="width: 84px; flex-shrink: 0;">
                               <div class="pp-media-frame rounded-2">
                                 ${renderImageWithFallback(req.coverImage, req.listingTitle, req.listingTitle)}
                               </div>
                             </div>
                             <div class="flex-grow-1 min-w-0">
                               <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                                 <button type="button" class="btn btn-link p-0 text-start fw-bold text-decoration-none text-truncate" style="color: var(--pp-ink); max-width: 100%;" data-view-listing="${req.listingId}">
                                   ${escapeHtml(req.listingTitle)}
                                 </button>
                                 <span class="fw-bold pp-tabular shrink-0" style="color: var(--pp-forest);">${formatPrice(req.listingPrice)}</span>
                               </div>
                               <div class="small mb-2" style="color: var(--pp-muted);">
                                 Seller: ${escapeHtml(req.sellerName)} · ${escapeHtml(req.sellerCollege)} · ${escapeHtml(formatRelativeTime(req.createdAt))}
                               </div>
                               <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                                 <span class="pp-status-text ${statusClass}">
                                   <i class="bi ${statusIcon}" aria-hidden="true"></i>${escapeHtml(req.status)}
                                 </span>
                                 <div class="d-flex gap-2">
                                   ${
                                     req.status === 'Accepted' && req.conversationId
                                       ? `<button type="button" class="btn btn-sm btn-forest" data-open-chat="${req.conversationId}">
                                            Open Chat
                                          </button>`
                                       : `<button type="button" class="btn btn-sm btn-outline-forest" data-view-listing="${req.listingId}">
                                            View Listing
                                          </button>`
                                   }
                                 </div>
                               </div>
                             </div>
                           </div>
                         `;
                       })
                       .join('')}
                   </div>`
            }
          </section>
        </div>

        <div class="col-lg-5">
          <section class="pp-card p-4 h-100">
            <h2 class="h5 fw-bold mb-3">Accepted Conversations</h2>
            ${
              acceptedConvos.length === 0
                ? `<div class="pp-surface-alt p-4 text-center">
                     <p class="small mb-0" style="color: var(--pp-muted);">
                       Once a seller accepts your interest request, your private conversation will appear here.
                     </p>
                   </div>`
                : `<div class="d-flex flex-column gap-2">
                     ${acceptedConvos
                       .map(
                         (c) => `
                           <button type="button" class="pp-convo-item rounded-3 border" style="border-color: var(--pp-border) !important;" data-open-chat="${c.id}">
                             <div class="d-flex justify-content-between align-items-center mb-1">
                               <span class="fw-bold small">${escapeHtml(c.peerName)}</span>
                               <span class="small pp-tabular" style="color: var(--pp-forest);">${formatPrice(c.listingPrice)}</span>
                             </div>
                             <div class="small fw-medium text-truncate mb-1">${escapeHtml(c.listingTitle)}</div>
                             <div class="small text-truncate" style="color: var(--pp-muted);">
                               ${escapeHtml(c.lastMessage ?? 'Chat unlocked — say hello')}
                             </div>
                           </button>
                         `
                       )
                       .join('')}
                   </div>`
            }
          </section>
        </div>
      </div>
    </main>
  `;
}
