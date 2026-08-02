// SPDX-License-Identifier: GPL-3.0-only
/**
 * confirmObjectHit — confirm an X-matched object slot is also Y-aligned and still
 * eligible, and if so register the hit for the object-interaction state machine.
 * ROM 0x19ED.
 *
 * The confirm half of sub_19da's object-slot scan (ROM 0x19DA). sub_19da walks the
 * 3-entry, stride-4 OBJECT_COLLISION_SPRITES table (0x6A0C) comparing each record's
 * X (+0) against Mario's X (MARIO_X); on an X-match it jp-z's here with HL LIVE-IN =
 * the matched record's base pointer. This routine finishes the collision test on it:
 *
 *   - Y alignment: Mario's Y (MARIO_Y) must equal the record's Y byte (+3).
 *   - Eligibility: bit 3 of the record's flag byte (+1) must be CLEAR (the object
 *     has not already been consumed/disabled).
 *
 * If either check fails it returns having touched nothing. If both pass it registers
 * the hit into the shared effect-subsystem flags — the same trio animateEffectSpriteThenRearmEffect and
 * sub_1a33's edge pickup write — which the interaction state machine (EFFECT_SELECT's
 * loc_1dc9 / EFFECT_PARAM_PTR's loc_1e15 …) then services on later frames:
 *   EFFECT_PARAM_PTR (0x6343) = record base pointer (the object the machine acts on)
 *   EFFECT_SELECT    (0x6342) = 0   (sub-flag byte reset)
 *   EFFECT_STATE     (0x6340) = 1   (state := 1 — hit registered / interaction armed)
 *
 * HL only ever walks its low byte here (Z80 `inc l` / `dec l` are 8-bit, H fixed), so
 * the record offsets wrap within the record's own 0x6Axx page; `(l + n) & 0xff`
 * reproduces that exactly (a 16-bit add would read the next page — see the teeth).
 * A leaf: reads and writes memory, calls nothing. Reached by sub_19da's tail jp, so
 * its return goes to sub_19da's caller (the loc_197a per-frame cascade, whose next act
 * is another self-contained call) — so no register or flag is live out.
 *
 * Memory-equivalent to the frozen oracle — equivalence-19ed.test.js.
 * GATE:     crafted, exhaustive over the deciding bytes. Attract never reaches 0x19ed
 *           (sub_19da runs ~1532x but the 0x6A0C table is empty, so no X-match jp-z's
 *           here), so per docs/decompiler-pipeline the gate is real-state-plus-surgical-poke: a Mario-Y
 *           sweep (the Y gate), a flag-byte sweep (the eligibility gate), and an
 *           L-wrap edge set, each oracle-vs-idiomatic on fresh clones; two teeth twins.
 * LIVE-OUT: memory-only — the EFFECT_PARAM_PTR / EFFECT_SELECT / EFFECT_STATE trio. No
 *           live registers/flags: the oracle's residual A/L/HL/F are dead ABI (the
 *           successor is a fresh call) and its `ret` pops into dead STACK_SCRATCH; this
 *           routine models neither SP nor pc.
 * NAMES:    MARIO_Y (0x6205), EFFECT_STATE (0x6340), EFFECT_SELECT (0x6342),
 *           EFFECT_PARAM_PTR (0x6343) from ram.js; the scanned object table base is
 *           OBJECT_COLLISION_SPRITES (0x6A0C).
 */
import { MARIO_Y, EFFECT_STATE, EFFECT_SELECT, EFFECT_PARAM_PTR } from "./ram.js";

export function confirmObjectHit(m) {
  const { regs, mem } = m;

  // HL LIVE-IN: base pointer of the X-matched 4-byte record in the OBJECT_COLLISION_SPRITES
  // (0x6A0C) table. Only L walks (H stays fixed), so record offsets wrap within the page.
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
