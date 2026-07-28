// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c8f — hand-optimized rewrite of the translated routine at ROM 0x1C8F,
 * proven equal to its oracle by the equivalence harness.
 *
 * It imports the two work-RAM names it read-modify-writes (both confirmed in ram.js):
 * MARIO_MOVE_STEP_TIMER (0x620F) and MARIO_WALK_ANIM (0x6202). The 0x620F read at ROM
 * 0x1C94 carried a stale `// jump phase` comment in the oracle; ram.js is authoritative —
 * 0x620F is the ground walk/climb sub-step timer, "NOT jump phase" (a jump never touches
 * it) — so that reading is dropped here, not propagated.
 */

import { MARIO_MOVE_STEP_TIMER, MARIO_WALK_ANIM } from "./ram.js";

/**
 * loc_1c8f -- MOVE +dir (rightward walk step).  [ROM 0x1C8F-0x1CAA]
 *
 *   1c8f  06 01        ld   b,0x01        ; B = +1 X delta (the rightward step; loc_1cab uses 0xFF)
 *   1c91  3a 0f 62     ld   a,(0x620f)    ; A = MARIO_MOVE_STEP_TIMER
 *   1c94  a7           and  a             ; Z := (timer == 0)
 *   1c95  c2 d2 1c     jp   nz,0x1cd2     ; timer running -> apply the 1px step (loc_1cd2)
 *   1c98  3a 02 62     ld   a,(0x6202)    ; else A = MARIO_WALK_ANIM (current anim index)
 *   1c9b  47           ld   b,a           ; B = anim index -> entry_3009's subject
 *   1c9c  3e 05        ld   a,0x05        ; A = 0x05 right-hand step mode (loc_1cab passes 0x01)
 *   1c9e  cd 09 30     call 0x3009        ; entry_3009 -> A = next walk-anim index
 *   1ca1  32 02 62     ld   (0x6202),a    ; store new MARIO_WALK_ANIM
 *   1ca4  e6 03        and  0x03          ; A = anim & 3
 *   1ca6  f6 80        or   0x80          ; set bit 7 = facing-RIGHT (loc_1cab OMITS this)
 *   1ca8  c3 c2 1c     jp   0x1cc2        ; -> shared move tail loc_1cc2
 *
 * WHAT IT DOES. This is the RIGHTWARD arm of the two mirrored walk-step handlers
 * (loc_1cab is the leftward twin). It is tail-jumped to from loc_1ae6's move arm
 * (input bit 0 set). B is preset to the +1 X delta that the actual-move code (loc_1cd2)
 * will add to MARIO_X. Then it forks on the sub-step timer 0x620F:
 *   - TIMER RUNNING (arm A, 0x620F != 0): a walk step is already in progress this
 *     stride, so jump straight to loc_1cd2, which shifts Mario +1 px in X and decrements
 *     the timer. loc_1c8f itself writes NO memory on this arm.
 *   - TIMER AT 0 (arm B, 0x620F == 0): begin a NEW step. Feed the current walk-anim
 *     index (0x6202) and the step mode 0x05 to entry_3009, which returns the next anim
 *     index; store it back to 0x6202, mask to its low 2 bits, and OR in bit 7 (facing
 *     right) before handing the sprite-code byte to the shared tail loc_1cc2. The `or 0x80`
 *     is the ONLY thing distinguishing this from loc_1cab, and it is exactly the
 *     MARIO_SPRITE_CODE bit-7 "facing right" flag (ram.js).
 * Both exits are TAIL jumps (no push): loc_1cd2 / loc_1cc2 run and their own `ret`
 * returns to loc_1c8f's caller, so both are `return m.call(...)` here. The mid-body
 * `call 0x3009` is a REAL call (pushes its 0x1CA1 return address) and is kept verbatim.
 *
 * INPUTS  : RAM 0x620F (MARIO_MOVE_STEP_TIMER, the fork), 0x6202 (MARIO_WALK_ANIM, arm B).
 *           entry_3009's register contract (A = mode, B = anim). The stack (a caller
 *           return address for the tail callee's `ret`).
 * OUTPUTS : arm A -> B := 0x01 (the X delta loc_1cd2 consumes), A/F from `and a`, then
 *           loc_1cd2's full effect. arm B -> 0x6202 rewritten with entry_3009's result,
 *           A := (result & 3) | 0x80, F from `or 0x80`, B/A/F as entry_3009 left them
 *           pre-mask, then loc_1cc2's full effect. PC/SP via the call + tail call.
 *           loc_1c8f's OWN work-RAM write is 0x6202 on arm B only; NO hardware latch.
 *
 * FLAGS -- both flag-writers are KEPT verbatim; neither is droppable churn:
 *   - `and a` (arm-A branch condition) leaves A = timer and sets Z; it is the last
 *     flag-writer before the arm-A tail (loc_1cd2 is entered with this F), so keeping it
 *     makes the arm-A handoff F bit-identical to the oracle.
 *   - `or 0x80` is the LAST flag-writer on arm B (the intervening entry_3009 result and
 *     `and 0x03` are both overwritten by it), so keeping it verbatim makes the arm-B
 *     handoff F bit-identical for free. The unit gate compares the whole register file
 *     incl. F/F3/F5, so both are load-bearing. There is essentially NO churn to drop
 *     here -- the register ops ARE the logic; the win is names, flat control flow, the
 *     docstring, and the cycle collapse.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block, EXACT per-arm totals (the decompiler-pipeline doc). The
 * mid-body `call 0x3009` is a BOUNDARY: its `push16` (return 0x1CA1) + `m.step(0x3009,17)`
 * (the CALL's own 17 t) + `m.call(0x3009)` stay verbatim and the fold does NOT cross it.
 *   - arm A (timer!=0): ld b(7) + ld a(13) + and a(4) + jp nz taken(10)                 = 34 t, exit 0x1CD2.
 *   - arm B pre-call:   [arm-A block 24] + jp nz not-taken(10) + ld a(13) + ld b,a(4)
 *                       + ld a,0x05(7)                                                    = 58 t, PC 0x1C9E.
 *   - arm B post-call:  ld (0x6202),a(13) + and 0x03(7) + or 0x80(7) + jp 0x1cc2(10)      = 37 t, exit 0x1CC2.
 * arm B's own total is 58 + 17 (call) + 37 = 112 t; each equals the oracle sum exactly.
 * There is NO hardware-latch write anywhere in loc_1c8f (0x6202 is work RAM) and none in
 * entry_3009 (a pure register/flag routine that writes no memory), so no bus-cycle
 * boundary is pinned inside a fold. Preserving each total keeps the frame's cycle budget
 * -- hence the main-loop spin count 0x6019/SPIN_COUNT (the PRNG entropy) -- unchanged.
 *
 * REACHABILITY / ATOMICITY (MEASURED; why the collapse is licensed under the STRICT gate).
 * loc_1c8f is tail-called from loc_1ae6's move arm, inside the per-frame movement cascade
 * under loc_197a (entry_1ac3 -> loc_1ae6 -> loc_1c8f). Probed over 900 attract frames:
 * 209 entries (first ~frame 633), BOTH arms reached naturally -- arm A (timer running) 139x,
 * arm B (new step) 70x. It is ATOMIC: every one of the 209 entries occurs with io.nmiMask
 * CLEARED -- i.e. INSIDE the vblank NMI, whose handler zeroed the mask on entry so it cannot
 * re-enter (209/209 in-NMI, 0 out) -- and the NMI's pushed PC NEVER lands in [0x1C8F,0x1CAB)
 * (0 landings over 894 NMIs). So the loc_197a cascade is ATOMIC here (do not repeat the
 * stale "interruptible" claim): an atomic collapse pushes no mistimed PC and tears no
 * raster, and it passes the BYTE-EXACT whole-machine gate directly -- NOT the convergent
 * gate. See equivalence-1c8f.test.js.
 */
export function loc_1c8f(m) {
  const { regs, mem } = m;

  // BB0: ld b,0x01 ; ld a,(0x620f) ; and a  -> Z reflects the walk sub-step timer.
  regs.b = 0x01; // +1 X delta consumed by loc_1cd2 on arm A
  regs.a = mem.read8(MARIO_MOVE_STEP_TIMER); // 0x620F
  regs.and(regs.a); // A unchanged; Z := (timer == 0)

  if (regs.fNZ) {
    // arm A: a step is already in progress -> apply the 1px move (loc_1cd2).
    m.step(0x1cd2, 34); // 7 + 13 + 4 + jp nz taken(10)
    return m.call(0x1cd2);
  }

  // arm B: timer at 0 -> begin a new walk step.
  regs.a = mem.read8(MARIO_WALK_ANIM); // 0x6202 current anim index
  regs.b = regs.a; // entry_3009's subject
  regs.a = 0x05; // right-hand step mode (loc_1cab passes 0x01)
  m.step(0x1c9e, 58); // BB0(24) + jp nz not-taken(10) + ld a(13) + ld b,a(4) + ld a,0x05(7)

  // call 0x3009 -- BOUNDARY: push 0x1CA1, charge the CALL's 17 t, then run entry_3009.
  m.push16(0x1ca1);
  m.step(0x3009, 17);
  m.call(0x3009); // A := next walk-anim index

  mem.write8(MARIO_WALK_ANIM, regs.a);
  regs.and(0x03); // anim & 3
  regs.or(0x80); // set bit 7 = facing right (loc_1cab omits this)
  m.step(0x1cc2, 37); // ld (0x6202),a(13) + and 0x03(7) + or 0x80(7) + jp 0x1cc2(10)
  return m.call(0x1cc2);
}
