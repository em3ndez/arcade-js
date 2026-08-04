// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColorColumnWithLowCode — the colour-cycle blink driver's LOW-CODE arm: preset the
 * fill code to 0x10, then paint the 3-cell colour column and hold the sprite blink.
 *
 * The colour-cycle driver runs a per-frame sweep counter; its tail chooses the
 * colour-attribute code to lay down the column and routes into the paint by counter phase
 * (on boards other than the rivet board):
 *   - counter == 0, or counter's bit 6 clear -> HERE, with code 0x10 (the LOW code)
 *   - counter != 0 and counter's bit 6 set   -> the sibling arm, with code 0xEF
 * So this arm supplies the lower of the two cycled colour-attribute codes (0x10 makes the
 * column 0x10/0x0F/0x0E; the 0xEF arm makes it 0xEF/0xEE/0xED) — the element flashes between
 * the two codes as the sweep counter advances. Its ONLY own action is to preset the code to
 * 0x10; it then FALLS THROUGH into the shared column paint, so its full observable effect is
 * exactly that paint run with the code forced to 0x10. The row stride and the blink toggle
 * phase are live-in from the driver's tail, and any incoming code is discarded.
 *
 * Net effect: writes the three colour cells, 0x20 apart, and sprite record #1's code byte;
 * reads the stride and the toggle phase live-in, plus that sprite code byte.
 *
 * LIVE-OUT: memory-only — the three colour cells and the sprite code byte.
 */
import { paintColorColumnAndHoldBlink } from "./paintColorColumnAndHoldBlink.js";

export function paintColorColumnWithLowCode(m) {
  // Preset the LOW colour-attribute code, then fall into the column paint.
  m.regs.a = 0x10;
  paintColorColumnAndHoldBlink(m);
}
