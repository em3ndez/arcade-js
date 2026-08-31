// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  HUNTER_SPAWN_SUBCOUNTER,
  HUNTER_SPAWN_SUBCOUNTER_VRAM,
  SUBSTATE_FIELD1_COUNTER,
  SUBSTATE_FIELD1_VRAM,
  SUBSTATE_FIELD2_VALUE,
  SUBSTATE_FIELD2_VRAM,
  SUBSTATE_FIELD3_VALUE,
  SUBSTATE_FIELD3_VRAM,
  SUBSTATE_FIELD3_HUNDREDS_VRAM,
  MAINLOOP_SUBSTATE_SELECTOR,
} from "./names.js";
import { binToPackedBcd } from "./binToPackedBcd.js";
import { drawStackedBcdDigits } from "./drawStackedBcdDigits.js";
import { queueSoundCommand13 } from "./queueSoundCommand13.js";

/**
 * paintSubstateHudDigitsAndAdvancePhase — repaint the three sub-state HUD digit fields, then advance the phase and chirp.
 *
 * Field 1 (subcounter): draw its value as two stacked BCD digits; a raw value >= 10 is packed
 * to BCD first. When the value is 1..11 it is also re-centred to (12 - value), stashed in the
 * field-1 counter, doubled, and drawn as a second field.
 * Field 2: same value-or-packed draw of its own source byte.
 * Field 3: only when nonzero — its source is folded into the field-1 counter, doubled and packed
 * to BCD; a nonzero hundreds tally is latched to the hundreds cell; then drawn.
 * Finally bumps the main-loop sub-state selector and queues the phase sound.
 *
 * LIVE-OUT: memory only — the four HUD digit fields, the field-1 counter, and the selector; the
 * tail's returned ring cursor is idiomatic-only, not load-bearing.
 */

const BCD_THRESHOLD = 0x0a; // values below this draw raw; at/above they pack to BCD first
const RECENTRE_LIMIT = 0x0c; // field-1 second draw only for values 1..11 (< this, nonzero)

export function paintSubstateHudDigitsAndAdvancePhase(m) {
  const { mem8 } = m;

  // Field 1 — value (packed if >= 10), then a re-centred second field for values 1..11.
  const f1 = mem8[HUNTER_SPAWN_SUBCOUNTER];
  drawStackedBcdDigits(m, HUNTER_SPAWN_SUBCOUNTER_VRAM, f1 >= BCD_THRESHOLD ? binToPackedBcd(m, f1).a : f1);
  if (f1 !== 0 && f1 < RECENTRE_LIMIT) {
    const centred = RECENTRE_LIMIT - f1;
    mem8[SUBSTATE_FIELD1_COUNTER] = centred;
    drawStackedBcdDigits(m, SUBSTATE_FIELD1_VRAM, binToPackedBcd(m, centred << 1).a);
  }

  // Field 2 — value, packed if >= 10.
  const f2 = mem8[SUBSTATE_FIELD2_VALUE];
  drawStackedBcdDigits(m, SUBSTATE_FIELD2_VRAM, f2 >= BCD_THRESHOLD ? binToPackedBcd(m, f2).a : f2);

  // Field 3 — only when present: fold into the field-1 counter, draw doubled, latch hundreds.
  const f3 = mem8[SUBSTATE_FIELD3_VALUE];
  if (f3 !== 0) {
    mem8[SUBSTATE_FIELD1_COUNTER] = u8(f3 + mem8[SUBSTATE_FIELD1_COUNTER]);
    const { a: packed, hundreds } = binToPackedBcd(m, u8(f3 << 1));
    if (hundreds !== 0) mem8[SUBSTATE_FIELD3_HUNDREDS_VRAM] = hundreds;
    drawStackedBcdDigits(m, SUBSTATE_FIELD3_VRAM, packed);
  }

  mem8[MAINLOOP_SUBSTATE_SELECTOR] = u8(mem8[MAINLOOP_SUBSTATE_SELECTOR] + 1);
  return queueSoundCommand13(m);
}
