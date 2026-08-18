// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceVblankNmi — the vblank NMI handler: one frame of interrupt service. On hardware it saves all
 * registers, acks the NMI, scans coins, blits the sprite shadow into OBJRAM with a nibble-swap, ticks the
 * coin-counter pulse timers, then runs a dispatch tree on the play/mode flags that drives the attract
 * sequencer, the in-play sub-engines, the object/sound updaters and the board-complete reveal, before
 * restoring registers and returning.
 *
 * This layer does NOT model the register save/restore (those registers are dead to it) nor the final
 * interrupt return (memory-inert): the observable live-out is memory only. Every dispatch arm is a
 * plain direct call. LIVE-OUT: memory-only.
 */
import {
  PLAY_FLAG, GAME_MODE, ACTIVE_PLAYER, IN2_PORT, FROG_Y, OBJECT_READY_0, FLY_SPRITE_X,
  COIN_PULSE_TIMER_0, COIN_PULSE_TIMER_1, BOARD_LAYOUT_GATE, FROG_TIMER_A, POINT_TABLE_DRAW_STATE,
  ATTRACT_DEMO_PHASE_COUNTER, PER_TURN_SCRATCH, PLAYER1_SLOT, PLAYER2_SLOT, HOME_REVEAL_DELAY_TIMER,
  HOME_REVEAL_COUNTDOWN, INPLAY_COUNTDOWN_WORD, BOARD_ADVANCE_DONE_FLAG, SCROLL_EDGE_FLAG,
  SCROLL_WRAP_LATCH, LANE_OBJLIST_8109, LANE_OBJLIST_8124, HOME_COLUMN_STATE, FROG_STATE_DEMO_FLAG,
  loc_83cf, PLAYER1_DIFFICULTY_INDEX, HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY,
  HOME_BAY1_OCCUPANCY_ALT, HOME_BAY5_OCCUPANCY_ALT, COIN_COUNTER_0, COIN_COUNTER_1,
  STATUS_ROW_VRAM_BASE, NO_MORE_FROGS_COLUMN_VRAM,
  FLY_SPRITE_Y, SPRITE_SHADOW_SRC_BASE, SPRITE_OBJECT_SLOT_A, STATUS_ROW_BLIT_COUNTDOWN,
  GATED_COUNTDOWN_ENABLE_MIRROR, OBJRAM_SPRITE_DMA_LEAD, OBJRAM_SPRITE_BLIT_BASE,
  OBJRAM_FLY_SPRITE_BASE, FLY_SPRITE_Y_OBJRAM, FROG_SPRITE_Y_OBJRAM, OBJRAM_SPRITE_SLOT_A_BASE,
  NMI_ENABLE, SOUND_SEQUENCE_COUNTDOWN, BOARD_ADVANCE_REVEAL_STRIP_SRC,
  loc_83af, loc_83b0, loc_83b1,
} from "./names.js";
import { scanCoinInputAndCredit } from "./scanCoinInputAndCredit.js";
import { dequeueSoundCommand } from "./dequeueSoundCommand.js";
import { moveLaneObjectsAndCarryFrog } from "./moveLaneObjectsAndCarryFrog.js";
import { advanceAnimationFrameBuffer } from "./advanceAnimationFrameBuffer.js";
import { driveScoreDisplayCountdown } from "./driveScoreDisplayCountdown.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { advanceScrollLaneObjects } from "./advanceScrollLaneObjects.js";
import { dispatchFrogMoveAgainstLanes } from "./dispatchFrogMoveAgainstLanes.js";
import { driveSpriteObjectCluster } from "./driveSpriteObjectCluster.js";
import { tickGatedCountdown } from "./tickGatedCountdown.js";
import { loc_0292 } from "./loc_0292.js";
import { loc_05d3 } from "./loc_05d3.js";
import { stampHomeBayFrogByColumn } from "./stampHomeBayFrogByColumn.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { driveAttractDemoSequencer } from "./driveAttractDemoSequencer.js";
import { driveFrogDeathAnimation } from "./driveFrogDeathAnimation.js";
import { driveInPlayFrameUpdate } from "./driveInPlayFrameUpdate.js";
import { orchestrateCollisionsAndFrogInput } from "./orchestrateCollisionsAndFrogInput.js";
import { u16 } from "../../../core/int.js";

const swapNibbles = (v) => ((v >> 4) | (v << 4)) & 0xff;

export function serviceVblankNmi(m) {
  const { mem8, mem16 } = m;

  mem8[NMI_ENABLE] = 0; // ack; the register save + watchdog read are dead here
  scanCoinInputAndCredit(m);

  blitSpriteShadow(m);

  // Coin-counter pulse timers: tick each while set, clearing the io pulse when it drains.
  if (mem8[COIN_PULSE_TIMER_1] !== 0) {
    const v = (mem8[COIN_PULSE_TIMER_1] - 1) & 0xff;
    mem8[COIN_PULSE_TIMER_1] = v;
    if (v === 0) mem8[COIN_COUNTER_1] = 0; // io
  }
  if (mem8[COIN_PULSE_TIMER_0] !== 0) {
    const v = (mem8[COIN_PULSE_TIMER_0] - 1) & 0xff;
    mem8[COIN_PULSE_TIMER_0] = v;
    if (v === 0) mem8[COIN_COUNTER_0] = 0; // io
  }

  return b_00ce();

  // Cocktail-mirror the frog X/Y sprite by +2 when a 2-player game is in play.
  function b_00ce() {
    if ((mem8[IN2_PORT] & 0x08) !== 0 &&
        mem8[PLAY_FLAG] !== 0 &&
        mem8[ACTIVE_PLAYER] !== 0 &&
        mem8[ACTIVE_PLAYER] !== 1) {
      mem8[FLY_SPRITE_Y_OBJRAM] = mem8[FLY_SPRITE_Y] + 2;
      mem8[FROG_SPRITE_Y_OBJRAM] = mem8[FROG_Y] + 2;
    }
    return b_00fc();
  }

  function b_00fc() {
    if (mem8[PLAY_FLAG] === 0) return b_0122();
    dequeueSoundCommand(m);
    if (mem8[BOARD_LAYOUT_GATE] === 0) return epilogue();
    const w = mem16[FROG_TIMER_A];
    if (w === 0) return b_0171();
    mem16[FROG_TIMER_A] = u16(w - 1);
    moveLaneObjectsAndCarryFrog(m);
    advanceAnimationFrameBuffer(m);
    return epilogue();
  }

  function b_0122() {
    if (mem8[GAME_MODE] >= 2) return b_0158();
    if (mem8[GAME_MODE] === 0) driveAttractDemoSequencer(m);
    driveInPlayFrameUpdate(m);
    mem8[FROG_STATE_DEMO_FLAG] = 0;
    mem8[loc_83cf] = 0;
    mem8[GATED_COUNTDOWN_ENABLE_MIRROR] = 0;
    mem16[PLAYER1_DIFFICULTY_INDEX] = 0;
    for (let a = PLAYER1_SLOT; a <= HOME_BAY5_OCCUPANCY_ALT; a++) mem8[a] = 0;
    mem8[loc_83af] = 0x80;
    mem8[loc_83b0] = 0;
    mem8[loc_83b1] = 0;
    return epilogue();
  }

  function b_0158() {
    if (mem8[POINT_TABLE_DRAW_STATE] === 0) return epilogue();
    mem8[POINT_TABLE_DRAW_STATE] = mem8[POINT_TABLE_DRAW_STATE] - 1;
    if (mem8[POINT_TABLE_DRAW_STATE] !== 0) return epilogue();
    if (mem8[ATTRACT_DEMO_PHASE_COUNTER] !== 0) return epilogue();
    mem8[GAME_MODE] = mem8[GAME_MODE] - 1;
    return epilogue();
  }

  function b_0171() {
    const w = mem16[SOUND_SEQUENCE_COUNTDOWN];
    if (w === 0) return b_018a();
    const dec = u16(w - 1);
    mem16[SOUND_SEQUENCE_COUNTDOWN] = dec;
    if (dec !== 0) return b_018a();
    enqueueSoundCommand(m, 0x0f);
    enqueueSoundCommand(m, 0xb0);
    mem8[PER_TURN_SCRATCH] = 0;
    return b_018a();
  }

  function b_018a() {
    if (((mem8[ACTIVE_PLAYER] - 1) & 0xff) !== 0) return b_0274();
    if (mem8[PLAYER1_SLOT] === 0x05) return b_025e();
    return b_0199();
  }

  function b_0199() {
    if (mem8[HOME_REVEAL_DELAY_TIMER] === 0) return b_01a6();
    mem8[HOME_REVEAL_DELAY_TIMER] = mem8[HOME_REVEAL_DELAY_TIMER] - 1;
    return b_01e2();
  }

  function b_01a6() {
    if (mem8[HOME_REVEAL_COUNTDOWN] !== 0) return b_0257();
    if (mem16[INPLAY_COUNTDOWN_WORD] !== 0) return b_01e2();
    driveScoreDisplayCountdown(m);
    orchestrateCollisionsAndFrogInput(m);
    if (mem8[GATED_COUNTDOWN_ENABLE_MIRROR] !== 0) return b_01e2();
    mem8[GATED_COUNTDOWN_ENABLE_MIRROR] = 1;
    mem8[STATUS_ROW_BLIT_COUNTDOWN] = 0xff;
    if (mem8[BOARD_ADVANCE_DONE_FLAG] === 0) return b_01e2();
    mem8[BOARD_ADVANCE_DONE_FLAG] = 0;
    mem16[SOUND_SEQUENCE_COUNTDOWN] = 64;
    copyRunUpTileColumn(m, NO_MORE_FROGS_COLUMN_VRAM, BOARD_ADVANCE_REVEAL_STRIP_SRC, 0x07);
    return b_01e2();
  }

  function b_01e2() {
    if (mem8[STATUS_ROW_BLIT_COUNTDOWN] === 0) return b_01f2();
    const d = (mem8[STATUS_ROW_BLIT_COUNTDOWN] - 1) & 0xff;
    mem8[STATUS_ROW_BLIT_COUNTDOWN] = d;
    if (d === 0) { blitFourTileGroupColumn(m, STATUS_ROW_VRAM_BASE); }
    return b_01f2();
  }

  function b_01f2() {
    advanceScrollLaneObjects(m);
    advanceAnimationFrameBuffer(m);
    if (mem8[SCROLL_EDGE_FLAG] !== 0) mem8[LANE_OBJLIST_8109] = mem8[LANE_OBJLIST_8109] - 1;
    return b_0205();
  }

  function b_0205() {
    if (mem8[SCROLL_WRAP_LATCH] !== 0) mem8[LANE_OBJLIST_8124] = mem8[LANE_OBJLIST_8124] - 1;
    return b_0212();
  }

  function b_0212() {
    dispatchFrogMoveAgainstLanes(m);
    if (mem8[SCROLL_EDGE_FLAG] !== 0) mem8[LANE_OBJLIST_8109] = mem8[LANE_OBJLIST_8109] + 1;
    return b_0222();
  }

  function b_0222() {
    if (mem8[SCROLL_WRAP_LATCH] !== 0) mem8[LANE_OBJLIST_8124] = mem8[LANE_OBJLIST_8124] + 1;
    return b_022f();
  }

  function b_022f() {
    driveFrogDeathAnimation(m);
    moveLaneObjectsAndCarryFrog(m);
    driveSpriteObjectCluster(m);
    tickGatedCountdown(m);
    loc_0292(m);
    const sel = mem8[HOME_REVEAL_COUNTDOWN];
    if (sel !== 0) stampHomeBayFrogByColumn(m, sel);
    return epilogue();
  }

  function b_0257() {
    mem8[HOME_REVEAL_COUNTDOWN] = mem8[HOME_REVEAL_COUNTDOWN] - 1;
    return b_01e2();
  }

  function b_025e() {
    for (let a = HOME_BAY1_OCCUPANCY_PRIMARY; a <= HOME_BAY5_OCCUPANCY_PRIMARY; a++) mem8[a] = 0;
    mem8[PLAYER1_SLOT] = 0;
    loc_05d3(m);
    return epilogue();
  }

  function b_0274() {
    if (mem8[PLAYER2_SLOT] !== 0x05) return b_0199();
    for (let a = HOME_BAY1_OCCUPANCY_ALT; a <= HOME_BAY5_OCCUPANCY_ALT; a++) mem8[a] = 0;
    mem8[PLAYER2_SLOT] = 0;
    loc_05d3(m);
    return epilogue();
  }

  // Restore registers (dead here) and re-enable the NMI, then return -- memory-inert; only the latch write.
  function epilogue() {
    mem8[NMI_ENABLE] = 1; // io
  }
}

// Sprite DMA blit: copy the work-RAM sprite shadow into OBJRAM. A fixed lead byte straight, then 28 pairs
// (even byte nibble-swapped, odd byte straight), then a second region whose start/length a state cell
// gates: pass count of (1 swapped byte + 3 straight bytes).
function blitSpriteShadow(m) {
  const { mem8 } = m;
  mem8[OBJRAM_SPRITE_DMA_LEAD] = mem8[OBJECT_READY_0];
  for (let i = 0; i < 0x1c; i++) {
    const s = SPRITE_SHADOW_SRC_BASE + i * 2, d = OBJRAM_SPRITE_BLIT_BASE + i * 2;
    mem8[d] = swapNibbles(mem8[s]);
    mem8[d + 1] = mem8[s + 1];
  }
  let passes, sBase, dBase;
  if (mem8[HOME_COLUMN_STATE] === 0) { passes = 8; sBase = FLY_SPRITE_X; dBase = OBJRAM_FLY_SPRITE_BASE; }
  else { passes = 6; sBase = SPRITE_OBJECT_SLOT_A; dBase = OBJRAM_SPRITE_SLOT_A_BASE; }
  for (let p = 0; p < passes; p++) {
    const s = sBase + p * 4, d = dBase + p * 4;
    mem8[d] = swapNibbles(mem8[s]);
    mem8[d + 1] = mem8[s + 1];
    mem8[d + 2] = mem8[s + 2];
    mem8[d + 3] = mem8[s + 3];
  }
}
