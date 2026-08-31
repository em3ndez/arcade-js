// SPDX-License-Identifier: GPL-3.0-only
import { TAMPER_OBJECT_FREEZE_FLAG } from "./names.js";
import { guardTilemapIntegrity } from "./guardTilemapIntegrity.js";

/**
 * guardObjectFreezeIntegrity — the first of two self-checking traps that shadow the deep
 * play path, an object-freeze tamper gate standing in front of the phase-4 tilemap checksum.
 *
 * WHAT IT IS
 *   ROM 0x50f1 (0x50f1-0x510f). Grounding: [seen].
 *   The machine keeps a small anti-tamper lattice woven through normal play: passive tripwires
 *   that read the same values on an untouched board every time, and divert only when the ROM
 *   image or the playfield has been altered. This routine is the object-freeze arm of that
 *   lattice. On an intact board it does nothing observable but pass control onward; on a
 *   tampered board it is designed to be pulled off the normal path so play can never continue.
 *
 * ROLE IN THE MACHINE
 *   The main-loop re-arm state (sub-state 0) reaches this gate once per qualifying frame —
 *   only when bit 2 of ROUND_COUNTER (0x8907) is set — before it re-arms its latches and runs
 *   a worker frame. The gate first inspects the object-freeze flag, then hands off to the
 *   playfield-tilemap checksum guard (guardTilemapIntegrity) that does the heavier verification.
 *   So this routine is the outer shell: a cheap flag test guarding the entrance to the real check.
 *
 * THE TAMPER FLAG (0x89fb)
 *   TAMPER_OBJECT_FREEZE_FLAG lives in the panel/timer/tamper-counter band of work RAM. On an
 *   untouched image it holds zero. When it is non-zero the original transfers control to a
 *   handler at 0x5119 that is only ever reached with corrupted data — an arm with no legitimate
 *   path back into normal play. That divergence is modelled here as a hard trap.
 *
 * THE DISCARDED SELF-CHECKSUM (not reproduced)
 *   On the clear-flag path the original additionally folds a 16-bit strided sum over the bytes
 *   of the guard routine it is about to run — reading that code as data, byte by byte, up to a
 *   0xc9 terminator — and compares the low byte of that sum against a constant that happens to
 *   sit at 0x5119, the very address the flag branch jumps to. That compare only sets processor
 *   flags: there is no divergent exit for a mismatch, so it has no observable effect on state.
 *   Being a pure decoy, it is omitted here; only the flag gate and the handoff survive.
 *
 * LIVE-OUT: memory only, entirely via the delegate guard. No register output of its own.
 */

export function guardObjectFreezeIntegrity(m) {
  // Step 1 — the object-freeze gate (ROM 0x50f1-0x50f6: ld a,(0x89fb) / and a / jr nz).
  // Read the object-freeze tamper flag at 0x89fb. On an intact board it is always zero and
  // this branch is dead; a non-zero value means the object-freeze protection has been tripped,
  // which the machine treats as the corrupted-data arm that leads to the unreachable handler
  // at 0x5119. Take that arm as a trap so a tampered board cannot proceed down the deep path.
  if (m.mem8[TAMPER_OBJECT_FREEZE_FLAG] !== 0) {
    throw new Error("guardObjectFreezeIntegrity: object-freeze tamper trap (integrity guard)");
  }
  // Step 2 — hand off to the checksum guard (ROM 0x510f: jp 0x6ac5, entering the guard as code).
  // With the freeze flag clear, fall straight into the phase-4 tilemap checksum guard, which
  // one-shot-verifies the playfield tilemap and is itself the second tamper trap. Whatever it
  // writes or diverts into is this routine's only lasting effect on the machine.
  return guardTilemapIntegrity(m);
}
