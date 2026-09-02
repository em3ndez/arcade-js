// SPDX-License-Identifier: GPL-3.0-only
import { initShieldBuffers } from "./initShieldBuffers.js";
import { loc_2142 } from "./names.js";

// Seat the player-1 shield buffer base, then replicate the shield template across its four slots; live-out is the end pointer.
export function loc_01ef(m) {
  return initShieldBuffers(m, loc_2142);
}
