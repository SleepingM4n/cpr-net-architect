# Delivery report — NET Architect 0.2.0

## Files delivered

The complete `cpr-net-architect/` folder contains `module.json`, ES module source under `scripts/`, Handlebars templates, four CSS files, `lang/en.json`, an MIT license, README, changelog, a Kiroshi Warehouse JSON example, source-integration documentation, known limitations, automated tests, a local browser harness, and a hosted acceptance checklist. The accompanying ZIP contains this folder at its root.

The user's CPR source ZIP was inspected separately and is **not** distributed. No CPR system files were modified. The local `.reference/` folder is ignored by Git.

## Verified CPR contracts

- Native architecture Item type `netarch`; floors contain `index`, `floor`, `branch`, `content`, `dv`, `blackice`, `description`. Native ICE floor references are localization keys rather than UUIDs.
- `actor.system.roleInfo.activeNetRole` selects an embedded Role Item; `role.system.rank` and `mainRoleAbility` provide Interface capability.
- `cyberdeck.createRoll('interfaceAbility', actor, {interfaceAbility,cyberdeck,netRoleItem})` provides native Interface rolls and modifiers. Roll results use `resultTotal`, `initialRoll`, `wasCritSuccess()`, and `wasCritFail()`.
- Cyberdeck `getInstalledItems('program')`; Program `setRezzed()` and `system.isRezzed`; native `cyberdeckProgram` rolls for attacks, defense and damage.
- `blackIce` Actor `createStatRoll()` and `createDamageRoll()`; `demon` Actor `createStatRoll('interface'/'combatNumber')`.
- Public `game.cpr.api` contains Actor EMP helpers in this release, with no Netrunning facade. Necessary internal imports are isolated in the adapter. See the full source-path audit in `CPR-INTEGRATION.md`.

## Implemented

Private persistent library; visual branching graph editor; JSON validation/import/export; native CPR import and non-destructive linking; editable weighted generator and native table-generator entry; animated player Jack In; virtual position and fogged discovery; GM controls; selected/everyone/runner-only viewing; observers/rejoin; authenticated encrypted synchronization; session snapshots and reconnect; native CPR checks and private native chat cards; installed Programs; virtual ICE/Demon activation and native rolls; combat context/manual action counter; validated physical door/Tile/Token/light/sound/Macro controls; RED/neon themes; reduced motion, effects, tones, settings, errors, API and hooks.

## Intentionally deferred

Full rules adjudication for Pathfinder, opposed NET combat, Demon AI, unsafe Jack Out damage, ICE pursuit and virtual HP damage application; automatic Character NET Action derivation; arbitrary graph export to native floors; multiple simultaneous NETRUNs; full UI localization. These are described in `KNOWN-LIMITATIONS.md`. Player roll confirmation now occurs on the player client; GM rolls remain on the authority. Shared Item pickup and an inline journal reader are included.

## Validation and known issues

**36 automated tests passed**, including a v12-shaped startup mock, schema/topology, a 50-node/100-edge graph, native adapter invocation, strict DV comparisons, failure/retry/movement, observer authorization, forged totals, encrypted transport/tampering/replay, private chat data, control-action restrictions, GM approval enforcement, missing Documents, and defeated ICE persistence. Syntax, local import paths, JSON and manifest assets passed checks across **31 JavaScript files**.

Browser harness checks confirmed library rendering, selecting and saving a node edit, graph/fog rendering, explicit login-to-run transition, observer read-only controls, local Stop Viewing, and both themes. The harness uses mocked Foundry services. **Hosted Foundry v12.343 startup and real multiplayer/native-roll behavior have not been executed here**, so hosted acceptance testing is still required for this update rather than certified production compatibility.

## Installation and exact manual procedure

The host-relative manifest path must be **`Data/modules/cpr-net-architect/module.json`**. Upload/extract the ZIP using the hosting service's custom-module facilities, restart Foundry, enable the module in the CPR world, and reload all clients over HTTPS. The provider's absolute server filesystem path is unknown.

Follow README's **First run: Kiroshi Warehouse** procedure: import example → attach native ICE/Program and Journal → link the physical Wall door → save/export → reload → Start Netrun with configured player Actor → player Jack In → resolve Password via native GM confirmation → move → REZ/attack ICE → clear and occupy Control → open physical door → Jack Out. Verify the physical Token never changed Scene or position. Run all detailed cases in `TEST-CHECKLIST.md`, including the separate outsider account's data-inspection checks.
