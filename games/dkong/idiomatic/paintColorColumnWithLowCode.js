// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColorColumnWithLowCode — the colour-cycle blink driver's LOW-CODE arm: preset the
 * fill code to 0x10, then paint the 3-cell colour column and hold the sprite blink. ROM 0x04a1.
 *
 * The state-0 colour-cycle driver runs a per-frame sweep counter (0x6390); its tail loc_0486
 * chooses the colour-attribute code to lay down the column at 0x75C4 and routes into the paint
 * by counter phase (on boards other than 4):
 *   - counter == 0, or counter's bit 6 clear   -> HERE, with code 0x10 (the LOW code)
 *   - counter != 0 and counter's bit 6 set      -> paintColorColumnAndHoldBlink (0x04a3), code 0xEF
 * So this arm supplies the lower of the two cycled colour-attribute codes (0x10 makes the column
 * 0x10/0x0F/0x0E; the sibling inline 0xEF arm makes it 0xEF/0xEE/0xED) — the element flashes
 * between the two codes as the sweep counter advances. Its ONLY own instruction is `ld a,0x10`;
 * it then FALLS THROUGH into loc_04a3, so its full observable effect is exactly
 * paintColorColumnAndHoldBlink run with A = 0x10 (the DE = 0x0020 row stride and the C toggle
 * phase are live-in from loc_0486, and the incoming A is discarded — this arm forces 0x10).
 *
 * loc_04a3 is already idiomatic, so the fall-through is one direct call, no register-ABI
 * marshalling. Net effect: writes the three colour cells (0x75C4/0x75E4/0x7604 at the 0x20
 * stride) and sprite record #1's code byte (0x6905); reads DE / C live-in and 0x6905.
 *
 * Memory-equivalent to the frozen oracle — equivalence-04a1.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (loc_0486 routes here on boards
 *           1–3 with DE=0x20), plus crafted entries a short attract need not reach: the
 *           once-per-sweep toggle-phase store ((C & 0x47)==0x40), a non-0x20 stride (DE honored
 *           end-to-end), and an incoming A!=0x10 (pins that this arm FORCES 0x10). Not exhaustive
 *           (the effect is target-memory × C, delegated to the already-gated tail). Teeth: a
 *           wrong-code twin (presets 0xEF) and a no-preset twin (skips the `ld a,0x10`) — both
 *           caught on sentinel-painted colour pages.
 * LIVE-OUT: memory-only — the three colour cells and sprite code 0x6905. No live registers/
 *           flags: the successor chain (loc_04a3 -> loc_04ac, then loc_197a's next call) reads
 *           no register the oracle leaves; A/B/C/F are dead ABI. SP/PC are the single net `ret`
 *           the JS call stack replaces (the harness supplies one m.ret() to line them up).
 * NAMES:    none imported — this routine references no RAM address directly; 0x10 is an immediate
 *           and the 0x75C4/0x6905 addresses are owned by the paint it falls into (its own file).
 */
import { paintColorColumnAndHoldBlink } from "./paintColorColumnAndHoldBlink.js";

export function paintColorColumnWithLowCode(m) {
  // ld a,0x10 — preset the LOW colour-attribute code, then fall into the column paint.
  m.regs.a = 0x10;
  paintColorColumnAndHoldBlink(m);
}
