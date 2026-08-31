// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6435 } from "./loc_6435.js";
import { PLAY_MODE_LATCH, ROUND_COUNTER, SPRITE_ACTOR_RECORD_SLOTS } from "./names.js";

// ---------------------------------------------------------------------------
// Two-pass tuning constants.
//
// The driver runs the per-actor proximity scan (loc_6435) PASSES (2) times per
// frame, once for each of two adjacent actor coordinate boxes. Between passes it
// walks the actor pointer forward one coordinate slot — ACTOR_STRIDE (4 bytes,
// the stride of the stride-4 sprite coordinate slots) — and swaps the pass
// selector from 0 to PASS2_SELECTOR (4). The selector rides into the scan as its
// slot-parity input: the scan uses it to pick which of the two per-slot hit
// flags (0x8d1b / 0x8d1c) it raises when this box collides with an object, so
// the two boxes report their hits into distinct cells.
// ---------------------------------------------------------------------------
const PASSES = 2; // the actor record is scanned twice
const ACTOR_STRIDE = 0x04; // bytes between the two actor coordinate boxes
const PASS2_SELECTOR = 0x04; // slot-parity selector handed to the second pass

/**
 * scanActorCollisionsBothSlots — two-pass actor collision driver.
 *
 * WHAT IT IS
 *   ROM 0x6404-0x6428. One frame's collision check for the actor box against the
 *   spawned-object / projectile bank, run twice — once per adjacent coordinate
 *   box. It is one of the per-record collision passes fired in fixed order by the
 *   master actor updater each frame; the heavy lifting is in the per-actor scan
 *   loc_6435, and this routine is just the guarded two-pass wrapper around it.
 *
 * ROLE IN THE MACHINE
 *   Enemies and objects are killed when a shot/actor box overlaps them. This
 *   driver walks the actor's own coordinate record (screen X at +0, Y at +2)
 *   past two neighbouring boxes and hands each to loc_6435, which tests that box
 *   against up to three live objects and, on the first overlap, tears the struck
 *   object down and tallies the hit. A collision in either pass aborts the whole
 *   driver for the frame, so the remaining box goes unscanned once something is
 *   hit.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT: none — the caller resumes on its own state; only the scan's memory
 * effects remain (the struck object's record, the raised per-slot hit flag, the
 * bumped hit tally, and the queued sound/display effects, all written by loc_6435).
 */
export function scanActorCollisionsBothSlots(m) {
  const { mem8 } = m;

  // Activity guard. The scan runs whenever PLAY_MODE_LATCH (0x8f50) is set (an
  // active gameplay sub-mode forces collision handling regardless of round).
  // With the latch clear the scan runs only on even rounds: bit 0 of ROUND_COUNTER
  // (0x8907) selects the stage-type/facing variant, and on odd rounds (bit 0 set)
  // with the latch clear there is no actor box to test this frame, so bail.
  if (mem8[PLAY_MODE_LATCH] === 0 && (mem8[ROUND_COUNTER] & 0x01) !== 0) return;

  // Point at the first actor coordinate box — the base of the stride-4 actor
  // record slots SPRITE_ACTOR_RECORD_SLOTS (0x8848) inside the sprite display
  // list — and start pass 1 with selector 0 (first-slot hit-flag parity).
  let actor = SPRITE_ACTOR_RECORD_SLOTS;
  let selector = 0x00;
  for (let pass = 0; pass < PASSES; pass++) {
    // Scan this actor box against the object bank. loc_6435 returns true when
    // nothing was in range (keep sweeping) and false when it hit — a hit runs
    // the object teardown, which ends in the terminator guard that always
    // reports false and unwinds the frame. Propagate that: abort the driver and
    // leave the second box unscanned.
    if (!loc_6435(m, actor, selector)) return; // collision -> abort the driver
    // Advance to the neighbouring box (one coordinate slot on) and switch to the
    // second-pass selector so the next box records its hit into the other
    // per-slot flag cell.
    actor = u16(actor + ACTOR_STRIDE);
    selector = PASS2_SELECTOR;
  }
}
