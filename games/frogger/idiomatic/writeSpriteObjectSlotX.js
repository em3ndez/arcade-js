// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeSpriteObjectSlotX  —  ROM 0x2b93  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The X/Y slot-staging arm for a dispatcher-B sprite object — Frogger's single-tile, steerable,
 *   rideable hazard (the kind of lane creature the frog can hop aboard and be carried by). Once per
 *   frame, for an object that is active, it turns the object's lane target and its current position
 *   accumulator into the sprite's on-screen X, and copies the object's row byte down as the sprite Y,
 *   writing both into that object's hardware sprite slot.
 *
 * WHERE IT SITS
 *   The third of dispatcher B's five arms (updateSpriteObject, ROM 0x2b83), which run in fixed order —
 *   spawn, steer-toward-target, write-slot-X (this arm), hit-test-ahead, write-slot-attribute — against
 *   one record/slot pair per frame. The steer arm (steerSpriteObjectTowardTarget) has already nudged
 *   this object's position accumulator this frame; this arm converts that state into the two positional
 *   slot bytes the video hardware reads next frame. It is inert unless the record is active, so idle
 *   objects fall straight through the first `return` without touching the slot.
 *
 * LIVE-OUT
 *   Memory only. It writes two bytes of the 4-byte sprite slot (slot X and slot Y); the 16-byte object
 *   record is read-only. It returns nothing and leaves no register the caller reads — the dispatcher
 *   re-enters the next arm with fresh IX/IY of its own.
 */
import { loc_8000 } from "./names.js";

// The dispatcher enters with IX = the object's 16-byte record and IY = its 4-byte hardware sprite slot.
export function writeSpriteObjectSlotX(m, record = m.regs.ix, slot = m.regs.iy) {
  const { mem8 } = m;

  // ── Active gate ──────────────────────────────────────────────────────────────────────
  // Record byte +6 is the object's active flag: non-zero while the object is live on screen, 0 for an
  // idle or retired slot. An idle object must stage nothing, so bail before writing anything — this is
  // the early-out the great majority of calls take.
  if (mem8[record + 0x06] === 0) return;

  // ── On-screen X = lane target − position accumulator ─────────────────────────────────
  // Record byte +0x0b holds this object's lane index. Used as the low byte of a page-0x80 address
  // (loc_8000 0x8000 | index), it selects the object's per-object target cell — the lane position the
  // object is steering toward. Record byte +2 is the position accumulator the steer arm nudges ±1 per
  // move tick; subtracting it from the target gives the object's current on-screen X. The store into an
  // 8-bit slot cell wraps mod 256 (matching the ROM's byte subtraction), so a target below the
  // accumulator rolls around rather than going negative. This is slot+0, the X of the [X, code, color,
  // Y] hardware sprite entry.
  const laneTarget = mem8[loc_8000 | mem8[record + 0x0b]];
  mem8[slot + 0x00] = laneTarget - mem8[record + 0x02];

  // ── Sprite Y = row/category byte ──────────────────────────────────────────────────────
  // Record byte +4 is the object's row/category attribute — the same byte the hit test matches against
  // the frog's row. Copied straight into slot+3, it is the sprite's screen Y. (The remaining slot bytes,
  // code and color, are staged by the sibling arm writeSpriteObjectSlotAttr, ROM 0x2bfb.)
  mem8[slot + 0x03] = mem8[record + 0x04];
}
