# Donkey Kong (Nintendo, 1981) — How It Works Inside

> **What this document is.** The *inside-out* companion to [`gameplay.md`](gameplay.md).
> That file is the day-zero, outside-in view — how Donkey Kong is *played*, from public
> sources, with no ROM opened. This one is how the machine *works*, re-derived from the code
> that is in this checkout right now: the readable routines in `idiomatic/`, the work-RAM and
> routine registries in [`idiomatic/ram.js`](idiomatic/ram.js), the frozen per-instruction
> oracle in `translated/`, the hardware layer in [`boards/dkong/`](../../boards/dkong/), and
> the grounding runs recorded in `scratchpad/`.
>
> **`gameplay.md` is the frame.** Every section below is reconciled against it — agreeing,
> sharpening, or (twice) contradicting it. Where the two disagree the disagreement is stated,
> not smoothed over.
>
> **This file is rewritten from scratch after every understanding pass** — never patched. See
> [`docs/decompiler-pipeline.md`](../../docs/decompiler-pipeline.md) ("RULE — every
> understanding pass REWRITES `mechanisms.md`") and [`docs/understanding.md`](../../docs/understanding.md)
> step 7. Every number in §1 was measured against this working tree while writing, with the
> command that produced it; none was carried forward from the previous map.
>
> **Confidence tags are on CLAIMS, not on cells.** Each non-obvious mechanism claim carries:
> - **`[seen]`** — observed on the real ROM under MAME (a control-poke, an A/B with a negative
>   control, or a pixel diff). The strongest evidence here.
> - **`[code]`** — read out of the decompiled routine, the frozen oracle, or the ROM's own data
>   tables. The *mechanics* are exact; the *role* is inference from them. **A number our own
>   harness produced lives here too**: a dispatch count from `new Machine(ROM).runFrames(...)`, or
>   any idiomatic-vs-oracle equality, is this port replaying the ROM — good evidence about the
>   port, and circular as evidence about the arcade machine. Those are written "**harness
>   replay**", never "attract run", so the provenance cannot be misread.
> - **`[guess]`** — plausible, unverified. Never to be relied on.
>
> **What this file does NOT own.** A work-RAM cell's name, role and confidence live in exactly
> one place — `idiomatic/ram.js` — and a routine's one-line role lives in that file's `ROUTINES`
> map. This document describes *mechanisms* and cites cells by their registry names; it never
> restates a cell's registry status. That boundary is enforced by
> `tools/names_consistency.py` (see [`docs/names-registry.md`](../../docs/names-registry.md),
> "One source per fact").

---

## 1. Measured state of the port

Everything in this section was produced by running the command beside it against this working
tree. Re-run them before quoting any of it.

| Metric | Count |
|---|---:|
| ROM routines in the frozen `translated/` oracle (`loc_XXXX.js`) | **429** |
| — of which have a readable `idiomatic/` module | **429 (100%)** |
| Addresses registered in `ROUTINES` (`idiomatic/ram.js`) and wired live | **389** |
| — carrying an earned English name | 302 |
| — still address-named `loc_XXXX` | 87 |
| Idiomatic modules written but **not** registered in `ROUTINES` | **40** |
| `ROUTINES` confidence split | 362 `code` / 27 `seen` / 0 `guess` |
| `export const` entries in `ram.js` | **184** |
| — work-RAM cells (inside 0x6000–0x6BFF) | 168 |
| — object/sprite **record field offsets** (not addresses) | 16 |
| `ram.js` confidence split | 134 `[seen]` / 50 `[code]` / 0 `[guess]` |
| Per-routine memory-equivalence tests | 427 |

```sh
# routine coverage + registry split
node --input-type=module -e '
const fs=await import("node:fs"); const {ROUTINES}=await import("./games/dkong/idiomatic/ram.js");
const T=fs.readdirSync("games/dkong/translated").filter(f=>/^loc_[0-9a-f]{4}\.js$/.test(f));
const I=new Set(fs.readdirSync("games/dkong/idiomatic").filter(f=>f.endsWith(".js")));
const have=T.filter(f=>{const a=parseInt(f.slice(4,8),16);return I.has(f)||(ROUTINES[a]&&I.has(ROUTINES[a].name+".js"));});
const cert={}; for(const r of Object.values(ROUTINES)) cert[r.cert]=(cert[r.cert]||0)+1;
console.log("translated",T.length,"with idiomatic",have.length,"ROUTINES",Object.keys(ROUTINES).length,
 "english",Object.values(ROUTINES).filter(r=>!/^loc_/.test(r.name)).length,"cert",JSON.stringify(cert));'
# named work-RAM cells, using the names-consistency gate's own definition of "named"
python3 -c 'import sys;sys.path.insert(0,"tools");import names_consistency as n;
print(len(n.named_workram(open("games/dkong/idiomatic/ram.js").read(), n.workram_window("dkong"))))'
```

### The honest floor

Three separate things are true at once, and only the first is "done":

1. **Lifting is complete.** Every one of the 429 ROM routines the disassembler emits has a
   readable module and (for 427 of them) its own memory-equivalence gate against the frozen
   oracle. The two without a per-routine gate are `boot` (ROM 0x0000) and `mainLoop`
   (ROM 0x02BD) — the coroutine spine, gated whole by `idiomatic/test/golive.test.js`
   instead. **There is no "biggest not-yet-lifted block" any more**; the previous map named
   `0x1F00–0x2E00`, the actor/object AI, and that block is lifted. `[code]`

2. **Wiring is not.** `resolveAllIdiomatic()` — what the shipping player uses
   (`manifest.js` declares `runtime: "idiomatic"`, and `web/worker.js` runs it under
   `runGeneratorGame`) — builds its override map **from `ROUTINES` alone**. The 40 modules
   that are not in `ROUTINES` are therefore *not executed*: at those addresses the live
   machine still runs the frozen oracle. They are written, reviewed and gated; they are not
   yet live. `[code]`

   They are not scattered — they are six coherent clusters (2 + 27 + 3 + 3 + 3 + 2 = 40), each
   blocked on the same registration step:

   | cluster | addresses |
   |---|---|
   | the per-frame gameplay cascade + its attract entry | `0x1977`, `0x197A` |
   | the 25m barrel object walk (ten `OBJ_ARRAY_67` slots and every branch of it) | `0x1F72`, `0x1F83`, `0x1F8D`, `0x1F93`, `0x1FAC`, `0x1FCE`, `0x1FE5`, `0x1FEF`, `0x1FF6`, `0x202F`, `0x2038`, `0x2053`, `0x2079`, `0x2083`, `0x20A2`, `0x20B5`, `0x20C3`, `0x20E1`, `0x20EC`, `0x2101`, `0x2104`, `0x2118`, `0x2146`, `0x2153`, `0x215F`, `0x21BA`, `0x24B4` |
   | the five-slot fire pass below `loc_30ed` | `0x31B1`, `0x3202`, `0x333D` |
   | the airborne-frame resolver and its object-collision follow-up | `0x1C05`, `0x2B1C`, `0x29AF` |
   | the task dispatcher, its inline-jump trampoline, and task 5 | `0x00CA`, `0x02E3`, `0x062A` |
   | the 25m barrel-release entry and the fire pass head | `0x2C8F`, `0x30ED` |

   ```sh
   node --input-type=module -e '
   const fs=await import("node:fs"); const {ROUTINES}=await import("./games/dkong/idiomatic/ram.js");
   const reg=new Set(Object.values(ROUTINES).map(r=>r.name));
   console.log(fs.readdirSync("games/dkong/idiomatic")
     .filter(f=>/^loc_[0-9a-f]{4}\.js$/.test(f)&&!reg.has(f.slice(0,-3))).join(" "));'
   ```

3. **The readable layer is not yet self-contained.** Eighteen call sites inside `idiomatic/`
   still reach the callee by importing the frozen oracle (`from "../translated/loc_XXXX.js"`)
   even though that address *is* registered and has a readable twin. Behaviour is unaffected
   (the oracle is what the twin is gated against) but a reader following the call lands in
   per-instruction code. `docs/reviewer-rules.md` carries this as a standing review rule; the
   count is re-derived here rather than remembered:

   ```sh
   node --input-type=module -e '
   const fs=await import("node:fs"); const {ROUTINES}=await import("./games/dkong/idiomatic/ram.js");
   let n=0; for(const f of fs.readdirSync("games/dkong/idiomatic").filter(f=>f.endsWith(".js")))
     for(const m of fs.readFileSync(`games/dkong/idiomatic/${f}`,"utf8")
        .matchAll(/^import .*from "\.\.\/translated\/loc_([0-9a-f]{4})\.js";/gm))
       if(ROUTINES[parseInt(m[1],16)]) { n++; console.log(f,"->",m[1],ROUTINES[parseInt(m[1],16)].name); }
   console.log("stale:",n);'
   ```

And one measurement about *understanding* rather than code. Net (a) of the enumeration in
`docs/understanding.md` is written for `mem8[0x…]` bracket syntax, which this port does not use
— run as written it finds nothing, which is a fact about the regex and not about the code. Run
in this port's own accessor form (`mem.read8/write8/read16/write16(0x6xxx)`, comments stripped,
registry cells excluded) it finds **15 unnamed work-RAM addresses still read or written as bare
hex** — `0x6209`, `0x620A`, `0x62AF`, `0x62B9`, `0x6350`, `0x6392`, `0x6910`, `0x6919`, `0x694D`,
`0x694F`, `0x6A20`–`0x6A23`, `0x6A25` — concentrated in `loc_18c6`, `initBoardState` and the
hit-effect latch. Net (b) finds **47 more addresses aliased to file-local `const`s that were
never centralized** into `ram.js`, **9 of them carrying conflicting local names across files**
(`0x62AF` alone has seven), which is exactly the "one routine's local view" the registry exists
to reconcile. Those 15 + 47 are the to-do list for the next naming pass; the sharpest are named
in §15.

```sh
# net (a) and net (b), in this port's accessor syntax, against the gate's own idea of "named"
python3 - <<'PY'
import re, os, sys; sys.path.insert(0, "tools"); import names_consistency as n
win = n.workram_window("dkong")
named = n.named_workram(open("games/dkong/idiomatic/ram.js").read(), win)
bare, alias = {}, {}
for f in sorted(os.listdir("games/dkong/idiomatic")):
    if not f.endswith(".js") or f == "ram.js": continue
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

**Address space** (`boards/dkong/memory.js`, transcribed from MAME's `dkong.cpp`, not
re-derived from observation): ROM `0x0000–0x3FFF`; work RAM `0x6000–0x6BFF` (note the bound —
`0x6C00–0x6FFF` is *not* RAM and a touch there throws); sprite RAM `0x7000–0x73FF`; tilemap RAM
`0x7400–0x77FF`; the i8257 DMA at `0x7800–0x780F`; and the I/O strip `0x7C00–0x7D87`. Three
modelling rules that layer exists to enforce: a read and a write at the same address are
*different devices* (`0x7C00` reads IN0 and writes the sound-tune latch); a read is not
necessarily pure (reading `0x7D00` kicks the watchdog, which is how the dog is fed — once per
vblank, as an interrupt side effect); and unmapped access throws loudly. `[code]`

**The frame beat.** Everything time-critical hangs off the **vblank NMI**, not IM1 — the bytes
at 0x0038 are an ordinary subroutine (`addToSpriteObjectColumn`, the `rst 0x38` vector;
`addStrided` is the generic loop it falls into at ROM 0x003D). Once per frame `serviceVblankNmi`
(ROM 0x0066) acknowledges the interrupt by clearing the enable latch (which also blocks
re-entry), kicks the watchdog, blits the sprite shadow buffer through the DMA, reads the
joystick *only while a credited game is in play*, and tails into `perFrame` (ROM 0x00B5).
`perFrame` **decrements** `FRAME`, stirs the PRNG, services coins and the sound countdowns, and
dispatches `GAME_STATE` through a four-entry table. `[code]`

**The main loop is a task scheduler, and it is where the game actually runs.** `mainLoop`
(ROM 0x02BD) walks a task table in page 0x60, dispatches any queued task, does the per-frame
work, then spins comparing `FRAME` against its own latched copy `FRAME_SEEN` — the wait-for-vblank.
The NMI's decrement of `FRAME` is what releases it. `SPIN_COUNT` is bumped once per loop pass
(~140×/frame, and its *jitter* with workload is the point — it feeds the PRNG). In this port
`mainLoop` is a **generator**: it `yield`s at exactly the points where the oracle's
cycle-driven engine fires the NMI, which is what makes the readable layer runnable without a
cycle model. `[code]` (the frame-by-frame equality is what `golive.test.js` asserts — but note
what that gate compares: **the idiomatic spine against the frozen translated oracle**, our JS
against our JS, over 600 attract frames. It is a fact about this port's internal consistency,
not an observation of the arcade machine, so it earns `[code]` and not `[seen]`.)

**Four dispatch layers, all `rst 0x28` inline jump tables**, and it is worth knowing which is
which because almost every "how does control get there" question resolves to one of them:

| level | selector | table | arms |
|---|---|---|---|
| top | `GAME_STATE` | ROM 0x00CA | 0 power-on, 1 attract, 2 credited, 3 in-game |
| in-game | `GAME_SUBSTATE` | ROM 0x0702 | 23 live handlers across indices 0x00–0x17 — 24 words, of which index 0x09 is `0x0000`; the table is padded to 29 words |
| attract | `GAME_SUBSTATE` | ROM 0x0748 | 8 live handlers, indices 0–7 |
| within a state | a per-machine step byte | various | e.g. `INTRO_STEP` → ROM 0x0A7A, `BOARD_ADVANCE_STEP` → ROM 0x1623 / 0x1637 / 0x1648 |

`[code]` (tables read directly out of `rom/maincpu.bin`)

**The task ring** decouples "something happened" from "redraw it". `enqueueTask` posts a
two-byte `[opcode, argument]` message into a 32-slot ring at `TASK_RING`, with `TASK_TAIL` /
`TASK_HEAD` as the pointers and `0xFF` marking a free slot; the main loop consumes one per pass
and frees both bytes. Seven opcodes exist (handler table at ROM 0x0307): 0 add-to-score,
1 reset a score counter, 2 draw a score, 3 draw a vertical string, 4 draw the credit line
(attract only), 5 the bonus-readout step, 6 draw lives and level. A full ring silently drops
the request. **Points are never added inline** — a hit posts `[0, index]` and the main loop
credits it later, which is why scoring is decoupled from collision. `[code]`

---

## 3. From power-on to a played board

`GAME_STATE` walks 0 → 1 → 2 → 3 and the whole start-up is that walk. `[seen]` (the cell's
own transitions were observed live)

- **0 — power-on.** `powerOnInit` / `clearRamAndInitHardware`: wipe all RAM, fill the task ring
  with `0xFF`, set the display latches, silence the sound, hand the game its stack.
  `decodeDipSwitches` unpacks DSW0 into `DIP_LIVES` (3–6), `DIP_BONUS_LIFE` (7000/10000/15000/20000),
  the coinage cells and `DIP_UPRIGHT`. `[code]`
- **1 — attract.** `runAttractState` has exactly two jobs: if `CREDITS` is non-zero, reset the
  sub-state and step to state 2; otherwise run the current attract sub-state (§13). `[code]`
- **2 — credited.** `enterCreditScreen` puts up the start-select screen; `readStartButtonSelector`
  watches for 1P/2P; `commitGameStart` spends the credit(s), seeds the player context records,
  wipes the screen and moves to state 3. `TWO_PLAYER_GAME` is written **exactly once**, here, as
  the high byte of one 16-bit store. `[code]`
- **3 — in-game.** `dispatchInGameSubstate` vectors `GAME_SUBSTATE` through ROM 0x0702. The
  indices that matter: `0x07` opening Kong-climb cutscene, `0x08` "HOW HIGH CAN YOU GET?",
  `0x0A` board build, `0x0B` spawn Mario, `0x0C` **gameplay**, `0x0D` the death-animation
  router, `0x0E` player-1 life loss, `0x14` player-screen / fall-back-to-attract, `0x16`
  **board cleared / advance**. `[code]`

Coins are their own little machine: `serviceCoinInput` debounces IN2 bit 7 against the
`COIN_EDGE` latch (so holding the coin line cannot repeat-credit), accumulates `COINS_PARTIAL`
until it reaches `DIP_COINS_PER_CREDIT`, and awards `DIP_CREDITS_PER_COIN` BCD credits capped
at 0x90. `[seen]`

---

## 4. The world: boards, the order table, and the level loop

`BOARD` is 1 = 25m girders, 2 = 50m conveyors, 3 = 75m elevators, 4 = 100m rivets. `[seen]`

**The board order is a ROM table, and it disagrees with the outside-in view.** `BOARD_SEQ_PTR`
is a 16-bit pointer initialised to ROM 0x3A65 and stepped one byte per completed board; the
byte it lands on is copied straight into `BOARD`. Read out of `rom/maincpu.bin`, the table is:

```
0x3A65: 01 04                  L1   25m, 100m
0x3A67: 01 03 04               L2   25m, 75m, 100m
0x3A6A: 01 02 03 04            L3   25m, 50m, 75m, 100m
0x3A6E: 01 02 01 03 04         L4   25m, 50m, 25m, 75m, 100m
0x3A73: 01 02 01 03 01 04      L5+  25m, 50m, 25m, 75m, 25m, 100m   <- the wrap target
0x3A79: 7F                     terminator
```

`[code]` **`gameplay.md` §4 says it in two sentences — *One full "level" is four distinct
single-screen stages, labelled by height.* and *The canonical arcade order is 25 m → 50 m →
75 m → 100 m.* The code says the *type order* is right but the *set* is not:
a level is 2 boards at L1, 3 at L2, 4 at L3, 5 at L4, and 6 from L5 on** — 25m is revisited
inside the later levels, and 50m does not appear at all until level 3. Only level 3 is the
"four stages in order" the public sources describe. This is an inside-out correction to the
public record, not a disagreement between sources.

**The loop.** Hitting the `0x7F` terminator reloads the pointer to **0x3A73**, the head of the
L5+ group — so from level 5 on the same six-board group repeats forever. `[code]` `[seen]`
(a played run reached 100m → wrap → 25m with `LEVEL` incrementing, frame-for-frame against
MAME)

**`LEVEL` increments exactly once per 100m clear — and that is a structural fact, not a
counter.** There are two places that walk `BOARD_SEQ_PTR` forward, and only one of them
touches `LEVEL`:

- `advanceToNextBoard` (ROM 0x178E) is the last entry of the **25m/75m** table (ROM 0x1623)
  and of the **50m** table (ROM 0x1637). It walks the pointer, publishes `BOARD`, and arms the
  how-high interlude. It does **not** touch `LEVEL`.
- `loc_18c6` (ROM 0x18C6) is the last entry of the **100m** table (ROM 0x1648). Its wrap arm
  walks the pointer *and* does `LEVEL := LEVEL + 1`, resets `HOW_HIGH_INDEX`, and clears
  `BOARD_ADVANCE_STEP`.

Since every level group in the table ends with `04` (100m), the level counter advances once per
group and never otherwise. `[code]`

**Difficulty** is a separate, faster knob: `DIFFICULTY = min(LEVEL + (DIFFICULTY_CLOCK >> 3), 5)`,
recomputed every 8th tick of a 256-frame prescaler and reset at each board build. So the same
board gets meaner the longer you dawdle *on it*, and each loop starts meaner — `gameplay.md`'s
qualitative "faster, sometimes diagonal" as a clamped 1–5 value that the hazard code reads
directly. `[seen]` (the cell's values and cadence were measured live)

---

## 5. Building and drawing a board

`buildBoard` (ROM 0x0C92) wipes the playfield, arms the palette bank, queues the opening task
and dispatches to the per-board setup arm; each arm selects its layout table and background
tune and converges on a shared tail that runs `initBoardState` and the layout renderer.
`[code]`

`initBoardState` (ROM 0x0F56) is the common reset: zero the player/motion block and the whole
object + sprite span, copy a 0x40-byte board-object template from ROM 0x3D9C over the head of
it, compute the bonus values (§10), stamp two constant hit-box bytes, seed three decorative top
sprites on every board except 100m, and dispatch to the per-board object seeding
(`seed25mBoardObjects` … `seed100mBoardObjects`). `[code]`

**The layout renderer** walks a ROM segment table: `drawBoardLayout` → `loc_0dd3` converts each
record's endpoints to tilemap addresses through `tileAddrForPixel`, computes the run deltas into
the `SEG_*` scratch cells, and dispatches by record kind — kind 0/1, kind 2, kind 3, kinds 4/5/6.
`[code]`

> ### ★ `drawGirderSpan` and `drawLadder` are exactly inverted — proven, deliberately not renamed
>
> A held write-tap on tilemap VRAM, with a mode that replaces each routine's written tile with
> the blank `0x10`, was run on the real ROM under MAME 0.288 (`scratchpad/grounding-object-arrays.md`
> §4). Suppressing **ROM 0x0E19 — the routine currently named `drawGirderSpan` — removes 616 px,
> and they are the LADDERS** (the two full-height ladders beside Kong plus eight shorter
> segments; not one girder pixel changes). Suppressing **ROM 0x0E4F — currently named
> `drawLadder` — removes 6256 px, and they are the GIRDERS** (every sloped platform on the
> board; not one ladder pixel changes). The write signatures agree: 0x0E19 lays 22 writes of the
> uniform tile 0xC0 in short `+1` runs with zero VRAM-row spread; 0x0E4F lays 304 writes from the
> 0xE0/0xF0 slope-tile band with `+31/+32` steps and a row spread up to 25. Under ROT270 the
> `+1` axis is the *displayed vertical* and the `+0x20` axis the *displayed horizontal*, so
> 0x0E19 draws short vertical runs and 0x0E4F draws long sloped horizontal ones. **`[seen]`**
>
> **The two names were deliberately left as they are.** Swapping them is its own landable unit —
> it touches both routines, their callers, their gate names and the prose around them — and it
> was not folded into the naming pass that found it. Until that unit lands, read every
> occurrence of `drawGirderSpan` as *the ladder drawer* and every occurrence of `drawLadder` as
> *the girder drawer*. This paragraph exists so the next reader is not misled by the file names.
>
> **But no role anywhere asserts the refuted mechanism.** Leaving the names alone is not the
> same as leaving a falsehood in the registry, so both `ROUTINES` entries — and `loc_0dd3`'s,
> and the three file headers — now open with `NAME INVERTED (rename pending):` and then state
> what the routine actually draws, with the pixel evidence, at `cert: "seen"`. The rename unit
> deletes that prefix and swaps the two `name:` fields; no half-corrected state survives it.

A useful downstream consequence: the ladder/girder *table* is the same one `findOppositeLadderEnd`
scans — `loadBoardObjectRecords` de-interleaves the very ROM tables the layout renderer walks
(25m 0x3AE4, 50m 0x3B5D, 75m 0x3BE5, 100m 0x3C8B) into the work-RAM object-parameter arrays that
lookup reads. So the *word* "ladder" in `startBarrelDescentAtLadder` and in the fire excursion
machine (§8) is **`[seen]`** rather than structural inference — the drawer of exactly the kind-0/1
records those routines key on was pixel-confirmed to draw ladders. The surrounding gating chains
in §8 remain `[code]`; only the actor word is promoted.

---

## 6. The cast: object records, the arrays, and who is who

**Mario is privileged; everything else is a record in an array.** Mario has his own motion block
at 0x6200–0x6226 and his own 4-byte hardware sprite record (`MARIO_SPRITE_RECORD`). Every other
moving thing — barrels, fires, springs, elevator platforms, cement pans, the hammers, the
floating score glyph, the interlude cast — is a fixed-stride record in one of a handful of
work-RAM arrays, mirrored each frame into the **sprite shadow buffer** (`SPRITE_BUFFER`, 96
records × 4 bytes) and blitted to sprite RAM by the i8257 on the vblank DRQ edge. `[code]`

The shared record fields are registry-named (`OBJ_ACTIVE`, `OBJ_X`, `OBJ_Y`, `OBJ_SPRITE_CODE`,
`OBJ_SPRITE_ATTR`, `OBJ_STATE`, `OBJ_HIT_EXTENT_X/Y`, `OBJ_INSERT_REQUESTED`,
`OBJ_WALK_PTR_LO/HI`) and are the reason the arrays can share collision, gather and animation
code. Note the trap the registry is careful about: offsets ≥ 0x10 are in-record only for the
stride-0x20 arrays and alias the *next* record on the stride-0x10 ones.

### Which array is which actor

| array | stride × records | live on | what it holds | evidence |
|---|---|---|---|---|
| `OBJ_ARRAY_67` (0x6700) | 0x20 × 10 | 25m only | **the BARRELS** | `[seen]` |
| `OBJ_ARRAY_64` (0x6400) | 0x20 × 5, **7 on 100m** | all four boards | **the FIRES** (a two-frame sprite pair ×flip; a *different* pair on 100m — see below) | `[seen]` identity / `[code]` the 100m extent |
| `OBJ_ARRAY_65` (0x6500) | 0x10 × 10 | 75m (records 0–1) | the springs — horizontally bounding, X sweeps 213 distinct values | `[code]` |
| `OBJ_ARRAY_66` (0x6600) | 0x10 × 6 | 75m (all six) | the elevator platforms — X pinned to `{55, 119}`, Y sweeping | `[code]` |
| `OBJ_ARRAY_65A0` (0x65A0) | 0x10 × 6 | 50m (records 0–2) | the cement pans — X sweeps the full width, Y row-fixed, culled at the edge | `[code]` |
| `OBJ_PAIR_6680` (0x6680) | 0x10 × 2 | 25m/50m/100m | the two hammers | `[code]` |
| `OBJ_RECORD_66A0` (0x66A0) | single | 25m, 50m | the board's fixed hazard; on 25m its constants are X=39, Y=224 and the 25m fire activates at (39, **232**) every time — same X, 8 px lower | `[seen]` the constants and the spawn point / `[code]` that the two are the same object, and "oil drum" |
| `BOARD_OBJ_SCRATCH` (0x6280) | 0x08 × 2 | 50m | the two vertically-travelling 50m objects — **what they ARE is still open** (§8, §15) | `[seen]` the machine + geometry / `[guess]` identity |

> ### ★ The fires and the barrels: what was and was not observed
>
> `OBJ_ARRAY_64 = the FIRES` and `OBJ_ARRAY_67 = the BARRELS` were established on the real ROM
> under MAME 0.288, on a **zero-poke, naturally-played 25m run**, with A/B in both directions
> (`scratchpad/grounding-object-arrays.md`). What was observed:
>
> - **Kill `OBJ_ARRAY_64`** (force all five records' `+0` to 0): the fireball is gone from the
>   screen entirely — 0 of 40 sampled frames, 0 px — while the barrels are statistically
>   untouched (616 barrel px / 333 motion, against a baseline of 616 / 328).
> - **Kill `OBJ_ARRAY_67`**: barrel motion collapses 328 → 29 and no new barrel is produced,
>   while the fireball is untouched (34/40 frames vs 35/40 baseline). The 489 px that remain
>   are stale records frozen in the DMA shadow buffer.
> - **Tight A/B** (intervene at f1200, capture from f1195): frames f1195–f1204 are bit-identical
>   between arms; `kill64`'s first differing frame carries a blob at cols 101–114, rows
>   231–245 — the fire record's logged position to the pixel; `kill67`'s carries four blobs, all
>   at logged barrel positions and none at the fire's. **`kill64`'s frame carries a *second*
>   blob**, at the oil drum (cols 17–31, rows 217–231), which the report reads as an
>   animation-phase difference in the drum's own flame rather than a fire sprite — and it says
>   in as many words *"I did not chase which counter drives it."* That residue is unexplained
>   and is carried here rather than dropped.
> - **Positional correlation on all four boards** — 25m from the natural credited game, while
>   the 50m/75m/100m long-dwell frames come from a `docs/POKE-TO-ADVANCE.md` board pre-set (the
>   same boards were also reached by real completion in the progression tape and give the same
>   answer): boxes drawn at the logged record positions land on a fireball (red) or a barrel
>   (cyan) and nothing else — 75m shows exactly 2 fire
>   records for all 2176 gameplay frames, 100m spawns up to 5, one every 128 frames. Sprite
>   codes differ per board: `{0x3D,0x3E}`×flip on 25m/50m/75m, `{0x4D,0x4E}`×flip on 100m,
>   **and that is all that was measured — nothing measured SIZE.** `gameplay.md` §7 (public
>   sources only) calls the 100m actor "a larger fireball variant on the rivet stage"; equating
>   that with the different sprite pair is `[guess]`, not part of this `[seen]`.
> - **The fire is born at the oil drum**: the single 25m record activates at (X=39, Y=232) every
>   time, and `OBJ_RECORD_66A0`'s board-1 constant X is 39.
>
> **The honest floor, stated because it is load-bearing.** The *positive* control on
> `OBJ_ARRAY_64` — pinning the records' `OBJ_X` every frame — is a **no-op**: 359 of 360 frames
> stayed pixel-identical to baseline, because the ROM recomputes that byte each frame from state
> held elsewhere. So the fire identity rests on the **kill** control plus per-frame positional
> correlation, **not** on a coordinate command. (`OBJ_ARRAY_67` *does* have a working positive
> control: pinning its X parks every barrel at the commanded column and moves nothing else.)
> The kill is a spawn-suppressor and a freeze, not an eraser. Records not exercised:
> `OBJ_ARRAY_67` records 6–9 were never active **together** in any run — the census tops out at
> **9 simultaneously live**, so records 0–8 all fired at some point and only record 9 was never
> seen active; `OBJ_ARRAY_64` record 4 only on 100m. So the per-record grounding covers
> `OBJ_ARRAY_64` 0–4 and `OBJ_ARRAY_67` 0–8 — and note that the 0–4 bound is a property of the
> **logger**, which sampled five `OBJ_ARRAY_64` records: the ROM seeds records **5 and 6** on
> 100m (§9), and those two were never observed at all. Not tested at all: 2-player, difficulty 5, levels
> above 4, the cocktail/flip path. **And the per-board fire counts are level-dependent**: the
> 50m maximum differed between runs (2 live at L2, 3 at L3), so "exactly 2 on 75m" and "up to 5
> on 100m" are as observed at the levels driven, not a ceiling.

**The gather path.** Each subsystem mirrors its records into the shadow buffer in its own way —
`publishFireSprites` gathers the five fire records into 0x69D0; `update50mMovingObjects`
refreshes the six 50m sprites at `OBJ_65A0_SPRITES`; `update75mActorObjects` mirrors into
`ACTOR_SPRITES`; `writeMarioSpriteRecord` refreshes Mario's. `blitSpritesViaDma` then programs
the i8257 (ch0 src 0x6900, ch1 dst 0x7000, count 0x180) once per vblank. `[code]` `[seen]`
(the sprite-record ↔ source-cell identities were checked byte-exact against MAME)

---

## 7. Mario

**One router, five tests, and the ORDER is the mechanic.** `dispatchMarioMovement`
(ROM 0x1AC3) writes nothing itself; it picks who owns the frame, first match wins:

1. `MARIO_AIRBORNE` → the airborne handler. A jump or fall owns the *whole* frame, input
   included — which is why a jump cannot be steered onto a ladder or re-triggered in mid-air.
2. `MARIO_FREEZE_TIMER` non-zero → tick it down and nothing else (the few unresponsive frames
   after a landing).
3. `MARIO_HAMMER_ACTIVE` → the **ground walk** arm. Note *where* this sits: **above** the ladder
   test and above the jump test (ROM 0x1AD1 reads `MARIO_HAMMER_ACTIVE`, 0x1AD8 reads
   `MARIO_ON_LADDER`, 0x1ADF reads the input word), so while the hammer is held the frame is
   claimed before the climb and jump tests are ever reached, and a hammer-carrying Mario can only
   walk. **That single ordering is the entire cost of the hammer** — `gameplay.md` §5's "cannot
   jump, cannot climb, cannot drop it" is one branch position, not three separate rules. `[code]`
   (The equivalence gate's own tooth for this is a twin that moves the hammer arm *below* the
   jump test, which lets a hammer-carrying Mario jump — below is the broken twin, not the ROM.)
4. `MARIO_ON_LADDER` → the climb dispatch (Down arm first, then Up).
5. the jump press-edge bit of `P1_INPUT` → launch the arc.
6. otherwise → ordinary grounded walking (which is also how he steps onto a ladder).

Every test is exact rather than a range, and the equivalence gate drives all 256 values through
each selector to pin that. `[code]` (a plain 2000-frame **harness replay** — `new Machine(ROM)`
run forward under our own engine, not MAME — dispatches this 1197× and reaches all six arms)

**Walking** is paced by `MARIO_MOVE_STEP_TIMER`: while it is non-zero Mario slides one pixel per
frame; at zero the walk-cycle index `MARIO_WALK_ANIM` advances and a new step begins with the
facing bit set or cleared. On 25m the girders are sloped, so `snapYToGirder` nudges his Y one
pixel along the slope as he walks. `[seen]`

**Climbing** runs `advanceClimbStep` with `MARIO_CLIMB_LIMIT_A/B` as the pair of ladder extents:
the step stops and clears `MARIO_ON_LADDER` when (newY + 8) equals either limit.
`centerMarioAndCommitClimbStep` snaps him onto the ladder column and ticks the alternating
footstep. **A pose is not enough — to climb, Mario must actually walk to the ladder's X**; the
centering snap is applied *during* a climb step, not as a way to enter one. `[seen]`

**Jumping and falling** share one ballistic integrator. `initMarioJump` picks the horizontal
launch velocity from the held direction; `launchMarioJump` writes the airborne record, sets the
jump pose, snapshots `MARIO_AIR_START_Y` and fires the jump sound. Per airborne frame,
`stepBallisticMotion` applies `ΔY16 = −(V + 8 − 16n)` with `V = MARIO_AIR_VY_HI/LO` constant
across the arc and `n = MARIO_AIR_FRAMES` — verified exact, including after poking `V`, over 142
airborne frames. At `MARIO_AIR_FRAMES == 0x14` the fall-height check arms
(`MARIO_AIR_LANDCHECK`); `markFatalFallByHeight` latches `MARIO_FATAL_FALL` once he is more than
0x0F px below where he took off, and the landing consumes it as
`MARIO_ACTIVE = MARIO_FATAL_FALL XOR 1`. **"Falling too far kills you" is that one XOR.**
`[seen]`

**The horizontal gate is not a screen edge.** `limitMarioHorizontalTravel` classifies Mario's X
into a two-flag verdict that all three consumers turn into a restraint. Its left verdict also
fires for an *interior* wall — odd `BOARD`, Y < 0x58, X < 0x6C, the left end of the top platform
on 25m and 75m — and the airborne reflection (`reverseMarioVerticalArc` plus its horizontal
half) re-bases the parabola in place rather than clamping. A fall already latched lethal skips
the re-base and keeps falling. `[code]`

**Losing your footing.** `startMarioFallWhenGroundGivesWay` probes the tile under Mario's foot
while he is in plain grounded contact; if the girder there is not level it defers to
`decideSlopeGirderFooting`, which either keeps his footing or calls `triggerMarioFall` to raise
`MARIO_START_FALL`. `beginMarioFall` consumes that one-shot next frame and drops him with zero
initial velocity. `[seen]` (the trigger was caught firing on 75m only, never on 25m, whose
girders are continuous)

---

## 8. The four boards, subsystem by subsystem

Every hazard subsystem is board-gated by the same `rst 0x30` mask idiom, which is why the whole
cascade can be dispatched on every board and only the right parts run.

### 25m — girders, barrels, the oil drum, and the fires

**Kong's throws are scheduled against the bonus, not a clock.** `scheduleBarrelRelease`
(ROM 0x2C03) runs only on 25m, only while Mario is alive, and only while the cluster's event
gate is clear. It then weighs the live `BONUS` against `BONUS_START` and matches the low five
bits of `FRAME` against a `DIFFICULTY`-length countdown — so the throw *rate* rises with
difficulty — before dispatching into the slot-claim cluster at ROM 0x2C41.
`releaseBarrelIntoFreeSlot` (ROM 0x2CB8) claims the free `OBJ_ARRAY_67` record the scan stopped
on, marks it occupied, aims the release renderer at it, latches the one-shot event gate, **and
charges the release against `BONUS`**. `[code]`

> ★ **On 25m the barrel release IS the bonus clock.** `BONUS` ticks down by the timed decrementer
> on boards 2/3/4; on board 1 it is charged by this routine instead. So on the
> girder board the timer falls per barrel thrown, not per unit of time — a mechanic
> `gameplay.md` §6 has no way to see from the outside, and one that makes "bank bonus time" and
> "dodge more barrels" the same quantity. `[code]`

**Two barrel kinds.** `BARREL_CLAIM_MODE` bit 7 selects which of two sprite/behaviour triples is
stamped into the claimed record — bit7=0 → code/attr/mode `0x15/0x0B/0x00`, bit7=1 →
`0x19/0x0C/0x01`, with 46/46 agreement live, and the two kinds coexisted on screen for 372
frames carrying different palettes. `markNextBarrelAsAltKind` sets that bit exactly one frame
before each alternate-kind claim. **Bit 0 is a different, independent selector** — the
waypoint-table choice (one-waypoint table at ROM 0x39CC vs the four-waypoint table at 0x39C3),
not the kind. Which named Donkey Kong object each kind is was deliberately not established.
`[seen]` for the bit-7 → sprite-triple mapping; `[code]` for the bit-0 split.

**The per-frame barrel walk** is the ten-slot sweep at ROM 0x1F72 (25m only). Its per-slot gate
hands every active record to `loc_1f93`, which picks one of five behaviours from **two record
bytes, the first outranking the second**: the select byte (`+1`) is tested for equality with 1,
and only if that fails are the low three bits of the mode byte (`+2`) walked lowest-first. The
five arms are the horizontal step (forward and backward), the arc/ballistic travel, the scripted
travel, and the airborne step; all rejoin a shared tail that re-glues the record to the girder
slope, refreshes its sprite orientation and steps the walk on. `[code]`

**Wild barrels.** `startBarrelDescentAtLadder` (ROM 0x216D) is the "sometimes it comes down the
ladder" decision. It looks the barrel's column up in the ladder (type-0 object) table through
`findOppositeLadderEnd`, always stamps the descent target, then runs a chain of gates to decide
whether the barrel *also* starts down: a difficulty-weighted random throttle, whether Mario has
descended far enough, and then a comparison of Mario's column against the ladder's — exactly on
it always goes, past it goes if Left is held, before it goes if Right is held, and a final
random gate decides otherwise. **The barrel's choice of ladder is a function of where Mario is
and which way he is pushing.** `[code]` for the gating chain; **`[seen]` for the word "ladder"** —
the records this routine keys on through `findOppositeLadderEnd` are the same ROM kind-0/1 records
ROM 0x0E19 draws, and suppressing 0x0E19 removes exactly the ladders (§5). This is `gameplay.md`
§7's "wild/crazy barrels", and the inside view says they are not random — they are aimed.

**The fires.** `animateFixedHazardAndReleaseFire` (ROM 0x03A2) runs off the main loop on boards
1 and 2, animates the fixed hazard record, and on its inner counter's underflow raises
`EVENT_REQ_313C` — a request for a *new* fire. `spawnRequestedFireAndRecolorLiveFires`
(ROM 0x313C) is the only routine that *spawns* one of these objects during play: it sweeps the
five records, tallies the live ones into `OBJ_LIVE_COUNT`, sets each live record's sprite
attribute (**cleared while Mario's hammer is active** — the hammer visibly recolours every live
fire), services one pending request into a free slot, and returns a caller-skip when the array
came out empty. `[seen]`

**Spawning is not the only way a fire comes to exist**, and the distinction matters when reading
a board's fire census. `seed75mBoardObjects` (ROM 0x1087, the board-3 arm of the ROM 0x0FCD
`rst 0x28` table) *activates two `OBJ_ARRAY_64` records outright at board build* —
`ld ix,0x6400` then `ld (ix+0),1` and `ld (ix+0x20),1`, with their X/Y pairs stamped alongside.
That is why 75m shows exactly two fires for every one of its gameplay frames and never a third:
those two were seeded, not spawned, and ROM 0x313C never runs a request on that board. `[code]`
(raw ROM bytes at 0x10E9 / 0x1101; a grep of `rom/maincpu.bin` finds `ld ix,0x6400` at exactly
one board-build site)

The per-fire state machine is `loc_30ed` → `loc_31b1` → `loc_3202`, and the interesting arm is
`loc_333d`: while a fire is on foot it looks its X up in the ladder table and takes the *other*
of the two heights that X is keyed to as its destination; while it is travelling it watches for
arrival — and "ladder" there is **`[seen]`** for the same reason as the barrel's (§5): it is the
same table, whose kind-0/1 records were pixel-confirmed to be the ladders. `OBJ_STATE` 0/1/2 = walking (`loc_33ad` steps the working X one pixel and flips the
sprite to match), 4 = descending, 8 = ascending. **The descent is conditional where the ascent
is not** — a fire only sets off downward while its row is above Mario's, so a fire level with or
below Mario never comes down. That asymmetry is what makes fires feel like they hunt upward.
`[code]` `tickFireTimerAndRerollDirection` reloads a 43-tick timer and re-rolls the travel
direction on a random bit; `armAlternateFireModeAtHighDifficulty` arms a second mode in records
1 and 3 once `DIFFICULTY ≥ 3` and a rare entropy draw comes up (that mode is deliberately not
named — nothing past its first gate has ever been observed firing). `[code]`

### 50m — conveyors, cement pans, and the two travelling objects

Three subsystems run here, and they are genuinely three:

1. **The conveyor rows themselves.** `update50mConveyorObjects` runs three reversal drivers
   (`M50_OBJ{1,2,3}_REVERSE_TIMER` / `_STEP_DIR`), each of which publishes a signed ±1/0 step
   shadow, and then `carryMarioOnConveyorRow` reads which row Mario stands on **by exact Y**
   (0x50, 0x78, 0xC8) and carries his X by that row's freshly-published step. The drivers must
   run before the carry; the row-2 case publishes a ± pair and picks the arm by Mario's X.
   **His walk step and the belt step are added independently in the same frame** — the per-frame
   cascade calls the movement router at ROM 0x1983 and the conveyor update at 0x19AD, and each
   writes `MARIO_X` — so walking against a belt should be slower than walking with it. `[seen]`
   for the drivers' cell values and cadence; `[code]` for the independent add, and the felt
   asymmetry itself has **not** been measured under MAME.
2. **The cement pans.** `update50mMovingObjects` services the spawn request
   (`OBJ_SPAWN_REQ` / `OBJ_SPAWN_TIMER`, a 0x7C-frame cooldown), then `advance50mObjectRow`
   steps each of the six `OBJ_ARRAY_65A0` records horizontally and culls it the moment it runs
   off the play area — either within seven pixels of the left edge, or, for the centre-split
   mover, at dead centre (X == 0x80). Culling clears the record and blanks its sprite. `[seen]`
3. **The two travelling objects.** `dispatch50mObjectState` picks one of the two 8-byte
   `BOARD_OBJ_SCRATCH` records by frame parity and runs a four-state machine on it: parked at
   the top of travel (counter 0x68) for a 256-frame dwell → sliding down to 0x78 → a randomised
   dwell at the bottom → rising back and re-parking. The vertical convention was grounded by
   forcing the record's published sprite byte to 40/104/120/200 and reading the resulting image
   rows: **larger is lower**, so 0x68 is the object's highest point. Each record carries a
   *column*, and the parked arm hit-tests Mario against that column, stamping a shared flag
   with 1 if the dwell just expired and 0 while it is still running. `[seen]` for the machine
   and its geometry.

   **What those two objects ARE is an open question** (§15). The shape — a column, a 16-pixel
   vertical travel, dwells at both ends, and a flag stamped only while Mario stands on that
   column, which the *climb* stepper then reads as a gate — reads as `gameplay.md` §4.2's
   retracting/extending ladders. That is `[guess]`, and the falsifiable prediction is stated in
   §15.

### 75m — elevators and springs

`service75mBoard` (ROM 0x26FA) is the board's router, and it is the clearest difficulty ramp in
the game. It first tests `MARIO_Y ≥ 0xF0` — the very bottom of the screen — and if so kills him
outright, **with no X-band test, so he need not be on a lift at all**. Otherwise it services on
a frame-counter cadence that *doubles after level 1*: at `LEVEL == 1` it advances the board
objects on `frame%4 == 0`, runs the vertical-reposition machine on `frame%4 == 1`, and idles the
other two frames; at every other level it alternates every frame with no idle. (The oracle's
test is `dec a / jp nz`, i.e. `LEVEL != 1` — `LEVEL 0` takes the *fast* cadence too.) `[code]`

`serviceBoardObjects` → `advanceBoardObjectTravel` drifts each of the six `OBJ_ARRAY_66`
elevator records one pixel vertically toward its limit and then lands or deactivates it;
`spawnBoardObject` claims a free slot on the `SPAWN_TIMER` cadence. Mario rides them through
`dispatchElevatorRideByColumn`, which gates on the lift flag and dispatches **by Mario's X**:
band 44–66 → `carryMarioUpWithLift` (`MARIO_Y − 1` each frame, or death once he passes the 0x71
limit), band 108–130 → `carryMarioDownWithLift` (`MARIO_Y + 1`, death at 0xE8). The elevator
records' observed X values are `{55, 119}` — one inside each band. `[code]` for the elevator
identification; the record liveness itself is `[seen]`. The third arm of that dispatch — neither
band — starts Mario falling and clears the flag, and has **never been observed executing**, so
what taking it means is unclaimed. `[code]`

The springs are `OBJ_ARRAY_65`, walked by `update75mActorObjects` (10 records, 75m only, while
Mario is alive): each object walks an animation string, and the terminator handler rewinds the
walk pointer to the string base and fires the wrap sound. Records 0–1 were live for 3711 frames
with X sweeping 213 distinct values; records 2–9 never activated in any run. `[code]` for
"springs"; the liveness and the sweep are `[seen]`.

### 100m — rivets

`RIVETS_LEFT` is initialised to **8** from the board template, and `RIVET_PRESENT` is the
8-flag array beside it — `gameplay.md` §4.4's eight rivets, exactly. `[code]`

`collectEdgeRivet` (ROM 0x1A33) is the pickup, and it is a **two-frame edge**, not a contact
test: if Mario stands on a screen-edge column (`MARIO_X == 0x4B` or `0xB3`) it only *arms*
`EDGE_RIVET_ARMED` and stops — nothing is collected on the edge frame. On a later frame, once
he has stepped off, it disarms the latch and builds a 3-bit slot index out of position bits
(row from `MARIO_Y−1`, side from `MARIO_X` bit 7), clears that `RIVET_PRESENT` slot, decrements
`RIVETS_LEFT`, blanks the rivet's three tilemap cells, and raises the collection flags
(`EFFECT_STATE`, `EFFECT_SELECT`, `ITEM_COLLECTED`). `[seen]` for the latch (154 toggles on 100m
against 5 elsewhere); `[code]` for the slot arithmetic.

The last rivet is what ends the board: `completeRivetBoardWhenCleared` wins the frame
`RIVETS_LEFT` reaches 0. `[code]`

### The hammer (25m, 50m, 100m — not 75m)

`driveHammerSprite` is board-gated to masks bit0/bit1/bit3 — **25m, 50m and 100m, and not
75m**, which is `gameplay.md` §5's "no hammer to rely on the same way on 75m" as a three-bit
constant. `[code]`

`latchHammerTouch` tests Mario against the two-record hammer pair and publishes the overlap into
`MARIO_HAMMER_PENDING`; a *miss clears what a touch set*, so the flag is not sticky. The pending
flag is transferred into `MARIO_HAMMER_ACTIVE` only when the post-landing freeze expires — and
the touch latch itself runs from the airborne handler's exit tail on the single frame whose
counter bump wraps to zero (`MARIO_AIR_FRAMES == 19`), **which is why a hammer is tested for
roughly once per airborne arc rather than once per frame**. (The other path into that tail, a
collision fall-through, arrives with a value that cannot wrap, so a collision frame never tests
for a hammer touch.) `[code]` — 77 dispatches over a 2000-frame **harness replay**
(`new Machine(ROM)` under our own engine, not MAME), the 4 latching ones all at
`MARIO_AIR_FRAMES == 19`.

While held, `updateActiveHammer` ticks `HAMMER_TIMER_LO/HI` and ends the hammer when the high
byte reaches 2 — **512 TICKS OF THIS UPDATER, which is not 512 frames**: the counter only
advances on frames the updater actually runs, and the one attract hammer measured ran the counter
1 → 511 across **876** held frames, the other 365 spent in five stalls of exactly 73 frames each.
Expiry restores the pre-hammer tune from `HAMMER_SAVED_BGM`. Bit 3 of
the low byte drives the 8-frame swing animation. The swing's *hitbox* is real: the two poses
stamp `OBJ_HIT_EXTENT_X/Y` as `0x06/0x03` and `0x05/0x06`, and `recordHammerHitOnObject` hands
exactly those two bytes to the board's collision handler as the per-axis tolerances — so the
hammer's reach changes with the swing phase. `[seen]` (the 876-frame active hammer, its 511
counter increments and the BGM save/restore were observed live)

---

## 9. Collision, hits, effects, and points

**Two different searches, for two different questions.**

- *"Did something hit Mario?"* — `dispatchBoardCollision` vectors to the current board's arm,
  each of which is a fixed sequence of sweeps, first hit wins:
  25m `OBJ_ARRAY_67`×10, `OBJ_ARRAY_64`×5, `OBJ_RECORD_66A0`×1 ·
  50m `OBJ_ARRAY_64`×5, `OBJ_ARRAY_65A0`×6, `OBJ_RECORD_66A0`×1 ·
  75m `OBJ_ARRAY_64`×5 then `OBJ_ARRAY_65`×10 only if the first misses ·
  100m one sweep over `OBJ_ARRAY_64`×**7**. That seven is not a typo for the five everywhere
  else: `seed100mBoardObjects` activates records **5 and 6** (0x64A0 / 0x64C0) at board build
  (ROM 0x116A, the same outright-activation idiom the 75m arm uses at 0x10E9), so the rivet
  board's array runs seven deep while every *spawn/service* path still walks only five.
  Decoded from `rom/maincpu.bin`: the four arms at ROM 0x2880 / 0x28B0 / 0x28E0 / 0x2901 open
  `ld b,0x0a` / `ld b,0x05` / `ld b,0x05` / `ld b,0x07`. `[code]` Each arm stores its sweep
  length in `OBJ_SEARCH_COUNT` first, and on a hit `recordHammerHitOnObject` writes
  `COLLIDED_OBJECT_BASE` (the array base), `COLLIDED_OBJECT_STRIDE` and
  `COLLIDED_OBJECT_INDEX` — recovering the index as `count − remaining`. **The arms and the
  arrays agree per board** — but read the evidence exactly: the *dispatch-count equality*
  (each arm's fetch count matching the board-collision dispatch count) was measured on **25m**
  (1220/1220 attract, 2140/2140 on a credited 1P game). For 50m, 75m and 100m what was
  measured is the weaker pair — the arm is present on its own board and dispatches 0 on the
  others. `[seen]` for those controls; the count-equality claim is 25m-only.
- *"How many things did he just jump over?"* — `dispatchBoardOverlapSearch` → `loc_3e99` clears
  `OVERLAP_COUNT`, counts overlaps over both hazard arrays into it against a probe point that is
  **twelve pixels below Mario, not on him**, and grades the total into `0 / 1 / 3 / 7`. Those
  are not a scale — they are a **unary thermometer**: zero / one / two / three bits set, because
  the consumer walks `EFFECT_SELECT`'s low bits one at a time. `[code]`

**The effect machine** is what turns a hit or a pickup into a visible beat. `EFFECT_STATE` is a
4-way router; state 1 (`armScorePopupAndSelectAward`) unconditionally arms `EFFECT_TIMER` to
0x40, advances to state 2, and then tail-jumps to one of the award setters chosen by the
*first set bit* of `EFFECT_SELECT`. A nested three-step sequence (`EFFECT_SEQ_STATE` with
inner/outer counters) flashes and animates the effect sprite and re-arms the parent machine when
it finishes. While `runHitEffectInsteadOfPlay`'s latch is set, the whole gameplay update is
replaced by one effect beat — **an effect literally suspends play**. `[code]`

**The points come out of a ROM table, and it reconciles with `gameplay.md` exactly.** Task
opcode 0 selects a 3-byte packed-BCD addend from ROM 0x3529 by payload index. Read directly out
of `rom/maincpu.bin`: payload *n* for 1–9 is *n*×100, payload 0 and 10 are zero, and payloads
11–15 are 1000/2000/3000/4000/5000. `[code]` With that table in hand the award setters decode:

| setter | task payload | points | matches `gameplay.md` |
|---|---:|---:|---|
| `pickAwardTierByObjectCount` (thermometer 0/1/3/7) | 1, 3, 5 | 100, 300, 500 | §6 "jump over 1 / 2 / 3 at once = 100 / 300 / 500" |
| `stageAward300Popup` / `stageAward500Popup` / `stageAward800Popup` | 3, 5, 8 | 300, 500, 800 | §6 hammer smashes "300, then 500, then 800" |
| the no-bits-set arm, dispatched on `LEVEL` (1 → 300, 2 → 500, else → 800) | 3, 5, 8 | 300, 500, 800 | §6 prizes "300 / 500 / 800 by level" |

So the three separate scoring rules a player learns from the outside are **one dispatcher with
three entry conditions**, and the level-scaled arm is the prize award. `[code]` — the table and
the dispatch are exact; the *attribution* of the level-scaled arm to Pauline's dropped items is
inference from the scaling matching, not from watching a pickup.

`awardScorePopup` posts the task, stamps the floating glyph as a 4-byte sprite record at
`POPUP_SPRITE` (`{MARIO_X, glyph, attr 7, MARIO_Y + 0x14}`), and cues a **board-gated** sound —
the award ping plays on 25m and 75m only. `[code]`

---

## 10. The bonus timer, the payout, and the kill screen

`initBoardState` computes, in 8-bit arithmetic:

```
BONUS_START = BONUS = BONUS_EVENT_MARK = min((LEVEL*10 + 0x28) & 0xff, 0x50)
BONUS_PERIOD = BONUS_TICK          = max(0xDC - 2*bonus, 0x28)
```

`BONUS` is in units of 100, so the on-screen number is `BONUS × 100`. It falls two different
ways: the metronomic `tickTimedBoardBonus` on boards 2/3/4 (period `BONUS_PERIOD`, measured
L2→100, L3→80, L4→60 frames) and the barrel release on board 1 (§8). `BONUS_DISPLAY` is the
packed-BCD number the player watches, stepped in lockstep by both sites; that BCD encoding was
confirmed over 99,367 comparable frames with zero mismatches and the borrow directly visible
(0x50→0x49). `[seen]`

Reaching zero sets `BONUS_EXPIRED_STEP`, whose four-step machine (`dispatchBonusExpiredStep`,
`startBonusExpiredDelay`, `bonusExpiredIdle`, `advanceBonusExpiredStepWhenDelayExpires`,
`advanceSubstateWhenGrounded`) holds until Mario is grounded and then takes the death exit.
`[seen]` (the machine was walked 0→1→2→3 under a write tap on boards 2 and 4)

**The payout.** On completion `awardRemainingBonusToScore` splits `BONUS_DISPLAY`'s nibbles into
two table-selected payloads and posts both — `gameplay.md` §6's "whatever remains is added to
your score", located. `[seen]` with a stated caveat: the five observed dispatches needed a
`GAME_SUBSTATE := 0x16` poke to reach the board-advance state; in unpoked play it was observed
zero times over 49,700 frames.

**The level-22 kill screen falls straight out of the first line.** At `LEVEL == 22`,
`22*10 + 40 = 260 = 0x104`, which byte-wraps to `0x04`. Four is below the `0x50` clamp, so the
board opens with a **400-point timer** that expires in seconds no matter how well you play.
`[code]`

| `LEVEL` | `LEVEL*10+40` | after the byte wrap and the clamp | on screen |
|---:|---:|---:|---:|
| 1 | 0x032 | 0x32 (50) | 5000 |
| 2 | 0x03C | 0x3C (60) | 6000 |
| 3 | 0x046 | 0x46 (70) | 7000 |
| 4 … 21 | 0x050 … 0x0FA | clamped to 0x50 (80) | 8000 |
| **22** | **0x104** | **wraps to 0x04 (4)** | **400** |
| 23 | 0x10E | 0x0E (14) | 1400 |

`gameplay.md` §4.5 and §9 flag the exact arithmetic as "a community reconstruction"; here it is
the literal expression in `initBoardState`, and the L1–L4+ column matches the published table
row for row. That promotes the public claim from *widely reported* to *confirmed*, and pins the
mechanism to one 8-bit multiply that was never widened.

**The extra life.** `awardBonusLifeAtThreshold` grants one score-threshold life per player,
latched by `BONUS_LIFE_AWARDED`, against `DIP_BONUS_LIFE` (default 7000) — `gameplay.md` §6's
"bonus life at 7,000". A quirk worth knowing when reading traces: `DIP_BONUS_LIFE` is 0 at early
boot, so the threshold is momentarily 0 and the award fires immediately in attract. `[seen]`

---

## 11. Winning a board, and the interlude that advances it

**Winning is one write.** `enterBoardAdvanceAndUnwind` sets `GAME_SUBSTATE = 0x16` and unwinds
out of the movement cascade so nothing else runs that frame. `checkBoardWonByType` decides,
per board type, whether to reach it — and the routing is a bit test that is easy to get wrong:

- **100m** — position is never read; the board is won the frame `RIVETS_LEFT` hits 0.
- **The ODD boards — 25m *and* 75m.** ROM 0x1E5F is `rra` on `BOARD`, rotating **bit 0** into
  carry, so `jp c` takes `BOARD` 1 **and** 3. Both are won positionally, by Mario's Y reaching
  the rescue row near Pauline. This is not "the girder board". `[code]`
- **50m** — won once Mario climbs above the 0x51 line (Y decreases as he climbs).

`[seen]` for the rescue itself: a played run reached Pauline on 25m by walking to the ladder X
and climbing, producing the advance 25m → 100m.

**The interlude** is one state machine, `BOARD_ADVANCE_STEP`, read through **three** board-parity
tables, but only two of them belong to one routine. `dispatchBoardClearedInterlude` owns the odd
boards (6 steps, table at ROM 0x1623) and 50m (5 steps, 0x1637); when neither board bit matches it
**falls through** (`jp nc,0x1641`) into the 100m path, where `runRivetBoardInterludeFrame` runs the
effect machine first and `dispatchRivetBoardInterludeStep` then dispatches the third table
(6 steps, 0x1648). Its first act each frame is
`clearSpriteColumns`, which parks 28 sprite records — stopping one short of Mario's on one side
and one short of the interlude heart on the other, so the gameplay actors are cleared away and
the interlude's cast is kept. The steps run the Kong-recapture tableau (`spawnInterludeHeart`
seeds the heart sprite, code 0x76), sweep the sprite-object block toward the top, wait until
every slot is clear, and end at the board-order walk. `[seen]` (the step byte was watched
walking 0→5 exactly once per completion, 51 monotone entries across nine completions, and is
identically 0 on every in-play frame outside sub-state 0x16)

The "HOW HIGH CAN YOU GET?" screen is **step 0 of this same sequence**, not a separate machine;
`HOW_HIGH_INDEX` (clamped to 5) is stepped when `BOARD_SEQ_PTR` differs from its saved copy and
reset on the level increment. `[code]`

`SEQ_ADVANCE_PTR` is the small indirection that makes several of these steps share one timer:
`advanceSequenceStepWhenTimerExpires` loads the *address* stored there and increments the byte it
points at, but only on the frame `SUBSTATE_TIMER` expires. Setup routines re-point it —
`INTRO_STEP` during the cutscene, `BOARD_ADVANCE_STEP` during the interlude — and its indirect
`inc (hl)` was caught writing `BOARD_ADVANCE_STEP` by PC. `[seen]`

---

## 12. Death, lives, players, game over

`MARIO_ACTIVE` going to 0 during the per-frame cascade is what ends a life: the cascade's tail
reads it, and on zero it silences every sound output, fires sound trigger 2, and steps the
sub-state — and the next index in *both* dispatch tables (in-game 0x0C→0x0D, attract 3→4) is the
death-animation router. `[code]`

The animation itself is grounded end to end. `DEATH_ANIM_PHASE` is a three-arm router (slot 3 is
structurally unreachable padding — the cell has three writers and none can produce 3);
`beginMarioDeathAnimation` blanks the sprite columns, primes `DEATH_ANIM_TICKS_LEFT` to 13, and
its last instruction is the **sole writer of the sound line MAME labels "dead"**;
`stepMarioDeathAnimation` rotates Mario's sprite through four orientations (tile 0x78↔0x79,
flipy↔flipx) on an 8-frame gate. Under MAME's sprite-record layout that pair is a 180° rotation
and the record never takes a blanking value, so the old "blink" reading is refuted — but note the
evidence line: pass 13 ran `-video none`, so the four `(code, attr)` pairs, the gate and the
episode length are `[seen]` while the *rendering* reading is inferred from those bytes plus
MAME's `draw_sprites`, not from pixels. The episode is 296
frames and was identical in 43 of 43 completed episodes, with a negative control of 0 on every
one of 42,275 ordinary play frames. `[seen]`

**The bonus-timer death reaches the same sequence with `MARIO_ACTIVE` still 1** — ROM 0x1A2A
jumps into the middle of the same three instructions, stepping over the alive test. That is why
a live `MARIO_ACTIVE` is not evidence the death sequence is not running: two different causes
reach the identical animation. `[seen]`

`losePlayer1Life` decrements `LIVES`, snapshots the player context, and routes to the resume
interlude or the game-over sequence. Each player's 8-byte context
(`P1_CONTEXT` / `P2_CONTEXT` = lives, level, sequence pointer, play-intro flag, bonus-life
latch, how-high bookkeeping) is `ldir`'d to and from the live block at 0x6228 on every switch,
which is what makes alternating two-player play work. `PLAY_INTRO` being zeroed by both death
handlers is why a board resumed after a death **skips the opening cutscene**. `[seen]`

---

## 13. Attract mode and the demo

Attract is a real game played by a canned script. `runAttractState` dispatches eight sub-states
through ROM 0x0748: the title/score composition, the timed-advance gates, a fresh 25m/level-1/
one-life reseed (`restartAttractDemoAt25m` — unreachable for a credited game, since `DIP_LIVES`
is 3–6 at every DSW setting), Mario's spawn, the death router, and — slot 3 — the demo cascade.
`[code]`

The demo cascade is `loc_1977`: `advanceAttractDemoInput` writes this frame's scripted control
word **over the same cooked input cell the joystick would fill** (`P1_INPUT`), and then the
*identical* per-frame update runs. The script is a ROM table of `(input, duration)` pairs walked
by `DEMO_SCRIPT_INDEX` / `DEMO_SCRIPT_COUNTDOWN`; a duration of N holds its input for N+1 frames,
and the input is re-issued every held frame. The in-game path enters the same cascade one
instruction later, skipping only the script step. **That is why attract is such good ground
truth: it is the game, driven by a tape.** `[code]` (1416 dispatches at `GAME_STATE` 1 /
`GAME_SUBSTATE` 3 over a 2000-frame **harness replay** under our own engine, and zero on a
coin+start tape)

Attract also skips the joystick read entirely (the NMI gates it on `ATTRACT`), so the demo cannot
be disturbed by the cabinet controls.

---

## 14. Sound

Audio here is a layer *above* emulation: the I8035 sound CPU and the discrete analog circuits are
not simulated. The engine watches the Z80's writes and plays a named sample. `[code]`

Three write surfaces: `0x7C00` (ls175.3d) selects one of 16 **tunes**; `0x7D00–0x7D07`
(ls259.6h) sets eight individual latch bits; `0x7D80` asserts the sound CPU's interrupt. The
structural fact that is not visible from the address map is that **the eight ls259 bits do not
all go to the same place** — bits 0–2 drive discrete analog circuits ("walk", "jump",
"boom"/stomp), bits 3–5 are input pins the sound CPU polls, and bits 6–7 are wired to discrete
nodes that do not exist in this driver's sound configuration.

In work RAM this is a scheduler, not direct writes: `SND_TRIGGER` is eight per-bit countdown
counters that `soundDriverTick` walks once per NMI (non-zero → decrement and assert, zero →
deassert), so game code "plays a sound" by storing 3 — a three-frame assert. `SND_BGM` is the
looping background tune, overridden by `SND_PRIORITY` while `SND_PRIORITY_FRAMES` is non-zero.
The full provenance, and which sounds have sample bytes at all, is
[`audio/README.md`](audio/README.md) — not restated here. `[seen]`

---

## 15. Where the model is thin — open questions

Ordered by how much downstream work they block. This is a *highlighted subset*: the exhaustive
to-do is the enumeration in §1 (the 15 bare-hex reads plus the 47 uncentralized local aliases)
and every `[code]` claim in this file.

1. **What are the two 50m travelling objects?** The `BOARD_OBJ_SCRATCH` pair's machine, geometry
   and Mario-column hit test are `[seen]`; their *identity* is `[guess]`. The retracting-ladder
   reading has a falsifiable prediction: on a credited 50m board, force one record's position
   counter to 0x78 (its lowest) and hold it, and a ladder segment should be missing from the
   screen at that record's column; force it to 0x68 and the segment should be present. Do it
   with the pixel diff, not by eye. **Blocking**: it is the last unidentified actor on any board.
2. **`0x621A` — the flag the 50m parked arm stamps and the climb stepper reads.** It has *three*
   writers across two subsystems (the 50m parked arm on a Mario-column hit, and the climb-limit
   commit) and is read by the walk/climb animation stepper as a gate. Three idiomatic files give
   it two different local names — `OBJECT_FLAG` in `hold50mObjectParked`, `CLIMB_FLAG` in both
   `loc_1afe` and `loc_1d76` — the exact conflict the registry exists to reconcile. If question 1 resolves as "retracting ladders", this is the cell that
   couples them to the climb, and the two should be named together.
3. **What is ROM 0x1486 (`runBonusItemValueDisplay`, sub-state 0x15) really?** Its mechanics are
   pinned — a three-way mode latch on `SUBSTATE_TIMER`, a value seeded to 30 that counts down
   into two on-screen digit cells, a position walk driven by `P1_INPUT` bit 7, a scan of
   `PLAYER_SLOT_RECORDS`. But the reconciliation with `gameplay.md` §6 is **not** made: the
   prizes there are collected by walking over them during play, and §9's level-scaled 300/500/800
   award arm already accounts for their scoring. A whole in-game *sub-state* devoted to a
   countdown display is a different thing. Ground what is on screen while `GAME_SUBSTATE == 0x15`
   before trusting the "bonus item" reading. `[guess]`
4. **`loc_2a2f` — deliberately left address-named.** Both blind proposers had its axes backwards
   and both filed the resulting nonsense as an "unexplained mystery" — the converged-wrong
   failure the third review exists to catch. Corrected, it probes the tile 4 px below a moving
   object, computes the girder surface row inside that cell, and, if the object has reached or
   passed it, **snaps the object's `OBJ_Y` UP onto the surface** and reports contact. There is no
   leftward asymmetry; it is an ordinary landing test. `landObjectOnSlopedGirder` is the obvious
   name and it must be re-derived in a fresh proposer ≠ confirmer round before promotion.
   That same round owes a second item: **ROM 0x2083 publishes its 2-or-4 arm-select into record
   `+2` only from its THIRD step onward** — its first two steps write nothing there — so any
   reading of the select byte that assumes it is live from step 1 is wrong.
5. **`armAlternateFireModeAtHighDifficulty`'s mode 2.** The routine writes 2 into field `+0x19`
   of fire records 1 and 3 when `DIFFICULTY ≥ 3` and a rare draw comes up. 457 dispatches were
   measured over 2000 attract frames and **nothing past its first gate has ever fired**, so the
   write is unobserved and the mode is unnamed on purpose. Needs a run at difficulty ≥ 3.
6. **The third arm of `dispatchElevatorRideByColumn`** — the neither-band case that starts Mario
   falling and clears the lift flag — has never been observed executing. What *taking* it means
   is unclaimed.
7. **Two dispatch arms with no observed traffic**, both noted in their own headers: the
   in-game entry path into the per-frame cascade (attract reaches ROM 0x197A only through the
   demo tail) and the 25m barrel walk's continuations that a level-1 demo never selects.
8. **Cocktail / two-player coverage.** `ACTIVE_PLAYER_INDEX`'s cocktail P2-select reader and its
   `+0x12` sub-state reader are still unexercised; the whole flip-screen path is untested. Ground
   these on a cocktail run before a downstream decompile trusts them.
9. **The 25m/75m rescue row vs. Pauline's actual position.** The win test is a Y comparison; that
   the Y in question is *Pauline's platform* is inference from where the rescue happens in play,
   not from anything the routine reads. It has never been separated from "Mario reached the top".
10. **A residual pixel difference during Kong's climb** (98 px, 0.17% of the frame) is a known
    DMA-timing artefact of the render path, not a game-logic divergence. Recorded so nobody
    re-opens it.
11. **Four names deliberately held at `loc_`, each for a stated reason.** Recorded here because a
    hold that lives only in one file header is a hold nobody else can see:
    - **`loc_3110` and its three siblings `loc_311b` / `loc_3126` / `loc_3131`.** A naming round
      ruled `paceObjectUpdateEveryOtherFrame` a sound promotion for 0x3110, and it was
      *deliberately not taken*: the four are one family behind one dispatcher
      (`gateObjectUpdateByDifficulty`), and renaming one of four leaves the family reading as
      three anonymous throttles beside one named one. **Rename the family or none** — the
      conservative call, made explicitly, not an oversight.
    - **`loc_18c6`.** Genuinely multi-purpose — a pacer, cutscene sprite staging, *and* the
      board-advance/`LEVEL` wrap — and understood from a single source, so any one English verb
      would over-claim one of the three. §4 and §16 both lean on this routine; this is where the
      hold is recorded.
    - **`loc_271e`**, `service75mBoard`'s delegate, held for the reason its parent's name refuses
      "Lift": 75m's cast is lifts *and* springs *and* prizes, so naming the delegate after any
      one of them narrows it wrongly.
    - **`loc_1e6d`**, the 50m board-won arm under `checkBoardWonByType`. The *dispatcher* above it
      is grounded; this arm's internals are not, so the hold marks an evidence gap in the arm,
      not in the routing.
12. **The eight "dropping" barrels are still unreconciled.** §16 records the bit-7-vs-bit-0
    refutation as settled, and it is — but the grounding run behind the *old* note is not. That
    run logged 8 alternate-kind stamps without recording `BARREL_CLAIM_MODE`'s value at each, so
    all 8 may have been 0x81 (both bits set). **Owed: a re-grounding that logs the byte's value
    per stamp.** Until then nothing may claim bit 7 makes a barrel drop.

---

## 16. Resolved since the previous map

Recorded so the same questions are not re-asked. Each moved because of work that is *in this
checkout*, not because the wording changed.

- **"The biggest not-yet-lifted block is the actor/enemy AI, `0x1F00–0x2E00`."** Resolved: that
  block is lifted. Every one of the 429 translated routines has a readable module. The frontier
  moved from *lifting* to *registration and wiring* (§1, item 2) — a different and much smaller
  job.
- **"~62 routines are oracle-only."** Retired as a measurement. The number of addresses at which
  the live machine runs the oracle is now 40, and it is a wiring fact, not a decompile fact.
- **The score tier → points mapping.** Was `[guess]` on the code side because "the table at ROM
  0x3529 is not yet decompiled". Resolved by reading it (§9): payload *n* ∈ 1–9 is *n*×100,
  11–15 are 1000–5000, 0 and 10 are zero. All three published scoring rules now decode.
- **`OBJ_ARRAY_64` and `OBJ_ARRAY_67`.** Were object arrays of unstated content. Now the fires
  and the barrels, grounded with A/B in both directions on a zero-poke run (§6) — with the
  positive-control gap stated rather than hidden.
- **`drawLadder` / `drawGirderSpan`.** Were assumed correct. Proven exactly inverted by tile
  suppression (§5). The finding is recorded; the rename is a separate unit.
- **"The girder-board rescue test."** Was described as 25m only. ROM 0x1E5F's `rra` selects the
  **odd** boards — 25m *and* 75m (§11).
- **The level increment.** Was described as happening at the board table's `0x7F` terminator.
  Sharpened: `LEVEL` is incremented by `loc_18c6`, which is only ever reached as the last step of
  the **100m** interlude table — so it advances once per 100m clear, and the terminator is merely
  where the pointer wraps (§4).
- **The board set per level.** Was carried as `gameplay.md` §4's "four distinct single-screen
  stages" per level. The ROM table says 2/3/4/5/6 boards for levels 1/2/3/4/5+ (§4).
- **The 25m bonus clock.** Was described as a timer on all boards. On 25m the bonus is charged
  per barrel released; only boards 2/3/4 use the metronomic decrementer (§8, §10).
- **The 0x2C routine cluster.** Was documented as a cutscene renderer. It is ordinary 25m barrel
  play — 46/46 observed dispatches at gameplay sub-states, board 1 only, each paired 1:1 with a
  barrel slot claim.
- **`BARREL_CLAIM_MODE` bit 7 vs bit 0.** An earlier note had bit 7 selecting the *drop path*
  ("X pinned at 59"). Refuted by code: the pinned-X behaviour comes from the one-waypoint table
  selected by **bit 0**; bit 7 selects the sprite/behaviour kind, and the two bits are
  independent (§8). *The grounding run behind the old note is still unreconciled — see §15
  item 12.*
- **`DEATH_ANIM_PHASE` / `DEATH_ANIM_TICKS_LEFT`.** Were named for a blink animation and claimed
  to drive the colour-cycle blink sprites. Both wrong: unrelated subsystems, and the animation is
  a 180° rotation of visible sprites, not a blink (§12).
- **`GAME_SUBSTATE == 7`.** Was once read as a "rescue flag" after a 7 was seen at a board
  transition. It is the *next* board's opening cutscene.

---

## Appendix A — work-RAM orientation

Regions, not a registry. Every cell's name, role and confidence is in `idiomatic/ram.js`; this is
only a map of where to look.

| span | what lives there |
|---|---|
| `0x6000–0x600F` | credits, coin latches, top-level `GAME_STATE` / `GAME_SUBSTATE` / sub-state timers, current player |
| `0x6010–0x601A` | cooked and raw input, PRNG accumulator, spin counter, frame counter |
| `0x6020–0x6026` | decoded DIP settings |
| `0x6040–0x604F` | the two saved 8-byte player contexts |
| `0x6060`, `0x6080–0x608B` | overlap counter; the sound scheduler (8 trigger counters, IRQ, BGM, priority) |
| `0x60B0–0x60B1` | the task ring's enqueue/dequeue pointers (`TASK_TAIL`, `TASK_HEAD`) |
| `0x60B2–0x60BA` | the three packed-BCD score counters |
| `0x60C0–0x60FF` | the task ring itself: 32 two-byte `[opcode, argument]` slots |
| `0x611C–…` | player-slot records, stride 0x22 |
| `0x6200–0x6226` | Mario: position, fixed-point fractions, velocities, sprite state, and every movement flag |
| `0x6227–0x622F` | the live player context — board, lives, level, sequence pointer, how-high bookkeeping |
| `0x6280–0x62BF` | the per-board object template span: the 50m object pair, rivet state, the bonus block |
| `0x62A0–0x62AC` | the 50m reversal timers / direction latches, and the release-renderer pointers |
| `0x6300–0x631F` | the two per-board object-parameter tables (the ladder table) |
| `0x6340–0x6354` | the effect machine and the collision-hit result cells |
| `0x6380–0x63CD` | difficulty, barrel-claim mode, board-advance and intro step bytes, spawn requests, the segment-drawing scratch, the attract script cursor |
| `0x6400–0x67FF` | the object-record arrays (§6) |
| `0x6900–0x6A7F` | the sprite shadow buffer and its named sub-bases |
| `0x6BE0–0x6C00` | dead stack scratch, excluded from the memory-equivalence compare |

---

## Appendix B — subsystem entry points

Names as they exist in `idiomatic/` right now; roles are in `ROUTINES`, not repeated here.
`loc_XXXX` entries are lifted and gated but not yet English-named; the six clusters listed in
§1 are lifted but not yet wired.

- **Machine spine** — `boot` · `serviceVblankNmi` · `perFrame` · `mainLoop` · `loc_02e3` ·
  `loc_00ca` · `dispatchInlineJumpTable` · `boardBitGate` · `gameActiveGuard` · `marioActiveGuard` ·
  `tickSubstateTimer` · `tickSubstatePrescaler` · `stirRandomSeed` · `blitSpritesViaDma`
- **Tasks** — `enqueueTask` · `enqueueTaskBatch` · `addToScoreTask` · `resetScoreCounter` ·
  `drawScoreTask` · `drawStringVertical` · `drawCreditLineInAttract` · `loc_062a` · `drawLivesAndLevel`
- **Boot / coins / start** — `powerOnInit` · `clearRamAndInitHardware` · `decodeDipSwitches` ·
  `serviceCoinInput` · `dispatchCreditedSubstate` · `enterCreditScreen` · `readStartButtonSelector` ·
  `commitGameStart` · `spendCredit`
- **Attract** — `runAttractState` · `composeAttractTitleScreen` · `restartAttractDemoAt25m` ·
  `loc_1977` · `advanceAttractDemoInput` · `enterAttractMode`
- **Per-frame gameplay** — `loc_197a` (the cascade) · `dispatchInGameSubstate` ·
  `runHitEffectInsteadOfPlay` · `advanceSubstateAndArmTimer` · `clearScreenAndSelectSubstate`
- **Board build & layout** — `buildBoardWhenTimerExpires` · `buildBoard` · `setup25mGirderBoard` ·
  `setup50mConveyorBoard` · `setUp75mBoard` · `initBoardState` · `seed25mBoardObjects` ·
  `seed50mBoardObjects` · `seed75mBoardObjects` · `seed100mBoardObjects` · `loadBoardObjectRecords` ·
  `seedMarioActorRecord` · `drawBoardLayout` · `drawGirderSpan` *(draws ladders — §5)* ·
  `drawLadder` *(draws girders — §5)* · `drawSegmentEndCap` · `drawCappedTileColumn` ·
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
- **25m barrels** — `scheduleBarrelRelease` · `armBarrelRelease` · `markNextBarrelAsAltKind` ·
  `releaseBarrelIntoFreeSlot` · `stampReleasedBarrelKind` · `advanceBarrelRelease` ·
  `stepBarrelAlongReleasePath` · `activateReleasedBarrel` · `startBarrelDescentAtLadder` ·
  `findOppositeLadderEnd` · `advanceBarrelSpriteOrientation` · `loc_2a2f` · the `loc_1f72` walk
- **Fires** — `animateFixedHazardAndReleaseFire` · `loc_30ed` · `gateObjectUpdateByDifficulty` ·
  `spawnRequestedFireAndRecolorLiveFires` · `armAlternateFireModeAtHighDifficulty` ·
  `tickFireTimerAndRerollDirection` · `stepObjectSpriteFrame` · `publishFireSprites` ·
  `loc_31b1` · `loc_3202` · `loc_333d`
- **50m** — `update50mConveyorObjects` · `carryMarioOnConveyorRow` · `selectConveyorStepAndMoveMario` ·
  `reverseStepDirection` · `signStepHalfRate` · `update50mMovingObjects` ·
  `service50mObjectSpawnRequest` · `advance50mObjectRow` · `dispatch50mObjectState` ·
  `hold50mObjectParked` · `slide50mObjectDown` · `advance50mObjectStateOnRandomGate` ·
  `raise50mObjectAndPark` · `publish50mObjectYToSprite` · `marioReachedTargetColumn` ·
  `slide50mSpriteRowAndServiceColorCycle`
- **75m** — `service75mBoard` · `serviceBoardObjects` · `advanceBoardObjectTravel` ·
  `spawnBoardObject` · `dispatchElevatorRideByColumn` · `carryMarioUpWithLift` ·
  `carryMarioDownWithLift` · `killMarioAtEndOfLiftTravel` · `update75mActorObjects` ·
  `spawnObjectIntoInactiveSlot` · `mirrorObjectPositionToSprite` · `advanceToNextObject`
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
  `stepSpriteAnimationSequence` · `loc_1880` · `loc_18c6` · `advanceSequenceStepWhenTimerExpires` ·
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
