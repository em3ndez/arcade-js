import { retireBarrelAtEndOfRange } from "./retireBarrelAtEndOfRange.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2101 — offer an object to the bottom-of-screen retirement check, then run the left-edge
 * check only if the first let the object live.
 *
 * WARNING: the bottom check can take control away — on the retire arm it pulls the continuation
 * back off the stack itself and diverts into the shared object-sprite tail, reporting that by
 * answering false. Obeying that false (not running the left-edge check) is the one thing this
 * routine must get right. The object record stays in ix; both checks read it off the machine.
 */

export function loc_2101(m) {
  m.push16(0x2104);

  if (!m.call(0x24b4)) return undefined;

  return retireBarrelAtEndOfRange(m);
}
