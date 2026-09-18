// SPDX-License-Identifier: GPL-3.0-only
/**
 * addToSpriteObjectColumn — add one signed delta into the SAME field of all ten sprite-object
 * records at once, shifting a whole column of them together.
 *
 * A shim in front of the general strided add. It hard-wires the two numbers specific to the
 * sprite-object block — a stride of 4 (one record) and a count of 10 — NOT read from the
 * caller. The caller supplies which field to hit and the signed delta: pointing at the first
 * byte moves every record's X, three bytes in moves the Y. The 8-bit add wraps. The stride is
 * a genuine output too: one caller invokes this for it and leaves the add as a side effect.
 */
import { addStrided } from "./addStrided.js";

export function addToSpriteObjectColumn(m) {
  const { regs } = m;
  regs.de = 0x0004; // stride: one sprite-object record; count: ten records
  regs.b = 0x0a;

  addStrided(m);
}
