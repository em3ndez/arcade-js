// SPDX-License-Identifier: GPL-3.0-only
/**
 * endClimbAtLadderLimit — finish a ladder climb that has reached a ladder end.
 * ROM 0x1D67.
 *
 * This is the limit-reached arm of the climb-animation stepper loc_1d11: each climb
 * frame loc_1d11 nudges Mario's Y and tests whether (newY + 8) has hit either ladder
 * extent limit (MARIO_CLIMB_LIMIT_A/B, 0x621B/0x621C); when it has — Mario has
 * climbed onto the girder at the top, or stepped off at the bottom — it tail-jumps
 * here to dismount him from the ladder. It is the counterpart of loc_1d49, the
 * still-on-the-ladder arm (which instead sets MARIO_ON_LADDER := 1).
 *
 * The dismount is three fixed stores, then a sprite-record refresh:
 *   - MARIO_SPRITE_CODE (0x6207) := 0x06 — the ladder-end pose, written FLAT (the
 *     facing/flip bit 7 is intentionally dropped; at a ladder end Mario faces front),
 *     so writeMarioSpriteRecord copies 0x06 into his sprite record.
 *   - 0x6219 := 0 — clears the climb half-step toggle (an unnamed climb-scratch byte;
 *     see NAMES).
 *   - MARIO_ON_LADDER (0x6215) := 0 — Mario is no longer on a ladder, so the next
 *     frame's input handler stops taking the climb branch. (loc_1d49 sets this to 1;
 *     this arm clears it — the one bit that distinguishes the two exits.)
 * Then it tail-jumps to writeMarioSpriteRecord (ROM 0x1DA6), the mover's shared
 * convergence tail, which copies Mario's live [X, code, attr, Y] into his hardware
 * sprite record. Because 0x6207 was just set to 0x06, the record's +1 code slot picks
 * up the ladder-end pose. A LEAF beyond that one tail call: writes three bytes and
 * refreshes the record; reads no live-in register.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1d67.test.js.
 * GATE:     crafted-entry — the real attract 25m demo climbs a ladder to its top, so
 *           0x1d67 dispatches for real (once per attract loop); that one straight-line
 *           arm IS the full control-flow coverage. Crafted entries then vary the sprite
 *           source bytes (X/code/attr/Y) and pre-set 0x6207/0x6219/0x6215 to non-target
 *           values to pin the record copy and prove the three stores force their
 *           constants regardless of prior contents. Teeth: a keep-on-ladder twin and a
 *           wrong-sprite-code twin, both caught.
 * LIVE-OUT: memory-only — 0x6207, 0x6219, 0x6215 and the four sprite-record bytes
 *           0x694C..0x694F. The oracle reaches its final `ret` (via 0x1DA6) through an
 *           unconditional tail-jump and every caller reaches loc_1d67 the same way, so
 *           no successor reads a flag/register it leaves; the oracle's residual A (0x00
 *           then, from 0x1DA6, MARIO_Y), B, HL and flags are dead ABI. pc/SP model the
 *           single net `ret` the 0x1DA6 tail performs.
 * NAMES:    MARIO_SPRITE_CODE (0x6207), MARIO_ON_LADDER (0x6215) — from names.js.
 *           0x6219 kept hex: an unnamed climb-toggle scratch byte (names.js rejects it —
 *           two writers, zero absolute readers), so no confirmed name to import.
 */

import { MARIO_SPRITE_CODE, MARIO_ON_LADDER } from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

/** Climb half-step toggle scratch (unnamed in names.js; cleared on ladder-end dismount). */
const CLIMB_TOGGLE = 0x6219;

/** Sprite code for Mario at a ladder end (written flat, discarding the facing bit). */
const LADDER_END_POSE = 0x06;

export function endClimbAtLadderLimit(m) {
  const { mem } = m;
  mem.write8(MARIO_SPRITE_CODE, LADDER_END_POSE); // 0x6207 := 6 — ladder-end pose
  mem.write8(CLIMB_TOGGLE, 0x00);                 // 0x6219 := 0 — clear climb toggle
  mem.write8(MARIO_ON_LADDER, 0x00);              // 0x6215 := 0 — off the ladder now
  writeMarioSpriteRecord(m);                      // tail-jump 0x1DA6: refresh sprite record
}
