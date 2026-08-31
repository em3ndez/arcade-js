// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { queueSoundCommand11 } from "./queueSoundCommand11.js";
import { FLIP_SCREEN_FLAG, PROXIMITY_HIT_HANDLER } from "./names.js";
/**
 * testTargetPairOverlapAndClaimRecord — proximity/overlap test of one source object against one target/record pair. [seen]
 * ROM 0x5d68-0x5dc1.
 *
 * WHAT IT IS
 *   The innermost hit test of Pooyan's object-proximity collision scan. Each frame a scan driver
 *   (scanProximityTargetPairsAgainstSource, ROM 0x5d4d) walks a short list of target/record pairs
 *   and calls this once per pair, asking "is this target close enough to the source object to
 *   count as a hit?". The source object is the fixed sprite record the scan measures everything
 *   against (its screen X at +0, screen Y at +2); the target is the coordinate slot under test
 *   (its X at +0, Y at +2); the record is the object bookkeeping struct that gets re-seeded when
 *   the pair connects.
 *
 * ROLE IN THE MACHINE
 *   It is the per-pair overlap primitive. The record's own state byte gates whether the pair is
 *   even worth testing (two reserved state values skip it). "Close enough" means the target sits
 *   inside a narrow rectangular band around the source: within DX_LIMIT horizontally and inside
 *   the [DY_MIN, DY_MAX) vertical window, each measured after a small fixed box offset that lines
 *   the source's and target's coordinate origins up. That box offset flips with screen
 *   orientation, because a mirrored screen mirrors sprite coordinates too. A miss on either axis
 *   is reported as "keep scanning". A hit claims the struck record — clearing its state, stamping
 *   a few fields, and installing the post-hit handler pointer that will animate/retire the object
 *   on later frames — and queues the hit sound, then tells the driver to abort the whole scan so
 *   no further pair is tested this frame.
 *
 * LIVE-OUT: the boolean result only — true = no hit here, keep scanning; false = a hit was
 *   scored, abort the scan. No register survives to the caller. The only lasting effects are the
 *   record writes on a hit; a no-hit path leaves the target and record untouched.
 */

// The collision box and its hit window. The offsets are added to the SOURCE coordinates to build
// the box origin the target is then measured against; the limits define how tight the overlap
// must be for a hit.
const RECORD_EMPTY = 0x00; // record state that skips the test
const RECORD_RESERVED = 0x05; // record state that also skips the test
const OFFSET_X_UPRIGHT = 0xfc; // source-X box offset (-4) when the screen is upright
const OFFSET_X_FLIPPED = 0x05; // source-X box offset when the screen is flipped
const OFFSET_Y_FLIPPED = 0x10; // source-Y box offset when the screen is flipped
const DX_LIMIT = 0x04; // |dx| must be strictly under this
const DY_MIN = 0x09; // |dy| must be at least this
const DY_MAX = 0x0f; // |dy| must be strictly under this
const TARGET_Y_BIAS = 0x08; // added to the target Y before the dy compare

export function testTargetPairOverlapAndClaimRecord(m, source = m.regs.ix, target = m.regs.iy, record = m.regs.hl) {
  const { mem8 } = m;

  // Gate on the record's state byte (its field +0). Two state values — 0 (empty slot) and 5
  // (reserved) — mean this record is not a live collision candidate, so skip the test entirely
  // and report "keep scanning" without touching anything.
  const state = mem8[record];
  if (state === RECORD_EMPTY || state === RECORD_RESERVED) return true;

  // Choose the box offset from screen orientation. FLIP_SCREEN_FLAG (0x881f) is nonzero for an
  // upright cabinet and zero for a flipped (cocktail) screen. Flipping the screen mirrors sprite
  // coordinates, so the collision box has to be offset the opposite way: upright uses X offset
  // -4 with no Y shift; flipped uses X +5 and Y +0x10.
  let offX = OFFSET_X_UPRIGHT;
  let offY = 0x00;
  if (mem8[FLIP_SCREEN_FLAG] === 0) {
    offX = OFFSET_X_FLIPPED;
    offY = OFFSET_Y_FLIPPED;
  }

  // Build the box origin from the source object's screen coordinates (X at +0, Y at +2) plus the
  // orientation-dependent offset, wrapped to a byte the way the hardware coordinate math does.
  const boxX = (mem8[source] + offX) & 0xff;
  const boxY = (mem8[u16(source + 2)] + offY) & 0xff;

  // Horizontal test: take the target's X (its field +0), form the absolute distance to the box
  // origin, and require it strictly under DX_LIMIT (4). Anything wider is out of the box, so
  // report "keep scanning".
  const tx = mem8[target];
  let dx = (tx - boxX) & 0xff;
  if (tx < boxX) dx = (-dx) & 0xff; // absolute horizontal distance
  if (dx >= DX_LIMIT) return true;

  // Vertical test: the target's Y (field +2) is biased up by TARGET_Y_BIAS (8) before the compare
  // so the band sits offset from the source, then the absolute distance to the box origin must
  // land inside the window [DY_MIN, DY_MAX) — at least 9 and strictly under 0x0f. Too near or too
  // far on the vertical axis is a miss.
  const ty = (mem8[u16(target + 2)] + TARGET_Y_BIAS) & 0xff;
  let dy = (ty - boxY) & 0xff;
  if (ty < boxY) dy = (-dy) & 0xff; // absolute vertical distance
  if (dy < DY_MIN || dy >= DY_MAX) return true;

  // Hit: the target is inside the box on both axes. Claim the struck record by re-seeding its
  // fields — clear the state byte (+0) so it is no longer a live target, stamp +1/+2/+7 with the
  // post-hit sequence's seed values (0x01, 0x0c, 0x01), and install the proximity-hit handler
  // pointer (0x5dc2) little-endian into +0x12 (low byte) / +0x13 (high byte); that handler drives
  // the record's hit reaction on the following frames.
  mem8[record] = 0x00;
  mem8[u16(record + 1)] = 0x01;
  mem8[u16(record + 2)] = 0x0c;
  mem8[u16(record + 7)] = 0x01;
  mem8[u16(record + 0x12)] = PROXIMITY_HIT_HANDLER;
  mem8[u16(record + 0x13)] = (PROXIMITY_HIT_HANDLER >> 8);
  // Queue the hit report — sound command 0x11 — into the audio CPU's sound-command ring, then
  // return false so the scan driver aborts and tests no further pair this frame.
  queueSoundCommand11(m);
  return false;
}
