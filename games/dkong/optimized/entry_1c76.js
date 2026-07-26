// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_1c76 — hand-optimized rewrite of the translated routine at ROM 0x1C76,
 * proven equal to its oracle by the equivalence harness (equivalence-1c76.test.js).
 *
 * One routine per file. Its single callee — entry_1da6 (0x1DA6, the sprite-record
 * copy) — is invoked through `m.call`, the routine registry (games/dkong/routines.js),
 * so it resolves to the oracle or to its own optimized rewrite, never a copy here.
 *
 * RAM names come from ram.js and every one is control- or ROM-evidenced for THIS
 * routine: MARIO_Y (0x6205), MARIO_AIR_START_Y (0x620E) and MARIO_FATAL_FALL (0x6220)
 * are each cited against entry_1c76 in ram.js (the fall-height test at ROM 0x1C7F, and
 * the fatal-flag store at 0x1C87). The sound latch 0x6084 is SND_TRIGGER (0x6080) + 4,
 * inside the confirmed 8-byte per-bit trigger span 0x6080-0x6087; storing 3 there is the
 * documented 3-frame assert. It is WORK RAM (sub_00e0 drains it to the real hardware
 * latch 0x7D00-0x7D07 each NMI) — NOT itself a hardware latch, so the collapse may fold
 * across it.
 */

import { MARIO_Y, MARIO_AIR_START_Y, MARIO_FATAL_FALL, SND_TRIGGER } from "./ram.js";

/**
 * entry_1c76 -- LANDED-CHECK: decide whether the fall just completed is fatal, then
 * hand off to the sprite-record copy.  [ROM 0x1C76-0x1C8E, tail-jumping to 0x1DA6]
 *
 *   1c76  3a 05 62     ld   a,(0x6205)   ; A = MARIO_Y (current, larger = lower)
 *   1c79  21 0e 62     ld   hl,0x620e    ; HL = &MARIO_AIR_START_Y (Y at take-off)
 *   1c7c  d6 0f        sub  0x0f         ; A = MARIO_Y - 0x0F  (15px grace)
 *   1c7e  be           cp   (hl)         ; C := ((MARIO_Y-0x0F) < MARIO_AIR_START_Y)
 *   1c7f  da a6 1d     jp   c,0x1da6     ; carry -> short fall, NOT fatal: tail-jump 0x1DA6
 *   1c82  3e 01        ld   a,0x01       ; else fall reaches/passes take-off Y ->
 *   1c84  32 20 62     ld   (0x6220),a   ;   MARIO_FATAL_FALL = 1
 *   1c87  21 84 60     ld   hl,0x6084    ; HL = &SND_TRIGGER[4]
 *   1c8a  36 03        ld   (hl),0x03    ;   fire the landing/thud sound (3-frame assert)
 *   1c8c  c3 a6 1d     jp   0x1da6       ; tail-jump 0x1DA6
 *
 * WHAT IT DOES. This is the fall-height verdict of the airborne handler. It is reached
 * from entry_1c05 (ROM 0x1C10 `jp z,0x1c76`) exactly when MARIO_AIR_LANDCHECK (0x621F)
 * has counted down to 1 -- i.e. the frame the landing/fall check is armed. It compares
 * how far Mario has descended against where he took off:
 *   - ARM C (carry set, NOT fatal): (MARIO_Y - 0x0F) is still ABOVE the take-off Y
 *     (unsigned less-than), so the drop is within the 15px grace -- a normal hop/step-down.
 *     entry_1c76 writes NO memory; it just tail-jumps to entry_1da6 (the per-frame sprite
 *     copy). This is the ONLY arm attract reaches (Mario never dies of a fall in the demo).
 *   - ARM NC (no carry, FATAL): the drop reached or passed the take-off height, so the fall
 *     is deadly. Set MARIO_FATAL_FALL = 1 (consumed on landing by entry_1c4f, ROM 0x1C55,
 *     as MARIO_ACTIVE := this XOR 1 -> 0 = dead) and fire the landing sound
 *     (SND_TRIGGER[4] := 3), then tail-jump to entry_1da6.
 * Both exits are TAIL jumps (`jp`, no push), so entry_1da6 runs and its own `ret` returns
 * to entry_1c76's caller -- modelled `return m.call(0x1da6)` on both arms (no push16).
 *
 * INPUTS  : RAM MARIO_Y (0x6205) and MARIO_AIR_START_Y (0x620E) -- the fall-height
 *           comparison. The stack (a caller return address the tail callee's chain returns
 *           to).
 * OUTPUTS : ARM C -> NO work-RAM write; A = (MARIO_Y-0x0F)&0xFF, HL = 0x620E, F = the
 *           `cp` flags at the 0x1DA6 handoff. ARM NC -> MARIO_FATAL_FALL (0x6220) := 1 and
 *           SND_TRIGGER[4] (0x6084) := 3 (both persistent work RAM); A = 0x01, HL = 0x6084,
 *           F = the same `cp` flags (ld/store don't touch F). Then, on BOTH arms, whatever
 *           entry_1da6 leaves (it runs LIVE via m.call, so the exit register file + its
 *           sprite writes are the oracle's). No boolean returned; the caller ignores it.
 *           NO hardware-latch write anywhere here (0x6220 and 0x6084 are work RAM).
 *
 * FLAGS -- both flag-writers are KEPT VERBATIM; there is essentially no droppable churn:
 *   - `sub 0x0f` computes A = MARIO_Y-0x0F and its flags; the flags are immediately
 *     overwritten by `cp (hl)`, but the helper produces A and F together and there is no
 *     cheaper idiomatic form that yields the wrapped A without the same flag work, so it is
 *     left as `regs.sub`.
 *   - `cp (hl)` is BOTH the branch condition (`jp c`) AND the last flag-writer before either
 *     exit (every following op is a flag-neutral ld/store/jp), so the F it leaves is the F
 *     handed to entry_1da6 on both arms. It is kept as `regs.cp` -- NOT simplified to a
 *     boolean -- so the exit F (including the undocumented F3/F5, which `cp` takes from the
 *     OPERAND MARIO_AIR_START_Y) is bit-identical. The unit gate compares the whole register
 *     file incl. F, so both are load-bearing; the win here is names, flat control flow, the
 *     docstring, and the cycle collapse.
 *
 * CYCLES -- COLLAPSED per doc 06: each executed path's straight-line T-states are folded
 * into ONE m.step placed immediately before its control transfer, preserving the oracle's
 * per-arm TOTAL exactly. There is NO mid-body call (the only callee is the tail 0x1DA6) and
 * NO hardware-latch write, so there is no boundary to keep verbatim inside the body -- each
 * arm is a single fold ending in the tail `m.call(0x1da6)` (no push16).
 *   - Prologue (shared) [0x1c76-0x1c7f]: ld a 13 + ld hl 10 + sub 7 + cp 7        = 37 t
 *   - ARM C  (carry):    prologue 37 + jp c TAKEN 10                              = 47 t -> 0x1DA6
 *   - ARM NC (no carry): prologue 37 + jp c NOT-taken 10 + ld a 7 + ld (0x6220) 13
 *                        + ld hl 10 + ld (hl),0x03 10 + jp 10                     = 97 t -> 0x1DA6
 * (Z80 JP cc = 10 t taken AND 10 t not-taken -- verified directly from the oracle's
 * `m.step(0x1c82,10)` on the not-taken arm; unlike JR/CALL/RET, JP does not split.)
 * Preserving each arm's total keeps the frame's cycle budget -- hence the main-loop spin
 * count 0x6019/SPIN_COUNT (the PRNG entropy) and any later NMI's pushed PC -- unchanged.
 *
 * GATE / REACHABILITY / ATOMICITY (MEASURED; why the STRICT byte-exact gate is licensed).
 * entry_1c76 runs inside the loc_197a / entry_1ac3 airborne-movement cascade (loc_197a ->
 * entry_1ac3 -> ... -> entry_1c05 -> entry_1c76). Probed over 1600 attract frames: 83
 * dispatches (first ~frame 607), ALL on ARM C (short fall) -- the demo never fatally falls.
 * It is ATOMIC: every one of the 83 dispatches runs with io.nmiMask == 0 (mask-cleared
 * inside the vblank NMI, so the NMI cannot re-enter) and no NMI pushed-PC ever lands in
 * [0x1C76,0x1C8F) (0 landings over ~1994 accepted NMIs). Its collapse preserves each arm's
 * TOTAL exactly, so it pushes no mistimed PC; ARM C writes no memory and ARM NC only work
 * RAM (no raster tear). It therefore passes the STRICT byte-exact whole-machine gate
 * directly (no convergent gate needed). That gate is timing-sensitive -- a wrong total forks
 * the spin-count PRNG (0x6019) / a later NMI's pushed PC -- so it pins ARM C's total for
 * free. ARM NC (the FATAL fall) is NOT reached in attract (0/83), so it is proven by a
 * crafted identical-both-sides poke of MARIO_AIR_START_Y (forcing no-carry) with explicit
 * per-arm cycle-total teeth. See equivalence-1c76.test.js.
 */
export function entry_1c76(m) {
  const { regs, mem } = m;

  // Block prologue [0x1c76-0x1c7f]: A := MARIO_Y - 0x0F, compared against take-off Y.
  regs.a = mem.read8(MARIO_Y); // ld a,(0x6205)
  regs.hl = MARIO_AIR_START_Y; // ld hl,0x620e
  regs.sub(0x0f); // sub 0x0f  -- 15px grace; flags dead (cp overwrites them)
  regs.cp(mem.read8(regs.hl)); // cp (hl)  -- C := ((MARIO_Y-0x0F) < MARIO_AIR_START_Y)

  if (regs.fC) {
    // ARM C -- short fall (within grace): NOT fatal. Write nothing; tail-jump 0x1DA6.
    // Fold: prologue 37 + jp c taken 10 = 47 t, PC -> 0x1da6. No push16 (tail jump).
    m.step(0x1da6, 47);
    return m.call(0x1da6);
  }

  // ARM NC -- the fall reached/passed take-off height: FATAL. Mark it + fire the sound.
  regs.a = 0x01; // ld a,0x01
  mem.write8(MARIO_FATAL_FALL, regs.a); // ld (0x6220),a  -- consumed on landing (dead)
  regs.hl = SND_TRIGGER + 4; // ld hl,0x6084  -- SND_TRIGGER[4], work RAM (not a latch)
  mem.write8(regs.hl, 0x03); // ld (hl),0x03  -- 3-frame landing/thud assert
  // Fold: prologue 37 + jp c not-taken 10 + ld a 7 + ld(0x6220) 13 + ld hl 10
  //       + ld(hl),0x03 10 + jp 10 = 97 t, PC -> 0x1da6. Tail jump (no push16).
  m.step(0x1da6, 97);
  return m.call(0x1da6);
}
