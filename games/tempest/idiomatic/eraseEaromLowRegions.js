// SPDX-License-Identifier: GPL-3.0-only
import { requestEaromBlankWrite } from "./requestEaromBlankWrite.js";

// Trampoline: run the mask-merge with the 0x03 mask.
export function eraseEaromLowRegions(m) {
  requestEaromBlankWrite(m, 0x03);
}
