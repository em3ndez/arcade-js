// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_057c — hand-optimized rewrite of the translated routine at ROM 0x057C,
 * proven equal to its oracle (../translated/state0.js) by the equivalence harness.
 *
 * One routine per file. Its one callee (0x0593) is reached through `m.call`, the
 * routine registry (games/dkong/routines.js), so it resolves to the oracle
 * (mainloop.js `sub_0593`) or to a future optimized rewrite — never a copy. No
 * RAM names are imported: sub_057c touches no fixed work-RAM address of its own
 * (it reads the caller's source through HL and writes through the caller's IX),
 * so its only literal is the tilemap row step, a ROM constant defined below.
 */

// -- sub_057c constants (ROM literals; NOT work-RAM, so none belong in ram.js) --
const VRAM_ROW_STEP = 0xffe0; // -0x20: back one tilemap row per digit (vertical draw)
const BYTE_COUNT = 0x0304; //    ld bc,0x0304 -> B=3 source bytes, C=4 (a dead marker,
//                               kept so the register file matches: C is never read)

/**
 * sub_057c -- unpack 3 source bytes into 6 nibbles up a video column (a BCD
 * digit renderer).  [ROM 0x057C-0x0592]
 *
 *   057d  eb           ex   de,hl              ; HL := source ptr (was DE, live-in)
 *   0580  11 e0 ff     ld   de,0xffe0          ; DE := row step (-0x20, up one row)
 *   0583  01 04 03     ld   bc,0x0304          ; B := 3 bytes, C := 4 (unused)
 *   0583  7e           ld   a,(hl)     ; loop  ; source byte
 *   0584  0f..0f       rrca x4                 ; A := high nibble (rotated low)
 *   0588  cd 93 05     call 0x0593             ; write HIGH nibble, IX -= 0x20
 *   058b  7e           ld   a,(hl)             ; same byte again
 *   058c  cd 93 05     call 0x0593             ; write LOW  nibble, IX -= 0x20
 *   058f  2b           dec  hl                 ; next source byte (DESCENDING)
 *   0590  10 f1        djnz 0x0583
 *   0592  c9           ret
 *
 * WHAT IT DOES. Called by sub_1486 (the on-board bonus-item display, phase 21) to
 * paint the 6-digit item value. DE (source pointer, e.g. ROM 0x01BF) and IX
 * (destination VRAM cell) are LIVE-IN. `ex de,hl` moves the source into HL and
 * parks the old HL in DE, which the very next `ld de,0xffe0` overwrites — so the
 * source survives only in HL and old-HL is discarded (irrelevant to the result).
 * For each of B=3 bytes: emit the HIGH nibble, then the LOW nibble, then step the
 * source DOWN (`dec hl`). The helper at 0x0593 masks A to a nibble, stores it at
 * (ix+0), and adds DE to IX (up one tilemap row). Six writes → six cells climbing
 * the column from IX. (Reachable only through sub_1486 — a transitive path the
 * reachcrawler originally missed.)
 *
 * INPUTS  : DE = source pointer, IX = destination VRAM cell (both live-in).
 * OUTPUTS : six nibble writes to VRAM via 0x0593; HL := source-3, DE := 0xFFE0,
 *           B := 0, C := 4, IX := IX-0xC0, A/F from the last 0x0593.
 * IDIOM   : the four `rrca`s are a nibble SWAP, not a shift — rotating A right
 *           four times puts the high nibble low, and 0x0593's `and 0x0f` keeps it.
 *           HL walks BACKWARDS while IX walks by DE, reversing source-byte order
 *           into display order.
 *
 * DEAD-CODE DROPPED. The oracle carries a NESTED `function sub_0593` copy, but
 * both call sites go through `m.call(0x0593)`, which resolves via the registry to
 * mainloop.js's exported `sub_0593` — the nested copy is never invoked. It is a
 * translator artifact and is simply omitted here; behaviour is unchanged because
 * both the oracle and this rewrite reach the SAME registry 0x0593.
 *
 * FLAGS. Kept verbatim (the unit gate compares F). Final F is whatever the last
 * `add ix,de` inside 0x0593 leaves (`dec hl` on a 16-bit reg and `djnz` set no
 * flags), and A is the last low nibble masked by 0x0593 — both match the oracle
 * by reproducing its exact operations.
 *
 * LADDER STATUS -- rung 5 (idiomatic), cycles COLLAPSED to one m.step per basic
 * block (the per-instruction charges of each straight-line run folded into a single
 * charge at the block's exit PC), mirroring loop_0583 -- the SAME inlined loop
 * factored out and already collapsed. sub_057c's inline copy folds identically:
 *   - PROLOGUE  ex de,hl(4) + ld de,-0x20(10) + ld bc,0x0304(10) = 24 t, exit 0x0583.
 *   - BLOCK A   ld a,(hl)(7) + rrca x4(16) = 23 t, exit 0x0588 (the HIGH-digit call).
 *   - the two `m.call(0x0593)` sites keep their own push16 / step(17) / m.call
 *     scaffolding UNTOUCHED -- a call is a block boundary.
 *   - LOW digit ld a,(hl)(7) is a single instruction sandwiched between the two
 *     calls, so nothing folds there (7 t, exit 0x058c).
 *   - BLOCK B   dec hl(6) + djnz(13 taken / 8 not) = 19 t (loop continues, exit
 *     0x0583) or 14 t (loop exits, exit 0x0592).
 * Every fold's TOTAL is the oracle's, EXACTLY. sub_057c has a SINGLE data path
 * (B=3 always): each `m.call(0x0593)` charges 17 t (the call) + 51 t inside the
 * digit renderer = 68 t; a taken loop iteration is 23+68+7+68+19 = 185 t and the
 * final (djnz-not-taken) iteration is 180 t, so the whole-routine total is
 * 24 + 185 + 185 + 180 + 10(ret) = 584 t -- exactly the per-instruction oracle's.
 * Total-preservation keeps the NMI's cycle contribution -- and thus the main loop's
 * spin count / PRNG entropy (README §2) -- deterministic.
 *
 * ATOMICITY & GATE. sub_057c's ONLY caller is sub_1486, dispatched from INSIDE the
 * vblank NMI (entry_0066 -> the 0x00CA game-state table -> loc_06fe -> the 0x0702
 * sub-state table). The NMI clears its own mask on entry (0x7D84), so no second NMI
 * can land inside sub_1486 or its callees -- sub_057c is ATOMIC on its one call
 * path, so this collapse is byte-safe (no in-flight NMI ever pushes the coarsened
 * block-exit PC into diffed stack RAM). The fleet gates ALL collapsed routines with
 * the CONVERGENT gate uniformly (docs/decompiler-pipeline; equivalence-057c.test.js uses
 * convergentGate on a phase-21 scenario, not the strict whole-machine comparator);
 * for an atomic routine like this one it passes with ZERO raster tear, but the
 * per-branch cycle TOTAL -- where the collapse's correctness lives -- is pinned by
 * the unit BRANCH-COVERAGE assertion below.
 */
export function sub_057c(m) {
  const { regs, mem } = m;

  // Prologue: ex de,hl(4) + ld de,-0x20(10) + ld bc,0x0304(10) = 24 t, exit 0x0583.
  regs.exDeHl(); // HL := source (was DE, live-in); old HL parked in DE...
  regs.de = VRAM_ROW_STEP; // ...and immediately overwritten with the -0x20 step.
  regs.bc = BYTE_COUNT; // B = 3 source bytes, C = 4 (dead).
  m.step(0x0583, 24);

  do {
    // Block A: read the source byte and rotate its high nibble down (nibble swap
    // -- the high nibble ends up low). 7 + 4*4 = 23 t, exit 0x0588.
    regs.a = mem.read8(regs.hl); // source byte
    for (let i = 0; i < 4; i++) regs.rrca(); // x4 -> A's high nibble rotated into the low four bits
    m.step(0x0588, 23);
    m.push16(0x058b);
    m.step(0x0593, 17); // call 0x0593 -- write HIGH nibble, IX -= 0x20 (scaffolding untouched)
    m.call(0x0593);

    // Low digit: re-read the same byte, unrotated. Single instruction sandwiched
    // between the two calls -- nothing to fold (7 t, exit 0x058c).
    regs.a = mem.read8(regs.hl); // same byte again
    m.step(0x058c, 7);
    m.push16(0x058f);
    m.step(0x0593, 17); // call 0x0593 -- write LOW nibble, IX -= 0x20 (scaffolding untouched)
    m.call(0x0593);

    // Block B: advance to the next source byte (descending) and test djnz.
    //   dec hl(6) + djnz(13 taken / 8 not) = 19 / 14 t.
    regs.hl = (regs.hl - 1) & 0xffff; // next source byte (descending)
    regs.djnz(); // B-- (sets no flags)
    m.step(regs.b ? 0x0583 : 0x0592, regs.b ? 19 : 14);
  } while (regs.b);

  m.ret(10); // ret @0x0592
}
