import { escapeHtml, formatPrice, renderImageWithFallback } from '../dom.ts';
import type { AppState } from '../types.ts';

export function renderLandingView(state: AppState): string {
  const previewItems = state.listings.slice(0, 3);

  return `
    <main class="py-5">
      <section class="container pb-5">
        <div class="row g-4 align-items-stretch">
          <div class="col-lg-6 d-flex flex-column justify-content-center py-lg-4 pe-lg-4">
            <p class="fw-semibold small mb-2" style="color: var(--pp-forest); letter-spacing: 0.02em;">
              Campus Book &amp; Notes Exchange
            </p>
            <h1 class="display-5 fw-bold pp-balance mb-3">
              Your Campus. Your Books. Your Community.
            </h1>
            <p class="lead mb-4" style="color: var(--pp-muted); max-width: 52ch;">
              Buy and sell second-hand textbooks, spiral-bound lecture notes, and digital study packs directly with verified students from your college. No commissions, no middlemen.
            </p>
            <div class="d-flex flex-wrap gap-3 mb-4">
              <button type="button" class="btn btn-forest btn-lg px-4" data-nav="register">
                Sign Up Free
              </button>
              <button type="button" class="btn btn-outline-forest btn-lg px-4" data-nav="login">
                Login
              </button>
              <button type="button" class="btn btn-link text-decoration-none fw-semibold px-2" style="color: var(--pp-ink);" data-nav="marketplace">
                Browse Marketplace <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i>
              </button>
            </div>
            <div class="d-flex flex-wrap gap-4 pt-3 border-top" style="border-color: var(--pp-border) !important;">
              <div>
                <div class="fw-bold fs-5 pp-tabular" style="color: var(--pp-forest);">Direct Peer Chat</div>
                <div class="small" style="color: var(--pp-muted);">Seller-approved private messaging</div>
              </div>
              <div>
                <div class="fw-bold fs-5 pp-tabular" style="color: var(--pp-forest);">Zero Platform Fees</div>
                <div class="small" style="color: var(--pp-muted);">Meet on campus and settle directly</div>
              </div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="pp-card h-100" style="min-height: 360px;">
              <img
                src="/src/assets/images/hero_campus_books_1795506810236.jpg"
                alt="Stacked university textbooks and handwritten study notebook on a sunlit wooden library desk"
                class="w-100 h-100 object-fit-cover"
                style="min-height: 360px;"
                referrerpolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="container py-5 border-top" style="border-color: var(--pp-border) !important;">
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
          <div>
            <h2 class="h3 fw-bold mb-1">Recently Listed on Campus</h2>
            <p class="mb-0" style="color: var(--pp-muted);">
              Real textbooks and notes available from students right now.
            </p>
          </div>
          <button type="button" class="btn btn-outline-forest" data-nav="marketplace">
            View All Listings
          </button>
        </div>

        ${
          previewItems.length === 0
            ? `<div class="pp-surface-alt p-4 text-center">
                 <p class="mb-0" style="color: var(--pp-muted);">Loading campus listings...</p>
               </div>`
            : `<div class="row g-4">
                 ${previewItems
                   .map((item) => {
                     const metaParts = [
                       item.category === 'Notes' && item.notesFormat
                         ? `Notes (${item.notesFormat})`
                         : item.category,
                     ];
                     if (item.condition) metaParts.push(`${item.condition} condition`);
                     return `
                       <div class="col-md-6 col-lg-4">
                         <article class="pp-card pp-card-interactive h-100 d-flex flex-column">
                           <div class="pp-media-frame">
                             ${renderImageWithFallback(item.coverImage, item.title, item.title)}
                           </div>
                           <div class="p-3 p-lg-4 d-flex flex-column flex-grow-1">
                             <div class="small mb-1" style="color: var(--pp-muted);">
                               ${escapeHtml(metaParts.join(' · '))}
                             </div>
                             <h3 class="h6 fw-bold mb-2">${escapeHtml(item.title)}</h3>
                             <div class="small mb-3" style="color: var(--pp-muted);">
                               ${escapeHtml(item.sellerName)} · ${escapeHtml(item.collegeName)}
                             </div>
                             <div class="mt-auto d-flex justify-content-between align-items-center pt-2 border-top" style="border-color: var(--pp-border) !important;">
                               <span class="fw-bold fs-5 pp-tabular" style="color: var(--pp-forest);">${formatPrice(item.price)}</span>
                               <button type="button" class="btn btn-sm btn-outline-forest" data-view-listing="${item.id}">
                                 View Details
                               </button>
                             </div>
                           </div>
                         </article>
                       </div>
                     `;
                   })
                   .join('')}
               </div>`
        }
      </section>

      <section class="container py-5 border-top" style="border-color: var(--pp-border) !important;">
        <div class="row g-4">
          <div class="col-md-4">
            <div class="pp-surface-alt p-4 h-100">
              <div class="fw-bold mb-2" style="color: var(--pp-forest);">01. List in 60 Seconds</div>
              <p class="small mb-0" style="color: var(--pp-muted);">
                Post second-hand textbooks, hardcopy lecture notes, or digital PDFs with clear photos and your asking price.
              </p>
            </div>
          </div>
          <div class="col-md-4">
            <div class="pp-surface-alt p-4 h-100">
              <div class="fw-bold mb-2" style="color: var(--pp-forest);">02. Request &amp; Approve</div>
              <p class="small mb-0" style="color: var(--pp-muted);">
                Interested buyers tap "I'm Interested" to alert the seller in real time. Sellers approve chat requests before private messaging unlocks.
              </p>
            </div>
          </div>
          <div class="col-md-4">
            <div class="pp-surface-alt p-4 h-100">
              <div class="fw-bold mb-2" style="color: var(--pp-forest);">03. Meet &amp; Exchange</div>
              <p class="small mb-0" style="color: var(--pp-muted);">
                Coordinate campus pickup directly in private real-time chat and mark your listing as sold once handed over.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;
}
