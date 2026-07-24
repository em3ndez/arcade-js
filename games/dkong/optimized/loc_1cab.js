// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1cab — hand-optimized rewrite of the translated routine at ROM 0x1CAB,
 * proven equal to its oracle by the equivalence harness.
 *
 * It imports the two work-RAM names it read-modify-writes (both confirmed in ram.js):
 * MARIO_MOVE_STEP_TIMER (0x620F) and MARIO_WALK_ANIM (0x6202). The 0x620F read at ROM
 * 0x1CB0 carried a stale `// jump phase`-style reading in the twin oracle; ram.js is
 * authoritative — 0x620F is the ground walk/climb sub-step timer, "NOT jump phase" (a jump
 * never touches it) — so that reading is dropped here, not propagated.
 */

import { MARIO_MOVE_STEP_TIMER, MARIO_WALK_ANIM } from "./ram.js";

/**
 * loc_1cab -- MOVE -dir (leftward walk step).  [ROM 0x1CAB-0x1CC1]
 *
 *   1cab  06 ff        ld   b,0xff        ; B = -1 X delta (the leftward step; loc_1c8f uses 0x01)
 *   1cad  3a 0f 62     ld   a,(0x620f)    ; A = MARIO_MOVE_STEP_TIMER
 *   1cb0  a7           and  a             ; Z := (timer == 0)
 *   1cb1  c2 d2 1c     jp   nz,0x1cd2     ; timer running -> apply the 1px step (loc_1cd2)
 *   1cb4  3a 02 62     ld   a,(0x6202)    ; else A = MARIO_WALK_ANIM (current anim index)
 *   1cb7  47           ld   b,a           ; B = anim index -> entry_3009's subject
 *   1cb8  3e 01        ld   a,0x01        ; A = 0x01 left-hand step mode (loc_1c8f passes 0x05)
 *   1cba  cd 09 30     call 0x3009        ; entry_3009 -> A = next walk-anim index
 *   1cbd  32 02 62     ld   (0x6202),a    ; store new MARIO_WALK_ANIM
 *   1cc0  e6 03        and  0x03          ; A = anim & 3  -- then FALLS THROUGH into loc_1cc2 (no jp)
 *
 * WHAT IT DOES. This is the LEFTWARD arm of the two mirrored walk-step handlers
 * (loc_1c8f is the rightward twin). It is tail-jumped to from loc_1ae6's move arm
 * (input Left). B is preset to the -1 X delta that the actual-move code (loc_1cd2)
 * will add to MARIO_X. Then it forks on the sub-step timer 0x620F:
 *   - TIMER RUNNING (arm A, 0x620F != 0): a walk step is already in progress this
 *     stride, so jump straight to loc_1cd2, which shifts Mario -1 px in X and decrements
 *     the timer. loc_1cab itself writes NO memory on this arm.
 *   - TIMER AT 0 (arm B, 0x620F == 0): begin a NEW step. Feed the current walk-anim
 *     index (0x6202) and the step mode 0x01 to entry_3009, which returns the next anim
 *     index; store it back to 0x6202, mask to its low 2 bits, and FALL THROUGH into the
 *     shared tail loc_1cc2 with the sprite-code byte in A.
 *
 * THE TWO DIFFERENCES FROM loc_1c8f, both structural and both preserved here:
 *   (1) It does NOT `or 0x80` — bit 7 of MARIO_SPRITE_CODE is "facing right" (ram.js), so
 *       omitting it leaves the LEFT-facing code (bit 7 clear). This is the whole point of
 *       the leftward twin: same anim math, opposite facing.
 *   (2) It has NO `jp 0x1cc2` — loc_1cc2 sits immediately after `and 0x03`, so arm B FALLS
 *       THROUGH rather than jumping. That is one fewer control transfer, so arm B's post-call
 *       block is 20 t here versus loc_1c8f's 37 t (it drops the 7 t `or 0x80` AND the 10 t jp).
 * (Also B = 0xFF not 0x01, and entry_3009's mode arg is 0x01 not 0x05.)
 *
 * Both exits reach downstream routines that `ret` to loc_1cab's caller, so both are
 * `return m.call(...)` here: arm A tail-jumps to loc_1cd2; arm B falls into loc_1cc2. The
 * mid-body `call 0x3009` is a REAL call (pushes its 0x1CBD return address) and is kept verbatim.
 *
 * INPUTS  : RAM 0x620F (MARIO_MOVE_STEP_TIMER, the fork), 0x6202 (MARIO_WALK_ANIM, arm B).
 *           entry_3009's register contract (A = mode, B = anim). The stack (a caller
 *           return address for the downstream `ret`).
 * OUTPUTS : arm A -> B := 0xFF (the X delta loc_1cd2 consumes), A/F from `and a`, then
 *           loc_1cd2's full effect. arm B -> 0x6202 rewritten with entry_3009's result,
 *           A := (result & 3), F from `and 0x03`, B/A/F as entry_3009 left them pre-mask,
 *           then loc_1cc2's full effect. PC/SP via the call + tail transfer. loc_1cab's OWN
 *           work-RAM write is 0x6202 on arm B only; NO hardware latch.
 *
 * FLAGS -- both flag-writers are KEPT verbatim; neither is droppable churn:
 *   - `and a` (arm-A branch condition) leaves A = timer and sets Z; it is the last
 *     flag-writer before the arm-A tail (loc_1cd2 is entered with this F), so keeping it
 *     makes the arm-A handoff F bit-identical to the oracle.
 *   - `and 0x03` is the LAST flag-writer on arm B (there is no `or 0x80` after it, and the
 *     entry_3009 result it masks is overwritten by it), so keeping it verbatim makes the
 *     arm-B handoff F bit-identical -- and it also CLEARS carry, which loc_1cc2's first `rra`
 *     rotates into bit 7 of A, so the flag is load-bearing across the fall-through. The unit
 *     gate compares the whole register file incl. F/F3/F5, so both are load-bearing. As with
 *     the twin, there is essentially NO churn to drop -- the register ops ARE the logic; the
 *     win is names, flat control flow, the docstring, and the cycle collapse.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block, EXACT per-arm totals (doc 06). The
 * mid-body `call 0x3009` is a BOUNDARY: its `push16` (return 0x1CBD) + `m.step(0x3009,17)`
 * (the CALL's own 17 t) + `m.call(0x3009)` stay verbatim and the fold does NOT cross it.
 *   - arm A (timer!=0): ld b(7) + ld a(13) + and a(4) + jp nz taken(10)                 = 34 t, exit 0x1CD2.
 *   - arm B pre-call:   [arm-A block 24] + jp nz not-taken(10) + ld a(13) + ld b,a(4)
 *                       + ld a,0x01(7)                                                    = 58 t, PC 0x1CBA (the call).
 *   - arm B post-call:  ld (0x6202),a(13) + and 0x03(7)   -- NO or 0x80, NO jp (fall-through) = 20 t, into 0x1CC2.
 * arm B's own total is 58 + 17 (call) + 20 = 95 t; each equals the oracle sum exactly (the
 * twin's arm B is 112 t -- the 17 t difference is exactly the dropped `or 0x80` + `jp`).
 * There is NO hardware-latch write anywhere in loc_1cab (0x6202 is work RAM) and none in
 * entry_3009 (a pure register/flag routine that writes no memory), so no bus-cycle boundary
 * is pinned inside a fold. Preserving each total keeps the frame's cycle budget -- hence the
 * main-loop spin count 0x6019/SPIN_COUNT (the PRNG entropy) -- unchanged.
 *
 * REACHABILITY / ATOMICITY (MEASURED; why the collapse is licensed under the STRICT gate).
 * loc_1cab is tail-called from loc_1ae6's move arm (input Left), inside the per-frame
 * movement cascade under loc_197a (entry_1ac3 -> loc_1ae6 -> loc_1cab). The leftward walk
 * enters the demo later than the rightward twin (first dispatch ~f900-1500); probed over 1600
 * attract frames it is reached ~153x (arm A ~103, arm B ~50) with BOTH arms exercised. It is ATOMIC: every dispatch
 * occurs with io.nmiMask CLEARED -- i.e. INSIDE the vblank NMI, whose handler zeroed the mask
 * on entry so it cannot re-enter -- and the NMI's pushed PC NEVER lands in [0x1CAB,0x1CC2)
 * (0 landings). So the loc_197a cascade is ATOMIC here: an atomic collapse pushes no mistimed
 * PC and tears no raster, and it passes the BYTE-EXACT whole-machine gate directly -- NOT the
 * convergent gate. See equivalence-1cab.test.js.
 */
export function loc_1cab(m) {
  const { regs, mem } = m;

  // BB0: ld b,0xff ; ld a,(0x620f) ; and a  -> Z reflects the walk sub-step timer.
  regs.b = 0xff; // -1 X delta consumed by loc_1cd2 on arm A
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
  regs.a = 0x01; // left-hand step mode (loc_1c8f passes 0x05)
  m.step(0x1cba, 58); // BB0(24) + jp nz not-taken(10) + ld a(13) + ld b,a(4) + ld a,0x01(7)

  // call 0x3009 -- BOUNDARY: push 0x1CBD, charge the CALL's 17 t, then run entry_3009.
  m.push16(0x1cbd);
  m.step(0x3009, 17);
  m.call(0x3009); // A := next walk-anim index

  mem.write8(MARIO_WALK_ANIM, regs.a);
  regs.and(0x03); // anim & 3 -- NO `or 0x80` (leftward twin leaves bit 7 clear = facing left)
  m.step(0x1cc2, 20); // ld (0x6202),a(13) + and 0x03(7) -- fall through into loc_1cc2 (no jp)
  return m.call(0x1cc2);
}
