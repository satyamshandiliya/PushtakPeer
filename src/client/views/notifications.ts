import { escapeHtml, formatTimestamp } from '../dom.ts';
import type { AppState } from '../types.ts';

export function renderNotificationsView(state: AppState): string {
  const { notifications, unreadNotifications } = state;

  return `
    <main class="container py-4 py-lg-5" style="max-width: 860px;">
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 class="h2 fw-bold mb-1">Notifications</h1>
          <p class="mb-0" style="color: var(--pp-muted);">
            ${unreadNotifications > 0 ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}` : 'You are all caught up'}
          </p>
        </div>
        ${
          unreadNotifications > 0
            ? `<button type="button" class="btn btn-outline-forest btn-sm" id="mark-all-read-btn">
                 Mark all as read
               </button>`
            : ''
        }
      </div>

      ${
        notifications.length === 0
          ? `<div class="pp-card p-5 text-center">
               <i class="bi bi-bell fs-1 mb-2 d-block" style="color: var(--pp-forest);" aria-hidden="true"></i>
               <h2 class="h5 fw-bold mb-1">No notifications yet</h2>
               <p class="small mb-0" style="color: var(--pp-muted);">
                 Interest requests, chat approvals, and new messages will appear here immediately.
               </p>
             </div>`
          : `<div class="d-flex flex-column gap-3">
               ${notifications
                 .map((n) => {
                   const typeLabel =
                     n.type === 'InterestRequest'
                       ? 'New Interest Request'
                       : n.type === 'ChatAccepted'
                         ? 'Chat Accepted'
                         : 'New Message';
                   const icon =
                     n.type === 'InterestRequest'
                       ? 'bi-hand-thumbs-up'
                       : n.type === 'ChatAccepted'
                         ? 'bi-check2-circle'
                         : 'bi-chat-left-text';

                   return `
                     <div class="pp-card p-3 p-md-4 ${n.isRead ? '' : 'border-success'}" style="${n.isRead ? '' : 'background-color: #f6fbf8;'}">
                       <div class="d-flex justify-content-between align-items-start gap-3">
                         <div class="d-flex gap-3">
                           <div class="pt-1" style="color: var(--pp-forest);">
                             <i class="bi ${icon} fs-5" aria-hidden="true"></i>
                           </div>
                           <div>
                             <div class="small fw-semibold mb-1" style="color: var(--pp-forest);">
                               ${escapeHtml(typeLabel)}${n.isRead ? '' : ' · Unread'}
                             </div>
                             <div class="fw-bold mb-1">${escapeHtml(n.title)}</div>
                             <p class="small mb-2" style="color: var(--pp-ink);">${escapeHtml(n.message)}</p>
                             <div class="small" style="color: var(--pp-muted);">${escapeHtml(formatTimestamp(n.createdAt))}</div>
                           </div>
                         </div>
                         <div class="d-flex flex-column align-items-end gap-2 shrink-0">
                           ${
                             n.relatedConversationId
                               ? `<button type="button" class="btn btn-sm btn-forest" data-notif-open-chat="${n.relatedConversationId}" data-notif-id="${n.id}">
                                    Open Chat
                                  </button>`
                               : n.type === 'InterestRequest'
                                 ? `<button type="button" class="btn btn-sm btn-forest" data-notif-review="${n.id}">
                                      Review Request
                                    </button>`
                                 : n.relatedListingId
                                   ? `<button type="button" class="btn btn-sm btn-outline-forest" data-notif-listing="${n.relatedListingId}" data-notif-id="${n.id}">
                                        View Listing
                                      </button>`
                                   : ''
                           }
                           ${
                             !n.isRead
                               ? `<button type="button" class="btn btn-link btn-sm p-0 text-decoration-none" style="color: var(--pp-muted);" data-mark-notif-read="${n.id}">
                                    Mark read
                                  </button>`
                               : ''
                           }
                         </div>
                       </div>
                     </div>
                   `;
                 })
                 .join('')}
             </div>`
      }
    </main>
  `;
}
