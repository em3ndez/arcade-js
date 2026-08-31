// SPDX-License-Identifier: GPL-3.0-only
import { runVblankNmiService } from "./runVblankNmiService.js";

/**
 * enterVblankService — the Z80 NMI vector: a bare jump to the vblank service routine. The trailing bytes
 * in its range are an unreached data region.
 */
export function enterVblankService(m) {
  return runVblankNmiService(m);
}
