// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_202f — stamp the leftward horizontal step onto an object's motion record, then hand on to
 * the shared record tail that arms the rest of the fall.  ROM 0x202F.
 *
 * The object is one record of OBJ_ARRAY_67, walked by the ten-slot loop at ROM 0x1F72 — which
 * runs only while BOARD is 1 — and the loop keeps the record's base in the index register. Two
 * bytes of that record are written here and nothing else: +0x10 and +0x11, the big-endian signed
 * 16-bit per-frame horizontal step, set to −96 in the record's 1/256-pixel units (three eighths of
 * a pixel per frame, leftward). Control then continues into the still-frozen tail at ROM 0x2038,
 * which writes the vertical half of the same motion record along with several further record bytes.
 *
 * WHAT THE ROLE LINE RESTS ON, and it is not this routine's own body — two stores and a cleared
 * register say nothing about what the bytes mean:
 *   - The CONSUMER is decompiled and gated. stepBallisticMotion (ROM 0x239C) reads +0x10:+0x11 as
 *     a big-endian 16-bit value and adds it to the record's +0x03:+0x04 coordinate on every
 *     airborne frame, so these two bytes are that coordinate's per-frame step. Had that routine
 *     turned out to read the pair as anything else — a timer, a table index — the role line would
 *     have died there.
 *   - The SIGN convention comes from Mario, whose airborne record has the same shape: ram.js
 *     records MARIO_AIR_VX_HI:MARIO_AIR_VX_LO taking +0x0080 for a rightward jump and 0xFF80 for a
 *     leftward one, in 1/256 px per frame. A negative value is leftward.
 *   - The BRANCH that selects this value belongs to the caller, not to this routine. The frozen
 *     loc_1ff6 arrives here only when the record's OBJ_X byte is below 28, and its own
 *     fall-through arm (ROM 0x2024-0x202E) writes the mirrored +0x0060 into the same two bytes
 *     when OBJ_X is 228 or above. Two ends of the playfield, one sign each.
 *   - MEASURED: 11 real dispatches in a 2500-frame 25m attract run, every one of them with the
 *     record's OBJ_X byte at 26 — consistent with the low-X arm and with nothing else.
 *
 * WHAT THIS DOES NOT CLAIM. The two arms push the object AWAY from the middle of the playfield at
 * both ends — leftward at the low-X end, rightward at the high-X end — which is the opposite
 * polarity to Mario's playfield-limit reflection (loc_1bf2 answers a right-limit verdict with a
 * LEFTWARD drift, pushing him back inboard). What that outward step looks like on screen was not
 * observed here, and the tail at ROM 0x2038 that sets the vertical half of the motion is still
 * frozen, so this file does not say where the object ends up — only what the two bytes are.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the index register instead of becoming a
 * named argument, because the frozen tail at ROM 0x2038 reads that same register directly. A caller
 * passing a different record would be obeyed here and ignored one call later. It becomes an honest
 * parameter when 0x2038 is decompiled, not before.
 *
 * Memory-equivalent to the frozen oracle — equivalence-202f.test.js.
 * GATE:     real captures + crafted. 11 of 11 dispatches captured in a 2500-frame 25m attract run
 *           are replayed, covering all 7 record bases attract presents (0x6700, 0x6720, 0x6740,
 *           0x6760, 0x6780, 0x67A0, 0x67C0); on top of them a crafted arm seeds the two written
 *           bytes and the accumulator with values attract never presents, on a synthetic stack.
 *           Every case runs the whole frozen tail below on both sides and compares RAM minus
 *           STACK_SCRATCH plus the forwarded return value. Teeth: three broken twins (dropped low
 *           byte, wrong high byte, dropped accumulator clear). Attract is 25m only — but so is
 *           this cluster, since the loop at ROM 0x1F72 returns immediately unless BOARD is 1, so
 *           there is no other board for the gate to be missing.
 * LIVE-OUT: memory (the two written record bytes) plus the accumulator, which must be zero when
 *           control reaches the frozen tail at ROM 0x2038 — that tail stores it into four further
 *           record bytes (+0x04, +0x06, +0x0e, +0x14). The index register passes through
 *           untouched. ALL FLAGS ARE DEAD: between here and the loop advance at ROM 0x1F8D, which
 *           overwrites every one of them, nothing reads a flag — the tail at 0x2038 and the sprite
 *           copy at 0x21BA only load and store. There is exactly ONE caller, loc_1ff6 at ROM
 *           0x201C, and it reaches this routine by a tail jump, so the only thing it can consume
 *           is the forwarded return value (undefined on all 11 measured dispatches; forwarded
 *           unchanged either way). Derived from the callers, then MEASURED, and the measurement is
 *           in the gate rather than in a scratchpad: wiring this rewrite live for a 1500-frame
 *           attract run (6 real dispatches) — with the 42 cycles the oracle charges for its own
 *           three instructions restored, so the vblank interrupt still lands where it did — leaves
 *           every frame's RAM minus STACK_SCRATCH identical to the all-oracle baseline. Without
 *           that restored charge the run forks on the spin counter around frame 1169, which is a
 *           property of cycle-free code and not of this routine.
 * NAMES:    none imported — every access is relative to the record base the loop maintains, and
 *           the record's field offsets have no registry entries of their own. OBJ_ARRAY_67, OBJ_X,
 *           BOARD, MARIO_AIR_VX_HI and MARIO_AIR_VX_LO are named in the prose above. The tail at
 *           ROM 0x2038 has no idiomatic file yet, so it stays a registry call.
 */

/**
 * The per-frame horizontal step this arm stamps: the signed 16-bit −96, big-endian, in the
 * record's 1/256-pixel units. Same shape as the mirrored +0x0060 the caller's other arm writes.
 */
const STEP_LEFT_HI = 0xff;
const STEP_LEFT_LO = 0xa0;

export function loc_202f(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;

  mem8[record + 0x10] = STEP_LEFT_HI;
  mem8[record + 0x11] = STEP_LEFT_LO;

  // The tail below stores this zero into four more bytes of the same record. It is still frozen,
  // so it collects the value the way its ROM twin does — out of the accumulator.
  regs.a = 0;

  return m.call(0x2038);
}
