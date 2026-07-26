// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_19d0  (ROM 0x19d0-0x19ff, The Pit) — the "keep moving" continuation of the
 * actor-movement dispatch, tail-jumped in from loc_18cf / loc_191f when nothing
 * under the actor needs a reaction. It advances the actor's position accumulator
 * 0x806b by its per-frame step 0x806d, picks the walk-animation frame from bit 1
 * of the NEW position (0x8069 := 0x34, or 0xb4 — the same frame with its high/
 * flip bit set — when bit 1 is set, so the frame toggles every 2 units), then,
 * ONLY while feature flag 0x8077 is non-zero AND the accumulator has reached
 * >= 0x8a, latches 0x807c := 0xb4 and clears 0x8068 := 0x00 (a one-shot at the
 * far edge). All other cases just fall through to the shared epilogue.
 *
 * SUBTLETY (0x19db-0x19df): `and 0x02` computes (position & 2) into A purely for
 * its Z flag, then `ld a,0x34` immediately OVERWRITES A with the default frame.
 * `ld a,n` does not touch flags, so the Z flag from the `and` survives across it
 * and drives the `jr z` — the value of the `and` is discarded, only its flag is
 * used. Modelled faithfully as `regs.and(0x02)` (sets flags + A) then `regs.a =
 * 0x34` (clobbers A, flags intact).
 *
 * Every terminal transfer is a tail-jump into loc_1b5b (the shared epilogue) that
 * pushes NOTHING, so loc_1b5b's own `ret` unwinds to OUR caller — modelled
 * `m.step(0x1b5b, 10); return m.call(0x1b5b)` with NO trailing m.ret (a second
 * ret would double-pop). The one internal forward jump (`jr z,0x19e3`, skipping
 * the 0xb4 override) is a labelled-block break.
 *
 *   19d0  3a 6d 80     ld   a,(0x806d)
 *   19d3  5f           ld   e,a
 *   19d4  3a 6b 80     ld   a,(0x806b)
 *   19d7  83           add  a,e
 *   19d8  32 6b 80     ld   (0x806b),a
 *   19db  e6 02        and  0x02
 *   19dd  3e 34        ld   a,0x34
 *   19df  28 02        jr   z,0x19e3
 *   19e1  3e b4        ld   a,0xb4
 * loc_19e3:
 *   19e3  32 69 80     ld   (0x8069),a
 *   19e6  3a 77 80     ld   a,(0x8077)
 *   19e9  a7           and  a
 *   19ea  ca 5b 1b     jp   z,0x1b5b
 *   19ed  3a 6b 80     ld   a,(0x806b)
 *   19f0  fe 8a        cp   0x8a
 *   19f2  da 5b 1b     jp   c,0x1b5b
 *   19f5  3e b4        ld   a,0xb4
 *   19f7  32 7c 80     ld   (0x807c),a
 *   19fa  3e 00        ld   a,0x00
 *   19fc  32 68 80     ld   (0x8068),a
 *   19ff  c3 5b 1b     jp   0x1b5b
 */
export function loc_19d0(m) {
  const { regs, mem } = m;

  blk19e3: {
    // ---- advance the position accumulator by its per-frame step ----
    regs.a = mem.read8(0x806d);
    m.step(0x19d3, 13); // 19d0  ld a,(0x806d) -- per-frame step
    regs.e = regs.a;
    m.step(0x19d4, 4); // 19d3  ld e,a
    regs.a = mem.read8(0x806b);
    m.step(0x19d7, 13); // 19d4  ld a,(0x806b) -- current position
    regs.add(regs.e);
    m.step(0x19d8, 4); // 19d7  add a,e -- new position
    mem.write8(0x806b, regs.a);
    m.step(0x19db, 13); // 19d8  ld (0x806b),a -- store it back

    // ---- pick the walk-animation frame from bit 1 of the new position ----
    regs.and(0x02);
    m.step(0x19dd, 7); // 19db  and 0x02 -- Z iff bit 1 clear (A discarded next; flag kept)
    regs.a = 0x34;
    m.step(0x19df, 7); // 19dd  ld a,0x34 -- default frame (does NOT touch flags)
    if (regs.fZ) {
      m.step(0x19e3, 12); // 19df  jr z taken -- bit 1 clear: keep 0x34
      break blk19e3;
    }
    m.step(0x19e1, 7); // 19df  jr z not taken
    regs.a = 0xb4;
    m.step(0x19e3, 7); // 19e1  ld a,0xb4 -- flipped frame (bit 1 set)
  }

  // ---- loc_19e3: latch the frame, then the far-edge one-shot ----
  mem.write8(0x8069, regs.a);
  m.step(0x19e6, 13); // 19e3  ld (0x8069),a -- store the chosen frame
  regs.a = mem.read8(0x8077);
  m.step(0x19e9, 13); // 19e6  ld a,(0x8077) -- feature/enable flag
  regs.and(regs.a);
  m.step(0x19ea, 4); // 19e9  and a -- Z iff 0x8077 == 0
  if (regs.fZ) {
    m.step(0x1b5b, 10); // 19ea  jp z taken -- feature off; just rebuild + ret
    return m.call(0x1b5b);
  }
  m.step(0x19ed, 10); // 19ea  jp z not taken
  regs.a = mem.read8(0x806b);
  m.step(0x19f0, 13); // 19ed  ld a,(0x806b) -- the new position
  regs.cp(0x8a);
  m.step(0x19f2, 7); // 19f0  cp 0x8a
  if (regs.fC) {
    m.step(0x1b5b, 10); // 19f2  jp c taken -- position < 0x8a: not at the edge yet
    return m.call(0x1b5b);
  }
  m.step(0x19f5, 10); // 19f2  jp c not taken -- position >= 0x8a: fire the one-shot

  regs.a = 0xb4;
  m.step(0x19f7, 7); // 19f5  ld a,0xb4
  mem.write8(0x807c, regs.a);
  m.step(0x19fa, 13); // 19f7  ld (0x807c),a
  regs.a = 0x00;
  m.step(0x19fc, 7); // 19fa  ld a,0x00
  mem.write8(0x8068, regs.a);
  m.step(0x19ff, 13); // 19fc  ld (0x8068),a
  m.step(0x1b5b, 10); // 19ff  jp 0x1b5b -- tail-jump; loc_1b5b's ret unwinds to OUR caller
  return m.call(0x1b5b);
}
