// SPDX-License-Identifier: GPL-3.0-only
/**
 * initMarioJump — begin Mario's jump: set MARIO_AIRBORNE, pick the horizontal launch velocity
 * from P1_INPUT (bit0 Right -> +128, bit1 Left -> -128, neither -> 0; Right wins), then hand
 * the big-endian 16-bit velocity to the launch tail that commits the arc.
 *
 * LIVE-OUT: memory-only — every value is written to RAM by the launch tail; nothing returned.
 */
import { MARIO_AIRBORNE, P1_INPUT } from "./names.js";
import { launchMarioJump } from "./launchMarioJump.js";

const INPUT_RIGHT = 0x01;
const INPUT_LEFT = 0x02;

export function initMarioJump(m) {
  const { mem8 } = m;

  mem8[MARIO_AIRBORNE] = 1;

  const input = mem8[P1_INPUT];
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

  launchMarioJump(m, vxHi, vxLo);
}
