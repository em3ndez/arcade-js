// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1bd8 — re-base Mario's vertical arc at the point he is standing on now, unless the
 * fall he is in has already been condemned as lethal.  ROM 0x1BD8.
 *
 * Reached only from the airborne handler's two screen-edge arms (loc_1bb2 and loc_1bf2): the
 * horizontal position gate has just reported that Mario is airborne at the left or right
 * limit, and the arm that got here has already stamped a fresh horizontal velocity pushing
 * him back inside plus the matching facing bit. What is left is the vertical half of the
 * reflection, and that is this routine.
 *
 * The ballistic integrator stores a vertical arc as a CONSTANT launch velocity plus a count
 * of frames elapsed, and each frame moves Mario down by (16·frames + 8 − velocity) — so the
 * velocity field alone is not the current speed, it is the speed the arc started with. To
 * change direction mid-arc the game therefore cannot just negate a field; it has to fold the
 * elapsed frames back into the velocity. That is what happens here: the new velocity becomes
 * 16·frames − velocity and the frame count restarts at zero, which re-bases the same parabola
 * at Mario's present position with its vertical step negated (plus the one gravity increment
 * the restarted counter re-applies).
 *
 * The arithmetic itself is the shared leaf loc_2407, which spreads a packed byte into a
 * fixed-point value and subtracts the record's 16-bit field. For Mario's record the packed
 * byte is the plain airborne-frame counter, and that spread is exactly a ×16 scale for every
 * byte value, so the difference loc_2407 hands back is precisely 16·frames − velocity.
 *
 * A fall already latched as lethal (MARIO_FATAL_FALL) is exempt: the re-basing is skipped
 * entirely, so a killing fall keeps its arc and lands, rather than being bounced back up by
 * the edge. Observed in a driven 1P game — with Mario held against the left edge, an ordinary
 * jump's stored velocity alternates +0x0148 / −0x0138 and his height oscillates between
 * 0xEEC0 and 0xF150 instead of descending, while the same run with the fatal-fall latch set
 * leaves both velocity and frame count untouched and he continues down.
 *
 * The record base: both entries reach here with the object pointer set to Mario's block
 * (loc_1bb2 loads it at ROM 0x1BB6 and loc_1bf2 is only entered from loc_1bb2 with it still
 * loaded, and no other site in the ROM reaches 0x1BD8 — every captured dispatch confirms it),
 * so the three record fields this routine writes ARE the absolute cells MARIO_AIR_VY_HI/LO and
 * MARIO_AIR_FRAMES and are named as such. loc_2407 stays pointer-relative because its other
 * two callers work on different records; it reads the same three bytes through the pointer the
 * caller left set, which the idiomatic loc_1bb2 sets exactly as the oracle did.
 *
 * The tail (loc_1bec) runs the ballistic step and the rest of the airborne cascade for this
 * frame, on both arms. It landed idiomatic in this same batch, so it is direct-called; the
 * gate still measures this routine against the whole frozen oracle chain, so the composition
 * — this routine plus that tail — is what is proven equivalent, not just this routine's own
 * three stores.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1bd8.test.js.
 * GATE:     captured + crafted + fuzz. NOT reachable in attract — 6000 attract frames
 *           dispatch the airborne handler 360× and this routine 0×, because the demo never
 *           jumps at the horizontal limit — so the captures come from a DRIVEN 1P game
 *           (coin + start + a held jump, with MARIO_X poked to the edge exactly as the
 *           repo's gameplay tapes poke position): 63 real left-edge dispatches on the
 *           re-base arm, 65 on the right edge, and 11 on the fatal-fall skip arm from a run
 *           where the fall is condemned first. A crafted sweep over the branch byte and a
 *           seeded fuzz over the velocity/frame fields (including the 16-bit borrow wrap)
 *           cover the value space the driven run does not span. Teeth: an inverted skip
 *           test, a dropped frame-count reset, and a swapped velocity byte order.
 * LIVE-OUT: memory-only — MARIO_AIR_VY_HI, MARIO_AIR_VY_LO and MARIO_AIR_FRAMES, plus
 *           everything the shared tail writes, and the tail's own return value forwarded
 *           (the airborne cascade's callers propagate it). The registers the oracle leaves
 *           behind are dead: the tail's first act is the ballistic step, which rewrites the
 *           pair loc_2407 produced and reads no other register, and the handler after it
 *           reloads from memory before any read.
 * NAMES:    MARIO_FATAL_FALL (0x6220), MARIO_AIR_VY_HI (0x6212), MARIO_AIR_VY_LO (0x6213),
 *           MARIO_AIR_FRAMES (0x6214) — all from ram.js. Both callees, loc_2407 (ROM 0x2407)
 *           and the tail loc_1bec (ROM 0x1BEC), are idiomatic and direct-called; no address
 *           dispatch and no stack modelling remain in this routine.
 */

import {
  MARIO_FATAL_FALL,
  MARIO_AIR_VY_HI,
  MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES,
} from "./ram.js";
import { loc_2407 } from "./loc_2407.js"; // ROM 0x2407
import { loc_1bec } from "./loc_1bec.js"; // ROM 0x1BEC

export function loc_1bd8(m) {
  const { mem } = m;

  // A fall already condemned as lethal keeps its arc — no re-basing, straight to the tail.
  if (mem.read8(MARIO_FATAL_FALL) !== 1) {
    // 16·(airborne frames) − (stored launch velocity): the current vertical step, negated.
    const rebasedVelocity = loc_2407(m);
    mem.write8(MARIO_AIR_VY_HI, rebasedVelocity >> 8);
    mem.write8(MARIO_AIR_VY_LO, rebasedVelocity); // the store truncates to the low byte
    mem.write8(MARIO_AIR_FRAMES, 0); // restart the arc's frame count at the present point
  }

  // Shared tail: the ballistic step for this frame and the rest of the airborne cascade.
  // (The frozen oracle threads its caller's record-pointer helper down this tail; nothing
  // downstream reads it — the frozen tail only forwards it to the airborne handler, which
  // ignores it — so it is not threaded here.)
  return loc_1bec(m);
}
