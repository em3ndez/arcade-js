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
 *  Drives the tilemap COLUMN index. Used across 17 routines. Grounded (§2.10). [seen] */
export const PLAYER_X = 0x806b;
```

The tag is the **same evidence class used for routines** (`[seen]`/`[code]`/`[guess]`, defined in
[understanding](understanding.md)) — how we know what the byte is (legend also at the top of ram.js):

- **`[seen]`** — the cell's role was observed under MAME (a grounding capture / control-poke watched the
  address and confirmed what it does).
- **`[code]`** — the role is understood by reading the routines that touch the address — consistent across
  them, but not directly observed. (The common case.)
- **`[guess]`** — a single plausible reading, not yet confirmed; treat as a hint, verify before trusting.
- **keep-hex** — no confident name yet, so *no const is created*: the address stays a bare literal in the
  code rather than wearing a misleading label. (The absence of an entry is itself the signal.)

These consts are **live**: the idiomatic routines `import { PLAYER_X } from "./ram.js"`, so the name is
the actual symbol the code runs on, not a comment. The tag reflects the **consensus across every routine
that touches the address** — never one routine's local view (one routine sees `0x8055` as "a loop count";
the ~18 that stage it reveal `PLOT_RUN_LENGTH`). How broadly a name is corroborated is stated in the
cell's prose ("used across N routines"), not as a separate grade (see [the single vocabulary](#one-confidence-vocabulary-seen--code--guess)).

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

## One confidence vocabulary (`[seen]` / `[code]` / `[guess]`)

RAM cells and routines both carry the **same evidence class** — `[seen]` (observed under MAME), `[code]`
(understood from the code that touches the address), `[guess]` (a hypothesis not yet confirmed) — plus
**keep-hex** for a cell with no confident name (no const is created). One vocabulary, so a cell's
confidence and a routine's confidence mean the same thing and rank the same way, consistent with
`mechanisms.md`'s tags.

**Changed 2026-07-31 (was two vocabularies).** Cells previously carried a separate *identity* grade
(`strong`/`fair`/`weak`) measuring **corroboration breadth** — how many routines agree — while routines
used the evidence cert `code`/`seen`/`guess`. That split answered a real second question (how broadly a
name is corroborated), but two confidence axes for the same kind of claim were inconsistent and could not
be compared. We unified on the **evidence-source** axis (`[seen]`/`[code]`/`[guess]`) because *how* we
know a name is the more meaningful confidence signal, and made it the single system across cells,
routines, and `mechanisms.md`. Breadth is not lost — it stays in the cell's prose ("used across N
routines") — it is just no longer a separate grade. A routine's/cell's `[guess]` is the exact analogue of
keep-hex: an open work-list item, resolved by grounding, never asked of a human. **Every name here is
still a *proposal* until it clears proposer≠confirmer** — see [understanding](understanding.md) "Maintain it as
understanding grows".

## One source per fact — prose must not contradict the registry

`ram.js` is the **single source of truth** for a cell's three facts: its **name**, its **role**, and its
**confidence tag**. Everything else that mentions a cell *cites* it and must not restate or contradict
those facts:

- **`mechanisms.md`** describes the game's *mechanisms* — how cells interact to produce play — and tags
  **mechanism claims** ("the laser fires on press `[seen]`"), NOT individual cells. It refers to a cell
  by its `ram.js` name and carries no per-cell tag that could drift from the registry. (A *behaviour*
  can be `[seen]` while a *cell* it touches is `[code]` — different subjects, so the two tags
  legitimately differ; that is exactly why `mechanisms.md` tags **claims**, not cells.)
- **Routine comments** describe the *routine*. They refer to cells by their imported name and never
  restate registry status — never "0x8083 has no ram.js name / stays hex" for an address `ram.js` names.

This prevents the drift where a fact copied into two independently-edited places goes stale. Three
separate sync bugs on 2026-07-31 traced to exactly it — a `mechanisms.md` tag contradicting `ram.js`, a
stale "backups stay hex" note in `ram.js`, and dozens of routine comments still calling promoted cells
"hex" after they were named.

**Enforced.** `tools/names_consistency.py` is a fail-closed pre-commit gate: it blocks any commit whose
staged prose — in `mechanisms.md` or a routine comment — calls a `ram.js`-named work-RAM address
"unnamed / no ram.js name / stays hex", *unless the same clause also spells the cell's registry name*.
Acknowledging a deliberate raw / different-role use is allowed ("0x8057 is `BOARD_MODE`, reused here as
the plotter fill byte"); a bare false "0x8057 stays hex" is not. The registry wins; the prose follows.
(The gate deliberately does NOT force every reference to a named cell through its const — an address is
sometimes used raw for a genuinely different role, where the registry name would read as a lie.)

## Used two ways

1. **The understanding phase.** A namer resolves any address's established label from this one file
   instead of grepping the port, and the tags **carry between laps** — a later lap sharpens an
   earlier `[guess]` instead of starting cold. Names are *proposed* by the namer/optimizer and
   *gated by a separate reviewer* (proposer ≠ confirmer); the lead edits `ram.js` — proposers never do.
2. **Clean-room external generation.** When we contribute a disassembly to an outside archive, the
   generator may read the raw disassembly, `mechanisms.md`, and **this file's names — and nothing else**
   (never `translated/` or any `idiomatic/*.js`), so no port internals can leak into the public artifact.
   See [contributing a disassembly](contributing-disassembly.md).
