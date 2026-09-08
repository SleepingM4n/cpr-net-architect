# NET Architect

Interactive **Cyberpunk RED NET Architectures** for **Foundry VTT 12.343** and **Cyberpunk RED – CORE v0.92.4**. Explore a branching network in a synchronized popup while the Netrunner's physical Token stays on the tactical Scene.

[Download the latest release](https://github.com/SleepingM4n/cpr-net-architect/releases/latest) · [Simple manual](docs/QUICK-START.md) · [Detailed reference](docs/REFERENCE.md) · [Report an issue](https://github.com/SleepingM4n/cpr-net-architect/issues)

## What it does

- **Build branching architectures:** visual editor, drag/zoom/pan, custom nodes, connections, JSON import/export, and reusable saved networks.
- **Explore together:** player Jack In, separate virtual movement, hidden nodes, discovery, challenge DVs, retries, and success/failure feedback.
- **Let the player roll:** native CPR Interface and Program dialogs run on the player's client, with ordinary CPR results in chat. The GM applies challenge outcomes.
- **Collect and read:** take shared Item attachments into the runner's sheet and read permitted journal text and images inside the popup.
- **Run encounters:** installed Cyberdeck Programs, REZ/DEREZ, virtual Black ICE/Demon encounter state, native rolls, and a manual NET Action counter.
- **Keep GM control:** reveal/hide/clear nodes, move the runner, broadcast to selected observers, reset/end runs, and reconnect to persisted sessions.
- **Connect to the physical map:** configured doors, lights, sounds, Tiles, Tokens, and explicitly approved Macros.
- **Choose a look:** RED and neon themes, sound/effect options, and reduced motion.

## Example video

Watch the supplied gameplay demonstration:

[NET Architect example video](https://github.com/SleepingM4n/cpr-net-architect/releases/download/v0.2.1/net-architect-demo.mp4)

## Install

In Foundry Setup, open **Add-on Modules → Install Module**, paste this manifest URL, and install:

```text
https://github.com/SleepingM4n/cpr-net-architect/releases/latest/download/module.json
```

Enable **NET Architect** in your CPR world's **Manage Modules**, then reload every client. On a hosting service, use its custom manifest installer; alternatively extract the release ZIP so the final path is `Data/modules/cpr-net-architect/module.json`. Connect through HTTPS.

## Before playing: configure NET points

> **Required setup:** set NET points usage before entering the Architecture. In the hosted setup used for the demonstration, leaving this unconfigured prevents the player from doing anything in the Architecture. Set the runner's NET Action budget when starting the run, or use **Set / Reset Budget** in the GM view. See the [setup steps](docs/QUICK-START.md#1-prepare-the-runner-and-net-points).

## First run

1. Give the player ownership of their Character. Configure its active NET Role, Cyberdeck, and installed Programs in CPR.
2. Open **NET Architect** from the Token controls or Settings sidebar. Import `examples/kiroshi-warehouse.json` or create a network.
3. Add your world's ICE, Items, journals, and controls, then save. Share player attachments and grant native document permissions.
4. Choose **START NETRUN**, select the runner, configure NET points/NET Action usage, and have the player press **JACK IN**.
5. Select an adjacent signal, **ATTEMPT ACCESS**, roll, and then **MOVE HERE** after resolving it. At a cleared current node, **Take Item** collects rewards; **Read** opens a journal in the popup.
6. **JACK OUT** ends the run. Closing the window only closes that user's view.

## Compatibility and scope

Version **0.2.1** targets the exact versions above. No mandatory extra module or build step is required. One active NETRUN per world is supported. An active GM is required to authorize actions. The module's NET Action counter is bookkeeping; it does not itself enforce an action allowance.

Player rolls use CPR and ordinary Foundry client dice trust. Automatic opposed combat, Pathfinder breadth, ICE AI/pursuit, unsafe Jack Out damage, and virtual ICE damage application remain GM-adjudicated. See [known limitations](docs/KNOWN-LIMITATIONS.md).

The prior build passed **36 automated tests** and browser UI checks using mocked Foundry services. The author supplied the demonstration video; the development environment has not independently validated a live hosted multiplayer session. See the [hosted checklist](docs/TEST-CHECKLIST.md).

## Development

```sh
node --test tests/*.test.js
node tests/check.mjs
```

No npm install is required. Code is provided under the [MIT license](LICENSE). This independent community module does not bundle Cyberpunk RED rules, the CPR system, or Foundry VTT software. The demonstration video is user-supplied; game content shown remains the property of its respective owners.
