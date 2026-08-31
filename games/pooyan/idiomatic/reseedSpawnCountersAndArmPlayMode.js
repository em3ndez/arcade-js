// SPDX-License-Identifier: GPL-3.0-only
import {
  SPAWN_PHASE_COUNTER,
  ROPE_DRAW_COUNT,
  ROUND_COUNTER,
  STAGE_COUNTDOWN,
  GAME_ACTIVE_FLAG,
  PLAY_MODE_LATCH,
  DISPLAY_LIST_SRC_PTR,
  LAUNCH_SCRIPT_PTR,
} from "./names.js";
import { resetBoardRamAndReseedSpawnCounters } from "./resetBoardRamAndReseedSpawnCounters.js";
import { saveLiveStateToPlayerBank } from "./saveLiveStateToPlayerBank.js";
import { fillByteRun } from "./fillByteRun.js";
import { resetGameToAttractState } from "./resetGameToAttractState.js";
/**
 * reseedSpawnCountersAndArmPlayMode — the round machine's index-6 handler (ROM 0x1a01-0x1a46).
 *
 * WHAT IT IS. Pooyan drives a round through a small in-play sub-state machine dispatched on
 * PLAY_STATE_INDEX (0x880a). This is the handler at index 6: the step that reseeds the per-round
 * spawn/difficulty counters at the top of a round and, on the very first pass, arms the play-mode
 * latch that switches the round onto its bonus/alternate track.
 *
 * ROLE IN THE MACHINE. Two things braid together here. First, it re-primes the counters that pace
 * enemy spawns and the rope so the incoming round starts from a clean seed. Second, it uses the low
 * bit of ROUND_COUNTER (0x8907) as a two-frame ping-pong: it bumps the counter, and an ODD result
 * lets the round proceed (the live page is parked and the frame ends); only on an EVEN result does
 * it reach the branch that either tears the game down (credit spent), clears the display-list block
 * (the latch is already up from a previous visit), or — the first-arm case — undoes the bump and
 * latches PLAY_MODE_LATCH (0x8f50), diverting the round into the bonus path. Because the arming
 * step consumes the even frame and undoes its own bump, the counter's low bit alternates the
 * handler between "let it run" and "consider arming" on successive visits.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT: memory only — no register survives for a caller. It leaves the reseeded spawn-phase and
 * rope-draw counters, the seated STAGE_COUNTDOWN, and a bumped (or, on the first-arm path, restored
 * then latched) round state; every non-teardown exit tails into saveLiveStateToPlayerBank, which
 * parks the live actor/state page into the active player's saved bank and clears PLAY_STATE_INDEX.
 */

export function reseedSpawnCountersAndArmPlayMode(m) {
  const { mem8 } = m;

  // Reseed the board/HUD at the top of the round. resetBoardRamAndReseedSpawnCounters (ROM 0x2527)
  // enqueues a display command, conditionally reseeds the spawn-phase/rope-draw counters, clears
  // three RAM blocks, and mirrors its fill value into five actor/HUD cells; it hands back the reseed
  // value, which we mirror into the two live counters below.
  const a = resetBoardRamAndReseedSpawnCounters(m);
  // SPAWN_PHASE_COUNTER (0x8902) — the per-round phase/step counter that cycles to 7 and selects the
  // spawn/fire-mode branch. ROPE_DRAW_COUNT (0x8934) — its one-frame snapshot, which sets the rope
  // sprite rows. Both take the same reseed value so the round's spawn cadence and rope start aligned.
  mem8[SPAWN_PHASE_COUNTER] = a;
  mem8[ROPE_DRAW_COUNT] = a;

  // Seat STAGE_COUNTDOWN (0x8901). Its initial value selects the stage label: 0x30 once ROUND_COUNTER
  // (0x8907) has reached 2 (later stages), else 0x28 for the opening stages. From here it counts a
  // stage down and, near zero, gates the actor AI.
  mem8[STAGE_COUNTDOWN] = mem8[ROUND_COUNTER] >= 0x02 ? 0x30 : 0x28;

  // Advance ROUND_COUNTER (0x8907) — the BCD-rendered HUD round number whose low bits also index the
  // difficulty tables. The bump is what makes this handler's decision alternate frame-to-frame.
  mem8[ROUND_COUNTER] = mem8[ROUND_COUNTER] + 1; // bump phase counter
  // Odd result -> the round is allowed to proceed this frame. Park the live page into the active
  // player's bank and end here. Passing 0x89 makes that save clear the (0x89:0x04) status cell,
  // i.e. ROUND_IN_PROGRESS (0x8904).
  if (mem8[ROUND_COUNTER] & 0x01) return saveLiveStateToPlayerBank(m, 0x89); // odd frame

  // Even result -> we are on an arming/teardown frame. First check the credit gate: GAME_ACTIVE_FLAG
  // (0x8806) is cleared to 0 at game-over, so a zero here means there is no live game to arm — drop
  // straight to the attract-screen teardown.
  if (mem8[GAME_ACTIVE_FLAG] === 0) return resetGameToAttractState(m); // credit gate closed

  // The game is live. If PLAY_MODE_LATCH (0x8f50) is already nonzero, the bonus/alternate mode was
  // armed on an earlier visit, so there is nothing to arm now — instead scrub the display-list source
  // block: zero the 0x10 bytes at DISPLAY_LIST_SRC_PTR (0x8f45) so the interpreter reads a clean run.
  if (mem8[PLAY_MODE_LATCH] !== 0) {
    fillByteRun(m, DISPLAY_LIST_SRC_PTR, 0x00, 0x10); // latch set: clear the block
    // Park the live page, but pass 0x81 so the save's (page:0x04) clear lands at 0x8104 — outside the
    // gameplay page — leaving ROUND_IN_PROGRESS (0x8904) intact on this already-armed path.
    return saveLiveStateToPlayerBank(m, 0x81);
  }

  // First-arm case: latch is still clear on an even frame, so this is the frame that flips the round
  // onto the bonus/alternate track. Undo the bump (this arming step consumes the frame rather than
  // advancing the round), so ROUND_COUNTER returns to its pre-bump value.
  mem8[ROUND_COUNTER] = mem8[ROUND_COUNTER] - 1; // undo the bump
  // Raise PLAY_MODE_LATCH (0x8f50) to 1 — the multi-valued play-state latch that gates the alternate
  // update paths and table selects for the rest of the round.
  mem8[PLAY_MODE_LATCH] = 0x01;
  // Force STAGE_COUNTDOWN (0x8901) to 1 so the next stage tick fires immediately, and seed
  // LAUNCH_SCRIPT_PTR (0x8f4a) to 0x40 — the boundary value the bonus-stage launch countdown keys on.
  mem8[STAGE_COUNTDOWN] = 0x01;
  mem8[LAUNCH_SCRIPT_PTR] = 0x40;
  // Park the live page (again clearing ROUND_IN_PROGRESS via the 0x89 page byte) and end the frame.
  return saveLiveStateToPlayerBank(m, 0x89);
}
