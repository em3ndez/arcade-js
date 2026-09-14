// SPDX-License-Identifier: GPL-3.0-only
import { requestEaromBlankWrite } from "./requestEaromBlankWrite.js";

// Trampoline: run the shared mask-merge with the fixed mask 0x04.
export function loc_dde9(m) {
  requestEaromBlankWrite(m, 0x04);
}
