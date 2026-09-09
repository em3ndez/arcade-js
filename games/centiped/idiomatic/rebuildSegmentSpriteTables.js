// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_88, loc_94, loc_c2, loc_9c, loc_9a, loc_ab, loc_34, loc_74, loc_00, loc_44,
  loc_f0, loc_64, loc_54, loc_8b, loc_73, loc_43, loc_53, loc_f4, loc_fe, loc_97,
  POKEY_RANDOM,
} from "./names.js";

/**
 * rebuildSegmentSpriteTables — materialise one centipede segment's five parallel 12-entry tables.
 *
 * Role in the machine: a centipede on screen is drawn from five parallel per-slot arrays — the phase
 * byte $34, the neighbour link $74, the heading delta $44, the coordinate $64, and the sub-coordinate
 * $54 — each with twelve entries (one per body slot). Whenever a fresh centipede is spawned or a wave
 * restarts, those tables must be rebuilt from the object's per-slot counters and its descriptor rows.
 * This routine does that rebuild for the object selected by $88, in five steps:
 *   1. When the slot's gate ($94+X) is clear and its counter ($9c+X) is at least 3, tick the length
 *      counter $9a+X (wrapping 0 -> 0x0c) and reset the counter to 1 or 2 by the $ab threshold.
 *   2. Seed the [0] (head) entries: phase, link, sign-negated heading, folded coordinate, sub-coord.
 *   3. Copy the descriptor rows ($43/$53/$73 blocks) into the tables for body slots 1..length-1.
 *   4. Random-fill the remaining slots length..0x0b (skipped once the length counter reads full).
 *   5. Mark the slot rebuilt and refresh the $97 flag from $fe.
 * Two's-complement negations are inlined as (0x100 - v) & 0xff to mirror the 6502 exactly.
 *
 * ROM: the segment sprite-table rebuild spine (reached via loc_2505). Grounding: [code] — read from
 * behaviour; POKEY_RANDOM (0x100a) [seen] is the only MAME-confirmed cell, the rest are bare
 * zero-page/array placeholders indexed by the slot number.
 *
 * Live-out (RAM only, no return — the withOmittedRet seam supplies the RTS): the five $34/$74/$44/
 * $64/$54 slot tables, plus $8b, $94+X, $97, and the refreshed counters $9a+X/$9c+X/$c2+X.
 */
export function rebuildSegmentSpriteTables(m) {
  // $88 selects which object slot is being rebuilt; every per-slot read/write below is indexed by it.
  const x0 = m.mem8[loc_88];

  // --- step 1: refresh the counters when the gate is clear ---
  // $94+X is the per-slot "already rebuilt" gate. While it is clear this slot is due for a refresh:
  // set the busy bit ($c2 |= 0x80) to mark it in progress, and — only once the phase counter $9c+X
  // has climbed to 3 — advance the length counter $9a+X by one (mod 0x0c, so 0 wraps to a full 0x0c
  // strip) and reload $9c+X to 1 or 2 chosen by the $ab threshold. This is what makes successive
  // spawns of the same slot come out at growing/cycling lengths.
  if (m.mem8[(loc_94 + x0) & 0xff] === 0) {
    m.mem8[(loc_c2 + x0) & 0xff] = m.mem8[(loc_c2 + x0) & 0xff] | 0x80;
    if (m.mem8[(loc_9c + x0) & 0xff] >= 0x03) {
      let len = (m.mem8[(loc_9a + x0) & 0xff] - 1) & 0xff;
      if (len === 0) len = 0x0c; // wrap 0 -> 0x0c
      m.mem8[(loc_9a + x0) & 0xff] = len;
      let count = 0x02;
      if (m.mem8[(loc_ab + x0) & 0xff] < 0x04) count = 0x01;
      m.mem8[(loc_9c + x0) & 0xff] = count;
    }
  }

  // --- step 2: seed the [0] entries ---
  // Entry [0] is the head of the new strip. Phase = 0x03 (a fresh, non-retired head). The link/heading
  // magnitude come from $9c+X (the just-set counter): $74[0] takes it straight, $44[0] takes it with
  // its sign flipped *unless* $00 bit1 is set — i.e. the head's initial travel direction alternates
  // with the frame parity. The coordinate $64[0] is a fixed 0xf8 folded through the wave scramble
  // $f0, and $54[0] is pinned to 0x80 (mid sub-cell). $8b caches the strip length ($9a+X) for the
  // copy/fill loops below to bound on.
  m.mem8[loc_34] = 0x03;
  const s = m.mem8[(loc_9c + x0) & 0xff];
  m.mem8[loc_74] = s;
  let e44 = s;
  if ((m.mem8[loc_00] & 0x02) === 0) e44 = (0x100 - s) & 0xff; // negate unless bit1 is set
  m.mem8[loc_44] = e44;
  m.mem8[loc_64] = 0xf8 ^ m.mem8[loc_f0];
  m.mem8[loc_54] = 0x80;
  const span = m.mem8[(loc_9a + x0) & 0xff];
  m.mem8[loc_8b] = span;

  // --- step 3: descriptor-copy loop over slots 1..length-1 (skipped when length == 1) ---
  // For a multi-segment strip, fill body slots 1..span-1 from the descriptor rows. Each body slot
  // gets a phase from the descending $y cursor (which starts at 0x42 and skips 0x3f -> 0x47, cycling
  // a fixed set of body glyph/phase codes), the same folded coordinate as the head, a link copied
  // from $73+X, and a heading copied from $43+X. The sub-coordinate $54+X is built from $53+X plus a
  // base of 0x08 or 0xf8 chosen by the descriptor's sign — so each body cell trails the head at a
  // descriptor-defined offset. `runFillLoop` decides whether step 4 still runs afterward.
  let runFillLoop = true;
  if (span !== 0x01) {
    let y = 0x42;
    let x = 0x01;
    do {
      m.mem8[(loc_34 + x) & 0xff] = y;
      m.mem8[(loc_64 + x) & 0xff] = 0xf8 ^ m.mem8[loc_f0];
      m.mem8[(loc_74 + x) & 0xff] = m.mem8[(loc_73 + x) & 0xff];
      const desc = m.mem8[(loc_43 + x) & 0xff];
      m.mem8[(loc_44 + x) & 0xff] = desc;
      let base = (desc & 0x80) ? 0x08 : 0xf8; // sign of desc picks the base
      base = (base + m.mem8[(loc_53 + x) & 0xff]) & 0xff;
      m.mem8[(loc_54 + x) & 0xff] = base;
      y = (y - 1) & 0xff;
      if (y === 0x3f) y = 0x47;
      x = (x + 1) & 0xff;
    } while (x < m.mem8[loc_8b]);

    // when this slot's length counter now reads full (0x0c), skip the step-4 fill.
    // A full-length strip has no spare slots to random-fill, so step 4 would only overwrite real body.
    if (m.mem8[(loc_9a + m.mem8[loc_88]) & 0xff] === 0x0c) runFillLoop = false;
  }

  // --- step 4: random-fill slots length..0x0b ---
  // Any slot past the real body length is padded with a randomised "spare" segment so the five tables
  // are always fully twelve entries wide. Each spare gets phase 0, the folded coordinate carried in
  // `carry`, a link seeded from $f4 (or 0x02 if $f4 is clear), a heading that is that link maybe
  // negated on POKEY RNG bit7, and a random sub-coordinate (RNG & 0xf8). `carry` is reloaded from the
  // value just stored each pass — an invariant carry-through that mirrors the 6502's register reuse.
  if (runFillLoop) {
    let carry = 0xf8 ^ m.mem8[loc_f0];
    let x = m.mem8[loc_8b];
    do {
      m.mem8[(loc_64 + x) & 0xff] = carry;
      m.mem8[(loc_34 + x) & 0xff] = 0x00;
      let a = 0x02;
      const f4 = m.mem8[loc_f4];
      if (f4 !== 0) a = f4;
      m.mem8[(loc_74 + x) & 0xff] = a;
      if (m.mem8[POKEY_RANDOM] & 0x80) a = (0x100 - a) & 0xff; // negate on random bit7
      m.mem8[(loc_44 + x) & 0xff] = a;
      m.mem8[(loc_54 + x) & 0xff] = m.mem8[POKEY_RANDOM] & 0xf8; // random & 0xf8
      carry = m.mem8[(loc_64 + x) & 0xff]; // reload the value just stored (invariant)
      x = (x + 1) & 0xff;
    } while (x < 0x0c);
  }

  // --- step 5: mark the slot rebuilt ---
  // Set the per-slot gate $94+X to 0x0c so step 1 will not rebuild this slot again until it is
  // re-cleared, and refresh the $97 edge flag from $fe. From here the withOmittedRet seam supplies
  // the return that the 6502 routine ended with.
  m.mem8[(loc_94 + m.mem8[loc_88]) & 0xff] = 0x0c;
  m.mem8[loc_97] = m.mem8[loc_fe];
  // rts omitted; the withOmittedRet seam completes it.
}
