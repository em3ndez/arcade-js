// SPDX-License-Identifier: GPL-3.0-only
import { loc_2015 } from "./names.js";

/**
 * isArmTriggerSet — poll the round-start arm sentinel.
 *
 * WHAT IT IS
 *   A one-cell predicate: it reports whether the arm-trigger cell holds the "armed" sentinel value 0xff.
 *   It touches nothing else — reads no register, writes no memory.
 *
 * ROLE IN THE MACHINE
 *   loc_2015 (0x2015) is a start/arm sentinel: it must read 0xff before the pre-round step
 *   advanceRoundState will fire, and mainLoop gates its round-start blip on this same poll each pass
 *   (mechanisms.md, the in-game main loop). loc_2015 keeps a placeholder name — its exact naming is not
 *   settled, though its 0xff-armed role is understood.
 *
 * ROM 0x0a59-....  Grounding: [seen].
 *
 * LIVE-OUT: the Z flag carries the result. The assignment bridge sets m.regs.fZ so still-frozen 8080
 * callers can branch on it (Z set == 0xff), while the returned boolean serves idiomatic callers.
 */
export function isArmTriggerSet(m) {
  // Compare the arm sentinel against 0xff; publish the result into the Z flag (for frozen callers) and
  // return it as a boolean (for idiomatic callers).
  return (m.regs.fZ = m.mem8[loc_2015] === 0xff);
}
