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

// Attract round setup and free-running demo loop — head of the clock-free foreground spine. Silence sound,
// enable interrupts, type the attract screens (delays yield), seed a fresh field, then free-run the demo
// one frame per yield until it signals done, and fall through into the round teardown. Which attract screen
// shows is chosen by SCREEN_MODE_TOGGLE (flipped each teardown pass). Generator; memory + IO.
export function* runAttractCycle(m) {
  m.io.portOut(0x03, 0x00);
  m.io.portOut(0x05, 0x00);
  storeTaskFlags(m, 0x00);
  m.io.setInte(true);
  yield* waitShortDelay(m);

  // Type this screen's heading, then its body block.
  if (m.mem8[SCREEN_MODE_TOGGLE] !== 0) {
    yield* typePacedSpriteRun(m, loc_1dab, 0x04, loc_3017);
  } else {
    yield* typePacedSpriteRun(m, loc_1cfa, 0x04, loc_3017); // both branches leave the source positioned for the block below
  }
  yield* typeAttractBlock(m, loc_1daf);
  yield* waitShortDelay(m);
  yield* drawScoreAdvanceTable(m);
  yield* waitLongDelay(m);

  // On one screen, run three handshaked reveals with block loads.
  if (m.mem8[SCREEN_MODE_TOGGLE] === 0) {
    loadDrawSequenceBlock(m, loc_1a95); yield* runAttractAnimTask(m);
    loadDrawSequenceBlock(m, loc_1bb0); yield* runAttractAnimTask(m);
    yield* waitShortDelay(m);
    loadDrawSequenceBlock(m, loc_1fc9); yield* runAttractAnimTask(m);
    yield* waitShortDelay(m);
    clearScreenStrip(m, 0x0a, loc_33b7);
    yield* waitLongDelay(m);
  }

  clearPlayfield(m);
  if (m.mem8[loc_21ff] === 0) { // seed the reserve-ship count once
    m.mem8[loc_21ff] = readStartingShips(m);
    decrementShipsAndDrawReadout(m);
  }

  seedWorkRamImage(m);
  markAllAliensAliveP1(m);
  initPlayer1ShieldBuffers(m);
  restorePlayer1Shields(m);
  m.mem8[TASK_FLAGS] = 0x01;
  drawBottomLine(m);

  // Free-run the demo one frame per yield until the round-state trigger leaves 0xff.
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

  yield* finishAttractCycle(m);
}
