// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { playerShipHandler } from "./playerShipHandler.js";
import { playerShotHandler } from "./playerShotHandler.js";
import { alienShotSlot2Handler } from "./alienShotSlot2Handler.js";
import { alienShotSlot3Handler } from "./alienShotSlot3Handler.js";
import { saucerHandler } from "./saucerHandler.js";
import { attractAnimHandler } from "./attractAnimHandler.js";
import {
  GAME_OBJECT_TABLE,
  PLAYER_SHIP_HANDLER_ADDR, PLAYER_SHOT_HANDLER_ADDR,
  ALIEN_SHOT_SLOT2_HANDLER_ADDR, ALIEN_SHOT_SLOT3_HANDLER_ADDR, SAUCER_HANDLER_ADDR,
  ATTRACT_ANIM_HANDLER_ADDR,
} from "./names.js";

// The five in-game object records each carry a fixed handler target that is never rewritten. The
// attract-demo object table (base 0x2050) adds one more: runHandshakedAttractAnim block-copies a fixed
// descriptor (ROM 0x1bc0, target 0x050e) into 0x2050, and the walker dispatches it every reveal cycle.
// Every target is a deterministic constant, so the walker's computed dispatch is a static map to the
// idiomatic handlers.
const HANDLERS = {
  [PLAYER_SHIP_HANDLER_ADDR]: playerShipHandler,
  [PLAYER_SHOT_HANDLER_ADDR]: playerShotHandler,
  [ALIEN_SHOT_SLOT2_HANDLER_ADDR]: alienShotSlot2Handler,
  [ALIEN_SHOT_SLOT3_HANDLER_ADDR]: alienShotSlot3Handler,
  [SAUCER_HANDLER_ADDR]: saucerHandler,
  [ATTRACT_ANIM_HANDLER_ADDR]: attractAnimHandler,
};

/**
 * walkObjectTable — the object/timer dispatcher the interrupt bodies run each half-frame.
 *
 * WHAT IT IS
 *   Walks a table of 16-byte object records starting at `base`. Each record carries a countdown and a
 *   handler address; the walker counts the record down in place and, when it comes due, calls the
 *   matching handler. This is the machine's per-frame "who runs now" loop for the ship, shots, saucer
 *   and the attract reveal animation.
 *
 * ROLE IN THE MACHINE
 *   Called by the interrupt bodies each half-frame -- over the vblank object table 0x2010
 *   (GAME_OBJECT_TABLE, via walkVblankObjectTable) and over the mid table 0x2020 directly
 *   (mechanisms.md, the object dispatcher). Record layout: rec+0/rec+1 = a 16-bit frame timer (hi:lo),
 *   rec+2 = a gate byte, rec+3/rec+4 = the little-endian handler target address, and rec+4 onward is
 *   the handler's own record data. A record only dispatches once BOTH the 16-bit timer and the gate
 *   byte have drained to zero. Every target is a deterministic constant seeded from a fixed ROM
 *   template at round start (the five in-game handlers plus the attract-demo reveal handler), so the
 *   computed dispatch is a static map (HANDLERS) to the idiomatic handler functions. The handler is
 *   passed the record pointer rec+4 as its argument and edits its own record in place. A handler may
 *   arm a warm restart by setting m.nextMain, in which case the walk stops so the interrupt returns
 *   promptly and the engine can swap the main flow.
 *
 * ROM 0x024b.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (record timers/data mutated; handlers do their own IO). Returns on the 0xff
 * end sentinel or as soon as a handler arms a restart.
 */
export function walkObjectTable(m, base = GAME_OBJECT_TABLE) {
  let rec = base;
  for (;;) {
    // rec+0 is the table sentinel / high timer byte. 0xff ends the walk; 0xfe marks a skipped record
    // (fall through to the +0x10 step at the bottom without touching it).
    const hi = m.mem8[rec];
    if (hi === 0xff) return;
    if (hi !== 0xfe) {
      const lo = m.mem8[rec + 1];
      if (((hi | lo) & 0xff) !== 0) {
        // The 16-bit frame timer (hi:lo) is still running: decrement it in place and move on.
        const next = u16(((hi << 8) | lo) - 1);
        m.mem8[rec] = next >> 8;
        m.mem8[rec + 1] = next;
      } else if (m.mem8[rec + 2] !== 0) {
        // Timer done but the gate byte (rec+2) still counting: tick it down and move on.
        m.mem8[rec + 2] = u8(m.mem8[rec + 2] - 1);
      } else {
        // Both counters drained: read the little-endian handler target (rec+3/rec+4) and look it up in
        // the static handler map.
        const target = m.mem8[rec + 3] | (m.mem8[rec + 4] << 8);
        const handler = HANDLERS[target];
        if (!handler) {
          // Every legal target is a fixed constant, so an unknown one means the record table was
          // mis-seeded -- fail loudly rather than dispatch into nothing.
          throw new Error(
            `unexpected object-handler target 0x${target.toString(16).padStart(4, "0")} at record ` +
              `0x${rec.toString(16).padStart(4, "0")} -- every object-record handler target (the five ` +
              "in-game records plus the attract reveal-animation record) is a deterministic constant; a " +
              "non-map target means the record table was mis-seeded",
          );
        }
        // Run the handler with the record's own data pointer (rec+4); it edits its record in place.
        handler(m, u16(rec + 4));
        // If the handler armed a warm restart, stop the walk so the interrupt returns and the flow swaps.
        if (m.nextMain) return;
      }
    }
    // Advance to the next 16-byte record.
    rec = u16(rec + 0x10);
  }
}
