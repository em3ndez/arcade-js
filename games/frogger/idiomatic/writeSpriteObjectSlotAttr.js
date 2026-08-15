// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeSpriteObjectSlotAttr — stage an active sprite-object's attribute + code into its IY sprite slot.
 * LIVE-OUT: memory-only (writes the two IY slot bytes; IX object record read-only).
 */
import { OBJECT_STATE_ATTR_TABLE } from "./names.js";

export function writeSpriteObjectSlotAttr(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;
  const slot = regs.iy;

  const state = mem8[(record + 6) & 0xffff];
  if (state === 0) return;

  const attr = mem8[(OBJECT_STATE_ATTR_TABLE + state) & 0xffff] | mem8[(record + 5) & 0xffff];
  mem8[(slot + 1) & 0xffff] = attr;
  mem8[(slot + 2) & 0xffff] = 2;
}
