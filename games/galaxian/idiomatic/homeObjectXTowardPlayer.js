// SPDX-License-Identifier: GPL-3.0-only
/**
 * homeObjectXTowardPlayer — object-AI state-7 handler: home an attacker's X onto the player.
 *
 * WHAT IT IS
 *   One state of the diving-attacker AI (object-AI dispatch slot 7; mechanisms.md "homing toward
 *   the player (state 7)"). Each frame it steers the object's 16-bit X:subpixel position toward
 *   the shared target by roughly four times the signed distance, carrying the hardware's rounding
 *   bias, then advances to the next AI state when the object's dwell timer drains.
 *
 * ROLE IN THE MACHINE
 *   The target is loc_4202 (0x4202) — the one cell holding the ship's X, which every attacker
 *   reads as its aim anchor. The object record is addressed by `obj` (defaulting to the Z80 IX
 *   pointer); its fields here are the frame counter (obj+3), the X position stored as a
 *   high-byte/low-byte "subpixel" pair (obj+4 high, obj+9 low), the dwell timer (obj+16), and the
 *   AI state index (obj+2). The ~4x-distance step makes the swoop converge fast then settle.
 *
 * ROM 0x0f3c.  Grounding: [seen].
 *
 * LIVE-OUT: obj+3 bumped; obj+4/obj+9 moved toward loc_4202; obj+16 decremented, and on its
 * zero-cross obj+2 (AI state) advanced by one.
 */
import { loc_4202 } from "./names.js";

// Field offsets within the object record addressed by `obj`.
const STATE = 2; // state index
const FRAME = 3; // per-frame counter
const POS_X = 4; // X position (high byte of the position:subpixel pair)
const POS_SUB = 9; // X subpixel (low byte)
const DWELL = 16; // frames left in this state

export function homeObjectXTowardPlayer(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Bump the per-frame counter first; other handlers key row-fire timing off this same field.
  mem8[obj + FRAME] = mem8[obj + FRAME] + 1;

  // Signed distance to the target, and a ~4x step toward it carrying the hardware's rounding bias
  // (nothing when already on target, an extra count when overshooting from the far side).
  const dist = (mem8[obj + POS_X] - mem8[loc_4202]) & 0xff;
  const signed = dist < 128 ? dist : dist - 256;
  const bias = dist === 0 ? 0 : dist >= 128 ? 3 : 2;
  const step = 4 * signed + bias;

  // Recombine the X:subpixel pair into one 16-bit value, subtract the step, and split it back into
  // the two record bytes. Subtracting moves X toward a target at a lower value; the store to each
  // byte truncates to 8 bits, matching the Z80's 16-bit subtract writing back H and L.
  const pos = ((mem8[obj + POS_X] << 8) | mem8[obj + POS_SUB]) - step; // may go negative
  mem8[obj + POS_X] = pos >> 8; // high byte; the byte store truncates
  mem8[obj + POS_SUB] = pos; // low byte

  // Tick this state's dwell timer; while it has frames left, stay in the homing state. On its
  // zero-cross, advance to the next AI state (the swoop moves on from homing).
  mem8[obj + DWELL] = mem8[obj + DWELL] - 1;
  if (mem8[obj + DWELL] !== 0) return;
  mem8[obj + STATE] = mem8[obj + STATE] + 1;
}
