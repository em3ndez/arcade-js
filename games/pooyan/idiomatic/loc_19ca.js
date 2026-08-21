// SPDX-License-Identifier: GPL-3.0-only
import {
  GAME_ACTIVE_FLAG,
  SIREN_ENABLE_GATE,
  SIREN_FRAME_COUNTDOWN,
  SIREN_PHASE_BYTE,
  SIREN_DISPLAY_CMD_A,
  SIREN_DISPLAY_CMD_B,
} from "./names.js";
import { loc_0038 } from "./loc_0038.js";
/**
 * loc_19ca — periodic warning-siren tick.
 *
 * Runs only while no game is active and the siren is enabled. A frame countdown decrements
 * each call; until it reaches zero nothing else happens. On expiry it reloads the countdown
 * and toggles the phase bit: an odd phase resets the phase byte to 0 and queues one siren
 * command, an even phase sets it to 1 and queues the other, each dispatched through the
 * display-command ring.
 *
 * LIVE-OUT: memory only — the countdown, phase byte, and any enqueued command. This is a
 * per-frame tick whose result is not read back.
 */

const COUNTDOWN_RELOAD = 0x18; // frames between siren toggles

export function loc_19ca(m) {
  const { mem8 } = m;

  if (mem8[GAME_ACTIVE_FLAG] !== 0) return; // a game is running -> no siren
  if (mem8[SIREN_ENABLE_GATE] === 0) return; // siren disabled

  const countdown = (mem8[SIREN_FRAME_COUNTDOWN] - 1) & 0xff;
  mem8[SIREN_FRAME_COUNTDOWN] = countdown;
  if (countdown !== 0) return; // not expired yet

  mem8[SIREN_FRAME_COUNTDOWN] = COUNTDOWN_RELOAD;
  if (mem8[SIREN_PHASE_BYTE] & 0x01) {
    mem8[SIREN_PHASE_BYTE] = 0x00;
    loc_0038(m, SIREN_DISPLAY_CMD_B);
  } else {
    mem8[SIREN_PHASE_BYTE] = 0x01;
    loc_0038(m, SIREN_DISPLAY_CMD_A);
  }
}
