import test from "node:test";
import assert from "node:assert/strict";
import { ChatService } from "../scripts/services/chat-service.js";
test("public ChatMessage holds no native card contents; private store enforces recipients", async () => {
  let saved, created, delivered;
  const store = {
    saveCard: async card => saved = card,
    loadCard: async () => saved
  };
  const socket = {
    send: async (user, body) => delivered = {
      user,
      body
    }
  };
  globalThis.game = {
    user: {
      id: "gm",
      isGM: true
    }
  };
  globalThis.ChatMessage = {
    create: async message => created = message
  };
  const chat = new ChatService(store, socket, {});
  await chat.post('<div class="rollcard">TOP SECRET HELLHOUND UUID Actor.hidden</div>', ["gm", "runner"]);
  assert.ok(saved.html.includes("HELLHOUND"));
  assert.ok(!JSON.stringify(created).includes("HELLHOUND"));
  assert.ok(!JSON.stringify(created).includes("Actor.hidden"));
  await assert.rejects(chat.deliver({
    id: "outsider"
  }, saved.id), /not shared/);
  await chat.deliver({
    id: "runner"
  }, saved.id);
  assert.equal(delivered.user, "runner");
  assert.equal(delivered.body.card.html, saved.html);
});
