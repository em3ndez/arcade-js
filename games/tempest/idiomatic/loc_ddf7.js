// SPDX-License-Identifier: GPL-3.0-only
import { queueEaromRequestAtIndexZero } from "./queueEaromRegionSave.js";

// Supply mask 0x03 to the zeroed-index merge entry.
export function loc_ddf7(m) {
  queueEaromRequestAtIndexZero(m, 0x03);
}
