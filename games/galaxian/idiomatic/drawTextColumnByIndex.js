// SPDX-License-Identifier: GPL-3.0-only
// Index the 5-byte text-draw descriptor table by A, then paint that descriptor's column.
import { drawTextColumnFromDescriptor } from "./drawTextColumnFromDescriptor.js";
import { TEXT_DESCRIPTOR_TABLE } from "./names.js";

const RECORD_STRIDE = 5;

export function drawTextColumnByIndex(m, index = m.regs.a) {
  const record = TEXT_DESCRIPTOR_TABLE + index * RECORD_STRIDE;
  return drawTextColumnFromDescriptor(m, record);
}
