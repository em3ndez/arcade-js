// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { loc_0ef1 } from "./loc_0ef1.js";
import { ENEMY_TARGET_REC0, ENEMY_TARGET_REC1 } from "./names.js";
/**
 * loc_6274 — clear the interrupt-parity target record and enqueue its sound.
 *
 * Selects the active record by interrupt-register parity (0 -> slot 0, otherwise slot 1),
 * zeroes its whole body, then enqueues the fixed sound command.
 *
 * RETURN: the caller's continuation flag. This routine always reports false — the abort
 * branch — so the caller stops its remaining work rather than continuing past the call.
 * LIVE-OUT: memory only (the cleared record body and the sound-ring writes).
 */

const RECORD_LEN = 0x18;

export function loc_6274(m, iReg = m.regs.i) {
  const base = iReg === 0 ? ENEMY_TARGET_REC0 : ENEMY_TARGET_REC1;
  loc_0010(m, base, 0x00, RECORD_LEN); // zero the record body
  loc_0ef1(m); // enqueue the fixed sound command
  return false; // always the abort branch
}
