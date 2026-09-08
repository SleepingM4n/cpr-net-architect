import { ID, PACK, clone, requireGM, assert } from "../constants.js";
import { validateArchitecture } from "./import-export-service.js";
export class ArchitectureService {
  async initialize() {
    requireGM();
    this.pack = game.packs.get(PACK) ?? (await CompendiumCollection.createCompendium({
      name: ID,
      label: "NET Architect — private storage",
      type: "JournalEntry",
      package: "world",
      ownership: {
        PLAYER: "NONE",
        TRUSTED: "NONE",
        ASSISTANT: "OWNER",
        GAMEMASTER: "OWNER"
      }
    }));
    await this.pack.configure({
      locked: false,
      ownership: {
        PLAYER: "NONE",
        TRUSTED: "NONE",
        ASSISTANT: "OWNER",
        GAMEMASTER: "OWNER"
      }
    });
    await this.refresh();
  }
  async refresh() {
    requireGM();
    this.docs = await this.pack.getDocuments();
  }
  assertPrivate() {
    requireGM();
    assert(!game.users.some(u => !u.isGM && this.pack.testUserPermission(u, "OBSERVER")), "Private storage permissions changed. Restore GM-only ownership before using NET Architect.");
  }
  list() {
    this.assertPrivate();
    return this.docs.map(d => d.getFlag(ID, "architecture")).filter(Boolean).map(clone);
  }
  get(id) {
    const a = this.list().find(a => a.id === id);
    assert(a, "Architecture was deleted or does not exist.");
    return a;
  }
  async save(data) {
    this.assertPrivate();
    const a = validateArchitecture(data);
    const doc = this.docs.find(d => d.getFlag(ID, "architecture")?.id === a.id);
    if (doc) await doc.setFlag(ID, "architecture", a);else this.docs.push(await JournalEntry.create({
      name: `Architecture ${a.id}`,
      ownership: {
        default: 0
      },
      flags: {
        [ID]: {
          architecture: a
        }
      }
    }, {
      pack: PACK
    }));
    return a;
  }
  async delete(id) {
    this.assertPrivate();
    const d = this.docs.find(d => d.getFlag(ID, "architecture")?.id === id);
    assert(d, "Architecture not found.");
    await d.delete();
    this.docs = this.docs.filter(x => x.id !== d.id);
  }
  async saveSession(session) {
    this.assertPrivate();
    let d = this.docs.find(d => d.getFlag(ID, "kind") === "runtime");
    if (!d) {
      d = await JournalEntry.create({
        name: "NET runtime",
        ownership: {
          default: 0
        },
        flags: {
          [ID]: {
            kind: "runtime"
          }
        }
      }, {
        pack: PACK
      });
      this.docs.push(d);
    }
    await d.setFlag(ID, "session", clone(session));
  }
  loadSession() {
    this.assertPrivate();
    return clone(this.docs.find(d => d.getFlag(ID, "kind") === "runtime")?.getFlag(ID, "session") ?? null);
  }
  async saveLog(session) {
    this.assertPrivate();
    await JournalEntry.create({
      name: `Completed NET ${session.id}`,
      ownership: {
        default: 0
      },
      flags: {
        [ID]: {
          kind: "log",
          session: clone(session)
        }
      }
    }, {
      pack: PACK
    });
  }
  async saveCard(card) {
    this.assertPrivate();
    const doc = await JournalEntry.create({
      name: `Roll ${card.id}`,
      ownership: {
        default: 0
      },
      flags: {
        [ID]: {
          kind: "card",
          card
        }
      }
    }, {
      pack: PACK
    });
    this.docs.push(doc);
  }
  async loadCard(id) {
    this.assertPrivate();
    let doc = this.docs.find(d => d.getFlag(ID, "card")?.id === id);
    if (!doc) {
      await this.refresh();
      doc = this.docs.find(d => d.getFlag(ID, "card")?.id === id);
    }
    return doc?.getFlag(ID, "card") ?? null;
  }
}
