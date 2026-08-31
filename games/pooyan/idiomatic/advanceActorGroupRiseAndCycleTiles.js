// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceActorToTopRowThenRetire } from "./advanceActorToTopRowThenRetire.js";
import { cycleActorGroupSpriteFramesOnTimer } from "./cycleActorGroupSpriteFramesOnTimer.js";
import { HUNTER_TABLE_BASE } from "./names.js";
/**
 * advanceActorGroupRiseAndCycleTiles — the per-frame update for a group of three
 * hunter actor records: creep each one up the screen, then animate the group.
 *
 * WHAT IT IS
 *   Pooyan's on-screen actors each own a fixed-size record (0x18 bytes) in the actor
 *   arena. The hunters travel the screen as a group of three adjacent records. This
 *   routine is that group's once-per-frame tick: it advances the three records' vertical
 *   positions and then steps their shared sprite-frame animation.
 *
 * ROLE IN THE MACHINE
 *   This is state 2 of the small actor-group state machine that owns the hunter group.
 *   State 0 (spawnActorGroupRecords, ROM 0x6505) seats the three records and seeds the
 *   frame-delay / blink-phase animation cells; state 2 — here — is the per-frame driver
 *   dispatched while the group's state selector is 2, i.e. the steady-state tick that runs
 *   on every following frame while the group is alive. Its two jobs run in order:
 *     1. RISE  — inch each still-idle record upward one sub-row at a time, retiring any
 *                record that reaches the top of the play field, then
 *     2. CYCLE — advance the group's blink / sprite-frame animation on a fixed cadence.
 *
 * ROM: 0x6666-0x667b.
 * Grounding: [seen].
 *
 * LIVE-OUT: memory only — the three records' updated positions and state, plus the shared
 * animation cells advanced by the cycle pass. Nothing is read back from a register.
 */

// The hunter group is three consecutive actor records. Records sit at descending
// addresses, so the group is walked backward — one 0x18-byte record per step.
const RECORD_COUNT = 3; //     the three hunter records that make up one group
const RECORD_STRIDE = -0x18; // one 0x18-byte actor record backward per step

export function advanceActorGroupRiseAndCycleTiles(m, ix = m.regs.ix) {
  // RISE PASS. Start at the group pointer handed in and visit all three records, stepping
  // one record backward (RECORD_STRIDE, -0x18) after each. On every record
  // advanceActorToTopRowThenRetire (ROM 0x667c) does the work: it acts only on a record
  // whose state byte is idle/rising, adds that record's per-frame step rate into its
  // fixed-point height, and — once the whole-row byte reaches the top play-field row —
  // retires the record so a higher-level sweep can reuse the slot. A record owned by a
  // different handler this frame (nonzero state byte) is left untouched.
  let record = ix;
  for (let i = 0; i < RECORD_COUNT; i++) {
    advanceActorToTopRowThenRetire(m, record);
    // Step to the next record in the group. Keep the pointer a 16-bit address so the walk
    // wraps within the address space exactly as the hardware's pointer arithmetic does.
    record = u16(record + RECORD_STRIDE);
  }
  // CYCLE PASS. Advance the group's shared sprite-frame animation. The target is always
  // the hunter group base HUNTER_TABLE_BASE (0x8c78), independent of the pointer the rise
  // pass was handed. cycleActorGroupSpriteFramesOnTimer (ROM 0x66a1) is countdown-gated:
  // most frames it just ticks a counter and returns, and only when that counter drains
  // does it flip the three records to the next of two sprite shapes — so the hunters blink
  // between frames on a fixed cadence rather than changing shape every tick.
  cycleActorGroupSpriteFramesOnTimer(m, HUNTER_TABLE_BASE);
}
