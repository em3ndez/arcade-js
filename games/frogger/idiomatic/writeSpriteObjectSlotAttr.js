// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeSpriteObjectSlotAttr  —  ROM 0x2bfb  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The attribute-staging arm of dispatcher B — the sprite-object engine's single-tile,
 *   rideable-creature path. Once a dispatcher-B object is alive, this is the arm that gives it its
 *   on-screen look: it turns the object's current STATE byte into a sprite tile-code (folding in
 *   the object's horizontal-flip bit) and drops that, plus a fixed color, into the object's
 *   hardware sprite slot. So a dispatcher-B object's appearance is a direct function of its state,
 *   not a timer-driven cycling frame the way a dispatcher-A creature's is.
 *
 * WHERE IT SITS
 *   The last of updateSpriteObject's five fixed arms (dispatcher B, ROM 0x2b83), which run once
 *   per frame per object in the order spawn (0x2c13) -> steer-toward-target (0x2bab) ->
 *   write-slot-X (0x2b93) -> hit-test-ahead (0x2ca8) -> write-slot-ATTR (this, 0x2bfb). It is
 *   entered with IX = the object's 16-byte work-RAM record and IY = its 4-byte hardware sprite
 *   slot. On an idle object it falls straight through the first `return` and touches nothing.
 *
 * LIVE-OUT
 *   Memory only. It writes two bytes of the IY sprite slot (the tile-code byte and the color
 *   byte); the IX object record and the ROM attribute table are read-only. It returns nothing and
 *   leaves no register the caller reads. Those two slot bytes are mirrored to sprite hardware
 *   (OBJRAM) on the next vblank DMA, so writing the slot IS drawing the object.
 */
import { OBJECT_STATE_ATTR_TABLE } from "./names.js";

export function writeSpriteObjectSlotAttr(m, record = m.regs.ix, slot = m.regs.iy) {
  const { mem8 } = m;

  // ── Gate: is this object alive? ──────────────────────────────────────────────────────
  // Record byte +6 is the object's active/state byte: 0 = idle, 1 = armed/live, and the
  // dispatcher-B ahead-hit-test (flagSpriteObjectFrogHitAhead, 0x2ca8) bumps a mounted object to
  // 2. Every dispatcher-B arm early-returns on an idle object, so a state of 0 means there is
  // nothing to draw and we leave the slot exactly as it was.
  const state = mem8[record + 6];
  if (state === 0) return;

  // ── Derive the sprite tile-code from the object's state ──────────────────────────────
  // OBJECT_STATE_ATTR_TABLE (ROM 0x2cd9) maps each state byte to the sprite tile-code to show for
  // that state — dispatcher B's stand-in for a frame animation, since the look is a pure function
  // of the state index rather than a counting phase. Into that we OR record byte +5, the object's
  // direction / horizontal-flip bit (0x00 or 0x80). The high bit of a slot's tile-code byte IS the
  // hardware's horizontal-flip bit, so folding +5 in here makes the creature face its travel
  // direction. (The local is named `attr` to match the routine/table's "attribute" vocabulary;
  // in the hardware slot layout this value is specifically the tile-code byte.)
  const attr = mem8[OBJECT_STATE_ATTR_TABLE + state] | mem8[record + 5];

  // ── Stage the two slot bytes the video hardware reads ────────────────────────────────
  // The IY slot is a 4-byte hardware sprite entry laid out [X, code, color, Y]. This arm owns two
  // of those bytes: slot+1 = the tile-code we just built (with the flip bit folded in), and
  // slot+2 = 2, the fixed color/attribute value every dispatcher-B object uses. (slot+0 X and
  // slot+3 Y are staged by the sibling write-slot-X / spawn arms.) Both reach OBJRAM on the next
  // vblank as this object's on-screen sprite.
  mem8[slot + 1] = attr;
  mem8[slot + 2] = 2;
}
