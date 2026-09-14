// SPDX-License-Identifier: GPL-3.0-only
import { loc_3d } from "./names.js";
import { emitScaleWordIfChanged } from "./emitScaleWordIfChanged.js";
import { emitSlotIndexDigit } from "./emitSlotIndexDigit.js";

// Publish a zero header value, then emit the run for the slot named by a scratch byte.
export function emitCountDigitRun(m) {
  const { mem8 } = m;
  emitScaleWordIfChanged(m, 0x00);
  return emitSlotIndexDigit(m, mem8[loc_3d]);
}
