// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_0714 } from "./loc_0714.js";
import { serviceCoinCreditAndCountersUnlessFreePlay } from "./serviceCoinCreditAndCountersUnlessFreePlay.js";
import { drainSoundCommandRing } from "./drainSoundCommandRing.js";
import { loc_072d } from "./loc_072d.js";
import { dispatchAttractSubstate } from "./dispatchAttractSubstate.js";
import { dispatchBoardBuildSubstate } from "./dispatchBoardBuildSubstate.js";
import { runPlayStateFrame } from "./runPlayStateFrame.js";
import { noopStateHandler } from "./noopStateHandler.js";
import {
  MAIN_GAME_STATE,
  PLAY_STATE_INDEX,
  NMI_ENABLE_LATCH,
  DSW1_PORT,
  FLIP_SCREEN_LATCH,
  FLIP_SCREEN_FLAG,
  INPUT_PORT0,
  WORKER_CONTROL_BYTE,
  FRAME_COUNTER,
  IN0_PORT,
  IN1_PORT,
  IN2_PORT,
  SPRITE0_CLEAR_BASE,
  SPRITE1_CLEAR_BASE,
  SPRITE_DISPLAY_LIST,
  SPRITE_TARGET_SLOTS,
  ENEMY_SCAN_BOX_TABLE,
  FORMATION_COORD_SLOTS,
} from "./names.js";

/**
 * loc_066d — the vblank NMI service routine, the game's sole per-frame heartbeat.
 *
 * On the real machine it saves the whole register file, does its work, and restores it so the
 * interrupted main loop is undisturbed. The born-live main loop holds no CPU registers, so that
 * save/restore is vestigial and dropped here; scratch lives in JS locals. LIVE-OUT: memory only.
 *
 * Steps: mask NMI; rebuild the scrolling tile columns; kick the watchdog; shift the three input ports
 * through the edge-detect ring; tick two frame counters; service coins and the sound ring; dispatch on
 * the main game state; latch flip-screen and re-arm NMI.
 */
export function loc_066d(m) {
  const { mem8 } = m;
  const P = INPUT_PORT0;

  mem8[NMI_ENABLE_LATCH] = 0; // LS259 b0 <- 0: block a re-entrant NMI while we run

  // Rebuild the scrolling tile columns. In play-state 4 four groups are copied, cursors threaded
  // across the calls; otherwise a single 0x18-tall group. `a` is the last byte copied.
  let a, attr = SPRITE1_CLEAR_BASE, pos = SPRITE0_CLEAR_BASE;
  if (mem8[PLAY_STATE_INDEX] === 0x04) {
    [a, pos, attr] = loc_0714(m, SPRITE_DISPLAY_LIST, attr, pos, 0x04);
    [a, pos, attr] = loc_0714(m, SPRITE_TARGET_SLOTS, attr, pos, 0x03);
    [a, pos, attr] = loc_0714(m, ENEMY_SCAN_BOX_TABLE, attr, pos, 0x0b);
    [a, pos, attr] = loc_0714(m, FORMATION_COORD_SLOTS, attr, pos, 0x06);
  } else {
    [a, pos, attr] = loc_0714(m, SPRITE_DISPLAY_LIST, attr, pos, 0x18);
  }
  mem8[DSW1_PORT] = a; // watchdog kick: the write side of DSW1_PORT, fed the last byte copied

  // Shift the input edge-detect ring, then sample the three ports (active-low, so invert).
  mem8[P + 6] = mem8[P + 5];
  mem8[P + 5] = mem8[P + 3];
  mem8[P + 3] = mem8[P + 0];
  mem8[P + 4] = mem8[P + 1];
  mem8[P + 2] = u8(~mem8[IN2_PORT]);
  mem8[P + 1] = u8(~mem8[IN1_PORT]);
  mem8[P + 0] = u8(~mem8[IN0_PORT]);

  mem8[WORKER_CONTROL_BYTE] = u8(mem8[WORKER_CONTROL_BYTE] - 1);
  mem8[FRAME_COUNTER] = u8(mem8[FRAME_COUNTER] - 1);

  serviceCoinCreditAndCountersUnlessFreePlay(m);
  drainSoundCommandRing(m);

  // Dispatch on the main game state — the idiomatic switch replacing the rst-28 dispatch table.
  switch (mem8[MAIN_GAME_STATE]) {
    case 0: loc_072d(m); break;
    case 1: dispatchAttractSubstate(m); break;
    case 2: dispatchBoardBuildSubstate(m); break;
    case 3: runPlayStateFrame(m); break;
    case 4: noopStateHandler(m); break;
  }

  mem8[FLIP_SCREEN_LATCH] = mem8[FLIP_SCREEN_FLAG]; // LS259 b7
  mem8[NMI_ENABLE_LATCH] = 1; // LS259 b0 <- 1: re-arm NMI
}
