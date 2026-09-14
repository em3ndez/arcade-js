// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { STATUS_FLAGS, WAVE_PHASE_LATCH, PLAYER_FINE_ANGLE, SWEEP_STAGE, INPUT_EDGE_FLAGS, ATTRACT_TIMER_LIMIT_TABLE } from "./names.js";
import { sweepLaneSlotsForRespawn } from "./sweepLaneSlotsForRespawn.js";

/**
 * stepAttractEnemySweepTimer — drive the attract-mode enemy sweep timer and stage machine. ROM 0xa83a.
 *
 * Role in the machine: during the attract (demo) sequence Tempest cycles enemies onto the tube in staged
 * sweeps rather than by live play. This routine is the per-frame heartbeat of that show: it runs a phase
 * countdown, and when a phase expires it restarts the phase and pumps the lane-respawn sweep, advancing
 * through up to three stages. It runs only while attract mode is active (STATUS_FLAGS bit7 set).
 *
 * Behavior: gated on STATUS_FLAGS bit7. If WAVE_PHASE_LATCH is already running, advance it by one; the
 * current stage SWEEP_STAGE indexes the ATTRACT_TIMER_LIMIT_TABLE — once the advanced value reaches that
 * stage's limit the latch is reset to 0 (phase done) — then sweepLaneSlotsForRespawn(limitIndex) is run to
 * refill lanes. If the latch is idle, it may arm the next stage: when PLAYER_FINE_ANGLE bit7 is clear AND
 * INPUT_EDGE_FLAGS bit3 is set and SWEEP_STAGE is still below 2, bump SWEEP_STAGE and seed WAVE_PHASE_LATCH=1;
 * that arm also clears INPUT_EDGE_FLAGS with mask 0x77 (dropping bit3 and bit7). Every path — including the
 * un-gated exit — finally clears bit7 of INPUT_EDGE_FLAGS with mask 0x7f.
 *
 * Live-out: WAVE_PHASE_LATCH (advanced, reset, or seeded), SWEEP_STAGE (possibly bumped), INPUT_EDGE_FLAGS
 * with bit7 (and on the arm path bit3) cleared, plus whatever sweepLaneSlotsForRespawn respawns.
 * Grounding: [seen].
 */
export function stepAttractEnemySweepTimer(m) {
  const { mem8 } = m;

  if ((mem8[STATUS_FLAGS] & 0x80) !== 0) {          // only while attract mode is active
    const running = mem8[WAVE_PHASE_LATCH];
    if (running !== 0) {
      const advanced = u8(running + 1);             // tick the phase
      const limitIndex = mem8[SWEEP_STAGE];         // current stage indexes the limit table
      mem8[WAVE_PHASE_LATCH] = advanced;
      if (advanced >= mem8[u16(ATTRACT_TIMER_LIMIT_TABLE + limitIndex)]) mem8[WAVE_PHASE_LATCH] = 0; // phase done
      sweepLaneSlotsForRespawn(m, limitIndex);      // refill lanes for this stage
    } else if ((mem8[PLAYER_FINE_ANGLE] & 0x80) === 0 && (mem8[INPUT_EDGE_FLAGS] & 0x08) !== 0) {
      if (mem8[SWEEP_STAGE] < 2) {                  // arm the next stage (up to 3 stages)
        mem8[SWEEP_STAGE] = mem8[SWEEP_STAGE] + 1;
        mem8[WAVE_PHASE_LATCH] = 1;
      }
      mem8[INPUT_EDGE_FLAGS] = mem8[INPUT_EDGE_FLAGS] & 0x77; // consume the trigger edge (drop bit3/bit7)
    }
  }

  mem8[INPUT_EDGE_FLAGS] = mem8[INPUT_EDGE_FLAGS] & 0x7f;     // always clear bit7 on the way out
}
