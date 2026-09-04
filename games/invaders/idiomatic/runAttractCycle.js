// SPDX-License-Identifier: GPL-3.0-only
import { storeTaskFlags } from "./storeTaskFlags.js";
import { waitShortDelay } from "./waitShortDelay.js";
import { waitLongDelay } from "./waitLongDelay.js";
import { typeAttractBlock } from "./typeAttractBlock.js";
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { runAttractAnimTask } from "./runAttractAnimTask.js";
import { drawScoreAdvanceTable } from "./drawScoreAdvanceTable.js";
import { loadDrawSequenceBlock } from "./loadDrawSequenceBlock.js";
import { clearScreenStrip } from "./clearScreenStrip.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { readStartingShips } from "./readStartingShips.js";
import { decrementShipsAndDrawReadout } from "./decrementShipsAndDrawReadout.js";
import { seedWorkRamImage } from "./seedWorkRamImage.js";
import { markAllAliensAliveP1 } from "./markAllAliensAliveP1.js";
import { initPlayer1ShieldBuffers } from "./initPlayer1ShieldBuffers.js";
import { restorePlayer1Shields } from "./restorePlayer1Shields.js";
import { drawBottomLine } from "./drawBottomLine.js";
import { advanceRoundState } from "./advanceRoundState.js";
import { updateFleetAndDrawCopyright } from "./updateFleetAndDrawCopyright.js";
import { isArmTriggerSet } from "./isArmTriggerSet.js";
import { finishAttractCycle } from "./finishAttractCycle.js";
import {
  SCREEN_MODE_TOGGLE, TASK_FLAGS, PLAYER_SHOT_STATUS, loc_21ff,
  loc_3017, loc_1dab, loc_1cfa, loc_1daf, loc_1a95, loc_1bb0, loc_1fc9, loc_33b7,
} from "./names.js";

/**
 * runAttractCycle — attract-round setup and the free-running demo loop.
 *
 * WHAT IT IS
 *   The head of the clock-free foreground attract spine. It silences the sound ports, enables
 *   interrupts, types the attract screens (with paced delays that yield frame by frame), seeds a fresh
 *   alien field and shields, then free-runs the demo one frame per yield until the round-state trigger
 *   changes, and finally falls through into the attract teardown. Which of the two attract screens shows
 *   is chosen by SCREEN_MODE_TOGGLE (0x20ec), which finishAttractCycle flips on each teardown pass, so
 *   successive attract cycles alternate between the two screens.
 *
 * ROLE IN THE MACHINE
 *   Part of the attract loop join: enterAttractCycle (seats the round/mode byte) -> runAttractCycle ->
 *   finishAttractCycle (teardown + flip SCREEN_MODE_TOGGLE) -> back to enterAttractCycle. The busy-wait
 *   delays (waitShortDelay 0x40 frames, waitLongDelay) all spin on FRAME_DELAY_TIMER (0x20c0), which the
 *   vblank interrupt decrements — so a `yield` here is one displayed frame. It arms TASK_FLAGS (0x20c1)
 *   = 1 so the vblank interrupt runs the shared record tail for the demo, and the demo free-run gates on
 *   isArmTriggerSet (the [0x2015]==0xff poll). advanceRoundState during attract advances the demo script
 *   pointer ATTRACT_DEMO_PTR. In the ROM this is loc_0aea, which falls through into loc_0b89
 *   (finishAttractCycle).
 *
 * ROM 0x0aea-0x0b88 (+ interior loc_0be8; falls into finishAttractCycle at 0x0b89).  Grounding: [seen].
 *
 * LIVE-OUT: control passes into finishAttractCycle, which tail-jumps back to enterAttractCycle; the
 * attract loop never returns. Generator; memory + IO.
 */
export function* runAttractCycle(m) {
  // Silence both sound output ports (port 3 discrete cues, port 5 fleet-march/saucer), enable interrupts
  // so the vblank heartbeat drives the busy-wait delays, then hold for one short delay.
  m.io.portOut(0x03, 0x00);
  m.io.portOut(0x05, 0x00);
  storeTaskFlags(m, 0x00);
  m.io.setInte(true);
  yield* waitShortDelay(m);

  // Type this screen's heading, then its body block.
  // SCREEN_MODE_TOGGLE selects the heading text source; both branches type a 4-glyph run to loc_3017.
  if (m.mem8[SCREEN_MODE_TOGGLE] !== 0) {
    yield* typePacedSpriteRun(m, loc_1dab, 0x04, loc_3017);
  } else {
    yield* typePacedSpriteRun(m, loc_1cfa, 0x04, loc_3017); // both branches leave the source positioned for the block below
  }
  // Type the attract body block, pause, draw the score-advance ("=? points") table, and pause longer.
  yield* typeAttractBlock(m, loc_1daf);
  yield* waitShortDelay(m);
  yield* drawScoreAdvanceTable(m);
  yield* waitLongDelay(m);

  // On one screen, run three handshaked reveals with block loads.
  // Each loadDrawSequenceBlock stages a draw script; runAttractAnimTask arms the ISR anim task and waits
  // on the ANIM_DONE_FLAG handshake before the next reveal.
  if (m.mem8[SCREEN_MODE_TOGGLE] === 0) {
    loadDrawSequenceBlock(m, loc_1a95); yield* runAttractAnimTask(m);
    loadDrawSequenceBlock(m, loc_1bb0); yield* runAttractAnimTask(m);
    yield* waitShortDelay(m);
    loadDrawSequenceBlock(m, loc_1fc9); yield* runAttractAnimTask(m);
    yield* waitShortDelay(m);
    clearScreenStrip(m, 0x0a, loc_33b7);
    yield* waitLongDelay(m);
  }

  // Clear the playfield (preserving the score band and status strip), then seed the reserve-ship count
  // from the ships dip switch exactly once (loc_21ff is the starting-ships latch), painting its readout.
  clearPlayfield(m);
  if (m.mem8[loc_21ff] === 0) { // seed the reserve-ship count once
    m.mem8[loc_21ff] = readStartingShips(m);
    decrementShipsAndDrawReadout(m);
  }

  // Build the demo world: reseed work RAM from the ROM image, arm a full player-1 alien wave, init and
  // paint player-1 shields, arm the demo's vblank record tail (TASK_FLAGS bit0), and lay the ground line.
  seedWorkRamImage(m);
  markAllAliensAliveP1(m);
  initPlayer1ShieldBuffers(m);
  restorePlayer1Shields(m);
  m.mem8[TASK_FLAGS] = 0x01;
  drawBottomLine(m);

  // Free-run the demo one frame per yield until the round-state trigger leaves 0xff.
  // Each frame: advance the demo/round state, then run the fleet-edge update + copyright draw and feed
  // its result to port 6 (watchdog kick). Break the moment isArmTriggerSet reports [0x2015] != 0xff.
  for (;;) {
    advanceRoundState(m);
    m.io.portOut(0x06, updateFleetAndDrawCopyright(m));
    if (!isArmTriggerSet(m)) break;
    yield;
  }
  m.mem8[PLAYER_SHOT_STATUS] = 0x00;

  // Wait for the trigger to return to 0xff before teardown.
  for (;;) {
    if (isArmTriggerSet(m)) break;
    yield;
  }

  // Fall into the attract teardown (which flips SCREEN_MODE_TOGGLE and loops back to enterAttractCycle).
  yield* finishAttractCycle(m);
}
