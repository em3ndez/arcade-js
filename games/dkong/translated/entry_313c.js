// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_313c  (ROM 0x313C–0x31B0) — 117 bytes, 50 instructions.
 *
 * A per-object state machine: scans 5 objects (stride 0x20 from 0x6400), counts
 * the non-empty ones in 0x63A1, and on ZERO count does a CONDITIONAL STACK SPLICE
 * (0x3179: inc sp x2 then ret) -- the caller's-caller-skip class (entry_24b4 /
 * guard_3110 idiom, precedented at state0.js inc-sp splices). It discards
 * entry_30ed's pushed return (0x30F3) and returns to entry_30ed's OWN caller,
 * skipping entry_30ed's remaining `call 0x31b1` / `call 0x34f3`.
 *
 *   3176  cp   0x00
 *   3178  ret  nz            ; counter != 0 -> NORMAL return to 0x30F3
 *   3179  inc  sp            ; counter == 0 -> SPLICE:
 *   317a  inc  sp            ;   discard the caller's return address
 *   317b  ret                ;   -> return to the CALLER'S CALLER
 *
 * SKIP-CAPABLE: returns a boolean per the caller-skip convention (cf. sub_33a1) --
 * `true` on a normal ret (0x3178 ret nz / 0x3194 ret z), `false` on the splice --
 * so its future caller entry_30ed guards it with `if (!m.call(0x313c)) return;`.
 * (The draft skeleton used bare `return`; the integrator applied the boolean form
 * that callcheck detects via `return false;`.)
 *
 * Calls nothing (self-contained; no callee edges). entry_3195/loc_317c are
 * INTERIOR labels -- raw-ROM (maincpu.bin) reference scan: 0x3195 has one literal
 * ref (jp nz @318a, interior), 0x317c one (jp z @314f, interior), zero external
 * (a byte-scan FLOOR). `add ix,de` uses regs.addIx (add16 flags),
 * NOT open-coded (the sub_0593 lesson).
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: only caller is 0x30F0 (entry_30ed, the
 * orchestrator), which is not translated -- nothing in translated src reaches it.
 */
export function entry_313c(m) {
  const { regs, mem } = m;

  regs.ix = 0x6400;
  m.step(0x3140, 14); // ld ix,0x6400
  regs.xor(regs.a);
  m.step(0x3141, 4); // xor a
  mem.write8(0x63a1, regs.a); // counter = 0
  m.step(0x3144, 13); // ld (0x63a1),a
  regs.b = 0x05;
  m.step(0x3146, 7); // ld b,0x05
  regs.de = 0x0020;
  m.step(0x3149, 10); // ld de,0x0020

  for (;;) {
    // loc_3149
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x314c, 19); // ld a,(ix+0x00)
    regs.cp(0x00);
    m.step(0x314e, 7); // cp 0x00
    if (regs.fZ) {
      m.step(0x317c, 10); // jp z,0x317c -- empty slot
      // -- loc_317c: empty-slot handling --
      regs.a = mem.read8(0x63a1);
      m.step(0x317f, 13); // ld a,(0x63a1)
      regs.cp(0x05);
      m.step(0x3181, 7); // cp 0x05
      if (regs.fZ) {
        m.step(0x316a, 10); // jp z,0x316a -- counter==5, continue loop
      } else {
        m.step(0x3184, 10);
        regs.a = mem.read8(0x6227);
        m.step(0x3187, 13); // ld a,(0x6227)
        regs.cp(0x02);
        m.step(0x3189, 7); // cp 0x02
        let atInsert = false;
        if (!regs.fZ) {
          m.step(0x3195, 10); // jp nz,0x3195
          atInsert = true;
        } else {
          m.step(0x318c, 10);
          regs.a = mem.read8(0x63a1);
          m.step(0x318f, 13); // ld a,(0x63a1)
          regs.c = regs.a;
          m.step(0x3190, 4); // ld c,a
          regs.a = mem.read8(0x6380);
          m.step(0x3193, 13); // ld a,(0x6380)
          regs.cp(regs.c);
          m.step(0x3194, 4); // cp c
          if (regs.fZ) { m.ret(11); return true; } // ret z -- 0x6380==counter, NORMAL
          m.step(0x3195, 5); // ret z NOT taken
          atInsert = true;
        }
        if (atInsert) {
          // -- entry_3195: insertion --
          regs.a = mem.read8(0x63a0);
          m.step(0x3198, 13); // ld a,(0x63a0)
          regs.cp(0x01);
          m.step(0x319a, 7); // cp 0x01
          if (!regs.fZ) {
            m.step(0x316a, 10); // jp nz,0x316a -- continue loop
          } else {
            m.step(0x319d, 10);
            mem.write8((regs.ix + 0x00) & 0xffff, regs.a); // A = 1 here
            m.step(0x31a0, 19); // ld (ix+0x00),a
            mem.write8((regs.ix + 0x18) & 0xffff, regs.a);
            m.step(0x31a3, 19); // ld (ix+0x18),a
            regs.xor(regs.a);
            m.step(0x31a4, 4); // xor a
            mem.write8(0x63a0, regs.a); // clear 0x63a0
            m.step(0x31a7, 13); // ld (0x63a0),a
            regs.a = mem.read8(0x63a1);
            m.step(0x31aa, 13); // ld a,(0x63a1)
            regs.a = regs.inc8(regs.a);
            m.step(0x31ab, 4); // inc a
            mem.write8(0x63a1, regs.a); // counter++
            m.step(0x31ae, 13); // ld (0x63a1),a
            m.step(0x316a, 10); // jp 0x316a
          }
        }
      }
    } else {
      // -- object non-empty --
      m.step(0x3151, 10); // jp z,0x317c NOT taken
      regs.a = mem.read8(0x63a1);
      m.step(0x3154, 13); // ld a,(0x63a1)
      regs.a = regs.inc8(regs.a);
      m.step(0x3155, 4); // inc a
      mem.write8(0x63a1, regs.a); // counter++
      m.step(0x3158, 13); // ld (0x63a1),a
      regs.a = 0x01;
      m.step(0x315a, 7); // ld a,0x01
      mem.write8((regs.ix + 0x08) & 0xffff, regs.a); // (ix+8) = 1
      m.step(0x315d, 19); // ld (ix+0x08),a
      regs.a = mem.read8(0x6217);
      m.step(0x3160, 13); // ld a,(0x6217)
      regs.cp(0x01);
      m.step(0x3162, 7); // cp 0x01
      if (!regs.fZ) {
        m.step(0x316a, 10); // jp nz,0x316a
      } else {
        m.step(0x3165, 10);
        regs.a = 0x00;
        m.step(0x3167, 7); // ld a,0x00
        mem.write8((regs.ix + 0x08) & 0xffff, regs.a); // (ix+8) = 0 if 0x6217==1
        m.step(0x316a, 19); // ld (ix+0x08),a
      }
    }

    // loc_316a -- loop tail
    regs.addIx(regs.de);
    m.step(0x316c, 15); // add ix,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3149 : 0x316e, regs.b !== 0 ? 13 : 8); // djnz
    if (regs.b === 0) break;
  }

  // after loop
  regs.hl = 0x63a0;
  m.step(0x3171, 10); // ld hl,0x63a0
  mem.write8(regs.hl, 0x00); // clear 0x63a0
  m.step(0x3173, 10); // ld (hl),0x00
  regs.a = mem.read8(0x63a1);
  m.step(0x3176, 13); // ld a,(0x63a1)
  regs.cp(0x00);
  m.step(0x3178, 7); // cp 0x00
  if (!regs.fZ) { m.ret(11); return true; } // ret nz -- counter != 0, NORMAL return
  m.step(0x3179, 5); // ret nz NOT taken

  // *** SPLICE: counter == 0. Discard the caller's return address (inc sp x2),
  // *** then ret to the caller's caller (0x30F3 was discarded). guard_3110 idiom.
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x317a, 6); // inc sp
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x317b, 6); // inc sp
  m.ret(); // returns to the CALLER'S CALLER
  return false; // SKIP-CAPABLE: false == caller (entry_30ed) was spliced past
}
