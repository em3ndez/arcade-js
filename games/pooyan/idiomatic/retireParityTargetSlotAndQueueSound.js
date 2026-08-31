// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { queueSoundCommand05 } from "./queueSoundCommand05.js";
import { ENEMY_TARGET_REC0, ENEMY_TARGET_REC1 } from "./names.js";
/**
 * retireParityTargetSlotAndQueueSound — clear the interrupt-parity target record and enqueue its sound.
 *
 * WHAT IT IS
 * ----------
 * A tiny shared tail that wipes one of the two hunter/enemy *target* records to zero
 * and requests a single sound effect, then aborts back past the routine that reached
 * it. The two records are a matched pair — ENEMY_TARGET_REC0 (0x8c90) and
 * ENEMY_TARGET_REC1 (0x8ca8), one 0x18-byte actor record apart — that hold the enemy
 * the launch arrow is currently aiming at / diving on. Exactly one of the pair is the
 * "active" slot at a time, and which one is chosen by the parity of the Z80 interrupt
 * register I: I == 0 selects slot 0, any other value selects slot 1. This routine tears
 * the selected slot down to all-zero (a free/empty record) and pays out the effect that
 * accompanies that teardown.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is the paired-record clear reached at the end of
 * applyRoundDeltaAndRearmMatchedRecord: once that routine has matched a record, nudged
 * its position by the per-round delta, and re-armed it, it retires the consumed
 * I-parity target slot here and stops. A record with a zeroed head byte reads as
 * free/inactive, so a later spawn pass can reclaim the slot. Because the whole
 * sequence ends in an abort (see RETURN below), clearing the slot is the last work
 * done on that path.
 *
 * ROM 0x6274-0x6286.
 *
 * GROUNDING: [seen] — the interrupt-parity target-record pair this clears,
 * ENEMY_TARGET_REC0 / ENEMY_TARGET_REC1, is confirmed, as is its sole caller
 * applyRoundDeltaAndRearmMatchedRecord.
 *
 * RETURN: the caller's continuation flag. This routine always reports false — the abort
 * branch — so the caller stops its remaining work; control unwinds one level further
 * than an ordinary return, skipping the frame that reached in here. Every path takes
 * that skip, so the answer is unconditionally false.
 *
 * LIVE-OUT: memory only — the zeroed record body and the sound-command queue writes.
 */

const RECORD_LEN = 0x18; // one actor record: 0x18 (24) bytes, the stride between the paired slots

export function retireParityTargetSlotAndQueueSound(m, iReg = m.regs.i) {
  // Select the active target record by the parity of the Z80 interrupt register I:
  // I == 0 -> slot 0 (ENEMY_TARGET_REC0 @0x8c90), any other value -> slot 1
  // (ENEMY_TARGET_REC1 @0x8ca8, one record-stride higher). Only the selected slot is
  // touched below; its partner is left untouched.
  const base = iReg === 0 ? ENEMY_TARGET_REC0 : ENEMY_TARGET_REC1;

  // Wipe the whole 0x18-byte body of the selected record to zero. A record whose head
  // byte is zero reads as free/inactive, so this retires the target and returns the
  // slot to the spawn pool. (fillByteRun is the machine's memset primitive, reached via
  // the restart-0x10 vector.)
  fillByteRun(m, base, 0x00, RECORD_LEN); // zero the record body

  // Request sound-effect command 0x05: appended to the shared sound-command queue that
  // the audio processor drains one entry per frame — the effect that goes with the
  // target teardown.
  queueSoundCommand05(m); // enqueue the fixed sound command

  // Always the abort branch: report false so the caller abandons its remaining work and
  // control unwinds one extra level, skipping the frame that called in here.
  return false; // always the abort branch
}
