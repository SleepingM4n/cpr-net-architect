# 0.6.1 Jack Out guide

Version 0.6.1 is available through Foundry's module updater and on GitHub. Export unsaved work before updating. For manual installation, stop the hosted world, replace Data/modules/cpr-net-architect with the folder from the release ZIP, then restart and reload every client.

A player pressing JACK OUT is removed from the runner roster. Their slot becomes available immediately. The player becomes an observer, following the same filtered feed as other observers, with no movement, rolls, Programs, Item pickup or Jack In controls. Existing GM broadcast controls can change observer access as usual.

The GM uses Add Player Netrunner to admit them again. Their Actor still needs its configured NET Role and ownership. Their new run starts at the entry with fresh individual discovery and action usage; shared cracked nodes, encounters and Item claims remain intact. Remember to configure NET point usage in the CPR system settings.

Pending rolls and ICE targets for the departing player are cleared. Unapplied damage aimed at them is cancelled, so it cannot affect a replacement Actor. Other Netrunners continue normally.

When the last player leaves, the run remains as a read-only feed. The GM can add a runner or end the run. Reloading does not re-admit departed players.

## Hosted checks

1. Jack out one of two players. Confirm their slot disappears and they can only observe while the other player continues.
2. Reload the departed player's browser. Confirm Jack In remains unavailable.
3. Re-add them as GM, then confirm a fresh Jack In screen and entry position.
4. With six players, jack one out and add a different player into the free slot.
5. Jack out the last player, reload, then add a runner again. Confirm an empty roster stays empty until GM admission.

Automated regression tests cover these cases; live hosted Foundry testing is still needed.
