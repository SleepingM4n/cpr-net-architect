import { ID, PACK, clone, requireGM, assert, sameData } from "../constants.js";
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
  save(data) {
    const snapshot = clone(data);
    const task = (this.saveQueue ?? Promise.resolve()).then(() => this.saveSnapshot(snapshot));
    this.saveQueue = task.catch(() => {});
    return task;
  }
  async saveSnapshot(data) {
    this.assertPrivate();
    assert(!this.pack.locked, "NET Architect private storage is locked. Unlock its compendium and try Save again.");
    const a = validateArchitecture(data);
    // The array can outlive Foundry's compendium Document cache. Never update its stale instances.
    await this.refresh();
    let doc = this.docs.find(d => d.getFlag(ID, "architecture")?.id === a.id);
    this.assertPrivate();
    if (doc) {
      doc = await this.pack.getDocument(doc.id);
      assert(doc, "Architecture storage entry is unavailable. Your editor changes are still open; try Save again.");
      await doc.setFlag(ID, "architecture", a);
    } else doc = await JournalEntry.create({
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
    });
    assert(doc, "Foundry did not create the architecture storage entry.");
    // Query persisted data, rather than trusting a local object or a no-op update result.
    const [saved] = await this.pack.getDocuments({ _id__in: [doc.id] });
    assert(saved && sameData(saved.getFlag(ID, "architecture"), a), "Foundry did not confirm the saved architecture. Keep the editor open and try Save again.");
    this.docs = this.docs.filter(d => d.id !== saved.id);
    this.docs.push(saved);
    return clone(saved.getFlag(ID, "architecture"));
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
