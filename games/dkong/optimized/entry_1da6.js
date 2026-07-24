// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_1da6 — hand-optimized rewrite of the translated routine at ROM 0x1DA6,
 * proven equal to its oracle by the equivalence harness.
 *
 * This is the PLAYER-sprite -> draw-buffer copy: the convergence tail that ~11 of the
 * 0x1Cxx/0x1Dxx player-update routines `jp 0x1da6` into (loc_1c33, loc_1ceb, loc_1d49,
 * loc_1d67, ...). Because those callers reach it by a TAIL jump (no push16), its `ret`
 * returns to *their* caller — the per-frame update cascade loc_197a. It imports the five
 * RAM names it moves from ram.js; all five were already evidenced there, so this rewrite
 * proposes NO new naming candidate.
 */

import {
  MARIO_X,            // 0x6203 — sprite record byte +0 (X)
  MARIO_SPRITE_CODE,  // 0x6207 — sprite record byte +1 (tile code | facing bit7)
  MARIO_SPRITE_ATTR,  // 0x6208 — sprite record byte +2 (colour/attribute)
  MARIO_Y,            // 0x6205 — sprite record byte +3 (Y)
  MARIO_SPRITE_RECORD, // 0x694C — the 4-byte record's base in the sprite shadow buffer
} from "./ram.js";

/**
 * The four player fields in the DELIBERATE order the hardware sprite record wants them
 * (+0 X, +1 code, +2 attr, +3 Y). This is NOT sorted-by-address and must not be — it is
 * the record's physical byte layout, documented on MARIO_SPRITE_RECORD in ram.js.
 */
const SPRITE_SOURCE_FIELDS = [MARIO_X, MARIO_SPRITE_CODE, MARIO_SPRITE_ATTR, MARIO_Y];

/**
 * entry_1da6 -- copy Mario's four sprite fields into his display-buffer record.
 * [ROM 0x1DA6-0x1DBC]
 *
 *   1da6  21 4c 69      ld   hl,0x694c        ; HL -> MARIO_SPRITE_RECORD (record +0)
 *   1da9  3a 03 62      ld   a,(0x6203)       ; A = MARIO_X
 *   1dac  77            ld   (hl),a           ; record +0 := X
 *   1dad  3a 07 62      ld   a,(0x6207)       ; A = MARIO_SPRITE_CODE
 *   1db0  2c            inc  l                ; -> record +1 (inc L only: stays in-page)
 *   1db1  77            ld   (hl),a           ; record +1 := code
 *   1db2  3a 08 62      ld   a,(0x6208)       ; A = MARIO_SPRITE_ATTR
 *   1db5  2c            inc  l                ; -> record +2
 *   1db6  77            ld   (hl),a           ; record +2 := attr
 *   1db7  3a 05 62      ld   a,(0x6205)       ; A = MARIO_Y
 *   1dba  2c            inc  l                ; -> record +3
 *   1dbb  77            ld   (hl),a           ; record +3 := Y
 *   1dbc  c9            ret                    ; back to the tail-caller's caller
 *
 * WHAT IT DOES. Snapshots the live player state (X, sprite code, attribute, Y) into
 * Mario's 4-byte record inside the sprite shadow buffer (0x694C..0x694F). The i8257 DMA
 * blits that whole buffer to sprite RAM 0x7000 every vblank (sub_0141), so this copy is
 * what makes each frame's motion/animation visible. Player-hardcoded twin of the generic
 * object copier loc_21ba. Straight-line: NO branch, so exactly one path.
 *
 * INPUTS  : RAM MARIO_X/CODE/ATTR/Y (0x6203/0x6207/0x6208/0x6205). Incoming carry (see
 *           FLAGS). The stack (a return address for the `ret`).
 * OUTPUTS : RAM 0x694C..0x694F := (X, code, attr, Y). Registers on exit: HL = 0x694F
 *           (L walked 0x4c->0x4f via three in-page `inc l`), A = the last field read
 *           (MARIO_Y), F = the last `inc l`'s S/Z/H/PV with carry preserved (see FLAGS).
 *           BC/DE/IX/IY untouched. PC/SP move via `ret`. `return` forwards the (inert)
 *           result of m.ret.
 *
 * REGISTER CHURN -- NONE is droppable, so all of A/HL/F are reproduced faithfully. A is
 *   the transport register: each `ld a` is immediately stored, and A's FINAL value (MARIO_Y)
 *   is live at the routine boundary, which the unit gate compares. HL is the live
 *   destination pointer and ends 0x694F. So the readability win here is names + a loop over
 *   the repeated inc-copy + the docstring + the cycle collapse, NOT dropped registers.
 *   `inc l` (not `inc hl`): only L advances, keeping HL inside its 0x69xx page — faithful,
 *   though L only spans 0x4c..0x4f so no wrap is exercised.
 *
 * FLAGS -- KEPT verbatim via inc8, because the exit F is OBSERVABLE and NOT droppable:
 *   the last `inc l` (0x1dba, 0x4e->0x4f) is the final flag-writer before `ret` (ret sets
 *   no flags), so it defines the exit S/Z/H/PV. `inc` never touches carry, so the entry
 *   carry survives to the exit F unchanged — also observable. The unit gate compares the
 *   whole register file (incl. F and the undocumented F3/F5 bits), so reproducing inc8's
 *   exact result is required, not optional. There is no dead flag to drop here.
 *
 * CYCLES -- FULLY COLLAPSED to one m.step for the whole straight-line body + m.ret:
 *   10 (ld hl) + 20 (ld a,(x)+ld(hl)) + 24 + 24 + 24 = 102 t, charged once at the exit
 *   PC 0x1DBC immediately before the ret; then m.ret(10) -> 112 t total, exactly the
 *   oracle. The four RAM writes are to the sprite SHADOW BUFFER (work RAM), NOT a tagged
 *   hardware latch (0x7800-0f / 0x7c00 / 0x7c80 / 0x7d00-07 / 0x7d80-87) — the DMA blit
 *   to real sprite RAM 0x7000 happens later, in sub_0141 — so no hardware bus cycle is
 *   hidden inside the body and the full collapse across it is safe. No write-trace test
 *   is needed. total-preservation keeps the main-loop spin count 0x6019 (PRNG entropy)
 *   deterministic, so the strict whole-machine gate stays byte-exact.
 *
 * REACHABILITY / ATOMICITY (MEASURED, not assumed — the oracle's "not yet wired" note is
 *   STALE, and so is any "loc_197a is interruptible" claim). loc_197a IS dispatched from
 *   the NMI game-state gameplay path, and its cascade reaches this tail through those ~11
 *   callers. Probed at 0x1DA6 over an all-oracle run: 427 entries in 1200 attract frames
 *   (first ~f587, once the attract demo starts PLAYING 25m) and 43 in 1600 driven-gameplay
 *   frames. It is ATOMIC on EVERY measured call path: every single entry occurs INSIDE the
 *   NMI handler with the NMI mask CLEARED (in-NMI 427/427 attract, 43/43 gameplay; mask-set
 *   0/0), and this routine is a pure LEAF (no m.call) so the mask stays clear through its
 *   whole body and the NMI cannot re-enter — correspondingly the NMI's pushed PC never
 *   lands in [0x1DA6,0x1DBC] (0 landings). An atomic byte-exact collapse pushes no mistimed
 *   PC and tears no raster, so it passes the STRICT whole-machine gate directly and does
 *   NOT need the convergent gate. See equivalence-1da6.test.js.
 */
export function entry_1da6(m) {
  const { regs, mem } = m;

  // Field +0 (X): point HL at the record base and copy — no `inc l` for the first byte.
  regs.hl = MARIO_SPRITE_RECORD;                // ld hl,0x694c
  regs.a = mem.read8(SPRITE_SOURCE_FIELDS[0]);  // ld a,(MARIO_X)
  mem.write8(regs.hl, regs.a);                  // ld (hl),a

  // Fields +1..+3 (code, attr, Y): each is `inc l` then copy. inc8 advances L in-page and
  // sets S/Z/H/PV (carry preserved); the final iteration leaves the observable exit F.
  for (let i = 1; i < SPRITE_SOURCE_FIELDS.length; i++) {
    regs.a = mem.read8(SPRITE_SOURCE_FIELDS[i]);
    regs.l = regs.inc8(regs.l);
    mem.write8(regs.hl, regs.a);
  }

  // One collapsed charge for the entire branch-free body: 10+20+24+24+24 = 102 t at the
  // exit PC 0x1DBC (atomic -> byte-exact; no hardware-latch write pins an inner boundary).
  m.step(0x1dbc, 102);
  m.ret(10); // ret to the tail-caller's caller (10 t)
}
