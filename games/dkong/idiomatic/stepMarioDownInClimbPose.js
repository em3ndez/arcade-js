// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMarioDownInClimbPose — step Mario down one pixel, held in the climb-down pose.
 * ROM 0x2284.
 *
 * The Y-descend tail of slide50mObjectDown: when that routine finds Mario's screen Y below 0x68
 * (or odd), it jumps here (ROM 0x227E / 0x2281). Each call nudges Mario down one pixel
 * in two places and pins his drawn pose:
 *
 *   - Increment MARIO_Y, his logical screen position (larger is lower on screen), so the
 *     game-side position drops one pixel.
 *   - Pin Mario's hardware sprite to a fixed climb-frame pose and hand back a pointer to
 *     that sprite record's Y field — both done by pinMarioClimbPose.
 *   - Increment that sprite-record Y, so the drawn sprite drops one pixel to match.
 *
 * So the logical position and the on-screen sprite both descend one pixel per call, and
 * the sprite is held in the climb-down pose while they do.
 *
 * GROUNDED (DK understanding pass 5, independent confirmer): increments the named MARIO_Y
 * (ram.js: larger = lower on screen, so the step is DOWN) and pins the climb pose + steps
 * sprite-Y via pinMarioClimbPose. "climb" is grounded by ram.js's MARIO_SPRITE_CODE note
 * (pose codes 03-05 = climb; pinMarioClimbPose forces 3 with the mirror flag clear). Both
 * asserted facts (direction DOWN, CLIMB pose) rest on named cells. Promoted as a 2-member
 * family with pinMarioClimbPose (0x3FC0).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2284.test.js.
 * GATE:     crafted-entry — 0x2284 is reached only through slide50mObjectDown's still-translated
 *           descend arm (unwired in attract), so there are no real captures. The routine
 *           is provably input-independent in structure, so the gate runs it against the
 *           oracle over many self-consistent base states with MARIO_Y and the three sprite
 *           record bytes pre-poked to adversarial values (including the 0xFF -> 0x00 wrap),
 *           and confirms both Y bytes step by one, the pose byte is pinned to 3, the
 *           attribute neighbour is untouched, and nothing else moves. Teeth: a twin that
 *           skips the logical-Y step, one that skips the sprite-Y step, and one that steps
 *           the wrong sprite byte.
 * LIVE-OUT: memory-only. This routine is tail-reached from slide50mObjectDown, itself tail-reached
 *           from dispatch50mObjectState's dispatcher, which returns into loc_197a at its next call site
 *           (0x199E). That successor issues a fresh call without reading any register the
 *           descend leaves, so the residual registers/flags and the terminal return are
 *           dead. The dissolved 0x3FC0 call bracket writes only dead STACK_SCRATCH.
 * NAMES:    MARIO_Y (0x6205) here; the sprite pose byte (MARIO_SPRITE_RECORD+SPRITE_CODE,
 *           0x694D) and Y byte (MARIO_SPRITE_RECORD+SPRITE_Y, 0x694F) are inside pinMarioClimbPose.
 */

import { MARIO_Y } from "./ram.js";
import { pinMarioClimbPose } from "./pinMarioClimbPose.js"; // ROM 0x3FC0 — pin the climb pose, return the sprite Y pointer

export function stepMarioDownInClimbPose(m) {
  const { mem } = m;

  // Move Mario's logical screen position down one pixel.
  mem.write8(MARIO_Y, mem.read8(MARIO_Y) + 1);

  // Pin the hardware sprite to the climb-down pose and take a pointer to its Y field...
  const spriteYPtr = pinMarioClimbPose(m);

  // ...then move the drawn sprite down one pixel to match.
  mem.write8(spriteYPtr, mem.read8(spriteYPtr) + 1);
}
