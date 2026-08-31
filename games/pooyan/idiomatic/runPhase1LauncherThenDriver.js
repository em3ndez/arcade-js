// SPDX-License-Identifier: GPL-3.0-only

// The two spawn sub-steps this frame runs, in order:
//   launchNextScriptedObjectOnDelay        (ROM 0x6e86) — the scripted single-object launcher
//   drivePhase1RecordsThenCheckCompletion  (ROM 0x6edb) — the per-record driver + completion test
import { launchNextScriptedObjectOnDelay } from "./launchNextScriptedObjectOnDelay.js";
import { drivePhase1RecordsThenCheckCompletion } from "./drivePhase1RecordsThenCheckCompletion.js";
// The two anti-tamper guard cells the entry gate reads:
//   SIGNATURE_MISMATCH_FLAG (0x8ef0) — a work-RAM ROM-signature mismatch flag (1 on a mismatch)
//   TAMPER_FREEZE_FLAG      (0x881e) — a running anti-tamper miss tally bumped by the ROM/signature
//                                      checksum guards; nonzero freezes spawns
import { TAMPER_FREEZE_FLAG, SIGNATURE_MISMATCH_FLAG } from "./names.js";

/**
 * runPhase1LauncherThenDriver — the phase-1 spawner gate (ROM 0x6e75-0x6e85).
 *
 * WHAT IT IS
 *   The per-frame body that keeps the phase-1 spawn sequence moving. It is the point where the
 *   two scripted-spawn sub-steps are chained together behind a single anti-tamper guard: first
 *   the launcher that releases the next scripted object once its delay elapses, then the driver
 *   that advances every enemy-actor record and tests whether phase 1 has finished.
 *
 * ITS ROLE IN THE MACHINE
 *   Phase 1 is the scripted-spawn phase: objects are released one at a time on a timed launch
 *   script, driven through their per-record state, and the phase closes when the script is spent
 *   and the field is clear. This routine is the gate the phase frame flows through — it decides
 *   whether spawning may proceed at all (the tamper guard below) and, when it may, does the whole
 *   phase-1 frame's work by delegating to the launcher and the driver.
 *
 * ROM ADDRESS: 0x6e75-0x6e85.
 *
 * Grounding: [seen].
 *
 * LIVE-OUT: memory only. This routine returns nothing meaningful; every effect is a RAM write
 *   made by the launcher and the driver (the newly launched object's record, the advanced
 *   enemy-actor records, and — on completion — the intro-phase counter, the queued display
 *   commands, and the intro delay). The caller returns straight after and reads no result back.
 */
export function runPhase1LauncherThenDriver(m) {
  const { mem8 } = m;

  // ANTI-TAMPER SPAWN GATE (ROM 0x6e75-0x6e7c).
  //   OR the two guard cells together — the ROM-signature mismatch flag SIGNATURE_MISMATCH_FLAG
  //   (0x8ef0) and the tamper-miss tally TAMPER_FREEZE_FLAG (0x881e). On an intact ROM both are
  //   permanently zero, so the OR is zero and spawning proceeds. If either were set, the hardware
  //   would take the skip-spawn arm — a jump to 0x4c92 — but 0x4c92 is a data table (0x95/0x98
  //   bytes), not code, so that arm cannot fire in correct operation. Model it as unreachable: if
  //   control ever reaches here with a guard set, the ROM image has been corrupted, so trap it.
  if (mem8[SIGNATURE_MISMATCH_FLAG] | mem8[TAMPER_FREEZE_FLAG]) {
    throw new Error("runPhase1LauncherThenDriver: skip-spawn arm unreachable with a valid ROM (target is data)");
  }

  // STEP 1 — LAUNCH (ROM 0x6e7f, call 0x6e86).
  //   Run the scripted single-object launcher. When the launch delay has elapsed it releases the
  //   next object named by the launch script into the field; otherwise it just counts the delay
  //   down. At most one object enters per frame, which is what paces the phase-1 build-up.
  launchNextScriptedObjectOnDelay(m);

  // STEP 2 — DRIVE + COMPLETION TEST (ROM 0x6e82, call 0x6edb).
  //   Run the per-record driver: step the state machine for the 14 enemy-actor records
  //   (ENEMY_ACTOR_TABLE 0x8ae0, stride 0x18), then test for phase completion — when the launch
  //   script (0x8f4a) has reached its 0xff terminator and all three projectile slots (0x8bea,
  //   stride 0x18) are idle, it advances the intro phase, queues the phase-end display commands,
  //   and arms the intro delay.
  drivePhase1RecordsThenCheckCompletion(m);
}
