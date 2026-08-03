// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1fe5 — the forward horizontal step of the OBJ_ARRAY_67 object sweep: stage the
 * forward-step values the shared movement tail consumes, advance this object's X by
 * one, and run that tail.  ROM 0x1FE5.
 *
 * WHAT IT DOES, AND WHAT THAT RESTS ON. The sweep at ROM 0x1F72 walks the ten records
 * of OBJ_ARRAY_67 and, for each record whose active flag is 1, dispatches on two record
 * fields to one of five movement branches (ROM 0x1F93's four conditional tails plus its
 * fall-through). This is the branch reached when record field +1 is not 1 and record
 * field +2 has bit 1 set with bit 0 clear; its own body is the register-set swap below,
 * one increment of OBJ_X, and the two values it hands the tail. The "forward step"
 * reading rests on two things outside this body: OBJ_X (+3) is a live-grounded ram.js
 * name, and the mirror branch at ROM 0x1FEF is the same three operations with the sign
 * flipped — it DECREMENTS the same field and stages the mirrored pair (0xFF and 4
 * against this branch's 1 and 0).
 *
 * THE REGISTER-SET SWAP IS A CONTRACT, NOT SCRATCH BOOKKEEPING. All five branches do
 * their work in the shadow register set and reach the shared tail WITHOUT swapping
 * back; the swap at the head of ROM 0x21BA — where the tail's arms converge, ROM
 * 0x202F/0x2038 and ROM 0x215F all ending there — is the one that puts the sweep's own
 * loop state back: its sprite-record cursor, its record stride and its remaining count
 * all live in the swapped set. Dropping the swap here would let the tail's scratch land
 * on those live loop registers instead. (The record pointer itself is in the index
 * register, which the swap does not touch, which is why the tail can still address the
 * record while working in the shadow set.)
 *
 * THE TWO STAGED VALUES have separate consumers further down the still-frozen tail, and
 * the gate's teeth show them landing in different places:
 *   • The step selector reaches snapYToGirder (ROM 0x2333), which the tail calls to
 *     re-glue the object to the girder slope. 1 is the value that makes it snap on the
 *     offset-0 edge of a 16-pixel girder cell, 0xFF (the mirror branch's) on the
 *     offset-15 edge — forward and backward steps cross opposite edges of a cell first.
 *     Leaving this value unstaged first diverges at the record's Y, which is exactly
 *     what a girder snap writes.
 *   • The second value reaches ROM 0x23DE, which ORs it into the selector byte it hands
 *     the packed-table lookup at ROM 0x3009, whose result rotates through the record's
 *     sprite bytes. Leaving THIS one unstaged first diverges at the record's sprite
 *     code, so the value demonstrably steers sprite selection. WHICH FRAME IT SELECTS IS
 *     NOT ESTABLISHED HERE — nextAnimationStep's own header records the table's meaning as
 *     unknown; all that was derived is that this branch passes 0 where its mirror
 *     passes 4.
 *
 * NAME: kept the neutral loc_ — the mechanism is pinned to the oracle, but nothing here
 * establishes what the swept objects are or what the tail ultimately does with the
 * stepped record, so no English name is earned.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1fe5.test.js.
 * GATE:     captured + crafted + live. 0x1FE5 is richly reachable in plain attract and
 *           the gate MEASURES it: 2775 real dispatches in a 3000-frame attract run, and
 *           ALL 2775 are replayed — no sampling, so there is no sampling policy to be
 *           wrong about — spanning 20 distinct entry shapes (record slot x tail arm x X
 *           band). Attract only ever enters with an X in 0x2A..0xE3, measured over those
 *           same dispatches, so three arms are crafted by poking THAT ONE BYTE on a real
 *           captured machine (X=255 so the step wraps to 0, X=0x10 below the tail's low
 *           threshold, X=0x02 onto its every-eighth-pixel gate), each asserting which
 *           tail arm the poke actually reached. The rewrite is then wired live at 0x1FE5
 *           for the same 3000-frame attract run and compared per frame against the
 *           all-oracle baseline, with the oracle's cycle cost restored per dispatch (a
 *           constant 47 T-states, asserted in-test). ALL OF IT IS
 *           ATTRACT — 25m only, and attract fills only record slots 0-6; gameplay, the
 *           other boards and slots 7-9 are NOT covered. Teeth, all seven observed being
 *           caught: a dropped register-set swap, a decrement in place of the increment,
 *           the mirror branch's staged pair, the step applied to OBJ_Y instead of OBJ_X,
 *           each staged value left unstaged on its own, and a saturating increment.
 * LIVE-OUT: memory-only, plus the tail's return value propagated unchanged. The one
 *           thing this rewrite drops that the oracle defines is the FLAG state its
 *           increment leaves at the moment the tail is entered. DERIVED: the sole caller
 *           is ROM 0x1F93 — the only routine in the translated layer that calls 0x1FE5
 *           at all — and it reaches this by a tail jump that reads nothing back; the
 *           chain above it (ROM 0x1F83, 0x1F8D) is tail jumps too, ending at 0x1F8D's
 *           `ret`. Below, the tail at ROM 0x1FF6 sets its own flags (its mask at ROM
 *           0x1FFD) ahead of its first conditional (ROM 0x2001), so the increment's
 *           flags are dead there as well. MEASURED: a twin that scrambles the flags
 *           immediately before entering the tail is wired live for the same 3000-frame
 *           attract run and every frame stays byte-identical. Everything else — pc, SP
 *           and the rest of the register file — survives unchanged, because the frozen
 *           tail runs the whole rest of the sweep and returns through the same `ret`;
 *           the gate compares those too, as extras beyond the required contract.
 * NAMES:    OBJ_X (record +3) from ram.js. ROM 0x1FF6 has no idiomatic twin in ROUTINES yet, so it
 *           is still reached through m.call; it is entered by a jump, not a call, so
 *           there is no return address to push beside it.
 */

import { OBJ_X } from "./ram.js";

// Staged for the tail, which takes both out of the shadow register set.
const GIRDER_SNAP_STEP = 1; // snapYToGirder's step selector: snap on the offset-0 edge
const TAIL_SELECT_BITS = 0; // OR-ed into ROM 0x23DE's selector; steers the sprite bytes

/**
 * @param {object} m       the machine.
 * @param {number} record  base address of the object record being stepped.
 * @returns {*}            the shared tail's return value, propagated unchanged.
 */
export function loc_1fe5(
  m,
  record = m.regs.ix /* oracle-boundary default: caller ROM 0x1F93 still frozen */,
) {
  const { regs, mem8 } = m;

  // Into the shadow set — see the contract above. The tail does not swap back.
  regs.exx();

  regs.b = GIRDER_SNAP_STEP;
  regs.c = TAIL_SELECT_BITS;

  // One pixel forward. The store truncates, so an X of 255 wraps to 0 here exactly as
  // the hardware does.
  mem8[record + OBJ_X] = mem8[record + OBJ_X] + 1;

  // The frozen tail reads the record base out of the index register rather than taking
  // an argument, so publish it there before handing over. A no-op on the default.
  regs.ix = record;

  // The shared movement tail, still the frozen oracle. Entered by a jump, so there is no
  // return address to push: this routine's own return IS the tail's return.
  return m.call(0x1ff6);
}
