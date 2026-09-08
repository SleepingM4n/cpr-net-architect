import { ID, uid, assert, log } from "../constants.js";

/** Native Foundry whispers are used for presentation, never as the security boundary.
 * The public ChatMessage contains only an opaque ID and a neutral placeholder.
 * CPR's full card is retained in private storage and delivered by encrypted RPC.
 */
export class ChatService {
  constructor(store, socket, adapter) {
    Object.assign(this, {
      store,
      socket,
      adapter
    });
    this.cache = new Map();
    this.requested = new Set();
  }
  initialize() {
    Hooks.on("renderChatMessage", (message, html) => {
      const id = message.getFlag(ID, "cardId");
      if (!id) return;
      const container = html[0].querySelector(".message-content");
      if (!container) return;
      container.dataset.netaCard = id;
      if (this.cache.has(id)) {
        this.mount(container, this.cache.get(id));
        return;
      }
      if (!this.requested.has(id)) {
        this.requested.add(id);
        this.socket.request({
          action: "chat",
          cardId: id
        }).catch(error => log.debug("Private roll unavailable", error.message)).finally(() => this.requested.delete(id));
      }
    });
  }
  async post(html, recipients) {
    assert(game.user.isGM, "Only a GM may publish private CPR cards.");
    const id = uid(),
      card = {
        id,
        recipients: [...new Set(recipients)],
        html
      };
    await this.store.saveCard(card);
    if (card.recipients.includes(game.user.id)) this.cache.set(id, html);
    await ChatMessage.create({
      speaker: {
        alias: "NET Architect"
      },
      content: '<p class="neta-private-roll">NET Architect // Private CPR Roll</p>',
      whisper: card.recipients,
      flags: {
        [ID]: {
          cardId: id
        }
      }
    });
  }
  async deliver(user, id) {
    assert(typeof id === "string" && id.length <= 80, "Invalid card ID.");
    const card = await this.store.loadCard(id);
    assert(card && card.recipients.includes(user.id), "This private CPR card is not shared with you.");
    if (user.id === game.user.id) return this.receive({
      id,
      html: card.html
    });
    await this.socket.send(user.id, {
      kind: "chat",
      card: {
        id,
        html: card.html
      }
    });
  }
  async receive(card) {
    assert(card && typeof card.id === "string" && typeof card.html === "string", "Invalid CPR chat card.");
    this.cache.set(card.id, card.html);
    for (const el of document.querySelectorAll(`[data-neta-card="${CSS.escape(card.id)}"]`)) this.mount(el, card.html);
  }
  mount(container, html) {
    container.innerHTML = html;
    this.adapter.bindNativeChat($(container)).catch(log.error);
  }
}
