# NET Architect — simple manual

For Foundry VTT **12.343**, **Cyberpunk RED – CORE v0.92.4**, and NET Architect **0.2.1**.

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

## 5. Programs, ICE, and GM controls

- Choose the Cyberdeck in the sidebar. Use **REZ / DEREZ** and the Program's **Attack / Defense / Damage** buttons. Player Program rolls also use native dialogs and ordinary chat.
- For Black ICE, attach the native Actor; attach its matching **world Program Item** if you want native damage rolls. GM ICE controls include REZ/DEREZ, reveal/hide, defeat, and native rolls. Apply damage and adjudicate advanced NET combat with CPR's normal tools.
- The GM may reveal/hide nodes, mark them cleared, move the runner, or show the view to selected players. Observers receive a read-only view.
- Configure physical-map actions on a Control node. The runner must occupy and clear it before activating its controls. Macro execution requires explicit GM configuration/approval in this world.

## 6. Finish or return later

- **JACK OUT** (player) or **END NETRUN** (GM) ends the run.
- Closing the window does not end the session. Reopen it through the NET Architect launcher.
- **STOP VIEWING** only closes an observer's feed.
- **RESET NETRUN** returns to the login screen and resets discovery; it does not replenish already claimed Item attachments in that run.

Use one browser tab per Foundry user and connect through HTTPS. More detail: [reference](REFERENCE.md), [known limitations](KNOWN-LIMITATIONS.md), and [hosted checks](TEST-CHECKLIST.md).
