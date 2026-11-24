import { escapeHtml } from '../dom.ts';
import type { AppState } from '../types.ts';

export function renderProfileView(state: AppState, savedBanner = false, errorMsg = ''): string {
  const user = state.user;
  if (!user) return '';

  const currentRole =
    user.isBuyer && user.isSeller ? 'both' : user.isSeller ? 'seller' : 'buyer';

  return `
    <main class="container py-4 py-lg-5" style="max-width: 720px;">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 class="h2 fw-bold mb-1">Your Profile</h1>
          <p class="mb-0" style="color: var(--pp-muted);">
            Manage your campus identity and active marketplace roles.
          </p>
        </div>
        <button type="button" class="btn btn-outline-danger" id="logout-btn">
          Log Out
        </button>
      </div>

      ${
        savedBanner
          ? `<div class="alert alert-success py-2 small" role="status">Profile updated successfully.</div>`
          : ''
      }
      ${
        errorMsg
          ? `<div class="alert alert-danger py-2 small" role="alert">${escapeHtml(errorMsg)}</div>`
          : ''
      }

      <div class="pp-card p-4 p-md-5">
        <form id="pp-profile-form" novalidate>
          <div class="mb-3">
            <label for="profile-name" class="form-label fw-medium small">Full Name</label>
            <input
              type="text"
              id="profile-name"
              name="name"
              class="form-control"
              value="${escapeHtml(user.name)}"
              required
            />
          </div>

          <div class="mb-3">
            <label for="profile-email" class="form-label fw-medium small">Email Address</label>
            <input
              type="email"
              id="profile-email"
              class="form-control"
              value="${escapeHtml(user.email)}"
              disabled
              readonly
            />
            <div class="form-text">Your registered account email cannot be changed.</div>
          </div>

          <div class="mb-4">
            <label for="profile-college" class="form-label fw-medium small">College / University Name</label>
            <input
              type="text"
              id="profile-college"
              name="collegeName"
              class="form-control"
              value="${escapeHtml(user.collegeName)}"
              required
            />
          </div>

          <div class="mb-4">
            <label class="form-label fw-medium small d-block">Available Roles</label>
            <div class="row g-2">
              <div class="col-12 col-sm-4">
                <input type="radio" class="btn-check" name="role" id="prof-role-buyer" value="buyer" ${currentRole === 'buyer' ? 'checked' : ''} />
                <label class="pp-role-option" for="prof-role-buyer">
                  <span class="d-flex w-100 justify-content-between align-items-center mb-1">
                    <span class="pp-role-title">Buyer</span>
                    <i class="bi bi-check-circle-fill pp-role-check" aria-hidden="true"></i>
                  </span>
                  <span class="pp-role-desc">Browse &amp; request items</span>
                </label>
              </div>
              <div class="col-12 col-sm-4">
                <input type="radio" class="btn-check" name="role" id="prof-role-seller" value="seller" ${currentRole === 'seller' ? 'checked' : ''} />
                <label class="pp-role-option" for="prof-role-seller">
                  <span class="d-flex w-100 justify-content-between align-items-center mb-1">
                    <span class="pp-role-title">Seller</span>
                    <i class="bi bi-check-circle-fill pp-role-check" aria-hidden="true"></i>
                  </span>
                  <span class="pp-role-desc">Post books &amp; notes</span>
                </label>
              </div>
              <div class="col-12 col-sm-4">
                <input type="radio" class="btn-check" name="role" id="prof-role-both" value="both" ${currentRole === 'both' ? 'checked' : ''} />
                <label class="pp-role-option" for="prof-role-both">
                  <span class="d-flex w-100 justify-content-between align-items-center mb-1">
                    <span class="pp-role-title">Both</span>
                    <i class="bi bi-check-circle-fill pp-role-check" aria-hidden="true"></i>
                  </span>
                  <span class="pp-role-desc">Buy &amp; sell on campus</span>
                </label>
              </div>
            </div>
            <div class="form-text mt-2">
              Users can hold both Buyer and Seller roles simultaneously.
            </div>
          </div>

          <button type="submit" class="btn btn-forest" id="profile-save-btn">
            Save Profile Changes
          </button>
        </form>
      </div>
    </main>
  `;
}
