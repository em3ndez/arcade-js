// SPDX-License-Identifier: GPL-3.0-only
import { initShieldBuffers } from "./initShieldBuffers.js";
import { PLAYER2_SHIELD_BUFFER } from "./names.js";

// Seat the player-2 shield buffer base, then replicate the shield template across its four slots; live-out is the end pointer.
export function initPlayer2ShieldBuffers(m) {
  return initShieldBuffers(m, PLAYER2_SHIELD_BUFFER);
}
