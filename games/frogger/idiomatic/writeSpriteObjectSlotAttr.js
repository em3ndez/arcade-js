// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeSpriteObjectSlotAttr — stage an active sprite-object's attribute + code into its IY sprite slot.
 * LIVE-OUT: memory-only (writes the two IY slot bytes; IX object record read-only).
 */
import { OBJECT_STATE_ATTR_TABLE } from "./names.js";

export function writeSpriteObjectSlotAttr(m, record = m.regs.ix, slot = m.regs.iy) {
  const { mem8 } = m;

  const state = mem8[(record + 6)];
  if (state === 0) return;

  const attr = mem8[(OBJECT_STATE_ATTR_TABLE + state)] | mem8[(record + 5)];
  mem8[(slot + 1)] = attr;
  mem8[(slot + 2)] = 2;
}
