// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { paintAttractColumnWithTamperChecksum } from "./paintAttractColumnWithTamperChecksum.js";
import {
  INTRO_DELAY_CKSUM_WORD,
  HIT_TALLY,
  HUNTER_SPAWN_DISPLAY_CMD,
  BOARD_CLEAR_FLAG,
  ROUND_COUNTER,
  TAMPER_CHECK_BLOCK_0B32,
  TAMPER_CHECK_CLONE_7071,
  INTRO_PHASE_INDEX,
} from "./names.js";
/**
 * advanceLevelIntroFromPhase3 -- level-intro phase-3 timing gate.
 *
 * WHAT IT IS
 *   One handler in the level-intro / round-start phase machine -- the short scripted
 *   sequence that plays between surviving a board and committing the machine into the
 *   next one. That machine keeps its current step in the phase selector
 *   INTRO_PHASE_INDEX (0x8f51), a value the phase dispatcher runs across the range 0..6;
 *   each phase handler does its own work and then advances the selector. This routine is
 *   the phase-3 step.
 *
 * ROLE IN THE MACHINE
 *   Phase 3 is a dwell: it holds the intro on screen for a fixed span, playing a
 *   per-step cue, before handing off to the last phase. It does this with a two-stage
 *   timer sharing a single entry point.
 *     - The OUTER stage is the phase delay in INTRO_DELAY_CKSUM_WORD (0x8f48).
 *     - The INNER stage is a sub-count in HIT_TALLY (0x8f52).
 *   While the outer delay sits at exactly 0x20 the routine spends the frame draining the
 *   inner sub-count instead: it enqueues the hunter-spawn display command once per inner
 *   tick and stalls completely while the board is still clearing. Only once the inner
 *   sub-count empties does the outer delay resume counting down. When the outer delay
 *   itself hits zero the dwell is over: the delay reloads and the phase selector advances
 *   to 6.
 *
 *   The commit carries an anti-tamper guard that arms only on world 3
 *   (ROUND_COUNTER == 3): before advancing the phase it byte-compares a 0x79-byte ROM
 *   block against a verbatim clone and diverts to the tamper handler on any mismatch. On
 *   a genuine machine the clone matches and the guard is invisible.
 *
 * ROM 0x6f5e-0x6f9c.
 * Grounding: [seen].
 *
 * LIVE-OUT (memory): while dwelling it decrements HIT_TALLY (0x8f52) by one inner tick
 *   per frame and INTRO_DELAY_CKSUM_WORD (0x8f48) by one outer tick once the sub-count
 *   empties; on the frame the outer delay expires it reloads INTRO_DELAY_CKSUM_WORD to
 *   0x60 and writes INTRO_PHASE_INDEX (0x8f51) = 6 to advance the phase. It returns no
 *   value -- the phase dispatcher reads the machine back out of memory on the next frame.
 *   The tamper branch tail-calls the tamper handler; it is unreachable on an intact image
 *   (the clone matches, and program-image writes cannot be crafted to force a mismatch).
 */

const DELAY_ACTIVE = 0x20; //  tick the sub-count only while the delay reads exactly 0x20
const DELAY_RELOAD = 0x60; //  reload value once the delay expires
const WORLD_3 = 0x03; //       anti-tamper compare runs only on world 3
const TAMPER_LEN = 0x79; //    bytes compared
const PHASE_6 = 0x06; //       intro phase advanced to

export function advanceLevelIntroFromPhase3(m) {
  const { mem8 } = m;

  // Stage 1 -- the inner sub-count (ROM 0x6f61-0x6f77).
  // Two nested timers share this entry. This stage owns the frame only while the outer
  // phase delay INTRO_DELAY_CKSUM_WORD (0x8f48) reads exactly 0x20 AND the inner
  // sub-count HIT_TALLY (0x8f52) is still non-zero. When both hold, it cues a sound and
  // drains one step of the inner count, so the outer delay stays pinned at 0x20 until the
  // inner count empties. Any other outer-delay value skips this block and drops into
  // stage 2.
  if (mem8[INTRO_DELAY_CKSUM_WORD] === DELAY_ACTIVE && mem8[HIT_TALLY] !== 0) {
    // Cue the hunter-spawn display command (word 0x0315) once per inner tick -- the beat
    // that marks each step of the phase-3 dwell.
    enqueueDisplayCommand(m, HUNTER_SPAWN_DISPLAY_CMD); // queue the hunter-spawn sound
    // Freeze the dwell while the field is still being cleared: BOARD_CLEAR_FLAG (0x89e5)
    // is the board-clear/level-intro gate, and while it is set the routine returns before
    // the sub-count is touched, so no dwell time elapses until the board is ready.
    if (mem8[BOARD_CLEAR_FLAG] !== 0) return; // held while the board is clearing
    // Drain one step of the inner sub-count HIT_TALLY (0x8f52): decrement mod 256 and
    // store it back. A non-zero result means the inner timer is still running, so return
    // and take the next step next frame; only when it reaches zero does the outer delay
    // get to advance.
    const sub = (mem8[HIT_TALLY] - 1) & 0xff;
    mem8[HIT_TALLY] = sub;
    if (sub !== 0) return; // sub-count still running
  }

  // Stage 2 -- the outer phase delay (ROM 0x6f79-0x6f7d).
  // Reached on every frame the inner sub-count is not holding: decrement the phase delay
  // INTRO_DELAY_CKSUM_WORD (0x8f48) mod 256 and store it back. A non-zero result means
  // the phase is still dwelling, so return. When it reaches zero the dwell is over, and
  // the delay is reloaded to 0x60 (DELAY_RELOAD) for its next use before the commit runs.
  const delay = (mem8[INTRO_DELAY_CKSUM_WORD] - 1) & 0xff;
  mem8[INTRO_DELAY_CKSUM_WORD] = delay;
  if (delay !== 0) return; // phase delay still running
  mem8[INTRO_DELAY_CKSUM_WORD] = DELAY_RELOAD;

  // Anti-tamper guard, world 3 only (ROM 0x6f7d-0x6f96).
  // Only when ROUND_COUNTER (0x8907) holds 3 does the commit run an integrity compare:
  // walk 0x79 bytes of the ROM block TAMPER_CHECK_BLOCK_0B32 (0x0b32) against its verbatim
  // clone TAMPER_CHECK_CLONE_7071 (0x7071). On a genuine image the two are identical; any
  // byte mismatch means the program has been altered, and the routine diverts to the
  // tamper handler instead of advancing the phase.
  if (mem8[ROUND_COUNTER] === WORLD_3) {
    for (let i = 0; i < TAMPER_LEN; i++) {
      if (mem8[TAMPER_CHECK_CLONE_7071 + i] !== mem8[TAMPER_CHECK_BLOCK_0B32 + i]) {
        return paintAttractColumnWithTamperChecksum(m); // tamper mismatch -> tamper handler
      }
    }
  }

  // Commit (ROM 0x6f98-0x6f9c).
  // The dwell has finished and the image is intact: advance the level-intro selector
  // INTRO_PHASE_INDEX (0x8f51) to phase 6, the highest phase index (0..6) and the last
  // step the phase dispatcher runs for this intro.
  mem8[INTRO_PHASE_INDEX] = PHASE_6; // advance to phase 6
}
