// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_1e57 — hand-optimized rewrite of the translated routine at ROM 0x1e57,
 * proven equal to its oracle by the equivalence harness.
 *
 * WHAT IT DOES. sub_1e57 is the BOARD-COMPLETION / goal-reached gate at the head of
 * the 0x1E57 family. It dispatches on the BOARD-type byte (0x6227) and Mario's
 * position, and on the "goal reached" verdict latches board-complete (a callee sets
 * GAME_SUBSTATE 0x600A := 0x16) and UNWINDS past its caller; otherwise it returns
 * normally so the per-frame update cascade (loc_197a) continues. It reads three RAM
 * cells and writes none of its own — every write happens in the interior labels it
 * tail-jumps to (0x694D sprite-mirror flag, 0x600A board-complete), reached here
 * through `m.call` so they resolve to the oracle or their own optimized rewrites.
 *
 *   1e57  3a 27 62     ld   a,(BOARD)     ; A = board-type byte (0x6227)
 *   1e5a  cb 57        bit  2,a           ; test board-type bit 2
 *   1e5c  c2 80 1e     jp   nz,0x1e80     ; bit2 set  -> loc_1e80 (RIVETS_LEFT test)
 *   1e5f  1f           rra                ; else: board bit 0 -> carry
 *   1e60  3a 05 62     ld   a,(MARIO_Y)   ; A = Mario Y (0x6205)
 *   1e63  da 7a 1e     jp   c,0x1e7a      ; board bit0 set -> loc_1e7a (Mario-Y guard)
 *   1e66  fe 51        cp   0x51          ; else compare Mario Y with 0x51
 *   1e68  d0           ret  nc            ; Y >= 0x51 -> NORMAL return (goal not reached)
 *   1e69  3a 03 62     ld   a,(MARIO_X)   ; Y < 0x51: A = Mario X (0x6203)
 *   1e6c  17           rla                ; Mario X bit 7 -> carry (loc_1e6d reads it)
 *   1e6d  ...          (fall into loc_1e6d: set 0x694D by carry, 0x600A:=0x16, unwind)
 *
 * FOUR EXIT ARMS (the ROM's four control transfers):
 *   arm1  bit2 set            -> return m.call(0x1e80)   [board-type gate: RIVETS_LEFT]
 *   arm2  bit2 clr, bit0 set  -> return m.call(0x1e7a)   [Mario-Y guard, the ONLY arm
 *                                                          reached in attract]
 *   arm3  Y >= 0x51           -> ret nc, return true     [goal not reached, normal ret]
 *   arm4  Y <  0x51           -> return m.call(0x1e6d)   [sprite-mirror + board-complete,
 *                                                          unwinds -> false]
 * The BOOLEAN return is the loc_197a caller-skip contract: `true` on a normal `ret`,
 * `false` when an interior label's `pop hl / ret` unwinds PAST sub_1e57's caller
 * (loc_197a then bails). arms 1/2/4 propagate the callee's boolean verbatim; arm3
 * returns `true` (its own `ret`).
 *
 * INPUTS  : RAM BOARD (0x6227), MARIO_Y (0x6205), MARIO_X (0x6203); the stack (its own
 *           return 0x19BC, and below it loc_197a's return frame that the unwind arms
 *           consume). No register live-ins.
 * OUTPUTS : the four callees' register files / RAM (arm3 leaves A = MARIO_Y and the
 *           `cp 0x51` flags). B/C/D/E/H/L/IX/IY are untouched by sub_1e57 and pass
 *           through (loc_1e85's `pop hl` on the unwind arms is inside the callee).
 *
 * FLAGS (doc 06 discipline — drop a flag ONLY when it is provably dead before its next
 * writer; keep it when it reaches an exit):
 *   - `bit 2,a` (arm1 branch): DROPPED. Its flags never reach an exit — arm1 tail-calls
 *     loc_1e80 whose first op `and a` overwrites F, and on the fall-through path the next
 *     `cp` overwrites F. The branch is a plain `A & 0x04`.
 *   - `rra` (arm2 branch): DROPPED. Same — its only live output is carry = BOARD bit 0
 *     (loc_1e7a's `cp 0x31` then overwrites F; the `cp 0x51` path likewise). The rotated
 *     A is dead (overwritten by `ld a,(MARIO_Y)`). The branch is a plain `A & 0x01`.
 *   - `cp 0x51` (arm3/arm4 split): KEPT verbatim. On arm3 its full F is the returned exit
 *     state; on arm4 `rla` PRESERVES its S/Z/PV, so those bits still reach the exit.
 *   - `rla` (arm4): KEPT verbatim. loc_1e6d reads its carry (Mario X bit 7), and since no
 *     op between here and the final `ret` rewrites F, rla's C/H/N/F3/F5 (over cp's S/Z/PV)
 *     are the exit F. Its shifted A is dead (loc_1e6d's `ld a` overwrites it).
 *
 * CYCLES — COLLAPSED per doc 06: each arm's straight-line run of instructions folds into
 * ONE m.step charging that arm's exact oracle total, placed immediately before the arm's
 * control transfer; the `m.call`/`m.ret` boundaries stay verbatim. Per-arm OWN totals
 * (sub_1e57 only, excluding the callee):
 *   arm1  ld13 + bit8 + jpnz10                              = 31 t, exit 0x1e80, then m.call
 *   arm2  ld13 + bit8 + jpnz-nt10 + rra4 + ld13 + jpc10     = 58 t, exit 0x1e7a, then m.call
 *   arm3  …+ cp7                                            = 65 t, then m.ret(11)  (76 t total)
 *   arm4  …+ retnc-nt5 + ld13 + rla4                        = 87 t, exit 0x1e6d, then m.call
 * No hardware-latch write occurs in sub_1e57 (BOARD/MARIO_* are work RAM; the callees'
 * 0x694D/0x600A are work RAM too, not 0x7Cxx/0x7Dxx/0x78xx latches), so no bus-cycle
 * boundary is pinned and no partial collapse is forced. Total preservation keeps the
 * main-loop spin count 0x6019 (PRNG entropy) unchanged.
 *
 * GATE = STRICT byte-exact whole-machine (MEASURED, not assumed). sub_1e57 is dispatched
 * only from loc_197a's per-frame update cascade, which runs INSIDE the vblank NMI with
 * the mask cleared. Probed over 1400 attract frames: 816 dispatches (first ~frame 586),
 * io.nmiMask == 0 at 816/816 (0 outside the NMI), and the NMI's pushed PC NEVER lands in
 * [0x1E57,0x1E8C) — 0 landings there, 0 anywhere in the 0x1900-0x2FFF cascade band, all
 * in the 0x02BD-0x0372 main-loop band. So the routine is ATOMIC: the NMI cannot fire
 * inside it, no mistimed PC is pushed, and (writing no VRAM/flip/palette) the collapse
 * tears no raster. An atomic, total-preserving collapse is byte-exact, so it passes the
 * STRICT gate directly — the convergent gate is NOT needed. (This corrects the sibling
 * loc_1e7a docstring's "INTERRUPTIBLE loc_197a cascade" note, which is the stale reading
 * doc 06 supersedes: the cascade is atomic.) Only arm2 is reached in attract (816/816);
 * arms 1/3/4 are proven from crafted identical-both-sides seeds with committed cycle
 * totals, in equivalence-1e57.test.js.
 */

import { BOARD, MARIO_X, MARIO_Y } from "./ram.js";

export function sub_1e57(m) {
  const { regs, mem } = m;

  // 1E57 ld a,(BOARD) ; 1E5A bit 2,a ; 1E5C jp nz,0x1e80
  regs.a = mem.read8(BOARD);
  if (regs.a & 0x04) {
    // arm1: board-type bit 2 -> loc_1e80 (RIVETS_LEFT board-complete test).
    m.step(0x1e80, 31); // ld 13 + bit 8 + jp 10
    return m.call(0x1e80);
  }

  // bit 2 clear: 1E5F rra puts BOARD bit 0 into carry; 1E60 ld a,(MARIO_Y); 1E63 jp c,0x1e7a.
  if (regs.a & 0x01) {
    // arm2: the ONLY arm reached in attract. loc_1e7a needs A = MARIO_Y.
    regs.a = mem.read8(MARIO_Y);
    m.step(0x1e7a, 58); // + jp-nz-nt 10 + rra 4 + ld 13 + jp-c 10
    return m.call(0x1e7a);
  }

  // jp c not taken: 1E60 ld a,(MARIO_Y) ; 1E66 cp 0x51 ; 1E68 ret nc.
  regs.a = mem.read8(MARIO_Y);
  regs.cp(0x51); // KEPT: this F is the arm3 exit state, and rla preserves its S/Z/PV on arm4
  if (!regs.fC) {
    // arm3: Mario Y >= 0x51 -> normal return, F = cp 0x51 result.
    m.step(0x1e68, 65); // + cp 7
    m.ret(11);
    return true;
  }

  // arm4: Mario Y < 0x51 -> 1E69 ld a,(MARIO_X) ; 1E6C rla ; fall into loc_1e6d.
  regs.a = mem.read8(MARIO_X);
  regs.rla(); // KEPT: carry = Mario X bit 7 (loc_1e6d reads it), and this F reaches the exit
  m.step(0x1e6d, 87); // + ret-nc-nt 5 + ld 13 + rla 4
  return m.call(0x1e6d);
}
