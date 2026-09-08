import { ID, uid, assert, log } from "../constants.js";
const enc = new TextEncoder(),
  dec = new TextDecoder();
const b64 = bytes => {
  const a = new Uint8Array(bytes);
  let text = "";
  for (let i = 0; i < a.length; i += 8192) text += String.fromCharCode(...a.subarray(i, i + 8192));
  return btoa(text);
};
const un64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
export const authority = () => game.users.filter(u => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id))[0];

/** Foundry module sockets are broadcast transports, not authenticated RPC.
 * ECDH keys are bound to server-controlled User documents; AES-GCM authenticates
 * both directions and encrypts every body. Merely forging a userId is insufficient.
 * The public key must come from game.users, never from the untrusted packet.
 */
export class SocketService {
  constructor() {
    this.seen = new Map();
    this.pending = new Map();
    this.keys = new Map();
  }
  async initialize(onRequest, onState) {
    assert(globalThis.crypto?.subtle, "Secure synchronization requires HTTPS (or localhost).");
    this.onRequest = onRequest;
    this.onState = onState;
    this.pair = await crypto.subtle.generateKey({
      name: "ECDH",
      namedCurve: "P-256"
    }, false, ["deriveKey"]);
    const publicKey = await crypto.subtle.exportKey("jwk", this.pair.publicKey);
    await game.user.setFlag(ID, "transportKey", publicKey);
    game.socket.on(`module.${ID}`, packet => this.receive(packet).catch(e => log.debug("Rejected packet", e.message)));
  }
  async key(userId) {
    const jwk = game.users.get(userId)?.getFlag(ID, "transportKey");
    assert(jwk, "Recipient has not initialized NET Architect yet.");
    const fingerprint = JSON.stringify(jwk),
      cached = this.keys.get(userId);
    if (cached?.fingerprint === fingerprint) return cached.key;
    const remote = await crypto.subtle.importKey("jwk", jwk, {
      name: "ECDH",
      namedCurve: "P-256"
    }, false, []);
    const key = await crypto.subtle.deriveKey({
      name: "ECDH",
      public: remote
    }, this.pair.privateKey, {
      name: "AES-GCM",
      length: 256
    }, false, ["encrypt", "decrypt"]);
    this.keys.set(userId, {
      fingerprint,
      key
    });
    return key;
  }
  async send(to, body) {
    const header = {
        from: game.user.id,
        to,
        id: uid(),
        time: Date.now()
      },
      iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({
      name: "AES-GCM",
      iv,
      additionalData: enc.encode(JSON.stringify(header))
    }, await this.key(to), enc.encode(JSON.stringify(body)));
    game.socket.emit(`module.${ID}`, {
      ...header,
      iv: b64(iv),
      data: b64(ciphertext)
    });
  }
  async receive(packet) {
    if (!packet || packet.to !== game.user.id || typeof packet.data !== "string" || packet.data.length > 2000000) return;
    const {
      from,
      to,
      id,
      time
    } = packet;
    assert(typeof id === "string" && id.length < 90 && Number.isFinite(time) && Math.abs(Date.now() - time) < 120000, "Expired packet.");
    assert(game.users.get(from)?.active, "Sender disconnected.");
    const keyId = `${from}:${id}`;
    assert(!this.seen.has(keyId), "Replay rejected.");
    const plaintext = await crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: un64(packet.iv),
      additionalData: enc.encode(JSON.stringify({
        from,
        to,
        id,
        time
      }))
    }, await this.key(from), un64(packet.data));
    assert(!this.seen.has(keyId), "Replay rejected.");
    this.seen.set(keyId, time);
    for (const [k, t] of this.seen) if (Date.now() - t > 120000) this.seen.delete(k);
    const body = JSON.parse(dec.decode(plaintext));
    if (body.kind === "request") {
      assert(authority()?.id === game.user.id, "This GM is not authoritative.");
      try {
        const result = await this.onRequest(game.users.get(from), body.request);
        await this.send(from, {
          kind: "reply",
          requestId: body.requestId,
          ok: true,
          result
        });
      } catch (error) {
        await this.send(from, {
          kind: "reply",
          requestId: body.requestId,
          ok: false,
          error: error.message
        });
      }
    } else {
      assert(from === authority()?.id, "Only the active authority can send state or replies.");
      if (body.kind === "state") await this.onState(body.state, body.open);
      if (body.kind === "chat") await this.onChat?.(body.card);
      if (body.kind === "reply") {
        const pending = this.pending.get(body.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(body.requestId);
          body.ok ? pending.resolve(body.result) : pending.reject(new Error(body.error));
        }
      }
    }
  }
  async request(request) {
    const gm = authority();
    assert(gm, "No active GM. Your session is preserved; reconnect when a GM returns.");
    if (gm.id === game.user.id) return this.onRequest(game.user, request);
    const requestId = uid();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("GM request timed out. Reopen the view to synchronize before retrying."));
      }, 120000);
      this.pending.set(requestId, {
        resolve,
        reject,
        timer
      });
      this.send(gm.id, {
        kind: "request",
        requestId,
        request
      }).catch(error => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(error);
      });
    });
  }
  async state(user, state, open = false) {
    if (user.id === game.user.id) return this.onState(state, open);
    await this.send(user.id, {
      kind: "state",
      state,
      open
    });
  }
}
