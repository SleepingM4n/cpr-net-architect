# 0.5.1 save-fix testing guide

Version 0.5.1 is available on GitHub and through Foundry's module updater. You can also install the release ZIP manually as described below.

## Install on your host

1. Before replacing files or reloading, export any currently unsaved architecture edits to JSON.
2. Stop the Foundry world and upload/extract the ZIP using your hosting service's file manager. Replace the existing module files so the path is `Data/modules/cpr-net-architect/module.json`, without an extra nested folder.
3. Restart the world and reload all browser clients. Confirm module version **0.5.1**.

## Check saving

1. Edit a node name and DV, save, and wait for **Architecture saved and verified**. Close and reopen the architecture, then reload Foundry and reopen it again. Confirm both edits persisted.
2. Leave the editor open for more than five minutes, make another edit, and repeat the save/reopen check.
3. Change nodes quickly while editing their names. Confirm the edits stay on the correct nodes.
4. If you make additional edits while a save is pending, the editor keeps them marked unsaved. Press Save again to store those newer edits.
5. If a save fails, keep the editor open and retry after resolving the displayed error. The error remains visible and the editor still warns before discarding unsaved work. A JSON export remains available as a portable backup.

Seven regression tests cover stale documents, unconfirmed writes, failed connections, locked storage, overlapping saves, preservation of newer edits, retry behavior, and node selection. All 61 automated tests pass. These simulations do not replace testing on your hosted Foundry server.
