import { escapeHtml, formatPrice, formatRelativeTime, formatTimestamp } from '../dom.ts';
import type { AppState } from '../types.ts';

export function renderMessagesView(state: AppState): string {
  const { conversations, activeConversationId, activeMessages, user } = state;
  const activeConvo = conversations.find((c) => c.id === activeConversationId) ?? null;

  return `
    <main class="container py-4 py-lg-5">
      <div class="mb-4">
        <h1 class="h2 fw-bold mb-1">Private Messages</h1>
        <p class="mb-0" style="color: var(--pp-muted);">
          Real-time student-to-student chats unlocked after seller approval.
        </p>
      </div>

      ${
        conversations.length === 0
          ? `<div class="pp-card p-5 text-center">
               <i class="bi bi-chat-square-text fs-1 mb-2 d-block" style="color: var(--pp-forest);" aria-hidden="true"></i>
               <h2 class="h5 fw-bold mb-1">No conversations yet</h2>
               <p class="small mb-3" style="color: var(--pp-muted);">
                 Private conversations unlock when a seller accepts a buyer's interest request.
               </p>
               <button type="button" class="btn btn-forest" data-nav="marketplace">Browse Marketplace</button>
             </div>`
          : `<div class="pp-chat-shell row g-0">
               <div class="col-lg-4 pp-chat-sidebar">
                 <div class="p-3 border-bottom fw-bold small" style="border-color: var(--pp-border) !important; color: var(--pp-muted);">
                   Conversations (${conversations.length})
                 </div>
                 <div role="list">
                   ${conversations
                     .map(
                       (c) => `
                         <button
                           type="button"
                           class="pp-convo-item ${c.id === activeConversationId ? 'active' : ''}"
                           data-select-conversation="${c.id}"
                         >
                           <div class="d-flex justify-content-between align-items-center mb-1">
                             <span class="fw-bold small">${escapeHtml(c.peerName)}</span>
                             <span class="small" style="color: var(--pp-muted);">${escapeHtml(formatRelativeTime(c.lastMessageAt))}</span>
                           </div>
                           <div class="small fw-medium text-truncate mb-1" style="color: var(--pp-forest);">
                             ${escapeHtml(c.listingTitle)} · ${formatPrice(c.listingPrice)}
                           </div>
                           <div class="small text-truncate" style="color: var(--pp-muted);">
                             ${escapeHtml(c.myRole)} · ${escapeHtml(c.lastMessage ?? 'No messages yet')}
                           </div>
                         </button>
                       `
                     )
                     .join('')}
                 </div>
               </div>

               <div class="col-lg-8 d-flex flex-column">
                 ${
                   !activeConvo
                     ? `<div class="flex-grow-1 d-flex align-items-center justify-content-center p-5 text-center" style="min-height: 460px;">
                          <div>
                            <i class="bi bi-chat-dots fs-1 mb-2 d-block" style="color: var(--pp-forest);" aria-hidden="true"></i>
                            <p class="small mb-0" style="color: var(--pp-muted);">Select a conversation to start messaging.</p>
                          </div>
                        </div>`
                     : `<div class="p-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2 bg-white" style="border-color: var(--pp-border) !important;">
                          <div>
                            <div class="fw-bold">${escapeHtml(activeConvo.peerName)} <span class="fw-normal small" style="color: var(--pp-muted);">· ${escapeHtml(activeConvo.peerCollege)}</span></div>
                            <div class="small" style="color: var(--pp-muted);">
                              About: <button type="button" class="btn btn-link p-0 align-baseline small fw-semibold text-decoration-none" style="color: var(--pp-forest);" data-view-listing="${activeConvo.listingId}">${escapeHtml(activeConvo.listingTitle)}</button> (${formatPrice(activeConvo.listingPrice)})
                            </div>
                          </div>
                          <span class="small fw-semibold" style="color: var(--pp-forest);">
                            ${escapeHtml(activeConvo.myRole)}
                          </span>
                        </div>

                        <div class="pp-chat-thread flex-grow-1" id="pp-chat-thread">
                          ${
                            activeMessages.length === 0
                              ? `<div class="text-center py-5">
                                   <p class="small mb-0" style="color: var(--pp-muted);">
                                     Conversation unlocked! Send a message below to coordinate campus meetup.
                                   </p>
                                 </div>`
                              : activeMessages
                                  .map((msg) => {
                                    const isMine = msg.senderId === user?.id;
                                    return `
                                      <div class="d-flex flex-column ${isMine ? 'align-items-end' : 'align-items-start'} mb-3">
                                        <div class="pp-msg-bubble ${isMine ? 'pp-msg-mine' : 'pp-msg-theirs'}">
                                          ${escapeHtml(msg.body)}
                                        </div>
                                        <div class="small mt-1" style="font-size: 0.72rem; color: var(--pp-muted);">
                                          ${escapeHtml(formatTimestamp(msg.createdAt))}
                                        </div>
                                      </div>
                                    `;
                                  })
                                  .join('')
                          }
                        </div>

                        <form id="pp-chat-form" class="p-3 border-top bg-white d-flex gap-2" style="border-color: var(--pp-border) !important;">
                          <label for="chat-message-input" class="visually-hidden">Type your message</label>
                          <input
                            type="text"
                            id="chat-message-input"
                            class="form-control"
                            placeholder="Write a message (e.g., Can we meet outside the library at 4 PM?)..."
                            maxlength="1500"
                            required
                          />
                          <button type="submit" class="btn btn-forest px-4" id="chat-send-btn">
                            Send
                          </button>
                        </form>`
                 }
               </div>
             </div>`
      }
    </main>
  `;
}
