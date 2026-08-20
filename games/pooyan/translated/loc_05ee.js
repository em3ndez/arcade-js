// SPDX-License-Identifier: GPL-3.0-only

// loc_05ee  (ROM 0x05ee-0x0629) -- render a (0x8802)-derived counter as two HUD nibbles, then
// run a ROM checksum tripwire. Draws field 5 (loc_05b2), reads (0x8802) clamped to 0x63, converts
// it packed-nibble -> BCD (loc_062a); the BCD high nibble -> (0x86bf), low nibble -> (0x869f).
// Only when that low nibble == 0x02 does it fall into a 31-byte rolling checksum of ROM 0x64c8
// downward; a mismatch vs 0x8c bumps a tamper cell at (0x451e<<1 = 0x8a3c).
export function loc_05ee(m) {
  const { regs, mem } = m;

  regs.a = 0x05;                       m.step(0x05f0, 7);
  m.push16(0x05f3);
  m.step(0x05b2, 17);                  // 05f0  call 0x05b2 (field renderer, pattern A -> 0x05f3)
  m.call(0x05b2);

  regs.a = mem.read8(0x8802);          m.step(0x05f6, 13);
  regs.cp(0x63);                       m.step(0x05f8, 7);
  if (regs.fC) {
    m.step(0x05fc, 12);                // jr c,0x05fc taken -- already below the cap
  } else {
    m.step(0x05fa, 7);                 // jr c not taken
    regs.a = 0x63;                     m.step(0x05fc, 7); // clamp to 0x63
  }

  m.push16(0x05ff);
  m.step(0x062a, 17);                  // 05fc  call 0x062a (packed-nibble -> BCD, pattern A -> 0x05ff)
  m.call(0x062a);

  regs.b = regs.a;                     m.step(0x0600, 4);
  regs.and(0xf0);                      m.step(0x0602, 7);
  if (regs.fZ) {
    m.step(0x060b, 12);                // jr z,0x060b taken -- no high nibble
  } else {
    m.step(0x0604, 7);                 // jr z not taken
    regs.rrca();                       m.step(0x0605, 4);
    regs.rrca();                       m.step(0x0606, 4);
    regs.rrca();                       m.step(0x0607, 4);
    regs.rrca();                       m.step(0x0608, 4); // A = high nibble
    mem.write8(0x86bf, regs.a);        m.step(0x060b, 13);
  }

  regs.a = regs.b;                     m.step(0x060c, 4);
  regs.and(0x0f);                      m.step(0x060e, 7);
  mem.write8(0x869f, regs.a);          m.step(0x0611, 13); // low nibble
  regs.cp(0x02);                       m.step(0x0613, 7);
  if (regs.fNZ) {
    m.ret(11);                         // 0613  ret nz taken
    return;
  }
  m.step(0x0614, 5);                   // ret nz not taken

  regs.de = 0x64c8;                    m.step(0x0617, 10);
  regs.bc = 0x001f;                    m.step(0x061a, 10); // B=0 accumulator seed, C=31 count
  for (;;) { // loc_061a: rolling add of 31 ROM bytes, 0x64c8 downward
    regs.a = mem.read8(regs.de);       m.step(0x061b, 7);
    regs.de = (regs.de - 1) & 0xffff;  m.step(0x061c, 6);
    regs.add(regs.b);                  m.step(0x061d, 4);
    regs.b = regs.a;                   m.step(0x061e, 4);
    regs.c = regs.dec8(regs.c);        m.step(0x061f, 4);
    if (regs.fNZ) { m.step(0x061a, 12); continue; }
    m.step(0x0621, 7); // jr nz not taken
    break;
  }

  regs.cp(0x8c);                       m.step(0x0623, 7);
  if (regs.fZ) {
    m.ret(11);                         // 0623  ret z taken -- checksum matches
    return;
  }
  m.step(0x0624, 5);                   // ret z not taken

  regs.hl = 0x451e;                    m.step(0x0627, 10);
  regs.addHl(regs.hl);                 m.step(0x0628, 11); // HL = 0x8a3c
  regs.incMem8(mem, regs.hl);          m.step(0x0629, 11); // tamper tripwire bump
  m.ret(); // 0629  ret
}
