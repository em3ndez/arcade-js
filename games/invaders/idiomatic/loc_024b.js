// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_028e } from "./loc_028e.js";
import { loc_03bb } from "./loc_03bb.js";
import { loc_0476 } from "./loc_0476.js";
import { loc_04b6 } from "./loc_04b6.js";
import { loc_0682 } from "./loc_0682.js";
import { GAME_OBJECT_TABLE } from "./names.js";

// The five in-game object records each carry a fixed handler target that is never rewritten, so the
// walker's computed dispatch is a static map to the idiomatic handlers.
const HANDLERS = {
  0x028e: loc_028e,
  0x03bb: loc_03bb,
  0x0476: loc_0476,
  0x04b6: loc_04b6,
  0x0682: loc_0682,
};

// Walk the 16-byte object/timer records from `base`: a first byte of 0xff ends the walk, 0xfe skips the
// record. Otherwise the record's 16-bit frame timer counts down in place while nonzero; once it reaches
// zero its gate byte counts down; and only when both are zero does the record dispatch to its handler,
// which runs directly as JS with the record pointer seated in DE/HL. A handler may arm a warm restart, in
// which case the walk stops so the interrupt returns promptly and the engine can swap the main flow.
export function loc_024b(m, base = GAME_OBJECT_TABLE) {
  let rec = base;
  for (;;) {
    const hi = m.mem8[rec];
    if (hi === 0xff) return;
    if (hi !== 0xfe) {
      const lo = m.mem8[rec + 1];
      if (((hi | lo) & 0xff) !== 0) {
        const next = u16(((hi << 8) | lo) - 1);
        m.mem8[rec] = next >> 8;
        m.mem8[rec + 1] = next;
      } else if (m.mem8[rec + 2] !== 0) {
        m.mem8[rec + 2] = u8(m.mem8[rec + 2] - 1);
      } else {
        const target = m.mem8[rec + 3] | (m.mem8[rec + 4] << 8);
        const handler = HANDLERS[target];
        if (!handler) {
          throw new Error(
            `unexpected object-handler target 0x${target.toString(16).padStart(4, "0")} at record ` +
              `0x${rec.toString(16).padStart(4, "0")} -- the five in-game handler targets are static; a ` +
              "non-map target is the entropy-residual attract fork",
          );
        }
        m.regs.de = m.regs.hl = u16(rec + 4);
        handler(m);
        if (m.nextMain) return;
      }
    }
    rec = u16(rec + 0x10);
  }
}
