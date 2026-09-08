import { CONTROL_TYPES, assert, setting, optionalDocument } from "../constants.js";
export class ControlNodeService {
  async execute(session, node, actionId) {
    assert(game.user.isGM, "Control automation must execute on a GM.");
    assert(setting("automation"), "Control automation is disabled.");
    assert(session.currentNodeId === node.id && session.clearedNodeIds.includes(node.id), "Move to a cleared Control Node first.");
    const action = node.controls.find(c => c.id === actionId);
    assert(action && CONTROL_TYPES[action.documentType]?.includes(action.action), "This action is not configured on this node.");
    const doc = await optionalDocument(action.uuid);
    assert(doc && doc.documentName === action.documentType, "Linked Scene Document was deleted or its type changed.");
    if (doc.documentName === "Macro") {
      assert(action.approved, "GM must approve this Macro in the editor before execution.");
      await doc.execute();
    } else {
      let changes;
      if (doc.documentName === "Wall") {
        assert(doc.door > 0, "Linked Wall is not a door.");
        changes = {
          ds: {
            open: 1,
            close: 0,
            lock: 2,
            unlock: 0
          }[action.action]
        };
      } else changes = {
        hidden: ["hide", "disable"].includes(action.action)
      };
      await doc.update(changes);
    }
    Hooks.callAll("cprNetArchitectControlActivated", session, node, action);
    return action.label;
  }
}
