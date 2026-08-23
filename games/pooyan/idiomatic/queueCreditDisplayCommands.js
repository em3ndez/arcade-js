// SPDX-License-Identifier: GPL-3.0-only
import { loc_0038 } from "./loc_0038.js";
import { COINAGE_CONFIG } from "./names.js";
/**
 * queueCreditDisplayCommands — enqueue the primary display command, plus the free-play extra command only when
 * the coinage config holds the free-play sentinel. LIVE-OUT: none (memory only).
 */
const PRIMARY_DISPLAY_CMD = (0x07 << 8) | 0x01;
const FREE_PLAY_DISPLAY_CMD = (0x06 << 8) | 0x06;
const FREE_PLAY_COINAGE = 0x0f;

export function queueCreditDisplayCommands(m) {
  const { mem8 } = m;
  loc_0038(m, PRIMARY_DISPLAY_CMD);
  if (mem8[COINAGE_CONFIG] === FREE_PLAY_COINAGE) loc_0038(m, FREE_PLAY_DISPLAY_CMD);
}
