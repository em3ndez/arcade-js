// SPDX-License-Identifier: GPL-3.0-only
import { queueEaromRequest } from "./queueEaromRegionSave.js";

// Force the index byte to 0xff, then run the shared mask-merge with the live-in mask.
export function requestEaromBlankWrite(m, a = m.regs.a) {
  queueEaromRequest(m, a, 0xff);
}
