// SPDX-License-Identifier: GPL-3.0-only

// loc_09db  (ROM 0x09DB-0x0A15) — home-marker render: walk the 5-byte occupancy list at (HL); for each
// non-zero slot stamp the four frog-home tiles at that slot's fixed VRAM base (0x6C/0x6D top pair, then
// 0x6E/0x6F on the row +0x1F below). block_0a05 (ROM 0x0A05-0x0A15) is the private tail-stamp helper:
// slots 0-3 `call nz` into it, and slot 4 falls through into it, so its `ret` returns to loc_09db's caller.
export function loc_09db(m) {
  const { regs, mem } = m;

  // slot 0 -> VRAM 0xab64
  regs.xor(regs.a);
  m.step(0x09dc, 4);
  regs.or(mem.read8(regs.hl));
  m.step(0x09dd, 7); // A = (hl) -- NZ iff this slot is occupied
  regs.de = 0xab64;
  m.step(0x09e0, 10);
  if (regs.fNZ) {
    m.push16(0x09e3);
    m.step(0x0a05, 17); // call nz,0x0a05 taken
    block_0a05();
  } else {
    m.step(0x09e3, 10); // call nz,0x0a05 not taken
  }
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x09e4, 6);

  // slot 1 -> VRAM 0xaaa4
  regs.xor(regs.a);
  m.step(0x09e5, 4);
  regs.or(mem.read8(regs.hl));
  m.step(0x09e6, 7);
  regs.de = 0xaaa4;
  m.step(0x09e9, 10);
  if (regs.fNZ) {
    m.push16(0x09ec);
    m.step(0x0a05, 17);
    block_0a05();
  } else {
    m.step(0x09ec, 10);
  }
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x09ed, 6);

  // slot 2 -> VRAM 0xa9e4
  regs.xor(regs.a);
  m.step(0x09ee, 4);
  regs.or(mem.read8(regs.hl));
  m.step(0x09ef, 7);
  regs.de = 0xa9e4;
  m.step(0x09f2, 10);
  if (regs.fNZ) {
    m.push16(0x09f5);
    m.step(0x0a05, 17);
    block_0a05();
  } else {
    m.step(0x09f5, 10);
  }
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x09f6, 6);

  // slot 3 -> VRAM 0xa924
  regs.xor(regs.a);
  m.step(0x09f7, 4);
  regs.or(mem.read8(regs.hl));
  m.step(0x09f8, 7);
  regs.de = 0xa924;
  m.step(0x09fb, 10);
  if (regs.fNZ) {
    m.push16(0x09fe);
    m.step(0x0a05, 17);
    block_0a05();
  } else {
    m.step(0x09fe, 10);
  }
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x09ff, 6);

  // slot 4 -> VRAM 0xa864 -- `ret z` when empty, else fall through into block_0a05
  regs.xor(regs.a);
  m.step(0x0a00, 4);
  regs.or(mem.read8(regs.hl));
  m.step(0x0a01, 7);
  regs.de = 0xa864;
  m.step(0x0a04, 10);
  if (regs.fZ) {
    m.ret(11); // ret z taken
    return;
  }
  m.step(0x0a05, 5); // ret z not taken -- fall into the stamp; its ret returns to the caller
  block_0a05();

  function block_0a05() {
    regs.exDeHl();
    m.step(0x0a06, 4); // HL = the slot's VRAM base (was DE)
    mem.write8(regs.hl, 0x6c);
    m.step(0x0a08, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0a09, 6);
    mem.write8(regs.hl, 0x6d);
    m.step(0x0a0b, 10);
    regs.bc = 0x001f;
    m.step(0x0a0e, 10);
    regs.addHl(regs.bc);
    m.step(0x0a0f, 11); // step to the row below (base+1 + 0x1f)
    mem.write8(regs.hl, 0x6e);
    m.step(0x0a11, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0a12, 6);
    mem.write8(regs.hl, 0x6f);
    m.step(0x0a14, 10);
    regs.exDeHl();
    m.step(0x0a15, 4);
    m.ret(10);
  }
}
