// SPDX-License-Identifier: GPL-3.0-only

// loc_6ac5  (ROM 0x6ac5-0x6b09) -- one-shot ROM/screen checksum guard, gated on two RAM flags.
// Runs only when (0x892d)==2 (else `ret nz`) and (0x8f56)==0 (else `ret nz`); the first pass sets
// (0x8f56)=1 so it never re-runs. It then 16-bit-sums a strided walk of the tilemap starting at
// HL=0x8450 into DE: for each processed byte, E += (HL) with carry into D; L advances by 1 each
// step, but the low-5-bits form (L & 0x1f) steers the stride -- value 0x1b skips one extra byte
// (a padding column), value 0x1f jumps L forward by 0x12 (row wrap; a page carry bumps H and the
// walk stops once H reaches 0x88). When the walk ends the routine checks the sum: E must equal
// 0xb8 AND D must equal 0x29, else it diverts to a tamper trap -- `jp 0x0929` if E != 0xb8, or
// `jp 0x3829` if D != 0x29. A matching checksum simply `ret`s.
//
// Control-flow exits:
//   ret nz (0x6aca) -- (0x892d) != 2
//   ret nz (0x6acf) -- (0x8f56) != 0 (already ran)
//   jp 0x0929 (0x6b00) -- low-byte checksum mismatch (E != 0xb8)
//   jp 0x3829 (0x6b06) -- high-byte checksum mismatch (D != 0x29)
//   ret (0x6b09)      -- checksum OK
// SP-balanced: no push/pop; the two `jp`s are faithful tail transfers (m.call+return).
export function loc_6ac5(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x892d);
  m.step(0x6ac8, 13);
  regs.cp(0x02);
  m.step(0x6aca, 7);
  if (regs.fNZ) {
    return m.ret(11); // 6aca  ret nz -- not in the guarded state
  }
  m.step(0x6acb, 5);

  regs.a = mem.read8(0x8f56);
  m.step(0x6ace, 13);
  regs.and(regs.a);
  m.step(0x6acf, 4);
  if (regs.fNZ) {
    return m.ret(11); // 6acf  ret nz -- already ran once
  }
  m.step(0x6ad0, 5);

  regs.a = regs.inc8(regs.a);
  m.step(0x6ad1, 4);
  mem.write8(0x8f56, regs.a);
  m.step(0x6ad4, 13); // 6ad1  ld (0x8f56),a -- latch "ran" flag = 1
  regs.hl = 0x8450;
  m.step(0x6ad7, 10);
  regs.de = 0x0000;
  m.step(0x6ada, 10);

  for (;;) {
    // loc_6ada -- accumulate one byte into DE
    regs.a = regs.e;
    m.step(0x6adb, 4);
    regs.add(mem.read8(regs.hl));
    m.step(0x6adc, 7);
    regs.e = regs.a;
    m.step(0x6add, 4);
    if (regs.fNC) {
      m.step(0x6ae0, 12);
    } else {
      m.step(0x6adf, 7);
      regs.d = regs.inc8(regs.d);
      m.step(0x6ae0, 4);
    }

    // loc_6ae0 -- advance L, inspect the column index
    regs.l = regs.inc8(regs.l);
    m.step(0x6ae1, 4);
    regs.a = regs.l;
    m.step(0x6ae2, 4);
    regs.and(0x1f);
    m.step(0x6ae4, 7);
    regs.cp(0x1b);
    m.step(0x6ae6, 7);
    if (regs.fNZ) {
      m.step(0x6aeb, 12);
    } else {
      m.step(0x6ae8, 7); // 6ae6  jr nz (not taken -- column 0x1b: skip a byte)
      regs.l = regs.inc8(regs.l);
      m.step(0x6ae9, 4);
      m.step(0x6ada, 12);
      continue;
    }

    // loc_6aeb -- column 0x1f is the row end; else keep walking
    regs.cp(0x1f);
    m.step(0x6aed, 7);
    if (regs.fNZ) {
      m.step(0x6ada, 12);
      continue;
    }
    m.step(0x6aef, 7);

    regs.a = 0x12;
    m.step(0x6af1, 7);
    regs.add(regs.l);
    m.step(0x6af2, 4);
    regs.l = regs.a;
    m.step(0x6af3, 4); // 6af2  ld l,a -- L += 0x12 (skip to next row start)
    if (regs.fNC) {
      m.step(0x6ada, 12);
      continue;
    }
    m.step(0x6af5, 7);

    regs.h = regs.inc8(regs.h);
    m.step(0x6af6, 4);
    regs.a = regs.h;
    m.step(0x6af7, 4);
    regs.cp(0x88);
    m.step(0x6af9, 7);
    if (regs.fC) {
      m.step(0x6ada, 12);
      continue;
    }
    m.step(0x6afb, 7);
    break;
  }

  // loc after walk (0x6afb) -- verify the checksum
  regs.a = regs.e;
  m.step(0x6afc, 4);
  regs.cp(0xb8);
  m.step(0x6afe, 7);
  if (regs.fNZ) {
    m.step(0x6b00, 7);
    m.step(0x0929, 10); // 6b00  jp 0x0929 -- low-byte mismatch: tamper trap
    return m.call(0x0929, "checksum low-byte mismatch (E != 0xb8) -- tamper trap");
  }
  m.step(0x6b03, 12);

  // loc_6b03
  regs.a = regs.d;
  m.step(0x6b04, 4);
  regs.cp(0x29);
  m.step(0x6b06, 7);
  if (regs.fNZ) {
    m.step(0x3829, 10); // 6b06  jp nz,0x3829 -- high-byte mismatch: tamper trap
    return m.call(0x3829, "checksum high-byte mismatch (D != 0x29) -- tamper trap");
  }
  m.step(0x6b09, 10);
  return m.ret(10); // 6b09  ret -- checksum OK
}
