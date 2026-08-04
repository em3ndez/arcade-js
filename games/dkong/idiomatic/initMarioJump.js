// SPDX-License-Identifier: GPL-3.0-only
/**
 * initMarioJump — begin Mario's jump: flag him airborne and pick the horizontal launch
 * velocity from the held direction, then commit the arc.
 *
 * This is the front half of a jump. The movement machine reaches it on its "start
 * jump" arm, the frame a jump press is accepted. It does two things itself and then
 * delegates the rest:
 *
 *   - MARIO_AIRBORNE := 1 — the movement machine's first per-frame test now routes
 *     Mario through the ballistic handler instead of the ground handler.
 *   - Horizontal launch velocity chosen from P1_INPUT: bit 0 = Right, bit 1 = Left,
 *     with Right winning if both are held (Right is tested first). Right gives +128,
 *     Left -128, and holding neither gives zero — a straight-up jump. It is a
 *     big-endian 16-bit value (vxHi, vxLo) the integrator later reads: high byte 0x00
 *     for Right and 0xFF for Left (the sign extension), low byte 0x80 in both, and
 *     both bytes zero when no direction is held.
 *
 * It then hands that velocity to the launch tail, which writes the full airborne
 * motion record: velocities, cleared fractions and frame count, jump pose, take-off-Y
 * snapshot, jump sound.
 *
 * Reads P1_INPUT, writes MARIO_AIRBORNE, then delegates. Reached once per jump.
 *
 * LIVE-OUT: memory-only — every value that matters is written to RAM by the launch
 * tail; nothing is returned.
 */
import { MARIO_AIRBORNE, P1_INPUT } from "./names.js";
import { launchMarioJump } from "./launchMarioJump.js";

/** P1_INPUT direction bits: bit0 Right, bit1 Left, bit2 Up, bit3 Down. */
const INPUT_RIGHT = 0x01;
const INPUT_LEFT = 0x02;

/**
 * @param {object} m  the machine.
 */
export function initMarioJump(m) {
  const { mem } = m;

  // Switch Mario to the airborne (ballistic) branch of the movement machine.
  mem.write8(MARIO_AIRBORNE, 1);

  // Choose the horizontal launch velocity from the held direction. Big-endian
  // 16-bit: Right -> +128, Left -> -128 (high byte 0xFF, low byte 0x80), neither
  // -> zero. Right takes precedence when both are held.
  const input = mem.read8(P1_INPUT);
  let vxHi, vxLo;
  if (input & INPUT_RIGHT) {
    vxHi = 0x00;
    vxLo = 0x80;
  } else if (input & INPUT_LEFT) {
    vxHi = 0xff;
    vxLo = 0x80;
  } else {
    vxHi = 0x00;
    vxLo = 0x00;
  }

  // Commit the arc: write the airborne motion record, jump pose, take-off Y, sound.
  launchMarioJump(m, vxHi, vxLo);
}
