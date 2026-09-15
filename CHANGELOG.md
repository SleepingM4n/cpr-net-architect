# 0.5.1

- Reacquire current compendium documents before saving, avoiding stale storage references after long editing sessions.
- Read back the stored architecture and verify its contents before reporting success.
- Serialize saves to prevent overlapping writes and duplicate entries from the same client.
- Preserve edits made while a save is pending, and keep them marked unsaved.
- Keep failed saves open with a persistent error and allow retrying Save Architecture.
- Read node fields from the displayed node's ID to avoid applying them to another node during selection changes.
- Add seven save regression tests; all 61 automated tests pass. Hosted Foundry testing is still required.

# 0.5.0

- Rename the login datafort heading with the architecture name; blank names default to Night City Datafort.
- Add multiple NPC Netrunner and Demon Actor placements to templates or live runs, with independent connected movement and GM visibility controls.
- Persist placements through reconnects and support import/export, duplication and reset.
- Wrap node names to two lines.
- Preserve the front window during synchronized NETRUN/NET Combat updates and preserve panel scrolling.
- Publish the module ZIP, installation manifest, checksum and updated manual on GitHub.

# 0.4.0

- Always-visible node markers with connections limited to the runner's current incident edges.
- Template and live GM bypass toggles: pass through without cracking or unlocking rewards/controls.
- NET Combat popup with mutual targeting, native player/ICE rolls and GM-confirmed hits and final damage.
- Encounter-only Black ICE stats, current/max REZ and copied Programs; original Actors and Items unchanged.
- GM-controlled ICE movement along graph connections, persisted positions and target clearing.
- Apply confirmed damage to encounter REZ or real runner HP/Program REZ, with duplicate-application protection.
- Preserve player chat rolls, Item pickup, inline journals and optional HTTP compatibility.
- Restore legacy ICE safely; extend automated tests and manual hosted acceptance checks.

# 0.3.0

- Add a GM-only world HTTP compatibility toggle, off by default and requiring all clients to reload.
- Bundle TweetNaCl.js for encrypted, authenticated synchronization without HTTPS-only WebCrypto APIs; retain the default AES-GCM transport when disabled.
- Generate secure UUIDs on HTTP using crypto.getRandomValues.
- Give actionable startup and mode-mismatch errors; document connection limitations and setup.
- Preserve existing NET gameplay, GM controls, discovery filtering and private chat delivery.

# 0.2.1

- GitHub distribution manifest and release download URLs.
- Capabilities overview, simple manual, and demonstration video link.
- Prominent hosted NET points setup guidance.
- Corrected outdated start-dialog text about player roll dialogs.
- Gameplay behavior unchanged from 0.2.0.

# 0.2.0

- Player-side native Interface and Program roll dialogs with ordinary CPR chat cards.
- One-use GM roll grants, chat-author verification, cancellation, and private DV resolution.
- Take shared Item attachments into the runner sheet once per run; preserve source Items.
- Read permitted journal text and image pages inside the NET popup.
- Existing architecture data, GM controls, discovery, and virtual movement preserved.

# Changelog

## 0.1.0 — 2026-09-07

- Inspected supplied CPR v0.92.4 source and documented native architecture, Role, Interface, Cyberdeck, Program, Black ICE, Demon, generator, and hook contracts.
- Added private architecture library, validated versioned JSON, stable IDs, duplication, native CPR import, pointer linking, and editable weighted generation.
- Added branching SVG graph editor with node dragging, pan/zoom/Fit, auto-layout, challenge forms, UUID attachments, and control actions.
- Added explicit animated Jack In, virtual runner position, discovery filtering, read-only observers, broadcasts, rejoin, reset, and Jack Out.
- Added GM-authoritative requests with per-user authenticated encryption, replay/stale-state checks, and private world compendium persistence.
- Added native CPR roll integration, private native chat cards, Program controls, ICE/Demon roll controls, combat context, and manual NET Action budget.
- Added validated door/Tile/Token/light/sound/Macro automation.
- Added original RED and neon themes, scoped success/failure effects, generated tones, reduced motion and client settings.
- Added automated tests, a browser UI harness, Kiroshi Warehouse example, hosting installation guide, and manual acceptance checklist.
