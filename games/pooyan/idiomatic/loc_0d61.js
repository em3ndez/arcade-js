// SPDX-License-Identifier: GPL-3.0-only
import { loc_0038 } from "./loc_0038.js";
import {
  CREDIT_COUNT,
  MAIN_GAME_STATE,
  DISPLAY_CMD_0618,
  DISPLAY_CMD_0619,
  DISPLAY_CMD_0300,
} from "./names.js";
/**
 * loc_0d61 — coin jingle: on a nonzero credit count, queue a credit display command (a distinct
 * command for exactly one credit vs more than one) followed by a fixed command, then set the
 * top-level game state to 2. A zero credit count returns having done nothing.
 *
 * LIVE-OUT: none — memory only (the display-command ring and MAIN_GAME_STATE).
 */
export function loc_0d61(m) {
  const { mem8 } = m;

  const credits = mem8[CREDIT_COUNT];
  if (credits === 0) return;
  loc_0038(m, credits === 1 ? DISPLAY_CMD_0618 : DISPLAY_CMD_0619);
  loc_0038(m, DISPLAY_CMD_0300);
  mem8[MAIN_GAME_STATE] = 2;
}
