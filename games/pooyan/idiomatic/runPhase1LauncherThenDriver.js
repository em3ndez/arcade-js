// SPDX-License-Identifier: GPL-3.0-only
import { launchNextScriptedObjectOnDelay } from "./launchNextScriptedObjectOnDelay.js";
import { drivePhase1RecordsThenCheckCompletion } from "./drivePhase1RecordsThenCheckCompletion.js";
import { TAMPER_FREEZE_FLAG, SIGNATURE_MISMATCH_FLAG } from "./names.js";
/**
 * runPhase1LauncherThenDriver — phase-1 spawner gate. With neither guard flag set, runs the
 * single-object launcher then the per-record driver. A set flag would take a
 * skip-spawn jump into data (a dead trap), so model it as unreachable.
 *
 * LIVE-OUT: memory only — the caller returns straight after and reads no register back.
 */
export function runPhase1LauncherThenDriver(m) {
  const { mem8 } = m;

  if (mem8[SIGNATURE_MISMATCH_FLAG] | mem8[TAMPER_FREEZE_FLAG]) {
    throw new Error("runPhase1LauncherThenDriver: skip-spawn arm unreachable with a valid ROM (target is data)");
  }

  launchNextScriptedObjectOnDelay(m);
  drivePhase1RecordsThenCheckCompletion(m);
}
