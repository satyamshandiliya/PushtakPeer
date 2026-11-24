import { escapeHtml } from '../dom.ts';

export function renderLoginView(errorMessage = ''): string {
  return `
    <main class="container py-5">
      <div class="row justify-content-center">
        <div class="col-md-8 col-lg-5">
          <div class="pp-card p-4 p-md-5">
            <h1 class="h3 fw-bold mb-1">Welcome back</h1>
            <p class="small mb-4" style="color: var(--pp-muted);">
              Sign in to browse campus books, manage listings, and chat with peers.
            </p>

            ${
              errorMessage
                ? `<div class="alert alert-danger py-2 small" role="alert">${escapeHtml(errorMessage)}</div>`
                : ''
            }

            <form id="pp-login-form" novalidate>
              <div class="mb-3">
                <label for="login-email" class="form-label fw-medium small">Email address</label>
                <input
                  type="email"
                  class="form-control"
                  id="login-email"
                  name="email"
                  placeholder="you@college.edu"
                  required
                />
              </div>
              <div class="mb-4">
                <label for="login-password" class="form-label fw-medium small">Password</label>
                <input
                  type="password"
                  class="form-control"
                  id="login-password"
                  name="password"
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button type="submit" class="btn btn-forest w-100 mb-3" id="login-submit-btn">
                Sign In
              </button>
            </form>

            <div class="d-flex align-items-center gap-2 my-3">
              <hr class="flex-grow-1 my-0" />
              <span class="small" style="color: var(--pp-muted);">or</span>
              <hr class="flex-grow-1 my-0" />
            </div>

            <button type="button" class="btn btn-outline-secondary w-100 mb-4" id="google-signin-btn">
              <i class="bi bi-google me-2" aria-hidden="true"></i>Continue with Google
            </button>

            <div class="pp-surface-alt p-3 small mb-3">
              <div class="fw-semibold mb-1" style="color: var(--pp-forest);">Seeded Student Test Accounts</div>
              <div style="color: var(--pp-muted);">Password for all demo accounts: <span class="pp-mono">Campus@123</span></div>
              <div class="d-flex flex-wrap gap-2 mt-2">
                <button type="button" class="btn btn-sm btn-outline-forest" data-fill-demo="aarav@campus.edu">
                  Aarav (Buyer &amp; Seller)
                </button>
                <button type="button" class="btn btn-sm btn-outline-forest" data-fill-demo="priya@campus.edu">
                  Priya (Buyer)
                </button>
                <button type="button" class="btn btn-sm btn-outline-forest" data-fill-demo="meera@campus.edu">
                  Meera (Seller)
                </button>
              </div>
            </div>

            <p class="small text-center mb-0" style="color: var(--pp-muted);">
              New to PushtakPeer?
              <button type="button" class="btn btn-link btn-sm p-0 align-baseline fw-semibold" style="color: var(--pp-forest);" data-nav="register">
                Create an account
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  `;
}

export function renderRegisterView(
  errorMessage = '',
  fieldErrors: Record<string, string> = {}
): string {
  const errFor = (key: string) =>
    fieldErrors[key]
      ? `<div class="invalid-feedback d-block">${escapeHtml(fieldErrors[key])}</div>`
      : '';

  return `
    <main class="container py-5">
      <div class="row justify-content-center">
        <div class="col-md-9 col-lg-6">
          <div class="pp-card p-4 p-md-5">
            <h1 class="h3 fw-bold mb-1">Join PushtakPeer</h1>
            <p class="small mb-4" style="color: var(--pp-muted);">
              Create your student profile to buy, sell, or do both on your campus.
            </p>

            ${
              errorMessage
                ? `<div class="alert alert-danger py-2 small" role="alert">${escapeHtml(errorMessage)}</div>`
                : ''
            }

            <form id="pp-register-form" novalidate>
              <div class="row g-3">
                <div class="col-12">
                  <label for="reg-name" class="form-label fw-medium small">Full Name</label>
                  <input
                    type="text"
                    class="form-control ${fieldErrors.name ? 'is-invalid' : ''}"
                    id="reg-name"
                    name="name"
                    placeholder="e.g., Ananya Verma"
                    required
                  />
                  ${errFor('name')}
                </div>

                <div class="col-12">
                  <label for="reg-email" class="form-label fw-medium small">Email Address</label>
                  <input
                    type="email"
                    class="form-control ${fieldErrors.email ? 'is-invalid' : ''}"
                    id="reg-email"
                    name="email"
                    placeholder="you@college.edu"
                    required
                  />
                  ${errFor('email')}
                </div>

                <div class="col-12">
                  <label for="reg-college" class="form-label fw-medium small">College / University Name</label>
                  <input
                    type="text"
                    class="form-control ${fieldErrors.collegeName ? 'is-invalid' : ''}"
                    id="reg-college"
                    name="collegeName"
                    placeholder="e.g., IIT Delhi, Delhi University, BITS Pilani"
                    required
                  />
                  ${errFor('collegeName')}
                </div>

                <div class="col-md-6">
                  <label for="reg-password" class="form-label fw-medium small">Password</label>
                  <input
                    type="password"
                    class="form-control ${fieldErrors.password ? 'is-invalid' : ''}"
                    id="reg-password"
                    name="password"
                    placeholder="Minimum 8 characters"
                    required
                  />
                  ${errFor('password')}
                </div>

                <div class="col-md-6">
                  <label for="reg-confirm-password" class="form-label fw-medium small">Confirm Password</label>
                  <input
                    type="password"
                    class="form-control ${fieldErrors.confirmPassword ? 'is-invalid' : ''}"
                    id="reg-confirm-password"
                    name="confirmPassword"
                    placeholder="Re-enter password"
                    required
                  />
                  ${errFor('confirmPassword')}
                </div>

                <div class="col-12">
                  <label class="form-label fw-medium small d-block">How will you use PushtakPeer?</label>
                  <div class="row g-2">
                    <div class="col-12 col-sm-4">
                      <input type="radio" class="btn-check" name="role" id="role-buyer" value="buyer" />
                      <label class="pp-role-option" for="role-buyer">
                        <span class="d-flex w-100 justify-content-between align-items-center mb-1">
                          <span class="pp-role-title">Buyer</span>
                          <i class="bi bi-check-circle-fill pp-role-check" aria-hidden="true"></i>
                        </span>
                        <span class="pp-role-desc">Browse &amp; request items</span>
                      </label>
                    </div>
                    <div class="col-12 col-sm-4">
                      <input type="radio" class="btn-check" name="role" id="role-seller" value="seller" />
                      <label class="pp-role-option" for="role-seller">
                        <span class="d-flex w-100 justify-content-between align-items-center mb-1">
                          <span class="pp-role-title">Seller</span>
                          <i class="bi bi-check-circle-fill pp-role-check" aria-hidden="true"></i>
                        </span>
                        <span class="pp-role-desc">Post books &amp; notes</span>
                      </label>
                    </div>
                    <div class="col-12 col-sm-4">
                      <input type="radio" class="btn-check" name="role" id="role-both" value="both" checked />
                      <label class="pp-role-option" for="role-both">
                        <span class="d-flex w-100 justify-content-between align-items-center mb-1">
                          <span class="pp-role-title">Both</span>
                          <i class="bi bi-check-circle-fill pp-role-check" aria-hidden="true"></i>
                        </span>
                        <span class="pp-role-desc">Buy &amp; sell on campus</span>
                      </label>
                    </div>
                  </div>
                  ${errFor('role')}
                </div>
              </div>

              <button type="submit" class="btn btn-forest w-100 mt-4 mb-3" id="register-submit-btn">
                Create Student Account
              </button>
            </form>

            <div class="d-flex align-items-center gap-2 my-3">
              <hr class="flex-grow-1 my-0" />
              <span class="small" style="color: var(--pp-muted);">or</span>
              <hr class="flex-grow-1 my-0" />
            </div>

            <button type="button" class="btn btn-outline-secondary w-100 mb-3" id="google-signin-btn">
              <i class="bi bi-google me-2" aria-hidden="true"></i>Sign Up with Google
            </button>

            <p class="small text-center mb-0" style="color: var(--pp-muted);">
              Already have an account?
              <button type="button" class="btn btn-link btn-sm p-0 align-baseline fw-semibold" style="color: var(--pp-forest);" data-nav="login">
                Login
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  `;
}
