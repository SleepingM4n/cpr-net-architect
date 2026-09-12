# NET Architect — simple manual

For Foundry VTT **12.343**, **Cyberpunk RED – CORE v0.92.4**, and NET Architect **0.4.0**.

## 1. Prepare the runner and NET points

> **Do this before play: configure NET points usage.** In the hosted setup used for the demonstration, the player cannot do anything in the Architecture if this is left unconfigured.

1. Enable the module and reload both the GM and player clients. Keep a GM connected.
2. Give the player **Owner** permission for their Character.
3. In the Character's native CPR Netrunning tab, select its active NET Role. The Role must have a positive rank. Install a Cyberdeck and its Programs using CPR.
4. When choosing **START NETRUN**, set the runner's **NET Action budget** to the allowance your table uses. During a run, the GM can use **NET ACTIONS → Set / Reset Budget** to configure/reset it. Do not skip NET points/usage setup in the hosted workflow.

The module labels this allowance **NET Actions**. Its counter is bookkeeping and does not implement a separate rules limit: `0` means untracked. If a player remains unable to act after configuration, also check Actor ownership, active NET Role, Cyberdeck, Jack In status, and the presence of an active GM.

## 2. Create or import an Architecture

1. As GM, open **NET Architect** using the network icon in Token scene controls or its Settings sidebar launcher.
2. Create a network, or select **Import JSON** and load `examples/kiroshi-warehouse.json`.
3. Add and connect nodes. Select a node to edit its name, notes, Interface action, DV, and discovery/failure settings.
4. Drag native Actors, Items, or journals onto nodes as attachments. The example's references must be connected to Documents in your own world.
5. Save the Architecture. Use **Export** if you want a portable JSON backup.

## 3. Start and explore

1. Click **START NETRUN**, select the player-owned runner, and configure the NET Action allowance described above.
2. The player presses **JACK IN** in the connection popup.
3. Select an adjacent unknown signal or node and press **ATTEMPT ACCESS** (or its named Interface action).
4. The **player** receives the native CPR roll dialog. Select modifiers/LUCK and confirm. The ordinary CPR card appears in chat according to the player's normal roll mode.
5. The GM's session compares the total against the private DV. A tie fails. Successful access clears/reveals the node as configured.
6. Press **MOVE HERE** to move the virtual runner. The physical Token stays in its original Scene. Failed challenges may block movement or activate ICE, depending on the GM's configuration.

For a non-roll node, use **RESOLVE NODE** and move on. A node with GM approval enabled still requires that approval.

## 4. Take Items and read journals

**GM setup:** mark the attachment **Player-visible** and grant ordinary Foundry permissions: **Limited or higher for Items**, **Observer for journal content**. Individually restricted journal pages remain restricted.

- **Take Item:** clear the node, move onto it, and click **Take Item**. One copy is added to the runner's sheet; the original stays with the GM. The button becomes **Taken**. Each attachment can be taken once per NETRUN, even after reconnect/reset. Starting a new NETRUN permits a new claim.
- Programs taken as loot must be installed into a Cyberdeck using normal CPR controls. Installed children of a container are not automatically copied; link them as separate rewards. Core character Items cannot be taken.
- **Read:** click beside a journal attachment to read its permitted text/image pages within the popup. **Close Reader** collapses it; **Open Sheet** opens the native journal, including other media types.
- Observers can read shared journals but cannot take Items or change the run.

## 5. Programs, ICE, and NET combat

**Configure node visibility and bypass:** select a node in the architecture editor. Enable **Always visible** to show its name/type/icon even at a distance. Its connections only appear when the runner occupies an endpoint of that connection. Distant markers do not disclose notes, DV, attachments or ICE. Normal discovery still reveals the node's contents.

Enable **Allow bypass** to start runs with that node passable without cracking it. During a run, select the node in the GM window and click **Allow Bypass / Disable Bypass** to change it for that run. Bypass permits movement to the node and onward through connected, accessible nodes. It does not mark the node cleared, disable ICE, or unlock Item pickup and Control actions. The runner may still attempt to crack it separately.

**Prepare Black ICE:** attach a native Black ICE Actor and its matching Program Item to a node, or attach a standalone Black ICE Program. An Actor plus its damage Program produces one encounter. Click **Configure ICE** beside the attachment to override its name, PER, SPD, ATK, DEF, maximum REZ and Programs for future runs. Blank stats use the source. Programs supply damage formulas. No selected Programs uses the source Program, the Actor's embedded Programs, or Programs attached beside it.

**Fight in the popup:**

1. Jack In and open **NET COMBAT** from the NETRUN header. ICE deploys when its node is entered or triggered; the GM can also use **Deploy** in the combat window.
2. Move the runner onto the ICE's node. The player clicks **Target ICE**, then **Zap Attack** or a rezzed Program's **ATK**. The player receives the normal CPR dialog and the roll appears in chat.
3. The GM rolls the ICE's **DEF**, compares the rolls, then chooses **Confirm Hit** or **Confirm Miss** in the combat log. To attack the runner, choose the runner or one of their rezzed Programs in the ICE target selector, click **Set ICE Target**, and roll **ATK**. The player rolls **Interface Defense** or the appropriate Program defense.
4. After a hit, roll **Zap Damage**, Program **DAMAGE**, or ICE **DAMAGE**. The ICE's **Roll with** selector chooses its base stats or a copied Program; its default damage uses the first Program. Runner Program damage against virtual ICE uses its Black ICE formula. ICE damage uses its Program's standard formula against the runner and Black ICE formula against a runner Program.
5. The GM clicks **Confirm / Apply Damage** and enters **final damage after all reductions and special effects**. This subtracts encounter REZ for ICE, real Character HP for the runner, or real Program REZ for a runner Program. A Program reaching zero is derezzed; ICE reaching zero is defeated. The same damage record cannot be applied twice. Hit decisions and damage are separate GM steps; no opposed result, critical bonus or special effect is applied automatically.
6. Use **Edit Encounter** to change current/max REZ, stats or Programs while playing. To add/remove Programs, check **Replace the encounter's Program list** and select the desired Programs. These edits affect only this run. The original Actor and Program Items are unchanged. To re-activate defeated ICE, restore its REZ and press **REZ**.
7. To move ICE, the GM chooses a destination under **Move along connection** and presses **Move ICE**. Each move follows one connected edge. This is virtual movement, with no Scene Token changes or automatic pursuit. Moving either combatant apart clears its target; select a target again when they share a node. Hidden or undiscovered ICE cannot be targeted by the player.

Choose the runner's Cyberdeck in the main sidebar. Runner Program REZ/DEREZ affects the real installed Program. Native rolls may warn that no physical Token is targeted; virtual targets belong to NET Architect. Apply NET damage using the combat window, not the chat card's physical-token damage glyph, to avoid applying it twice or to the wrong Token.

The NET Action counter remains manual bookkeeping: separate attack/damage/defense rolls can each increment it. The GM resets/adjusts the allowance; no automatic initiative order or ICE AI is added. Observers can see shared combat information but cannot target, roll or apply damage.

The GM may also reveal/hide nodes, mark them cleared, move the runner, or show the view to selected players. Configure physical-map actions on a Control node; the runner must occupy and clear it before activating them. Macro execution requires explicit GM configuration/approval in this world.

## 6. Finish or return later

- **JACK OUT** (player) or **END NETRUN** (GM) ends the run.
- Closing the window does not end the session. Reopen it through the NET Architect launcher.
- **STOP VIEWING** only closes an observer's feed.
- **RESET NETRUN** returns to the login screen and resets discovery, bypass overrides and encounter ICE from the template; it does not undo real HP/Program damage or replenish already claimed Item attachments in that run.

Use one browser tab per Foundry user and connect through HTTPS unless the GM explicitly enables HTTP compatibility. More detail: [reference](REFERENCE.md), [known limitations](KNOWN-LIMITATIONS.md), and [hosted checks](TEST-CHECKLIST.md).

## Optional HTTP compatibility mode

HTTPS remains the default and recommended connection. If your host only provides HTTP:

1. Install NET Architect **0.3.0 or later** on the server.
2. As GM, open **Game Settings → Configure Settings → NET Architect**. This setting is available even if NET Architect reports that synchronization could not start.
3. Enable **HTTP compatibility mode (less secure connection)** and save.
4. **Reload every GM, player, and observer client.** The world setting makes all clients use the same transport, including those connecting through HTTPS.
5. Reopen NET Architect or rejoin the run. To return to default mode, disable the toggle and reload everyone again.

Compatibility mode uses bundled **TweetNaCl.js 1.0.3** (Curve25519/XSalsa20-Poly1305) for encrypted, authenticated module messages. No CDN or plaintext fallback is used. GM authority, discovery filtering, replay rejection, and private card delivery stay in place. Browser `crypto.getRandomValues` remains required; the mode does not depend on `crypto.subtle` or `crypto.randomUUID`.

**HTTP is still less secure:** an interceptor can modify the JavaScript or public-key documents loaded over HTTP, defeating application-level encryption. Foundry login, ordinary chat, and other traffic outside the module transport are not protected by this option. Use HTTPS when available. If you see a transport-mode mismatch after changing the toggle, reload all clients. No server proxy changes are needed to use this option.
