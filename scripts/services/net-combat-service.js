import { ID, uid, clone, assert, optionalDocument } from "../constants.js";
import { neighbors } from "../graph/graph-layout.js";

export function normalizeIceConfig(config = {}) {
  const out = { name: typeof config.name === "string" ? config.name.slice(0, 160) : "", stats: {}, programUuids: [] };
  for (const key of ["per", "spd", "atk", "def", "rezMax"]) if (config.stats?.[key] != null && config.stats[key] !== "") {
    const value = Number(config.stats[key]);
    assert(Number.isInteger(value) && value >= 0 && value <= 999, "ICE stats must be whole numbers from 0 to 999.");
    out.stats[key] = value;
  }
  assert(!config.programUuids || Array.isArray(config.programUuids) && config.programUuids.length <= 30, "Maximum 30 ICE Programs.");
  out.programUuids = [...new Set(config.programUuids ?? [])].map(uuid => {
    assert(typeof uuid === "string" && uuid.length < 300, "Invalid Program UUID."); return uuid;
  });
  return out;
}

export class NetCombatService {
  constructor(sessions) { this.sessions = sessions; }
  get s() { return this.sessions.session; }
  async programs(uuids) {
    const programs = [];
    for (const uuid of uuids) {
      const p = await optionalDocument(uuid);
      assert(p?.type === "program", "A configured ICE Program is missing or is not a Program Item.");
      const data = p.toObject();
      programs.push({ id: uid(), sourceUuid: uuid, name: p.name, system: clone(data.system) });
    }
    return programs;
  }
  async create(node, attachment, visible = true) {
    const doc = await optionalDocument(attachment.uuid);
    assert(this.sessions.adapter.isIce(doc), "Select a Black ICE Actor, Demon, or Black ICE Program.");
    const c = normalizeIceConfig(attachment.iceConfig);
    const native = doc.documentName === "Actor" ? doc.system.stats : doc.system;
    const rez = native.rez ?? {};
    const stats = {};
    for (const key of ["per", "spd", "atk", "def"]) stats[key] = c.stats[key] ?? Number(native[key] ?? native.combatNumber ?? 0);
    const max = c.stats.rezMax ?? Number(rez.max ?? rez.value ?? rez ?? 0);
    const uuids = c.programUuids.length ? c.programUuids : doc.type === "program" ? [doc.uuid] : [];
    if (!uuids.length && doc.items) uuids.push(...doc.items.filter(p => p.type === "program").map(p => p.uuid));
    // Preserve the original workflow: a Program attached beside an Actor supplies its damage.
    if (!uuids.length) for (const a of node.attachments) {
      const p = await optionalDocument(a.uuid);
      if (p?.type === "program") uuids.push(p.uuid);
    }
    return { nodeId: node.id, originNodeId: node.id, attachmentId: attachment.id, documentUuid: attachment.uuid,
      name: c.name || doc.name, stats, rez: { value: max, max }, programs: await this.programs(uuids),
      rezzed: true, defeated: false, visible, target: null };
  }
  async candidates(node) {
    const pairs = await Promise.all(node.attachments.map(async attachment => ({ attachment, doc: await optionalDocument(attachment.uuid) })));
    const hasActor = pairs.some(({ doc }) => doc?.documentName === "Actor" && this.sessions.adapter.isIce(doc));
    return pairs.filter(({ doc }) => this.sessions.adapter.isIce(doc) && (!hasActor || doc.documentName === "Actor"));
  }
  async hydrateLegacy() {
    for (const [id, ice] of Object.entries(this.s?.iceStates ?? {})) {
      if (ice.stats && ice.rez && ice.programs) continue;
      const node = this.s.architecture.nodes.find(n => n.attachments.some(a => a.id === id));
      if (!node) continue;
      try {
        const fresh = await this.create(node, node.attachments.find(a => a.id === id), ice.visible);
        this.s.iceStates[id] = { ...fresh, ...ice };
      } catch (error) {
        // A deleted legacy source must not prevent the entire run from reopening.
        this.s.iceStates[id] = { ...ice, stats: { per: 0, spd: 0, atk: 0, def: 0 }, rez: { value: 0, max: 0 }, programs: [], rezzed: false, unavailable: error.message };
      }
    }
  }
  targetIce(id, player = false) {
    const ice = this.s.iceStates[id];
    assert(ice?.rezzed && !ice.defeated, "Target ICE is not active.");
    assert(!player || ice.visible && this.s.discoveredNodeIds.includes(ice.nodeId), "Target ICE is not visible.");
    assert(ice.nodeId === this.s.currentNodeId, "Move into the same node as the target before fighting.");
    return { kind: "ice", id, name: ice.name };
  }
  record(kind, source, target, result, hidden = false) {
    if (!result || !Number.isFinite(result.total)) return;
    this.s.netCombat ??= [];
    this.s.netCombat.push({ id: uid(), kind, source, target, total: result.total, hidden, status: "rolled" });
    if (this.s.netCombat.length > 100) this.s.netCombat.shift();
  }
  async handle(user, req, actor, completedResult) {
    const s = this.s, gm = user.isGM;
    if (req.action === "targetIce") {
      if (req.iceId) this.targetIce(req.iceId, !gm);
      s.runnerTargetId = req.iceId || null;
    } else if (req.action === "runnerCombatRoll") {
      assert(["zap", "zapDamage", "defense", "speed"].includes(req.operation), "Invalid NET combat roll.");
      const offensive = ["zap", "zapDamage"].includes(req.operation);
      const target = completedResult ? req.combatTarget : offensive ? this.targetIce(s.runnerTargetId, !gm) : null;
      if (!gm && !completedResult) return this.sessions.grantRoll(user, { ...req, combatTarget: target }, {
        ability: req.operation === "zapDamage" ? "zap" : req.operation,
        executionType: req.operation === "zapDamage" ? "damage" : undefined, targetName: target?.name
      });
      const result = completedResult ?? await this.sessions.adapter.rollInterface(actor, {
        ability: req.operation === "zapDamage" ? "zap" : req.operation, executionType: req.operation === "zapDamage" ? "damage" : undefined,
        deckId: s.runner.profile.deckId, targetName: target?.name, recipients: [s.runner.userId, ...s.observers]
      });
      if (!result) return true;
      this.record(req.operation === "zapDamage" ? "damage" : req.operation === "zap" ? "atk" : req.operation,
        { kind: "runner", runnerId: s.runner.userId, name: actor.name }, target, result);
      s.actions.used++;
    } else if (["deployIce", "editIce", "moveIce", "iceTarget", "encounterRoll", "iceStatus", "confirmHit", "applyNetDamage"].includes(req.action)) {
      assert(gm, "GM only.");
      if (req.action === "deployIce") {
        const node = s.architecture.nodes.find(n => n.id === req.nodeId);
        const a = node?.attachments.find(a => a.id === req.attachmentId);
        assert(a, "ICE attachment missing.");
        assert(!s.iceStates[a.id], "Encounter already deployed. Use REZ to reactivate it.");
        s.iceStates[a.id] = await this.create(node, a);
      } else if (req.action === "confirmHit") {
        const entry = s.netCombat?.find(e => e.id === req.rollId);
        assert(entry?.kind === "atk" && ["hit", "miss"].includes(req.result), "Select an attack and a hit/miss decision.");
        entry.status = req.result;
      } else if (req.action === "applyNetDamage") {
        await this.applyDamage(req, actor);
      } else {
        const ice = s.iceStates[req.iceId];
        assert(ice, "Encounter ICE missing.");
        if (req.action === "editIce") {
          const c = normalizeIceConfig(req.config);
          // Validate every Program before mutating anything.
          const programs = req.replacePrograms ? await this.programs(c.programUuids) : ice.programs;
          const maximum = c.stats.rezMax ?? ice.rez.max;
          assert(req.rez == null || Number.isInteger(req.rez) && req.rez >= 0 && req.rez <= maximum, "Current REZ must be within 0 and maximum REZ.");
          if (c.name) ice.name = c.name;
          ice.stats = { ...ice.stats, ...Object.fromEntries(Object.entries(c.stats).filter(([k]) => k !== "rezMax")) };
          if (c.stats.rezMax != null) ice.rez = { max: c.stats.rezMax, value: Math.min(ice.rez.value, c.stats.rezMax) };
          if (req.rez != null) {
            ice.rez.value = req.rez;
          }
          ice.programs = programs;
          delete ice.unavailable;
          if (!ice.rez.value) { ice.rezzed = false; ice.defeated = true; }
        } else if (req.action === "moveIce") {
          assert(ice.rezzed && !ice.defeated, "REZ the ICE before moving it.");
          assert(neighbors(s.architecture, ice.nodeId).includes(req.destinationId), "ICE can only move along one connected edge.");
          ice.previousNodeId = ice.nodeId;
          ice.nodeId = req.destinationId;
          ice.target = null;
          if (s.runnerTargetId === req.iceId) s.runnerTargetId = null;
          for (const r of Object.values(s.runners ?? {})) if (r.runnerTargetId === req.iceId) r.runnerTargetId = null;
        } else if (req.action === "iceStatus") {
          assert(["rez", "derez", "reveal", "hide", "defeat"].includes(req.operation), "Invalid ICE operation.");
          if (req.operation === "rez") { assert(ice.rez.value > 0, "Restore REZ in Edit Encounter first."); ice.rezzed = true; ice.defeated = false; }
          if (req.operation === "derez") ice.rezzed = false;
          if (req.operation === "defeat") { ice.rezzed = false; ice.defeated = true; }
          if (req.operation === "reveal") ice.visible = true;
          if (req.operation === "hide") ice.visible = false;
          if (!ice.rezzed || !ice.visible || ice.defeated) {
            ice.target = null;
            if (s.runnerTargetId === req.iceId) s.runnerTargetId = null;
          for (const r of Object.values(s.runners ?? {})) if (r.runnerTargetId === req.iceId) r.runnerTargetId = null;
          }
        } else if (req.action === "iceTarget") {
          assert(ice.nodeId === s.currentNodeId, "Move the ICE to the runner's node before targeting.");
          const p = req.programId ? this.sessions.adapter.deck(actor, s.runner.profile.deckId)?.getInstalledItems("program").find(p => p.id === req.programId) : null;
          assert(!req.programId || p?.system.isRezzed, "Choose a rezzed runner Program.");
          ice.target = p ? { kind: "program", runnerId: s.runner.userId, id: p.id, name: p.name } : { kind: "runner", runnerId: s.runner.userId, name: actor.name };
        } else if (req.action === "encounterRoll") {
          const offensive = ["atk", "damage"].includes(req.operation);
          assert(ice.rezzed && !ice.defeated, "ICE is not active.");
          const victim = s.runners?.[ice.target?.runnerId] ?? s;
          assert(!offensive || ice.target && victim.status === "active" && ice.nodeId === victim.currentNodeId, "Choose an active target in the same node first.");
          const targetActor = offensive ? await optionalDocument(victim.runner.actorUuid) : actor;
          assert(targetActor, "Target Netrunner Actor was deleted.");
          const hidden = !ice.visible || !victim.discoveredNodeIds.includes(ice.nodeId);
          const result = await this.sessions.adapter.encounterRoll(ice, req.operation, req.programId, targetActor, { recipients: [victim.runner.userId, ...s.observers], hidden });
          this.record(req.operation, { kind: "ice", id: req.iceId, name: ice.name }, offensive ? clone(ice.target) : null, result, hidden);
        }
      }
    } else return false;
    await this.sessions.commit();
    return true;
  }
  async applyDamage(req, actor) {
    const entry = this.s.netCombat?.find(e => e.id === req.rollId);
    assert(entry?.kind === "damage" && entry.target && entry.status !== "applied", "Select an unapplied damage roll with a target.");
    assert(Number.isInteger(req.amount) && req.amount >= 0 && req.amount <= 9999, "Enter final damage from 0 to 9999 after reductions and special effects.");
    const target = entry.target, receipt = `${this.s.id}:${entry.id}`;
    if (target.kind === "ice") {
      const ice = this.s.iceStates[target.id];
      assert(ice?.rez, "Target ICE no longer exists.");
      ice.rez.value = Math.max(0, ice.rez.value - req.amount);
      if (!ice.rez.value) { ice.rezzed = false; ice.defeated = true; }
    } else {
      if (target.runnerId) {
        const record = this.s.runners?.[target.runnerId];
        if (this.s.runners) assert(record, "Target Netrunner is no longer in this Architecture.");
        if (record) actor = await optionalDocument(record.runner.actorUuid);
      }
      assert(actor, "Target Netrunner Actor was deleted.");
      const doc = target.kind === "runner" ? actor : actor.items.get(target.id);
      assert(doc, "Target Document was deleted.");
      const receipts = doc.getFlag(ID, "netDamageReceipts") ?? [];
      if (!receipts.includes(receipt)) {
        const current = target.kind === "runner" ? actor.system.derivedStats?.hp?.value : doc.system.rez?.value;
        assert(Number.isFinite(current), "Target has no native HP/REZ value.");
        const value = target.kind === "runner" ? current - req.amount : Math.max(0, current - req.amount);
        await doc.update({ [target.kind === "runner" ? "system.derivedStats.hp.value" : "system.rez.value"]: value,
          ...(target.kind === "program" && value === 0 ? { "system.isRezzed": false } : {}),
          [`flags.${ID}.netDamageReceipts`]: [...receipts.slice(-499), receipt] });
      }
    }
    entry.status = "applied";
    entry.appliedDamage = req.amount;
  }
}
