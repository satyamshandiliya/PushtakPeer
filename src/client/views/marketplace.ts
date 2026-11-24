import { escapeHtml, formatPrice, renderImageWithFallback } from '../dom.ts';
import type { AppState } from '../types.ts';

export function renderMarketplaceView(state: AppState): string {
  const { listings, listingsLoading, filters, user } = state;

  return `
    <main class="container py-4 py-lg-5">
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 class="h2 fw-bold mb-1">Campus Marketplace</h1>
          <p class="mb-0" style="color: var(--pp-muted);">
            Browse verified student-listed textbooks and study notes.
          </p>
        </div>
        ${
          user?.isSeller
            ? `<button type="button" class="btn btn-forest" data-action="open-create-listing">
                 <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Post Listing
               </button>`
            : ''
        }
      </div>

      <section class="pp-card p-3 p-md-4 mb-4" aria-label="Search and filter listings">
        <form id="pp-filter-form" class="row g-3 align-items-center">
          <div class="col-lg-5">
            <label for="market-search" class="visually-hidden">Search books or notes</label>
            <div class="input-group">
              <span class="input-group-text bg-white border-end-0" style="border-color: var(--pp-border);">
                <i class="bi bi-search" aria-hidden="true"></i>
              </span>
              <input
                type="search"
                id="market-search"
                class="form-control border-start-0"
                placeholder="Search by title, subject, seller, or college..."
                value="${escapeHtml(filters.q)}"
              />
              <button type="submit" class="btn btn-forest">Search</button>
            </div>
          </div>

          <div class="col-sm-7 col-lg-4 d-flex align-items-center gap-2">
            <span class="small fw-medium d-none d-xl-inline" style="color: var(--pp-muted);">Category:</span>
            <div class="pp-segmented" role="group" aria-label="Filter by category">
              ${(['All', 'Book', 'Notes'] as const)
                .map(
                  (cat) => `
                    <button
                      type="button"
                      class="pp-segmented-btn ${filters.category === cat ? 'active' : ''}"
                      data-filter-category="${cat}"
                    >
                      ${cat === 'Book' ? 'Books' : cat}
                    </button>
                  `
                )
                .join('')}
            </div>
          </div>

          <div class="col-sm-5 col-lg-3">
            <label for="market-condition" class="visually-hidden">Filter by condition</label>
            <select id="market-condition" class="form-select">
              <option value="All" ${filters.condition === 'All' ? 'selected' : ''}>All Conditions</option>
              <option value="Excellent" ${filters.condition === 'Excellent' ? 'selected' : ''}>Excellent</option>
              <option value="Good" ${filters.condition === 'Good' ? 'selected' : ''}>Good</option>
              <option value="Moderate" ${filters.condition === 'Moderate' ? 'selected' : ''}>Moderate</option>
              <option value="Poor" ${filters.condition === 'Poor' ? 'selected' : ''}>Poor</option>
            </select>
          </div>
        </form>
      </section>

      ${
        listingsLoading
          ? `<div class="text-center py-5">
               <div class="spinner-border text-success" role="status">
                 <span class="visually-hidden">Loading listings...</span>
               </div>
               <p class="small mt-2 mb-0" style="color: var(--pp-muted);">Loading marketplace listings...</p>
             </div>`
          : listings.length === 0
            ? `<div class="pp-surface-alt p-5 text-center">
                 <i class="bi bi-journal-x fs-1 mb-2 d-block" style="color: var(--pp-forest);" aria-hidden="true"></i>
                 <h2 class="h5 fw-bold mb-1">No matching listings found</h2>
                 <p class="small mb-3" style="color: var(--pp-muted);">
                   Try clearing your search or switching category and condition filters.
                 </p>
                 <button type="button" class="btn btn-outline-forest" id="clear-filters-btn">
                   Reset Filters
                 </button>
               </div>`
            : `<div class="row g-4" id="marketplace-grid">
                 ${listings
                   .map((item) => {
                     const metaParts = [
                       item.category === 'Notes' && item.notesFormat
                         ? `Notes (${item.notesFormat})`
                         : item.category,
                     ];
                     if (item.condition) metaParts.push(item.condition);

                     return `
                       <div class="col-md-6 col-lg-4">
                         <article class="pp-card pp-card-interactive h-100 d-flex flex-column" data-listing-card="${item.id}">
                           <div class="pp-media-frame">
                             ${renderImageWithFallback(item.coverImage, item.title, item.title)}
                           </div>
                           <div class="p-3 p-lg-4 d-flex flex-column flex-grow-1">
                             <div class="small mb-1" style="color: var(--pp-muted);">
                               ${escapeHtml(metaParts.join(' · '))}
                             </div>
                             <h2 class="h6 fw-bold mb-2">${escapeHtml(item.title)}</h2>
                             <div class="small mb-3" style="color: var(--pp-muted);">
                               ${escapeHtml(item.sellerName)} · ${escapeHtml(item.collegeName)}
                             </div>
                             <div class="mt-auto d-flex justify-content-between align-items-center pt-3 border-top" style="border-color: var(--pp-border) !important;">
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
    </main>
  `;
}
