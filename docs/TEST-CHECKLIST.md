# Hosted acceptance checklist

Target **Foundry 12.343 + cyberpunk-red-core v0.92.4**. These boxes are intentionally unchecked: they must be run on the actual hosted server. Use a test world or world backup, one GM account, one runner account, and one observer account in separate browsers/profiles. Add an outsider account for privacy tests. Each account should have only one active tab.

## Setup and library

- [ ] Confirm both exact versions in Foundry. Enable the module and reload all users. No `CPR NET Architect |` startup errors appear. HTTPS is active.
- [ ] GM can open NET Architect from Token scene controls and from the API macro in README.
- [ ] Create `Kiroshi Warehouse` or import the bundled JSON; import is editable and Macro approvals start cleared.
- [ ] Add Access, Password DV 8, Black ICE, Control DV 10, File DV 6, and two branches. Rename and change notes/type/icon/color/depth.
- [ ] Drag nodes, pan background, zoom with wheel, Fit, auto-layout. Connections follow their nodes. Reconnect/disconnect a path and save.
- [ ] Duplicate the architecture. IDs differ and connections remain valid. Search by name; sort by modification time; rename; delete only the duplicate.
- [ ] Export JSON, import the export, and compare graph topology and fields. Malformed JSON, duplicate IDs, missing endpoints, and future schema versions give readable errors.
- [ ] Generate a weighted graph with branches, 50 nodes, and custom weights. Edit it immediately.
- [ ] Run the native CPR table generator on a new native NET Architecture Item, then Import from CPR. Check inferred branch junctions. Link CPR Item and verify native floors remain unchanged by linking.
- [ ] Reload the GM or restart the hosted world. The saved architecture persists in `world.cpr-net-architect`.

## Actors and linked Documents

- [ ] A connected player-owned Character with active NET Role ID and positive Role rank appears as a candidate, with correct rank. A non-Netrunner whose *name* contains Netrunner/Interface is not falsely accepted.
- [ ] Select an Actor through GM override. A Demon can use native Interface; a custom/mook Actor still needs a native NET Role and Cyberdeck for Character-style native rolls.
- [ ] Drop a Black ICE Actor and its matching **world Program Item** onto the ICE card. Drop a Journal/Page onto File. Drop a Demon onto another card.
- [ ] New attachments are GM-only. Toggle a Journal attachment Player-visible and grant ordinary Foundry observer permission. It is available only after discovery.
- [ ] Delete a linked test Document. The graph still opens; missing content is identified. Do not delete real campaign content for this test.

## Login, movement, rolls and effects

- [ ] Start with the qualified Character. The player's login shows handle, rank and Cyberdeck. It stays on login until the player presses JACK IN.
- [ ] The GM sees full state after Jack In. Player and observer see only discovered nodes and anonymous adjacent frontiers; no hidden name, type, DV, image, GM note, attachment UUID or deeper topology appears.
- [ ] Player selects unknown Password frontier and ATTEMPT ACCESS. Native CPR confirmation opens for the authoritative GM; confirm a known Active Effect/wound modifier and verify it appears.
- [ ] Fail a challenge: red scoped glitch and ACCESS DENIED; movement stays blocked. Retry-disabled settings are enforced. Cancel a roll dialog: no challenge result is committed.
- [ ] Succeed: native CPR roll card appears for permitted recipients; green effect; node reveals. A total equal to DV fails. MOVE HERE advances the virtual avatar and highlights its previous path.
- [ ] GM can roll for the Netrunner, reveal/hide, reveal branch/all, clear/compromise, and move the runner through GM controls. Hiding the current node is rejected until the runner moves.
- [ ] Original Actor portrait appears on the current NET node. Physical Token UUID, Scene, position, elevation, and status remain unchanged by NET movement.
- [ ] Cyberdeck selector and installed Programs match the native Actor. REZ/DEREZ persists on the real Program, including when changed in the native sheet. Native Program rolls work with effects; deleted/uninstalled Programs give an error.
- [ ] Black ICE REZ/DEREZ/reveal/hide/defeat state is virtual. ATK uses native CPRProgramStatRoll with encounter stats; DAMAGE uses a copied Program. Missing Program must not silently generate guessed damage.
- [ ] Demon Interface and Combat Number invoke native stat rolls. Test a configured advanced action Macro only if approved by the GM.
- [ ] Existing Combat round/turn/runner initiative appears. GM budget/reset works; runner turn advancement resets used actions. The native combat tracker remains in control.
- [ ] RED and 2077 themes work. Reduced motion disables login/glitch/flow movement, visual-effects setting works, sounds are opt-in, and scale/sidebar controls remain usable.

## Meatspace control

- [ ] Select a real door Wall on the physical Scene, then Add Control Action. UUID fills correctly. Configure open/close/lock/unlock. Clear the node and move onto it; each action changes the real door appropriately.
- [ ] Linked Tile and Token show/hide actions work without changing player ownership.
- [ ] Ambient Light and Ambient Sound enable/disable actions work on their Scene.
- [ ] Configure a harmless Macro and approve it in the GM editor. Only the cleared occupied node can execute it. Export/import the architecture: the Macro must require fresh GM approval.
- [ ] Requests with an unknown action ID, arbitrary UUID/property, wrong document type, or an uncleared/distant node are rejected before a world update.

## Observers, reconnect and security

- [ ] SHOW TO PLAYERS supports selected accounts, everyone by selecting all, and Netrunner Only by clearing selections. Observers receive the runner graph but no mutation controls.
- [ ] STOP VIEWING and window X only close that local window. No session ends. Use REJOIN NET VIEW with spectator auto-open disabled: explicit rejoin still opens it.
- [ ] Attempt an observer mutation through the API/socket: rejected. Forging a packet's sender ID fails authentication. Replaying a captured encrypted request fails. Nonparticipants receive no decryptable state.
- [ ] Inspect player `game.modules.get('cpr-net-architect').api.getActiveSession()` and module network packets: hidden contents are absent or encrypted. Attempt to read the private pack as a player: denied. Inspect private ChatMessage source: only neutral placeholder and opaque card ID, never hidden native card contents.
- [ ] Reload the Netrunner: permitted session and current position restore. Reload observer: authorized state restores subject to auto-open preference. Outsider cannot rejoin until included.
- [ ] Disconnect the GM, then reconnect: current session remains persisted. With a second GM, verify authority handoff and avoid double execution of an interrupted roll/control action.
- [ ] Change the reusable architecture while a run is active: current session snapshot stays unchanged. RESET NETRUN removes runtime discovery without modifying the saved template.
- [ ] Player JACK OUT asks for confirmation and ends the session. GM END NETRUN also ends it. All open authorized views show SESSION TERMINATED; no physical Scene switch occurs.
- [ ] With Store Completed Logs enabled, inspect the private completed record. With it disabled, no completed session log is added. Native private chat history still exists separately.

## Automated checks

From the module directory, run:

```text
node --test tests/*.test.js
node tests/check.mjs
```

The browser harness is started with `node tests/serve-preview.mjs`, then opened at `http://127.0.0.1:18771/tests/preview.html`. It demonstrates real UI classes with mocked Foundry data and **simulated** rolls; it must not be reported as native Foundry or multiplayer validation.

## 0.2.0 hosted checks

- As the player, attempt a node: only the player gets the native dialog; choose LUCK, roll, and verify an ordinary CPR card and correct GM-controlled outcome. Repeat with Program attack/defense/damage, cancellation, ties, and private roll modes.
- Share an Item and journal with document permissions and Player-visible enabled. Clear and move to that node; Take Item adds one copy to the runner sheet. A second click/reconnect/reset must not duplicate it. A new NETRUN may grant it again.
- Read opens journal content within the NET popup. Confirm secret text and individually restricted pages remain hidden. Observers may read but cannot take.

## HTTP compatibility acceptance (0.3.0)

- [ ] With the toggle off, a remote HTTP client receives the actionable HTTPS/compatibility error and cannot synchronize.
- [ ] The GM can still find and save the toggle in Configure Settings after initialization fails.
- [ ] Enable the toggle, reload all accounts, and verify library creation, UUID generation, Jack In, discovery, player rolls, Item pickup, inline journals, private GM cards and rejoin over remote HTTP.
- [ ] Test a GM on HTTPS and runner on HTTP with the same world toggle enabled.
- [ ] Verify observers cannot mutate runs and hidden nodes/cards do not appear in their projection.
- [ ] Toggle off, reload everyone on HTTPS, and confirm default transport works again. Unreloaded peers should fail with a mode-mismatch message.
- [ ] Test GM reconnect/authority handoff and public-key rotation.

## NET combat acceptance (0.4.0)

- [ ] Enable Always visible on a distant node. Runner sees the marker but no notes/DV/attachments. Approach and leave its connections; only current incident connections appear.
- [ ] Toggle bypass as GM during a run. Travel through without clearing. Item pickup and controls remain unavailable until separately cracked.
- [ ] Attach Actor plus damage Program; entering creates one ICE encounter. Configure and edit stats/REZ/Programs; source Actor and Items stay unchanged.
- [ ] Player targets visible same-node ICE and rolls Zap and Program ATK/DAMAGE locally into chat. Hidden/distant/defeated targets are rejected.
- [ ] GM sets ICE target to runner and to a rezzed Program. Roll native ATK/DEF/SPD/PER/DAMAGE. Confirm hit/miss; no HP changes until GM applies final damage.
- [ ] Damage uses the correct standard/Black ICE formula, including custom formula modifiers. Apply final mitigated damage to ICE REZ, runner HP and Program REZ. Repeated apply does not subtract twice.
- [ ] GM moves ICE along an edge. Positions synchronize, target clears, and hidden destination stays private. Revisit its original node: no duplicate or resurrection.
- [ ] Reconnect/re-elect GM: encounter position, edits, REZ and combat records persist. Reset restores template ICE/bypass; real runner damage is not undone.
- [ ] Observer sees shared combat only, with no mutation controls or private ICE stats/Programs. Repeat with HTTP compatibility enabled.

Development validation: 49 automated tests, syntax/import/manifest checks and mocked browser GM/player combat UI. Live hosted multiplayer checks above remain to be completed on a Foundry server.
