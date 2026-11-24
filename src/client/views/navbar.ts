import { escapeHtml } from '../dom.ts';
import type { AppRoute, AppState } from '../types.ts';

export function renderNavbar(state: AppState): string {
  const { user, route, unreadNotifications } = state;

  const isRoute = (r: AppRoute) => (route === r ? 'active' : '');

  if (!user) {
    return `
      <header class="pp-navbar sticky-top">
        <nav class="navbar navbar-expand-lg" aria-label="Primary navigation">
          <div class="container py-1 gap-lg-4">
            <a href="#/" data-nav="landing" class="pp-brand">PushtakPeer</a>
            <button
              class="navbar-toggler border-0 shadow-none"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#ppNavbarCollapse"
              aria-controls="ppNavbarCollapse"
              aria-expanded="false"
              aria-label="Toggle navigation menu"
            >
              <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="ppNavbarCollapse">
              <ul class="navbar-nav mx-lg-auto gap-lg-3 my-2 my-lg-0 align-items-lg-center">
                <li class="nav-item">
                  <button type="button" class="pp-nav-link ${isRoute('marketplace')}" data-nav="marketplace">
                    Marketplace
                  </button>
                </li>
                <li class="nav-item">
                  <button type="button" class="pp-nav-link ${isRoute('login')}" data-nav="login">
                    Login
                  </button>
                </li>
              </ul>
              <div class="d-flex align-items-center gap-2">
                <button type="button" class="btn btn-forest" data-nav="register">
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </nav>
      </header>
    `;
  }

  const unreadSpan =
    unreadNotifications > 0
      ? `<span class="pp-unread-count" aria-label="${unreadNotifications} unread notifications">${unreadNotifications}</span>`
      : '';

  const primaryCta = user.isSeller
    ? `<button type="button" class="btn btn-forest" data-action="open-create-listing">
         <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Post Listing
       </button>`
    : `<button type="button" class="btn btn-forest" data-nav="marketplace">
         Browse Books
       </button>`;

  return `
    <header class="pp-navbar sticky-top">
      <nav class="navbar navbar-expand-lg" aria-label="Primary navigation">
        <div class="container py-1 gap-lg-4">
          <a href="#/marketplace" data-nav="marketplace" class="pp-brand">PushtakPeer</a>
          <button
            class="navbar-toggler border-0 shadow-none"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#ppNavbarCollapse"
            aria-controls="ppNavbarCollapse"
            aria-expanded="false"
            aria-label="Toggle navigation menu"
          >
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="ppNavbarCollapse">
            <ul class="navbar-nav mx-lg-auto gap-lg-2 my-2 my-lg-0 align-items-lg-center">
              <li class="nav-item">
                <button type="button" class="pp-nav-link ${isRoute('marketplace')}" data-nav="marketplace">
                  Marketplace
                </button>
              </li>
              ${
                user.isBuyer
                  ? `<li class="nav-item">
                       <button type="button" class="pp-nav-link ${isRoute('buyer-hub')}" data-nav="buyer-hub">
                         My Requests
                       </button>
                     </li>`
                  : ''
              }
              ${
                user.isSeller
                  ? `<li class="nav-item">
                       <button type="button" class="pp-nav-link ${isRoute('seller-hub')}" data-nav="seller-hub">
                         Seller Hub
                       </button>
                     </li>`
                  : ''
              }
              <li class="nav-item">
                <button type="button" class="pp-nav-link ${isRoute('messages')}" data-nav="messages">
                  Messages
                </button>
              </li>
              <li class="nav-item">
                <button type="button" class="pp-nav-link ${isRoute('notifications')}" data-nav="notifications">
                  Notifications${unreadSpan}
                </button>
              </li>
              <li class="nav-item">
                <button type="button" class="pp-nav-link ${isRoute('profile')}" data-nav="profile">
                  ${escapeHtml(user.name.split(' ')[0])}
                </button>
              </li>
            </ul>
            <div class="d-flex align-items-center gap-2">
              ${primaryCta}
            </div>
          </div>
        </div>
      </nav>
    </header>
  `;
}
