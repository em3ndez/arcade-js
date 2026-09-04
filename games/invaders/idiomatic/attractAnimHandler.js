// SPDX-License-Identifier: GPL-3.0-only
import { alienShotSlot4Handler } from "./alienShotSlot4Handler.js";

// Object handler for the ISR-handshaked attract reveal animation (the credit / high-score attract
// screen), armed by runHandshakedAttractAnim: it block-copies a fixed descriptor (ROM 0x1bc0, a
// 16-frame timer whose handler target is 0x050e) into the attract object table at 0x2050 and spins on
// ATTRACT_ANIM_ACK 0x2055. When the record's timer expires the object walker (walkObjectTable) dispatches
// to this handler, which steps the animated object and, via its block-copy back to 0x2055, toggles the
// handshake byte so the reveal completes.
//
// ROM 0x050e is ONE byte before the loc_050f body and enters it through `pop h` (0xe1): the walker's
// `pchl` (loc_024b @ 0x026e) pushes the record pointer before jumping, so this direct-dispatched entry
// pops it to rebalance the stack before falling into the shared body -- exactly as the saucer handler
// (0x0682) does at its own entry. That popped pointer is dead (loc_0550 overwrites HL before any use), so
// the entry is pure stack management with no memory/IO effect. In the idiomatic layer handlers are called
// directly as JS (the walker pushes nothing), so there is no pointer to pop: the observable behaviour is
// exactly the shared loc_050f body (alienShotSlot4Handler), which the saucer handler reaches in-game via
// a conditional tail-jump to 0x050f. MAME-grounded: during input-free attract 0x050e executes every reveal cycle and 0x2055
// bit0 toggles 0 -> 1 -> 0 through the block-copy at 0x1a34 (games/invaders/tools/lua/ground_050e.lua).
export function attractAnimHandler(m) {
  return alienShotSlot4Handler(m);
}
