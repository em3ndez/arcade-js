// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
/**
 * clearTargetActorRecord — wipe one actor record to zero.
 * ROM 0x221e. Grounding: [seen].
 *
 * WHAT IT IS
 *   A tiny object-clear helper. Given the base address of a single actor record, it blanks the
 *   whole record — all 0x18 (24) consecutive bytes — back to 0x00.
 *
 * ROLE IN THE MACHINE
 *   The engine keeps its moving objects in the actor arena: a flat array of fixed-size 0x18-byte
 *   records, each packing one actor's entire per-frame state (kind, coordinates, timers, tile ids,
 *   flags) into the same byte offsets. A record whose header byte is zero reads as a free slot, so
 *   spawning an actor means finding a zeroed record to claim and retiring one means zeroing it
 *   again. This routine is that retire-wipe: the launch/target pipeline calls it to free a slot the
 *   instant an actor is done — a hunter after its post-spawn hold drains, or a target that has
 *   flown out its launch arc or run its hit/countdown timer to zero. One call clears exactly one
 *   record, leaving the slot ready for the next spawn to reuse.
 *
 * ADDRESSING
 *   The record to wipe is named by the index register the engine loads with the current actor's
 *   base address (IY). Callers point it at the record they want gone; this routine reads it as the
 *   fill base. With no caller-supplied base, it defaults to that same record pointer.
 *
 * LIVE-OUT (what it leaves behind for the caller to read)
 *   • memory: the 0x18 bytes at the record are all 0x00 — the slot now reads free.
 *   • HL: advanced to record base + 0x18, i.e. just past the record it cleared (the fill primitive
 *     walks the pointer forward as it writes, so it ends one byte beyond the last one blanked).
 *   • B: drained to 0 — the fill's counter runs down to zero and callers read that back as a
 *     known-zero value.
 *   • A: 0x00 — the fill value stays in A after the run, since the routine never reloads it.
 */
const RECORD_LEN = 0x18;
const CLEAR_FILL = 0x00;

export function clearTargetActorRecord(m, base = m.regs.iy) {
  // Aim the memset primitive at this record and blank the whole 0x18-byte span with 0x00. The
  // primitive (fillByteRun, ROM 0x0010) writes the fill value into RECORD_LEN consecutive bytes
  // from the base, advancing the pointer as it goes: it returns the base+0x18 pointer (HL) and
  // leaves its loop counter drained to zero (B).
  const advanced = fillByteRun(m, base, CLEAR_FILL, RECORD_LEN); // HL := base+0x18, B := 0
  // The fill value the run wrote (0x00) is still the last thing in A, because nothing here reloads
  // A after the clear — mirror that so A reads 0. Hand back the advanced base+0x18 pointer.
  return (m.regs.a = CLEAR_FILL), advanced; // A := 0 (cleared fill left in A); HL is the advanced pointer
}
