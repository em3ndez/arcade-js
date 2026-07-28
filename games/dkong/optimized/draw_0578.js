// SPDX-License-Identifier: GPL-3.0-only
/**
 * draw_0578 — hand-optimized rewrite of the translated routine at ROM 0x0578,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its callee (0x0583, loop_0583) is reached through
 * `m.call`, the routine registry (games/dkong/routines.js), so it resolves to the
 * oracle — or to a future optimized rewrite — never a copy. No RAM names are
 * imported: this routine touches only CPU registers and a VRAM destination
 * pointer (0x7641), which lies OUTSIDE the 0x6000-0x6BFF work-RAM span ram.js
 * covers, so that constant stays hex.
 */

/**
 * draw_0578 -- set up and render a 3-byte BCD counter up a VRAM column.
 * [ROM 0x0578-0x0583, then falls through into loop_0583 @ 0x0583]
 *
 *   0578  dd 21 41 76  ld   ix,0x7641   ; default destination column (skipped @057C)
 *   057c  eb           ex   de,hl       ; HL := source ptr (was DE, live-in)
 *   057d  11 e0 ff     ld   de,0xffe0   ; step = -0x20 (one tilemap row up) per digit
 *   0580  01 04 03     ld   bc,0x0304   ; B = 3 source bytes, C = 4 (marker, unused here)
 *   0583  ...          -> falls into loop_0583 (the BCD expansion loop)
 *
 * WHAT IT DOES: establishes the registers loop_0583 consumes to draw six BCD
 * digits (three source bytes x two nibbles, HIGH nibble first) from HL walking
 * DOWNWARD, into the VRAM cells at IX stepping UP one tilemap row per digit
 * (DE = 0xFFE0 = -0x20). It then FALLS THROUGH into loop_0583 at 0x0583 -- there
 * is no `call`/`push16` here, so loop_0583's own `ret` returns to draw_0578's
 * OWN caller. That tail-into-loop is why this function ends on `m.call(0x0583)`
 * with no trailing `m.ret()`.
 *
 * INPUTS:  DE = source BCD pointer, live-in from the caller (tail_05da sets 0x60BA
 *          for HIGH_SCORE; draw_056b sets a P1/P2 score MSB, 0x60B4/0x60B7). On the
 *          0x057C entry IX is ALREADY the caller's chosen cell (draw_056b: 0x7781
 *          P1 / 0x7521 P2).
 * OUTPUTS: IX = 0x7641 on the natural 0x0578 entry, else the caller's IX untouched;
 *          HL = former DE; DE = 0xFFE0; BC = 0x0304. THIS routine writes NO memory --
 *          every store is done downstream in loop_0583 / sub_0593.
 *
 * PARAMETER `enteredAt057C` -- draw_0578 has TWO ROM entry points and the
 * translation models the second as this flag (machine.js `m.call` forwards it):
 *   - 0x0578 (enteredAt057C=false, the default): does `ld ix,0x7641` first, then
 *     the body. Reached from tail_05da via `m.call(0x0578)` (HIGH_SCORE render).
 *   - 0x057C (enteredAt057C=true): SKIPS the `ld ix`, because draw_056b jumped in
 *     past it after choosing its own IX. Reached via `m.call(0x0578, true)`.
 * The rewrite keeps the EXACT oracle signature `(m, enteredAt057C = false)` and
 * uses the flag identically -- it selects ONLY whether the `ld ix,0x7641` runs.
 * (A distinct routine, sub_057c at ROM 0x057C, is a SEPARATE registry entry that
 * duplicates the body for its own caller sub_1486; it is not reached through
 * 0x0578 and this override does not touch it.)
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. Before it falls into
 * loop_0583, draw_0578 has two basic blocks:
 *   - Block A = `ld ix,0x7641` (0x0578, FALSE path only). 0x057C is an ALTERNATE
 *     ROM entry -- draw_056b jumps in there via `m.call(0x0578, true)` -- so 0x057C
 *     is a basic-block LEADER and `ld ix` stands alone. A single instruction, so
 *     there is nothing to fold: its charge stays m.step(0x057c, 14).
 *   - Block B = `ex de,hl / ld de,0xffe0 / ld bc,0x0304` (0x057c-0x0582), the
 *     straight-line prologue common to BOTH entries. Its three per-instruction
 *     charges (4 + 10 + 10) fold into ONE m.step(0x0583, 24) at the block-exit PC.
 * Each entry PATH's TOTAL is the oracle's, EXACTLY: FALSE (0x0578) = 14 + 24 = 38 t;
 * TRUE (0x057C) = 24 t -- total-preservation keeps the main loop's spin count
 * (0x6019, the PRNG entropy) deterministic.
 *
 * draw_0578 is NOT atomic. It is a LEAF reached only from the MAIN LOOP
 * (dispatchTask -> handler_05c6 -> {draw_056b | tail_05da} -> here; tail_05da is
 * also reached from entry_051c), where the vblank-NMI mask is ENABLED, so the NMI
 * CAN land inside this prologue or inside its interruptible callee loop_0583 (which
 * itself `m.call`s sub_0593 twice per digit pair). The collapse coarsens WHERE an
 * in-flight NMI's pushed PC lands -- the block-exit PC, not the exact instruction --
 * which is exactly what the CONVERGENT gate LICENSES (docs/decompiler-pipeline;
 * equivalence-0578.test.js gates the whole-machine job with convergentGate, not the
 * strict byte-exact comparison). Its only observable effect is what a strict gate
 * false-fails on: a mistimed NMI pushes the coarse block-exit PC into the DEAD stack
 * (excluded) and can leave a single-frame <=6px raster tear that heals next frame;
 * non-stack RAM stays byte-identical. No hardware 0x7Dxx latch is written here (the
 * only stores are the VRAM digit writes inside sub_0593, a callee reached by m.call
 * and not rewritten), so there is no write-trace hazard to guard here.
 *
 * FLAGS: draw_0578's own instructions (ld / ex de,hl) leave F untouched, and
 * loop_0583 -- reached via m.call -- overwrites F before any caller reads it. F is
 * therefore carried through unchanged, matching the oracle; the unit gate (which
 * diffs the whole register file, F included) confirms nothing observes a flag set
 * here.
 */
export function draw_0578(m, enteredAt057C = false) {
  const { regs } = m;

  // Block A: ld ix,0x7641 -- default destination column. 0x057C is an ALTERNATE ROM
  // entry (draw_056b jumps in via m.call(0x0578, true)), so it is a basic-block
  // leader and this instruction stands alone -- a single instruction, nothing to
  // fold. 14 t, exit 0x057c. (draw_056b's 0x057C entry skips it.)
  if (!enteredAt057C) {
    regs.ix = 0x7641;
    m.step(0x057c, 14);
  }

  // Block B: ex de,hl / ld de,0xffe0 / ld bc,0x0304 -- the straight-line prologue
  // common to both entries; its three per-instruction charges (4 + 10 + 10) fold to
  // ONE m.step at the block-exit PC 0x0583. 24 t.
  regs.exDeHl();    // source pointer into HL (its live-in survives only here)
  regs.de = 0xffe0; // per-digit destination step = -0x20 (one tilemap row up)
  regs.bc = 0x0304; // B = 3 source bytes to expand; C = 4 (a marker, unread here)
  m.step(0x0583, 24);

  // Fall THROUGH into loop_0583 (no push16): its `ret` returns to OUR caller.
  m.call(0x0583);
}
