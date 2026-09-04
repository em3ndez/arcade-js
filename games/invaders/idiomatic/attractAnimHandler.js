// SPDX-License-Identifier: GPL-3.0-only
import { alienShotSlot4Handler } from "./alienShotSlot4Handler.js";

/**
 * attractAnimHandler — the attract-demo reveal animation's object handler (ROM 0x050e).
 *
 * WHAT IT IS
 *   The object-table handler for the ISR-handshaked attract reveal animation (the credit / high-score
 *   attract screen). runHandshakedAttractAnim arms it by block-copying a fixed 16-byte ROM descriptor
 *   (0x1bc0 — its 16-bit walker countdown starts at 0x1000, its handler target is 0x050e) into the
 *   attract object table at 0x2050 and then spinning on ATTRACT_ANIM_ACK (0x2055). When the record's
 *   countdown expires the object walker dispatches to this handler; running the shared body toggles the
 *   0x2055 handshake byte (set then clear) so the reveal completes.
 *
 * ROLE IN THE MACHINE
 *   In the ROM, 0x050e is a `pop h` entry ONE byte before the loc_050f body (alienShotSlot4Handler): the
 *   walker's `pchl` (loc_024b @ 0x026e) pushes the record pointer before jumping, so this direct-dispatched
 *   entry pops it to rebalance the stack before falling into the shared body — exactly as the saucer
 *   handler (0x0682) does at its own entry. That popped pointer is dead (loc_0550 overwrites HL before any
 *   use), so the entry is pure stack management with no memory/IO effect. In the idiomatic layer handlers
 *   are plain JS calls (the walker pushes nothing), so there is no pointer to pop: the observable behaviour
 *   is exactly the shared loc_050f body (alienShotSlot4Handler), which the saucer handler reaches in-game
 *   via a conditional tail-jump to 0x050f. A dispatch target in none of the six named handlers means a
 *   mis-seeded record.
 *
 * ROM 0x050e.  Grounding: [seen] — during input-free attract, 0x050e executes every reveal cycle and
 * 0x2055 bit0 toggles 0 -> 1 -> 0 through the block-copy at 0x1a34 (games/invaders/tools/lua/ground_050e.lua).
 * LIVE-OUT: whatever alienShotSlot4Handler leaves (the shared object-step body it delegates to).
 */
export function attractAnimHandler(m) {
  // No stack rebalance needed in JS (nothing was pushed); the entire observable behaviour is the shared
  // loc_050f object-step body, so delegate straight to it.
  return alienShotSlot4Handler(m);
}
