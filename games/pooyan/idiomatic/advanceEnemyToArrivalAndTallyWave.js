// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import {
  WAVE_ARRIVAL_COUNTER,
  ACTIVE_ENEMY_COUNT,
  WAVE_PROGRESS_COUNTER,
  LANE_RESET_LATCH,
  loc_8d76,
  LANE_SPAWN_COUNTDOWN,
  LAUNCH_ARM_LATCH,
  SCRIPT_ADVANCE_GUARD,
  SLOT_SWEEP_LATCH,
  ENEMY_SPAWN_TIMER,
  FLIP_SCREEN_FLAG,
  STAGE_COUNTDOWN,
  STATE0_CKSUM_BASE,
  TAMPER_STRIKES_STATE0,
} from "./names.js";
/**
 * advanceEnemyToArrivalAndTallyWave — one attack-wave object's per-frame state handler.
 *
 * WHAT IT IS
 *   The per-frame update for a single enemy/object record while it is travelling toward its
 *   arrival point in the current attack wave. It is one branch of the object state machine:
 *   the object state dispatcher selects this handler by the record's state field and calls it
 *   once per frame with the record base in `rec`. ROM 0x3be3-0x3c91. Grounding tag: [seen].
 *
 * THE RECORD
 *   `rec` points at one object record inside a stride-0x18 actor array (the object/enemy pools
 *   based at ACTOR_TABLE 0x8a80 / SPAWN_OBJECT_TABLE 0x8c48). The fields this handler touches
 *   are the sub-position (+0x05), the row/cell counter (+0x06), the band-kind selector (+0x07),
 *   the mode flag (+0x08), the free-run step (+0x09), the homing velocity (+0x0a), and a pointer
 *   (+0x14/+0x15) to a second, "linked" record that shadows this one on screen.
 *
 * WHAT IT DOES, IN ORDER
 *   1. Ticks the record's own sprite-animation stream so the actor keeps animating either way.
 *   2. Moves the record toward arrival, in one of two modes chosen by the record's mode flag:
 *        - homing: step the sub-position by the record's velocity, nudge the row counter down on
 *          an 8-bit borrow, and mirror the new position+row into the linked record so the two
 *          stay in lockstep on screen;
 *        - free-run: step the sub-position by a fixed increment, carrying into the row counter on
 *          8-bit overflow.
 *      Either mode "arrives" once the row counter hits the arrival mark.
 *   3. On arrival it bumps the wave-arrival (0x8903), active-enemy (0x8d40) and wave-progress
 *      (0x8d7d) tallies, then blanks the record's on-screen sprite band.
 *   4. For records whose band-kind field carries a set high nibble it additionally runs the
 *      once-per-cycle lane reset: guarded by a one-shot latch (0x8d7e) and a small arrival
 *      counter (0x8d76), it clears the lane-spawn machinery and re-seeds the spawn timer, then
 *      runs an anti-tamper integrity probe over a fixed program-memory window and bumps the
 *      state-0 tamper-strike slot (0x89ed) if the running sum misses its sentinel.
 *
 * LIVE-OUT: none consumed (memory only). Every callee is memory-only and the object state
 * dispatcher does not read a result register back, so the scratch registers and flags this
 * handler leaves behind are not part of its contract.
 */

// Record field offsets (bytes from the record base `rec`) and the two mirrored fields of the
// linked record. The record layout is shared across the object pools, so these offsets match the
// fields other object handlers read/write on the same records.
const MODE_FLAG = 0x08; //     record: bit0 selects homing vs free-run
const POSITION = 0x05; //      record: 8-bit sub-position advanced each tick
const ROW = 0x06; //           record: row/cell counter; gates arrival
const FREE_STEP = 0x09; //     record: free-run per-tick step
const HOMING_VEL = 0x0a; //    record: homing velocity (added; negated for the row test)
const BAND_KIND = 0x07; //     record: high nibble selects blank-only vs the full lane reset
const LINK_LO = 0x14; //       record: linked-record pointer low byte
const LINK_HI = 0x15; //       record: linked-record pointer high byte
const LINK_POSITION = 0x05; // linked record: mirrored position
const LINK_ROW = 0x06; //      linked record: mirrored row counter

// Bit masks, arrival marks, and the reset/integrity magic numbers.
const MODE_HOMING = 0x01; //   mode-flag bit selecting the homing path
const ROW_MASK = 0x1f; //      homing arrival: (row & this) == 0
const ARRIVAL_ROW = 0x1f; //   free-run arrival: row >= this
const HIGH_NIBBLE = 0xf0; //   band-kind gate for the lane reset
const BYTE = 0xff; //          8-bit wrap for computed intermediates
const RESET_READY = 0x02; //   the reset runs once the arrival counter reaches this
const SPAWN_RESEED = 0x02; //  value seeded into the spawn timer and the reset latch
const STAGE_GUARD = 0x10; //   the integrity check is skipped while the stage countdown is >= this
const CKSUM_LEN = 0x12; //     bytes summed by the integrity check
const CKSUM_SENTINEL = 0x55; // expected running sum; a miss bumps the strike slot

export function advanceEnemyToArrivalAndTallyWave(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — animation tick. Advance this record's own {tile,colour,delay} animation stream so
  // the sprite keeps animating regardless of which movement branch runs below. Every per-frame
  // object handler leads with this.
  advanceObjectAnimationFrame(m, rec); // tick the record's animation stream

  // Step 2 — move toward arrival. The record's mode flag (rec+0x08) bit0 picks the path, and
  // `arrived` records whether the row counter has reached its arrival mark this frame.
  let arrived;
  if ((mem8[rec + MODE_FLAG] & MODE_HOMING) !== 0) {
    // Homing path. The sub-position (rec+0x05) is stepped by the record's velocity (rec+0x0a).
    // The row counter (rec+0x06) drops by one whenever the position is below the negated
    // velocity — i.e. adding the velocity is about to wrap the 8-bit position past zero, a borrow
    // into the next row. The freshly advanced position and the current row are then written into
    // the linked record (pointer at rec+0x14/0x15) at its own +0x05/+0x06 so the two records
    // travel together on screen. Arrival here is (row & 0x1f) == 0.
    const vel = mem8[rec + HOMING_VEL];
    const negVel = (-vel) & BYTE;
    const pos = mem8[rec + POSITION];
    if (pos < negVel) mem8[rec + ROW] = mem8[rec + ROW] - 1;
    const newPos = (pos + vel) & BYTE;
    mem8[rec + POSITION] = newPos;
    const link = mem8[rec + LINK_LO] | (mem8[rec + LINK_HI] << 8);
    mem8[u16(link + LINK_POSITION)] = newPos;
    mem8[u16(link + LINK_ROW)] = mem8[rec + ROW];
    arrived = (mem8[rec + ROW] & ROW_MASK) === 0;
  } else {
    // Free-run path. The sub-position (rec+0x05) is stepped by a fixed increment (rec+0x09); an
    // 8-bit overflow of that add carries one into the row counter (rec+0x06). No linked record is
    // touched here. Arrival is row >= 0x1f.
    const sum = mem8[rec + POSITION] + mem8[rec + FREE_STEP];
    if (sum > BYTE) mem8[rec + ROW] = mem8[rec + ROW] + 1;
    mem8[rec + POSITION] = sum;
    arrived = mem8[rec + ROW] >= ARRIVAL_ROW;
  }
  // Not there yet: leave the record to keep advancing on later frames.
  if (!arrived) return;

  // Step 3 — arrival tallies. One object has reached its lane, so update the three wave counters:
  //   WAVE_ARRIVAL_COUNTER (0x8903): per-stage arrival count; bounds the rope-segment count and
  //                                  its parity selects a spawn variant.
  //   ACTIVE_ENEMY_COUNT   (0x8d40): one fewer live enemy in the wave.
  //   WAVE_PROGRESS_COUNTER(0x8d7d): arrival/progress counter that ramps enemy-fire aggressiveness
  //                                  and gates the later wave phases.
  mem8[WAVE_ARRIVAL_COUNTER] = mem8[WAVE_ARRIVAL_COUNTER] + 1;
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] - 1;
  mem8[WAVE_PROGRESS_COUNTER] = mem8[WAVE_PROGRESS_COUNTER] + 1;

  // Step 4 — band-kind branch. The band-kind field (rec+0x07) high nibble decides how much
  // teardown the arrival triggers. A clear high nibble means "blank only": erase the record's
  // on-screen sprite band (blankActorSpriteBand zeroes 0x17 bytes from the record base) and stop.
  if ((mem8[rec + BAND_KIND] & HIGH_NIBBLE) === 0) return blankActorSpriteBand(m, rec);
  // A set high nibble means the same blank, then fall through to the once-per-cycle lane reset.
  blankActorSpriteBand(m, rec); // blank the record's sprite band, then run the gated lane reset

  // Step 5 — arm the reset once. LANE_RESET_LATCH (0x8d7e) is a one-shot: while it is nonzero the
  // reset has already fired this cycle, so bail. Otherwise bump the small arrival counter at
  // 0x8d76 and wait for it to reach RESET_READY (2) — the reset fires on the second qualifying
  // arrival, not the first.
  if (mem8[LANE_RESET_LATCH] !== 0) return;
  mem8[loc_8d76] = mem8[loc_8d76] + 1;
  if (mem8[loc_8d76] < RESET_READY) return;

  // Step 6 — the lane reset. Clear the lane-spawn machinery so the next lane sequence starts
  // clean, re-seed the spawn cadence, and arm the one-shot latch so this reset will not re-run:
  //   LANE_SPAWN_COUNTDOWN (0x8d75): lane-spawn sequence countdown -> 0.
  //   LAUNCH_ARM_LATCH     (0x8f20): arrow/rope launch arm latch  -> 0.
  //   SCRIPT_ADVANCE_GUARD (0x8d6d): board-script advance guard    -> 0.
  //   SLOT_SWEEP_LATCH     (0x8d6e): slot-sweep one-shot latch     -> 0.
  //   ENEMY_SPAWN_TIMER    (0x8d07): spawn-cadence countdown       -> 2 (re-seed).
  //   LANE_RESET_LATCH     (0x8d7e): this reset's one-shot         -> 2 (armed; blocks re-run).
  mem8[LANE_SPAWN_COUNTDOWN] = 0;
  mem8[LAUNCH_ARM_LATCH] = 0;
  mem8[SCRIPT_ADVANCE_GUARD] = 0;
  mem8[SLOT_SWEEP_LATCH] = 0;
  mem8[ENEMY_SPAWN_TIMER] = SPAWN_RESEED;
  mem8[LANE_RESET_LATCH] = SPAWN_RESEED;

  // Step 7 — the anti-tamper integrity probe, doubly gated. This is one of the ROM's hidden
  // integrity tripwires: it sums a fixed program-memory window and cross-checks it against a
  // stored sentinel, tripping a strike counter on a mismatch — a condition a faithful ROM never
  // reaches. Two gates keep it out of the way of ordinary play:
  //   - FLIP_SCREEN_FLAG (0x881f): the check is reached only while this reads zero. That cell
  //     holds its set value for the normal upright orientation and reads zero for the mirrored
  //     orientation, so ordinary upright play returns here and never sums the window.
  //   - STAGE_COUNTDOWN (0x8901): the check is skipped while the stage countdown is still >= 0x10,
  //     so it can only run once a stage has nearly wound down.
  if (mem8[FLIP_SCREEN_FLAG] !== 0) return; // skip unless the orientation flag reads zero
  if (mem8[STAGE_COUNTDOWN] >= STAGE_GUARD) return; // only while the stage countdown is low

  // Sum CKSUM_LEN (0x12) program-memory bytes descending from STATE0_CKSUM_BASE (0x01d5), keeping
  // the running total to 8 bits. If it lands on the sentinel 0x55 the image is intact and we stop;
  // otherwise bump the state-0 tamper-strike slot (0x89ed), which downstream logic reads to freeze
  // the machine against a tampered ROM.
  let sum = 0;
  for (let i = 0; i < CKSUM_LEN; i++) sum = (sum + mem8[STATE0_CKSUM_BASE - i]) & BYTE;
  if (sum === CKSUM_SENTINEL) return;
  mem8[TAMPER_STRIKES_STATE0] = mem8[TAMPER_STRIKES_STATE0] + 1;
}
