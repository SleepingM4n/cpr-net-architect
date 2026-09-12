import { ABILITIES, ID, uid, assert, setting, safeImage, optionalDocument } from "../constants.js";
import { makeArchitecture, makeNode, validateArchitecture } from "./import-export-service.js";
import { autoLayout } from "../graph/graph-layout.js";

/** All version-specific CPR paths and internal imports live here. See audit. */
export class CPRSystemAdapter {
  verify() {
    assert(game.system.id === "cyberpunk-red-core" && game.system.version.replace(/^v/, "") === "0.92.4", "NET Architect requires Cyberpunk RED - CORE v0.92.4.");
    assert(game.release.generation === 12, "NET Architect requires Foundry v12.");
  }
  role(actor) {
    return actor?.itemTypes?.role?.find(r => r.id === actor.system.roleInfo?.activeNetRole) ?? null;
  }
  qualifies(actor) {
    return actor?.type === "character" && Number(this.role(actor)?.system.rank) > 0;
  }
  decks(actor) {
    return actor?.itemTypes?.cyberdeck ?? [];
  }
  deck(actor, id) {
    return this.decks(actor).find(d => d.id === id) ?? this.decks(actor)[0];
  }
  profile(actor, deckId) {
    const role = this.role(actor),
      deck = this.deck(actor, deckId);
    return {
      uuid: actor.uuid,
      name: actor.name,
      img: safeImage(actor.img),
      rank: Number(role?.system.rank ?? actor.system.stats?.interface ?? 0),
      hp: actor.system.derivedStats?.hp?.value,
      maxHp: actor.system.derivedStats?.hp?.max,
      deckId: deck?.id ?? "",
      deckName: deck?.name ?? "No cyberdeck detected",
      decks: this.decks(actor).map(d => ({
        id: d.id,
        name: d.name
      })),
      programs: deck ? deck.getInstalledItems("program").map(p => ({
        id: p.id,
        uuid: p.uuid,
        name: p.name,
        active: p.system.isRezzed,
        rez: p.system.rez?.value,
        class: p.system.class
      })) : []
    };
  }
  async resolve(uuid) {
    const doc = await optionalDocument(uuid);
    assert(doc, "Linked Document was deleted, has an invalid UUID, or is unavailable.");
    return doc;
  }
  async nativeRolls() {
    return this.rolls ??= await import("../../../../systems/cyberpunk-red-core/modules/rolls/cpr-rolls.js");
  }
  async bindNativeChat(html) {
    // Rebind CPR's normal glyph handlers after inserting a decrypted native card.
    // Its ordinary renderChatMessage hook runs before asynchronous card delivery.
    this.nativeChat ??= (await import("../../../../systems/cyberpunk-red-core/modules/chat/cpr-chat.js")).default;
    await this.nativeChat.chatListeners(html);
  }
  async shareRevealedRoll(result, actor, recipients) {
    if (!result?.roll || !["all", "rolls"].includes(setting("chatLevel")) || game.settings.get("core", "rollMode") !== "roll") return;
    const whisper = recipients.filter(id => !game.users.get(id)?.isGM);
    if (!whisper.length) return;
    assert(this.chat, "Private chat delivery is not initialized.");
    await this.chat.post(await renderTemplate(result.roll.rollCard, result.roll), whisper);
  }
  async execute(roll, actor, item, {
    dv = 0,
    recipients = [],
    hidden = false,
    dialog = true,
    playerGrant = null,
    targetName = "",
    allowLuck = true
  } = {}) {
    assert(roll && typeof roll.roll === "function", "CPR roll API unavailable.");
    if (targetName) roll.rollTitle = `${roll.rollTitle} → ${targetName}`;
    // Run CPR's native dialog and dice on the initiating client's actor.
    if (dialog && !(await roll.handleRollDialog({
      type: "click",
      ctrlKey: false,
      metaKey: false
    }, actor, item))) return null;
    if (item) roll = await item.confirmRoll(roll);
    if (!allowLuck) roll.luck = 0;
    await roll.roll();
    if (Number.isInteger(roll.luck) && roll.luck > 0 && actor.system.stats?.luck) {
      await actor.update({
        "system.stats.luck.value": Math.max(0, actor.system.stats.luck.value - roll.luck)
      });
    }
    roll.entityData = {
      actor: actor.id,
      token: actor.isToken ? actor.token.id : null,
      tokens: [],
      ...(item ? {
        item: item.id
      } : {})
    };
    roll.criticalCard = roll.wasCritical();
    let message;
    if (playerGrant) {
      this.nativeChat ??= (await import("../../../../systems/cyberpunk-red-core/modules/chat/cpr-chat.js")).default;
      const data = this.nativeChat.ChatDataSetup(await renderTemplate(roll.rollCard, roll));
      data.speaker = ChatMessage.getSpeaker({ actor });
      data.flags = { [ID]: { playerRoll: { token: playerGrant.token, actorUuid: actor.uuid, total: roll.resultTotal } } };
      message = await ChatMessage.create(data);
    } else if (["all", "rolls"].includes(setting("chatLevel"))) {
      // Native renderer hardcodes global roll mode and exposes no whisper override.
      // Render the exact native CPR template with explicit recipients instead.
      const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
      const mode = game.settings.get("core", "rollMode");
      const whisper = hidden || ["blindroll", "gmroll", "selfroll"].includes(mode) ? gmIds : [...new Set([...gmIds, ...recipients])];
      assert(this.chat, "Private chat delivery is not initialized.");
      await this.chat.post(await renderTemplate(roll.rollCard, roll), whisper);
    }
    return {
      messageId: message?.id,
      total: roll.resultTotal,
      die: roll.initialRoll,
      success: roll.resultTotal > dv,
      criticalSuccess: roll.wasCritSuccess(),
      criticalFailure: roll.wasCritFail(),
      dv,
      roll
    };
  }
  async rollInterface(actor, {
    ability,
    dv,
    deckId,
    override = false,
    executionType,
    ...options
  }) {
    assert(ABILITIES.includes(ability), "Unsupported native Interface ability.");
    const deck = this.deck(actor, deckId),
      netRoleItem = this.role(actor);
    if (actor.type === "demon") return this.execute(actor.createStatRoll("interface"), actor, null, {
      dv,
      ...options
    });
    assert(netRoleItem && Number(netRoleItem.system.rank) > 0, "The Actor no longer has a configured NET Role with a positive rank.");
    assert(deck, "Install a Cyberdeck on the Actor before making native Interface rolls.");
    assert(this.qualifies(actor) || override, "This Actor is not a configured Netrunner.");
    return this.execute(deck.createRoll("interfaceAbility", actor, {
      interfaceAbility: ability,
      executionType,
      cyberdeck: deck,
      netRoleItem
    }), actor, deck, {
      dv,
      ...options
    });
  }
  async program(actor, deckId, programId, action, options) {
    const deck = this.deck(actor, deckId),
      p = deck?.getInstalledItems("program").find(p => p.id === programId);
    assert(p, "Program is no longer installed in the selected Cyberdeck.");
    if (action === "rez") {
      await p.setRezzed();
      return null;
    }
    if (action === "derez") {
      await p.update({
        "system.isRezzed": false
      });
      return null;
    }
    assert(["atk", "def", "damage"].includes(action), "Invalid Program action.");
    assert(p.system.isRezzed, "REZ the Program before using it.");
    const netRoleItem = this.role(actor);
    assert(netRoleItem, "NET Role is not configured.");
    const roll = deck.createRoll("cyberdeckProgram", actor, {
      cyberdeckId: deck.id,
      programId: p.id,
      executionType: action,
      netRoleItem
    });
    if (action === "damage" && options?.targetKind === "ice") {
      const formula = p.system.damage.blackIce;
      assert(typeof formula === "string" && Roll.validate(formula), "Program Black ICE damage formula is invalid.");
      // Reparse the formula with CPR, retaining effects but replacing the old formula's modifiers.
      const formulaSource = game.i18n.localize("CPR.rolls.modifiers.sources.rollFormula");
      roll.mods = roll.mods.filter(mod => mod.source !== formulaSource);
      roll.formula = roll._processFormula(formula.toLowerCase());
    }
    return this.execute(roll, actor, deck, options);
  }
  async encounterRoll(ice, action, programId, runner, options) {
    assert(["atk", "def", "spd", "per", "damage"].includes(action), "Invalid ICE roll.");
    const { CPRProgramStatRoll, CPRDamageRoll } = await this.nativeRolls();
    const program = programId ? ice.programs.find(p => p.id === programId) : ice.programs[0];
    assert(!programId || program, "Selected encounter Program no longer exists.");
    assert(action !== "damage" || program, "Add a Program to this encounter to provide its damage formula.");
    const formula = ice.target?.kind === "program" ? program?.system.damage?.blackIce : program?.system.damage?.standard;
    assert(action !== "damage" || typeof formula === "string" && Roll.validate(formula), "Program damage formula is invalid.");
    const value = programId ? Number(program?.system[action]) : Number(ice.stats[action]);
    assert(action === "damage" || Number.isFinite(value), "Selected Program has no value for this stat.");
    const title = programId ? `${ice.name} / ${program.name}` : ice.name;
    const roll = action === "damage" ? new CPRDamageRoll(title, formula, "program") : new CPRProgramStatRoll(action.toUpperCase(), value);
    roll.setNetCombat(title);
    if (program) roll.rollCardExtraArgs.program = program;
    const source = await optionalDocument(ice.documentUuid);
    return this.execute(roll, source?.documentName === "Actor" ? source : runner, null, { ...options, allowLuck: false, targetName: ["atk", "damage"].includes(action) ? ice.target?.name : "" });
  }
  isIce(doc) {
    return doc?.type === "blackIce" || doc?.type === "demon" || doc?.type === "program" && doc.system.class === "blackice";
  }
  async iceRoll(doc, action, programUuid, options) {
    let roll;
    if (doc.type === "demon") {
      assert(["interface", "combatNumber"].includes(action), "Select a Demon stat.");
      roll = doc.createStatRoll(action);
    } else if (doc.type === "blackIce") {
      if (action === "damage") {
        const p = await this.resolve(programUuid);
        assert(p.type === "program" && !p.parent && !p.pack, "Black ICE damage requires a linked world Program Item. Drag one onto this node.");
        roll = doc.createDamageRoll(p.uuid, null, null);
      } else {
        assert(["atk", "def", "spd", "per"].includes(action), "Invalid ICE stat.");
        roll = doc.createStatRoll(action);
      }
      roll.setNetCombat(doc.name);
    } else {
      assert(doc.type === "program" && doc.system.class === "blackice", "This attachment is not native Black ICE.");
      // Standalone Programs have no actor.createStatRoll. Use CPR's classes, not custom math.
      const {
        CPRProgramStatRoll,
        CPRDamageRoll
      } = await this.nativeRolls();
      assert(["atk", "def", "spd", "per", "damage"].includes(action), "Invalid ICE action.");
      roll = action === "damage" ? new CPRDamageRoll(doc.name, doc.system.blackIceType === "antiprogram" ? doc.system.damage.blackIce : doc.system.damage.standard, "program") : new CPRProgramStatRoll(action.toUpperCase(), doc.system[action]);
      roll.rollCardExtraArgs.program = doc;
      roll.setNetCombat(doc.name);
    }
    // For a world Program the runner supplies dialog context; source Program remains unchanged.
    const actor = doc.documentName === "Actor" ? doc : await this.resolve(options.runnerUuid);
    return this.execute(roll, actor, null, options);
  }
  importNative(item) {
    assert(item.type === "netarch", "Select a native CPR NET Architecture Item.");
    const a = makeArchitecture(item.name),
      entry = a.nodes[0];
    a.metadata = {
      sourceUuid: item.uuid,
      sourceFloors: JSON.parse(JSON.stringify(item.system.floors))
    };
    const rows = [...item.system.floors].sort((a, b) => Number(a.floor) - Number(b.floor) || a.branch.localeCompare(b.branch));
    const mapped = [];
    for (const f of rows) {
      const type = {
        "CPR.netArchitecture.floor.options.password": "password",
        "CPR.netArchitecture.floor.options.file": "file",
        "CPR.netArchitecture.floor.options.controlnode": "control",
        "CPR.global.programClass.blackice": "blackice"
      }[f.content] ?? "custom";
      const n = makeNode(type);
      n.name = game.i18n.localize(f.blackice && f.blackice !== "--" ? f.blackice : f.content);
      n.depth = Number(f.floor);
      n.gmNotes = f.description;
      n.challenge.dv = Number(f.dv) || 8;
      let prev = mapped.filter(p => p.branch === f.branch && p.depth < n.depth).at(-1);
      if (!prev) prev = mapped.filter(p => p.depth === n.depth - 1 && p.branch < f.branch).at(-1);
      a.nodes.push(n);
      a.edges.push({
        id: uid(),
        from: prev?.id ?? entry.id,
        to: n.id
      });
      mapped.push({
        id: n.id,
        branch: f.branch,
        depth: n.depth
      });
    }
    return autoLayout(a);
  }
  async syncNative(a) {
    assert(a.metadata.sourceUuid, "This architecture has no linked native CPR Item.");
    const item = await this.resolve(a.metadata.sourceUuid);
    assert(item.type === "netarch", "Source is no longer a NET Architecture.");
    // World Item flags may reach players. Store only a non-sensitive pointer there;
    // full graph remains in the GM-only compendium, native floors remain untouched.
    await item.setFlag(ID, "architectureId", a.id);
  }
  async nativeGenerator(item) {
    assert(item.type === "netarch", "Native NET Architecture required.");
    assert(typeof item.sheet._netarchGenerateFromTables === "function", "Native generator API missing.");
    await item.sheet._netarchGenerateFromTables();
  }
}
