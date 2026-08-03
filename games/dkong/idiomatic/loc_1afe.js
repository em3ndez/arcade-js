// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1afe — hammer-climb collision: look Mario's grid cell up in the object-parameter
 * table and, on a hit, commit this frame's climb-limit pair and drive the climb.  ROM 0x1AFE.
 *
 * The Up/Down half of the ladder-collision handler (fallen into from loc_1af5). It first
 * gates on the hammer state: unless MARIO_HAMMER_ACTIVE differs from 1 it does nothing.
 *
 * Then it derives two probes from Mario's position — a grid-aligned X (low two bits forced
 * set, the 0x04 bit forced clear) as the search key, and (Y + 8) as the discriminator /
 * climb-limit value — and looks the key up in the type-0 object-parameter table via loc_236e
 * (up to 21 entries). If the key is not found, loc_236e double-unwinds and this routine
 * returns with it (the `if (!loc_236e(m)) return;` idiom), doing nothing further.
 *
 * On a hit, loc_236e hands back a tag (which of the entry's two paired slots the discriminator
 * matched), the OTHER slot's byte, and the residual scan count. This routine then always:
 *   • stamps the climb sprite code into MARIO_SPRITE_CODE — low bits 0x06, facing bit (0x80)
 *     preserved; and
 *   • writes a one-byte flag at 0x621A: 1 when the match was among the last few table entries
 *     (residual count <= 4), else 0.
 * and branches on the tag:
 *   • tag 0 — commit the climb-limit pair the ordinary way (loc_1b4e stores the slot byte into
 *     MARIO_CLIMB_LIMIT_A and (Y+8) into MARIO_CLIMB_LIMIT_B) and drive the Up-climb.
 *   • tag 1, flag != 0 — nothing more this frame; return.
 *   • tag 1, flag == 0 — commit the SAME pair in the OPPOSITE order (MARIO_CLIMB_LIMIT_A <-
 *     (Y+8), MARIO_CLIMB_LIMIT_B <- slot byte), then hand the frame to the Down/Up climb
 *     dispatch (climbDownWhileHeld). loc_1b4e documents this swapped-order sibling.
 *
 * Name: kept the neutral loc_ — the mechanism is pinned to the oracle, but the object-table
 * lookup's game meaning (which climb obstacle it resolves) is not confirmed to the name bar.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1afe.test.js.
 * GATE:     captured + crafted. 0x1AFE is dispatched every hammer-climb frame during attract,
 *           so real captures cover the hammer-gate early-out, the tag-0 arm (-> loc_1b4e), and
 *           the tag-1/flag-0 arm (-> climbDownWhileHeld); crafted entries (a controlled table
 *           planted in a real base) drive the not-found MISS and the tag-1/flag-1 return arm.
 *           Compared over RAM − STACK_SCRATCH + pc + SP; the dead stack the dissolved
 *           call/push-af/tail-call churn writes is excluded. Every path nets exactly one caller
 *           return, modelled with a single m.ret() on the candidate. Teeth: a wrong sprite-code
 *           twin and a swapped climb-limit-order twin.
 * LIVE-OUT: memory-only — the caller (loc_1af5) tail-returns this routine's result and consumes
 *           no register it leaves; the oracle's residual registers/flags, its push-af/pop-af
 *           bracket, and its terminal returns are dead ABI.
 * NAMES:    MARIO_HAMMER_ACTIVE (0x6217), MARIO_X (0x6203), MARIO_Y (0x6205),
 *           MARIO_SPRITE_CODE (0x6207), MARIO_CLIMB_LIMIT_A (0x621B), MARIO_CLIMB_LIMIT_B
 *           (0x621C) from ram.js. 0x621A carries no ram.js name (a shared board flag,
 *           deliberately left hex there) — kept as a hex literal + comment. The lookup key,
 *           discriminator, and entry count are marshalled into registers for loc_236e, which is
 *           a genuine oracle boundary (register-shaped interface); loc_1b4e likewise reads the
 *           two limits from registers B and D.
 */

import {
  MARIO_HAMMER_ACTIVE,
  MARIO_X,
  MARIO_Y,
  MARIO_SPRITE_CODE,
  MARIO_CLIMB_LIMIT_A,
  MARIO_CLIMB_LIMIT_B,
} from "./ram.js";
import { loc_236e } from "./loc_236e.js";                 // ROM 0x236E — object-table lookup (oracle boundary)
import { loc_1b4e } from "./loc_1b4e.js";                 // ROM 0x1B4E — commit limit pair, climb up
import { climbDownWhileHeld } from "./climbDownWhileHeld.js"; // ROM 0x1B38 — Down/Up climb dispatch

// A shared board flag one cell below the climb-limit pair; deliberately unnamed in ram.js
// (two unrelated writers, no single board settles it) — kept hex per that decision.
const CLIMB_FLAG = 0x621a;

// How many object-parameter-table entries loc_236e may scan before giving up.
const TABLE_SCAN_COUNT = 21;

export function loc_1afe(m) {
  const { regs, mem } = m;

  // Hammer gate: proceed only when the hammer state is not exactly 1.
  if (mem.read8(MARIO_HAMMER_ACTIVE) === 1) return;

  // Two probes from Mario's position: the (Y+8) climb-limit / discriminator, and a grid-aligned
  // X search key (low two bits set, the 0x04 bit cleared).
  const yLimit = (mem.read8(MARIO_Y) + 8) & 0xff;
  const searchKey = (mem.read8(MARIO_X) | 0x03) & 0xfb;

  // Look the key up in the type-0 object-parameter table. loc_236e reads the key, the
  // discriminator, and the entry count from registers (oracle boundary); on a miss it
  // double-unwinds, so this routine returns with it.
  regs.a = searchKey;
  regs.d = yLimit;
  regs.bc = TABLE_SCAN_COUNT;
  if (!loc_236e(m)) return; // key not in the table — unwound to the caller's caller

  // Hit: loc_236e leaves the tag, the paired-slot byte, and the residual scan count.
  const tag = regs.a;
  const slotByte = regs.b;
  const residualCount = regs.c;

  // Stamp the climb sprite code (low bits 0x06), keeping the facing bit (0x80).
  mem.write8(MARIO_SPRITE_CODE, (mem.read8(MARIO_SPRITE_CODE) & 0x80) | 0x06);

  // Flag whether the match sat among the last few scanned entries.
  const nearEndOfScan = residualCount <= 4 ? 1 : 0;
  mem.write8(CLIMB_FLAG, nearEndOfScan);

  if (tag === 0) {
    // Ordinary order: loc_1b4e stores the slot byte -> A, (Y+8) -> B, then drives the Up-climb.
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
