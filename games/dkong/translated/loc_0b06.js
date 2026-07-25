// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0b06  (ROM 0x0B06–0x0B67) — walk a ROM table, or terminal setup.
 */
export function loc_0b06(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x601a);
  m.step(0x0b09, 13); // ld a,(0x601a)
  regs.rrca();
  m.step(0x0b0a, 4); // rrca
  if (regs.fC) {
    m.ret(11); // ret c -- 0x601A bit 0 was set
    return;
  }
  m.step(0x0b0b, 5); // ret c NOT taken

  regs.hl = mem.read16(0x63c2); // INDIRECT walk pointer
  m.step(0x0b0e, 16); // ld hl,(0x63c2)
  regs.a = mem.read8(regs.hl);
  m.step(0x0b0f, 7); // ld a,(hl)
  regs.cp(0x7f);
  m.step(0x0b11, 7); // cp 0x7f

  if (!regs.fZ) {
    m.step(0x0b14, 10); // jp z NOT taken -- walk a non-sentinel byte
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0b15, 6); // inc hl
    mem.write16(0x63c2, regs.hl); // advance the walk pointer
    m.step(0x0b18, 16);
    regs.c = regs.a;
    m.step(0x0b19, 4); // ld c,a
    regs.hl = 0x690b;
    m.step(0x0b1c, 10); // ld hl,0x690b
    m.push16(0x0b1d);
    m.step(0x0038, 11); // rst 0x38 -- add the table byte
    m.call(0x0038);
    m.ret();
    return;
  }
  m.step(0x0b1e, 10); // jp z,0x0b1e -- the 0x7F sentinel: terminal setup

  regs.hl = 0x385c;
  m.step(0x0b21, 10); // ld hl,0x385c
  m.push16(0x0b24);
  m.step(0x004e, 17);
  m.call(0x004e); // copies 0x28 bytes; LEAVES HL = 0x3884

  regs.de = 0x6900; // HL is NOT reloaded -- it is 0x3884 from sub_004e
  m.step(0x0b27, 10); // ld de,0x6900
  regs.bc = 0x0008;
  m.step(0x0b2a, 10); // ld bc,0x0008
  m.ldir(0x0b2c); // ldir FROM 0x3884

  regs.hl = 0x6908;
  m.step(0x0b2f, 10); // ld hl,0x6908
  regs.c = 0x50;
  m.step(0x0b31, 7); // ld c,0x50
  m.push16(0x0b32);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);
  regs.hl = 0x690b;
  m.step(0x0b35, 10); // ld hl,0x690b
  regs.c = 0xfc;
  m.step(0x0b37, 7); // ld c,0xfc
  m.push16(0x0b38);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  // do { call 0x304A } while (0x638E != 0x0A)
  for (;;) {
    m.push16(0x0b3b);
    m.step(0x304a, 17);
    m.call(0x304a); // advances 0x638E toward 0x0A
    regs.a = mem.read8(0x638e);
    m.step(0x0b3e, 13); // ld a,(0x638e)
    regs.cp(0x0a);
    m.step(0x0b40, 7); // cp 0x0a
    if (regs.fZ) {
      m.step(0x0b43, 10); // jp nz NOT taken -> exit loop
      break;
    }
    m.step(0x0b38, 10); // jp nz,0x0b38 -- loop
  }

  regs.a = 0x03;
  m.step(0x0b45, 7); // ld a,0x03
  mem.write8(0x6082, regs.a);
  m.step(0x0b48, 13); // ld (0x6082),a
  regs.de = 0x392c;
  m.step(0x0b4b, 10); // ld de,0x392c
  m.push16(0x0b4e);
  m.step(0x0da7, 17);
  m.call(0x0da7);

  regs.a = 0x10;
  m.step(0x0b50, 7); // ld a,0x10
  mem.write8(0x74aa, regs.a, 10); // ld (0x74aa),a
  m.step(0x0b53, 13);
  mem.write8(0x748a, regs.a, 10); // ld (0x748a),a
  m.step(0x0b56, 13);
  regs.a = 0x05;
  m.step(0x0b58, 7); // ld a,0x05
  mem.write8(0x638d, regs.a);
  m.step(0x0b5b, 13); // ld (0x638d),a
  regs.a = 0x20;
  m.step(0x0b5d, 7); // ld a,0x20
  mem.write8(0x6009, regs.a); // arm the countdown to 32
  m.step(0x0b60, 13); // ld (0x6009),a
  regs.hl = 0x6385;
  m.step(0x0b63, 10); // ld hl,0x6385
  regs.incMem8(mem, regs.hl); // inc (hl) -- advance the sequence; HL stays 0x6385
  m.step(0x0b64, 11);
  mem.write16(0x63c0, regs.hl); // seed loc_3069's pointer
  m.step(0x0b67, 16); // ld (0x63c0),hl
  m.ret(); // ret (0x0B67)
}
