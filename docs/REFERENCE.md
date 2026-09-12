# NET Architect

An independent Foundry VTT module for interactive Cyberpunk RED NET Architectures. The Netrunner stays on the physical tactical Scene and moves a separate virtual avatar through a synchronized NET window.

**Target:** Foundry VTT **12.343**, **Cyberpunk RED - CORE v0.92.4** (`cyberpunk-red-core`). No mandatory external modules, build step, or CDN dependencies. Version **0.2.1** is an initial campaign-test release: automated tests and browser UI checks have passed, but it has not been run on a live licensed Foundry server in this development environment.

## Install on your hosting service

1. Download `cpr-net-architect-0.2.1.zip` and extract it. It contains one top-level folder, `cpr-net-architect`.
2. In your host's file manager or supported custom-module uploader, place that folder under the server's **`Data/modules/`** directory. The final manifest path must be **`Data/modules/cpr-net-architect/module.json`**, without an extra nested folder. The host determines the absolute server path.
3. Restart Foundry from the hosting dashboard if required for module discovery.
4. Open a world using CPR v0.92.4. In **Game Settings → Manage Modules**, enable **NET Architect**, save, and reload all clients.
5. Connect through **HTTPS** by default. HTTP is supported with the GM-enabled compatibility toggle; see the simple manual.
6. As GM, open the **Token scene controls → network icon (NET Architect)**. There is also a launcher in the Settings sidebar. A macro can run `game.modules.get("cpr-net-architect").api.openManager()`.

If the host only accepts a public manifest URL and does not permit custom folder/ZIP uploads, use its supported custom-module installation process. Use the manifest URL in the repository README.

## First run: Kiroshi Warehouse

1. Open the library, select **Import JSON**, and choose `examples/kiroshi-warehouse.json` from this package. This is a six-node, two-branch editable example; its DVs are demonstration choices.
2. In the editor, select **ICE Countermeasure**. Drag a native Black ICE Actor onto the card. For native damage, also drag its corresponding **world Program Item** onto that card. Alternatively, attach a standalone native Black ICE Program Item.
3. Select **Shipping Manifest** and drop a JournalEntry or JournalEntryPage onto the card. Attachments start **GM-only**. Toggle **Player-visible** and grant ordinary Foundry access to the intended readers to read or take it: Observer for journals, Limited or higher for Items. The module does not silently alter Document ownership.
4. On the physical Scene, select the lobby door Wall. In the editor select **Lobby Security → Add Control Action**. The selected Wall's UUID is filled in. Set type **Wall**, action **open**, label **OPEN LOBBY DOOR**. If no Wall is selected, paste its UUID. Add a second **close** action if desired.
5. **Save Architecture**, then **Export**. The library is stored in your world and survives reloads, independent of the module installation folder.
6. On the Character's native CPR Netrunning tab, select the active NET Role. That embedded Role Item must have a positive rank. Install a Cyberdeck and Programs using the native CPR inventory. Give the player ownership of the Character and have them connect.
7. In the library choose **START NETRUN**. Select the qualified player Actor, optionally set a NET Action budget, and optionally broadcast. The player must press **JACK IN**; starting the session does not Jack In automatically.
8. Click the unknown frontier and **ATTEMPT ACCESS**. The **player receives the native CPR roll dialog** and chooses modifiers and LUCK. The result is posted as an ordinary CPR chat card using the player’s core roll mode. The GM applies the result to the node. Rolls use CPR's Cyberdeck methods, effects, wounds, critical dice, and configuration. A tie does not beat the DV.
9. Successful challenges clear/reveal the node, produce the green effect, and share the native roll card when permitted. Click **MOVE HERE** to advance. Failures remain blocked if configured. Hidden node names, contents, and DVs remain private. Attempting a hidden challenge discloses the Interface ability needed for the player’s native dialog; the player’s dice and ability appear in ordinary chat.
10. Moving onto the ICE node rezzes its virtual encounter state. The GM selects that node and uses **REZ / DEREZ / REVEAL / HIDE / DEFEAT**, **ATK**, and **DAMAGE** controls beside its attachment. Original Black ICE Actors are not damaged by the module's virtual REZ/DEREZ operations.
11. Clear Lobby Security, move there, and press **OPEN LOBBY DOOR**. The GM validates the request and updates the real Wall. The physical Netrunner Token has never moved or changed Scenes.
12. **JACK OUT** ends the session after confirmation. Closing the window's X only closes the local view. **STOP VIEWING** is observer-only and never ends the run. The network icon lets permitted users rejoin.

## Editing and content

- New, edit, rename, duplicate, delete, search, sort, JSON import/export, weighted generation, and native CPR import are in the library.
- Graph cards support drag, zoom, pan, Fit, auto-layout, arbitrary branches, connection/disconnection/reconnection, stable IDs, icons/colors, custom node types, optional depths, player notes, GM notes, and entry selection.
- Select a node to configure its native Interface action, DV, retry policy, discovery, failure blocking, failure ICE activation, automatic resolution, or GM approval. These are campaign configuration controls, not a complete rules adjudicator.
- Drop Actors, Items, JournalEntries, JournalEntryPages, and Macros onto nodes. Multiple UUID links are supported. GM-only links are excluded from player data. Deleted/inaccessible Documents are reported or omitted gracefully.
- **Link CPR Item** writes a namespaced architecture ID pointer to the imported native Item. The extended graph remains in private module storage. Native `system.floors` are preserved; arbitrary graphs are not destructively flattened back into floors.
- **Random Architecture** uses explicit GM-configured weights and default DV. **Native Table Generator** opens CPR's existing generator on a selected native NET Architecture Item; after it finishes, import that Item. It uses the installed system's tables instead of copied rulebook tables.

## Runtime permissions and privacy

The lowest-ID connected GM is authoritative. Start runs from that GM's client. Other GMs/assistant GMs can view and send authorized runtime controls; their native roll dialogs execute on the authority. If the authority disconnects, the next connected GM restores the persisted run. The session pauses without a GM; reconnect and use Rejoin when one returns.

Template and runtime state live separately in the **GM-only world JournalEntry compendium `world.cpr-net-architect`**. Do not expose that pack to players or export it into a shared world Journal. The module checks its permissions before use. Its index uses opaque document names.

Socket payloads use **ECDH P-256 / AES-GCM** encryption and authentication by default, or bundled TweetNaCl encrypted transport when HTTP compatibility is enabled. Public keys are bound to Foundry User documents; private keys stay in browser memory. Forged sender IDs, replayed packets, stale revisions, observer mutations, and arbitrary player control actions are rejected. Every viewer gets an allowlisted state projection; unknown frontier cards have only an opaque ID and position. Paths reveal only discovered topology and immediately adjacent frontier routes.

Player-initiated Interface and Program rolls use ordinary native CPR cards, including normal roll-mode visibility and chat history. They always post to chat regardless of the module’s chat-level setting. GM-controlled rolls retain the private-card system described here: public ChatMessages contain only neutral placeholders and opaque card IDs; the actual cards are stored in the private compendium and delivered encrypted to their authorized recipients. Existing cards can be recovered by an authorized user after reload while a GM is online. Normal CPR glyph handlers are rebound after delivery. Subsequent actions initiated through native CPR chat glyphs are handled by CPR itself. Module chat events never include hidden labels. Dice So Nice follows CPR's native roll mode behavior; it may display an unlabeled die outside the NET window.

An observer sees the same graph as the runner. The observer sidebar omits inventory UUIDs and interactive Program controls. Player-visible attachments additionally require the recipient's ordinary Foundry Document permissions. The module cannot make already-shared world Documents secret retroactively, and hiding a previously revealed node cannot erase information a player already received.

Use **one connected browser tab per Foundry user account**. A reload replaces that account's transport key; separate people must use separate Foundry users. No persistent private keys are written to user flags or browser storage. Completed session logs are optional. Private chat records are retained to support chat history and world backups.

## Programs, ICE, Demons, and actions

The Programs panel reads installed Programs from the chosen native Cyberdeck. REZ/DEREZ updates real Program Items; native update hooks refresh the panel. Player attacks/defense/damage open locally and use the Cyberdeck's CPR roll pipeline and ordinary chat. Black ICE Program activation uses `setRezzed()` to avoid CPR's physical Scene Token creation.

Black ICE and Demon encounter activation is stored in the session, separate from architecture templates and source Actors. Black ICE combat rolls use CPRProgramStatRoll/CPRDamageRoll with encounter snapshot stats and copied Programs. Use NET COMBAT for mutual targeting, GM hit decisions, final damage, encounter edits and connected ICE movement. A Program must supply the damage formula. Demon controls use native Interface/Combat Number checks. Configure a Macro control on the same node for an advanced Demon action.

The optional NET Action counter is bookkeeping: the GM supplies the budget and may reset it; the counter resets when the Netrunner's combat turn begins. It does not enforce action economy, and damage-button rolls may need a manual counter adjustment. No unverified rank formula or separate initiative system is introduced.

## Meatspace actions

| Document | Actions |
| --- | --- |
| Wall door | Open, close, lock, unlock (unlock leaves it closed) |
| Tile / Token | Show, hide |
| AmbientLight / AmbientSound | Enable, disable using native hidden state |
| Macro | Execute a pre-existing UUID-linked Macro approved by the GM in this world |

All control actions require the runner to occupy and have cleared the node. The request carries only an action ID; the authority looks up the configured Document/type/operation. Imported JSON never carries executable code, and **all imported Macro approvals are cleared**. Approved Macros run with GM authority; use only Macros you intend for that purpose. Complex doors, elevators, cameras, alarms, and turrets can use these configured Macros.

## Settings

World settings cover theme, observer permission/prompting, generator defaults, chat level (All/Rolls Only/Important Events/None), GM/runner auto-open, Jack Out confirmation, completed logs, control automation, and debug logging. Client settings cover sound, effects, reduced motion, intensity, UI scale, observer auto-open, and remembered window position. Explicit Rejoin works even when auto-open is disabled. Themes use CSS custom properties and original CSS with no proprietary assets.

## API and hooks

```js
const net = game.modules.get("cpr-net-architect").api;
net.openManager();                                      // GM
net.openArchitecture(architectureId);                    // GM
await net.startNetrun(architectureId, actorUuid, {
  userId, deckId, observers: [], actions: 3, override: false
});                                                     // authoritative GM
await net.endNetrun();                                  // runner or GM
net.getActiveSession();                                 // clone of caller's permitted state
await net.revealNode(nodeId);                           // GM
await net.moveRunner(nodeId);                           // GM override
await net.importArchitecture(jsonObjectOrString);        // GM; new ID, approvals cleared
net.exportArchitecture(architectureId);                 // GM; JSON-safe object
await net.rejoin();
```

Custom hooks execute on the authoritative GM and contain full state: `cprNetArchitectJackIn(session)`, `cprNetArchitectNodeRevealed(session,node)`, `cprNetArchitectControlActivated(session,node,action)`, and `cprNetArchitectJackOut(session)`. Integration modules must not forward full hook payloads to players. As with Foundry hooks generally, callbacks should not mutate supplied objects or throw.

## Validation and limitations

Run `node --test tests/*.test.js` and `node tests/check.mjs` from this folder (Node 22+ recommended; tested with Node 24). No npm install is needed. `node tests/serve-preview.mjs` starts the optional local browser harness on port 18771; the harness uses real NET UI classes with mocked Foundry services and simulated outcomes. It is not a multiplayer server.

Read [the integration audit](CPR-INTEGRATION.md), [the manual test checklist](TEST-CHECKLIST.md), [known limitations](KNOWN-LIMITATIONS.md), and [the delivery report](DELIVERY-REPORT.md) before campaign use.

This release intentionally defers automatic Pathfinder reveal breadth, opposed Interface/ICE combat resolution, unsafe Jack Out damage, automated ICE pursuit/turns, automatic NET Action derivation, and arbitrary graph-to-native-floor round trips. The GM adjudicates those rules using CPR's existing tools. One active NETRUN per world is supported. UI text is English; settings are localized through `lang/en.json`.

## Items and journals (0.2.1)

Mark node attachments **Player-visible** in the editor and grant native document access. After clearing and moving onto a node, the runner can press **Take Item**. A copy is added to the runner Actor’s sheet; the source Item remains available to the GM. Each linked attachment can be claimed once per NETRUN, including after reconnect or Reset NETRUN. A new NETRUN permits a new claim. Picked-up Programs are inventory Items and must be installed in a Cyberdeck normally. Container capacity is preserved, but installed child Items are not copied; attach each desired reward separately. Core character Items cannot be picked up.

Press **Read** on a journal attachment to display permitted text and image pages inside the NET window’s inspector. Secret text and inaccessible pages remain hidden from players. PDF/video pages still use the native journal sheet. Observers can read shared journals but cannot take Items.

Player rolls use ordinary Foundry client dice trust. The authority issues an expiring one-use grant and verifies the matching chat author, Actor, and grant before comparing the recorded total with its private DV. Arbitrary totals in socket requests are ignored. A cancelled roll does not spend a NET action; cancelling after changing LUCK follows CPR’s native behavior. Interrupted rolls after a GM change must be retried; already spent LUCK or posted cards are not rolled back. Existing 0.1.0 architectures need no migration.

## Optional HTTP compatibility mode

HTTPS remains the default and recommended connection. If your host only provides HTTP:

1. Install NET Architect **0.3.0 or later** on the server.
2. As GM, open **Game Settings → Configure Settings → NET Architect**. This setting is available even if NET Architect reports that synchronization could not start.
3. Enable **HTTP compatibility mode (less secure connection)** and save.
4. **Reload every GM, player, and observer client.** The world setting makes all clients use the same transport, including those connecting through HTTPS.
5. Reopen NET Architect or rejoin the run. To return to default mode, disable the toggle and reload everyone again.

Compatibility mode uses bundled **TweetNaCl.js 1.0.3** (Curve25519/XSalsa20-Poly1305) for encrypted, authenticated module messages. No CDN or plaintext fallback is used. GM authority, discovery filtering, replay rejection, and private card delivery stay in place. Browser `crypto.getRandomValues` remains required; the mode does not depend on `crypto.subtle` or `crypto.randomUUID`.

**HTTP is still less secure:** an interceptor can modify the JavaScript or public-key documents loaded over HTTP, defeating application-level encryption. Foundry login, ordinary chat, and other traffic outside the module transport are not protected by this option. Use HTTPS when available. If you see a transport-mode mismatch after changing the toggle, reload all clients. No server proxy changes are needed to use this option.

## Node visibility and combat (0.4.0)

See the [simple combat manual](QUICK-START.md#5-programs-ice-and-net-combat) for distant node markers, GM bypass, targeting, encounter-only edits, copied Programs and movement. Player distant markers omit private node contents. Bypass never clears a node. Combat targets must share a node. The GM applies final damage in the combat log; source Black ICE Actors and Programs are unchanged. Resetting a run does not undo damage to the real runner sheet.
