// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { playerShipHandler } from "./playerShipHandler.js";
import { playerShotHandler } from "./playerShotHandler.js";
import { alienShotSlot2Handler } from "./alienShotSlot2Handler.js";
import { alienShotSlot3Handler } from "./alienShotSlot3Handler.js";
import { saucerHandler } from "./saucerHandler.js";
import {
  GAME_OBJECT_TABLE,
  PLAYER_SHIP_HANDLER_ADDR, PLAYER_SHOT_HANDLER_ADDR,
  ALIEN_SHOT_SLOT2_HANDLER_ADDR, ALIEN_SHOT_SLOT3_HANDLER_ADDR, SAUCER_HANDLER_ADDR,
} from "./names.js";

// The five in-game object records each carry a fixed handler target that is never rewritten, so the
// walker's computed dispatch is a static map to the idiomatic handlers.
const HANDLERS = {
  [PLAYER_SHIP_HANDLER_ADDR]: playerShipHandler,
  [PLAYER_SHOT_HANDLER_ADDR]: playerShotHandler,
  [ALIEN_SHOT_SLOT2_HANDLER_ADDR]: alienShotSlot2Handler,
  [ALIEN_SHOT_SLOT3_HANDLER_ADDR]: alienShotSlot3Handler,
  [SAUCER_HANDLER_ADDR]: saucerHandler,
};

// Walk the 16-byte object/timer records from `base`: a first byte of 0xff ends the walk, 0xfe skips the
// record. Otherwise the record's 16-bit frame timer counts down in place while nonzero; once it reaches
// zero its gate byte counts down; and only when both are zero does the record dispatch to its handler,
// which runs directly as JS with the record pointer (rec+4) passed as its argument. A handler may arm a
// warm restart, in which case the walk stops so the interrupt returns promptly and the engine can swap
// the main flow.
export function walkObjectTable(m, base = GAME_OBJECT_TABLE) {
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
        handler(m, u16(rec + 4));
        if (m.nextMain) return;
      }
    }
    rec = u16(rec + 0x10);
  }
}
