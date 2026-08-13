# Donkey Kong (Nintendo, 1981) — How It Works Inside

> **What this document is.** The *inside-out* companion to [`gameplay.md`](gameplay.md). That file
> is the day-zero, outside-in view — how Donkey Kong is *played*, from public sources, with no ROM
> opened. This one is how the machine *works*, re-derived from what is in this checkout: the
> readable routines in `idiomatic/`, the registries in [`idiomatic/names.js`](idiomatic/names.js), the
> frozen per-instruction oracle in `translated/`, the raw image `rom/maincpu.bin`, the hardware
> layer in [`boards/dkong/`](../../boards/dkong/), and the MAME grounding runs whose raw outputs
> are in `scratchpad/`.
>
> **`gameplay.md` is the frame.** Every section is reconciled against it — agreeing, sharpening,
> or contradicting it. Where the two disagree, the disagreement is stated.
>
> **This file is rewritten whole after every understanding pass, never patched.** It is the one
> document in the port allowed to hold cross-file facts (reviewer-rules R21), which is exactly why
> it cannot be amended: a patch preserves whatever was already wrong. See
> [`docs/understanding.md`](../../docs/understanding.md) step 7. Every number below was produced
> against this working tree while writing, with the command or the artifact that produced it named
> beside it.
>
> **Confidence tags are on CLAIMS, not on cells.** Each non-obvious claim carries:
> - **`[seen]`** — the evidence chain TERMINATES in an observation of the real ROM under MAME: a
>   control-poke, an A/B with a negative control, a read/write tap, or a captured frame. Our
>   renderer may be *in* the chain (a pixel diff against a MAME golden stays `[seen]`); what
>   matters is what produced the reference.
> - **`[code]`** — read out of the ROM image, the frozen oracle, or a decompiled routine. The
>   mechanics are exact; the role is inference from them. **A number whose chain ends in our own
>   output lives here too** — a dispatch count from `new Machine(ROM).runFrames(...)`, or any
>   idiomatic-vs-oracle equality, is this port replaying the ROM. Those are written
>   "**harness replay**", never "attract run", so the provenance cannot be misread.
> - **`[guess]`** — plausible, unverified. Never to be relied on.
>
> **What this file does NOT own.** A work-RAM cell's name, role and confidence live in exactly one
> place — `idiomatic/names.js` — and a routine's one-line role lives in that file's `ROUTINES` map.
> This document describes *mechanisms*, cites cells and routines by their registry names, and never
> restates or contradicts a registry entry. The boundary is enforced by
> `tools/names_consistency.py` (see [`docs/names-registry.md`](../../docs/names-registry.md),
> "One source per fact").

---

## 1. Measured state of the port

Everything here was produced by running the command beside it against this working tree. Re-run
them before quoting any of it.

| Metric | Count |
|---|---:|
| ROM routines in the frozen `translated/` oracle (`loc_XXXX.js`) | **429** |
| — of which have a readable `idiomatic/` module | **429 (100%)** |
| Addresses registered in `ROUTINES` (`idiomatic/names.js`), and therefore wired live | **406** |
| — carrying an earned English name | 327 |
| — still address-named `loc_XXXX` | 79 |
| Idiomatic modules written but **not** registered in `ROUTINES` | **23** |
| `ROUTINES` confidence split | 368 `code` / 38 `seen` / 0 `guess` |
| `export const` entries in `names.js` | **184** |
| — work-RAM cells (inside 0x6000–0x6BFF) | 168 |
| — object/sprite **record field offsets** (not addresses) | 16 |
| `names.js` tag census | 137 `[seen]` / 47 `[code]` / 0 `[guess]` |
| Per-routine memory-equivalence tests | 427 |

```sh
# routine coverage, registry split, and the unregistered list
node --input-type=module -e '
const fs=await import("node:fs"); const {ROUTINES}=await import("./games/dkong/idiomatic/names.js");
const T=fs.readdirSync("games/dkong/translated").filter(f=>/^loc_[0-9a-f]{4}\.js$/.test(f));
const I=new Set(fs.readdirSync("games/dkong/idiomatic").filter(f=>f.endsWith(".js")));
const have=T.filter(f=>{const a=parseInt(f.slice(4,8),16);return I.has(f)||(ROUTINES[a]&&I.has(ROUTINES[a].name+".js"));});
const cert={}; for(const r of Object.values(ROUTINES)) cert[r.cert]=(cert[r.cert]||0)+1;
const eng=Object.values(ROUTINES).filter(r=>!/^loc_/.test(r.name)).length;
const reg=new Set(Object.values(ROUTINES).map(r=>r.name));
console.log("translated",T.length,"idiomatic",have.length,"ROUTINES",Object.keys(ROUTINES).length,
  "english",eng,"loc_",Object.keys(ROUTINES).length-eng,JSON.stringify(cert));
console.log("unregistered:", fs.readdirSync("games/dkong/idiomatic")
  .filter(f=>/^loc_[0-9a-f]{4}\.js$/.test(f)&&!reg.has(f.slice(0,-3))).map(f=>f.slice(4,8)).join(" "));'
# named work-RAM cells, using the names-consistency gate's own definition of "named"
python3 -c 'import sys;sys.path.insert(0,"tools");import names_consistency as n;
print(len(n.named_workram(open("games/dkong/idiomatic/names.js").read(), n.workram_window("dkong"))))'
```

*(The tag census counts each `export const`'s own comment. `OBJ_WALK_PTR_HI` has no comment of its
own — it is rated by the block it shares with its `_LO` twin, and is counted `[seen]` above.)*

### The honest floor

Three things are true at once, and only the first is "done":

1. **Lifting is complete.** All 429 ROM routines the disassembler emits have a readable module,
   and 427 have their own memory-equivalence gate against the frozen oracle. The two without are
   `boot` (ROM 0x0000) and `mainLoop` (ROM 0x02BD) — the coroutine spine, gated whole by
   `idiomatic/test/idiomatic.test.js` instead. `[code]`

2. **Wiring is not.** `resolveAllIdiomatic()` — what the shipping player uses (`manifest.js`
   declares `runtime: "idiomatic"`, and `web/worker.js` runs it under `runIdiomaticGame`) — builds
   its override map by iterating `ROUTINES` and nothing else (`games/dkong/machine.js:1107`).
   Registration *is* the wiring. The 31 modules absent from `ROUTINES` are therefore not executed:
   at those addresses the live machine still runs the frozen oracle. They are written, reviewed and
   gated; they are not live. `[code]`

   They are five clusters, each blocked on the same registration step:

   | cluster | addresses |
   |---|---|
   | the 25m barrel machine's remaining interior (20) | `0x1F72`, `0x1F8D`, `0x1FAC`, `0x1FCE`, `0x202F`, `0x2038`, `0x2053`, `0x2079`, `0x2083`, `0x20A2`, `0x20B5`, `0x20C3`, `0x20E1`, `0x20EC`, `0x2101`, `0x2104`, `0x2118`, `0x2146`, `0x2153`, `0x215F` |
   | the five-slot fire pass (3) | `0x31B1`, `0x3202`, `0x333D` |
   | the airborne-frame resolver and its object-collision follow-up (3) | `0x1C05`, `0x29AF`, `0x2B1C` |
   | the task dispatcher, its inline-jump trampoline, and task 5 (3) | `0x00CA`, `0x02E3`, `0x062A` |
   | the 25m barrel-release entry and the fire-pass head (2) | `0x2C8F`, `0x30ED` |

3. **The readable layer is not yet self-contained.** Nineteen call sites inside `idiomatic/` reach
   a callee by importing the frozen oracle (`from "../translated/loc_XXXX.js"`) even though the
   address *is* registered and has a readable twin. Behaviour is unaffected — the oracle is what
   the twin is gated against — but a reader following the call lands in per-instruction code.
   `docs/reviewer-rules.md` R10 carries this as a standing review rule:

   ```sh
   node --input-type=module -e '
   const fs=await import("node:fs"); const {ROUTINES}=await import("./games/dkong/idiomatic/names.js");
   let n=0; for(const f of fs.readdirSync("games/dkong/idiomatic").filter(f=>f.endsWith(".js")))
     for(const m of fs.readFileSync(`games/dkong/idiomatic/${f}`,"utf8")
        .matchAll(/^import .*from "\.\.\/translated\/loc_([0-9a-f]{4})\.js";/gm))
       if(ROUTINES[parseInt(m[1],16)]) { n++; console.log(f,"->",m[1],ROUTINES[parseInt(m[1],16)].name); }
   console.log("stale:",n);'
   ```

And one measurement about *understanding* rather than code. Net (a) of the enumeration in
`docs/understanding.md` is written for `mem8[0x…]` bracket syntax, which this port does not use —
run as written it finds nothing, which is a fact about the regex, not about the code. Run in this
port's accessor form (`mem.read8/write8/read16/write16(0x6xxx)`, comments stripped, registry cells
excluded) it finds **15 work-RAM addresses still read or written as bare hex** — `0x6209`,
`0x620A`, `0x62AF`, `0x62B9`, `0x6350`, `0x6392`, `0x6910`, `0x6919`, `0x694D`, `0x694F`,
`0x6A20`–`0x6A23`, `0x6A25`. Net (b) finds **47 more addresses aliased to file-local `const`s**
that were never centralized, **9 of them with conflicting local names across files** — `0x62AF`
alone carries seven (`BOARD_BOOKKEEPING`, `BOARD_OBJECT_SCRATCH`, `CUTSCENE_BOOKKEEPING`,
`FRAME_GATE`, `PACE_COUNTER`, `PHASE_COUNTER`, `TICK_COUNTER`), which is precisely the "one
routine's local view" the registry exists to reconcile. Those 15 + 47 are the to-do list for the
next naming pass; the sharpest are named in §16.

```sh
# net (a) and net (b), in this port's accessor syntax, against the gate's own idea of "named"
python3 - <<'PY'
import re, os, sys; sys.path.insert(0, "tools"); import names_consistency as n
win = n.workram_window("dkong")
named = n.named_workram(open("games/dkong/idiomatic/names.js").read(), win)
bare, alias = {}, {}
for f in sorted(os.listdir("games/dkong/idiomatic")):
    if not f.endswith(".js") or f == "names.js": continue
    src = open(f"games/dkong/idiomatic/{f}").read()
    code = re.sub(r"//[^\n]*", "", re.sub(r"/\*.*?\*/", "", src, flags=re.S))
    for m in re.finditer(r"\bmem\.(?:read|write)(?:8|16)\(\s*(0x6[0-9a-fA-F]{3})\b", code):
        a = int(m.group(1), 16)
        if win[0] <= a <= win[1] and a not in named: bare.setdefault(a, set()).add(f)
    for m in re.finditer(r"\bconst\s+([A-Z_0-9]+)\s*=\s*(0x6[0-9a-fA-F]{3})\s*;", code):
        a = int(m.group(2), 16)
        if win[0] <= a <= win[1] and a not in named: alias.setdefault(a, set()).add(m.group(1))
print("net(a) bare hex:", len(bare), "| net(b) aliased:", len(alias),
      "| conflicting:", sum(1 for v in alias.values() if len(v) > 1))
PY
```

---

## 2. The machine underneath

**Address space** (`boards/dkong/memory.js`, transcribed from MAME's `dkong.cpp`, not re-derived
from observation): ROM `0x0000–0x3FFF`; work RAM `0x6000–0x6BFF` (note the bound —
`0x6C00–0x6FFF` is *not* RAM and a touch there throws); sprite RAM `0x7000–0x73FF`; tilemap RAM
`0x7400–0x77FF`; the i8257 DMA at `0x7800–0x780F`; the I/O strip at `0x7C00–0x7D87`. Three
modelling rules that layer exists to enforce: a read and a write at one address are *different
devices* (`0x7C00` reads IN0 and writes the sound-tune latch); a read is not necessarily pure
(reading `0x7D00` kicks the watchdog, which is how the dog is fed — once per vblank, as an
interrupt side effect); and unmapped access throws loudly. `[code]`

**The frame beat.** Everything time-critical hangs off the **vblank NMI**, not IM1 — the bytes at
0x0038 are an ordinary subroutine (`addToSpriteObjectColumn`, the `rst 0x38` vector, falling into
the generic `addStrided` at ROM 0x003D). Once per frame `serviceVblankNmi` acknowledges the
interrupt by clearing the enable latch (which also blocks re-entry), kicks the watchdog, blits the
sprite shadow buffer through the DMA, reads the joystick *only while a credited game is in play*,
and tails into `perFrame`, which **decrements** `FRAME`, stirs the PRNG, services coins and the
sound countdowns, and dispatches `GAME_STATE`. `[code]`

**The main loop is a task scheduler, and it is where the game actually runs.** `mainLoop`
(ROM 0x02BD) walks the task table in page 0x60, dispatches any queued task, does the per-frame
work, then spins comparing `FRAME` against its own latched copy `FRAME_SEEN` — the wait-for-vblank
the NMI's decrement releases. `SPIN_COUNT` is bumped once per loop pass (~140×/frame; its *jitter*
with workload is the point, because it feeds the PRNG). In this port `mainLoop` is a **generator**:
it `yield`s exactly where the oracle's cycle-driven engine fires the NMI, which is what makes the
readable layer runnable without a cycle model. `[code]` — and note what `idiomatic.test.js` compares:
the idiomatic spine against the frozen oracle, our JS against our JS, over 600 attract frames. That
is a fact about this port's internal consistency, not an observation of the arcade machine.

**Four dispatch layers, all `rst 0x28` inline jump tables**, because almost every "how does control
get *there*" question resolves to one of them. All four tables read directly out of
`rom/maincpu.bin`:

| level | selector | table | arms |
|---|---|---|---|
| top | `GAME_STATE` | ROM 0x00CA | 4 words: `0x01C3` power-on, `0x073C` attract, `0x08B2` credited, `0x06FE` in-game |
| in-game | `GAME_SUBSTATE` | ROM 0x0702 | 24 words for indices 0x00–0x17, of which index 0x09 is `0x0000`, so 23 live handlers; padded with five more zero words |
| attract | `GAME_SUBSTATE` | ROM 0x0748 | 8 words: `0779 0763 123C 1977 127C 07C3 07CB 084B` |
| within a state | a per-machine step byte | various | `INTRO_STEP` → ROM 0x0A7A; `BOARD_ADVANCE_STEP` → ROM 0x1623 / 0x1637 / 0x1648 |

`[code]`

**The task ring** decouples "something happened" from "redraw it". `enqueueTask` posts a two-byte
`[opcode, argument]` message into the 32-slot ring at `TASK_RING`, with `TASK_TAIL` / `TASK_HEAD`
as pointers and `0xFF` marking a free slot; the main loop consumes one per pass and frees both
bytes. The handler table at ROM 0x0307 is **seven words** — `051C 059B 05C6 05E9 0611 062A 06B8` —
so opcode 0 adds to the score, 1 resets a score counter, 2 draws a score, 3 draws a vertical
string, 4 draws the credit line, 5 steps the bonus readout, 6 draws lives and level. A full ring
silently drops the request. **Points are never added inline**: a hit posts `[0, index]` and the
main loop credits it later, which is why scoring is decoupled from collision. `[code]`

---

## 3. From power-on to a played board

`GAME_STATE` walks 0 → 1 → 2 → 3 and the whole start-up is that walk. `[seen]` (the cell's own
transitions were observed live)

- **0 — power-on.** `powerOnInit` / `clearRamAndInitHardware`: wipe all RAM, fill the task ring
  with `0xFF`, set the display latches, silence the sound, hand the game its stack.
  `decodeDipSwitches` unpacks DSW0 into `DIP_LIVES` (3–6), `DIP_BONUS_LIFE`
  (7000/10000/15000/20000), the coinage cells and `DIP_UPRIGHT`. `[code]`
- **1 — attract.** `runAttractState` has two jobs: if `CREDITS` is non-zero, reset the sub-state
  and step to state 2; otherwise run the current attract sub-state (§14). `[code]`
- **2 — credited.** `enterCreditScreen` puts up the start-select screen; `readStartButtonSelector`
  watches for 1P/2P; `commitGameStart` spends the credit(s), seeds the player context records,
  wipes the screen and moves to state 3. `TWO_PLAYER_GAME` is written **exactly once**, here, as
  the high byte of one 16-bit store. `[code]`
- **3 — in-game.** `dispatchInGameSubstate` vectors `GAME_SUBSTATE` through ROM 0x0702. The
  indices that matter: `0x07` opening Kong-climb cutscene, `0x08` "HOW HIGH CAN YOU GET?", `0x0A`
  board build, `0x0B` spawn Mario, `0x0C` **gameplay** (→ ROM 0x197A), `0x0D` the death-animation
  router (→ ROM 0x127C), `0x0E` player-1 life loss, `0x14` player-screen / fall-back-to-attract,
  `0x16` **board cleared / advance**. `[code]`

Coins are their own little machine: `serviceCoinInput` debounces IN2 bit 7 against the `COIN_EDGE`
latch (so holding the coin line cannot repeat-credit), accumulates `COINS_PARTIAL` until it reaches
`DIP_COINS_PER_CREDIT`, and awards `DIP_CREDITS_PER_COIN` BCD credits capped at 0x90. `[seen]`

---

## 4. The world: boards, the order table, and the level loop

`BOARD` is 1 = 25m girders, 2 = 50m conveyors, 3 = 75m elevators, 4 = 100m rivets. `[seen]`

**The board order is a ROM table, and it disagrees with the outside-in view.** `BOARD_SEQ_PTR` is a
16-bit pointer initialised to ROM 0x3A65 and stepped one byte per completed board; the byte it
lands on is copied straight into `BOARD`. Dumped from `rom/maincpu.bin` at 0x3A65:

```
0x3A65: 01 04                  L1   25m, 100m
0x3A67: 01 03 04               L2   25m, 75m, 100m
0x3A6A: 01 02 03 04            L3   25m, 50m, 75m, 100m
0x3A6E: 01 02 01 03 04         L4   25m, 50m, 25m, 75m, 100m
0x3A73: 01 02 01 03 01 04      L5+  25m, 50m, 25m, 75m, 25m, 100m   <- the wrap target
0x3A79: 7F                     terminator
```

`[code]` **`gameplay.md` §4 says *one full "level" is four distinct single-screen stages* in the
canonical order 25 → 50 → 75 → 100. The code says the type ORDER is right and the SET is not: a
level is 2 boards at L1, 3 at L2, 4 at L3, 5 at L4, and 6 from L5 on** — 25m is revisited inside
the later levels, and 50m does not appear at all until level 3. Only level 3 is the "four stages in
order" the public sources describe. This is an inside-out correction to the public record, not a
disagreement between sources.

**The loop.** Hitting the `0x7F` terminator reloads the pointer to **0x3A73**, the head of the L5+
group, so from level 5 on the same six-board group repeats forever. `[code]` `[seen]` (a played run
reached 100m → wrap → 25m with `LEVEL` incrementing, frame-for-frame against MAME)

**`LEVEL` increments exactly once per 100m clear — a structural fact, not a counter.** Two places
walk `BOARD_SEQ_PTR` forward and only one touches `LEVEL`:

- `advanceToNextBoard` is the last entry of the **25m/75m** table (ROM 0x1623) and of the **50m**
  table (ROM 0x1637). It walks the pointer, publishes `BOARD`, arms the how-high interlude, and
  does **not** touch `LEVEL`.
- `runRivetBoardFinaleThenAdvanceLevel` is the last entry of the **100m** table (ROM 0x1648). Its wrap arm walks the pointer
  *and* does `LEVEL := LEVEL + 1`, resets `HOW_HIGH_INDEX`, and clears `BOARD_ADVANCE_STEP`.

Every level group in the table ends with `04` (100m), so the level counter advances once per group
and never otherwise. `[code]`

**Difficulty** is a separate, faster knob: `DIFFICULTY = min(LEVEL + (DIFFICULTY_CLOCK >> 3), 5)`,
recomputed every 8th tick of a 256-frame prescaler and reset at each board build. So the same board
gets meaner the longer you dawdle *on it*, and each loop starts meaner — `gameplay.md`'s
qualitative "faster, sometimes diagonal" as a clamped 1–5 value the hazard code reads directly.
`[seen]` (the cell's values and cadence were measured live)

---

## 5. Building and drawing a board

`buildBoard` wipes the playfield, arms the palette bank, queues the opening task and dispatches to
the per-board setup arm; each arm selects its layout table and background tune and converges on a
shared tail that runs `initBoardState` and the layout renderer. `[code]`

`initBoardState` is the common reset: zero the player/motion block and the whole object + sprite
span, copy a 0x40-byte board-object template from ROM 0x3D9C over the head of it, compute the bonus
values (§11), stamp two constant hit-box bytes, seed three decorative top sprites on every board
except 100m, and dispatch to the per-board object seeding (`seed25mBoardObjects` …
`seed100mBoardObjects`). `[code]`

**The layout renderer** walks a ROM segment table: `drawBoardLayout` → `loc_0dd3` converts each
record's endpoints to tilemap addresses through `tileAddrForPixel`, computes the run deltas into
the `SEG_*` scratch cells, and dispatches by record kind — kind 0/1, kind 2, kind 3, kinds 4/5/6.
`[code]`

> ### Which drawer lays which, measured
>
> The board-layout walk has two drawers, and which is which was settled by measurement, not by
> reading. A held
> write-tap on tilemap VRAM, in a mode that replaces each routine's written tile with the blank
> `0x10`, was run on the real ROM under MAME 0.288 (`scratchpad/grounding-object-arrays.md` §4).
> Suppressing **ROM 0x0E19 — `drawLadder` — removes 616 px, and they are the LADDERS** (the two
> full-height ladders beside Kong plus eight shorter segments; not one girder
> pixel changes). Suppressing **ROM 0x0E4F — `drawGirderSpan` — removes 6256 px, and they are the
> GIRDERS** (every sloped platform; not one ladder pixel changes). The write signatures agree:
> 0x0E19 lays 22 writes of the uniform tile 0xC0 in short `+1` runs with zero VRAM-row spread;
> 0x0E4F lays 304 writes from the 0xE0/0xF0 slope-tile band with `+31/+32` steps and a row spread
> up to 25. Under ROT270 the `+1` axis is the *displayed vertical* and the `+0x20` axis the
> *displayed horizontal*, so 0x0E19 draws short vertical runs and 0x0E4F long sloped horizontal
> ones. **`[seen]`**
>
> The idiomatic names were swapped once this measurement settled which drawer is which, so
> `drawGirderSpan` names the routine that draws girders and `drawLadder` the one that draws ladders.
> Both read the way they measure. The FROZEN LIFT still carries the old reading in its own prose —
> `translated/loc_0e19.js` calls itself the girder span and `translated/loc_0e4f.js` the ladder
> drawer — and it is frozen, so it stays wrong there. Read those two headers against this section,
> not the other way round. **`[code]`** — those three are facts about this repository, not
> observations of the machine.

A useful downstream consequence: the ladder/girder *table* is the same one `findOppositeLadderEnd`
scans — `loadBoardObjectRecords` de-interleaves the very ROM tables the layout renderer walks (25m
0x3AE4, 50m 0x3B5D, 75m 0x3BE5, 100m 0x3C8B) into the work-RAM object-parameter arrays that lookup
reads. So the *word* "ladder" in `startBarrelDescentAtLadder` and in the fire excursion machine
(§9) is **`[seen]`** rather than structural inference: the drawer of exactly the kind-0/1 records
those routines key on was pixel-confirmed to draw ladders. The surrounding gating chains stay
`[code]`; only the actor word is promoted.

---

## 6. The cast: object records, the arrays, and who is who

**Mario is privileged; everything else is a record in an array.** Mario has his own motion block at
0x6200–0x6226 and his own 4-byte hardware sprite record (`MARIO_SPRITE_RECORD`). Every other moving
thing — barrels, fires, springs, elevator platforms, cement pans, the hammers, the floating score
glyph, the interlude cast — is a fixed-stride record in one of a handful of work-RAM arrays,
mirrored each frame into the **sprite shadow buffer** (`SPRITE_BUFFER`, 96 records × 4 bytes) and
blitted to sprite RAM by the i8257 on the vblank DRQ edge. `[code]`

The shared record fields are registry-named (`OBJ_ACTIVE`, `OBJ_X`, `OBJ_Y`, `OBJ_SPRITE_CODE`,
`OBJ_SPRITE_ATTR`, `OBJ_STATE`, `OBJ_HIT_EXTENT_X/Y`, `OBJ_INSERT_REQUESTED`,
`OBJ_WALK_PTR_LO/HI`), and are the reason the arrays can share collision, gather and animation
code. Note the trap the registry is careful about: offsets ≥ 0x10 are in-record only for the
stride-0x20 arrays and alias the *next* record on the stride-0x10 ones.

### Which array is which actor

| array | stride × records | live on | what it holds | evidence |
|---|---|---|---|---|
| `OBJ_ARRAY_67` (0x6700) | 0x20 × 10 | 25m only | **the BARRELS** | `[seen]` |
| `OBJ_ARRAY_64` (0x6400) | 0x20 × 5, **7 on 100m** | all four boards | **the FIRES** (a two-frame sprite pair × flip; a *different* pair on 100m) | `[seen]` identity / `[code]` the 100m extent |
| `OBJ_ARRAY_65` (0x6500) | 0x10 × 10 | 75m (records 0–1) | the springs — X sweeps 213 distinct values | `[code]` |
| `OBJ_ARRAY_66` (0x6600) | 0x10 × 6 | 75m (all six) | the elevator platforms — X pinned to `{55, 119}`, Y sweeping | `[code]` |
| `OBJ_ARRAY_65A0` (0x65A0) | 0x10 × 6 | 50m (records 0–2) | the cement pans — X sweeps the full width, Y row-fixed, culled at the edge | `[code]` |
| `OBJ_PAIR_6680` (0x6680) | 0x10 × 2 | 25m/50m/100m | the two hammers | `[code]` |
| `OBJ_RECORD_66A0` (0x66A0) | single | 25m, 50m | the board's fixed hazard — **on 25m it is the oil drum** (§8) | `[seen]` |
| `BOARD_OBJ_SCRATCH` (0x6280) | 0x08 × 2 | 50m | the two vertically-travelling 50m objects — **what they ARE is still open** (§9, §16) | `[seen]` the machine + geometry / `[guess]` identity |

> ### ★ The fires and the barrels: what was and was not observed
>
> `OBJ_ARRAY_64 = the FIRES` and `OBJ_ARRAY_67 = the BARRELS` were established on the real ROM
> under MAME 0.288, on a **zero-poke, naturally-played 25m run**, with A/B in both directions
> (`scratchpad/grounding-object-arrays.md`, re-opened while writing this):
>
> - **Kill `OBJ_ARRAY_64`** (force all five records' `+0` to 0): the fireball is gone from the
>   screen entirely — 0 of 40 sampled frames, 0 px — while the barrels are statistically untouched
>   (616 barrel px / 333 motion, against a baseline of 616 / 328).
> - **Kill `OBJ_ARRAY_67`**: barrel motion collapses 328 → 29 and no new barrel is produced, while
>   the fireball is untouched (34/40 frames vs 35/40 baseline). The 489 px that remain are stale
>   records frozen in the DMA shadow buffer.
> - **Tight A/B** (intervene at f1200, capture from f1195): frames f1195–f1204 are bit-identical
>   between arms; `kill64`'s first differing frame carries a blob at cols 101–114, rows 231–245 —
>   the fire record's logged position to the pixel; `kill67`'s carries four blobs, all at logged
>   barrel positions and none at the fire's.
> - **Positional correlation on all four boards** — 25m from the natural credited game, while the
>   50m/75m/100m long-dwell frames come from a `docs/POKE-TO-ADVANCE.md` board pre-set (the same
>   boards were also reached by real completion in the progression tape, giving the same answer):
>   boxes drawn at the logged record positions land on a fireball or a barrel and nothing else —
>   75m shows exactly 2 fire records for all 2176 gameplay frames, 100m spawns them one at a time.
>   Sprite codes differ per board: `{0x3D,0x3E}`×flip on 25m/50m/75m, `{0x4D,0x4E}`×flip on 100m,
>   **and that is all that was measured — nothing measured SIZE.** `gameplay.md` §7 (public sources
>   only) calls the 100m actor "a larger fireball variant"; equating that with the different sprite
>   pair is `[guess]`, not part of this `[seen]`.
> - **The screen direction of `OBJ_X` is measured, not inferred**: the transform
>   `display_col ≈ OBJ_X − 15` was read off four simultaneous records on a real MAME frame, and the
>   X-pin positive control below commands it.
>
> **The honest floor, stated because it is load-bearing.** The *positive* control on
> `OBJ_ARRAY_64` — pinning the records' `OBJ_X` every frame — is a **no-op**: 359 of 360 frames
> stayed pixel-identical to baseline, because the ROM recomputes that byte each frame from state
> held elsewhere. So the fire identity rests on the **kill** control plus per-frame positional
> correlation, **not** on a coordinate command. `OBJ_ARRAY_67` *does* have a working positive
> control: pinning its X to 0x28 confines every barrel to columns 0..62 and to 0xA0 clusters them
> at ~145, with nothing else on screen moving. The kill is a spawn-suppressor and a freeze, not an
> eraser. Records not exercised: `OBJ_ARRAY_67` records 6–9 were never active *together* in any run
> — the census tops out at 9 simultaneously live, so only record 9 was never seen active. The
> `OBJ_ARRAY_64` grounding covers records 0–4, and that bound is a property of the **logger**,
> which sampled five: the ROM seeds records **5 and 6** on 100m (§9), and those two were never
> observed at all. Not tested: 2-player, difficulty 5, levels above 4, the cocktail/flip path. And
> the per-board fire counts are level-dependent — the 50m maximum differed between runs (2 live at
> L2, 3 at L3) — so those figures are as observed at the levels driven, not a ceiling.

**The gather path.** Each subsystem mirrors its records into the shadow buffer in its own way:
`publishBarrelSprite` stages the barrels (§8), `publishFireSprites` gathers the five fire records
into 0x69D0, `update50mMovingObjects` refreshes the six 50m sprites at `OBJ_65A0_SPRITES`,
`update75mActorObjects` mirrors into `ACTOR_SPRITES`, `writeMarioSpriteRecord` refreshes Mario's.
`blitSpritesViaDma` then programs the i8257 (ch0 src 0x6900, ch1 dst 0x7000, count 0x180) once per
vblank. `[code]` `[seen]` (the sprite-record ↔ source-cell identities were checked byte-exact
against MAME)

---

## 7. Mario

**One router, five tests and a fall-through, and the ORDER is the mechanic.**
`dispatchMarioMovement` (ROM 0x1AC3)
writes nothing itself; it picks who owns the frame, first match wins. Read straight off the ROM the
sequence is `MARIO_AIRBORNE` (0x1AC3), `MARIO_FREEZE_TIMER` (0x1ACA), `MARIO_HAMMER_ACTIVE`
(0x1AD1), `MARIO_ON_LADDER` (0x1AD8), then the jump press-edge bit of `P1_INPUT` (0x1ADF):

1. **airborne** → the airborne handler. A jump or fall owns the *whole* frame, input included —
   which is why a jump cannot be steered onto a ladder or re-triggered in mid-air.
2. **freeze timer non-zero** → tick it down and nothing else (the few unresponsive frames after a
   landing).
3. **hammer active** → the **ground walk** arm. Note *where* this sits: above the ladder test and
   above the jump test, so while the hammer is held the frame is claimed before either is reached,
   and a hammer-carrying Mario can only walk. **That single ordering is the entire cost of the
   hammer** — `gameplay.md` §5's "cannot jump, cannot climb, cannot drop it" is one branch
   position, not three rules. `[code]` (the equivalence gate's tooth for this is a twin that moves
   the hammer arm *below* the jump test, which lets a hammer-carrying Mario jump)
4. **on ladder** → the climb dispatch (Down arm first, then Up).
5. **jump press-edge** → launch the arc.
6. otherwise → ordinary grounded walking, which is also how he steps onto a ladder.

Every test is an exact comparison rather than a range, and the equivalence gate drives all 256
values through each selector to pin that. `[code]` (a 2000-frame **harness replay** — `new
Machine(ROM)` under our own engine, not MAME — dispatches this 1197× and reaches all six arms)

**Walking** is paced by `MARIO_MOVE_STEP_TIMER`: while it is non-zero Mario slides one pixel per
frame; at zero the walk-cycle index `MARIO_WALK_ANIM` advances and a new step begins with the
facing bit set or cleared. On 25m the girders are sloped, so `snapYToGirder` nudges his Y one pixel
along the slope as he walks. `[seen]`

**Climbing** runs `advanceClimbStep` with `MARIO_CLIMB_LIMIT_A/B` as the pair of ladder extents: the
step stops and clears `MARIO_ON_LADDER` when (newY + 8) equals either limit.
`centerMarioAndCommitClimbStep` snaps him onto the ladder column and ticks the alternating
footstep. **A pose is not enough — to climb, Mario must actually walk to the ladder's X**; the
centring snap is applied *during* a climb step, not as a way to enter one. `[seen]`

**Jumping and falling** share one ballistic integrator. `initMarioJump` picks the horizontal launch
velocity from the held direction; `launchMarioJump` writes the airborne record, sets the jump pose,
snapshots `MARIO_AIR_START_Y` and fires the jump sound. Per airborne frame `stepBallisticMotion`
applies `ΔY16 = −(V + 8 − 16n)` with `V = MARIO_AIR_VY_HI/LO` constant across the arc and
`n = MARIO_AIR_FRAMES` — verified exact, including after poking `V`, over 142 airborne frames. At
`MARIO_AIR_FRAMES == 0x14` the fall-height check arms (`MARIO_AIR_LANDCHECK`);
`markFatalFallByHeight` latches `MARIO_FATAL_FALL` once he is more than 0x0F px below where he took
off, and the landing consumes it as `MARIO_ACTIVE = MARIO_FATAL_FALL XOR 1`. **"Falling too far
kills you" is that one XOR.** `[seen]`

**The horizontal gate is not a screen edge.** `limitMarioHorizontalTravel` classifies Mario's X into
a two-flag verdict that all three consumers turn into a restraint. Its left verdict also fires for
an *interior* wall — odd `BOARD`, Y < 0x58, X < 0x6C, the left end of the top platform on 25m and
75m — and the airborne reflection (`reverseMarioVerticalArc` plus its horizontal half) re-bases the
parabola in place rather than clamping. A fall already latched lethal skips the re-base and keeps
falling. `[code]`

**Losing your footing.** `startMarioFallWhenGroundGivesWay` probes the tile under Mario's foot while
he is in plain grounded contact; if the girder there is not level it defers to
`decideSlopeGirderFooting`, which either keeps his footing or calls `triggerMarioFall` to raise
`MARIO_START_FALL`. `beginMarioFall` consumes that one-shot next frame and drops him with zero
initial velocity. `[seen]` (the trigger was caught firing on 75m only, never on 25m, whose girders
are continuous)

---

## 8. The 25m barrel engine

**ROM `0x1F72–0x21D0` plus `0x24B4–0x24E9` is ONE machine, and it runs on board 1 only.** Two spans
rather than one because the retirement arm sits away from the rest; the second span ends at 0x24E9
because ROM 0x24EA is the 50m subsystem's entry. `[code]`

Its shape was established by scanning `rom/maincpu.bin` for each node address as a 16-bit operand
(a byte scan, so each hit was checked to fall at an operand position). **The machine has exactly one
entry from outside itself**: `0x1F72`, referenced once, by the cascade's `call` at ROM 0x1983.
Inside, `0x21BA` has thirteen references and all thirteen lie between 0x1FCB and 0x24E8; `0x24B4`
has exactly three callers (ROM 0x2014 inside `advanceRollingBarrel`, 0x2068 inside the arc arm,
0x2101 inside the airborne arm), all within the walk; `0x1F83` has *no* absolute reference anywhere
in the image and is reached only by fall-through and by the loop's own `djnz`; `0x1F8D` has exactly
one, the `jp 0x1f8d` that ends `publishBarrelSprite`.

The whole machine is behind one equality test. ROM 0x1F72 is
`ld a,(BOARD) / dec a / ret nz / ld ix,0x6700 / ld hl,0x6980 / ld de,0x0020 / ld b,0x0A` — an
equality against 1, not a board mask, and everything after it is the walk. On the other three
boards the routine returns four instructions in, having changed nothing, which is why
`OBJ_ARRAY_67` is identically zero there. `[code]`

### 8.1 Kong's throws are scheduled against the bonus, not a clock

`scheduleBarrelRelease` (ROM 0x2C03) runs only on 25m, only while Mario is alive, and only while
the cluster's in-progress latch (0x6393) is clear. It weighs the live `BONUS` against
`BONUS_START`, then matches the low five bits of `FRAME` against a `DIFFICULTY`-length countdown —
so the throw *rate* rises with difficulty — before dispatching into the slot-claim cluster at ROM
0x2C41. `[code]` (bytes at 0x2C03: `ld a,1 / rst 0x30`, `rst 0x10`, `ld a,(0x6393) / rrca / ret c`,
`ld a,(BONUS) …`, `ld a,(DIFFICULTY) / ld b,a / ld a,(FRAME) / and 0x1F / cp b`)

`releaseBarrelIntoFreeSlot` claims the free `OBJ_ARRAY_67` record the scan stopped on and does five
things in fourteen instructions: publish the record base to `RENDER_OBJ_PTR`; stamp `OBJ_ACTIVE` =
**2**; compute `RENDER_DST_PTR` = `0x6980 + (10−B)*4`, the very sprite slot the walk would publish
for that record; raise the in-progress latch; enqueue task `[5,1]`; and **decrement `BONUS`**.
`[code]`

> ★ **On 25m the barrel release IS the bonus clock.** `BONUS` is stepped by the metronomic
> decrementer on boards 2/3/4; on board 1 it is charged here instead, one unit per barrel thrown
> (ROM 0x2CDA `ld hl,0x62B1 / dec (hl)`, with the zero case raising `BONUS_EXPIRED_STEP`). So on
> the girder board the timer falls per barrel, not per unit of time — a mechanic `gameplay.md` §6
> has no way to see from outside, and one that makes "bank bonus time" and "dodge more barrels" the
> same quantity. `[code]`

**Two barrel kinds.** `stampReleasedBarrelKind` (ROM 0x2CF6) presets the claimed record with one of
two triples selected by bit 7 of `BARREL_CLAIM_MODE` — code/attr/kind `0x15/0x0B/0x00` at ROM
0x2CF6–0x2D01, or `0x19/0x0C/0x01` at 0x2D0D–0x2D14. **Bit 0 of the same cell is a different,
independent selector**: the waypoint-table choice (the one-waypoint table at ROM 0x39CC versus the
four-waypoint table at 0x39C3), not the kind. Which named Donkey Kong object each kind is was
deliberately not established. `[seen]` for the bit-7 → triple mapping; `[code]` for the bit-0
split.

**How often each kind is released, measured.** A write tap on all ten records' kind bytes over a
900 s zero-poke attract run (`scratchpad/p16/kindreaders_900.txt`, 54 480 frames) attributes every
stamp to its PC: **197 default-kind stamps and 29 alternate-kind stamps — 226 barrels released,
12.8% of them alternate.** `[seen]`

### 8.2 The walk, and the state byte that drives it

Ten records at stride 0x20, walked against ten 4-byte sprite records at `ACTOR_SPRITES` at stride 4,
one pair per slot. `serviceBarrelSlotIfLive` is the loop head, and **it tests `OBJ_ACTIVE` for
EQUALITY WITH 1, not for a bit.** The difference is a mechanic: the byte takes three values live —
0 empty, 1 running, 2 claimed — so a record `releaseBarrelIntoFreeSlot` has stamped with 2 is
skipped exactly as an empty one is, and does not reach the motion dispatch until it is running. Two
routines drive one sprite slot during a release, and this test is the hand-off between them: while
the release renderer owns the slot through `RENDER_DST_PTR`, the walk skips it; when the record
becomes 1, the walk takes over. The free-slot scan at ROM 0x2C8F separates the same three values
from the other direction, by rotation: bit 0 set, skip; bit 1 set, skip; neither, claim. `[seen]`
for the 2 (watched being written at claim time); `[code]` for the gate's arithmetic.

`advanceBarrelMotion` picks one of five arms from **two record bytes, the first outranking the
second**: the select byte (`+1`) is tested for equality with 1 and pre-empts everything; only if
that fails are the low three bits of the mode byte (`+2`) walked lowest-first, first set bit wins.
`[code]`

| test | arm | what it does |
|---|---|---|
| `+1 == 1` | ROM 0x20EC | an airborne step gated on a per-record threshold at `+0x19`. **This arm is unidentified** — §16 |
| `+2` bit 0 | ROM 0x1FAC | ladder descent: `OBJ_Y` += 1 per frame until it reaches the target at `+0x17` |
| `+2` bit 1 | `stepBarrelRight` | roll one pixel, X increasing |
| `+2` bit 2 | `stepBarrelLeft` | roll one pixel, X decreasing |
| none set | ROM 0x2053 | ballistic travel, probing for the girder beneath each frame |

**The mode byte's encoding is confirmed by three sites that must agree and do.** The selector reads
it lowest-first; the ladder arm ends with `xor 7` on it (ROM 0x1FC6), which clears bit 0 and swaps
bits 1 and 2 — so a barrel coming off a ladder resumes rolling *the other way*, which is what a
barrel arriving on the next, oppositely sloped girder must do; and the leave-the-girder writer at
ROM 0x2038 stamps `+2 := 0x08`, clearing all three low bits so the record takes the airborne arm
next frame. **Bit 0 is a one-shot request, not a state the record sits in.** `[code]`

**The two roll arms are mirror images, and the mirror is in the constants they stage.** The +X arm
stages slope-step selector 1 and orientation code 0; the −X arm stages 255 and 4. Only "is it 1"
reaches `snapYToGirder`, which fires at cell offset 0 for 1 and at offset 15 for anything else — the
edge of a 16-pixel girder cell that a barrel crossing that way meets first. The orientation code
steers `advanceBarrelSpriteOrientation`'s packed lookup. `[seen]` for the direction (the barrel
X-pin control moves the drawn sprites to the commanded column, and `display_col ≈ OBJ_X − 15`);
`[code]` for the selector arithmetic.

**`advanceRollingBarrel` is the shared tail, and it is where a roll ends.** Read off ROM 0x1FF6, in
the order tested: (1) `OBJ_X & 7 == 3` — once every eight pixels — hands the barrel to the
ladder-descent grader at ROM 0x215F and skips everything else; (2) otherwise `OBJ_Y` is re-derived
through `snapYToGirder` with a −3/+3 offset applied around the call, and
`advanceBarrelSpriteOrientation` refreshes the sprite's mirror bits; (3) the retirement gate at
`retireBarrelIntoOilDrum` runs, and on its retirement arm takes control away entirely; (4)
`OBJ_X < 28` → ROM 0x202F, which stamps `−96`; (5) `28 ≤ OBJ_X < 228` → publish; (6)
`OBJ_X ≥ 228` → stamp `+96` and fall into ROM 0x2038. The ±96 lands in the record's `+0x10`:`+0x11`
pair, which `stepBallisticMotion` adds to the record's `+3`:`+4` coordinate every airborne frame at
1/256 px per unit — so the barrel **rolls off the end of the girder and keeps travelling the way it
was rolling**, which is how it reaches the girder below. ROM 0x2038 writes the vertical half
(`+0x12`:`+0x13` = 0xFFF0) and the mode byte. `[code]`

### 8.3 The publish is also the erase

`publishBarrelSprite` is where all thirteen paths converge. It swaps the walk's register bank back
in — every motion arm swapped it out and none swaps back — and copies four record fields into four
consecutive staging bytes in a **permuted** order: `OBJ_X` → `SPRITE_X`, `OBJ_SPRITE_CODE` →
`SPRITE_CODE`, `OBJ_SPRITE_ATTR` → `SPRITE_ATTR`, `OBJ_Y` → `SPRITE_Y`, skipping the record's `+4`
and `+6`. The destination is inside `SPRITE_BUFFER`, the shadow the i8257 blits to sprite RAM every
vblank, so the last consumer of everything this routine writes is the raster. The identical
permutation exists elsewhere as a counted loop (`gatherSpriteRecords`, ROM 0x11D3), whose five
call sites — 0x1046, 0x10DB, 0x117A, 0x119E and 0x11CF, found by scanning the image for `cd d3 11` —
are all in the board-object seeding code. `[seen]` for the coordinate fields reaching the screen
(the X-pin positive control); `[code]` for the permutation.

**Nothing blanks a dead barrel's sprite.** Three arms retire a record — ROM 0x2079, ROM 0x210E and
`retireBarrelIntoOilDrum` — and each zeroes `OBJ_X` and then deliberately jumps *into* the publish
rather than returning, so the last thing written for that slot is a parked sprite at column zero.
That is why the retirement arm pops its caller's return address, and why the per-slot gate's skip
path is safe: a skipped slot's four staged bytes are left exactly as they were, and for a retired
barrel those bytes are already the parked ones. `[code]`

### 8.4 Retirement into the oil drum

`retireBarrelIntoOilDrum` is the exit at the bottom. Three gates in a row, each an ordinary return
that changes nothing: `OBJ_Y` must be ≥ 232 (larger Y is lower on this screen), and `OBJ_X` must lie
in 32..41 — both ends tested against the same loaded byte, so it is one band and not two limits.
Past them the record is torn down: `OBJ_ACTIVE` and `OBJ_X` are zeroed, `SND_TRIGGER + 2` is
asserted for three frames, the caller's return address is popped, and control jumps to the publish.
`[code]` (byte-verified against `rom/maincpu.bin` at 0x24B4, 54 bytes ending at 0x24E9)

**The fixed hazard in that band is the oil drum, and that is `[seen]`, not inherited.**
`scratchpad/pass16-review-out/vid/cmp_drum.png` is four real MAME frames at the same frame index,
bottom-left crop: the object at the band is a blue drum with **OIL** written across it, the flame
that ROM 0x03A2 animates sits on top of it, and a one-cell pin turns that flame on and off.
`OBJ_RECORD_66A0`'s board-1 position and the band agree, and every fire activation logged in nine
900 s runs spawns at (X=39, Y=232) — inside this routine's own band.

**Retiring is unconditional; the fire is not.** In the negative-control arm below, 36 credited-play
retirements produced zero fires and the barrel was still destroyed each time. What the alternate
kind adds is one byte: `0x62B9 := 3`, which arms the drum. `[seen]`

**A one-shot difficulty switch is armed here too.** The latch at `0x6348` is set to 1 the first time
this routine ever fires and never touched again while it stays set. Both readers treat CLEAR as the
simple early-board behaviour and SET as the difficulty-graded one: `loc_22cb` picks object velocity
from `LEVEL` while clear and from `DIFFICULTY` once set, and `startBarrelDescentAtLadder` advances a
spawn immediately while clear and runs the full position/input/throttle grading once set. A write
tap over an 8000-frame attract run saw `0x6348` set to 1 only from inside this routine and cleared
only from outside it — this arms it, board setup resets it. `[seen]`

### 8.5 Wild barrels

`startBarrelDescentAtLadder` is the "sometimes it comes down the ladder" decision, reached from the
roll tail once every eight pixels of travel. It looks the barrel's column up in the ladder (type-0
object) table through `findOppositeLadderEnd`, always stamps the descent target at `+0x17`, then
runs a chain of gates to decide whether the barrel *also* starts down: a difficulty-weighted random
throttle, whether Mario has descended far enough, and then a comparison of Mario's column against
the ladder's — exactly on it, it always goes; past it, it goes if Left is held; before it, it goes
if Right is held; and a final random gate decides otherwise. **The barrel's choice of ladder is a
function of where Mario is and which way he is pushing.** `[code]` for the gating chain; **`[seen]`
for the word "ladder"** (§5). This is `gameplay.md` §7's "wild/crazy barrels", and the inside view
says they are not random — they are aimed.

### 8.6 The fire chain: retiring an alternate barrel ARMS a release

This is the pass's central grounding, and it is a chain of four routines, not one action:

```
alternate-kind barrel reaches the drum band
  -> retireBarrelIntoOilDrum writes 0x62B9 := 3          (bit0 = run at all, bit1 = the counting arm)
  -> animateFixedHazardAndReleaseFire (ROM 0x03A2) reads that byte, once per 4 frames
       bit0 clear -> its whole body never runs and the drum is dark
       bit1 set   -> the arm that counts 0x62BA down; on underflow it writes
                     0x62B9 := 1 and raises EVENT_REQ_313C, then reloads the counter to 16
  -> spawnRequestedFireAndRecolorLiveFires (ROM 0x313C) sees the request and MAY insert a fire
```

**Measured on the real ROM under MAME 0.288, nine 900 s runs, board 1 on 54 542 of 54 546 logged
frames, zero board or level pokes** (`scratchpad/pass16-fire.lua`, raw per-frame logs in
`scratchpad/p16/*.csv`; the fire counts below were re-derived by counting rises of the live-record
column in those CSVs, not copied from the run summaries):

| arm | attract | one credit | re-coined play |
|---|---:|---:|---:|
| baseline, nothing poked | **21** | **23** | **29** |
| every record's kind byte forced to 0 (negative control) | **0** | **0** | **0** |
| every record's kind byte forced to 1 | **30** | **35** | **35** |

The zero is not "no barrels ran": the kind-0 arms retired 29 / 24 / 36 barrels into the band — more
than baseline in attract — and produced no fire at all, with no `OBJ_ARRAY_64` record live for a
single frame of 54 546. The pin was verified at the consuming instruction, not just at a frame
boundary: a read tap on `ld a,(ix+0x15)` at ROM 0x24C3 saw the forced value on **195 of 195**
decisions across the six pinned arms. `[seen]`

**A cleaner control, on the one cell with a single reader in the whole image.** `0x62B9` has exactly
one read site in the 16 KB ROM (ROM 0x03B2) and four write sites (0x03D8, 0x1083, 0x24CC, 0x2FD5) —
a byte scan for the operand `b9 62` finds nothing else. Pinning *that* cell takes the kind byte out
of the causal path entirely. Four arms, 900 s each, same corpus
(`scratchpad/pass16-review-b9.lua`, raw logs in `scratchpad/pass16-review-out/*.csv`, recounted the
same way):

| pin | drum on screen | fireballs | fire activations |
|---|---|---|---:|
| none (baseline) | lit | present | **21** |
| `0x62B9 := 0` | **dark** | none | **0** |
| `0x62B9 := 1` | **lit, at baseline strength** | **none** | **0** |
| `0x62B9 := 3` | lit | four at once | **114** |

`[seen]`, and three things fall out of it. The drum's flame and the fireball are **independently
controllable** — bit 0 lights the drum, bit 1 arms the release — which the picture shows directly.
**The routine that writes the byte is not the routine that releases the fire**: in the `:= 0` and
`:= 1` arms `retireBarrelIntoOilDrum` still armed 19 and 20 times and not one fire resulted. And the
release is periodic once armed: `0x62BA` is reloaded to 16 only at a release and ROM 0x03A2's body
is prescaled to one pass in four, so a continuously-armed drum emits one fire every 64 frames.

**On 25m, and only on 25m, this is the ROM's only path to a fire.** ROM 0x24B4 is the only
instruction that can write `0x62B9 := 3` there, and ROM 0x03A2's countdown the only one that can
raise the request — not as a sweep bound but as a property of the board masks, all three read
straight off the image: ROM 0x2FCB, the other writer of 3, opens `ld a,0x0E / rst 0x30` (boards 2,
3, 4); ROM 0x2DDB, the other raiser of the request, opens `ld a,0x0A / rst 0x30` (boards 2 and 4);
ROM 0x101F, which writes `0x62B9 := 1`, is the 50m seeder. The other three sites that touch the
request cell all write ZERO — ROM 0x0768's board reset, and ROM 0x313C's own two clears at 0x316E
and 0x31A4. **Off 25m none of that holds** — on 50m and 100m the
periodic request at ROM 0x2DDB is a second source, and it is difficulty-scaled. `[code]`

> ### ★ The last link is capacity-limited, and "retirement causes a fire" is false without this
>
> In the `0x62B9 := 3` arm the chain raised **293 requests and produced 114 fires**, with at most 5
> records live at once. `[seen]` A raised request is not a fire, and three properties of ROM 0x313C
> are why — all three read off the frozen oracle `translated/loc_313c.js` and the image:
>
> - the sweep is five records long (`ld b,0x05`), so an insert needs a free slot among five;
> - **the request cell is cleared at the end of every sweep** (ROM 0x316E `ld hl,0x63A0 / ld (hl),0`)
>   whether or not it was serviced, so a request that arrives when the array is full is dropped, not
>   held;
> - one insert per sweep at most: the insert arm clears the request as it fires (ROM 0x31A4).
>
> There is a fourth gate, `ld a,(DIFFICULTY) / cp c / ret z` at ROM 0x3190 comparing difficulty
> against the live count — but it sits *inside* the `BOARD == 2` arm (ROM 0x3187 `cp 0x02` /
> `jp nz,0x3195` jumps past it), so it cannot bind on 25m. `[code]`
>
> **Which of these bound in the 114-of-293 measurement was not separated**, and the honest reading
> is the measured ratio plus the ROM's list of ways a request can be dropped. In every arm the pass
> ran at baseline, at most one fire was live and the ratio was exactly 1:1, which is why the chain
> *reads* clean until it is pushed.

### 8.7 What the machine actually spends its frames on

Read taps at every node of the walk, three 900 s MAME environments, board 1 throughout
(`scratchpad/pass16-review-walk.lua`; raw counts in `scratchpad/pass16-review-out/walk_*.txt`). The
arm split is a measurement of behaviour — of 75 471 motion dispatches in pure attract:

| arm | attract | credited (24 214 gameplay frames) |
|---|---:|---:|
| roll +X | 30 026 | 35 317 |
| roll −X | 23 639 | 23 892 |
| ballistic (no mode bit) | 12 431 | 13 712 |
| ladder descent | 4 769 | 3 186 |
| the `+1 == 1` airborne arm | 4 606 | 6 251 |

`[seen]` Two things worth reading off it. The `+1 == 1` arm — the one nobody has identified — is
**not rare**: 4 606 dispatches in 900 s of attract and 6 251 in a credited run. And the ladder
detour out of the roll tail (ROM 0x215F) fires 6 825 times against 53 665 roll-tail entries, so
**12.7% of rolling frames end at the ladder grader rather than in a roll** — which is why a name
for that tail must not say "along the girder".

**Do not use the walk's internal count identities as evidence for anything.** `1f83 == 1f8d`,
`1f83 == 10 × walks`, `1f93 == 21ba`, `1fe5 + 1fef == 1ff6` and the five-arm sum all hold to the
unit in all three environments, and all of them are forced by the code's shape: the loop has no
early break, no path can leave a serviced record unpublished (every terminal of every arm is a
`jp` into the publish, enumerated out of the ROM), and the five arms partition one branch. A
corroboration that cannot fail is not corroboration. The identity that *is* refutable is
`e_197a − e_1e94_skip == e_1f72`, which holds exactly in all three environments
(22 755 − 2 336 = 20 419; 23 713 − 2 847 = 20 866; 24 214 − 0 = 24 214): the only thing between the
cascade's entry and the barrel walk that can abandon a frame is the effect-latch gate's caller-skip.
`[seen]`

### 8.8 Two names deliberately withheld

`loc_1f8d`, the between-slots step, stays address-named. It reads no memory and writes no memory;
every value it produces — the staging cursor, the record pointer, the slot count — is consumed by
the next iteration of the loop it is part of, so tracing its output terminates *inside* the loop.
It branches on the iteration counter where its twin `serviceBarrelSlotIfLive` branches on game
state, and that is the line: a registry entry named after a `for` header would tell the next reader
there is a mechanism here. When this cluster collapses into a real JS loop it should be absorbed
and deleted, not renamed. `[code]`

ROM 0x1F72 is `update25mBarrels`, registered and wired. It is the machine's only entry and carries
its board gate; the name was promoted on the evidence in this section.

---

## 9. The other three boards, and the hammer

Every hazard subsystem is board-gated by the same `rst 0x30` idiom — ROM 0x0044 rotates the
caller's mask right `BOARD` times and skips the caller unless the carry comes out set — which is
why the whole cascade can be dispatched on every board and only the right parts run. `[code]`

### 50m — conveyors, cement pans, and the two travelling objects

Three subsystems run here, and they are genuinely three:

1. **The conveyor rows.** `update50mConveyorObjects` runs three reversal drivers
   (`M50_OBJ{1,2,3}_REVERSE_TIMER` / `_STEP_DIR`), each publishing a signed ±1/0 step shadow, and
   then `carryMarioOnConveyorRow` reads which row Mario stands on **by exact Y** (0x50, 0x78, 0xC8)
   and carries his X by that row's freshly-published step. The drivers must run before the carry;
   the row-2 case publishes a ± pair and picks the arm by Mario's X. **His walk step and the belt
   step are added independently in the same frame** — the cascade calls the movement router at ROM
   0x1983 and the conveyor update at 0x19AD, and each writes `MARIO_X` — so walking against a belt
   should be slower than walking with it. `[seen]` for the drivers' values and cadence; `[code]`
   for the independent add. The felt asymmetry itself has **not** been measured under MAME.
2. **The cement pans.** `update50mMovingObjects` services the spawn request (`OBJ_SPAWN_REQ` /
   `OBJ_SPAWN_TIMER`, a 0x7C-frame cooldown), then `advance50mObjectRow` steps each of the six
   `OBJ_ARRAY_65A0` records horizontally and culls it the moment it runs off the play area — either
   within seven pixels of the left edge, or, for the centre-split mover, at dead centre
   (X == 0x80). Culling clears the record and blanks its sprite. `[seen]`
3. **The two travelling objects.** `dispatch50mObjectState` picks one of the two 8-byte
   `BOARD_OBJ_SCRATCH` records by frame parity and runs a four-state machine on it: parked at the
   top of travel (counter 0x68) for a 256-frame dwell → sliding down to 0x78 → a randomised dwell
   at the bottom → rising back and re-parking. The vertical convention was grounded by forcing the
   record's published sprite byte to 40/104/120/200 and reading the resulting image rows: **larger
   is lower**, so 0x68 is the object's highest point. Each record carries a *column*, and the
   parked arm hit-tests Mario against that column, stamping a shared flag with 1 if the dwell just
   expired and 0 while it is still running. `[seen]` for the machine and its geometry.

   **What those two objects ARE is an open question** (§16). The shape — a column, a 16-pixel
   vertical travel, dwells at both ends, and a flag stamped only while Mario stands on that column
   which the *climb* stepper then reads as a gate — reads as `gameplay.md` §4.2's
   retracting/extending ladders. That is `[guess]`, and §16 states the falsifiable prediction.

### 75m — elevators and springs

`service75mBoard` is the board's router and the clearest difficulty ramp in the game. It first tests
`MARIO_Y ≥ 0xF0` — the very bottom of the screen — and if so kills him outright, **with no X-band
test, so he need not be on a lift at all**. Otherwise it services on a frame-counter cadence that
*doubles after level 1*: at `LEVEL == 1` it advances the board objects on `FRAME & 3 == 0`, runs the
vertical-reposition machine on `FRAME & 3 == 1`, and idles the other two frames; at every other
level it alternates every frame with no idle. The test is `dec a / jp nz`, i.e. `LEVEL != 1`, so
`LEVEL 0` takes the fast cadence too. `[code]` (bytes at ROM 0x26FA)

`serviceBoardObjects` → `advanceBoardObjectTravel` drifts each of the six `OBJ_ARRAY_66` elevator
records one pixel vertically toward its limit and then lands or deactivates it — bit 3 of
`OBJ_STATE` picks the direction, a riser LANDS on reaching row 96 (X snapped to column 119,
`OBJ_STATE` := 4, which clears bit 3 so the next pass falls), and a faller DEACTIVATES on reaching
row 248; `spawnBoardObject`
claims a free slot on the `SPAWN_TIMER` cadence. Mario rides them through
`dispatchElevatorRideByColumn`, which gates on the lift flag and dispatches **by Mario's X**: band
44–66 → `carryMarioUpWithLift` (`MARIO_Y − 1` each frame, or death once he passes the 0x71 limit),
band 108–130 → `carryMarioDownWithLift` (`MARIO_Y + 1`, death at 0xE8). The elevator records'
observed X values are `{55, 119}` — one inside each band. `[code]` for the elevator
identification; the record liveness is `[seen]`. The third arm of that dispatch — neither band —
starts Mario falling and clears the flag, and has **never been observed executing**, so what taking
it means is unclaimed.

The springs are `OBJ_ARRAY_65`, walked by `update75mActorObjects` (10 records, 75m only, while Mario
is alive): each object walks an animation string of signed Y deltas, and the terminator handler
rewinds the walk pointer to the string base and fires the wrap sound. Records 0–1 were live for
3711 frames with X sweeping 213 distinct values; records 2–9 never activated in any run. `[code]`
for "springs"; the liveness and the sweep are `[seen]`.

### 100m — rivets

`RIVETS_LEFT` is initialised to **8** from the board template and `RIVET_PRESENT` is the 8-flag
array beside it — `gameplay.md` §4.4's eight rivets, exactly. `[code]`

`collectEdgeRivet` is the pickup, and it is a **two-frame edge**, not a contact test: if Mario
stands on a screen-edge column (`MARIO_X == 0x4B` or `0xB3`) it only *arms* `EDGE_RIVET_ARMED` and
stops — nothing is collected on the edge frame. On a later frame, once he has stepped off, it
disarms the latch, builds a 3-bit slot index out of position bits (row from `MARIO_Y − 1`, side from
`MARIO_X` bit 7), clears that `RIVET_PRESENT` slot, decrements `RIVETS_LEFT`, blanks the rivet's
three tilemap cells, and raises the collection flags (`EFFECT_STATE`, `EFFECT_SELECT`,
`ITEM_COLLECTED`). `[seen]` for the latch (154 toggles on 100m against 5 elsewhere); `[code]` for
the slot arithmetic. `completeRivetBoardWhenCleared` wins the board the frame `RIVETS_LEFT` reaches
0. `[code]`

### Fires on the other boards

The fire subsystem itself runs on all four boards, but **where a fire comes from is per-board**, and
the board masks settle it. Two routines can raise the insert request: `animateFixedHazardAndReleaseFire`
(mask 0x03 — boards 1 and 2) and `raisePeriodicObjectSpawnRequests` (mask 0x0A — boards 2 and 4, and
its period is derived from `DIFFICULTY`, one extra shift on board 2). That period is a power of two
that halves with every second difficulty step: `steps = (DIFFICULTY + 1) >> 1`, plus one more on
board 2, and the request is raised on the frames where `FRAME` lands zero under a mask of
`0xFF >> (steps − 1)` — one frame in 256 at a single step, 128 at two, 64 at three, 32 at four. Over
the in-play range `DIFFICULTY` 1–5 that is 256/256/128/128/64 frames on 100m and half of each on
50m, which is consistent with the 128-frame rise period observed on 100m. Both latches are raised
together and neither is ever cleared here. `[code]` **Board 3 has neither**, which
is why 75m shows exactly two fires for every one of its gameplay frames and never a third: those two
are *activated outright at board build* by `seed75mBoardObjects` (ROM 0x10E9 `ld ix,0x6400 /
ld (ix+0),1` and ROM 0x1101 `ld (ix+0x20),1`, with their X/Y pairs stamped alongside), and nothing
on that board ever asks for another. On 100m `seed100mBoardObjects` does the same thing to records
**5 and 6** at ROM 0x1166 (`ld ix,0x64A0`), which is why the rivet board's array runs seven deep
while every spawn/service path still walks five. `[code]`

The per-frame fire pass is `updateFires` → `spawnRequestedFireAndRecolorLiveFires` → `advanceLiveFires` →
`advanceFire` → `publishFireSprites`, and the pacing gate is *inside* `updateFires`:
`gateFireUpdateByDifficulty` tail-dispatches through a six-entry inline table at ROM 0x3104
(`3110 3110 311B 3126 3126 3131`, indexed by `DIFFICULTY` clamped to 5) into one of four
caller-skip frame guards. Because the dispatch is a tail, a guard that splices unwinds past the
*whole* fire pass — no spawn, no step, no publish — so **fireball speed is implemented as how often
the update is allowed to finish**: 1 frame in 2 at difficulty 0–1, 5 in 8 at 2, 3 in 4 at 3–4, 7 in
8 at 5+. `[code]` (table and guard bodies dumped from `rom/maincpu.bin`; the rates are in
`gateFireUpdateByDifficulty`'s registry role)

`spawnRequestedFireAndRecolorLiveFires` also sets each live record's `OBJ_SPRITE_ATTR` and
**clears it while Mario's hammer is active** (ROM 0x315D reads `MARIO_HAMMER_ACTIVE`), so the hammer
visibly recolours every live fire. `[seen]`

The per-fire state machine is `advanceFire`, whose interesting arm is `driveFireLadderClimb`: while a fire is on
foot it looks its X up in the ladder table and takes the *other* of the two heights that X is keyed
to as its destination; while it is travelling it watches for arrival — and "ladder" there is
`[seen]` for the same reason as the barrel's (§5). `OBJ_STATE` 0/1/2 = walking (`walkFireOneStep` steps the
working X one pixel and flips the sprite to match), 4 = descending, 8 = ascending. **The descent is
conditional where the ascent is not** — a fire only sets off downward while its row is above
Mario's, so a fire level with or below him never comes down. That asymmetry is what makes fires
feel like they hunt upward. `[code]` `tickFireTimerAndRerollDirection` reloads a 43-tick timer and
re-rolls the travel direction on a random bit; `armAlternateFireModeAtHighDifficulty` arms a second
mode in records 1 and 3 once `DIFFICULTY ≥ 3` and a rare entropy draw comes up — that mode is
deliberately unnamed, because nothing past its first gate has ever been observed firing. `[code]`

### The hammer (25m, 50m, 100m — not 75m)

`driveHammerSprite` opens `ld a,0x0B / rst 0x30` — mask bits 0, 1 and 3, i.e. **25m, 50m and 100m,
and not 75m**, which is `gameplay.md` §5's "no hammer to rely on the same way on 75m" as a
three-bit constant. `[code]`

`latchHammerTouch` tests Mario against the two-record hammer pair and publishes the overlap into
`MARIO_HAMMER_PENDING`; a *miss clears what a touch set*, so the flag is not sticky. The pending
flag transfers into `MARIO_HAMMER_ACTIVE` only when the post-landing freeze expires — and the touch
latch itself runs from the airborne handler's exit tail on the single frame whose counter bump wraps
to zero (`MARIO_AIR_FRAMES == 19`), **which is why a hammer is tested for roughly once per airborne
arc rather than once per frame**. The other path into that tail, a collision fall-through, arrives
with a value that cannot wrap, so a collision frame never tests for a hammer touch. `[code]` — 77
dispatches over a 2000-frame **harness replay** under our own engine, the 4 latching ones all at
`MARIO_AIR_FRAMES == 19`.

While held, `updateActiveHammer` increments `HAMMER_TIMER_LO`/`_HI` and ends the hammer when the
high byte reaches 2, clearing `MARIO_HAMMER_ACTIVE` and the hammer record's in-play flag and
restoring the pre-hammer tune from `HAMMER_SAVED_BGM`. **The limit is 512 ticks OF THIS UPDATER,
which is not 512 frames** — the counter only advances on frames the updater runs, so a held hammer
outlasts 512 frames by however many frames the updater was skipped. `[code]` Bit 3 of the low byte
drives the 8-frame swing animation, and the swing's *hitbox* is real: the two poses stamp
`OBJ_HIT_EXTENT_X/Y` as `0x06/0x03` and `0x05/0x06`, and `recordHammerHitOnObject` hands exactly
those two bytes to the board's collision handler as the per-axis tolerances — so the hammer's reach
changes with the swing phase. `[seen]` (the grab, the counter running to its limit and the BGM
save/restore were observed live)

---

## 10. Collision, hits, effects, and points

**Two different searches, for two different questions.**

- *"Did something hit Mario?"* — `dispatchBoardCollision` vectors to the current board's arm, each
  a fixed sequence of sweeps, first hit wins. The sweep lengths are the `ld b` immediates at the
  four arm entries, dumped from the image: ROM 0x2880 `ld b,0x0A` over `OBJ_ARRAY_67`, then five
  `OBJ_ARRAY_64` and one `OBJ_RECORD_66A0`; ROM 0x28B0 `ld b,0x05` (50m:
  `OBJ_ARRAY_64`×5, `OBJ_ARRAY_65A0`×6, `OBJ_RECORD_66A0`×1); ROM 0x28E0 `ld b,0x05` (75m:
  `OBJ_ARRAY_64`×5, then `OBJ_ARRAY_65`×10 only if the first misses); ROM 0x2901 **`ld b,0x07`**
  (100m: one sweep over `OBJ_ARRAY_64`, seven deep — the two extra records the board build
  activated). `[code]` Each arm stores its sweep length in `OBJ_SEARCH_COUNT` first, and on a hit
  `recordHammerHitOnObject` writes `COLLIDED_OBJECT_BASE`, `COLLIDED_OBJECT_STRIDE` and
  `COLLIDED_OBJECT_INDEX`, recovering the index as `count − remaining`. **The arms and the arrays
  agree per board**, and the per-arm board exclusivity is `[seen]` — each arm's own registry entry
  records the run that showed it firing on its board and zero elsewhere.
- *"How many things did he just jump over?"* — `dispatchBoardOverlapSearch` → `loc_3e99` clears
  `OVERLAP_COUNT`, counts overlaps over both hazard arrays into it against a probe point that is
  **twelve pixels below Mario, not on him**, and grades the total into `0 / 1 / 3 / 7`. Those are
  not a scale — they are a **unary thermometer**: zero / one / two / three bits set, because the
  consumer walks `EFFECT_SELECT`'s low bits one at a time. `[code]`

**The effect machine** turns a hit or a pickup into a visible beat. `EFFECT_STATE` is a 4-way
router; state 1 (`armScorePopupAndSelectAward`) unconditionally arms `EFFECT_TIMER` to 0x40,
advances to state 2, then tail-jumps to one of the award setters chosen by the *first set bit* of
`EFFECT_SELECT`. A nested three-step sequence (`EFFECT_SEQ_STATE` with inner/outer counters) flashes
and animates the effect sprite and re-arms the parent machine when it finishes. While
`runHitEffectInsteadOfPlay`'s latch is set, the whole gameplay update is replaced by one effect
beat — **an effect literally suspends play**, and it is the only thing that can abandon the frame
before the barrel walk (§8.7). `[code]`

**The points come out of a ROM table, and it reconciles with `gameplay.md` exactly.** Task opcode 0
selects a 3-byte packed-BCD addend from ROM 0x3529 by payload index. Dumped from the image: payload
*n* for 1–9 is *n*×100 (`00 0n 00`, little-endian, so the middle byte is hundreds), payloads 0 and
10 are zero, and payloads 11–15 are `00 10 00` … `00 50 00` = 1000/2000/3000/4000/5000. `[code]`
With that table in hand the award setters decode:

| setter | task payload | points | matches `gameplay.md` |
|---|---:|---:|---|
| `pickAwardTierByObjectCount` (thermometer 0/1/3/7) | 1, 3, 5 | 100, 300, 500 | §6 "jump over 1 / 2 / 3 at once = 100 / 300 / 500" |
| `stageAward300Popup` / `stageAward500Popup` / `stageAward800Popup` | 3, 5, 8 | 300, 500, 800 | §6 hammer smashes "300, then 500, then 800" |
| the no-bits-set arm, dispatched on `LEVEL` (1 → 300, 2 → 500, else → 800) | 3, 5, 8 | 300, 500, 800 | §6 prizes "300 / 500 / 800 by level" |

So the three separate scoring rules a player learns from outside are **one dispatcher with three
entry conditions**. `[code]` — the table and the dispatch are exact; the *attribution* of the
level-scaled arm to Pauline's dropped items is inference from the scaling matching, not from
watching a pickup.

`awardScorePopup` posts the task, stamps the floating glyph as a 4-byte sprite record at
`POPUP_SPRITE` (`{MARIO_X, glyph, attr 7, MARIO_Y + 0x14}`), and cues a **board-gated** sound — the
award ping plays on 25m and 75m only. `[code]`

---

## 11. The bonus timer, the payout, and the kill screen

`initBoardState` computes, in 8-bit arithmetic (ROM 0x0F7A: `ld a,(LEVEL) / ld b,a / and a / rla`
×3 → `LEVEL*8`, `add a,b` twice → `LEVEL*10`, `add a,0x28`, `cp 0x51 / jr c / ld a,0x50`):

```
BONUS_START = BONUS = BONUS_EVENT_MARK = min((LEVEL*10 + 0x28) & 0xff, 0x50)
BONUS_PERIOD = BONUS_TICK              = max(0xDC - 2*bonus, 0x28)
```

`BONUS` is in units of 100, so the on-screen number is `BONUS × 100`. It falls two different ways:
the metronomic `tickTimedBoardBonus` on boards 2/3/4 (period `BONUS_PERIOD`, measured L2→100,
L3→80, L4→60 frames) and the barrel release on board 1 (§8.1). `BONUS_DISPLAY` is the packed-BCD
number the player watches, stepped in lockstep by both sites; that BCD encoding was confirmed over
99,367 comparable frames with zero mismatches and the borrow directly visible (0x50→0x49). `[seen]`

Reaching zero sets `BONUS_EXPIRED_STEP`, whose four-step machine (`dispatchBonusExpiredStep`,
`startBonusExpiredDelay`, `bonusExpiredIdle`, `advanceBonusExpiredStepWhenDelayExpires`,
`advanceSubstateWhenGrounded`) holds until Mario is grounded and then takes the death exit.
`[seen]` (walked 0→1→2→3 under a write tap on boards 2 and 4)

**The payout.** On completion `awardRemainingBonusToScore` splits `BONUS_DISPLAY`'s nibbles into two
table-selected payloads and posts both — `gameplay.md` §6's "whatever remains is added to your
score", located. `[seen]` with a stated caveat: the five observed dispatches needed a
`GAME_SUBSTATE := 0x16` poke to reach the board-advance state; in unpoked play it was observed zero
times over 49,700 frames.

**The level-22 kill screen falls straight out of the first line.** At `LEVEL == 22`,
`22*10 + 40 = 260 = 0x104`, and the multiply was never widened, so the store keeps `0x04`. Four is
below the `0x50` clamp, so the board opens with a **400-point timer** that expires in seconds no
matter how well you play. Evaluating the ROM's own expression:

| `LEVEL` | `LEVEL*10+40` | after the byte wrap and the clamp | on screen |
|---:|---:|---:|---:|
| 1 | 0x032 | 0x32 (50) | 5000 |
| 2 | 0x03C | 0x3C (60) | 6000 |
| 3 | 0x046 | 0x46 (70) | 7000 |
| 4 … 21 | 0x050 … 0x0FA | clamped to 0x50 (80) | 8000 |
| **22** | **0x104** | **wraps to 0x04 (4)** | **400** |
| 23 | 0x10E | 0x0E (14) | 1400 |

`gameplay.md` §4.5 and §9 flag the exact arithmetic as "a community reconstruction"; here it is the
literal expression in `initBoardState`, and the L1–L4+ column matches the published table row for
row. That promotes the public claim from *widely reported* to *confirmed*, and pins the mechanism
to one 8-bit multiply. `[code]`

**The extra life.** `awardBonusLifeAtThreshold` grants one score-threshold life per player, latched
by `BONUS_LIFE_AWARDED`, against `DIP_BONUS_LIFE` (default 7000) — `gameplay.md` §6's "bonus life at
7,000". A quirk worth knowing when reading traces: `DIP_BONUS_LIFE` is 0 at early boot, so the
threshold is momentarily 0 and the award fires immediately in attract. `[seen]`

---

## 12. Winning a board, and the interlude that advances it

**Winning is one write.** `enterBoardAdvanceAndUnwind` sets `GAME_SUBSTATE = 0x16` and unwinds out
of the movement cascade so nothing else runs that frame. `checkBoardWonByType` decides, per board
type, whether to reach it, and the routing is a bit test that is easy to get wrong — ROM 0x1E57 is
`ld a,(BOARD) / bit 2,a / jp nz,0x1E80 / rra / ld a,(MARIO_Y) / jp c,0x1E7A / cp 0x51 / ret nc`:

- **100m** — `bit 2` catches `BOARD` 4 first, and position is never read: the board is won the frame
  `RIVETS_LEFT` hits 0.
- **The ODD boards — 25m *and* 75m.** The `rra` rotates **bit 0** into carry, so `jp c` takes
  `BOARD` 1 **and** 3. Both are won positionally, by Mario's Y reaching the rescue row near Pauline.
  This is not "the girder board". `[code]`
- **50m** — won once Mario climbs above the 0x51 line (Y decreases as he climbs).

`[seen]` for the rescue itself: a played run reached Pauline on 25m by walking to the ladder X and
climbing, producing the advance 25m → 100m.

**The interlude** is one state machine, `BOARD_ADVANCE_STEP`, read through **three** board-parity
tables, but only two of them belong to one routine. `dispatchBoardClearedInterlude` owns the odd
boards (6 steps, table at ROM 0x1623) and 50m (5 steps, 0x1637); when neither board bit matches it
**falls through** (`jp nc,0x1641`) into the 100m path, where `runRivetBoardInterludeFrame` runs the
effect machine first and `dispatchRivetBoardInterludeStep` dispatches the third table (6 steps,
0x1648). Its first act each frame is `clearSpriteColumns`, which parks 28 sprite records — stopping
one short of Mario's on one side and one short of the interlude heart on the other, so the gameplay
actors are cleared away and the interlude's cast is kept. The steps run the Kong-recapture tableau
(`spawnInterludeHeart` seeds the heart sprite, code 0x76), sweep the sprite-object block toward the
top, wait until every slot is clear, and end at the board-order walk. `[seen]` (the step byte was
watched walking 0→5 exactly once per completion, 51 monotone entries across nine completions, and
is identically 0 on every in-play frame outside sub-state 0x16)

Inside the 100m table the scene is not redrawn on a timer but on an ARRIVAL. Step 4 (ROM 0x1880)
slides the whole ten-record sprite-object block DOWN one pixel a frame, and the frame record 4's Y
lands exactly on 0xD0 it builds the next scene once — a 70-tile block fill from VRAM 0x76C6, the
girder-and-ladder layout drawn from the segment table at ROM 0x3A5F, sprite-buffer records 0 and 1
dropped 0x28 rows, sound latch 2 pulsed — then resets the pace counter step 5 winds down on and
increments the step. The test is equality and the +1 nudge precedes it, so the block passes through
the landing row on exactly one frame and the build cannot repeat. `[code]`

The "HOW HIGH CAN YOU GET?" screen is **step 0 of this same sequence**, not a separate machine;
`HOW_HIGH_INDEX` (clamped to 5) is stepped when `BOARD_SEQ_PTR` differs from its saved copy and
reset on the level increment. `[code]`

`SEQ_ADVANCE_PTR` is the small indirection that makes several of these steps share one timer:
`advanceSequenceStepWhenTimerExpires` loads the *address* stored there and increments the byte it
points at, but only on the frame `SUBSTATE_TIMER` expires. Setup routines re-point it —
`INTRO_STEP` during the cutscene, `BOARD_ADVANCE_STEP` during the interlude — and its indirect
`inc (hl)` was caught writing `BOARD_ADVANCE_STEP` by PC. `[seen]`

---

## 13. Death, lives, players, game over

`MARIO_ACTIVE` going to 0 during the per-frame cascade is what ends a life: the cascade's tail reads
it, and on zero it silences every sound output, fires sound trigger 2, and steps the sub-state — and
the next index in *both* dispatch tables (in-game 0x0C→0x0D, attract 3→4) is the death-animation
router at ROM 0x127C. `[code]`

The animation itself is grounded end to end. `DEATH_ANIM_PHASE` is a three-arm router (slot 3 is
structurally unreachable padding — the cell has three writers and none can produce 3);
`beginMarioDeathAnimation` blanks the sprite columns, primes `DEATH_ANIM_TICKS_LEFT` to 13, and its
last instruction is the **sole writer of the sound line MAME labels "dead"**;
`stepMarioDeathAnimation` rotates Mario's sprite through four orientations (tile 0x78↔0x79,
flipy↔flipx) on an 8-frame gate. Under MAME's sprite-record layout that pair is a 180° rotation and
the record never takes a blanking value, so this is a spin and not a blink — but note the evidence
line: the grounding run used `-video none`, so the four `(code, attr)` pairs, the gate and the
episode length are `[seen]` while the *rendering* reading is inferred from those bytes plus MAME's
`draw_sprites`, not from pixels. The episode is 296 frames and was identical in 43 of 43 completed
episodes, with a negative control of 0 on every one of 42,275 ordinary play frames. `[seen]`

**The bonus-timer death reaches the same sequence with `MARIO_ACTIVE` still 1** — ROM 0x1A2A jumps
into the middle of the same three instructions, stepping over the alive test. That is why a live
`MARIO_ACTIVE` is not evidence the death sequence is not running: two different causes reach the
identical animation. `[seen]`

`losePlayer1Life` decrements `LIVES`, snapshots the player context, and routes to the resume
interlude or the game-over sequence. Each player's 8-byte context (`P1_CONTEXT` / `P2_CONTEXT` =
lives, level, sequence pointer, play-intro flag, bonus-life latch, how-high bookkeeping) is `ldir`'d
to and from the live block at 0x6228 on every switch, which is what makes alternating two-player
play work. `PLAY_INTRO` being zeroed by both death handlers is why a board resumed after a death
**skips the opening cutscene**. `[seen]` The ordering is what makes that work: each handler clears
`PLAY_INTRO` BEFORE the 8-byte block is copied out, so the flag reaches the save slot already
clear. `[code]`

**Whose turn it is is shown by a blinking column, and the blink carries information.**
`redrawPlayerUpIndicator` repaints on every 16th frame only, and bit 4 of `FRAME` picks the phase:
one phase paints the current player's three-cell column (player-number tile = index + 1, then two
fixed tiles a screen row apart), the other blanks it. In a TWO-player game that blanked phase also
paints the *other* player's column, so the idle player's marker is lit exactly while the active
one is dark; in a one-player game the phase just blanks, and the single marker blinks. The whole
repaint is behind the credited-game guard, so attract shows no indicator at all. `[code]`

**The restore side re-derives the board.** `restorePlayer1Context` / `restorePlayer2Context` copy
the save slot back over the live block and then reload `BOARD` from the byte the *restored*
`BOARD_SEQ_PTR` points at, which is what makes each player resume on their own board rather than
the one the other player left behind. They then arm the turn: player 2's restore is
unconditional — `SUBSTATE_TIMER` 0x78, sub-state 4 — while player 1's branches on
`TWO_PLAYER_GAME`, taking 0x78 / sub-state 2 (the alternation screen) in a two-player game and
1 / sub-state 5 in a one-player game, which is why a solo player never sees that screen. `[code]`

**The player-2 half of that pair is where the two-player end condition is decided.** ROM 0x1344
(index 15 of the in-game table) is the same routine with player-2 constants. After the decrement,
lives remaining selects `GAME_SUBSTATE` 0x17 — *except* when the OTHER player is out too
(`P1_CONTEXT[0] == 0`), which selects 0x08 instead. Lives reaching zero runs the game-over arm:
rank the finished `P2_SCORE`, post two render tasks, stamp a 5×14 tile block at 0x76D3, arm
`SUBSTATE_TIMER` to 0xC0 and select sub-state 0x11. The decrement is unguarded, so an entry with
`LIVES` already 0 wraps to 0xFF and takes the still-playing arm. `[code]`

---

## 14. Attract mode and the demo

Attract is a real game played by a canned tape. `runAttractState` dispatches eight sub-states
through ROM 0x0748: the title/score composition, the timed-advance gates, a fresh
25m/level-1/one-life reseed (`restartAttractDemoAt25m` — unreachable for a credited game, since
`DIP_LIVES` is 3–6 at every DSW setting), Mario's spawn, the death router, and — slot 3 —
`runAttractDemoFrame`. `[code]`

`runAttractDemoFrame` is three bytes: `call 0x21EE`, then fall through into `runGameplayFrame`.
`advanceAttractDemoInput` walks a table of (input, duration) pairs at ROM 0x21D1 — the bytes are
`80 FE | 01 C0 | 04 50 | 02 10 | 82 60 | 02 10 | 82 CA | 01 10 | 81 FF | …`, i.e. jump / right /
up / left / jump+right … each held for its duration — and **writes the selected byte straight into
`P1_INPUT`, the same cooked control word the joystick fills**, indexed by `DEMO_SCRIPT_INDEX` with
`DEMO_SCRIPT_COUNTDOWN` as the per-step timer. Then the ordinary gameplay frame runs on top of it.
The in-game path enters the same cascade one instruction later, skipping only the script step.
**That is why attract is such good ground truth: it is the game, driven by a tape.** `[code]`

**The split between the two entries is measured, not assumed.** Read taps at both addresses, three
900 s MAME environments, with the sub-state histogram logged beside them
(`scratchpad/pass16-review-out/walk_*.txt`, opened while writing this):

| environment | `runAttractDemoFrame` (0x1977) | `runGameplayFrame` (0x197A) | attract sub-state 3 | in-game sub-state 0x0C |
|---|---:|---:|---:|---:|
| pure attract | 22 755 | 22 755 | 22 755 | 0 |
| one credit, then attract | 23 119 | 23 713 | 23 119 | 594 |
| re-coined credited play | **0** | **24 214** | 0 | 24 214 |

Each entry's count equals its own sub-state's frame count exactly, and the credited environment
drives them apart completely: the attract entry is never reached in a credited game, and the
gameplay cascade is reached in both. `[seen]`

`runGameplayFrame` itself contributes three things and no state of its own: the ORDER of
twenty-four subsystem updates (counted in `idiomatic/runGameplayFrame.js`, which mirrors the ROM's
call sequence), three gates that can abandon the rest of the frame — the effect latch, the board-won
check, and the bonus-expired step machine — and the death hand-off at the tail, which adds two more
calls on that arm only. Three `0x00` bytes sit inside the sequence at ROM 0x19C2–0x19C4; they change
no state, so nothing in the port corresponds to them. `[code]`

Attract also skips the joystick read entirely (the NMI gates it on `ATTRACT`), so the demo cannot be
disturbed by the cabinet controls. `[code]`

---

## 15. Sound

Audio here is a layer *above* emulation: the I8035 sound CPU and the discrete analog circuits are
not simulated. The engine watches the Z80's writes and plays a named sample. `[code]`

Three write surfaces: `0x7C00` (ls175.3d) selects one of 16 **tunes**; `0x7D00–0x7D07` (ls259.6h)
sets eight individual latch bits; `0x7D80` asserts the sound CPU's interrupt. The structural fact
not visible from the address map is that **the eight ls259 bits do not all go to the same place** —
bits 0–2 drive discrete analog circuits ("walk", "jump", "boom"/stomp), bits 3–5 are input pins the
sound CPU polls, and bits 6–7 are wired to nodes that do not exist in this driver's sound
configuration.

In work RAM this is a scheduler, not direct writes: `SND_TRIGGER` is eight per-bit countdown
counters that `soundDriverTick` walks once per NMI (non-zero → decrement and assert, zero →
deassert), so game code "plays a sound" by storing 3 — a three-frame assert. `SND_BGM` is the
looping background tune, overridden by `SND_PRIORITY` while `SND_PRIORITY_FRAMES` is non-zero. The
full provenance, and which sounds have sample bytes at all, is [`audio/README.md`](audio/README.md)
— not restated here. `[seen]`

---

## 16. Where the model is thin — open questions

Ordered by how much downstream work they block. This is a *highlighted subset*: the exhaustive
to-do is the enumeration in §1 (15 bare-hex reads plus 47 uncentralized local aliases) and every
`[code]` claim in this file.

1. **The `+1 == 1` barrel arm (ROM 0x20EC) is unidentified, and it is not rare.** 4 606 dispatches
   in 900 s of attract and 6 251 in a credited run (§8.7). Its body runs the ballistic stepper, then
   compares the stepped X high byte less 0x1A against a per-record threshold at `+0x19`; its
   siblings (ROM 0x2101/0x2104/0x2118) either retire the record on the low-X wrap band or
   re-initialise it with a different velocity. Until this is answered, `advanceBarrelMotion`'s name
   covers one behaviour nobody has watched. **Blocking**: it is the largest hole in the barrel
   machine, which is otherwise the best-grounded subsystem in the game.
2. **`0x62B9`, `0x62BA` and `0x62B8` have no registry names**, and this pass made them the
   best-understood unnamed cells in the port: one reader in the whole ROM, four writers, a phase
   pair whose two bits were separated on screen by a control-poke, a 16-tick countdown and a
   /4 prescaler. Three idiomatic files scope them locally under three different names. Naming them
   is the obvious next promotion, and the evidence for it is §8.6.
3. **`0x6348`, the one-shot difficulty latch**, likewise: `[seen]` as a one-way switch set only by
   `retireBarrelIntoOilDrum`, with two readers that branch simple-vs-graded on it, and three
   conflicting local names across files (`MODE_LATCH`, `SPAWN_MODE_GATE`, `VELOCITY_MODE_LATCH`).
   What a player would *notice* when it flips has not been measured: the A/B is a 25m board with the
   latch forced clear against one forced set, comparing barrel speed spread and ladder-descent rate.
4. **What are the two 50m travelling objects?** The `BOARD_OBJ_SCRATCH` pair's machine, geometry and
   Mario-column hit test are `[seen]`; their *identity* is `[guess]`. The retracting-ladder reading
   has a falsifiable prediction: on a credited 50m board, force one record's position counter to
   0x78 (its lowest) and hold it, and a ladder segment should be missing from the screen at that
   record's column; force it to 0x68 and the segment should be present. Do it with the pixel diff,
   not by eye. **Blocking**: it is the last unidentified actor on any board.
5. **`0x621A` — the flag the 50m parked arm stamps and the climb stepper reads.** Three writers
   across two subsystems and a reader in the walk/climb animation stepper, with two different local
   names across three files (`OBJECT_FLAG`, `CLIMB_FLAG`). If question 4 resolves as "retracting
   ladders", this is the cell that couples them to the climb, and the two should be named together.
6. **The fire chain's capacity limit is measured but not characterised** (§8.6). 293 requests
   produced 114 fires; the ROM offers three ways a request can be dropped on 25m and the experiment
   did not separate them. A tap on the sweep's free-slot outcome, per request, would.
7. **The fire source on boards 2–4 was never observed.** `raisePeriodicObjectSpawnRequests` is the
   only candidate the masks allow on 50m and 100m and it is difficulty-scaled, but this pass's whole
   corpus sat on board 1 and that routine contributed zero in every run. `[code]` only.
8. **What is ROM 0x1486 (`runBonusItemValueDisplay`, sub-state 0x15) really?** Its mechanics are
   pinned — a three-way mode latch on `SUBSTATE_TIMER`, a value seeded to 30 that counts down into
   two on-screen digit cells, a position walk driven by `P1_INPUT` bit 7, a scan of
   `PLAYER_SLOT_RECORDS`. But the reconciliation with `gameplay.md` §6 is **not** made: the prizes
   there are collected by walking over them during play, and §10's level-scaled 300/500/800 award
   arm already accounts for their scoring. A whole in-game *sub-state* devoted to a countdown
   display is a different thing. Ground what is on screen while `GAME_SUBSTATE == 0x15` before
   trusting the "bonus item" reading. `[guess]`
9. **`loc_2a2f` — deliberately left address-named.** Both blind proposers once had its axes
   backwards and filed the resulting nonsense as a mystery. Corrected, it probes the tile 4 px below
   a moving object, computes the girder surface row inside that cell, and, if the object has reached
   or passed it, **snaps the object's `OBJ_Y` UP onto the surface** and reports contact. There is no
   leftward asymmetry; it is an ordinary landing test. `landObjectOnSlopedGirder` is the obvious
   name and must be re-derived in a fresh proposer ≠ confirmer round before promotion. That same
   round owes a second item: **ROM 0x2083 publishes its 2-or-4 arm-select into record `+2` only from
   its THIRD step onward** — its first two steps write nothing there — so any reading of the mode
   byte that assumes it is live from step 1 is wrong.
10. **`armAlternateFireModeAtHighDifficulty`'s mode 2.** The routine writes 2 into field `+0x19` of
    fire records 1 and 3 when `DIFFICULTY ≥ 3` and a rare draw comes up. 457 dispatches were measured
    over 2000 attract frames (**harness replay**) and nothing past its first gate has ever fired, so
    the write is unobserved and the mode is unnamed on purpose. Needs a run at difficulty ≥ 3.
11. **The third arm of `dispatchElevatorRideByColumn`** — the neither-band case that starts Mario
    falling and clears the lift flag — has never been observed executing. What *taking* it means is
    unclaimed.
12. **Cocktail / two-player coverage.** `ACTIVE_PLAYER_INDEX`'s cocktail P2-select reader and its
    `+0x12` sub-state reader are still unexercised; the whole flip-screen path is untested. Ground
    these on a cocktail run before a downstream decompile trusts them.
13. **The 25m/75m rescue row vs. Pauline's actual position.** The win test is a Y comparison; that
    the Y in question is *Pauline's platform* is inference from where the rescue happens in play, not
    from anything the routine reads. It has never been separated from "Mario reached the top".
14. **A residual pixel difference during Kong's climb** (98 px, 0.17% of the frame) is a known
    DMA-timing artefact of the render path, not a game-logic divergence. Recorded so nobody re-opens
    it.
15. **Names deliberately held at `loc_`, each for a stated reason.** Recorded here because a hold
    that lives only in one file header is a hold nobody else can see:
    - **`loc_1f8d`** — the barrel walk's `for` header (§8.8).
    - **`loc_3110` / `loc_311b` / `loc_3126` / `loc_3131`.** One family behind one dispatcher
      (`gateFireUpdateByDifficulty`), differing only in mask and compare value. Renaming one of
      four leaves the family reading as three anonymous throttles beside one named one, so: **rename
      the family or none.** Whoever takes it must not paraphrase `loc_3110`'s `ret z` into the
      others' `ret m` — the two are genuinely inverted at the ends of the range.
    - **`runRivetBoardFinaleThenAdvanceLevel`.** Held at `loc_` for a long while as
      genuinely multi-purpose — a pacer, cutscene sprite staging, *and* the board-advance/`LEVEL`
      wrap. The name now carries the last two explicitly and the finale's length is a hard count
      (the counter it steps wraps at exactly 256 dispatches, measured on all three 100m boards).
    - **`loc_271e`**, `service75mBoard`'s delegate, held for the reason its parent's name refuses
      "Lift": 75m's cast is lifts *and* springs *and* prizes, so naming the delegate after any one
      of them narrows it wrongly.
    - **`loc_1e6d`**, the 50m board-won arm under `checkBoardWonByType`. The dispatcher above it is
      grounded; this arm's internals are not, so the hold marks an evidence gap in the arm, not in
      the routing.
16. **`loc_0400` is an interior address, not an entry point.** The bytes at ROM 0x03FB are
    `ld a,(BOARD) / cp 0x02 / jp nz,0x0413`, and 0x0400 is that `jp nz` — the third instruction of
    `slide50mSpriteRowAndServiceColorCycle`. It carries a `ROUTINES` entry and a `translated/`
    module that duplicates its parent's body entered one instruction later. A scan of the whole
    image for the little-endian word `00 04` finds no vector pointing there; the three `ld de,0x0400`
    sites are task messages (opcode 4, argument 0) posted through `enqueueTask`, not addresses.
    Retiring the phantom entry is a registry edit, not a decompile.
17. **The eight "dropping" barrels are unreconciled.** `BARREL_CLAIM_MODE` bit 7 selects the sprite
    and behaviour kind and bit 0 selects the waypoint table, and they are independent — but the
    grounding run that first suggested otherwise logged 8 alternate-kind stamps without recording
    the byte's value at each, so all 8 may have been 0x81 with both bits set. **Owed: a re-grounding
    that logs the value per stamp.** Until then nothing may claim bit 7 makes a barrel drop.

---

## Appendix A — work-RAM orientation

Regions, not a registry. Every cell's name, role and confidence is in `idiomatic/names.js`; this is
only a map of where to look.

| span | what lives there |
|---|---|
| `0x6000–0x600F` | credits, coin latches, `GAME_STATE` / `GAME_SUBSTATE` / sub-state timers, current player |
| `0x6010–0x601A` | cooked and raw input, PRNG accumulator, spin counter, frame counter |
| `0x6020–0x6026` | decoded DIP settings |
| `0x6040–0x604F` | the two saved 8-byte player contexts |
| `0x6060`, `0x6080–0x608B` | overlap counter; the sound scheduler (8 trigger counters, IRQ, BGM, priority) |
| `0x60B0–0x60B1` | the task ring's enqueue/dequeue pointers |
| `0x60B2–0x60BA` | the three packed-BCD score counters |
| `0x60C0–0x60FF` | the task ring itself: 32 two-byte `[opcode, argument]` slots |
| `0x611C–…` | player-slot records, stride 0x22 |
| `0x6200–0x6226` | Mario: position, fixed-point fractions, velocities, sprite state, every movement flag |
| `0x6227–0x622F` | the live player context — board, lives, level, sequence pointer, how-high bookkeeping |
| `0x6280–0x62BF` | the per-board object template span: the 50m object pair, rivet state, the bonus block |
| `0x62A0–0x62AC` | the 50m reversal timers / direction latches, and the release-renderer pointers |
| `0x62B8–0x62BA` | the fixed hazard's phase bits, its /4 prescaler and its release countdown (§8.6) |
| `0x6300–0x631F` | the two per-board object-parameter tables (the ladder table) |
| `0x6340–0x6354` | the effect machine and the collision-hit result cells |
| `0x6380–0x63CD` | difficulty, barrel-claim mode, board-advance and intro step bytes, spawn requests, the segment-drawing scratch, the attract script cursor |
| `0x6400–0x67FF` | the object-record arrays (§6) |
| `0x6900–0x6A7F` | the sprite shadow buffer and its named sub-bases |
| `0x6BE0–0x6C00` | dead stack scratch, excluded from the memory-equivalence compare |

---

## Appendix B — subsystem entry points

Names as they exist in `idiomatic/` right now; roles are in `ROUTINES`, not repeated here.
`loc_XXXX` entries are lifted and gated but not yet English-named; the five clusters listed in §1
are lifted but not yet wired.

- **Machine spine** — `boot` · `serviceVblankNmi` · `perFrame` · `mainLoop` · `loc_02e3` ·
  `loc_00ca` · `dispatchInlineJumpTable` · `boardBitGate` · `gameActiveGuard` · `marioActiveGuard` ·
  `tickSubstateTimer` · `tickSubstatePrescaler` · `stirRandomSeed` · `blitSpritesViaDma`
- **Tasks** — `enqueueTask` · `enqueueTaskBatch` · `addToScoreTask` · `resetScoreCounter` ·
  `drawScoreTask` · `drawStringVertical` · `drawCreditLineInAttract` · `loc_062a` ·
  `drawLivesAndLevel`
- **Boot / coins / start** — `powerOnInit` · `clearRamAndInitHardware` · `decodeDipSwitches` ·
  `serviceCoinInput` · `dispatchCreditedSubstate` · `enterCreditScreen` · `readStartButtonSelector` ·
  `commitGameStart` · `spendCredit`
- **Attract** — `runAttractState` · `composeAttractTitleScreen` · `restartAttractDemoAt25m` ·
  `runAttractDemoFrame` · `advanceAttractDemoInput` · `enterAttractMode`
- **Per-frame gameplay** — `runGameplayFrame` (the cascade) · `dispatchInGameSubstate` ·
  `runHitEffectInsteadOfPlay` · `loc_1e94` · `advanceSubstateAndArmTimer` ·
  `clearScreenAndSelectSubstate`
- **Board build & layout** — `buildBoardWhenTimerExpires` · `buildBoard` · `setup25mGirderBoard` ·
  `setup50mConveyorBoard` · `setUp75mBoard` · `initBoardState` · `seed25mBoardObjects` ·
  `seed50mBoardObjects` · `seed75mBoardObjects` · `seed100mBoardObjects` · `loadBoardObjectRecords` ·
  `seedMarioActorRecord` · `drawBoardLayout` · `loc_0dd3` · `drawGirderSpan` · `drawLadder` · `drawSegmentEndCap` · `drawCappedTileColumn` ·
  `fillTileColumn` · `tileAddrForPixel`
- **Mario** — `dispatchMarioMovement` · `walkRightWhileHeld` · `walkLeftWhileHeld` ·
  `walkMarioRight` · `walkMarioLeft` · `advanceMarioWalkX` · `climbUpWhileHeld` ·
  `climbDownWhileHeld` · `climbMarioUp` · `climbMarioDown` · `advanceClimbStep` ·
  `centerMarioAndCommitClimbStep` · `endClimbAtLadderLimit` · `initMarioJump` · `launchMarioJump` ·
  `advanceMarioAirborneFrame` · `stepBallisticMotion` · `reverseMarioVerticalArc` ·
  `settleMarioOnLanding` · `markFatalFallByHeight` · `tickPostLandingFreeze` ·
  `limitMarioHorizontalTravel` · `moveMarioX` · `startMarioFallWhenGroundGivesWay` ·
  `decideSlopeGirderFooting` · `triggerMarioFall` · `beginMarioFall` · `probeMarioDescentLanding` ·
  `resolveAirborneTileLanding` · `snapYToGirder` · `writeMarioSpriteRecord`
- **25m barrel release** — `scheduleBarrelRelease` · `driveBarrelRelease` · `loc_2c41` · `armBarrelRelease` ·
  `markNextBarrelAsAltKind` · `releaseBarrelIntoFreeSlot` · `loc_2ce6` · `stampReleasedBarrelKind` ·
  `advanceBarrelRelease` · `stepBarrelAlongReleasePath` · `activateReleasedBarrel`
- **25m barrel machine** (§8) — `update25mBarrels` (the walk head) · `serviceBarrelSlotIfLive` · `loc_1f8d` ·
  `advanceBarrelMotion` · `stepBarrelRight` · `stepBarrelLeft` · `advanceRollingBarrel` ·
  `loc_1fac` · `advanceBarrelTileAnimation` · `loc_202f` · `loc_2038` · `loc_2053` · `loc_2079` · `loc_2083` ·
  `loc_20a2` · `loc_20b5` · `loc_20c3` · `loc_20e1` · `advanceFallingBarrel` · `loc_2101` · `retireBarrelAtEndOfRange` ·
  `loc_2118` · `loc_2146` · `loc_2153` · `loc_215f` · `startBarrelDescentAtLadder` ·
  `publishBarrelSprite` · `retireBarrelIntoOilDrum` · `findOppositeLadderEnd` ·
  `advanceBarrelSpriteOrientation` · `loc_2a2f`
- **Fires** — `animateFixedHazardAndReleaseFire` · `updateFires` · `gateFireUpdateByDifficulty` ·
  `loc_3110` · `loc_311b` · `loc_3126` · `loc_3131` · `spawnRequestedFireAndRecolorLiveFires` ·
  `armAlternateFireModeAtHighDifficulty` · `tickFireTimerAndRerollDirection` ·
  `stepObjectSpriteFrame` · `publishFireSprites` · `advanceLiveFires` · `advanceFire` · `driveFireLadderClimb`
- **50m** — `update50mConveyorObjects` · `carryMarioOnConveyorRow` · `selectConveyorStepAndMoveMario` ·
  `reverseStepDirection` · `signStepHalfRate` · `update50mMovingObjects` ·
  `service50mObjectSpawnRequest` · `advance50mObjectRow` · `dispatch50mObjectState` ·
  `hold50mObjectParked` · `slide50mObjectDown` · `advance50mObjectStateOnRandomGate` ·
  `raise50mObjectAndPark` · `publish50mObjectYToSprite` · `marioReachedTargetColumn` ·
  `slide50mSpriteRowAndServiceColorCycle`
- **75m** — `service75mBoard` · `loc_271e` · `serviceBoardObjects` · `advanceBoardObjectTravel` ·
  `spawnBoardObject` · `dispatchElevatorRideByColumn` · `carryMarioUpWithLift` ·
  `carryMarioDownWithLift` · `killMarioAtEndOfLiftTravel` · `update75mActorObjects` · `advanceSpring` ·
  `loc_2e84` · `loc_2e9c` · `spawnObjectIntoInactiveSlot` · `mirrorObjectPositionToSprite` ·
  `advanceToNextObject`
- **100m rivets** — `collectEdgeRivet` · `armEdgeRivetPickup` · `completeRivetBoardWhenCleared`
- **Hammer** — `driveHammerSprite` · `updateActiveHammer` · `latchHammerTouch` ·
  `findHammerOverlappingMario` · `buildPendingHammerSprite` · `selectHammerSpriteBlinkByTimer` ·
  `blinkHammerSpriteOnFramePhase` · `commitSpriteRecordAtMarioOffset`
- **Collision & effects** — `scanObjectsAtMarioX` · `confirmObjectHit` · `killMarioOnObjectCollision` ·
  `recordHammerHitOnObject` · `searchPlayerObjectOverlap` · `dispatchBoardCollision` ·
  `search25mObjectOverlap` · `search50mObjectOverlap` · `search75mObjectOverlap` ·
  `search100mObjectOverlap` · `findCollidingObject` · `dispatchBoardOverlapSearch` · `loc_3e99` ·
  `countObjectOverlaps` · `dispatchEffectState` · `armScorePopupAndSelectAward` ·
  `pickAwardTierByObjectCount` · `pickRandomAwardTier` · `stageAward300Popup` ·
  `stageAward500Popup` · `stageAward800Popup` · `stageAwardPopupAtHitObject` · `awardScorePopup` ·
  `stampScorePopupSprite` · `dispatchEffectSequenceStep` · `buildEffectSprite` ·
  `flashEffectSpriteThenAdvanceSequence` · `animateEffectSpriteThenRearmEffect`
- **Bonus, score, lives** — `tickTimedBoardBonus` · `stepBonusDisplayDown` · `renderBonusDisplay` ·
  `awardRemainingBonusToScore` · `dispatchBonusExpiredStep` · `startBonusExpiredDelay` ·
  `advanceBonusExpiredStepWhenDelayExpires` · `advanceSubstateWhenGrounded` ·
  `awardBonusLifeAtThreshold` · `rampDifficulty` · `renderBcdColumn` · `expandBcdDigits` ·
  `drawHighScore` · `runBonusItemValueDisplay` · `positionBonusItemSprite`
- **Board won & interlude** — `checkBoardWonByType` · `completeBoardWhenMarioReachesRescueRow` ·
  `completeRivetBoardWhenCleared` · `enterBoardAdvanceAndUnwind` · `dispatchBoardClearedInterlude` ·
  `runRivetBoardInterludeFrame` · `dispatchRivetBoardInterludeStep` · `beginKongRecaptureInterlude` ·
  `begin50mKongRecaptureInterlude` · `spawnInterludeHeart` · `stageKongClimbPose` ·
  `stageNextKongPoseWhenHoldExpires` · `climbKongFigureAndBreakHeart` · `dispatchKongWalkFrame` ·
  `stepKongWalk` · `endKongWalkAndAdvanceInterlude` · `advanceBoardStepWhenSpritesCleared` ·
  `cullSpriteObjectsAtTop` · `allSlotsClear` · `advanceToNextBoard` · `loc_17b6` ·
  `stepSpriteAnimationSequence` · `loc_1880` · `runRivetBoardFinaleThenAdvanceLevel` · `advanceSequenceStepWhenTimerExpires` ·
  `buildHowHighScreen`
- **Opening cutscene** — `clearScreenAndSelectIntro` · `dispatchIntroCutsceneStep` ·
  `setupIntroCutsceneStep` · `runIntroClimbStep` · `animateIntroClimbStep` · `loc_0b06` ·
  `loc_0b68` · `runIntroRoarStep` · `scrollClimbGraphicStep`
- **Death & player switching** — `runDeathAnimationSubstate` · `dispatchDeathAnimationPhase` ·
  `beginMarioDeathAnimation` · `stepMarioDeathAnimation` · `losePlayer1Life` ·
  `restorePlayer1Context` · `restorePlayer2Context` · `selectPlayer1Context` ·
  `selectPlayer2AndComposeScreen` · `selectPlayerScreenOrAttract` · `armTwoPlayerBoardSetup`
- **Sound** — `soundDriverTick` · `silenceSound` · `triggerWalkSound`
- **Colour cycle** — `serviceColorCycle` · `advanceColorCycleSweep` · `dispatchColorCascadeByBoard` ·
  `resetColorCycleSweep` · `dispatchColorCyclePaint` · `runRivetColorCycleBlink` ·
  `blinkSpritePairOn` · `blinkSpritePairOff` · `blinkSpritePairByX`
