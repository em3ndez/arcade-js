// SPDX-License-Identifier: GPL-3.0-only

// loc_79e9  (ROM 0x79e9-0x7a0a) -- ROM-integrity self-check over the routine at 0x68ac.
// Sums bytes forward from 0x68ac into DE (E=low, D=carry count) until it reads 0xc9 (that
// routine's terminating `ret`), then compares the 16-bit sum against the stored word at 0x7a0b.
// A low-byte mismatch aborts to 0x07d0, a high-byte mismatch to 0x1a85 (anti-tamper vectors);
// a clean match just returns. 0x7a0b-0x7e6c that follow the ret are DATA (checksum word + text
// table), read from ROM directly, so they are not translated here.
export function loc_79e9(m) {
  const { regs, mem } = m;

  regs.hl = 0x68ac;
  m.step(0x79ec, 10); // 79e9  ld hl,0x68ac
  regs.de = 0x0000;
  m.step(0x79ef, 10); // 79ec  ld de,0x0000

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x79f0, 7); // 79ef  ld a,(hl)
    regs.cp(0xc9);
    m.step(0x79f2, 7); // 79f0  cp 0xc9 -- 0xc9 == terminating ret of the summed routine
    if (regs.fZ) { m.step(0x79fc, 12); break; } // 79f2  jr z,0x79fc (taken)
    m.step(0x79f4, 7); // 79f2  jr z (not taken)
    regs.add(regs.e);
    m.step(0x79f5, 4); // 79f4  add a,e
    if (regs.fNC) {
      m.step(0x79f8, 12); // 79f5  jr nc,0x79f8 (taken -- no carry)
    } else {
      m.step(0x79f7, 7); // 79f5  jr nc (not taken)
      regs.d = regs.inc8(regs.d);
      m.step(0x79f8, 4); // 79f7  inc d -- carry into the high byte
    }
    regs.e = regs.a;
    m.step(0x79f9, 4); // 79f8  ld e,a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x79fa, 6); // 79f9  inc hl
    m.step(0x79ef, 12); // 79fa  jr 0x79ef
  }

  regs.hl = 0x7a0b;
  m.step(0x79ff, 10); // 79fc  ld hl,0x7a0b -- stored checksum word
  regs.a = regs.e;
  m.step(0x7a00, 4); // 79ff  ld a,e
  regs.cp(mem.read8(regs.hl));
  m.step(0x7a01, 7); // 7a00  cp (hl)
  if (regs.fNZ) { m.step(0x07d0, 10); return m.call(0x07d0); } // 7a01  jp nz,0x07d0
  m.step(0x7a04, 10); // 7a01  jp nz (not taken)
  regs.a = regs.d;
  m.step(0x7a05, 4); // 7a04  ld a,d
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x7a06, 6); // 7a05  inc hl
  regs.cp(mem.read8(regs.hl));
  m.step(0x7a07, 7); // 7a06  cp (hl)
  if (regs.fNZ) { m.step(0x1a85, 10); return m.call(0x1a85); } // 7a07  jp nz,0x1a85
  m.step(0x7a0a, 10); // 7a07  jp nz (not taken)
  m.ret(); // 7a0a  ret
}
