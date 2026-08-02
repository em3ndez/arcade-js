// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1bb2 — the airborne frame's head: snapshot Mario's pre-motion position, advance his
 * jump/fall arc one frame, then let the horizontal position gate steer him.  ROM 0x1BB2.
 *
 * The movement state machine (loc_1ac3) vectors here whenever MARIO_AIRBORNE is 1, i.e. on
 * every frame of a jump or a fall. Three things happen, in order:
 *
 *  1. MARIO_X and MARIO_Y are copied into MARIO_AIR_PREV_X / MARIO_AIR_PREV_Y, so this
 *     frame's *starting* position survives the motion below — the collision code reads that
 *     pair back to test the swept segment rather than only the new point.
 *  2. stepBallisticMotion integrates one frame of the arc: X drifts by the horizontal
 *     velocity, Y takes the vertical velocity plus the ramping gravity term.
 *  3. loc_241f classifies the NEW X (and Y, and the board parity) into its two-flag verdict,
 *     and the flags pick which way Mario is pushed for the rest of the frame:
 *       - first flag raised -> handled here: horizontal velocity is forced to +0.5 px/frame
 *                              (drift right) and the sprite's facing bit is set to face right;
 *       - otherwise         -> loc_1bf2, which mirrors that for the far-right edge (velocity
 *                              -0.5 px/frame, facing bit cleared) and otherwise leaves the
 *                              velocity alone.
 *     Both arms converge on loc_1bd8, the landing / fatal-fall tail.
 *
 * So the routine is the edge-steering half of the airborne frame: near the left boundary it
 * nudges Mario back inward, and it always leaves the pre-motion position where the collision
 * pass expects it.
 *
 * Mario's whole context block is addressed off its base (MARIO_ACTIVE, 0x6200), which this
 * routine loads and everything below it inherits. Both tails now have idiomatic files and are
 * called directly; the ABI they read from this routine is the block base and the position
 * gate's second verdict flag, which loc_241f leaves in the register bank.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1bb2.test.js.
 * GATE:     captured + crafted. 0x1BB2 IS naturally reachable — a plain 2000-frame attract
 *           run (no coin, no pokes) dispatches it 167x, once per airborne frame of the jumps
 *           the demo makes unaided, and every one of those real dispatches is replayed
 *           oracle-vs-candidate. Attract only ever produces the position gate's blocked
 *           verdict, though, so every real dispatch takes the loc_1bf2 arm; the
 *           fall-through arm (the velocity/facing write) is driven by CRAFTED entries — a
 *           real captured state with the position/velocity inputs poked identically on both
 *           sides so the post-motion X lands in the gate's far-left and in-band regions,
 *           plus the far-right and even-board entries and both sides of the landing tail's
 *           fatal-fall split. Every case runs the WHOLE tail cascade — frozen oracle on the
 *           reference side, the idiomatic tails plus their still-oracle remainder on this one
 *           — so a wrong hand-off (a missed snapshot, a wrong velocity byte, a stale facing
 *           bit, a flipped branch, a base the tails inherit wrong) surfaces as divergent RAM
 *           downstream rather than staying local. Compared on RAM − STACK_SCRATCH, pc, SP,
 *           the return value and the full register file except C. Teeth: four broken twins —
 *           snapshot taken after the motion instead of before, branch polarity inverted, the
 *           push-right velocity written leftward, and the facing bit cleared instead of set —
 *           each required to be caught at its own cell.
 * LIVE-OUT: memory, plus whatever the tail cascade leaves — and since both sides run that
 *           cascade to the same end point, the gate compares the whole register file after it
 *           rather than a hand-picked subset. This routine's own writes are MARIO_AIR_PREV_X,
 *           MARIO_AIR_PREV_Y, MARIO_AIR_VX_HI, MARIO_AIR_VX_LO and MARIO_SPRITE_CODE, on top
 *           of everything stepBallisticMotion and the tail cascade write. Two dead residues
 *           are excluded and named: C, which the frozen 0x239C leaves holding a velocity
 *           operand it loaded through BC and the idiomatic leaf (whose own gate declares B/C
 *           dead) does not; and the verdict register the oracle decrements to make its branch
 *           decision, which it then leaves holding that decremented value — loc_1bf2 reads
 *           only the OTHER verdict flag and recomputes the condition flags before anything
 *           looks at them, and the post-cascade register diff confirms nothing downstream
 *           reads either residue.
 * NAMES:    MARIO_ACTIVE (0x6200, also the base of Mario's context block), MARIO_X (0x6203),
 *           MARIO_Y (0x6205), MARIO_SPRITE_CODE (0x6207), MARIO_AIR_PREV_X (0x620B),
 *           MARIO_AIR_PREV_Y (0x620C), MARIO_AIR_VX_HI (0x6210), MARIO_AIR_VX_LO (0x6211) —
 *           all imported from ram.js. stepBallisticMotion (ROM 0x239C), loc_241f (0x241F),
 *           loc_1bf2 (0x1BF2) and loc_1bd8 (0x1BD8) are all direct-called; no address literal
 *           is left in the body.
 */

import {
  MARIO_ACTIVE,
  MARIO_X,
  MARIO_Y,
  MARIO_SPRITE_CODE,
  MARIO_AIR_PREV_X,
  MARIO_AIR_PREV_Y,
  MARIO_AIR_VX_HI,
  MARIO_AIR_VX_LO,
} from "./ram.js";
import { stepBallisticMotion } from "./stepBallisticMotion.js"; // ROM 0x239C
import { loc_241f } from "./loc_241f.js"; // ROM 0x241F
import { loc_1bf2 } from "./loc_1bf2.js"; // ROM 0x1BF2
import { loc_1bd8 } from "./loc_1bd8.js"; // ROM 0x1BD8

// Bit 7 of MARIO_SPRITE_CODE is the sprite's horizontal-flip bit: set = facing right.
const FACING_RIGHT = 0x80;

export function loc_1bb2(m) {
  const { regs, mem } = m;

  // Mario's context block is the record every step of this path works off; loc_1bf2 and the
  // routines below it inherit the base from here.
  regs.ix = MARIO_ACTIVE; // 0x6200 — base of Mario's context block

  // Snapshot where this frame started, before any motion — the collision pass reads it back.
  mem.write8(MARIO_AIR_PREV_X, mem.read8(MARIO_X));
  mem.write8(MARIO_AIR_PREV_Y, mem.read8(MARIO_Y));

  // Advance one frame of the ballistic arc, then classify the position it landed on. The
  // gate's second flag stays in the register bank for loc_1bf2, which is the only consumer.
  stepBallisticMotion(m);
  const { d: pushRight } = loc_241f(m);

  // Not the push-right verdict: hand over to the far-right-edge arm, which decides between
  // the mirrored left push and leaving the horizontal velocity untouched.
  if (pushRight !== 1) return loc_1bf2(m);

  // Push right: drift at +0.5 px/frame (the velocity is in 1/256 px units) and face right.
  mem.write8(MARIO_AIR_VX_HI, 0);
  mem.write8(MARIO_AIR_VX_LO, 128);
  mem.write8(MARIO_SPRITE_CODE, mem.read8(MARIO_SPRITE_CODE) | FACING_RIGHT);

  return loc_1bd8(m);
}
