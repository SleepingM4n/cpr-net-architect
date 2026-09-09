# Known limitations — 0.1.0

1. **Live compatibility remains unverified.** The supplied CPR v0.92.4 source was inspected. Tests cover a mocked v12 API and browser UI, not a running Foundry v12.343 server. Run the campaign checklist on your host before relying on it during a session.
2. **One active NETRUN per world; one browser tab per User account.** The lowest-ID active GM is the authority. Start runs from that account. Mutations pause while no GM is connected. A newly elected GM restores private persisted state; an interrupted roll should be reviewed before retrying.
3. **Player dice use native client trust.** Players confirm Interface and Program rolls locally and post ordinary CPR cards. The GM validates a one-use grant against the authored chat message and resolves the private DV. As with normal Foundry rolls, a deliberately modified player client is not a trusted dice oracle. GM-initiated rolls and ICE stay on the authority.
4. **Rules automation is deliberately bounded.** No automatic Pathfinder breadth, opposed combat resolution, ICE pursuit, Demon autonomous turns, control takeover versus a Demon, unsafe Jack Out attacks, or Virus timing. Choose configurable challenges and use GM reveal/move/clear controls for adjudication.
5. **NET Actions are a manual budget.** No verified Character action-count getter was present in the supplied system. The counter is informational and can count a damage-button roll separately from its attack. Reset/adjust as needed.
6. **ICE hit points are not a second combat system.** REZ/DEREZ/defeated state is virtual and source Actors remain unchanged by those controls. Damage rolls use CPR; apply character damage or other intended persistent effects through native tools. Native Black ICE Actor damage needs an explicitly linked world Program Item; missing links produce an error rather than guessed damage.
7. **Native architecture round trip is non-destructive but not a floor export.** Native floors are imported, including inferred branches. Review new-lane junctions after import. Link CPR Item stores only a module ID pointer. It does not flatten arbitrary graph edits back into `system.floors` or expose extended graph metadata in world Item flags.
8. **Native random generation is a two-step workflow.** Generate on a native Item using CPR's existing dialog, wait for its floor update, then Import from CPR. The separate weighted generator uses GM-chosen values and is not labeled rules-accurate.
9. **GM private-card history requires an online GM to recover uncached cards.** Player cards are ordinary persistent CPR messages. For GM private cards: Public ChatMessages contain no secret roll content; authorized encrypted cards are retained in the private world pack. Exporting ordinary chat alone exports placeholders. Native CPR chat glyph actions subsequently use native CPR's own posting/privacy behavior. Dice animation visibility follows the native CPR core roll mode; choose a private roll mode if even unlabeled dice must be hidden.
10. **Document permissions remain native.** A player-visible attachment also needs normal Foundry permission. Shared existing Items/Actors can be inspected independently of this module. Already revealed information cannot be revoked from memory. Sharing the private storage pack would defeat its privacy; the module checks and stops when it detects player access.
11. **UI localization and viewport support.** Settings have localization keys; gameplay UI is English. Minimum supported window is 720×480, desktop mouse/keyboard. The node editor scrolls on short windows. No touch-specific gesture support or external PopOut compatibility is claimed.
12. **Host installation depends on custom-module support.** A ZIP-ready folder is supplied. There is no hosted manifest/download URL or auto-update endpoint. The host's absolute data path cannot be inferred from the supplied ZIP.

These are documented scope boundaries, not claims that the live Foundry acceptance tests have passed.

## Optional HTTP compatibility mode

HTTPS remains the default and recommended connection. If your host only provides HTTP:

1. Install NET Architect **0.3.0 or later** on the server.
2. As GM, open **Game Settings → Configure Settings → NET Architect**. This setting is available even if NET Architect reports that synchronization could not start.
3. Enable **HTTP compatibility mode (less secure connection)** and save.
4. **Reload every GM, player, and observer client.** The world setting makes all clients use the same transport, including those connecting through HTTPS.
5. Reopen NET Architect or rejoin the run. To return to default mode, disable the toggle and reload everyone again.

Compatibility mode uses bundled **TweetNaCl.js 1.0.3** (Curve25519/XSalsa20-Poly1305) for encrypted, authenticated module messages. No CDN or plaintext fallback is used. GM authority, discovery filtering, replay rejection, and private card delivery stay in place. Browser `crypto.getRandomValues` remains required; the mode does not depend on `crypto.subtle` or `crypto.randomUUID`.

**HTTP is still less secure:** an interceptor can modify the JavaScript or public-key documents loaded over HTTP, defeating application-level encryption. Foundry login, ordinary chat, and other traffic outside the module transport are not protected by this option. Use HTTPS when available. If you see a transport-mode mismatch after changing the toggle, reload all clients. No server proxy changes are needed to use this option.
