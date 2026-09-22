// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColorColumnWithLowCode — the colour-cycle blink driver's LOW-CODE arm: preset the fill
 * code to 0x10, then fall through into the shared 3-cell colour-column paint. The blink cycles
 * this arm's code against the sibling arm's higher code as the sweep counter advances; the row
 * stride and the blink toggle phase are live-in from the driver's tail, and any incoming code is
 * discarded.
 */
import { paintColorColumnAndHoldBlink } from "./paintColorColumnAndHoldBlink.js";

export function paintColorColumnWithLowCode(m) {
  paintColorColumnAndHoldBlink(m, 0x10);
}
