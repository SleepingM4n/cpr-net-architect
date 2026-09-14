# NET Architect 0.5.0 — new controls and testing guide

Version 0.5.0 is available on GitHub. Update using the standard release manifest or install the release ZIP with the steps below. If you installed the earlier local test build, replace its module files with this release to restore automatic update links.

## Install on your host

1. Stop the Foundry world using the host's controls.
2. Upload and extract `cpr-net-architect-0.5.0.zip` using the host's file manager. Replace the existing module folder's files, so the final path is `Data/modules/cpr-net-architect/module.json`. Avoid nesting the folder twice.
3. Restart Foundry and reload every GM/player browser. Check that Manage Modules shows NET Architect 0.5.0. Existing world settings and saved architectures stay in the world data.
4. Configure NET points/NET Action usage as described in the [simple manual](QUICK-START.md). Keep a GM connected.

## Rename the datafort

- In the library use **Rename**, or in the editor use **Name / Theme**. Save the architecture for future runs.
- In an existing run, the GM can use **Rename Architecture** in the header. This changes the current run only.
- The login heading now uses this name. Blank or whitespace-only names default to **Night City Datafort**. Existing named architectures retain their names.

## Place NPC Netrunners and Demons

1. In the editor, find **NPC NETRUNNERS / DEMONS** below the node inspector and click **Place NPC / Demon**. The same panel is available in the main run and NET Combat windows.
2. Choose a Character, Mook NPC, or Demon Actor, or paste an Actor UUID (including a compendium Actor). Choose a starting node and whether players can see it after discovering that node.
3. Add more Actors as needed. Each placement has its own position, even if you use the same Actor more than once. Save the architecture to retain initial placements for future runs.
4. During a run, the GM chooses a connected destination and presses **Move NPC**. Every move follows one edge. The GM adjudicates challenges for these NPCs; their movement does not crack nodes, trigger player movement, or reveal the map to the player. No physical Scene Token is moved or created.
5. **Hide NPC / Reveal NPC** controls visibility; undiscovered locations remain hidden regardless. **Actor Sheet** opens the original native sheet. **Remove NPC** removes only this placement, not the Actor.

These additions provide independent NPC/Demon placement and movement. They do not add NPCs to the runner-versus-ICE target/automated-damage system. Use their native Actor sheets for NPC rolls and adjudication. Existing Demon ICE attachments still work as before; use the new placement panel when you want an independently moving Demon.

Live changes persist through reconnects. Reset restores the architecture's starting placements and removes NPCs added only during that run. Missing template Actors are shown to the GM as unavailable and kept hidden from players until replaced. Source Actors and permissions are not changed by placement or movement.

## Test checklist

- Rename an architecture and verify the login heading. Try a blank name to check the default.
- Use a long node name: it should wrap to two lines. Very long names truncate after line two; selecting the node shows its full name in the inspector.
- Place two NPC Netrunners and a Demon. Move each independently; ensure their markers and player visibility update correctly.
- Save/reopen the template, duplicate it, export/import it, reconnect during a run, and reset the run. Check the expected positions.
- Open the main window and NET Combat together. Roll, target, confirm damage and move NPCs from NET Combat: the main window must not jump in front. Repeat actions from the main window: NET Combat must not jump in front either.
- Repeat as player and observer; they must not receive NPC movement controls or hidden Actor UUIDs/locations.

Validation: 54 automated tests plus syntax/import/manifest checks. Browser harness checks cover wrapped labels, NPC markers, independent movement and placement controls using mocked Foundry services. Live hosted multiplayer verification remains for this test.

Focus handling uses Foundry v12's documented [Application render focus option](https://foundryvtt.com/api/v12/classes/client.Application.html#render) so background updates preserve the front window. Explicitly opening a window still brings it forward.
