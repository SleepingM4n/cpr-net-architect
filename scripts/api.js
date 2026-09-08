import { clone, requireGM } from "./constants.js";
import { importedArchitecture } from "./services/import-export-service.js";
export function buildAPI(runtime) {
  return Object.freeze({
    openManager: () => runtime.openManager(),
    openArchitecture: id => {
      requireGM();
      return runtime.openEditor(runtime.store.get(id));
    },
    startNetrun: (id, actorUuid, options) => runtime.sessions.start(id, actorUuid, options),
    endNetrun: () => runtime.runApp.send("end"),
    getActiveSession: () => clone(runtime.view),
    revealNode: nodeId => {
      requireGM();
      return runtime.runApp.send("reveal", {
        nodeId
      });
    },
    moveRunner: nodeId => {
      requireGM();
      return runtime.runApp.send("moveGM", {
        nodeId
      });
    },
    importArchitecture: async data => {
      requireGM();
      return runtime.store.save(importedArchitecture(data));
    },
    exportArchitecture: id => {
      requireGM();
      return runtime.store.get(id);
    },
    rejoin: () => runtime.rejoin()
  });
}
