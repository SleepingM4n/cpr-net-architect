import { ID, uid, clone, assert, setting, requireGM, log, optionalDocument } from "../constants.js";
import { authority } from "./socket-service.js";
import { canRun, canView, getVisibleSessionStateForUser } from "./permission-service.js";
import { neighbors } from "../graph/graph-layout.js";
import { NetCombatService } from "./net-combat-service.js";
import { NetParticipantService } from "./net-participant-service.js";
const add = (array, id) => {
  if (!array.includes(id)) array.push(id);
};
export class SessionService {
  constructor(store, adapter, socket, controls) {
    Object.assign(this, {
      store,
      adapter,
      socket,
      controls
    });
    this.session = null;
    this.netCombat = new NetCombatService(this);
    this.participants = new NetParticipantService(this);
    this.queue = Promise.resolve();
  }
  isAuthority() {
    return authority()?.id === game.user.id;
  }
  async restore() {
    await this.store.refresh();
    this.session = this.store.loadSession();
    if (this.session) {
      await this.netCombat.hydrateLegacy();
      await this.refreshProfile();
      await this.publish(false);
    }
  }
  request(user, request) {
    const task = this.queue.then(() => this.handle(user, request));
    this.queue = task.catch(error => log.debug("Request rejected", error.message));
    return task;
  }
  async start(architectureId, actorUuid, {
    userId,
    deckId,
    override = false,
    observers = [],
    actions = 0
  } = {}) {
    requireGM();
    assert(this.isAuthority(), "Start from the authoritative GM's client (lowest connected GM user ID).");
    assert(!this.session, "End the current NETRUN before starting another.");
    const actor = await this.adapter.resolve(actorUuid);
    assert(this.adapter.qualifies(actor) || override, "Actor has no configured NET Role with a positive rank.");
    const user = game.users.get(userId) ?? game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
    assert(user && (override || actor.testUserPermission(user, "OWNER")), "Choose an owning player or use the GM override.");
    const architecture = this.store.get(architectureId),
      id = uid();
    this.session = {
      id,
      revision: 0,
      status: "login",
      architectureId,
      architecture: clone(architecture),
      runner: {
        actorUuid,
        userId: user.id,
        physicalTokenUuid: canvas.tokens?.controlled.find(t => t.actor?.uuid === actorUuid)?.document.uuid ?? null,
        profile: this.adapter.profile(actor, deckId)
      },
      override,
      observers: setting("allowObservers") ? observers.filter(id => game.users.has(id) && id !== user.id) : [],
      currentNodeId: architecture.entryNodeId,
      previousNodeId: null,
      discoveredNodeIds: [],
      clearedNodeIds: [],
      failedNodeIds: [],
      compromisedNodeIds: [],
      bypassNodeIds: architecture.nodes.filter(n => n.bypassAllowed).map(n => n.id),
      iceStates: {},
      participants: await this.participants.build(architecture),
      actions: {
        max: Number(actions) || 0,
        used: 0
      },
      combat: null,
      startedAt: new Date().toISOString(),
      event: null,
      log: []
    };
    await this.commit(true);
  }
  async refreshProfile() {
    if (!this.session) return;
    const actor = await optionalDocument(this.session.runner.actorUuid);
    if (actor) this.session.runner.profile = this.adapter.profile(actor, this.session.runner.profile.deckId);
    this.session.combat = game.combat ? {
      round: game.combat.round,
      turn: game.combat.turn,
      isRunnerTurn: game.combat.combatant?.actor?.uuid === actor?.uuid
    } : null;
  }
  async projection(user) {
    const state = getVisibleSessionStateForUser(this.session, user);
    if (!state || user.isGM) return state;
    for (const node of state.architecture.nodes) {
      if (node.unknown || node.remote) continue;
      const original = this.session.architecture.nodes.find(n => n.id === node.id);
      for (const a of original.attachments) {
        if (!a.visible) continue;
        const doc = await optionalDocument(a.uuid);
        if (doc && doc.testUserPermission(user, "LIMITED")) node.attachments.push({
          id: a.id,
          uuid: doc.uuid,
          name: doc.name,
          documentType: doc.documentName,
          taken: !!this.session.claimedAttachments?.[`${node.id}:${a.id}`]
        });
      }
    }
    return state;
  }
  async publish(open = false) {
    const users = game.users.filter(u => u.active && canView(this.session, u));
    const results = await Promise.allSettled(users.map(async u => this.socket.state(u, await this.projection(u), open)));
    results.forEach(r => {
      if (r.status === "rejected") log.debug("Viewer unavailable", r.reason.message);
    });
  }
  async commit(open = false) {
    this.session.revision++;
    await this.refreshProfile();
    await this.store.saveSession(this.session);
    await this.publish(open);
  }
  async end() {
    this.pendingRoll = null;
    const old = this.session;
    assert(old, "No active NETRUN.");
    this.session = null;
    await this.store.saveSession(null);
    if (setting("storeLogs")) await this.store.saveLog({
      ...old,
      status: "ended",
      endedAt: new Date().toISOString()
    });
    await Promise.allSettled(game.users.filter(u => u.active && canView(old, u)).map(u => this.socket.state(u, null, false)));
    Hooks.callAll("cprNetArchitectJackOut", old);
  }
  async reveal(node) {
    add(this.session.discoveredNodeIds, node.id);
    Hooks.callAll("cprNetArchitectNodeRevealed", this.session, node);
  }
  async rezNode(node, visible = true) {
    for (const { attachment: a, doc } of await this.netCombat.candidates(node)) {
      if (this.adapter.isIce(doc)) {
        const existing = this.session.iceStates[a.id];
        if (existing) {
          existing.visible ||= visible;
          continue;
        }
        this.session.iceStates[a.id] = await this.netCombat.create(node, a, visible);
      }
    }
  }
  async move(node) {
    if (!this.session.bypassNodeIds?.includes(node.id) && (!node.challenge.enabled || node.challenge.autoResolve)) add(this.session.clearedNodeIds, node.id);
    this.session.previousNodeId = this.session.currentNodeId;
    this.session.currentNodeId = node.id;
    this.session.runnerTargetId = null;
    for (const ice of Object.values(this.session.iceStates)) if (ice.nodeId !== node.id) ice.target = null;
    await this.reveal(node);
    await this.rezNode(node);
  }
  async event(text, success) {
    const s = this.session;
    s.event = {
      id: uid(),
      text,
      success
    };
    s.log.push({
      at: new Date().toISOString(),
      text,
      success
    });
    if (s.log.length > 500) s.log.shift();
    if (["all", "events"].includes(setting("chatLevel"))) await ChatMessage.create({
      content: `<p>NET Architect // ${text}</p>`,
      whisper: game.users.filter(u => canView(s, u)).map(u => u.id)
    });
  }
  async handle(user, req) {
    assert(this.isAuthority(), "No authoritative GM.");
    assert(req && typeof req.action === "string", "Invalid request.");
    if (req.action === "chat") {
      await this.chat.deliver(user, req.cardId);
      return;
    }
    if (req.action === "sync") {
      await this.socket.state(user, await this.projection(user), req.open === true);
      return;
    }
    const s = this.session;
    assert(s && req.sessionId === s.id, "NETRUN has ended or changed. Reopen the viewer.");
    const completing = req.action === "completeRoll" || req.action === "cancelRoll";
    assert(completing || Number.isInteger(req.revision) && req.revision === s.revision, "State changed; please try again with the updated view.");
    const gm = user.isGM;
    assert(canRun(s, user), "Observers cannot change a NETRUN.");
    const actor = await optionalDocument(s.runner.actorUuid);
    if (req.action === "end") {
      await this.end();
      return;
    }
    assert(actor, "Netrunner Actor was deleted. The GM can end this NETRUN.");
    assert(gm || actor.testUserPermission(user, "OWNER") || s.override, "You no longer own the runner Actor.");
    assert(this.adapter.qualifies(actor) || s.override, "The Actor no longer has a configured NET Role.");
    let completedResult = null;
    if (completing) {
      const grant = this.pendingRoll;
      assert(grant && grant.token === req.token && grant.userId === user.id && grant.sessionId === s.id, "No matching pending roll.");
      if (req.action === "cancelRoll") { this.pendingRoll = null; return; }
      assert(Date.now() < grant.expires && s.status === "active" && s.currentNodeId === grant.currentNodeId && s.runner.profile.deckId === grant.deckId, "Roll expired or NET position/deck changed. Cancel and try again.");
      const message = game.messages.get(req.messageId);
      const result = message?.getFlag(ID, "playerRoll");
      assert(message?.author?.id === user.id && result?.token === grant.token && result.actorUuid === actor.uuid && Number.isFinite(result.total), "Matching player chat roll not found.");
      completedResult = { total: result.total };
      req = { ...grant.request };
      this.pendingRoll = null;
    }
    if (req.action === "jackIn") {
      assert(s.status === "login", "Already jacked in.");
      assert(gm || user.id === s.runner.userId, "Only the runner can Jack In.");
      s.status = "active";
      await this.reveal(s.architecture.nodes.find(n => n.id === s.currentNodeId));
      add(s.clearedNodeIds, s.currentNodeId);
      await this.event("LINK ESTABLISHED", true);
      Hooks.callAll("cprNetArchitectJackIn", s);
      await this.commit();
      return;
    }
    if (req.action === "broadcast") {
      assert(gm, "GM only.");
      const previous = [...s.observers];
      s.observers = setting("allowObservers") && Array.isArray(req.users) ? req.users.filter(id => game.users.has(id) && id !== s.runner.userId) : [];
      for (const id of previous) if (!s.observers.includes(id) && game.users.get(id)?.active) await this.socket.state(game.users.get(id), null, false);
      await this.commit(true);
      return;
    }
    if (req.action === "reset") {
      assert(gm, "GM only.");
      this.pendingRoll = null;
      s.status = "login";
      s.currentNodeId = s.architecture.entryNodeId;
      s.previousNodeId = null;
      s.discoveredNodeIds = [];
      s.clearedNodeIds = [];
      s.failedNodeIds = [];
      s.compromisedNodeIds = [];
      s.bypassNodeIds = s.architecture.nodes.filter(n => n.bypassAllowed).map(n => n.id);
      s.iceStates = {};
      s.participants = await this.participants.build(s.architecture);
      s.netCombat = [];
      s.runnerTargetId = null;
      s.actions.used = 0;
      s.event = null;
      await this.commit(true);
      return;
    }
    if (req.action === "budget") {
      assert(gm, "GM only.");
      assert(Number.isInteger(req.max) && req.max >= 0 && req.max <= 20, "NET action budget must be 0–20.");
      s.actions = {
        max: req.max,
        used: 0
      };
      await this.commit();
      return;
    }
    if (await this.participants.handle(user, req)) return;
    assert(s.status === "active", "Press JACK IN first.");
    const combatReply = await this.netCombat.handle(user, req, actor, completedResult);
    if (combatReply) return combatReply === true ? undefined : combatReply;
    if (req.action === "deck") {
      assert(this.adapter.decks(actor).some(d => d.id === req.deckId), "Cyberdeck no longer exists.");
      s.runner.profile.deckId = req.deckId;
      await this.commit();
      return;
    }
    if (req.action === "program") {
      const offensive = ["atk", "damage"].includes(req.programAction);
      const combatTarget = completedResult ? req.combatTarget : offensive && s.runnerTargetId ? this.netCombat.targetIce(s.runnerTargetId, !gm) : null;
      if (!completedResult) req = { ...req, combatTarget };
      if (!gm && ["atk", "def", "damage"].includes(req.programAction) && !completedResult) {
        const program = this.adapter.deck(actor, s.runner.profile.deckId)?.getInstalledItems("program").find(p => p.id === req.programId);
        assert(program?.system.isRezzed, "REZ an installed Program before rolling.");
        return this.grantRoll(user, req, { programId: req.programId, programAction: req.programAction, targetName: combatTarget?.name, targetKind: combatTarget?.kind });
      }
      const result = completedResult ?? await this.adapter.program(actor, s.runner.profile.deckId, req.programId, req.programAction, {
        recipients: [s.runner.userId, ...s.observers],
        runnerUuid: s.runner.actorUuid,
        targetName: combatTarget?.name, targetKind: combatTarget?.kind
      });
      if (!result && !["rez", "derez"].includes(req.programAction)) return;
      this.netCombat.record(req.programAction, { kind: "runner", name: actor.name }, combatTarget, result);
      s.actions.used++;
      await this.commit();
      return;
    }
    const node = s.architecture.nodes.find(n => n.id === req.nodeId);
    assert(node, "Node does not exist.");
    if (req.action === "takeItem") {
      assert(s.currentNodeId === node.id && s.discoveredNodeIds.includes(node.id) && s.clearedNodeIds.includes(node.id), "Move to the cleared node before taking its items.");
      const attachment = node.attachments.find(a => a.id === req.attachmentId);
      assert(attachment && (gm || attachment.visible), "Item is not shared with the runner.");
      const item = await optionalDocument(attachment.uuid);
      assert(item?.documentName === "Item" && (gm || item.testUserPermission(user, "LIMITED")), "Linked Item is unavailable or not shared.");
      const key = `${node.id}:${attachment.id}`;
      s.claimedAttachments ??= {};
      assert(!s.claimedAttachments[key], "This item has already been taken.");
      const claim = `${s.id}:${key}`;
      const existing = actor.items.find(i => i.getFlag(ID, "lootClaim") === claim);
      if (!existing) {
        const data = item.toObject();
        delete data._id;
        delete data.folder;
        delete data.ownership;
        data.flags = { ...data.flags, [ID]: { lootClaim: claim } };
        delete data.flags.cprInstallTree;
        for (const field of ["isInstalled", "isInstalledInActor", "isRezzed"]) if (field in data.system) data.system[field] = false;
        if ("installedIn" in data.system) data.system.installedIn = [];
        if (data.system.installedItems) data.system.installedItems.list = [];
        assert(!data.system.core, "Core character Items cannot be picked up.");
        const created = await actor.createEmbeddedDocuments("Item", [data], { createInstalled: false, CPRsplitStack: true });
        assert(created.length, "CPR could not add this Item to the runner.");
      }
      s.claimedAttachments[key] = true;
      await this.commit();
      return;
    }
    const gmActions = ["bypass", "reveal", "hide", "revealAll", "revealBranch", "moveGM", "clear", "compromise", "ice", "iceRoll"];
    if (gmActions.includes(req.action)) {
      assert(gm, "GM only.");
      switch (req.action) {
        case "bypass":
          s.bypassNodeIds ??= [];
          if (s.bypassNodeIds.includes(node.id)) s.bypassNodeIds = s.bypassNodeIds.filter(id => id !== node.id);
          else s.bypassNodeIds.push(node.id);
          break;
        case "reveal":
          await this.reveal(node);
          break;
        case "hide":
          assert(node.id !== s.currentNodeId, "Move the runner before hiding their current node.");
          s.discoveredNodeIds = s.discoveredNodeIds.filter(id => id !== node.id);
          break;
        case "revealAll":
          for (const n of s.architecture.nodes) await this.reveal(n);
          break;
        case "revealBranch":
          {
            const visited = new Set(),
              queue = [node.id];
            while (queue.length) {
              const id = queue.shift();
              if (visited.has(id)) continue;
              visited.add(id);
              await this.reveal(s.architecture.nodes.find(n => n.id === id));
              queue.push(...s.architecture.edges.filter(e => e.from === id).map(e => e.to));
            }
            break;
          }
        case "moveGM":
          await this.move(node);
          break;
        case "clear":
          add(s.clearedNodeIds, node.id);
          await this.reveal(node);
          break;
        case "compromise":
          add(s.compromisedNodeIds, node.id);
          break;
        case "ice":
          {
            const attachment = node.attachments.find(a => a.id === req.attachmentId);
            assert(attachment, "ICE attachment missing.");
            s.iceStates[attachment.id] ??= { ...await this.netCombat.create(node, attachment, false), rezzed: false };
            await this.netCombat.handle(user, { action: "iceStatus", iceId: attachment.id, operation: req.operation }, actor);
            return;
          }
        case "iceRoll":
          {
            const a = node.attachments.find(a => a.id === req.attachmentId);
            assert(a, "ICE attachment missing.");
            const doc = await this.adapter.resolve(a.uuid);
            if (doc.type === "demon") {
              await this.adapter.iceRoll(doc, req.stat, null, { recipients: [s.runner.userId, ...s.observers], hidden: !s.discoveredNodeIds.includes(node.id) || !s.iceStates[a.id]?.visible, runnerUuid: s.runner.actorUuid });
            } else {
              s.iceStates[a.id] ??= await this.netCombat.create(node, a, false);
              const ice = s.iceStates[a.id];
              const hidden = !s.discoveredNodeIds.includes(ice.nodeId) || !ice.visible;
              const result = await this.adapter.encounterRoll(ice, req.stat, null, actor, { recipients: [s.runner.userId, ...s.observers], hidden });
              this.netCombat.record(req.stat, { kind: "ice", id: a.id, name: ice.name }, ["atk", "damage"].includes(req.stat) ? clone(ice.target) : null, result, hidden);
            }
            break;
          }
      }
    } else {
      const adjacent = neighbors(s.architecture, s.currentNodeId).includes(node.id);
      assert(adjacent || node.id === s.currentNodeId, "Node is not adjacent to the current NET position.");
      if (req.action === "attempt") {
        assert(!s.clearedNodeIds.includes(node.id), "Node is already cleared. Use MOVE HERE.");
        const c = node.challenge;
        assert(c.allowRetry || !s.failedNodeIds.includes(node.id), "Retry disabled. Ask the GM to clear this node.");
        if (c.requireApproval && !gm && !completedResult) {
          assert(await Dialog.confirm({
            title: "Approve NET attempt",
            content: "<p>Allow the Netrunner to attempt the selected node?</p>"
          }), "GM declined this attempt.");
        }
        if (!gm && c.enabled && !c.autoResolve && !completedResult) return this.grantRoll(user, req, { ability: c.action });
        const wasHidden = !s.discoveredNodeIds.includes(node.id);
        const result = completedResult ? { ...completedResult, success: completedResult.total > c.dv } : c.enabled && !c.autoResolve ? await this.adapter.rollInterface(actor, {
          ability: c.action,
          dv: c.dv,
          deckId: s.runner.profile.deckId,
          override: s.override,
          recipients: [s.runner.userId, ...s.observers],
          hidden: wasHidden
        }) : {
          success: true
        };
        if (!result) return;
        s.actions.used++;
        if (result.success) {
          add(s.clearedNodeIds, node.id);
          if (c.revealOnSuccess || !c.enabled) {
            await this.reveal(node);
            if (wasHidden) await this.adapter.shareRevealedRoll(result, actor, [s.runner.userId, ...s.observers]);
          }
          await this.event("ACCESS GRANTED", true);
        } else {
          add(s.failedNodeIds, node.id);
          if (!c.blocksOnFailure) add(s.clearedNodeIds, node.id);
          if (c.activateIceOnFailure) await this.rezNode(node, false);
          await this.event("ACCESS DENIED", false);
        }
      } else if (req.action === "move") {
        assert(s.bypassNodeIds?.includes(node.id) || s.clearedNodeIds.includes(node.id) || (!node.challenge.requireApproval && (!node.challenge.enabled || node.challenge.autoResolve)), "Resolve the challenge or ask the GM to allow bypass before moving through it.");
        await this.move(node);
      } else if (req.action === "control") {
        await this.controls.execute(s, node, req.controlId);
        s.actions.used++;
        await this.event("CONTROL ACTIVATED", true);
      } else throw new Error("Unknown NET action.");
    }
    await this.commit();
  }
  grantRoll(user, request, details) {
    const s = this.session;
    assert(!this.pendingRoll || this.pendingRoll.expires < Date.now(), "Finish or cancel the pending roll first.");
    const grant = { token: uid(), userId: user.id, sessionId: s.id, currentNodeId: s.currentNodeId, deckId: s.runner.profile.deckId, expires: Date.now() + 600000, request: { ...request } };
    this.pendingRoll = grant;
    // Only the attempted ability is disclosed, never the hidden DV or node contents.
    return { rollGrant: { token: grant.token, actorUuid: s.runner.actorUuid, deckId: grant.deckId, ...details } };
  }
}
