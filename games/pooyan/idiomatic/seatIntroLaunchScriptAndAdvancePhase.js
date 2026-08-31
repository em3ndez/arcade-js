// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { queueSoundRun28 } from "./queueSoundRun28.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { advanceAttractToBoardBuildIfImageIntact } from "./advanceAttractToBoardBuildIfImageIntact.js";
import {
  ROUND_COUNTER,
  LAUNCH_SCRIPT_PTR,
  INTRO_DELAY_CKSUM_WORD,
  INTRO_PHASE_INDEX,
  TAMPER_CHECK_BLOCK_0AC8,
  TAMPER_CHECK_CLONE_6DF9,
  INTRO_SCRIPT_TIMER_TABLE,
} from "./names.js";
/**
 * seatIntroLaunchScriptAndAdvancePhase — level-intro phase 0.
 *
 * WHAT IT IS
 *   The very first handler of the level-intro state machine. Each level begins with a short
 *   scripted intro sequence (the object launch/dive choreography that plays before the player
 *   takes control); that sequence is a small state machine whose current step lives in
 *   INTRO_PHASE_INDEX (0x8f51) and is dispatched through the phase jump table at 0x6daa. This
 *   routine is the phase-0 body: it is entered once, arms the machinery the later phases will
 *   consume, advances the phase index so the next frame runs the next phase, and then returns.
 *
 * ROLE IN THE MACHINE
 *   Reached from the per-frame round-2/"deep" fork: when ROUND_COUNTER bit1 is set the frame is
 *   handed to the level-intro phase dispatcher, which vectors here while INTRO_PHASE_INDEX is 0.
 *   It does three things: (1) run the shared per-frame sound run so the intro is audible;
 *   (2) seat the launch-script pointer and its firing delay so the object-launch machinery has
 *   a script to walk; (3) bump the phase index. Folded on top of that is a conditional
 *   anti-tamper compare — one strand of this ROM's self-checking lattice — that only runs on
 *   rounds whose counter has bit2 set.
 *
 * ROM ADDRESS: 0x6db8 (0x6db8–0x6df8).
 * Grounding: [seen]
 *
 * LIVE-OUT: none (memory only) — a void intro-phase handler. Its lasting effects are the writes
 *   it leaves in RAM: the seated LAUNCH_SCRIPT_PTR (0x8f4a), the primed INTRO_DELAY_CKSUM_WORD
 *   (0x8f48 = 0x40), and the incremented INTRO_PHASE_INDEX (0x8f51). It returns no value; a
 *   detected tamper mismatch diverts the tail into the tamper-response handler instead of a
 *   clean return.
 */
export function seatIntroLaunchScriptAndAdvancePhase(m) {
  const { mem8, mem16 } = m;

  // Shared per-frame sound run. Enqueue the fixed sound-command run (bytes 0x28,0x15,0x16,0x17)
  // into the sound-command ring so the intro's audio keeps ticking this frame. Every deep-path
  // per-frame body opens with this same enqueue.
  queueSoundRun28(m);

  // Pick this round's intro script-timer word.
  //   ROUND_COUNTER (0x8907) is the level counter; its value >> 2 buckets four consecutive rounds
  //   into one difficulty step. That step indexes INTRO_SCRIPT_TIMER_TABLE (0x70f3), a ROM word
  //   table of level-intro script-timer values. The index is clamped to a maximum of 7 so the
  //   highest rounds all share the last (hardest) table entry rather than reading past its end.
  const raw = mem8[ROUND_COUNTER] >> 2;
  const index = (raw >= 0x07 ? 0x07 : raw) & 0x07; // clamp to 7
  // Seat the fetched word at LAUNCH_SCRIPT_PTR (0x8f4a) — the 0xff-terminated object launch/dive
  // script pointer the later intro phases walk to spawn and animate the scripted objects.
  mem16[LAUNCH_SCRIPT_PTR] = fetchWordFromTableIndex(m, index, INTRO_SCRIPT_TIMER_TABLE);
  // Prime the launch-firing delay to 0x40. INTRO_DELAY_CKSUM_WORD (0x8f48) is the countdown that
  // gates the next scripted launch; loading it here starts the intro's timing.
  mem8[INTRO_DELAY_CKSUM_WORD] = 0x40;
  // Advance the intro phase. INTRO_PHASE_INDEX (0x8f51) selects the phase handler through the
  // 0x6daa jump table; bumping it here means the next frame runs phase 1 rather than re-running
  // this one. u8 keeps the increment in an 8-bit lane.
  mem8[INTRO_PHASE_INDEX] = u8(mem8[INTRO_PHASE_INDEX] + 1);

  // Gate the anti-tamper compare on ROUND_COUNTER bit2. The original tests the bit by shifting
  // ROUND_COUNTER right three times and returning on carry-clear; extracting bit2 ((>>2)&1) is
  // the same test. On rounds where bit2 is clear the routine is done here — the compare below is
  // skipped so it only fires periodically, not every level.
  if (((mem8[ROUND_COUNTER] >> 2) & 1) === 0) return; // ret nc: bit2 clear -> done

  // Anti-tamper compare (96 bytes). This ROM keeps a second copy of a code block and periodically
  // checks that the two still agree — if the program image was altered, the copies diverge.
  // Here TAMPER_CHECK_BLOCK_0AC8 (0x0ac8, the original block) is compared byte-for-byte against
  // its clone TAMPER_CHECK_CLONE_6DF9 (0x6df9) across all 0x60 bytes.
  for (let i = 0; i < 0x60; i++) {
    // Any single mismatch means the code image was tampered with: abandon the clean return and
    // tail into the tamper-response handler (0x7071) instead. On an intact image the loop runs to
    // completion and the routine simply returns.
    if (mem8[TAMPER_CHECK_CLONE_6DF9 + i] !== mem8[TAMPER_CHECK_BLOCK_0AC8 + i]) {
      return advanceAttractToBoardBuildIfImageIntact(m); // tamper detected -> tamper-response handler
    }
  }
}
