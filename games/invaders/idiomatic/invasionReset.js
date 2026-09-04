// SPDX-License-Identifier: GPL-3.0-only
import { isArmTriggerSet } from "./isArmTriggerSet.js";
import { resolvePlayerShotHit } from "./resolvePlayerShotHit.js";
import { startSound } from "./startSound.js";
import { clearGameActive } from "./clearGameActive.js";
import { clearScreenRegion } from "./clearScreenRegion.js";
import { drawLivesDigit } from "./drawLivesDigit.js";
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";
import { gameOverFlow } from "./gameOverFlow.js";
import { WARM_RESTART_SUPPRESS, loc_2015, RESERVE_SHIP_ICONS_SCREEN_ADDR } from "./names.js";

/**
 * invasionReset — the round-ending warm restart when the fleet reaches the bottom.
 *
 * WHAT IT IS
 *   The flow that runs when the alien fleet marches down onto the player (an "invasion"). It marks the
 *   reset in progress, waits out the death animation while sounding the alarm, then tears the round
 *   down and hands off to the game-over flow.
 *
 * ROLE IN THE MACHINE
 *   Armed, not called directly: when pickNextMarchingAlien finds a live alien that has crossed the low
 *   row threshold, it stashes this generator into m.nextMain so the engine swaps it in as the next main
 *   flow once the interrupt returns (never run inside the interrupt body). WARM_RESTART_SUPPRESS is the warm-restart
 *   suppress flag (also gated by pickNextMarchingAlien, so the reset arms only once). loc_2015 is the
 *   arm-trigger cell polled by isArmTriggerSet ([loc_2015]==0xff): this flow clears it to 0 and spins
 *   until the interrupt-driven death animation raises it back to 0xff. startSound(0x04) holds the
 *   invasion alarm bit; clearSoundPort3Bit(0xfb) masks that same bit (0x04) back off at the end.
 *   Mirrors decompiled ROM routines loc_1971 (sets WARM_RESTART_SUPPRESS=1) -> loc_16e6-0x170d (the wait + teardown),
 *   tail into gameOverFlow. Grounding: [seen] leaf routines; the warm-restart spine is described in
 *   mechanisms.md's in-game main-loop/round-restart narrative.
 *
 * LIVE-OUT: memory + IO; yields each held frame, then yields through gameOverFlow.
 */
export function* invasionReset(m) {
  // Latch the warm-restart-in-progress flag (so pickNextMarchingAlien will not re-arm), re-enable
  // interrupts (the death animation runs off them), and clear the arm-trigger cell to 0.
  m.mem8[WARM_RESTART_SUPPRESS] = 0x01;
  m.io.setInte(true);
  m.mem8[loc_2015] = 0x00;
  // Hold one frame at a time: resolve any player shot still in flight and hold the invasion alarm on,
  // until the interrupt-driven death animation raises the arm trigger ([loc_2015]==0xff).
  for (;;) {
    resolvePlayerShotHit(m);
    startSound(m, 0x04);
    if (isArmTriggerSet(m)) break;
    yield;
  }
  // Death animation done: drop the game-active flag, blank the reserve-ship readout region, zero the
  // on-screen lives digit, and mask the alarm sound bit (0x04) back off.
  clearGameActive(m);
  clearScreenRegion(m, RESERVE_SHIP_ICONS_SCREEN_ADDR);
  drawLivesDigit(m, 0x00);
  clearSoundPort3Bit(m, 0xfb);
  // Continue into the game-over flow (high-score promotion, then attract teardown or the survivor's turn).
  yield* gameOverFlow(m);
}
