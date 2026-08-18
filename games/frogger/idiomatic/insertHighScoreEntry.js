// SPDX-License-Identifier: GPL-3.0-only
/**
 * insertHighScoreEntry  —  ROM 0x0a84  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The maintainer of Frogger's five-entry high-score ranking table. Given one 16-bit score key it
 *   finds that key's rank against the five entries already on file, opens a gap by sliding the losers
 *   down one slot, drops the new key in, and hands back a code describing where it landed.
 *
 *   The table is a run of five two-byte slots kept in DESCENDING order — best score first — spanning
 *   RAM 0x83f1..0x83fa (the attract-mode "SCORE RANKING" table). Each slot stores the key big-endian
 *   across two adjacent bytes: the key-HIGH byte at the slot address and the key-LOW byte one byte
 *   BELOW it. The top slot's high byte is HIGH_SCORE_TABLE_TOP_HI (0x83f2), so the top slot's low byte
 *   is 0x83f1 — which is also HIGH_SCORE_TABLE_BASE, the base the attract renderer reads from.
 *
 * WHERE IT SITS
 *   Driven at new-game init by packScoreRankPair (ROM 0x0f69): it ranks both players' final score
 *   words through here (larger first, smaller second) and packs the two returned codes into the
 *   display field INTRO_DIGIT_FIELD (0x83fb). The table this routine maintains is then painted by the
 *   attract score-ranking screen renderMode3ScoreRankingScreen (ROM 0x0bb3). Grounding is [seen] on
 *   the table's identity — a live insertion was never captured in MAME, but the five-word descending
 *   table it feeds is dispositive.
 *
 * CALLING CONVENTION
 *   The Z80 passes the score key in the DE register pair — D is the key-high byte, E the key-low. The
 *   two optional params mirror that: dHi defaults to register D, eLo to register E, so a translated
 *   caller can invoke it register-free while the machine's real call still reads DE.
 *
 * LIVE-OUT
 *   Memory + register A. It writes into the table (the tail shift and the new key) and returns the
 *   slot-index code in A: 0 when the key ranked below all five, otherwise 4·(slots below the insertion
 *   point) + 1 — so a rank-1 (top) insert returns 17 and a rank-5 (last) insert returns 1. An exact
 *   duplicate of the last slot is reported as 1 but NOT stored.
 */
import { HIGH_SCORE_TABLE_TOP_HI } from "./names.js";

const SLOTS = 5;   // five ranked entries in the table (0x83f1..0x83fa)
const STRIDE = 2;  // 2 bytes per entry: key-high at the slot address, key-low one byte below
const NO_SLOT = 0; // return code A=0 — the new key ranked below every existing entry

export function insertHighScoreEntry(m, dHi = m.regs.d, eLo = m.regs.e) {
  const { mem8 } = m;

  // ── Scan the table top-to-bottom for the new key's rank ───────────────────────────────
  // Walk the five slots from best (k=0, the top slot at HIGH_SCORE_TABLE_TOP_HI / 0x83f2) toward
  // worst. `hi` is this slot's key-high address, `lo = hi - 1` its key-low; both are compared against
  // the incoming key (dHi:eLo) as a single 16-bit big-endian value.
  for (let k = 0; k < SLOTS; k++) {
    const hi = HIGH_SCORE_TABLE_TOP_HI + STRIDE * k;
    const lo = hi - 1;
    const slotHi = mem8[hi];
    const slotLo = mem8[lo];

    // Insert at the first slot the new key OUTRANKS: a strictly greater high byte, or an equal high
    // byte with a strictly greater low byte. Because the table is descending, this is the highest
    // (best) position the key qualifies for, so we stop scanning and open the gap here.
    if (dHi > slotHi || (dHi === slotHi && slotLo < eLo)) return insert(k, hi, lo);

    // Special case: an EXACT duplicate of the last slot. The key ties the worst entry and there is no
    // room below it, so the ROM reports it as landed (A=1, the rank-5 code) but stores nothing —
    // avoiding a redundant rewrite of an already-present score.
    if (dHi === slotHi && slotLo === eLo && k === SLOTS - 1) return (m.regs.a = 1);
  }

  // Fell off the bottom without qualifying anywhere: the new key ranks below all five entries.
  return (m.regs.a = NO_SLOT);

  // ── Open a gap at slot k and store the new key ────────────────────────────────────────
  // Everything from the insertion slot down to the second-to-last slot must slide down one position
  // to make room; the old last entry is overwritten (pushed off the bottom of the table). `slotsBelow`
  // counts how many entries sit below the insertion point — those are exactly the ones that shift, and
  // it is also the value the return code encodes (how many ranks the new key beat).
  function insert(k, hi, lo) {
    const slotsBelow = SLOTS - 1 - k;

    // Shift bottom-up so no entry is clobbered before it is copied: on step j we move slot
    // (SLOTS-2-j) down into slot (SLOTS-1-j), copying both the key-high byte (+STRIDE) and its
    // key-low neighbour (+STRIDE-1). j runs from 0 (moving the 4th slot into the 5th) up through the
    // slot just below the insertion point.
    for (let j = 0; j < slotsBelow; j++) {
      const from = HIGH_SCORE_TABLE_TOP_HI + STRIDE * (SLOTS - 2 - j);
      mem8[from + STRIDE] = mem8[from];
      mem8[from + STRIDE - 1] = mem8[from - 1];
    }

    // Drop the new key into the freed slot and report the rank code: 4·slotsBelow + 1 (top insert
    // beat 4 entries → 17; last-slot insert beat 0 → 1). packScoreRankPair packs this code for the
    // attract ranking screen.
    mem8[hi] = dHi;
    mem8[lo] = eLo;
    return (m.regs.a = 4 * slotsBelow + 1);
  }
}
