// SPDX-License-Identifier: GPL-3.0-only
/**
 * armMarioClimbAtLadderEnd — at a ladder end, stamp the ladder-standing pose and this frame's
 * climb-limit pair, ARMING a climb that the movement code may then perform.
 *
 * The Up/Down half of the ladder-collision handler, fallen into from its caller. It first gates on
 * the hammer state: unless MARIO_HAMMER_ACTIVE differs from 1, nothing happens. The hammer state
 * only FORBIDS the arm here — it never starts one.
 *
 * Then it derives two probes from Mario's position — a grid-aligned X (low two bits forced set, the
 * 0x04 bit forced clear) as the search key, and (Y + 8) as both the discriminator and the
 * climb-limit value — and looks the key up in the type-0 object-parameter table through a callee,
 * over at most TABLE_SCAN_COUNT entries. On a miss that callee double-unwinds and this routine
 * returns with it, doing nothing further.
 *
 * On a hit the lookup hands back a tag (which of the entry's two paired slots the discriminator
 * matched), the OTHER slot's byte, and the residual scan count. This routine then always:
 *   • stamps MARIO_SPRITE_CODE's low bits to LADDER_STANDING_POSE, keeping the facing bit. THIS IS
 *     THE STANDING POSE, not a climbing frame — the same code that is written when a climb ENDS,
 *     which is what makes "arms a climb" rather than "drives one" the honest reading; and
 *   • writes CLIMB_FLAG: 1 when the match was among the last few table entries (residual count at
 *     or below NEAR_END_OF_SCAN), else 0.
 * and branches on the tag:
 *   • tag 0 — commit the climb-limit pair the ordinary way (the slot byte into MARIO_CLIMB_LIMIT_A,
 *     (Y+8) into MARIO_CLIMB_LIMIT_B) through the commit callee, which then drives the Up-climb.
 *   • tag 1 with the flag set — nothing more this frame.
 *   • tag 1 with the flag clear — commit the SAME pair in the OPPOSITE order (MARIO_CLIMB_LIMIT_A
 *     takes (Y+8), MARIO_CLIMB_LIMIT_B takes the slot byte), then hand the frame to the Down/Up
 *     climb dispatch.
 *
 * The lookup key, the discriminator and the entry count are marshalled into registers because the
 * lookup takes a register-shaped interface, as does the commit callee (which reads the two limits
 * out of B and D).
 *
 * LIVE-OUT: memory only. The caller tail-returns this routine's result and consumes no register it
 * leaves behind.
 */

import {
  MARIO_HAMMER_ACTIVE,
  MARIO_X,
  MARIO_Y,
  MARIO_SPRITE_CODE,
  MARIO_CLIMB_LIMIT_A,
  MARIO_CLIMB_LIMIT_B,
} from "./names.js";
import { findOppositeLadderEnd } from "./findOppositeLadderEnd.js"; // object-table lookup, register-shaped
import { loc_1b4e } from "./loc_1b4e.js";                           // commit the limit pair, climb up
import { climbDownWhileHeld } from "./climbDownWhileHeld.js";       // Down/Up climb dispatch

// A shared board flag one cell below the climb-limit pair. It carries no registered name — two
// unrelated writers, and no single board settles what it means — so it stays a local constant.
const CLIMB_FLAG = 0x621a;

// How many object-parameter-table entries the lookup may scan before giving up.
const TABLE_SCAN_COUNT = 21;

// Mario's sprite code while STANDING at a ladder, in the low bits; the facing bit is preserved.
const LADDER_STANDING_POSE = 0x06;
const FACING_BIT = 0x80;

// A match with this many or fewer entries left to scan counts as "near the end of the table".
const NEAR_END_OF_SCAN = 4;

export function armMarioClimbAtLadderEnd(m) {
  const { regs, mem } = m;

  // Hammer gate: proceed only when the hammer state is not exactly 1.
  if (mem.read8(MARIO_HAMMER_ACTIVE) === 1) return;

  // Two probes from Mario's position: the (Y+8) climb-limit / discriminator, and a grid-aligned
  // X search key (low two bits set, the 0x04 bit cleared).
  const yLimit = (mem.read8(MARIO_Y) + 8) & 0xff;
  const searchKey = (mem.read8(MARIO_X) | 0x03) & 0xfb;

  // Look the key up in the type-0 object-parameter table. The lookup reads the key, the
  // discriminator and the entry count out of registers; on a miss it double-unwinds, so this
  // routine returns with it.
  regs.a = searchKey;
  regs.d = yLimit;
  regs.bc = TABLE_SCAN_COUNT;
  if (!findOppositeLadderEnd(m)) return; // key not in the table — unwound to the caller's caller

  // Hit: the lookup leaves the tag, the paired-slot byte, and the residual scan count.
  const tag = regs.a;
  const slotByte = regs.b;
  const residualCount = regs.c;

  // Stamp the ladder-STANDING pose, keeping the facing bit.
  mem.write8(MARIO_SPRITE_CODE, (mem.read8(MARIO_SPRITE_CODE) & FACING_BIT) | LADDER_STANDING_POSE);

  // Flag whether the match sat among the last few scanned entries.
  const nearEndOfScan = residualCount <= NEAR_END_OF_SCAN ? 1 : 0;
  mem.write8(CLIMB_FLAG, nearEndOfScan);

  if (tag === 0) {
    // Ordinary order: the commit callee takes the slot byte in B and (Y+8) in D, then climbs up.
    regs.b = slotByte;
    regs.d = yLimit;
    loc_1b4e(m);
    return;
  }

  // tag != 0: only continue when the match was NOT near the end of the scan.
  if (nearEndOfScan !== 0) return;

  // Commit the pair in the opposite order, then hand off to the Down/Up climb dispatch.
  mem.write8(MARIO_CLIMB_LIMIT_A, yLimit);
  mem.write8(MARIO_CLIMB_LIMIT_B, slotByte);
  climbDownWhileHeld(m);
}
