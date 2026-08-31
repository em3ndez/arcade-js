// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { WAVE_HOLD_TIMER, TILE_ANIM_PARITY, ENEMY_ACTOR_TABLE, PLAY_STATE_INDEX, LATCHED_ENEMY_X, ATTRACT_SUBSTATE } from "./names.js";
/**
 * clearWaveStateAndArenaOnHoldExpiry — bonus-stage teardown (phase 2).
 *
 * WHAT IT IS
 *   The coarse teardown at the boundary of the eagle bonus stage. ROM 0x7421-0x7441. Grounding: [seen].
 *
 * ROLE IN THE MACHINE
 *   Pooyan's bonus ("eagle") stage runs its own little wave pipeline: paired enemy records approach,
 *   dive/climb, and retire on their own timers, and between waves the machine sits on an inter-wave
 *   hold countdown, WAVE_HOLD_TIMER (0x8f36). This routine is the exit ramp out of that stage. It is
 *   a single pass driven entirely by that hold timer: as long as the hold is still draining it does
 *   nothing but tick it down, and only when the hold reaches zero does it wipe the bonus stage's
 *   working state and re-point the machine at the attract/demo sequence. In effect it waits out the
 *   last pause, then throws away everything the eagle wave uses and hands the screen back to the
 *   attract loop.
 *
 * WHAT IT LEAVES BEHIND
 *   On the tick path: nothing but the decremented hold timer. On the expiry path: the entire 9-byte
 *   wave/phase control block (0x8f37..0x8f3f) and the three-record enemy arena region at 0x8ae0 are
 *   zeroed, the in-play sub-state index and the latched enemy X are cleared, and the attract
 *   sub-state selector is set to 7 so the next frame resumes the attract sequence at that phase.
 *
 * LIVE-OUT: memory only — a state-dispatch handler; the dispatcher does not read back its registers.
 */

// The bonus-stage state cells are all cleared to a plain zero (inactive / empty).
const FILL_ZERO = 0x00;
// The attract sub-state selector (ATTRACT_SUBSTATE, 0x8e51) this routine leaves behind: phase 7 is
// the attract/demo step the machine resumes on once the bonus stage has been torn down.
const ATTRACT_STATE_AFTER_BONUS = 0x07;

export function clearWaveStateAndArenaOnHoldExpiry(m) {
  const { mem8 } = m;

  // --- Inter-wave hold gate (ROM 0x7421-0x7429) ---
  // WAVE_HOLD_TIMER (0x8f36) is the inter-wave hold countdown the eagle pipeline drains one step per
  // frame to pace successive waves. While it is still non-zero the stage is not yet finished holding:
  // decrement it by one and return, leaving every other cell untouched. Only once it has drained to
  // zero does the frame fall through to the teardown below.
  if (mem8[WAVE_HOLD_TIMER] !== 0) {
    mem8[WAVE_HOLD_TIMER] = mem8[WAVE_HOLD_TIMER] - 1;
    return;
  }
  // --- Clear the wave/phase control block (ROM 0x742a-0x7432) ---
  // Zero the 9-byte block based at TILE_ANIM_PARITY (0x8f37), which runs through the launch-armed flag
  // (0x8f3f). This band holds all of the eagle wave's per-frame bookkeeping — the tile-animation
  // parity, the wave outer phase, the records-arrived count, the launch flag and grid-step tick, the
  // live-record count, the wave index, and the launch-armed latch — so wiping it in one sweep resets
  // the whole bonus-wave state machine to its idle, no-wave-in-flight condition.
  fillByteRun(m, TILE_ANIM_PARITY, FILL_ZERO, 0x09);
  // --- Clear the bonus-stage enemy arena (ROM 0x7433-0x7435) ---
  // Zero the 0x48-byte region based at ENEMY_ACTOR_TABLE (0x8ae0): three consecutive 0x18-stride actor
  // records, which is the slot pool the eagle wave seeds its paired attackers into. Blanking their
  // record-active byte (and every field behind it) despawns whatever eagles were still on screen and
  // frees the slots for the next stage.
  fillByteRun(m, ENEMY_ACTOR_TABLE, FILL_ZERO, 0x48);
  // --- Clear the in-play sub-state index (ROM 0x7436-0x7438) ---
  // Zero PLAY_STATE_INDEX (0x880a), the low-5-bit selector the in-play frame dispatches on. Dropping
  // it back to 0 unwinds the bonus-stage handler chain so nothing in the play path re-enters the
  // stage once control has been handed back to attract.
  mem8[PLAY_STATE_INDEX] = FILL_ZERO;
  // --- Clear the latched enemy X (ROM 0x7439-0x743b) ---
  // Zero LATCHED_ENEMY_X (0x8f5b), the eagle's screen-X snapshot the approach machine latches when
  // the eagle crosses its far threshold. It is stale once the wave is gone, so it is reset here.
  mem8[LATCHED_ENEMY_X] = FILL_ZERO;
  // --- Hand control back to attract (ROM 0x743c-0x7441) ---
  // Set ATTRACT_SUBSTATE (0x8e51) to 7. This is the actual hand-off: the attract/demo dispatcher will
  // read this selector next frame and resume the attract sequence at phase 7, out of the bonus stage.
  mem8[ATTRACT_SUBSTATE] = ATTRACT_STATE_AFTER_BONUS;
}
