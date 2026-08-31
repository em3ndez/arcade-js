// SPDX-License-Identifier: GPL-3.0-only
import { TAMPER_OBJECT_FREEZE_FLAG } from "./names.js";
import { guardTilemapIntegrity } from "./guardTilemapIntegrity.js";

/**
 * guardObjectFreezeIntegrity — object-freeze tamper gate ahead of the phase-4 tilemap checksum.
 *
 * When the object-freeze flag is set control diverts to an anti-tamper handler that is
 * unreachable with intact data, so that arm traps. Otherwise it runs the checksum guard.
 * The original also folds a strided sum of the guard's own bytes whose result is compared
 * and discarded (a decoy with no observable effect), so it is not reproduced here.
 *
 * LIVE-OUT: memory only, entirely via the delegate. No register output.
 */

export function guardObjectFreezeIntegrity(m) {
  if (m.mem8[TAMPER_OBJECT_FREEZE_FLAG] !== 0) {
    throw new Error("guardObjectFreezeIntegrity: object-freeze tamper trap (integrity guard)");
  }
  return guardTilemapIntegrity(m);
}
