# The names registry — `ram.js`

*One file per game, `games/<game>/idiomatic/ram.js`. It maps an address to a name — for both the
work-RAM cells **and** the ROM routines — and it is the single place either name lives. Nothing else
in the port has to be read to resolve an address to its established label.*

## Why one registry

A name is a fact about the game, recovered once and reused everywhere: the *name* move labels the map,
later laps sharpen the labels, the idiomatic code imports the RAM names as real symbols, and the
clean-room external generator (see [contributing a disassembly](contributing-disassembly.md)) reads
names from here and *nowhere else*. Keeping RAM cells and routine labels in one module means an address
resolves to a name **without grepping the code** — the same lookup serves the understanding phase and
the external artifact.

## Two sections

### RAM cells — `export const`

Each named work-RAM byte (or word) is an `export const`, grouped under `// ── section ──` banners, with
a JSDoc block that says what the cell *is* — who writes it, who reads it, the grounding / `§` evidence —
and ends with a **confidence grade**:

```js
/** Player X (game-space) — work-X at 0x806b, paired with PLAYER_Y; renders screen-VERTICAL under ROT270.
 *  Drives the tilemap COLUMN index. Used across 17 routines. Grounded (§2.10). (strong) */
export const PLAYER_X = 0x806b;
```

The grades (the legend lives at the top of the file):

- **(strong)** — consistent role across 10+ routines, or an unambiguous use.
- **(fair)** — consistent across a few routines; role clear but not cross-checked.
- **(weak)** — a single plausible reading; treat as a hint, verify before trusting.
- **keep-hex** — no confident name yet, so *no const is created*: the address stays a bare literal in the
  code rather than wearing a misleading label. (The absence of an entry is itself the signal.)

These consts are **live**: the idiomatic routines `import { PLAYER_X } from "./ram.js"`, so the name is
the actual symbol the code runs on, not a comment. A grade is about the *identity* of the byte, and it is
decided by the **consensus across every routine that touches the address** — never by one routine's local
view (one routine sees `0x8055` as "a loop count"; the ~18 that stage it reveal `PLOT_RUN_LENGTH`).

### Routines — the `ROUTINES` map

Every named ROM routine is one entry in a single exported map, keyed by its entry address:

```js
export const ROUTINES = {
  0x0066: { name: "serviceVblankNmi",
            role: "vblank NMI — the per-frame service (input debounce, sound-ring drain, sprite DMA, coin/credit watchdog, /60 timers)",
            cert: "code" },
  // ...169 entries
};
```

- **name** — the routine's gameplay name. It **mirrors the `idiomatic/<name>.js` filename**, which is the
  source of truth for the name; regenerate the map entry whenever a routine is renamed.
- **role** — one line on what the routine does (its *mechanism*, not its implementation).
- **cert** — the evidence class for that role: **code** (understood by reading the routine), **seen**
  (observed executing — attract or a grounding tape drove it and it did this), **guess** (a hypothesis not
  yet confirmed — the one still-open item).

Unlike the RAM consts, `ROUTINES` is **metadata, not imported by the running code** — the routines call
each other directly by function name. It is a lookup table for tooling and for the two uses below.

## Two confidence vocabularies, on purpose

RAM cells carry an *identity* grade (strong / fair / weak / keep-hex — how sure we are **what the byte
is**); routines carry an *evidence* cert (code / seen / guess — **how we know what the routine does**).
They answer different questions, so they use different words. A routine's `guess` is the exact analogue
of a RAM cell's keep-hex: an open item on the work-list, to be resolved by grounding — never asked of a
human, only grounded or left flagged.

## Used two ways

1. **The understanding phase.** A namer resolves any address's established label from this one file
   instead of grepping the port, and the grades/certs **carry between laps** — a later lap sharpens an
   earlier `(weak)` / `guess` instead of starting cold. Names are *proposed* by the namer/optimizer and
   *gated by a separate reviewer* (proposer ≠ confirmer); the lead edits `ram.js` — proposers never do.
2. **Clean-room external generation.** When we contribute a disassembly to an outside archive, the
   generator may read the raw disassembly, `mechanisms.md`, and **this file's names — and nothing else**
   (never `translated/` or any `idiomatic/*.js`), so no port internals can leak into the public artifact.
   See [contributing a disassembly](contributing-disassembly.md).
