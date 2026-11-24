export function escapeHtml(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPrice(price: number): string {
  const num = Number(price) || 0;
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatTimestamp(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function renderImageWithFallback(
  src: string | null | undefined,
  alt: string,
  titleForFallback: string,
  extraImgClass = ''
): string {
  const safeAlt = escapeHtml(alt);
  const safeTitle = escapeHtml(titleForFallback);
  if (!src) {
    return `
      <div class="pp-media-fallback">
        <i class="bi bi-book fs-2 mb-2" aria-hidden="true"></i>
        <span class="small fw-semibold">${safeTitle}</span>
      </div>
    `;
  }
  const safeSrc = escapeHtml(src);
  return `
    <img
      src="${safeSrc}"
      alt="${safeAlt}"
      class="${extraImgClass}"
      referrerpolicy="no-referrer"
      onerror="this.style.display='none'; this.nextElementSibling.classList.remove('d-none'); this.nextElementSibling.removeAttribute('aria-hidden');"
    />
    <div class="pp-media-fallback d-none" aria-hidden="true">
      <i class="bi bi-book fs-2 mb-2" aria-hidden="true"></i>
      <span class="small fw-semibold">${safeTitle}</span>
    </div>
  `;
}

export function showToast(message: string, variant: 'success' | 'error' | 'info' = 'info') {
  const container = document.getElementById('pp-toast-container');
  if (!container) return;

  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const iconClass =
    variant === 'success'
      ? 'bi-check-circle-fill text-success'
      : variant === 'error'
        ? 'bi-exclamation-triangle-fill text-danger'
        : 'bi-bell-fill text-success';

  const toastEl = document.createElement('div');
  toastEl.id = id;
  toastEl.className = 'toast show align-items-center bg-white border shadow-sm mb-2';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  toastEl.innerHTML = `
    <div class="d-flex align-items-center px-3 py-2 gap-2">
      <i class="bi ${iconClass}" aria-hidden="true"></i>
      <div class="toast-body p-0 flex-grow-1 small fw-medium">${escapeHtml(message)}</div>
      <button type="button" class="btn-close ms-2" aria-label="Dismiss notification"></button>
    </div>
  `;

  toastEl.querySelector('.btn-close')?.addEventListener('click', () => toastEl.remove());
  container.appendChild(toastEl);

  window.setTimeout(() => {
    toastEl.remove();
  }, 4500);
}
