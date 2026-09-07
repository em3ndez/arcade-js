// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearGateOnPendingRequest -- acknowledge a pending request flag and reset the gate it governs.
 *
 * WHAT IT IS
 *   A guarded two-store routine. If bit 0 of the request flag loc_420b is set, it consumes the request by
 *   zeroing loc_420b and clears the companion behavior gate loc_4208; if the bit is clear it does nothing.
 *   The pattern is the classic one-shot handshake: the request is a signal raised elsewhere, and this
 *   routine both takes it down and resets the state that request controls.
 *
 * ROLE IN THE MACHINE
 *   loc_4208 is the player-shot in-flight / armed gate: the shot-vs-field collision passes
 *   (flagPlayerShotHitOnFormation, flagPlayerShotHitsOnObjects) and the per-frame pipeline
 *   runGameplayFrameAndAdvanceOnFieldClear only act while its bit 0 is set. loc_420b carries the paired
 *   request bit (advancePlayerShot raises it when the bullet reaches the retire window near the top of
 *   travel). Acknowledging the request here disarms the shot so a fresh one may be fired.
 *
 * ROM 0x08e5.  Grounding: [seen].
 *
 * LIVE-OUT: when loc_420b bit0 was set -> loc_420b:=0 and loc_4208:=0; otherwise no change.
 */
import { loc_420b, loc_4208 } from "./names.js";

export function clearGateOnPendingRequest(m) {
  const { mem8 } = m;

  // Nothing to do unless the request flag's bit 0 is set: a clear bit means no request is pending.
  if ((mem8[loc_420b] & 1) === 0) return;

  // Consume the request (take the signal down) and reset the behavior gate it governs so the
  // shot/collision machinery sees the gate closed again.
  mem8[loc_420b] = 0;
  mem8[loc_4208] = 0;
}
