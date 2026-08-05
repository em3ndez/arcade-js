# Time Pilot — known gaps in the translated layer

## 1. Duplicated transcription (OPEN)

`docs/translation.md` requires that the same ROM bytes never appear in two files: a routine that
reaches another routine's registered entry must DELEGATE with `m.call`, never inline the shared
body. Copies drift — one pair here had already drifted on write-bus-cycle offsets before it was
found.

Many were corrected by trimming the outer routine at its transfer and delegating. The pairs below
were not. **They are not all the same shape, and the cheap fix applies to more of them than a
first pass suggested:**

- Where the outer reaches the inner through a CONDITIONAL BRANCH, its own code continues past the
  branch and rejoins later; that needs real surgery and its own verification against MAME.
- Where the outer reaches the inner by PLAIN FALL-THROUGH, trimming is cheap. `loc_19f0` is one:
  it falls into `loc_1a9a` after the call at 0x1A97, and 0x1A9A is externally entered from
  `loc_4d3a`, so `loc_1a9a` must stay the owner. Check each row before assuming surgery.

An attempt to script the trims silently truncated six files, which is why the remainder are
listed rather than rushed.

**THESE ARE CONVENTION DEFECTS, NOT BEHAVIOURAL ONES — AND THAT IS NOW MEASURED, NOT ASSERTED.**
Every row below was swept pairwise: for each `m.step` target in the shared span, the cycle charge
and the semantic statements attached to it — memory writes INCLUDING their bus-offset argument,
flag-modelling calls, register assignments, pushes and calls — were compared between the copies,
discarding only control-flow scaffolding. **All 34 rows: IDENTICAL. Zero drift.**

The parameterised trio resisted that method (no literal addresses to key on) and was decided
another way: all three carry a byte-identical `block()` body, with matching call arguments for
every shared block.

Residual diffs were boundary artifacts, each adjudicated against the ROM: the instruction ENDING
at a span's first address lies outside the shared body, and at an exit one copy delegates where
the other inlines.

**THE SWEEP HAS A BLIND SPOT, FOUND BY CHECKING ITS ARITHMETIC.** A reviewer recomputed row 1's
shared-address span and got a different answer from the one recorded here, then reproduced BOTH
numbers: taking only the FIRST arm of `m.step(cond ? A : B, ...)` reproduces the recorded figure,
taking both arms reproduces theirs. So the extractor behind *"All 34 rows: IDENTICAL. Zero drift"*
never keyed on the second arm of a ternary step — it is blind exactly at the **taken-vs-not-taken
addresses of conditional branches and `djnz`**, which is the same class as the DD/FD gap in §6.
Many translated files contain a ternary `m.step`, so this is not one row. The three addresses
dropped from row 1 were hand-checked afterwards and agree, but the sweep as run did not check
them, and "zero drift" should be read as bounded by that. `tools/stepcheck.py` is NOT the culprit:
its regex captures both arms. The truncating derivation is not in the repo, so only its output is
checkable — and its output was wrong. **Read every shared-address figure in the table below as
coming from that same extractor**, i.e. as a lower bound. Only row 1's was recomputed; correcting
that one number alone would falsely imply the others had been.

**A SECOND KIND OF DRIFT THE SWEEP CANNOT SEE AT ALL: the comments.** The sweep compares semantic
statements and discards comment text by construction, so two copies of one body can disagree in
their READING of the same instruction. At ROM 0x45E4:

    loc_43f0.js:303   m.step(0x45e4, 7); // jr z,0x4623 (not taken)
    loc_459b.js:118   m.step(0x45e4, 7); // jr z NOT taken -- the carry from 0x45E0 is still live

One copy carries a claim the other does not. Across that pair's shared span, 15 of 63 shared
addresses have differing trailing comments; most are cosmetic, and this is the one that is a
reading. `loc_3793`/`loc_37bd` and `loc_1a9a`/`loc_19f0` carry the same shape. It needs its own
pass and will not fall out of a drift check.

**A TRAP FOR THAT PASS.** A trailing comment names the instruction ENDING at the `m.step` address,
not the one starting there — `m.step`'s argument is the NEXT instruction. So at 0x45B3
`loc_43f0.js:153` says `jp nz,0x45b3 (taken)` while `loc_459b.js:53` says `cp c`, and that is not
drift: the two files reach 0x45B3 from different predecessors. Key such a pass on the instruction
ending at the address or it manufactures false positives.

### The method to use on the remaining rows

Worked out by two reviewers approaching it from opposite sides, and it is more particular than
"diff the bodies":

1. **Restrict to the shared span FIRST.** A whole-file diff is meaningless — one file's range
   strictly contains the other's, so most of the difference is code the other file has no reason
   to contain. Skipping this step produces hundreds of differing lines on a row that is in fact
   identical, and the wrong conclusion that normalisation is hopeless.
2. **Normalise scaffolding and canonicalise idioms**: `m.ret(n)` ≡ `m.step(m.pop16(), n)`, the
   ternary `djnz` ≡ the if/else `djnz`, switch/label vs `for(;;)`.
3. **Compare as an order-insensitive MULTISET, as a screen.** Two entries into one body emit the
   shared arms in *entry order*, so a linear diff reports the same statements as different. That
   is the second-entry shape itself — the case this section exists to describe — so
   order-insensitivity is load-bearing, not a nicety.
4. **Then compare the statements KEYED BY ROM ADDRESS, in ascending address order.** A multiset
   alone discards order, and in a faithful transcription order is semantics — used by itself it
   swaps a false-positive class for a false-negative one. Sorting by address is order-SENSITIVE,
   so a genuine reordering still shows, and rotation-INVARIANT, so the second-entry layout does
   not. That is strictly better than "multiset, then adjudicate by hand", which demands a human
   verdict on every second-entry row.
   The rotation is real, not hypothetical: `loc_4008` declares 0x4008-0x4016 and loops back to
   0x3FFC, so it emits the shared arms starting mid-body while `loc_3ff9` emits them from 0x3FFC.
   Same statements, rotated.
5. **Run a second method with a DIFFERENT blind spot, and treat disagreement as the product.**
   Two methods that can only agree produce confirmation carrying no information — this section's
   own figures were "confirmed" by a second derivation that agreed for reasons unrelated to the
   first. What worked tonight was two methods failing differently, and one of them noticing.

What that closes and what it does not: it proves the two copies AGREE WITH EACH OTHER. It is not a
re-derivation of either from the ROM for files outside a reviewed batch.

**A SECOND BLIND SPOT IN THE DETECTION RULE.** "Two files share a non-registry address" cannot see
a duplicated body whose interior targets are ALL registry entries — i.e. any one-instruction
routine falling through into another registered routine. One real instance: `loc_596b` (ROM
0x596B, `ld hl,0x08fa`, falling into the registered 0x596E) is transcribed a second time inside
`loc_1f42`. The copies agree, so it is another tidy-up, but it is a missing row and the rule will
not find its siblings.

**§7 IS RESOLVED.** `stepcheck.py` now reports CLEAN over 6461 targets across 431 files. The 251
bad targets were a stale generated listing (`out/dk.asm`), exactly the "one bad assumption
repeated" hypothesis rather than 251 defects.

### Detection

Two files share an instruction address that is NOT a registry entry. A shared REGISTRY entry is
an ordinary shared call target; a shared non-entry address can only be a shared BODY. Addresses
come from both `m.step` literals and the ROM addresses named in trailing comments.

An earlier derivation used a minimum contiguous run of four, which was a false-negative generator
for short routines — it hid the complete duplication of the two-instruction `loc_1f3e` inside
`loc_1f01`. The rule above has no threshold.

**One blind spot remains and is listed by hand.** `loc_1098`, `loc_10f8` and `loc_10fd` each carry
their own copy of a parameterised `block()` helper covering ROM 0x1118-0x1197 (and 0x10F8-0x1117
in two of them). Every target inside it is computed as `h + 0x..`, so those files contain no
literal address for any derivation to intersect. They are the only three files using that form,
and this case IS trimmable: both exits of `loc_1098`'s 0x10D8 block land on 0x10F8, which is
externally entered and registered.

| file A | file B | shared body addresses | span |
|---|---|---|---|
| `loc_49fa` | `loc_4a0f` | 67 | 0x4A12-0x4A97 |
| `loc_43f0` | `loc_459b` | 63 | 0x45B3-0x4660 |
| `loc_49fa` | `loc_4a42` | 49 | 0x4A43-0x4A97 |
| `loc_4a0f` | `loc_4a42` | 47 | 0x4A43-0x4A97 |
| `loc_19f0` | `loc_1a9a` | 41 | 0x1A9D-0x1AE3 |
| `loc_4fbf` | `loc_4fe0` | 38 | 0x4FE3-0x502F |
| `loc_496e` | `loc_4984` | 21 | 0x4987-0x49A7 |
| `loc_1253` | `loc_1271` | 11 | 0x12FC-0x1318 |
| `loc_1253` | `loc_12fb` | 11 | 0x12FC-0x1318 |
| `loc_1271` | `loc_12fb` | 11 | 0x12FC-0x1318 |
| `loc_4941` | `loc_496e` | 11 | 0x4971-0x4981 |
| `loc_3ff9` | `loc_4008` | 10 | 0x3FFC-0x4016 |
| `loc_3ff9` | `loc_400b` | 10 | 0x3FFC-0x4016 |
| `loc_4008` | `loc_400b` | 10 | 0x3FFC-0x4016 |
| `loc_43f0` | `loc_460e` | 10 | 0x4623-0x4640 |
| `loc_459b` | `loc_460e` | 10 | 0x4623-0x4640 |
| `loc_5211` | `loc_5254` | 10 | 0x5258-0x5269 |
| `loc_11ed` | `loc_1226` | 8 | 0x1229-0x123A |
| `loc_1f01` | `loc_1f42` | 7 | 0x1F45-0x1F52 |
| `loc_379f` | `loc_37bd` | 7 | 0x37C4-0x37D2 |
| `loc_3fea` | `loc_3ff9` | 5 | 0x3FFC-0x4003 |
| `loc_3fea` | `loc_4008` | 5 | 0x3FFC-0x4003 |
| `loc_3fea` | `loc_400b` | 5 | 0x3FFC-0x4003 |
| `loc_4108` | `loc_410b` | 5 | 0x410E-0x4116 |
| `loc_3793` | `loc_37bd` | 3 | 0x3795-0x379D |
| `loc_406c` | `loc_40ab` | 3 | 0x40AF-0x40B7 |
| `loc_07b1` | `loc_4b67` | 1 | 0x6000-0x6000 |
| `loc_1f01` | `loc_1f3e` | 1 | 0x1F3F-0x1F3F |
| `loc_1f42` | `loc_594e` | 1 | 0x5951-0x5951 |
| `loc_1f42` | `loc_5965` | 1 | 0x5968-0x5968 |
| `loc_566e` | `loc_5674` | 1 | 0x5677-0x5677 |
| `loc_1098` | `loc_10f8` | (parameterised) | 0x10F8-0x1197 |
| `loc_1098` | `loc_10fd` | (parameterised) | 0x1118-0x1197 |
| `loc_10f8` | `loc_10fd` | (parameterised) | 0x1118-0x1197 |

### Files involved

- `games/timeplt/translated/loc_07b1.js`
- `games/timeplt/translated/loc_1098.js`
- `games/timeplt/translated/loc_10f8.js`
- `games/timeplt/translated/loc_10fd.js`
- `games/timeplt/translated/loc_11ed.js`
- `games/timeplt/translated/loc_1226.js`
- `games/timeplt/translated/loc_1253.js`
- `games/timeplt/translated/loc_1271.js`
- `games/timeplt/translated/loc_12fb.js`
- `games/timeplt/translated/loc_19f0.js`
- `games/timeplt/translated/loc_1a9a.js`
- `games/timeplt/translated/loc_1f01.js`
- `games/timeplt/translated/loc_1f3e.js`
- `games/timeplt/translated/loc_1f42.js`
- `games/timeplt/translated/loc_3793.js`
- `games/timeplt/translated/loc_379f.js`
- `games/timeplt/translated/loc_37bd.js`
- `games/timeplt/translated/loc_3fea.js`
- `games/timeplt/translated/loc_3ff9.js`
- `games/timeplt/translated/loc_4008.js`
- `games/timeplt/translated/loc_400b.js`
- `games/timeplt/translated/loc_406c.js`
- `games/timeplt/translated/loc_40ab.js`
- `games/timeplt/translated/loc_4108.js`
- `games/timeplt/translated/loc_410b.js`
- `games/timeplt/translated/loc_43f0.js`
- `games/timeplt/translated/loc_459b.js`
- `games/timeplt/translated/loc_460e.js`
- `games/timeplt/translated/loc_4941.js`
- `games/timeplt/translated/loc_496e.js`
- `games/timeplt/translated/loc_4984.js`
- `games/timeplt/translated/loc_49fa.js`
- `games/timeplt/translated/loc_4a0f.js`
- `games/timeplt/translated/loc_4a42.js`
- `games/timeplt/translated/loc_4b67.js`
- `games/timeplt/translated/loc_4fbf.js`
- `games/timeplt/translated/loc_4fe0.js`
- `games/timeplt/translated/loc_5211.js`
- `games/timeplt/translated/loc_5254.js`
- `games/timeplt/translated/loc_566e.js`
- `games/timeplt/translated/loc_5674.js`
- `games/timeplt/translated/loc_594e.js`
- `games/timeplt/translated/loc_5965.js`

43 files of 391; 34 pairs.

## 2. Identity lines whose range contains another registered entry (OPEN)

Where a routine was trimmed to delegate, its one-line identity should name only the bytes it
still transcribes. Swept layer-wide rather than collected per batch: every header below states a
range containing at least one OTHER registered routine's entry address.

**Two different situations are mixed here and the fix differs.** Most are an overstated tail — the
file delegates and its header was never trimmed, so the range belongs to the routine it delegates
to. But a span may also legitimately ENCLOSE an embedded subroutine the file CALLS rather than
transcribes: `loc_18c3` honestly declares 0x18C3-0x19D9 and correctly `m.call`s `loc_1980` inside
it. Nothing is falsely claimed there. Check which before editing.

In every case the DELEGATION ITSELF IS CORRECT and there is no duplicated transcription; only the
header arithmetic is wrong. `loc_49fa` is the mirror image — its header understates, omitting the
`loc_49fa_4a0f` helper the file contains.

| file | stated range | registered entries inside it |
|---|---|---|
| `loc_0c90` | 0x0C90-0x0D1A | 0x0CE8 |
| `loc_1098` | 0x1098-0x1198 | 0x10F8, 0x10FD |
| `loc_10f8` | 0x10F8-0x1198 | 0x10FD |
| `loc_1199` | 0x1199-0x123A | 0x11ED, 0x1226 |
| `loc_11ed` | 0x11ED-0x123A | 0x1226 |
| `loc_1253` | 0x1253-0x1318 | 0x1271, 0x12E2, 0x12E7, 0x12FB |
| `loc_12e2` | 0x12E2-0x12FA | 0x12E7 |
| `loc_18c3` | 0x18C3-0x19D9 | 0x1980 |
| `loc_19f0` | 0x19F0-0x1AE3 | 0x1A9A |
| `loc_1f01` | 0x1F01-0x1F75 | 0x1F2E, 0x1F3E, 0x1F42, 0x1F55 |
| `loc_1f3e` | 0x1F3E-0x1F54 | 0x1F42 |
| `loc_308a` | 0x308A-0x30A4 | 0x309B |
| `loc_30a5` | 0x30A5-0x3113 | 0x30D1 |
| `loc_379f` | 0x379F-0x37D5 | 0x37BD |
| `loc_3b5f` | 0x3B5F-0x3B93 | 0x3B77 |
| `loc_3cd9` | 0x3CD9-0x3CE8 | 0x3CE1 |
| `loc_3fea` | 0x3FEA-0x4007 | 0x3FF9 |
| `loc_3ff9` | 0x3FF9-0x4016 | 0x4008, 0x400B |
| `loc_4008` | 0x4008-0x4016 | 0x400B |
| `loc_40d6` | 0x40D6-0x4107 | 0x40EA |
| `loc_4108` | 0x4108-0x4116 | 0x410B |
| `loc_43f0` | 0x43F0-0x47B2 | 0x4447, 0x44C9, 0x44DC, 0x459B, 0x460E, 0x46BA, 0x46CE, 0x46DB |
| `loc_4941` | 0x4941-0x4983 | 0x496E |
| `loc_496e` | 0x496E-0x49A7 | 0x4984 |
| `loc_4a0f` | 0x4A0F-0x4A9C | 0x4A42 |
| `loc_4e4f` | 0x4E4F-0x4E96 | 0x4E63 |
| `loc_4fbf` | 0x4FBF-0x5031 | 0x4FE0 |
| `loc_5211` | 0x5211-0x5269 | 0x5254 |
| `loc_566e` | 0x566E-0x5678 | 0x5674 |
| `loc_599d` | 0x599D-0x59C4 | 0x59A0 |

**ORDERING HAZARD — read before doing this sweep.** Trailing clauses elsewhere in the layer
describe a jump target in terms of the routine that CLAIMS the address, and several are true only
because that claim is the overstated header. `loc_3b94` said "into loc_3b5f's interior" of an
address that is `loc_3b77`'s own registered entry; it read as merely stale while `loc_3b5f`'s
header still claimed through 0x3B93, and would have become FALSE the moment the header was
trimmed. Grep for clauses naming a routine near a delegation boundary and fix them in the same
pass. Cheap together, expensive as a follow-up.

30 files. A reader summing these headers to compute coverage will double-count.

## 3. Trailing clauses that assert a MECHANISM (OPEN, already committed)

`docs/translation.md` now says a trailing clause after `--` must name what the compared bytes ARE,
not what they are taken to mean. That ruling postdates these commits, and a reviewer swept c12
against it afterwards. These are IN THE REPO and need a focused follow-up commit:

| site | clause | why it fails the rule |
|---|---|---|
| `loc_4017.js:30,58` | `-- the X / Y scroll delta` | nothing in the file establishes what 0xA808/0xA80A hold |
| `loc_4017.js:45` | `-- gravity` | bytes show `ld de,0x0009` into a 16-bit accumulator |
| `loc_4017.js:28,41,56` | `-- velocity`, `-- drift` | names for a visible accumulate-and-store-back |
| `loc_4017.js:73,83` | `-- off the side` / `-- off the bottom` | bytes show a ±0x10 window test on a coordinate |
| `loc_3e8e.js:76` | `-- the sprite code` | asserts what `(iy+0x01)` is |
| `loc_3e8e.js:55` | `-- below 0x1c, no frame update` | first half is a byte fact, second is a mechanism |
| `loc_3d25.js:170,215` | `-- the aimed direction` | interpretation of `0x33b8`'s return plus a ±0x18 |

`loc_4017` carries most of them AND is one of the files that executes zero instructions in the
golden capture, so nothing has ever checked those readings.

**RESOLVED LAYER-WIDE, so §3 is now the only place the old convention survives.** The trig tables
at 0x59D7 / 0x5C00 / 0x5E00 are COSINE-phased — `T[0]` is the maximum, `T[0x40]` is zero — so a
lookup at the raw heading is the cosine term and the one at `heading-0x40` is the sine term. Both
`loc_326c` and `loc_58fe` had those names INVERTED, self-consistently, across ten sites. Rather
than swap them, the names were removed: the comments now say `DE = T[heading]`,
`BC = T[(heading-0x40) & 0xff]` and "the DE term" / "the BC term", because the index arithmetic is
checkable from the ROM and the trigonometric reading is not.

The `-- background X / Y velocity` clauses on 0xA808 / 0xA80A in `loc_58fe` are also gone, which
removes the double standard: §3 lists the identical clause on the identical cells in `loc_4017`
as a violation, and the repo was holding the same words to two standards.

Separately, `loc_3ed6.js:217` says `DEAD LOAD -- A is overwritten two instructions on`; it is
overwritten ONE instruction later, at 0x3F7A.

## 4. `loc_0030`'s dead `label` parameter (OPEN)

`export function loc_0030(m, label)` never reads `label`, and eight call sites compute a
descriptive string that is discarded. The fix is the signature plus all eight callers in ONE
unit — changing one side alone is worse than the status quo, and spreading it across batches is
the staged-diff leak R13 forbids.

Worth keeping rather than deleting silently: those strings are currently the only written record
of what each `rst 0x30` dispatch table selects on.

## 5. Smaller items (OPEN)

- `loc_1393` trailing comments end "unreachable, see header"; the header no longer says why.
  The claim is true — at 0x13A2 `and 0x04` leaves A=0x04, so the 0x13AD/0x13B4 arms never run.
- Many `m.step` lines carry no trailing mnemonic, so the transcription is right but not
  checkable in place. It is not a handful: `loc_36af` has eleven, `loc_3ed6` and `loc_47b3`
  seven each, `loc_4447` six, `loc_5211` five, plus `loc_28fe.js:25`, `loc_3deb.js:23` and
  `loc_3e6c.js:34`.
- `loc_2010`'s helper split is named `loc_2063`, the bare shape reserved for ROM entries; the
  convention for a split is `loc_<parent>_<addr>`.
- `boards/timeplt/memory.js`'s missing-offset error lists `ld (nn),a` and `ld (hl),a`/`ld (de),a`
  but omits `ld (hl),n = 7` — the case that actually went wrong. That file is already committed.

## 6. Gates that are green because they are blind (OPEN, highest priority)

- **`tools/stepaudit.py` has no timing for DD/FD-prefixed conditional branches.** For `fd dc` it
  falls through to `_B[0xDC] + 4` = 8T and returns only the fall-through as a legal successor.
  The class is wider than first recorded: `jp (ix)`/`jp (iy)` and prefixed `jp`/`jr`/`call`/`ret`
  are all mis-modelled, and the opcodes that matter (`djnz`, `jr cc`, `call cc`, `ret cc`) are
  absent from `_B` and so default to 4.
  **Correction to the earlier wording here:** it predicted `loc_15ca` would be flagged as both
  WRONG T-STATES and ILLEGAL SUCCESSOR. Only the timing arm fires — the transition that actually
  exists is the not-taken one, whose successor IS the fall-through, so the successor check passes.
  The illegal-successor arm needs the taken branch to 0xFEB9, outside the ROM, which never runs.
  Direction of failure is **false ALARM, not false clean**, which is why it has never fired; it
  goes silent only if a translated file charges the same wrong number.
  The checker's timing model is **independently derived**, so §6's own principle is satisfied
  here: `stepaudit.py` carries its own tables, `tools/z80_decode.py` carries no timings at all,
  and the translated files carry the charge as a per-site literal. The residual coupling is
  authorship, not mechanism.
- **`stepaudit.py` exempts a transition entirely when it cannot time the opcode**, skipping the
  successor check too. FIXED: it no longer prints CLEAN beside untimed transitions (it prints
  INCOMPLETE) and no longer exits 0 with them outstanding. The old exit status was the part that
  mattered — the untimed count was disclosed on stdout, but `$?` ignored it, so any caller
  reading the status treated a partial audit as a full one.
  Two exemptions remain undisclosed by shape: NMI-entry and non-ROM from-PCs are folded into one
  `skipped` counter, and `succ is None` silently skips the successor check for `ret` / `ret cc`
  taken / `jp (hl)` — correct by design, but the docstring claims to check successors.
- **The missing-offset throw has never fired for this game.** `boards/timeplt/memory.js` throws
  when a hardware write carries no bus offset, but only with `writeTrace` enabled — and Time
  Pilot's `emit.js` has no flag to enable it. Every reviewer who checked the class had to switch
  it on by hand. A gate nobody can turn on is not a gate.
- **`unit_equiv.mjs` always exits 0.** Every verdict — DIVERGE, THREW, SPIN, PAIR INVALID — is
  printed and the process exits 0, so `unit_equiv.sh` is green over live failures.
- **`steptrace.js` exits 0 on a truncated trace**, and feeding that to `stepaudit.py` yields a
  green audit of a machine that never booted.
- **An EMPTY capture directory reads as a pass** in `unit_equiv.mjs`: zero comparisons performed,
  zero failures reported, exit 0. A missing `spec.txt` makes it assert "no ret reachable from the
  entry" for every routine — a claim about the ROM manufactured from a missing file.
  **Correction:** an earlier version said "a missing or empty" directory. Only the empty half is
  true — a MISSING directory throws ENOENT out of `readdirSync` and exits 1. Measured both ways.
- **`emit.js`'s anti-spin assertion did not run at its own default.** The NMI floor is
  `frames - 400`, and the default is 242 frames, so the check that exists because the tool once
  "printed CLEAN while the machine was wedged" was skipped on every default invocation — and a
  skipped check that prints nothing is indistinguishable from a passing one. FIXED: it now says
  out loud when the frame count is inside the boot window and the assertion did not run.
  `render.js` carries the same code but defaults to 1802, so it was always active there.
- **`unit_equiv.mjs`'s pair-validity re-assert was DEAD.** It tested `xm.nmi`, a key the Lua side
  never writes, so `undefined > 0` was permanently false and the stated guarantee — that a capture
  from an older or edited script cannot certify a bad pair — was not in force.
  FIXED, but **not** the way it first looked. The obvious repair is to rename it to the key that
  does exist, `nmi_aborts`. That is wrong on the code: the Lua RETRIES an aborted window and only
  writes a pair once `nmi_count == nmi_at_entry`, so the counter records DISCARDED ATTEMPTS, and
  a pair that exists is NMI-free by construction. Reading it as "NMIs leaked into this window"
  rejects pairs on the strength of tries that were thrown away.
  **The corpus cannot show you that.** An earlier version of this note argued the point with two
  nonzero counts — they are in `attempts.txt`, which line 230 never reads, and both belong to
  entries that never closed a window, so no exit file exists for either. Every `*.exit.txt` in the
  capture carries `nmi_aborts=0`. So the wrong rename would have failed **zero** pairs today,
  passed review, and shipped latent until some capture both retried and closed. That is the shape
  worth remembering: identical output on the real corpus is a WARNING, not a reassurance.
  The guarantee is about PROVENANCE, so the check is now a presence test on the abort keys. Read
  that as APPROXIMATING the guarantee, not restoring it: presence catches a capture from an OLDER
  script, but not one from an EDITED script that kept the writes and dropped the enforcement. Its
  neighbour, the SP check, re-derives an actual property; this one cannot, because the property is
  never recorded. The parity fix is one line on each side — have the Lua write `nmi_at_entry` and
  `nmi_at_exit` into the metadata and assert equality here, exactly as SP is asserted. It needs a
  re-capture to take effect.
- **`unit_capture.lua`'s ROM_END guard has a side effect nothing counts.** When `SP <= ROM_END`,
  `entry_ret` is nil, and the return-address check is then skipped ENTIRELY for that arm — while
  the file's own header sells that check as what stops a foreign `ret` at a coincidentally equal
  SP from closing a window. This is the live one of the two `unit_capture` findings.
- **A residual recursion in the same guard**, not reachable today: `read_u16` at SP = 0xFFFF wraps
  its high byte to 0x0000, which IS a tapped entry. The guard's reasoning covers SP but never
  SP+1. Fixing it honestly means re-running the capture, so it is recorded rather than patched.

These are the failure mode this project has been burned by repeatedly: a measurement quoted as
evidence for something it structurally cannot see fail. Fix before trusting any of them again.

### What the 1802-frame state diff can and cannot see, measured

A reviewer teeth-tested the gate itself rather than assuming, and both results bound what any
"byte-for-byte PASS" is worth:

- **Injecting +1T into an executed routine diverges the state at frame 1126** — so the diff does
  have teeth for timing. But **the same defect is invisible at 400 frames**, so every shorter run
  quoted anywhere is weaker than it reads.
- **Corrupting register A on exit from an executed routine produces NO state diff at all across
  the full 1802 frames.** RAM equality is not a live-out check, even for code the capture runs. A
  wrong register left behind by an executed routine passes everything we currently have.

Roughly half the layer is never executed by the capture at all, so for those files the
instruction-level ROM comparison in the review is not the best evidence — it is the ONLY evidence.

**And a routine the capture DOES run can still carry a false claim.** `loc_326c` executes every
frame, passes the byte-exact diff, and its comments named DE as sine and BC as cosine — inverted.
The table at 0x5E00 has `table[0] = +256` and `table[64] = 0`, so index 0 is the cosine extreme.
Execution checks behaviour; a name is not behaviour, so no amount of running the code can test it.
That is a different blindness from "the gate never reaches this file", and it is the one that
motivates the trailing-clause rule.

**A timing model shared between the code and its checker cannot fail visibly.** If the translator
and `stepaudit.py` both believe `dd 34` costs 19 rather than 23, the audit is green and the ROM is
wrong. The only defence is an independently derived table, which is how the DD/FD gap above was
found.

## 7. `stepcheck.py` reports 251 bad `m.step` targets — unexplained (OPEN)

`tools/stepcheck.py` flags 251 bad targets across 16 files (`loc_07b1`, `loc_08fa`, `loc_0c0f`,
`loc_0c23`, `loc_0c39`, `loc_0c90`, `loc_0d57`, `loc_0d61`, `loc_15ca`, `loc_1f55`, `loc_1f99`,
`loc_2530`, `loc_2c31`, `loc_3421`, `loc_49fa`, `loc_4b67`). `loc_49fa` steps to 0xBFD7 and
0xFDC4, outside the 24KB ROM entirely.

**Do not act on the number before diagnosing it, and split the list first.** The hits are two
different shapes:

- Most read `is NOT an instruction start (inside a span the tracer calls unreached)`. That is a
  claim about a GENERATED artifact (`out/dk.asm`) being stale with respect to routines lifted
  since, and it would clear by re-running the trace. This is the "one bad assumption repeated"
  candidate.
- `loc_49fa`'s 0xBFD7 / 0xFDC4 and `loc_4b67`'s 0x6000 carry no such parenthetical: they are
  outside the ROM image entirely, so no re-trace explains them.

Split on that parenthetical before deciding how large the problem is.

## 8. `ldirAt`/`lddrAt` pass no write-bus-cycle offset (OPEN)

`games/timeplt/machine.js`'s block-copy helpers call `mem.write8` with no `busOffset`. Inert
today only because every LDIR destination in this layer happens to be work RAM — a property of
the current corpus, not of the code, and the same shape as the two offset defects already found
and fixed. `machine.js` is already committed, so this is its own unit.

## 9. ROM 0x4B07-0x4B18 is real code with no translated file (OPEN)

Eighteen bytes — `ld hl,(0xab41)` … `ld a,r` / `add a,l` / `xor h` / `ret`, a PRNG step — sitting
between `loc_4afb` (ends 0x4B06) and `loc_4b19`, with no `loc_4b07.js` anywhere in the layer.

It is on `out/unreached.txt` and the only two little-endian occurrences of 0x4B07 in the ROM both
land inside data, so nothing statically reaches it and every gate is silent by construction. That
is the shape that survives an entire port unnoticed. Decide whether it is genuinely dead or
reached dynamically, and either transcribe it or record why not.

## 10. The command-ring dispatch table has LIVE handlers with no file — THE LAYER IS INCOMPLETE (OPEN)

**Say this plainly rather than softening it: `translated/` does not transcribe the whole reachable
program.** Not "imperfect" — incomplete. Two handlers of the 0xAC00 command ring are demonstrably
reachable, and neither has a file. Reaching either is a HARD STOP, not a divergence.

Proven by construction, not by argument — both of them, separately. Seed the ring at 0xAC00 with
the command, cursor 0xA9B3 = 0, call `loc_0b93`:

    cmd 5: not implemented: m.call: no routine registered at 0x4d72
    cmd 7: not implemented: m.call: no routine registered at 0x0eac

The word table at 0x0BBC is what dispatches. `loc_0b93` masks the command with `and 0x0f` and
`m.call`s the slot:

| idx | target | status |
|---|---|---|
| 0 | 0x0BDD | no file; no enqueue site found |
| 5 | **0x4D72** | **no file, LIVE** — enqueued at ROM 0x4C9E and 0x4E11, both `ld d,0x05` + `rst 0x38` |
| 7 | **0x0EAC** | **no file, LIVE** — enqueued at ROM 0x079B/0x079D, whose own transcription in `loc_0774` reads `rst 0x38 -- queue it again under command 7` |
| 8, 9, 12-15 | 0x0BDC | bare `ret`; the only `ld d,n` feeding these slots loads 0xFF, which `loc_0b93` skips on bit 7 |

The producer is transcribed and the consumer is not — in the 0x0EAC case the producing file
NAMES the command it is queueing. Both 0x4D72 enqueue sites sit behind `ld a,(0xad30) / and a`,
and 0xAD30 is live work RAM written 0xFF at ROM 0x18A3 and 0x3220, not a constant zero.

The tracer misses all of this because the dispatch is `jp (hl)` through a word table, which no
static reference scan follows. **A tracer-derived coverage map cannot see this class at all**, so
"unreached" from that tool is not evidence of dead code.

Correction to an earlier version of this section, which had it wrong: 0x4D72's first instruction
is `ld c,a`, then `ld a,(0xad30) / and a / ret z`. `ld de,0xa783` is the FIFTH instruction, at
0x4D78. The omitted 0xAD30 guard is the more interesting fact — it is the same flag both enqueue
sites test.

## 11. ROM 0x5277-0x5285 is code with no translated file (OPEN)

A 15-byte checksum loop — `ld b,0 / ld hl,0x27de / xor a / add a,(hl) / inc hl / djnz / sub 0xc5 /
call nz,0x53d4` — that falls through into `loc_5286`. Transcribed in no file. Nothing in the ROM
references 0x5277 and `out/unreached.txt` lists it, so it is unreferenced rather than reachable —
but note `loc_5286`'s registered entry is also this loop's fall-through successor, so the boundary
is a choice someone made implicitly.

Third instance of the class, with §9 (0x4B07 PRNG step) and §10 (0x4D72, the live command-ring
handler). Whether a hole is dead or live is a question the tracer cannot answer for this ROM,
because the `rst 0x30` inline tables and the 0xAC00 command ring both dispatch indirectly.

## 12. Smaller follow-ups (OPEN)

- `loc_0ce8` is interior by translation.md's own test — nothing outside `loc_0c90` reaches it —
  so it should probably not be a registered routine at all. `loc_181d` is the genuinely-external
  counter-example. Decide, then make `loc_0c90.js:3`'s range clause match.
- `loc_1748`'s identity runs one byte past its last transcribed instruction, and
  `loc_1734.js:20`'s "its exact length" carries the same off-by-one: the ROM checksums 34 bytes
  from 0x1748 but the code ends at 0x1768.
- The registry (`_registry.generated.js`) currently lands as its own unit at the end, because it
  imports every routine. `docs/translation.md` says to regenerate it per batch so an unregistered
  `m.call` fails loudly. Make that a stated choice rather than an accident of ordering.

## 13. ROM 0x46A6-0x46B9 is code with no translated file (OPEN)

A fourth hole, and the only one found INSIDE a file's own declared range: `loc_43f0.js` claims
0x43F0-0x47B2, and this span sits within it untranscribed. The bytes decode cleanly as a sibling
of the 0x4670-0x467B heading computation with a different mask:

    46a6  ld a,(0xa980)   46a9  ld c,a      46aa  and 0x1c    46ac  bit 0,c
    46ae  jr nz,0x46b2    46b0  neg         46b2  add a,b     46b3  rrca
    46b4  rrca            46b5  and 0x3e    46b7  jp 0x467d

Unlike §10 there is no evidence it is live: the ROM contains no flow reference and no raw word
pointing at it. It is recorded because a hole inside a claimed range is worse than one between
routines — the header asserts coverage the file does not provide, so no partition check that
trusts headers can find it.

If it is ever reached, note the consequence: `jp 0x467d` would be an external entry into
`loc_43f0_4663`'s interior, which currently inlines 0x467D.

## 14. A DATA span is a registered routine, so registry-derived coverage overcounts (OPEN)

`loc_59d7` registers 0x59D7, whose range 0x59D7-0x5BD6 is the 256-entry cosine table, not code.
The file is right to exist and right to be registered: `machine.js` throws `NotImplemented` for an
unregistered address and `runFrames` ABSORBS that into a translation-gap report, so deleting it
would make an anti-tamper trip surface as "you forgot to lift 0x59D7". The file throws a bare
`Error` instead, which propagates as a real failure. Keep it.

The hazard is downstream: any partition or coverage derivation that walks the registry counts
0x59D7-0x5BD6 as transcribed CODE. This is not §2 — §2 is a range overstating into a sibling
ROUTINE, and its fix (trim the header) does not apply here.

## 15. One byte, three names — deliberately not unified (OPEN)

The byte pushed at ROM 0x560E / 0x5619 and loaded at 0x567C is called "the sound code"
(`loc_560c`), "the request code" (`loc_5617`) and "the sound command" (`loc_5679`).

A reviewer traced it and established that "sound command" is the accurate one: A enqueues at
0xAC43, `loc_55d4` drains that queue into 0x55F8, which writes 0xC000, and the board layer has
0xC000 W = sound data to the audio Z80. **They were not unified anyway, and the reason is the
rule rather than laziness.** `loc_5617`'s clause sits on a `push af` preserving a byte whose
meaning that file's own bytes never establish. Unifying would mean asserting in `loc_5617`
something only `loc_5679`'s bytes show — which is the imitation failure this record exists to
stop. A name is only allowed where the file it sits in can support it.
