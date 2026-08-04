// SPDX-License-Identifier: GPL-3.0-only
/**
 * confirmObjectHit — confirm an X-matched object slot is also Y-aligned and still
 * eligible, and if so register the hit for the object-interaction state machine.
 *
 * The confirm half of the object-slot collision scan. The scan walks a 3-entry,
 * stride-4 table of collision records, comparing each record's X (+0) against Mario's
 * X; on an X-match it branches here with the matched record's base pointer in the
 * index register. This routine finishes the collision test on it:
 *
 *   - Y alignment: Mario's Y (MARIO_Y) must equal the record's Y byte (+3).
 *   - Eligibility: bit 3 of the record's flag byte (+1) must be CLEAR (the object
 *     has not already been consumed/disabled).
 *
 * If either check fails it returns having touched nothing. If both pass it registers
 * the hit into the shared effect-subsystem flags — the same trio the other producers
 * in that subsystem write — which the interaction state machine services on later
 * frames:
 *   EFFECT_PARAM_PTR = record base pointer (the object the machine acts on)
 *   EFFECT_SELECT    = 0   (sub-flag byte reset)
 *   EFFECT_STATE     = 1   (hit registered / interaction armed)
 *
 * The record pointer only ever walks its LOW BYTE here, so the record offsets wrap
 * inside the record's own 256-byte page; `(low + n) & 0xff` reproduces that exactly,
 * where a plain 16-bit add would read the next page.
 *
 * A leaf: reads and writes memory, calls nothing.
 *
 * LIVE-OUT: memory-only — the three effect-subsystem flag cells.
 */
import { MARIO_Y, EFFECT_STATE, EFFECT_SELECT, EFFECT_PARAM_PTR } from "./names.js";

export function confirmObjectHit(m) {
  const { regs, mem } = m;

  // LIVE-IN: base pointer of the X-matched 4-byte collision record. Only its low byte
  // walks, so record offsets wrap within the page.
  const record = regs.hl;
  const page = record & 0xff00;
  const base = record & 0x00ff;
  const recByte = (off) => mem.read8(page | ((base + off) & 0xff));

  // Y alignment — Mario's Y must equal the record's Y (+3); X already matched upstream.
  if (mem.read8(MARIO_Y) !== recByte(3)) return;

  // Eligibility — bit 3 of the record's flag byte (+1) must be clear (not consumed).
  if (recByte(1) & 0x08) return;

  // Register the hit for the object-interaction (effect) state machine.
  mem.write16(EFFECT_PARAM_PTR, record); // record base pointer
  mem.write8(EFFECT_SELECT, 0x00); //      sub-flag byte reset
  mem.write8(EFFECT_STATE, 0x01); //       state := 1 (hit registered)
}
