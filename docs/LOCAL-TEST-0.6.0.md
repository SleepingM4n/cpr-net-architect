# 0.6.0: up to six player Netrunners

Version 0.6.0 is available through Foundry's module updater and on GitHub. Export unsaved editor work before updating. For manual installation, stop the world, replace `Data/modules/cpr-net-architect` with the folder from the release ZIP, restart, and reload every client.

## Start a group run

1. Configure each Netrunner Actor with a positive NET Role rank, a Cyberdeck, and Owner permission for its player.
2. **Configure NET point usage in the Cyberpunk RED system settings. Without it, players cannot perform their NET actions.** The module's optional action counter does not replace that setting.
3. Start the Architecture with the first Netrunner as usual.
4. Click **Add Player Netrunner** in the live window and choose another qualified Actor and its owning player. You can add players before the first Jack In or during the run.
5. Repeat up to **six players total**, including the first runner. Each needs a distinct Actor and user. NPC Netrunners and Demons use separate placement controls and do not count toward the limit.
6. Each player presses **JACK IN** on their own screen. Offline players can reconnect using **REJOIN NET VIEW**.

## Playing together

- Each player has independent movement, discovery, Programs, rolls and action tracking. Teammate markers appear only at locations that player has discovered.
- Cracked nodes, GM bypasses, NPCs and ICE encounters are shared. An Item attachment can be collected once for the group, into the collecting runner's sheet.
- The GM uses **Switch Netrunner** in the Architecture or NET Combat window. Movement, reveal/hide controls, budget changes, runner rolls and new ICE targets use the selected runner, whose name appears above the map.
- To target another player with ICE, select that Netrunner, choose the character or a rezzed Program, then press **Set ICE Target**. They must occupy the same node. Existing targets and rolled damage stay bound to that character after switching the GM view.
- Multiple players can have pending roll dialogs at once. Rolls appear in chat as usual; the GM still confirms hits and final damage.
- **JACK OUT** affects only that player and returns them to the entry/login position. Their slot stays reserved for reconnecting and they can Jack In again. The GM's **END NETRUN** ends the group run; **RESET NETRUN** resets all runners and encounters.
- Observers remain read-only and follow the first runner's discovery feed.
- Simultaneous changes can produce the existing “State changed” notice; retry from the updated view. Authorized pending rolls remain valid across unrelated player updates.

## Hosted acceptance checks

1. Add six qualified owned Actors and verify a seventh, an unqualified Actor, and mismatched owners are refused.
2. Move two players along different branches; check separate positions, discovery, Programs and action counts.
3. Open both players' roll dialogs, complete them in reverse order, and verify results belong to the correct characters.
4. Target player B with ICE, switch the GM view to player A, and apply rolled damage. Only B's intended HP or Program REZ should change.
5. Try taking the same Item with both players. Only the first recipient should receive it.
6. Reload player and GM clients; check restored positions and Cyberdecks.
7. Jack out one player while another continues, then test GM reset and end.

Automated tests and the browser UI harness cover the new behavior; a live hosted multi-client Foundry session has not been tested here.
