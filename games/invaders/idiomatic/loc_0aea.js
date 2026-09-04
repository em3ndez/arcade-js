// SPDX-License-Identifier: GPL-3.0-only
import { loc_1982 } from "./loc_1982.js";
import { loc_0ab1 } from "./loc_0ab1.js";
import { loc_0ab6 } from "./loc_0ab6.js";
import { loc_0acf } from "./loc_0acf.js";
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { runAttractAnimTask } from "./runAttractAnimTask.js";
import { loc_1815 } from "./loc_1815.js";
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
import { loc_0bf1 } from "./loc_0bf1.js";
import { isArmTriggerSet } from "./isArmTriggerSet.js";
import { loc_0b89 } from "./loc_0b89.js";
import {
  SCREEN_MODE_TOGGLE, TASK_FLAGS, PLAYER_SHOT_STATUS, loc_21ff,
  loc_3017, loc_1dab, loc_1cfa, loc_1daf, loc_1a95, loc_1bb0, loc_1fc9, loc_33b7,
} from "./names.js";

// Attract round setup and free-running demo loop — head of the clock-free foreground spine. Silence sound,
// enable interrupts, type the attract screens (delays yield), seed a fresh field, then free-run the demo
// one frame per yield until it signals done, and fall through into the round teardown. Which attract screen
// shows is chosen by SCREEN_MODE_TOGGLE (flipped each teardown pass). Generator; memory + IO.
export function* loc_0aea(m) {
  m.io.portOut(0x03, 0x00);
  m.io.portOut(0x05, 0x00);
  loc_1982(m, 0x00);
  m.io.setInte(true);
  yield* loc_0ab1(m);

  // Type this screen's heading, then its body block.
  if (m.mem8[SCREEN_MODE_TOGGLE] !== 0) {
    yield* typePacedSpriteRun(m, loc_1dab, 0x04, loc_3017);
  } else {
    yield* typePacedSpriteRun(m, loc_1cfa, 0x04, loc_3017); // both branches leave the source positioned for the block below
  }
  yield* loc_0acf(m, loc_1daf);
  yield* loc_0ab1(m);
  yield* loc_1815(m);
  yield* loc_0ab6(m);

  // On one screen, run three handshaked reveals with block loads.
  if (m.mem8[SCREEN_MODE_TOGGLE] === 0) {
    loadDrawSequenceBlock(m, loc_1a95); yield* runAttractAnimTask(m);
    loadDrawSequenceBlock(m, loc_1bb0); yield* runAttractAnimTask(m);
    yield* loc_0ab1(m);
    loadDrawSequenceBlock(m, loc_1fc9); yield* runAttractAnimTask(m);
    yield* loc_0ab1(m);
    clearScreenStrip(m, 0x0a, loc_33b7);
    yield* loc_0ab6(m);
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
    m.io.portOut(0x06, loc_0bf1(m));
    if (!isArmTriggerSet(m)) break;
    yield;
  }
  m.mem8[PLAYER_SHOT_STATUS] = 0x00;

  // Wait for the trigger to return to 0xff before teardown.
  for (;;) {
    if (isArmTriggerSet(m)) break;
    yield;
  }

  yield* loc_0b89(m);
}
