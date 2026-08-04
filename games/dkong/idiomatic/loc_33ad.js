// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_33ad — step one object's working X a single pixel in the direction its state selects,
 * mirror its sprite to match, advance its animation, and re-snap its working Y on 25m.
 * ROM 0x33AD.
 *
 * Reached from the still-frozen per-object state machine at 0x3202 (its 0x323B call site,
 * taken while the object's OBJ_STATE is below 4), which supplies the object record in a
 * register. Measured live: 309 real dispatches in a 3000-frame attract run, every one of them
 * against the first record of the 0x6400 object array. Three steps:
 *
 *   1. OBJ_STATE picks the travel direction, and the same branch does two things at once —
 *      it steps the working X one pixel and it sets or clears bit 7 of the object's sprite
 *      tile code, so the mirrored sprite always faces the way the object is moving. State 1
 *      steps X up and sets the flip bit; every other state steps X down and clears it.
 *   2. stepObjectSpriteFrame then runs the object's own animation clock over the SAME sprite
 *      code byte (and a per-object down-counter), so the ORDER matters: the flip bit is
 *      written first and the animation step lands on top of it. That is visible in the codes
 *      the record actually takes — 0x3D/0x3E while the flip bit is clear and 0xBD/0xBE while
 *      it is set, which is exactly the {61,62,189,190} set names.js records for OBJ_SPRITE_CODE.
 *   3. Control falls into loc_33c3, which on 25m only re-snaps the working Y to the sloped
 *      girder under the object's new X. Off 25m that tail does nothing, so on other boards
 *      this routine is just the X step + the sprite work.
 *
 * WHICH FIELDS THESE ARE. The two stepped coordinates are record fields +0x0E and +0x0F, and
 * neither has a names.js name; they are the object's WORKING position, one stage upstream of the
 * grounded OBJ_X/OBJ_Y. Corroborated twice from outside this routine, both in the frozen
 * oracle at 0x3202: it copies +0x0E straight into OBJ_X (ROM 0x326F-0x3272) and stores
 * +0x0F plus a 0x3A7A table term into OBJ_Y (ROM 0x3275-0x3279) — and measured, +0x0E equalled
 * OBJ_X on all 309 real dispatches. Its sibling loc_298c independently reads the same pair as a
 * position, building its tile probe from +0x0E and +0x0F. The bit-7 flip reading is corroborated
 * by names.js's SPRITE_BUFFER entry (record +1 code, bit 7 = flip) plus OBJ_SPRITE_CODE's note
 * that the object's +0x07 is copied into that sprite byte.
 *
 * WHAT IS NOT ESTABLISHED: which object this services. IX is loaded from OBJ_ITER_PTR by the
 * caller, so the record identity is whatever that iterator is pointing at; nothing here or in
 * names.js names it, and the header claims nothing about it. Nor is the sense of state 1 called
 * "left" or "right" — only that it is the direction 0x3202's edge tests re-arm at the low-X
 * boundary (0x324D: X < 0x10 -> state 1, X >= 0xF0 -> state 2) and undo when the move is
 * rejected (0x3297: state 1 -> step X back down, state 2 -> step it back up).
 *
 * The object-record pointer arrives from the caller at the oracle boundary (0x3202 is still the
 * frozen oracle and hands the record over in a register), so this reads it from the machine
 * rather than as a promoted parameter; that dissolves once 0x3202 is decompiled.
 *
 * NAME: kept the neutral loc_ — the mechanism is pinned, but the object it services is not
 * established to the routine-name bar. Promote once corroborated. (The frozen oracle's file
 * carries an entry_/sub_ style name for the same address; it is not mirrored here.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-33ad.test.js.
 * GATE:     captured + crafted. 0x33AD IS naturally reached — MEASURED at 309 real attract
 *           dispatches in 3000 frames, and those already span BOTH arms (OBJ_STATE 1 on 175 of
 *           them, 0 on the other 134), so the captured-dispatch case is not vacuous. What
 *           attract does NOT reach is crafted on a real attract base, poked identically on both
 *           sides: the byte wraps at either end of the X step and of the sprite code, the
 *           animation clock's expiry and its every-sixteenth-step toggle landing on top of the
 *           flip bit, the other travel states the caller's guard admits (2, 3 and 0xFF — the
 *           measured attract dispatches showed only 0 and 1), and both sides of the 25m gate on
 *           the loc_33c3 tail. Every case
 *           compares RAM minus the dead STACK_SCRATCH (the oracle's dissolved push16/ret
 *           bracket writes only there) plus pc and SP.
 *           Teeth: four broken twins, each observed failing — X stepped the wrong way, the flip
 *           bit ORed on both arms so it never clears, the animation step run BEFORE the flip
 *           write instead of after, and the loc_33c3 tail dropped.
 * LIVE-OUT: memory-only — the object's working X (+0x0E), its sprite tile code (+0x07), the
 *           animation down-counter (+0x15) and, on 25m, the working Y (+0x0F). The caller
 *           consumes no register or flag this leaves behind: its next action is a call to
 *           loc_298c, which re-loads the object pointer from OBJ_ITER_PTR itself and takes no
 *           register live-in, and 0x3202 re-loads the pointer register from the same cell
 *           before its own next field access. pc and SP net to a single caller-return on every
 *           arm (the oracle's own return is the fall-through tail's), so both are compared too.
 * NAMES:    OBJ_STATE (+0x0D) and OBJ_SPRITE_CODE (+0x07) from names.js. Record fields +0x0E and
 *           +0x0F have no names.js offset name and stay local consts, as in loc_33c3.
 *           NAMESPACE: the pointer addresses an OBJECT record (0x6400 array, measured), so
 *           +0x07 is OBJ_SPRITE_CODE, the object-record field — NOT names.js's SPRITE_CODE (+1
 *           of a 4-byte hardware SPRITE record inside SPRITE_BUFFER, a different namespace).
 *           Direct-called: stepObjectSpriteFrame (ROM 0x3409) and loc_33c3 (ROM 0x33C3).
 */

import { OBJ_STATE, OBJ_SPRITE_CODE } from "./names.js";
import { stepObjectSpriteFrame } from "./stepObjectSpriteFrame.js"; // ROM 0x3409 — the animation clock
import { loc_33c3 } from "./loc_33c3.js"; // ROM 0x33C3 — the 25m girder-slope Y re-snap (fall-through tail)

// Object-record field: the object's working X, one stage upstream of OBJ_X. No names.js name yet.
// (loc_33c3 reaches the same field as the cross-axis input of its girder-slope step.)
const OBJ_WORKING_X = 0x0e;

// Bit 7 of the sprite tile code: the flip the sprite hardware reads out of the code byte, held
// alongside the animation frame in the low bits.
const SPRITE_FLIP = 0x80;

// The one travel direction that steps the working X upward; every other state steps it down.
const STATE_STEP_UP = 1;

export function loc_33ad(m) {
  const { regs, mem } = m;

  // The object-record pointer the caller supplied (oracle boundary).
  const objBase = regs.ix;
  const codeAddr = (objBase + OBJ_SPRITE_CODE) & 0xffff;
  const xAddr = (objBase + OBJ_WORKING_X) & 0xffff;

  // One direction bit, two effects: which way X moves, and which way the sprite faces.
  const code = mem.read8(codeAddr);
  if (mem.read8((objBase + OBJ_STATE) & 0xffff) === STATE_STEP_UP) {
    mem.write8(codeAddr, code | SPRITE_FLIP);
    mem.write8(xAddr, mem.read8(xAddr) + 1);
  } else {
    mem.write8(codeAddr, code & ~SPRITE_FLIP);
    mem.write8(xAddr, mem.read8(xAddr) - 1);
  }

  // Advance the animation on top of the flip bit just written (same byte — order matters).
  stepObjectSpriteFrame(m, objBase);

  // Fall through into the tail: on 25m, re-snap the working Y to the girder under the new X.
  loc_33c3(m);
}
