// SPDX-License-Identifier: GPL-3.0-only

// loc_1f1c  (ROM 0x1F1C-0x1FC6) — frog-reached-HOME goal scoring + reset. Stamps the 2x2 home tiles
// 0x6C-0x6F at the slot HL, adds the BCD score deltas (loc_08e0: 0x20 on the (0x8134) bonus arm, then 5),
// refreshes the display (loc_08c5), and — in play mode ((0x83FE)!=0) — either queues the fanfare and a
// 0x2E87 pointer, or on the 4th home clears the player RAM (loc_07E6) + a 0xB040 strip and re-seeds the
// active-frog state block (0x8249-0x826C).
export function loc_1f1c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8134);
  m.step(0x1f1f, 13);
  regs.and(regs.a);
  m.step(0x1f20, 4);
  if (regs.fZ) {
    m.step(0x1f2b, 12);
    return block_1f2b();
  }
  m.step(0x1f22, 7);
  regs.de = 0x0020;
  m.step(0x1f25, 10);
  m.push16(0x1f28);
  m.step(0x08e0, 17);
  m.call(0x08e0); // BCD score add, delta 0x20 -- the (0x8134) bonus
  m.push16(0x1f2b);
  m.step(0x27bc, 17);
  m.call(0x27bc);
  return block_1f2b();

  function block_1f2b() {
    mem.write8(regs.hl, 0x6c);
    m.step(0x1f2d, 10); // home slot: top-left tile
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1f2e, 6);
    mem.write8(regs.hl, 0x6d);
    m.step(0x1f30, 10); // top-right
    regs.bc = 0x001f;
    m.step(0x1f33, 10);
    regs.addHl(regs.bc);
    m.step(0x1f34, 11); // HL += 0x1f -- one tile row down
    mem.write8(regs.hl, 0x6e);
    m.step(0x1f36, 10); // bottom-left
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1f37, 6);
    mem.write8(regs.hl, 0x6f);
    m.step(0x1f39, 10); // bottom-right
    m.push16(regs.hl);
    m.step(0x1f3a, 11);
    m.push16(regs.de);
    m.step(0x1f3b, 11);
    regs.de = 0x0005;
    m.step(0x1f3e, 10);
    m.push16(0x1f41);
    m.step(0x08e0, 17);
    m.call(0x08e0); // BCD score add, delta 5 -- the home bonus
    m.push16(0x1f44);
    m.step(0x08c5, 17);
    m.call(0x08c5); // display refresh (interior entry of loc_0870)
    regs.a = mem.read8(0x83fe);
    m.step(0x1f47, 13); // play/attract gate
    regs.or(regs.a);
    m.step(0x1f48, 4);
    if (regs.fZ) {
      m.step(0x1f94, 12); // jr z,0x1f94 -- attract: skip the fanfare/reset
      return block_1f94();
    }
    m.step(0x1f4a, 7);
    regs.xor(regs.a);
    m.step(0x1f4b, 4);
    regs.h = regs.a;
    m.step(0x1f4c, 4);
    regs.l = regs.a;
    m.step(0x1f4d, 4);
    mem.write16(0x8382, regs.hl);
    m.step(0x1f50, 16); // (0x8382) = 0
    m.push16(0x1f51);
    m.step(0x0018, 11);
    m.call(0x0018); // rst 0x18 -- A=0
    regs.a = 0xf0;
    m.step(0x1f53, 7);
    m.push16(0x1f54);
    m.step(0x0018, 11);
    m.call(0x0018); // rst 0x18 -- A=0xf0
    regs.a = mem.read8(0x83fd);
    m.step(0x1f57, 13); // active player
    regs.hl = 0x825c;
    m.step(0x1f5a, 10); // P1 home-count
    regs.a = regs.dec8(regs.a);
    m.step(0x1f5b, 4);
    if (regs.fZ) {
      m.step(0x1f5e, 12);
      return block_1f5e();
    }
    m.step(0x1f5d, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x1f5e, 4); // player 2 -> (0x825d)
    return block_1f5e();
  }

  function block_1f5e() {
    regs.a = mem.read8(regs.hl);
    m.step(0x1f5f, 7); // this player's home count
    regs.cp(0x04);
    m.step(0x1f61, 7);
    if (regs.fZ) {
      m.step(0x1f81, 12); // jr z,0x1f81 -- 4th home, board cleared
      return block_1f81();
    }
    m.step(0x1f63, 7);
    regs.a = 0x08;
    m.step(0x1f65, 7);
    m.push16(0x1f66);
    m.step(0x0018, 11);
    m.call(0x0018); // rst 0x18 -- A=0x08
    regs.a = 0x0e;
    m.step(0x1f68, 7);
    m.push16(0x1f69);
    m.step(0x0018, 11);
    m.call(0x0018); // rst 0x18 -- A=0x0e
    regs.hl = 0x8381;
    m.step(0x1f6c, 10);
    regs.decMem8(mem, regs.hl);
    m.step(0x1f6d, 11); // (0x8381)-- fanfare index
    if (regs.fNZ) {
      m.step(0x1f71, 12);
      return block_1f71();
    }
    m.step(0x1f6f, 7);
    mem.write8(regs.hl, 0x14);
    m.step(0x1f71, 10); // reload (0x8381) = 0x14
    return block_1f71();
  }

  function block_1f71() {
    regs.a = mem.read8(regs.hl);
    m.step(0x1f72, 7); // A = (0x8381)
    regs.hl = 0x2e87;
    m.step(0x1f75, 10); // ROM pointer table base
    regs.add(regs.a);
    m.step(0x1f76, 4); // A = 2*index
    regs.add(regs.l);
    m.step(0x1f77, 4); // A = 0x87 + 2*index
    regs.l = regs.a;
    m.step(0x1f78, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x1f79, 7); // pointer low byte
    regs.l = regs.inc8(regs.l);
    m.step(0x1f7a, 4);
    regs.h = mem.read8(regs.hl);
    m.step(0x1f7b, 7); // pointer high byte
    regs.l = regs.a;
    m.step(0x1f7c, 4); // HL = 16-bit table pointer
    mem.write16(0x8382, regs.hl);
    m.step(0x1f7f, 16); // (0x8382) = pointer
    m.step(0x1f94, 12); // jr 0x1f94
    return block_1f94();
  }

  function block_1f81() {
    mem.write8(0x842f, regs.a);
    m.step(0x1f84, 13); // (0x842f) = A (0x04)
    m.push16(0x1f87);
    m.step(0x07e6, 17);
    m.call(0x07e6); // clear the active player's work RAM
    regs.hl = 0xb040;
    m.step(0x1f8a, 10);
    regs.bc = 0x1800;
    m.step(0x1f8d, 10); // B=0x18 count, C=0x00 fill
    for (;;) {
      mem.write8(regs.hl, regs.c);
      m.step(0x1f8e, 7);
      regs.l = regs.inc8(regs.l);
      m.step(0x1f8f, 4);
      if (m.regs.djnz() !== 0) {
        m.step(0x1f8d, 13);
        continue;
      }
      m.step(0x1f91, 8);
      break;
    }
    m.push16(0x1f94);
    m.step(0x27bc, 17);
    m.call(0x27bc);
    return block_1f94();
  }

  function block_1f94() {
    regs.a = 0x20;
    m.step(0x1f96, 7);
    mem.write8(0x826a, regs.a);
    m.step(0x1f99, 13); // (0x826a) = 0x20
    regs.a = 0x80;
    m.step(0x1f9b, 7);
    m.push16(0x1f9c);
    m.step(0x0018, 11);
    m.call(0x0018); // rst 0x18 -- A=0x80
    regs.hl = 0x8044;
    m.step(0x1f9f, 10);
    regs.xor(regs.a);
    m.step(0x1fa0, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x1fa1, 7); // (0x8044) = 0
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1fa2, 6);
    mem.write8(regs.hl, regs.a);
    m.step(0x1fa3, 7); // (0x8045) = 0
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1fa4, 6);
    mem.write8(regs.hl, regs.a);
    m.step(0x1fa5, 7); // (0x8046) = 0
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1fa6, 6);
    mem.write8(regs.hl, 0xf0);
    m.step(0x1fa8, 10); // (0x8047) = 0xf0
    regs.de = m.pop16();
    m.step(0x1fa9, 10);
    regs.hl = m.pop16();
    m.step(0x1faa, 10);
    regs.xor(regs.a);
    m.step(0x1fab, 4);
    mem.write8(0x829b, regs.a);
    m.step(0x1fae, 13);
    mem.write8(0x83ea, regs.a);
    m.step(0x1fb1, 13);
    mem.write8(0x824d, regs.a);
    m.step(0x1fb4, 13);
    mem.write8(0x8249, regs.a);
    m.step(0x1fb7, 13);
    mem.write8(0x8251, regs.a);
    m.step(0x1fba, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x1fbb, 4);
    mem.write8(0x826c, regs.a);
    m.step(0x1fbe, 13); // (0x826c) = 1
    mem.write8(0x83cd, regs.a);
    m.step(0x1fc1, 13); // (0x83cd) = 1
    regs.a = 0x10;
    m.step(0x1fc3, 7);
    mem.write8(0x8268, regs.a);
    m.step(0x1fc6, 13); // (0x8268) = 0x10
    m.ret();
  }
}
