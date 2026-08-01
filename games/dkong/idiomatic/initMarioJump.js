// SPDX-License-Identifier: GPL-3.0-only
/**
 * initMarioJump — begin Mario's jump: flag him airborne and pick the horizontal
 * launch velocity from the held direction, then commit the arc.  ROM 0x1B6E.
 *
 * This is the front half of a jump. entry_1ac3's movement machine reaches it on its
 * "start jump" arm (a `jp c` into here) the frame a jump press is accepted. It does
 * two things itself and then delegates the rest:
 *
 *   - MARIO_AIRBORNE := 1 — the movement machine's first per-frame test now routes
 *     Mario through the ballistic handler instead of the ground handler.
 *   - Horizontal launch velocity chosen from P1_INPUT: bit 0 = Right, bit 1 = Left,
 *     with Right winning if both are held (the oracle tests Right first). Right gives
 *     +0x0080, Left 0xFF80 (i.e. -0x0080), neither 0x0000 (a straight-up jump). This
 *     is the big-endian 16-bit velocity (vxHi, vxLo) the integrator later reads.
 *
 * It then tail-calls launchMarioJump (ROM 0x1B8A) with that velocity, which writes
 * the full airborne motion record (velocities, cleared fractions/frame-count, jump
 * pose, take-off-Y snapshot, jump sound). The oracle reaches launchMarioJump as a
 * `jp c` / fall-through tail-jump; here it is a direct call and the passed (vxHi, vxLo)
 * replace the oracle's BC hand-off.
 *
 * Reads P1_INPUT, writes MARIO_AIRBORNE, then delegates. Reached once per jump.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1b6e.test.js.
 * GATE:     crafted-entry sweep (all three velocity arms incl. Right+Left-both-held,
 *           × facing-bit × take-off-Y edges, oracle vs candidate on fresh clones of a
 *           real captured entry) + real captured attract dispatches (Mario jumps
 *           naturally, hitting straight-up / left / right — inputs 0x80 / 0x82 / 0x81).
 *           Teeth: a twin that checks Left before Right (wrong precedence when both held).
 * LIVE-OUT: memory-only. entry_1ac3→here→launchMarioJump is a tail-jump chain; the
 *           `ret` returns to loc_197a @0x1983, which `call`s the next cascade routine
 *           without reading A/HL/BC or flags (see launchMarioJump's header). The
 *           oracle's residual registers/flags are dead ABI; every value that matters
 *           was written to RAM. (No pc/SP: the Z80 tail-jump chain's `ret` is the JS
 *           return; dumpState excludes pc/SP.)
 * NAMES:    MARIO_AIRBORNE, P1_INPUT — ram.js. Velocity constants inline (they are the
 *           two velocity bytes launchMarioJump copies verbatim).
 */
import { MARIO_AIRBORNE, P1_INPUT } from "./ram.js";
import { launchMarioJump } from "./launchMarioJump.js";

/** P1_INPUT direction bits (ram.js: bit0 Right, bit1 Left, bit2 Up, bit3 Down). */
const INPUT_RIGHT = 0x01;
const INPUT_LEFT = 0x02;

/**
 * @param {import("../../machine.js").Machine} m
 */
export function initMarioJump(m) {
  const { mem } = m;

  // Switch Mario to the airborne (ballistic) branch of the movement machine.
  mem.write8(MARIO_AIRBORNE, 1);

  // Choose the horizontal launch velocity from the held direction. Big-endian
  // 16-bit: Right -> +0x0080, Left -> 0xFF80 (= -0x0080), neither -> 0x0000.
  // Right takes precedence when both are held (the oracle's first `rra` tests it).
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
