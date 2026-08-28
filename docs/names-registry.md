# The names registry — `names.js`

*One file per game, `games/<game>/idiomatic/names.js`. It maps an address to a name — for both the
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
[understanding](understanding.md)) — how we know what the byte is (legend also at the top of names.js):

- **`[seen]`** — the cell's role was observed under MAME (a grounding capture / control-poke watched the
  address and confirmed what it does).
- **`[code]`** — the role is understood by reading the routines that touch the address — consistent across
  them, but not directly observed. (The common case.)
- **`[guess]`** — a single plausible reading, not yet confirmed; treat as a hint, verify before trusting.
- **`loc_<addr>` placeholder** — no confident name yet, so the cell is exported as a `loc_<addr>`
  placeholder const (allowlisted in `tools/names-debt.txt`) rather than wearing a misleading descriptive
  label. The placeholder itself is the signal that the role is still pending.

These consts are **live**: the idiomatic routines `import { PLAYER_X } from "./names.js"`, so the name is
the actual symbol the code runs on, not a comment. The tag reflects the **consensus across every routine
that touches the address** — never one routine's local view (one routine sees `0x8055` as "a loop count";
the ~18 that stage it reveal `PLOT_RUN_LENGTH`). How broadly a name is corroborated is stated in the
cell's prose ("used across N routines"), not as a separate grade (see [the single vocabulary](#one-confidence-vocabulary-seen--code--guess)).

**A cell's IDENTIFIER tracks its confidence — and it is never a bare hex literal.** An idiomatic RAM
cell is exported as an `export const` in one of two forms: a **descriptive** name once its reading is
understood, or a **`loc_<addr>` placeholder** while it is not (a `[guess]`/not-yet-understood cell),
allowlisted in `tools/names-debt.txt`. The placeholder clears the raw-hex cruft and marks the role
pending; every reference goes through the named import, so the registry stays the single source even for
an unknown cell. The descriptive name is earned at the **`[guess]`→`[code]` transition**: as soon as the
reading is confident enough to be `[code]`, rename the const from `loc_<addr>` to the descriptive name and
update every importer — value-identical, the address is unchanged. Grounding (`[code]`→`[seen]`) then only
confirms or overturns that name; it does not first bestow it. So **both `[code]` and `[seen]` cells must
be descriptively named** (`loc_<addr>` is never valid for a `[code]`/`[seen]` cell); only
`[guess]`/unknown stays `loc_<addr>`. A `[code]`-or-`[seen]` cell still exported as `loc_<addr>` is a
half-finished job: the tag claims we know what the byte is while the symbol the code runs on still says we
don't. (See the runbook's rule "A cell earns its DESCRIPTIVE identifier the moment it reaches `[code]`";
enforced mechanically by the `names_consistency` gate — which fails any new `loc_` cell not in
`names-debt.txt` — and at review by reviewer-rules R31.)

### Routines — the `ROUTINES` map

Every named ROM routine is one entry in a single exported map, keyed by its entry address:

```js
export const ROUTINES = {
  0x0066: { name: "serviceVblankNmi",
            role: "vblank NMI — the per-frame service (input debounce, sound-ring drain, sprite DMA, coin/credit watchdog, /60 timers)",
            cert: "code",
            why: "its caller is the main loop's vblank-poll yield, and suppressing it stops sprite DMA — a service name predicts that, a compute name does not" },
  // ...169 entries
};
```

- **name** — the routine's gameplay name. It **mirrors the `idiomatic/<name>.js` filename**, which is the
  source of truth for the name; regenerate the map entry whenever a routine is renamed.
- **role** — one line on what the routine does (its *mechanism*, not its implementation).
- **cert** — the evidence class for that role: **code** (understood by reading the routine), **seen**
  (observed executing UNDER MAME — a grounding run or tape drove it on the real ROM and it did
  this; a count from our own harness is **code**, see reviewer-rules R3a), **guess** (a hypothesis not
  yet confirmed — the one still-open item).
- **why** — required on a routine whose name was PROMOTED from `loc_<addr>` to English: one line
  naming the evidence outside the routine that could have refuted the name and did not (the caller's
  use of the result, a write-set diff, a sibling, a `mechanisms.md` mechanism). Absent on entries
  still named `loc_<addr>`, since there is no promotion to justify.

  **Required on each promotion FROM the commit that introduced this field onward, not
  retroactively.** Names promoted before it exist without a `why`, and that is not a defect to be
  swept: their corroboration was checked at the time under the older rule. Re-deriving it wholesale
  would mean re-doing every past naming pass from memory, which is how invented evidence gets
  written down. A later pass that re-derives a name adds the field then. Do not read a missing
  `why` on an old entry as a rule violation — see reviewer-rules R5, which is scoped to the
  promotions in the commit under review.

  It never leaves the port: the clean-room generator reads `name` and `role` only (see below).

  It lives here and not in the routine's file header because reviewer-rules **R21** forbids an
  idiomatic header from naming a caller, a sibling, `mechanisms.md` or the oracle — which is every
  form this evidence takes. The registry is the one place cross-file facts belong, so a promoted
  name and its justification sit together instead of in two files. Reviewer-rules **R5** is what
  requires it; `role` stays one line about the mechanism and does not absorb this.

Unlike the RAM consts, `ROUTINES` is not imported by the routines themselves — they call each other
directly by function name. It is not inert metadata, though: **it is the wiring.** Each game's
`resolveAllIdiomatic` walks this map to build the override map the machine dispatches through, so an
address no entry here names is never overridden: every dispatch to it runs the frozen oracle, and
the rewrite is reached only by a sibling that imports it directly. Its own equivalence gate stays
green either way. An entry is wiring and not yet execution, though: the player calls
`resolveAllIdiomatic` only where `manifest.runtime` is `"idiomatic"`, so a fully-wired layer in a
game declared `"translated"` runs nowhere. The entry ships in the same unit as the module — see
[idiomatic generation](idiomatic-generation.md), *How a routine joins the layer*, and reviewer-rules
**R22**. It is also the lookup table for tooling and for the two uses below.

## One confidence vocabulary (`[seen]` / `[code]` / `[guess]`)

RAM cells and routines both carry the **same evidence class** — `[seen]` (observed under MAME), `[code]`
(understood from the code that touches the address), `[guess]` (a hypothesis not yet confirmed) — plus a
**`loc_<addr>` placeholder** const for a cell with no confident name yet (allowlisted in
`tools/names-debt.txt`). One vocabulary, so a cell's
confidence and a routine's confidence mean the same thing and rank the same way, consistent with
`mechanisms.md`'s tags.

Breadth is not lost — it stays in the cell's prose ("used across N
routines") — it is just no longer a separate grade. A routine's/cell's `[guess]` is the exact analogue of
a `loc_<addr>` placeholder: an open work-list item, resolved by grounding, never asked of a human. **Every name here is
still a *proposal* until it clears proposer≠confirmer** — see [understanding](understanding.md) "Maintain it as
understanding grows".

## One source per fact — prose must not contradict the registry

`names.js` is the **single source of truth** for a cell's three facts: its **name**, its **role**, and its
**confidence tag**. Everything else that mentions a cell *cites* it and must not restate or contradict
those facts:

- **`mechanisms.md`** describes the game's *mechanisms* — how cells interact to produce play — and tags
  **mechanism claims** ("the laser fires on press `[seen]`"), NOT individual cells. It refers to a cell
  by its `names.js` name and carries no per-cell tag that could drift from the registry. (A *behaviour*
  can be `[seen]` while a *cell* it touches is `[code]` — different subjects, so the two tags
  legitimately differ; that is exactly why `mechanisms.md` tags **claims**, not cells.)
- **Routine comments** describe the *routine*. They refer to cells by their imported name and never
  restate registry status — never "0x8083 has no names.js name / stays hex" for an address `names.js` names.

This prevents the drift where a fact copied into two independently-edited places goes stale.

**Enforced.** `tools/names_consistency.py` is a fail-closed pre-commit gate: it blocks any commit whose
staged prose — in `mechanisms.md` or a routine comment — calls a `names.js`-named work-RAM address
"unnamed / no names.js name / stays hex", *unless the same clause also spells the cell's registry name*.
Acknowledging a deliberate raw / different-role use is allowed ("0x8057 is `BOARD_MODE`, reused here as
the plotter fill byte"); a bare false "0x8057 stays hex" is not. The registry wins; the prose follows.
(The gate deliberately does NOT force every reference to a named cell through its const — an address is
sometimes used raw for a genuinely different role, where the registry name would read as a lie.)

## Used two ways

1. **The understanding phase.** A namer resolves any address's established label from this one file
   instead of grepping the port, and the tags **carry between laps** — a later lap sharpens an
   earlier `[guess]` instead of starting cold. Names are *proposed* by the namer/optimizer and
   *gated by a separate reviewer* (proposer ≠ confirmer); the lead edits `names.js` — proposers never do.
2. **Clean-room external generation.** When we contribute a disassembly to an outside archive, the
   generator may read the raw disassembly, `mechanisms.md`, and from this file **the names and roles
   only — never `why` or `cert`** (and never `translated/` or any `idiomatic/*.js`), so no port
   internals can leak into the public artifact. `why` and `cert` are about how WE earned a name;
   they describe the port, not the machine, and an outside archive must not receive them.
   See [contributing a disassembly](contributing-disassembly.md).
