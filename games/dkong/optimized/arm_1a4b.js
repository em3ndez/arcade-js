// SPDX-License-Identifier: GPL-3.0-only
/**
 * arm_1a4b — hand-optimized rewrite of the translated routine at ROM 0x1A4B,
 * proven equal to its oracle by the equivalence harness.
 *
 * It touches exactly one work-RAM address, 0x6291, which has no evidenced name in
 * ram.js yet (FOOTPRINT placeholder SCRATCH_6291), so it stays hex here with a
 * comment; a naming candidate (EDGE_PICKUP_ARMED) is reported to the confirmer.
 * This routine therefore imports nothing from ram.js — its one address is unnamed.
 */

/**
 * arm_1a4b -- ARM the edge-item pickup.  [ROM 0x1A4B-0x1A50; a TAIL target of sub_1a33]
 *
 *   1a4b  3e 01        ld   a,0x01
 *   1a4d  32 91 62     ld   (0x6291),a   ; 0x6291 := 1  (arm the pickup)
 *   1a50  c9           ret
 *
 * WHAT IT DOES. The 3-instruction "arm" half of a two-pass, set-then-consume latch
 * driven by sub_1a33 (the edge item pickup, ROM 0x1A33). sub_1a33 runs each frame
 * from loc_197a's in-game update cascade; it reads the player's X and, when the
 * player is standing on a screen-EDGE column (MARIO_X == 0x4B or 0xB3), tail-jumps
 * here (`jp z,0x1a4b` at ROM 0x1A3B / 0x1A40). This raises flag 0x6291 = 1 and
 * returns. On a LATER frame, when the player is no longer exactly on the edge,
 * sub_1a33 takes its other path (ROM 0x1A43): `ld a,(0x6291) / dec a / jp z,0x1a51`
 * -- it processes the pickup only if the flag is 1, and the pickup handler's first
 * act (ROM 0x1A51 `ld (0x6291),a`, with A==0) DISARMS it. So 0x6291 is an
 * "edge-pickup armed" one-shot: arm_1a4b raises it on the edge-hit frame; sub_1a33
 * consumes and clears it on the following collect frame.
 *
 * INPUTS  : none read. (The edge test that decides whether this routine runs at all
 *           lives in the CALLER, sub_1a33; here the store is unconditional.)
 * OUTPUTS : RAM 0x6291 := 1. Register file on return: A := 1 (OBSERVABLE -- the unit
 *           gate compares the whole register file, so the `ld a,1` is NOT dead and is
 *           kept); B/C/D/E/HL/IX/IY unchanged; F unchanged; SP/PC via the `ret`.
 *
 * FLAGS -- NONE touched. `ld a,n`, `ld (nn),a` and `ret` all leave F untouched, so
 * there is no flag churn to preserve or drop; the exit F equals the entry F for free.
 *
 * CYCLES -- KEPT PER-INSTRUCTION (7 / 13 / 10 t; total 30 t), deliberately NOT
 * collapsed. Two independent reasons, either sufficient:
 *   (1) arm_1a4b is INTERRUPTIBLE -- its only call path is sub_1a33 <- loc_197a's
 *       cascade, which is decisively non-atomic (the vblank NMI lands inside it),
 *       so a collapse could push a coarse block-exit PC on a mistimed NMI.
 *   (2) it is UNREACHABLE by the drivable whole-machine scenarios -- sub_1a33 fires
 *       ~198x over a 2000-frame gameplay run, but the player never lands on an exact
 *       edge column, so arm_1a4b dispatches 0x (measured). A collapse could not be
 *       whole-machine / convergent verified anyway (docs/06: "a collapse it can't
 *       whole-machine verify" is kept per-instruction).
 * So the oracle's charge distribution is preserved verbatim, making the routine
 * byte-and-cycle identical to the oracle on its one path; the 30 t total is pinned
 * explicitly by the crafted-entry cycle test.
 *
 * GATE -- CRAFTED ENTRY (docs/06). No natural or driven dispatch reaches this routine
 * (0 invocations, measured), so it is proven from a captured real entry (snapshotted
 * at loc_0fd7's dispatch, deterministic in attract -- the sub_13ca pattern), cloned,
 * run oracle vs optimized, diffed on RAM + full register file + pc + SP, with the
 * cycle total asserted explicitly. arm_1a4b reads NOTHING, so its transform is
 * entry-independent -- any valid captured entry proves it. FULL-BRANCH coverage is
 * trivial: the routine is straight-line with NO data-dependent branch, so its single
 * path is its only path.
 *
 * The 0x6291 store is WORK RAM (0x6000-0x6BFF), not a 0x7Dxx hardware latch, so it
 * carries no bus cycle and needs no write-trace test.
 */
export function arm_1a4b(m) {
  const { regs, mem } = m;

  // ld a,0x01 -- the "armed" value; A must be 1 on return (register file compared).
  regs.a = 0x01;
  m.step(0x1a4d, 7);

  // ld (0x6291),a -- raise the EDGE-PICKUP ARMED latch. 0x6291 is unnamed in ram.js
  // (proposed name EDGE_PICKUP_ARMED); work RAM, so no hardware bus cycle to pin.
  mem.write8(0x6291, regs.a);
  m.step(0x1a50, 13);

  // ret -- back to sub_1a33's caller. arm_1a4b is a TAIL target (sub_1a33 jp'd here
  // with no extra push), so this ret unwinds straight to loc_197a's cascade slot.
  m.ret(10);
}
