# NET Architect

**New in 0.5.0:** configurable login names, multiple NPC Netrunner/Demon placements and movement, two-line node names, and a window-focus fix. See the [new controls and testing guide](docs/LOCAL-TEST-0.5.0.md).

Interactive **Cyberpunk RED NET Architectures** for **Foundry VTT 12.343** and **Cyberpunk RED – CORE v0.92.4**. Explore a branching network in a synchronized popup while the Netrunner's physical Token stays on the tactical Scene.

[Download the latest release](https://github.com/SleepingM4n/cpr-net-architect/releases/latest) · [Simple manual](docs/QUICK-START.md) · [Detailed reference](docs/REFERENCE.md) · [Report an issue](https://github.com/SleepingM4n/cpr-net-architect/issues)

## What it does

- **Build branching architectures:** visual editor, drag/zoom/pan, custom nodes, connections, JSON import/export, and reusable saved networks.
- **Explore together:** player Jack In, separate virtual movement, hidden nodes, discovery, challenge DVs, retries, and success/failure feedback.
- **Let the player roll:** native CPR Interface and Program dialogs run on the player's client, with ordinary CPR results in chat. The GM applies challenge outcomes.
- **Collect and read:** take shared Item attachments into the runner's sheet and read permitted journal text and images inside the popup.
- **Fight inside the module:** runner/ICE targeting, native attack/defense/damage rolls, and a combat log where the GM confirms hits and applies final damage.
- **Customize and move Black ICE:** encounter-only stats, REZ and Program copies; GM movement along the architecture connections. Source Actors and Items stay unchanged.
- **Control visibility and access:** distant node markers with connections shown only at the current adjacent node; per-node bypass allows travel without cracking or unlocking rewards.
- **Keep GM control:** reveal/hide/clear nodes, move the runner, broadcast to selected observers, reset/end runs, and reconnect to persisted sessions.
- **Connect to the physical map:** configured doors, lights, sounds, Tiles, Tokens, and explicitly approved Macros.
- **Choose a look:** RED and neon themes, sound/effect options, and reduced motion.

## Example video

Watch the supplied gameplay demonstration:

https://github.com/user-attachments/assets/fb701afc-f862-4879-9e79-399366e65a26

[NET Architect example video](https://github.com/SleepingM4n/cpr-net-architect/releases/download/v0.2.1/net-architect-demo.mp4)

## Install

In Foundry Setup, open **Add-on Modules → Install Module**, paste this manifest URL, and install:

```text
https://github.com/SleepingM4n/cpr-net-architect/releases/latest/download/module.json
```

Enable **NET Architect** in your CPR world's **Manage Modules**, then reload every client. On a hosting service, use its custom manifest installer; alternatively extract the release ZIP so the final path is `Data/modules/cpr-net-architect/module.json`. Connect through HTTPS, or explicitly enable the optional HTTP compatibility mode below.

## Before playing: configure NET points

> **Required setup:** set NET points usage before entering the Architecture. In the hosted setup used for the demonstration, leaving this unconfigured prevents the player from doing anything in the Architecture. Set the runner's NET Action budget when starting the run, or use **Set / Reset Budget** in the GM view. See the [setup steps](docs/QUICK-START.md#1-prepare-the-runner-and-net-points).

## First run

1. Give the player ownership of their Character. Configure its active NET Role, Cyberdeck, and installed Programs in CPR.
2. Open **NET Architect** from the Token controls or Settings sidebar. Import `examples/kiroshi-warehouse.json` or create a network.
3. Add your world's ICE, Items, journals, and controls, then save. Share player attachments and grant native document permissions.
4. Choose **START NETRUN**, select the runner, configure NET points/NET Action usage, and have the player press **JACK IN**.
5. Select an adjacent signal, **ATTEMPT ACCESS**, roll, and then **MOVE HERE** after resolving it. At a cleared current node, **Take Item** collects rewards; **Read** opens a journal in the popup.
6. Open **NET COMBAT** to target nearby ICE, roll attacks and defenses, and let the GM confirm hits and apply final damage. See the [combat manual](docs/QUICK-START.md#5-programs-ice-and-net-combat).
7. **JACK OUT** ends the run. Closing the window only closes that user's view.

## Compatibility and scope

Version **0.5.0** targets the exact versions above. No mandatory extra module or build step is required. One active NETRUN per world is supported. An active GM is required to authorize actions. The module's NET Action counter is bookkeeping; it does not itself enforce an action allowance.

Player rolls use CPR and ordinary Foundry client dice trust. NET Combat applies the final damage entered by the GM to encounter REZ or the runner’s real HP/Program REZ. Hit decisions, reductions, special effects, action economy, Pathfinder breadth, ICE pursuit and unsafe Jack Out remain GM-adjudicated. See [known limitations](docs/KNOWN-LIMITATIONS.md).

This build passed **54 automated tests** and browser UI checks using mocked Foundry services. The author supplied the demonstration video; the development environment has not independently validated a live hosted multiplayer session. See the [hosted checklist](docs/TEST-CHECKLIST.md).

## Development

```sh
node --test tests/*.test.js
node tests/check.mjs
```

No npm install is required. Code is provided under the [MIT license](LICENSE). This independent community module does not bundle Cyberpunk RED rules, the CPR system, or Foundry VTT software. The demonstration video is user-supplied; game content shown remains the property of its respective owners.

## Optional HTTP compatibility mode

HTTPS remains the default and recommended connection. If your host only provides HTTP:

1. Install NET Architect **0.3.0 or later** on the server.
2. As GM, open **Game Settings → Configure Settings → NET Architect**. This setting is available even if NET Architect reports that synchronization could not start.
3. Enable **HTTP compatibility mode (less secure connection)** and save.
4. **Reload every GM, player, and observer client.** The world setting makes all clients use the same transport, including those connecting through HTTPS.
5. Reopen NET Architect or rejoin the run. To return to default mode, disable the toggle and reload everyone again.

Compatibility mode uses bundled **TweetNaCl.js 1.0.3** (Curve25519/XSalsa20-Poly1305) for encrypted, authenticated module messages. No CDN or plaintext fallback is used. GM authority, discovery filtering, replay rejection, and private card delivery stay in place. Browser `crypto.getRandomValues` remains required; the mode does not depend on `crypto.subtle` or `crypto.randomUUID`.

**HTTP is still less secure:** an interceptor can modify the JavaScript or public-key documents loaded over HTTP, defeating application-level encryption. Foundry login, ordinary chat, and other traffic outside the module transport are not protected by this option. Use HTTPS when available. If you see a transport-mode mismatch after changing the toggle, reload all clients. No server proxy changes are needed to use this option.
