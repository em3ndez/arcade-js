// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_23eb  —  ROM 0x23EB  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   One step of the home-bay slot cursor. Frogger's board ends in five home bays across the top row;
 *   while a bay sits empty it is not blank — an animated creature (the fly bonus or a crocodile) cycles
 *   through the still-empty bays, one bay at a time. Which bay is "active" in that animation is chosen by
 *   a rotating cursor, HOME_BAY_SLOT_CURSOR (0x8123), and THIS routine is the tick that rotates it:
 *   increment by one, wrap back to 0 when it reaches 6. The cursor therefore cycles 0,1,2,3,4,5,0,1,…
 *   Values 1..5 are a 1-based home-bay index; value 0 is a rest phase where nothing is stamped. (Despite
 *   the old translated comment, this is a home-bay slot index, not a river/scroll phase — grounded.)
 *
 * WHERE IT SITS
 *   Ticked once per in-play frame from the collision/input orchestrator orchestrateCollisionsAndFrogInput
 *   (0x1a55). It is also stepped by scanFrogInputAndDispatchHop while the hop-input lock timer
 *   FROG_HOP_INPUT_TIMER (0x8268) counts down, and by animateFrogHop on the UP-hop path. Downstream, the
 *   home-bay stampers read the cursor as their 1..5 slot index: stampHomeBayFly (0x23fa),
 *   stampHomeBayGatorEmerging (0x2496), and their siblings each pick the bay to draw a creature into from
 *   this cell.
 *
 * LIVE-OUT
 *   Memory (the counter cell HOME_BAY_SLOT_CURSOR 0x8123) AND register A (the new counter value). Most
 *   callers reload A and ignore the return, but animateFrogHop reaches this on a tail path that leaves
 *   the counter in A, so A is a genuine live output — not scratch. The equivalence-23eb test compares A
 *   as well as RAM for exactly that reason.
 */
import { HOME_BAY_SLOT_CURSOR } from "./names.js";

// Length of the cursor cycle: it rotates through six values (0..5) and wraps at 6. This is the CP 0x06
// threshold the ROM tests at 0x23f2 — the number of animation phases, five bays plus one rest phase.
const SLOT_CYCLE = 6;

export function loc_23eb(m) {
  const { regs, mem8 } = m;

  // ── Read and increment ───────────────────────────────────────────────────────────────
  // The ROM loads the cursor into A (LD A,(0x8123) at 0x23eb) and bumps it (INC A at 0x23ee). The & 0xff
  // reproduces the Z80's 8-bit wrap: from 0xff the counter rolls to 0. This raw counter+1 is both the
  // candidate new value and what the ROM next compares against the cycle length.
  const incremented = (mem8[HOME_BAY_SLOT_CURSOR] + 1) & 0xff;

  // ── Mod-6 wrap ───────────────────────────────────────────────────────────────────────
  // The ROM compares the incremented value against 6 (CP 0x06 at 0x23f2). If it is still below 6 the
  // value stands; the moment it reaches 6 the ROM zeroes A (XOR A at 0x23f5), rolling the cursor back to
  // the rest phase. So the cursor sweeps 1..5 across the five bays, then 0, then repeats.
  const wrapped = incremented < SLOT_CYCLE ? incremented : 0;

  // ── Store the new cursor ───────────────────────────────────────────────────────────────
  // Write the rotated value back to HOME_BAY_SLOT_CURSOR (0x8123) so the home-bay stampers pick it up
  // this frame. (The ROM writes the cell twice — the pre-wrap value at 0x23ef, then 0 at 0x23f6 on the
  // wrap branch — but only the final value is observable, and this single write reproduces it.)
  mem8[HOME_BAY_SLOT_CURSOR] = wrapped;

  // ── Return the new value in A ────────────────────────────────────────────────────────
  // Hand the new cursor back in register A for the tail-path caller (animateFrogHop) that reads it.
  return (regs.a = wrapped);
}
