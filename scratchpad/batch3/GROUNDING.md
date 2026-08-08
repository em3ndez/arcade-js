# Batch 3 — grounding pass (18 addresses, all currently cert `code`)

**Oracle: real MAME 0.288 (`/opt/homebrew/bin/mame`) on the real `timeplt` romset
(`games/timeplt/rom/timeplt/`). The JS engine was never started, imported or consulted for any
number in this file.** Where a figure came from reading the ROM image rather than from MAME I say so
in the same sentence.

---

## 0. The rig, and that the bytes are the right bytes

```
mame     /opt/homebrew/bin/mame                      MAME 0.288
romset   games/timeplt/rom/timeplt/                  (tm1 tm2 tm3 … , gitignored, present locally)
script   <session scratchpad>/g3/g3tap.lua           taps + tape + snapshots
runs     <session scratchpad>/g3/run{A,B,C,D,G,H,I,J,K,L,M,N}.txt, run_p1.txt, run_p2.txt
snaps    <session scratchpad>/g3/snaps/timeplt/*.png
```

Command shape, identical across runs — only the env varies:

```sh
OUT=<out> TAPE=<none|p1|p2|p1long> [ENTRIES=…] [WRANGE=…] [WLOG=… WLOG_FROM=… WLOG_TO=…] \
[STATE=…] [CTX=…] [WCTX=1] [EFRAMES=…] [SNAP=…] [PROBE_PC=…] \
SDL_VIDEODRIVER=dummy /opt/homebrew/bin/mame timeplt \
  -rompath games/timeplt/rom -noreadconfig -nowriteconfig -skip_gameinfo \
  -video none -sound none -nothrottle -seconds_to_run <n> -autoboot_script g3tap.lua
```

(`-video soft -snapshot_directory ./snaps` on run D, the only run that needed a framebuffer.)

**The disassembly I reasoned from is the same image MAME executes.**
`cat tm1 tm2 tm3 | shasum -a1` = `1ae931691e29c92269b20db7ae92781987cdf45a`, byte-identical to
`games/timeplt/rom/maincpu.bin` (`shasum -a1` of that file gives the same digest). Every ROM
derivation below was decoded from that file with `tools/z80_decode.py`.

**No DIP was touched and no cell was poked in any run in this file.** Every driven run coins up and
presses start through the real `:IN0` fields; `set_value(1)` is a press and `set_value(0)` is a
release, and the presses land well past frame 400 because the first NMI on this driver is around
frame 236. Runs A–D, G–I, K and N drive nothing at all.

### Wiring, reused rather than reinvented

The instrument copies `tools/reach_sweep.lua`'s wiring (PC-gated entry read taps; every subscription
token retained in a global; `mem` published only after **every** tap installs, asserted by count, so
a part-way failure leaves an empty file rather than a plausible page of zeros) and
`games/timeplt/tools/lua/ramp_ceiling_tape.lua`'s discipline for the command ring (log RAW writes,
reconstruct offline — a live pairing silently attributes the drain's release byte to a command).
Every Lua-initiated memory access is bracketed by a `probing` flag, the fix pass-c1 needed after its
own frame-notifier reads were attributed to whatever PC the CPU was parked at.

### ★ Three instrument facts that the numbers below depend on

1. **On a WRITE tap, MAME reports `PC` as the NEXT instruction.** The storing instruction is the one
   *ending* at the reported address. Verified two ways: `tools/z80_decode.py` says `0x32D5` is
   `ld (ix+0x1a),a` and the tap reports the store as `PC=0x32D8`, the byte after it; and
   `translated/loc_10f8.js`'s own step addresses (`m.step(h + 0x18, …)` for the request store,
   `m.step(next, …)` for the sprite store) predict exactly the PCs the tap reported. Every `W` row
   quoted below is read that way, and I name the real storing instruction each time.
2. **An entry read tap on a routine whose head is also a spin-loop target counts spins, not
   entries.** `0x10F8` is such a head: its own `jr nc` returns to `h`. Its raw tap figure (28 910 in
   run K) is a spin count. Its *completion* count is the store count, 670.
3. **The boot blind spot.** A run that installs the taps and immediately reports the program counter
   gives `PC = 0x009E` — the CPU is already inside the boot checksum loop before the first frame
   notifier fires. Anything before that is unseen by every run here. (pass-c1 measured the same
   thing; `reach_sweep.lua`'s header claim that the first notifier call happens "before one CPU
   cycle has elapsed" is false on this driver, still.)

### The character-plane glyph map, derived and cross-checked

Several verdicts below turn on *what a caption says*. The map was not guessed. Run D logs every
write to `0xA400-0xA7FF` with its PC, and run D's snapshot 0002 (frame 276) shows the glass. Four
independent strings decode consistently with one map, and each was predicted before it was checked:

| cells (stepping −0x20) | bytes written | reads as |
|---|---|---|
| `A6BC…A53C` (13) | `30 f1 7c 68 3b a5 38 fd f1 96 5d 17 9b` | `© KONAMI 1982` |
| `A70C…A4CC` (19) | `88 57 34 a5 ed 34 f1 87 34 88 68 ed fd dc f1 77 68 fd 3b` | `PLEASE DEPOSIT COIN` |
| `A6EE…A4EE` (17) | `a5 3b 87 f1 dc d7 bf f1 dc c4 fd ed f1 7d a5 38 34` | `AND TRY THIS GAME` |
| `A70F…A4CF` (19) | `ed 77 68 d7 34 f1 d7 a5 3b 7c fd 3b 7d f1 dc a5 8c 57 34` | `SCORE RANKING TABLE` |

Every letter shared between two strings takes the same code in both (`A`=a5, `E`=34, `O`=68, `S`=ed,
`I`=fd, `T`=dc, `N`=3b, `R`=d7, `␣`=f1, …). Digits fall out of the same run: `0`=13, `1`=96, `2`=9b,
`8`=17, `9`=5d. All four strings are legible in snapshot 0002. A line runs **down** in memory in
−0x20 steps because the tilemap is column-major under ROT90.

---

## 1. The runs

| run | drive | length | what it establishes |
|---|---|---|---|
| **A** attract | nothing | 200 s / 12000 f | the undriven baseline: entry counts for all eighteen + 39 controls; writers of `0xAB30-40`, `0xACC4`, the lives/credit cells, `0xAC43`, `0xAD0D` |
| **B** attract | nothing | 200 s | per-dispatch **frame** log for `0x2D3F 0x4B67 0x598E 0x5994 0x1734 0x594E` |
| **C** attract | nothing | 100 s | the `0x1748` dispatch window (f=271…526, then f=4459…) |
| **D** attract | nothing | 11 s | 8 snapshots + **every** char-plane write, with PC, f=255…560 |
| **E** `run_p1` | coin ×1 f400, 1P start f520, stick+fire | 200 s | the one-player start arm |
| **F** `run_p2` | coin ×2 f400/f440, 2P start f560, stick+fire | 200 s | the two-player start arm |
| **G** attract | nothing | 200 s | entries attributed by **MOTHER_SHIP_ARMED**; write taps on `0xAC7E/7F`, `0xAC43-60`, `0xAE00-90` |
| **H** attract | nothing | 200 s | writes attributed by **ERA_INDEX**; register probe at `0x32D5`; `0x44C9` controls |
| **I** attract | nothing | 200 s | sole-writer test on the CREDIT cells; **every** write to `0xA808-0B` for the scroll pace |
| **J** driven | coin+start every 30 s (`p1long`) | 300 s / 18000 f | the long play arm: `0x5286` double buffer, `0x44C9` hunt |
| **K** attract | nothing | 100 s | sprite-RAM writers for `0x10F8` |
| **L** driven 1P | coin+1P start | 60 s | `0x2CDB`'s product (the blanked line) |
| **M** driven 2P | coin ×2 + 2P start | 20 s | the credit **digits** track the credit count |
| **N** attract | nothing | 10 s | the **command ring** at the `0x1748` expiry frame |
| **seq_A2 / seq_P1 / seq_P2** | none / `p1long` / 2P | 200 / 300 / 200 s | write tap on `0xA9EB` (SEQUENCE_DELAY) — §19 |

Tape sanity is visible in every driven run's `S` block: run E shows `cred 00->01` at f=402 and
`in0(a9ae) 00->08` at f=522; run F shows `00->01`, `01->02` and `in0 00->10` at f=562. A tape that
did not take would show neither.

---

## 2. Per-address verdicts

| addr | dispatches attract / driven | verdict | one line |
|---|---|---|---|
| **0x4B67** | 4 (A) / 3 (E) | **[seen], product observed** | its `ldir` is one of the head's two writers; §3 |
| **0x3215** | 0 (A) / **1** (E, 1P) / 0 (F, 2P) | **[seen], product observed** | selected by bit 3; §4 |
| **0x189E** | 0 (A) / 0 (E) / **1** (F, 2P) | **[seen], product observed** | selected by bit 4; §4 |
| **0x2D3F** | 3 (A) / 3 (E) | **[seen], product observed** | both halves on the glass; §5 |
| **0x1748** | 768 (A) / 643 (E) | **[seen], product observed** | the erase watched, cell by cell; §6 |
| **0x382D** | 229 (A) / 209 (E) | **[seen] executing, both arms** | plus the threshold cell grounded; §7 |
| **0x28A1** | 8958 (A) / 8292 (E) | **[seen] executing** | ★ all seven run, armed or not; §8 |
| **0x1F42** | 9624 (A) / 8981 (E) | **[seen], product observed** | the pace really is era-scaled; §9 |
| **0x12E2** | 0 (A) / 60 (J) | **[seen] executing, both arms** | §10 |
| **0x2CDB** | 0 (A) / 81 (J), 27 (L) | **[seen], product observed** | §11 |
| **0x5286** | 11764 (A) / 17764 (J) | **[seen], product observed** | §12 |
| **0x55D4** | 11764 (A) / 17764 (J) | **[seen], product observed** | the FIFO slide watched; §13 |
| **0x4117** | 4939 (A) / 763 (E) / 0 (J) | **[seen] executing, both arms** | ★ the aim point IS written; §14 |
| **0x4F35** | 4479 (A) / 5750 (J) | **[seen] executing, both arms** | §15 |
| **0x44C9** | 0 everywhere | **NOT REACHED — and no positive control** | §16 |
| **0x598E** | 16 (A) / 2 (E) | **[seen] executing, callers separated** | §17 |
| **0x5994** | 9 (A) / 0 (E) | **[seen] executing** | §17 |
| **0x10F8** | 670 completions (K) | **[seen] executing, as interior code** | §18 |

**Instrument-can-detect-presence, for every zero above.** The same tap array in the same runs
counted `0x0030` at 83 052, `0x0365` at 11 764 (= the NMI count exactly), `0x0038` at 1 972 and the
seven `0x28xx` slot workers at 8 958 each. `0x3215` and `0x189E` are each other's positive control:
each is zero in exactly the run where the other fires. `0x12E2` and `0x2CDB` are zero in attract and
non-zero when driven, with no change to the tap. The one zero that has **no** control is `0x44C9` —
said so in §16 rather than dressed up.

---

## 3. `0x4B67` — the closest call in the batch, settled

Write tap over `0xAB30-0xAB40` for a whole 200 s attract run (**A**), attributed by program counter.
The head cell `0xAB30` has exactly **two** writers, and this routine is one of them:

```
W 4b61>ab30  412   (the generator's own feedback store)
W 4b72>ab30    4   [ff*4]        <- this routine's ldir
W 4b57>ab31..ab40 412 each       (the shift; note it never touches ab30)
W 4b72>ab31..ab40   4 each
```

The seventeen values `0x4B72` wrote, one per cell:

```
ff 05 f6 80 32 17 9c c9 dd 21 74 98 fd bf 24 ae 46
```

and ROM `0x4B84-0x4B94`, read from `maincpu.bin`, is `ff 05 f6 80 32 17 9c c9 dd 21 74 98 fd bf 24
ae 46`. **Identical.** So the block copy is observed, on the machine, putting seventeen constant
program bytes into the register — a *seed*, not an update. The four dispatches are at f=33 (cold, in
sequence phase 0) and then once per attract demo start, f=790 / 4978 / 9294 (**B**), each at
phase 3 sub-step 0.

**Answer to the question that opened this pass.** `0xAB30`'s head has **two** writers, `0x4B61` and
`0x4B72`, and `0x4B67` is one of them. The tap is gated to *this routine's own* program counter
(`0x4B72`, the byte after its `ldir`), not to the cell generically, which is exactly what open item 9
said would make the cert legitimate. **⇒ cert `code` → `seen`, product observed.**

Two notes for whoever edits the registry:

* `RANDOM_REGISTER`'s committed entry says the head took writes from "exactly two program counters:
  the generator's own feedback store, and the seeder's block copy, **twice**." The structural claim
  reproduces. The word "twice" does not — it is a count of one run's dispatches, and this run has
  four. It is a derived count in prose; drop it rather than correct it.
* The checksum arm did **not** fire in any run: `jp nz,0x6000` was never taken (the machine kept
  running, and `0x6000` is outside the 24 KB image). That arm is unreachable on a genuine ROM by
  construction, so its zero is not evidence about anything and I am not claiming it as coverage.

---

## 4. `0x3215` vs `0x189E` — the discriminating experiment, both directions

Two runs, identical except for which start button the tape presses.

**Run E — one coin, 1P start.** `IN0_MIRROR` (`0xA9AE`) carried `0x01` at f=402 and **`0x08`** at
f=522. `0x3215` dispatched **once**; `0x189E` **zero** times. Its own stores, PC-attributed:

```
321c>ad31 = 00      the two-player flag, cleared
321f>ad20 = 00      PLAYER_TWO_LIVES, cleared
3223>ad30 = ff      PLAY_ACTIVE
3229>ad10 = 03      PLAYER_ONE_LIVES  (from 0xA9C1)
3231>a986 = 00      the credit count: 1 - 1
```

**Run F — two coins, 2P start.** `IN0_MIRROR` carried `0x01` at f=402 and f=442 and **`0x10`** at
f=562. `0x189E` dispatched **once**; `0x3215` **zero** times:

```
18a6>ad30 = ff      PLAY_ACTIVE
18a9>ad31 = ff      the two-player flag, SET
18af>ad10 = 03      PLAYER_ONE_LIVES
18b2>ad20 = 03      PLAYER_TWO_LIVES
18bd>a986 = 00      the credit count: 2 - 2
```

The credit count is watched from both ends: run F's `S` log shows `cred 00->01` (f=402),
`01->02` (f=442), `02->00` (f=562). Run F then shows the alternation the two-player flag buys —
`act(0xAD32)` toggling `0->1->0->1` while `p1l` and `p2l` come down in turn (f=2184, 2680, 3344,
4350, 6228, 7756).

**Bit 3 of `0xA9AE` selects `0x3215`; bit 4 selects `0x189E`.** Complementary zeros, each run the
other's positive control. `startOnePlayerGame` for `0x3215` is confirmed by observation, and the twin
is confirmed as the two-player start. **⇒ both cert `code` → `seen`, product observed.**

Neither run reached the free-play arm (`0xA9C0` was `0x00` throughout; the tail at `0x0F1A` was the
one taken). Not driven, so not claimed.

---

## 5. `0x2D3F` — CREDIT on the glass, and the count on the same line

**Does the caption appear?** Yes, and snapshot 0002 of run D (frame 276) shows it. The write log for
the same run gives the mechanism, at frame 269 — the frame `0x2D3F` dispatched (run B: f=269, 4457,
8773):

```
f=269  0c04>a55f=77  a53f=d7  a51f=34  a4ff=87  a4df=fd  a4bf=dc     C R E D I T
f=269  0d99>a47f=13  a45f=13                                          0 0
```

The six letters and the two digits are on **one line**: `A55F A53F A51F A4FF A4DF A4BF` then one
blank cell at `A49F`, then `A47F A45F` — the same −0x20 column, unbroken. **The count is painted on
the same line as the caption.** Screen-legible in the snapshot as `CREDIT 00`.

**Sole-writer test** (run I, whole 200 s attract, write taps on `A4BF`, `A51F`, `A55F`, `A45F`,
`A47F`): each of those five cells took exactly **one** write per attract cycle, three in the run,
from `0x0C04` (letters) and `0x0D99` (digits) — and nothing else, apart from the boot grid fill
(`0x00CD/0x00D6`), the boot line-blanker (`0x01CC`) and one `0x5881`. No other program counter paints
CREDIT in 200 s.

**The digits really are the count** (run M, two coins): `0x4AFB` dispatched 4 times and `0x0D99`
wrote `A45F` four times with `13 13 96 9b` — glyphs `0 0 1 2` — while the `S` log shows
`cred 00->01->02->00`. `0x2D3F` reaches `0x0D99` through its own `call 0x4afb`.

**The tail is the copyright line, and it is a different line.** `0x2D3F` ends `ld hl,0x086b / ld
b,0x14 / jp 0x43e8`. At f=269 PC `0x0C04` also wrote thirteen cells `A6BC…A53C` with
`30 f1 7c 68 3b a5 38 fd f1 96 5d 17 9b` = ROM `0x086E-0x087A` exactly, decoding to `© KONAMI 1982`
— low nibble `C`, a different row from CREDIT's low nibble `F`. It is then repainted every frame
(13 writes/frame from f=270 onward; 515 per attract cycle in run I).

**⇒ `showCreditCountAndCopyrightLine` survives observation on both halves. cert `code` → `seen`,
product observed.** One caveat worth passing on: `B = 0x14` is not the glyph count — thirteen cells
are written, not twenty.

**Open item 7 (which writer of the guard byte is live) is untouched by this pass.** What *is* now
measured is the hand-off: `0x1734` ran for 106 consecutive frames immediately before each `0x2D3F`
dispatch (run B: f=4351…4456 then f=4457; f=8667…8772 then f=8773). The *first* dispatch, at f=269,
had no `0x1734` before it, so it arrives some other way — worth a line in the module header.

---

## 6. `0x1748` — the erase, watched cell by cell

`0x1748` dispatches 256 consecutive frames per attract cycle, f=271…526 (run C), all at phase 1
sub-step 4. The final dispatch is f=526. On **that frame** and no other, PC `0x0C4C` wrote the
blanking glyph `0xF1` into exactly 36 cells and nothing else (run D):

```
f=526  0c4c> a70c a6ec a6cc a6ac a68c a66c a64c a62c a60c a5ec a5cc a5ac a58c a56c a54c a52c a50c a4ec a4cc  (19)
f=526  0c4c> a6ee a6ce a6ae a68e a66e a64e a62e a60e a5ee a5ce a5ae a58e a56e a54e a52e a50e a4ee            (17)
```

Those are, exactly and only, the two coin-invitation lines — `PLEASE DEPOSIT COIN` and
`AND TRY THIS GAME`. The copyright line `A6BC…A53C` is **not** erased: it keeps its 13 writes/frame
through f=533 and beyond. The per-frame write count tells the same story on its own: 13, 13, …, 13,
**49** at f=526 (13 + 36), 79 at f=527 (the next step), 13, 13, …

**And it is this routine that ordered it.** Run N taps the command ring `0xAC00-0xAC3F` across
f=520…530. Every frame carries the same routine post `(01,xx)`. Frame 526 carries **two extra posts
and only two**:

```
f=526  0044>ac20=03  0046>ac21=03     DE = 0x0303
f=526  0044>ac22=03  0046>ac23=04     DE = 0x0304
```

which are precisely the two `rst 0x38` calls in `0x1748`'s expiry arm. `0x0038` took 258 dispatches
at that sub-step = 256 routine + 2. The drain then marks each consumed slot `0xFF` (`0x0BA1/0x0BA5`).

**⇒ `holdCopyrightThenEraseTheCoinInvitation` is confirmed on the erase half, exactly.
cert `code` → `seen`, product observed.** One honesty note on the *hold* half: `0x1748` does not
itself paint the copyright — the caption's repaint is continuous from f=269 (§5) and outlives this
step. What `0x1748` holds is the sequence *step*, for 256 frames.

Its stash is also observed. `0x175B` wrote `0xACC7 = 0x3B` and `0x1760` wrote `0xACC8 = 0x10`, twice
each in run E. `0x3B` is the glyph `N` — the `N` of `KONAMI`, read out of `0xA63C`, a cell the
copyright repaint rewrites every frame. Two other routines write the same pair (`0x1621/0x1625`
with `0x3B/0x05`, `0x4B45/0x4B48` with `0x3B/0x10`).

---

## 7. `0x382D` — the threshold is a per-era difficulty rung, and both arms run

**Both arms taken** (run G, arm taps at `0x3836` = below threshold, `0x3842` = at or above):

```
0x382d 229   =   0x3836 83   +   0x3842 146      83 + 146 = 229
```

and the split moves with the era (`0x3842`: era1 60, era2 55, era3 31).

**The threshold at `0xACC4` is written per-era, and it climbs.** In two independent 200 s attract
runs (**A** and **G**) it has exactly **one** writer, `0x1ACC` — inside `loc_1a9a`, the routine that
distributes an era-keyed table block — 15 writes, values `50 60 70 80 90`. Run A's per-frame state
log lines the writes up against `ERA_INDEX` and `ERA_RUNG`:

```
f= 899 era 00->01                       f=5087 era 01->02              f=9403 era 02->03
f= 900 thr 00->50                       f=5088 thr 70->50 (rung->0)    f=9404 thr 80->60 (rung->0)
f=2442 thr 50->60  (rung 1->2)          f=6630 thr 50->60              f=10286 thr 60->70
f=3762 thr 60->70  (rung 3->4)          f=7950 thr 60->70              f=10946 thr 70->80
                                        f=8610 thr 70->80              f=11606 thr 80->90
```

So the cell **re-bases at every era change and then climbs with `ERA_RUNG`**, and the base itself is
era-dependent (rung 0 gives `0x50` in eras 1 and 2, `0x60` in era 3). Watched across **two** era
changes, which is what the brief asked for.

**⇒ open item 12 is confirmed on the machine: `0xACC4` is an era-controlled difficulty setting, not
a constant.** For `0x382D` itself: **[seen] executing, both arms**. I did *not* watch what consumes
the byte it returns in A, so I stop short of "product observed"; `pickScriptAtRandomOrInTurn`'s two
arms are real and live, and the "in turn" arm's counter at `0xA9CF` was not separately watched.

---

## 8. `0x28A1` — all seven, and the top two do **not** stand down

Run G attributes every dispatch by `MOTHER_SHIP_ARMED` (`0xAD0D`). The eight rows are identical, to
the count, in **every** bucket:

```
0x28a1 8958  mship00/era01=2577 mship00/era02=2409 mship00/era03=2374 mshipff/era01=651 mshipff/era02=947
0x28b7 8958  … identical …
0x28c2 8958  … identical …
0x28cd 8958  … identical …
0x28d8 8958  … identical …
0x28e3 8958  … identical …
0x28ee 8958  … identical …
0x28fe 8958  … identical …
```

**All seven slot workers are entered on every single dispatch, including the 1598 dispatches with the
mother-ship cell set.**

The positive control for the `mshipff` bucket being real is in the same run: `0x4FBF`, the arm
`0x4F35` takes only when `0xAD0D` is non-zero, took **800** dispatches and every one of them landed
in an `mshipff` bucket (326 + 474), zero in `mship00`. The context cell was genuinely `0xFF`, and the
tap could tell. `0xAD0D`'s writers in run A: `0x43E1` set it (`ff`, ×2), `0x1A00` and `0x4C8C`
cleared it (`00`, ×3 each).

**⇒ open item 2 is a measured divergence, not a theoretical one.** `loc_28a1.js` gates its last two
calls on `MOTHER_SHIP_ARMED`; the ROM calls all seven unconditionally, and I watched it do so in the
state where the gate would bite. What I observed is *entry*, not product — the callees test the same
cell themselves, so the net effect may still be identical, and I am not claiming otherwise. But the
caller-level gate is not what the ROM does, and the reviewer should be told in those terms.

For the name: `stepSevenCraftSlots` — the seven are observed, equal, on every dispatch.
**[seen] executing**, role stays `[code]` (their stores were not watched).

---

## 9. `0x1F42` — the world scroll really does change pace with the era

**The arms partition exactly by `ERA_INDEX`** (run H, entry taps keyed on `0xAD04`):

```
0x1f42  9624   era01=3450  era02=3578  era03=2596
0x5965  7028   era01=3450  era02=3578          (= era1 + era2, to the unit)
0x596b  2596                          era03=2596
0x594e     3   era01=1 era02=2        <- NOT from here; see below
```

**The product is written on every dispatch** (run H, write attribution keyed on era). The two 16-bit
stores in the continuation — `ld (0xa808),hl` ending at `0x1F5D` and `ld (0xa80a),hl` ending at
`0x1F65` — fired 3450 / 3578 / 2596 times, matching the dispatch counts per era exactly.

Run I logs **every one of those writes** and pairs them back into signed words:

| era | arm / table | n | min | max | mean&nbsp;\|v\| | distinct |
|---|---|---|---|---|---|---|
| 1 | `0x5965` → `0x2E3E` | 3452 | −306 | +306 | 195.7 | 127 |
| 2 | `0x5965` → `0x2E3E` | 3580 | −306 | +306 | 187.3 | 127 |
| 3 | `0x596B` → `0x08FA` | 2597 | −331 | +331 | 215.8 | 127 |

(The `n` column is two or three above run H's per-era dispatch counts because run I's bucketing uses
the era-change frames from its own state log, so a handful of writes on the boundary frame land in
the later bucket. It does not move any min, max or set.)

Eras 1 and 2 produce a value set that is *identical* magnitude-for-magnitude
(`0 8 18 28 38 48 55 64 74 81 90 99 105 114 …`, 64 distinct magnitudes, ceiling 306). Era 3 produces
a *different* set (`0 8 19 30 41 52 59 69 80 87 97 107 113 123 …`, ceiling 331). Same 64-point
compass, a different scale — **about 8 % faster in era 3**. That is the pace, measured as a product,
on hardware.

**⇒ `scrollWorldAtTheEraPace` is supported. cert `code` → `seen`, product observed.**

Two holes, declared:

* **The era-0 arm of this routine was never taken.** `0x594E`'s three hits carry era contexts 01 and
  02, which its own `jp z` (`ERA_INDEX == 0`) forbids — they arrive from the *other* dispatcher,
  `rst 0x30` at `0x46C3` on the inline table at `0x46C4` (`0x5942 0x594E 0x594E 0x5965 0x596B`, read
  from the image). `0x1F42` only runs in phase 3, which starts after the era has left 0. Its era-0
  table (`0x5E00`) is unexercised.
* I call `0xA808`/`0xA80A` the scroll deltas because they are written *negated*
  (`xor a / ld h,a / ld l,a / sbc hl,de`) into `0xA800 + 8` and `+0x0A`, and `0x32C1` reads
  `0xA802` as that record's heading. That last step is interpretation, not observation.

---

## 10. `0x12E2` — both arms, in the driven run only

Zero in attract (**A**). In run J (300 s driven): **60** dispatches, all with `PLAY_ACTIVE` set, at
phase 3 sub-step 0x0B; the fall-through at `0x12E7` took **2**. So 58 early returns and 2 expiries —
`waitOutSequenceDelay`'s two arms, both observed. **[seen] executing, both arms.** Its product (what
`0x12E7` onward does) was not watched.

---

## 11. `0x2CDB` — a line blanked per dispatch, the guard passed, the derail not taken

Run L (60 s, 1P). `0x2CDB` dispatched **27** times, f=403…429, at phase 2 sub-step 1. In the same
run `0x01C2` — the line blanker it calls — dispatched **59** times: 32 at phase 0 sub-step 6 (the
boot wipe) and **27** at phase 2 sub-step 1, matching `0x2CDB` exactly. The char-plane write log over
f=395…445 contains **864** writes from PC `0x01CC`, all value `0xF1`:

```
27 dispatches × 32 cells = 864.
```

Each dispatch blanks one 32-cell line (run D shows the same PC walking one column per frame:
`a41c a43c a45c … a7fc`, then `…1d`, then `…1e`).

**The checksum arm.** `0x0F1A` (advance) took exactly **one** dispatch at phase 2 sub-step 1 —
`0x2CDB`'s own step — and `0x0F11` (derail) took **zero** there. (`0x0F11`'s single hit in the run is
at phase 1 sub-step 4, a different step, so it is not this routine's trap firing.) That is what the
image predicts: XOR-folding `maincpu.bin[0x4980:0x4D80]` (1024 bytes = `C=4` passes of `B=0`, i.e.
256) gives `0x43`, and `0x43 + 0xBD = 0x00` — computed here, not recalled.

**⇒ `blankOneLineThenGuardBlockOrDerail`: the blank arm and the guard-passes arm are both observed;
the derail arm is not reachable on a genuine ROM and I claim nothing for it. cert `code` → `seen`,
product observed.**

---

## 12. `0x5286` — the double buffer, both halves

Run J (300 s driven), write taps on `0xAE00-0xAE04` and `0xAE80-0xAE84`. 17 764 dispatches split
between the two arms — `0x526A` (the "already at the base" arm) took 7 282, the copy arm took 10 483,
and 7282 + 10483 = 17 765, one over at the dump boundary.

The copy arm's own stores:

```
529e>ae80    10483   the ldir, 0xAE00.. -> 0xAE80..
529e>ae81    10483   [ae*10483]
52a3>ae80    10483   values 88 8c 90 94 98 9c a0 a4 a8 ac b0 b4 b8 bc c0 c4 c8 cc
52a9>ae00    10483   [04*10483]
52a9>ae01    10483   [ae*10483]
```

and `0x529E`'s own first byte took `08 0c 10 14 18 1c 20 24 28 2c 30 34 38 3c 40 44 48 4c` — **the
same values, exactly `0x80` lower.** That is `add a,0x80 / ld (0xae80),a` caught in the act: the
copied cursor is the live cursor with the high bit set. The live cursor is then reset to `0xAE04`
(`ld (0xae00),hl` ending at `0x52A9`), and the producer (`0x537A`) starts appending again from there.

**⇒ `advanceDeferredCellDoubleBuffer` is confirmed. cert `code` → `seen`, product observed.**

---

## 13. `0x55D4` — oldest first, and the queue really slides

Run A, write tap on `0xAC43`; run G, on `0xAC43-0xAC60`.

```
55db>ac43  1899  [00*1560 01*279 02*35 03*8 04*5 05*4 06*4 07*2 08*2]     the dec
562e>ac43  1899  [01*1560 02*279 03*35 04*8 05*5 06*4 07*4 08*2 09*2]     the poster's inc
```

Every value the poster writes is exactly one above the value the consumer writes — the same queue,
seen from both ends, 1899 times each, depth reaching 9. `0x55F8` (the send) dispatched 1900.

**The compaction is observed.** In run G the `ldir` at the routine's tail (store ending at `0x55EC`)
wrote `0xAC44 0xAC45 0xAC46 0xAC47 0xAC48 0xAC49 0xAC4A 0xAC4B` with counts **339 60 25 17 12 8 4 2**
— the classic decay of a queue sliding down one slot — while the poster (`0x5632`) wrote the same
cells with counts **1560 279 35 8 5 4 4 2**, appending at the length. Slot `0xAC44` is consumed
(`inc hl` from `0xAC43`) and the rest slide onto it.

**⇒ `sendOldestQueuedSoundCommand`: "oldest" and the slide are both observed.
cert `code` → `seen`, product observed.**

Housekeeping for open item 5: the cell is `0xAC43` and it is a **length**, not a pointer — it is
decremented by the consumer and incremented by the poster, and the queue body starts at `0xAC44`.
Whatever name the batch settles on, one name.

---

## 14. ★ `0x4117` — the aim point is written, 596 times a run

**Both arms observed** (run G): 4939 dispatches, of which **305** matched the phase test and took the
re-aim arm at `0x4122` (which calls `0x33B8` and stores into `(ix+0x01)`), and all 4939 reached
`0x412B`. The retire arm at `0x40AB` took **82** in attract and **120** in run J. `0x33B8` itself
took 894, so it has other callers — the 305 is the tap on this routine's own arm, not on the callee.

**★ Open item 10 is refuted by the machine.** It says: *"nothing in the 24 KB image stores to
`0xAC7E`/`0xAC7F`; the only setter is `loc_27b1`'s boot fill of `0x80` … it is a FIXED point at the
centre of the coordinate space."* Run G, write tap on those two cells alone:

```
W 2896>ac7e   3   [80*3]
W 2896>ac7f   3   [80*3]
W 32d8>ac7e 596   values spread 58 … 98
W 32ea>ac7f 596   values spread 64 … a4
```

Reading the PCs as "the store *ending* here" (§0), the writers are `ld (ix+0x1a),a` at `0x32D5` and
`ld (ix+0x1b),a` at `0x32E7`. A register probe at `0x32D5` in run H reports **`IX = 0xAC64`** on
every sample, so `+0x1A` and `+0x1B` are `0xAC7E` and `0xAC7F` exactly. The disassembly of
`0x32C1-0x32EA` shows why the values look like that: a heading read from `0xA802` goes through
`0x59D1`, is doubled three times, and `h` is added to **`0x78`** for one byte and **`0x84`** for the
other — the observed centres. The `0x80` fill is `ld (hl),0x80 / inc hl / djnz` at `0x2894` with
`HL = 0xAC74, B = 0x10`, i.e. sixteen bytes `0xAC74-0xAC83`, not a boot fill by `loc_27b1`.

Run J confirms the whole block moves in play: twelve program counters (`0x3288 0x3290 0x3297 0x329F
0x32AA 0x32B2 0x32B9 0x32C1 0x32D1 0x32D8 0x32E3 0x32EA`) each wrote one of `0xAC74-0xAC7F` **762**
times, in six (x, y) pairs, all centred on (`0x78`, `0x84`), some at radius ~`0x10` and some at
~`0x20`.

**Why the old claim looked true, and why that matters more than the claim.** A scan for *immediate
operand* references to `0xAC7E`/`0xAC7F` finds nothing, because both stores are `ld (ix+d),a`. That
is the **same instrument failure** that item 4 of `PROPOSED-names.md` already caught and wrote a
caveat for on `SEQUENCE_DELAY` — "a write through an `hl` loaded further back would not appear". The
caveat was written and then the same instrument was trusted, unqualified, later in the same document. Worth a
rule, not just a correction.

**⇒ `0x4117` cert `code` → `seen` (executing, both arms). The NAME
`chaseTheAimPointAndRetireAtTheLine` is not itself refuted — but the reasoning printed beside it is
false, and "the aim point" was chosen specifically to avoid asserting a write that we now know
exists.** Whether `0xAC7C-0xAC7F` track the *player* I did not test; what is settled is that they
move, six of them, on a heading, 762 times in 300 s.

Open item 11 stands untouched: a phase byte above 15 can never match `FRAME_TICK & 15`. Nothing here
bears on it.

Note on reach: `0x4117` ran 4939 times in attract, 763 in the short 1P run (all at era 2) and **zero**
in the 300 s driven run J, which never left era 0. It is an era-2-and-later handler; a driven run has
to survive that long to see it.

---

## 15. `0x4F35` — both arms, and the gate is the mother-ship cell

Run G: 4479 dispatches; the tail `0x4FBF` took 800, and **every one of the 800 fell in an
`mshipff` bucket** (326 + 474) with zero in `mship00`. Run J: 5750 dispatches, `0x4FBF` **zero** —
the driven run never armed the mother ship. So the arm choice tracks `0xAD0D` exactly, both
directions, across two runs.

**[seen] executing, both arms.** The English name was declined for want of a verb true of both arms;
the observation supports that decision — the two arms are genuinely different work, both live.

---

## 16. `0x44C9` — not reached, and I cannot show the instrument could have caught it

Zero dispatches in every run: attract (A, G, H), short 1P (E), 2P (F), long driven (J).

**The honest part.** I also tapped its siblings — `0x44A8`, `0x44AB`, `0x44BF` — and **they are zero
too**, in the same runs. So I have *no* positive control inside this routine's own neighbourhood:
nothing shows the tap array could have detected presence *here*. The controls I do have are remote
(`0x40AB` = 120 in run J, `0x4117` = 4939 in run A, both through the same tap array), which
establishes that the array works, not that this block is reachable-and-quiet rather than never
entered. **A zero with a remote control only is a weaker zero, and I am labelling it as one.**

**From the image, so nobody re-greps.** The word `c9 44` occurs once in the whole 24 576 bytes, at
`0x304C` — where it decodes as `ret` followed by `ld b,h`, i.e. two instructions, not an address
operand. So `0x44C9` has **zero** address references. It is reached only by the relative branch
`jr nz,0x44c9` at `0x44B3`, taken when bit 7 of `(ix+0x06)` is set after `inc (ix+0x06)` — and the
only thing that sets that bit is `ld (ix+0x06),0x80` at `0x44BB`, on the sibling arm. So the arm is a
second-visit arm of an animation counter, and reaching it needs an object to survive into a second
cycle of whatever `0x44A8` handles.

**⇒ stays `code`, stays `loc_44c9`. Recorded as NOT REACHED with the control gap named.**

---

## 17. `0x598E` / `0x5994` — an era table, and a second caller that hides it

The naive reading of the raw counts is wrong, and checking the callers is what caught it.

Raw (run H, keyed on era): `0x598E` 16 = era1 **2** + era3 **14**; `0x5994` 9 = era2 **9**;
`0x599D` 25 = 16 + 9 exactly (those two are its only callers in the run); the third sibling `0x599A`
**0**. "So `0x598E` is eras 1 and 3" — and that is false.

Run I taps both dispatch sites:

```
0x4787   11   era01=2  era02=9      ld a,(0xad04) / rst 0x30 -- the ERA table
0x4384   14            era03=14     call 0x598e -- unconditional, not era-keyed
```

The inline table at `0x478B`, read from the image, is `598e 598e 5994 5994 5994` for eras 0–4.
Observed: era 1 → `0x598E` (2), era 2 → `0x5994` (9). **Both match the table.** The era-3 hits on
`0x598E` came entirely from the unconditional `call` at `0x4384`; the era dispatcher was never
entered at era 3 in this run.

Each of the three siblings loads one table base (`0x59D7`, `0x5C00`, `0x5E00`) and tail-jumps to the
shared indexer at `0x599D`, which indexes it by `(ix+0x02)`.

**⇒ both `code` → `seen` (executing). The English declines stand** — nothing observed here gives a
verb the hex does not, and the era keying belongs to the *dispatcher*, not to these two. Do not write
"the era-1 table" into either module header on the strength of the raw counts; that reading is
refuted above.

---

## 18. `0x10F8` — the block runs; whether it is an *entry* the machine cannot say

Run K, write taps on the sprite-RAM cells the routine names. The five blocks are all live (rows as
the tap printed them; each reported PC is the byte *after* the store, and each is exactly the
`h + 0x18` / `next` that `translated/loc_10f8.js` predicts for that block — an independent check that
§0's PC rule is right):

```
W 1110>b437 670    W 1118>b036 670     block 1  (h = 0x10F8)
W 1130>b439 544    W 1138>b038 544     block 2  (h = 0x1118)
W 1150>b43b 616    W 1158>b03a 616     block 3  (h = 0x1138)
W 1170>b43d 627    W 1178>b03c 627     block 4  (h = 0x1158)
W 1190>b43f 501    W 1198>b03e 501     block 5  (h = 0x1178)
```

Those are *completions* — the times a block found a request pending and got past the beam wait. The
raw entry tap on `0x10F8` reads 28 910 in the same run, which is the **spin** count, and should never
be quoted as a dispatch figure.

The same cells are also written by a second five-block set at `0x1008-0x1098` (PCs `0x100F 0x1017
0x102F …`, 3692/3818/3746/3735/3861) and by the per-frame sprite publishers at `0x03C6-0x03D8` and
`0x0496-0x04BA` (5763 each). `0xB000-0xB0FF` and `0xB400-0xB4FF` are sprite RAM banks 0 and 1 per
`boards/timeplt/hardware.json`, and the wait is on the scanline counter at `0xC000` — so this is a
beam-synchronised sprite flip.

**On open item 1 (UNWIRED).** The machine supports it, and the image settles it:

* `translated/loc_1098.js` declares ROM `0x1098–0x1198` and contains **eight** blocks, the fourth of
  which is `0x10F8`. `loc_10f8.js` is the last five of those eight. The range swallows the entry.
* The two occurrences of the word `f8 10` in the image are at `0x3920` and `0x4898`, and
  `tools/z80_decode.py` puts both inside data tables, not as operands. No `call`, no `jp`, no jump
  table reaches `0x10F8`.
* **The machine cannot separate "entered at `0x10F8`" from "fell through from `0x10D8`"** — an opcode
  fetch has PC there either way. Declared hole; the UNWIRED case rests on the image, not on this run.

**⇒ `[seen] executing` as interior code. Supports the LEAN UNWIRED ruling. Keeps `loc_10f8`.**

---

## 19. `0xA9EB` (SEQUENCE_DELAY) — a write tap, because the static scan was a floor

Requested mid-pass, folded into three fresh runs rather than a new rig (`seq_A2` attract 200 s,
`seq_P1` driven `p1long` 300 s, `seq_P2` two-player 200 s — a write tap on `0xA9EB` was the only
change). A tap sees the write whatever the addressing mode, which is the whole point.

**Fifteen distinct program counters across the three tapes.** Each reported PC is the byte after the
store (§0); the storing instruction was recovered with `tools/z80_decode.py` and is quoted verbatim:

| reported | storing instruction | kind | attract | 1P 300 s | 2P |
|---|---|---|---|---|---|
| `1234` | `1231: 32 eb a9  ld (0xa9eb),a` | arm | – | 7 | 5 |
| `126e` | `126b: 32 eb a9  ld (0xa9eb),a` | arm | – | 3 | 2 |
| `12e6` | `12e5: 35  dec (hl)` (`ld hl` at `0x12E2`) | countdown | – | 60 | – |
| `16da` | `16d9: 35  dec (hl)` (`ld hl` at `0x16D6`) | countdown | 270 | 1230 | 690 |
| `16ef` | `16ec: 32 eb a9  ld (0xa9eb),a` | arm | 3 | 11 | 7 |
| `1752` | `1751: 35  dec (hl)` (`ld hl` at `0x174E`) | countdown | 768 | 131 | 387 |
| `1796` | `1795: 35  dec (hl)` (`ld hl` at `0x1792`) | countdown | 768 | – | 256 |
| `196e` | `196d: 35  dec (hl)` (`ld hl` at `0x196A`) | countdown | – | 2 | – |
| `197a` | `1977: 32 eb a9  ld (0xa9eb),a` | arm | – | 1 | – |
| `2832` | `282f: 32 eb a9  ld (0xa9eb),a` | arm | – | 4 | 1 |
| `289e` | `289b: 32 eb a9  ld (0xa9eb),a` | arm | 3 | – | 1 |
| `32f3` | `32f1: 36 0c  ld (hl),0x0c` (`ld hl` at `0x32EE`) | arm | 1 | 1 | 1 |
| **`32ff`** | **`32fe: 35  dec (hl)` — no `ld hl` of its own** | **countdown** | **12** | **12** | **12** |
| `330f` | `330e: 35  dec (hl)` (`ld hl` at `0x330B`) | countdown | – | 540 | 360 |
| `56bc` | `56bb: 35  dec (hl)` (`ld hl` at `0x56B8`) | countdown | 126 | 462 | 294 |

### The prediction, matched — and it is a real confirmation

**Fourteen of the fifteen predicted writers were observed, and at every one of them the storing
instruction is exactly the instruction predicted, in exactly the predicted form.** Seven
`ld (0xa9eb),a` arms, the `ld hl,0xa9eb / ld (hl),0x0C` arm at `0x32EE`, and six of the seven
`ld hl,0xa9eb / dec (hl)` countdowns. Predicting the mechanism and then matching it instruction for
instruction is worth more than either half; this half held.

The fifteenth, **`0x1357`**, was **not reached** by any of the three tapes. It is real — the image has
`1355: 3e 5a  ld a,0x5a` / `1357: 32 eb a9  ld (0xa9eb),a` — just not driven here. Not a
falsification, a coverage gap; no tape in this pass entered that arm.

### ★ And one writer the scan structurally could not see

```
32ee: 21 eb a9   ld hl,0xa9eb
32f1: 36 0c      ld (hl),0x0c      <- the arm the scan found
32f3: 01 00 00   ld bc,0x0000
32f6: 10 fe      djnz 0x32f6
32f8: 32 00 c2   ld (0xc200),a
32fb: 0d         dec c
32fc: 20 f8      jr nz,0x32f6
32fe: 35         dec (hl)          <- ★ the writer the scan cannot match
32ff: 20 f2      jr nz,0x32f3
```

`0x32FE` is a **bare `dec (hl)` with no `ld hl,nn` of its own**. HL was loaded six instructions and a
two-level loop nest earlier, at `0x32EE`, and survives the `djnz` and the watchdog kicks. The address `0xA9EB` DOES appear as an
immediate operand sixteen bytes above, at `0x32EE` — a scan keyed on the operand is not blind to this
routine, it lands on the arm and stops, because nothing in it can attribute a SECOND write at a site
it has already counted. The tap caught it 12 times in **every** run, values
`0x0B` down to `0x00`: the countdown consuming the `0x0C` the same routine armed at `0x32F1`. That is
where `0x32EB`'s "twelve outer passes" comes from, closing the ★ note item 4 already made about this
arm — from the other end.

### What this means for the registry entry

* **The floor is 16, not 15**, and 15 of the 16 are now observed rather than inferred. The committed
  entry's "twelve" and "six" were low; the correction to "15" was also low, for a reason the
  correction itself had already written down.
* **The shape is 8 arms and 8 countdowns**, not 8 and 7.
* **★ The load-bearing sentence needs one amendment.** "Every instruction that writes it is either an
  arm storing a step's own span, or **the countdown at the head of a step**" is false as written:
  `0x32FE` is a countdown in the *body* of a delay loop, not at the head of a step, and its arm is
  thirteen bytes above it in the same routine. The claim survives as "either arms a span or counts one
  down" — and that is the version to land, since it needs no count and no positional claim.
* This is the second immediate-operand miss in this batch. The other is `0x4117`'s aim point (§14),
  written through `ld (ix+d),a`. Two different addressing modes, one blind spot: **a scan keyed on
  the operand cannot see a store whose address is in a register.** Landed as **R35** in
  `reviewer-rules.md`.

Instrument note: no run saw a program counter outside the fifteen. Each tape individually saw a
subset (attract 8, 1P 13, 2P 12) and the union is 15, so each run is a partial control on the others;
none of them can rule out a sixteenth writer in a state none of them drove.

---

## 20. What this pass did **not** reach

* **`0x44C9`** and its whole neighbourhood `0x44A8-0x44DC` — §16, and with no local positive control.
* **`0x1F42`'s era-0 arm** (`0x594E` → table `0x5E00`) — the routine only runs in phase 3, after the
  era has left 0.
* **`0x2D3F`'s free-play arm** (`0xA9C0` non-zero → `jp 0x0F1A`) and its **checksum-trap arm**
  (`0xA817` non-zero → `jp 0x2E3E`). No DIP was changed in any run; `0x2E3E` took 0 dispatches, which
  is correct on a genuine image and is not coverage.
* **`0x4B67`'s trap arm** (`jp nz,0x6000`) — unreachable on a genuine ROM; its zero is not evidence.
* **`0x2CDB`'s derail arm** (`0x0F11`) — same.
* **`0x599A`**, the third sibling of `0x598E`/`0x5994` — 0 dispatches, and unlike `0x44C9` it *does*
  have a local control: its two siblings fired 16 and 9 through the same tap array in the same run.
* **`0x4117`'s phase-byte-above-15 edge** (open item 11) — not driven, not tested.
* **`0x382D`'s returned byte** — the arms were counted; what consumes A was not watched.
* **`SEQUENCE_DELAY`'s arm at `0x1357`** (`ld a,0x5a / ld (0xa9eb),a`) — the one predicted writer no
  tape entered. The other fourteen fired through the same tap in the same runs, so this zero has a
  strong local control; it is a coverage gap, not an absence.
* Anything before **`PC = 0x009E`** — the boot blind spot, §0.

---

## 21. Cert changes this pass supports

| addr | from | to | on what |
|---|---|---|---|
| `0x4B67` | code | **seen, product observed** | write tap gated to its own `0x4B72`; the seventeen seed bytes match ROM `0x4B84` |
| `0x3215` | code | **seen, product observed** | fires on bit 3 only; its five stores watched |
| `0x189E` | code | **seen, product observed** | fires on bit 4 only; its five stores watched |
| `0x2D3F` | code | **seen, product observed** | CREDIT + count on one line, sole writers, and the snapshot |
| `0x1748` | code | **seen, product observed** | 36 cells blanked on the expiry frame; its two ring posts caught |
| `0x1F42` | code | **seen, product observed** | per-era delta magnitudes, ceilings 306 vs 331 |
| `0x2CDB` | code | **seen, product observed** | 27 × 32 blanked cells; guard passed |
| `0x5286` | code | **seen, product observed** | the copy, the `+0x80`, the cursor reset |
| `0x55D4` | code | **seen, product observed** | the dec/inc pair and the slide |
| `0x382D` | code | **seen (executing, both arms)** | 83 + 146 = 229; threshold cell grounded separately |
| `0x28A1` | code | **seen (executing)** | all seven, equal, in every bucket |
| `0x12E2` | code | **seen (executing, both arms)** | 60 dispatches, 2 expiries |
| `0x4117` | code | **seen (executing, both arms)** | 305 re-aims of 4939; retire arm 82/120 |
| `0x4F35` | code | **seen (executing, both arms)** | 800 armed-arm dispatches, all in `mshipff` |
| `0x598E` | code | **seen (executing)** | callers separated: 2 from the era table, 14 from `0x4384` |
| `0x5994` | code | **seen (executing)** | 9, all era 2, matching the ROM table |
| `0x10F8` | code | **seen (executing, interior)** | 670 completions; entry-vs-fall-through not separable |
| `0x44C9` | code | **stays code** | not reached, no local positive control |

## 22. Findings that change something other than a cert

1. ★ **Open item 10 is false.** `0xAC7E`/`0xAC7F` are written 596 times in a 200 s attract run, by
   `ld (ix+0x1a),a` / `ld (ix+0x1b),a` with `IX = 0xAC64`. The point moves. It is not fixed at the
   centre. The claim came from an immediate-operand scan, the same instrument whose blindness item 4
   of the same document had already documented.
2. ★ **Open item 2 is a measured divergence.** All seven of `0x28A1`'s callees are entered on every
   dispatch, including 1598 with `MOTHER_SHIP_ARMED` set. The module's caller-level gate is not what
   the ROM does. (Entry observed, not product — the callees' own test may still make it a no-op.)
3. ★ **Open item 12 is confirmed.** `0xACC4` has one writer, in the era-row applier, and it re-bases
   at every era change and climbs with `ERA_RUNG`. It is a difficulty setting.
4. **A naive reading of `0x598E`/`0x5994`'s era counts is refuted** by separating their two callers.
   Do not write "the era-1 table" into either header.
5. **`RANDOM_REGISTER`'s "twice"** is a one-run dispatch count that this pass measures as four.
   Structural claim survives; the number should go, not be corrected.
6. **Open item 7 gains a fact:** `0x1734` runs for 106 consecutive frames immediately before each
   `0x2D3F` dispatch — except the first of a cold machine, which arrives another way.
7. **`0x2D3F`'s `B = 0x14` is not a glyph count** — thirteen cells are painted from ROM
   `0x086E-0x087A`.
8. **`0xAC43` is a length, not a pointer** (open item 5) — decremented by the consumer at `0x55DB`,
   incremented by the poster at `0x562E`, queue body from `0xAC44`. One name, either way.
9. **A tooling note worth folding into the docs:** on a MAME write tap the reported `PC` is the next
   instruction. Two of this pass's readings would have been attributed to the wrong instruction
   without that correction, and one of them (`0x32D5` vs `0x32D8`) is load-bearing for finding 1.
10. ★ **`SEQUENCE_DELAY` (`0xA9EB`): the predicted 15 writers are confirmed instruction-for-
    instruction where reached (14 of 15; `0x1357` not driven), and the tap found a sixteenth the
    scan could not see** — a bare `dec (hl)` at `0x32FE` reusing HL from `0x32EE`. Shape is 8 arms and
    8 countdowns, floor is 16, and the entry's "the countdown at the **head of a step**" is false for
    that one — land the positional-free wording (§19).
11. ★ **The rule behind findings 1 and 10:** a scan keyed on the address as an *immediate operand*
    cannot see a store whose address is in a register — `ld (ix+d),a` in one case, a carried `HL` in
    the other. Two independent misses in one batch. This is now **R35** in `reviewer-rules.md`,
    narrowed to the form a reviewer can check from a diff: an EXCLUSIVITY claim about a cell must
    cite a write tap, not a scan.
