// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_4006 } from "./loc_4006.js";
import { loc_3553 } from "./loc_3553.js";
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
 * loc_3be3 — object state-0 handler.
 *
 * First ticks the record's animation stream. When the record's mode flag bit0 is set it homes:
 * the position advances by the record's velocity, and the row counter is nudged down when the
 * position falls below the negated velocity; the new position and row are mirrored into the linked
 * record addressed by the record's pointer field. When bit0 is clear it free-runs: the position
 * advances by the fixed step, carrying into the row counter on overflow. Either way it "arrives"
 * once the row counter reaches the arrival mark.
 *
 * On arrival it bumps the wave-arrival, active-enemy and wave-progress tallies, then blanks the
 * record's sprite band. If the record's band-kind field has a set high nibble it also runs the
 * gated lane reset: guarded by a one-shot latch and an arrival counter, it zeroes the lane spawn
 * countdown and its companion latches, re-seeds the spawn timer, and — while the screen is upright
 * and the stage countdown is still low — sums a fixed code window and bumps the tamper-strike slot
 * unless the running sum matches its sentinel.
 *
 * LIVE-OUT: none consumed (memory only). Every callee is memory-only and the state dispatcher does
 * not read a result register back, so the scratch registers and flags are not part of the contract.
 */

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

export function loc_3be3(m, rec = m.regs.ix) {
  const { mem8 } = m;

  loc_4006(m, rec); // tick the record's animation stream

  let arrived;
  if ((mem8[rec + MODE_FLAG] & MODE_HOMING) !== 0) {
    // home toward a target and mirror the result into the linked record
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
    // free-run: advance by the fixed step, carrying into the row counter
    const sum = mem8[rec + POSITION] + mem8[rec + FREE_STEP];
    if (sum > BYTE) mem8[rec + ROW] = mem8[rec + ROW] + 1;
    mem8[rec + POSITION] = sum;
    arrived = mem8[rec + ROW] >= ARRIVAL_ROW;
  }
  if (!arrived) return;

  mem8[WAVE_ARRIVAL_COUNTER] = mem8[WAVE_ARRIVAL_COUNTER] + 1;
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] - 1;
  mem8[WAVE_PROGRESS_COUNTER] = mem8[WAVE_PROGRESS_COUNTER] + 1;

  if ((mem8[rec + BAND_KIND] & HIGH_NIBBLE) === 0) return loc_3553(m, rec);
  loc_3553(m, rec); // blank the record's sprite band, then run the gated lane reset

  if (mem8[LANE_RESET_LATCH] !== 0) return;
  mem8[loc_8d76] = mem8[loc_8d76] + 1;
  if (mem8[loc_8d76] < RESET_READY) return;

  mem8[LANE_SPAWN_COUNTDOWN] = 0;
  mem8[LAUNCH_ARM_LATCH] = 0;
  mem8[SCRIPT_ADVANCE_GUARD] = 0;
  mem8[SLOT_SWEEP_LATCH] = 0;
  mem8[ENEMY_SPAWN_TIMER] = SPAWN_RESEED;
  mem8[LANE_RESET_LATCH] = SPAWN_RESEED;

  if (mem8[FLIP_SCREEN_FLAG] !== 0) return; // only while upright
  if (mem8[STAGE_COUNTDOWN] >= STAGE_GUARD) return; // only while the stage countdown is low

  let sum = 0;
  for (let i = 0; i < CKSUM_LEN; i++) sum = (sum + mem8[STATE0_CKSUM_BASE - i]) & BYTE;
  if (sum === CKSUM_SENTINEL) return;
  mem8[TAMPER_STRIKES_STATE0] = mem8[TAMPER_STRIKES_STATE0] + 1;
}
