// SPDX-License-Identifier: GPL-3.0-only

// loc_0942  (ROM 0x0942-0x09DA) — loc_0425 render core: run the game-timer countdown on 0x83e5/0x83e6
// (gated by (0x83cd)), render the frog sprite (call 0x1952) + home-marker (call 0x19e2), and the frog
// animation (call 0x223d/0x0faf). Carves out loc_09aa[T] (0x09aa-0x09c9); enters it by delegation.
export function loc_0942(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x0943, 4);
  mem.write8(0x83ce, regs.a);
  m.step(0x0946, 13); // (0x83ce) = 0
  regs.a = mem.read8(0x83cd);
  m.step(0x0949, 13);
  regs.or(regs.a);
  m.step(0x094a, 4);
  if (regs.fNZ) {
    m.step(0x0950, 12);
    return block_0950();
  }
  m.step(0x094c, 7);
  regs.xor(regs.a);
  m.step(0x094d, 4);
  mem.write8(0x83cf, regs.a);
  m.step(0x0950, 13); // (0x83cf) = 0
  return block_0950();

  function block_0950() {
    regs.a = mem.read8(0x83fe);
    m.step(0x0953, 13);
    regs.or(regs.a);
    m.step(0x0954, 4);
    if (regs.fZ) {
      m.step(0x09ca, 12);
      return block_09ca();
    }
    m.step(0x0956, 7);
    regs.a = mem.read8(0x83fd);
    m.step(0x0959, 13); // A = current phase
    regs.a = regs.dec8(regs.a);
    m.step(0x095a, 4);
    if (regs.fNZ) {
      m.step(0x0961, 12);
      return block_0961();
    }
    m.step(0x095c, 7);
    regs.hl = 0x83e5;
    m.step(0x095f, 10); // HL = timer cell for phase 1
    m.step(0x0964, 12);
    return block_0964();
  }

  function block_0961() {
    regs.hl = 0x83e6;
    m.step(0x0964, 10); // HL = timer cell for other phases
    return block_0964();
  }

  function block_0964() {
    regs.a = mem.read8(0x83cd);
    m.step(0x0967, 13);
    regs.or(regs.a);
    m.step(0x0968, 4);
    if (regs.fNZ) {
      m.step(0x0972, 12);
      return block_0972();
    }
    m.step(0x096a, 7);
    regs.decMem8(mem, regs.hl);
    m.step(0x096b, 11); // dec the timer at (HL)
    if (regs.fNZ) {
      m.step(0x0972, 12);
      return block_0972();
    }
    m.step(0x096d, 7);
    regs.a = 0x01;
    m.step(0x096f, 7);
    mem.write8(0x83cf, regs.a);
    m.step(0x0972, 13); // (0x83cf) = 1 -- timer elapsed
    return block_0972();
  }

  function block_0972() {
    m.push16(0x0975);
    m.step(0x1952, 17);
    m.call(0x1952); // render the frog sprite
    regs.a = mem.read8(0x83cd);
    m.step(0x0978, 13);
    regs.or(regs.a);
    m.step(0x0979, 4);
    if (regs.fNZ) {
      m.step(0x0985, 12);
      return block_0985();
    }
    m.step(0x097b, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x097c, 4);
    mem.write8(0x83b5, regs.a);
    m.step(0x097f, 13); // (0x83b5) = 1
    regs.hl = 0xa850;
    m.step(0x0982, 10);
    m.push16(0x0985);
    m.step(0x19e2, 17);
    m.call(0x19e2); // blit the home-marker tile string at 0xa850
    return block_0985();
  }

  function block_0985() {
    regs.a = mem.read8(0x826c);
    m.step(0x0988, 13);
    regs.xor(0x01);
    m.step(0x098a, 7);
    mem.write8(0x83b5, regs.a);
    m.step(0x098d, 13); // (0x83b5) = (0x826c) ^ 1
    regs.a = mem.read8(0x83fd);
    m.step(0x0990, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x0991, 4);
    if (regs.fNZ) {
      m.step(0x09d2, 10);
      return block_09d2();
    }
    m.step(0x0994, 10);
    regs.hl = 0x825e;
    m.step(0x0997, 10);
    m.push16(0x099a);
    m.step(0x09db, 17);
    m.call(0x09db); // animate lane row from (0x825e)
    return block_099a();
  }

  function block_099a() {
    regs.a = mem.read8(0x825a);
    m.step(0x099d, 13);
    regs.and(regs.a);
    m.step(0x099e, 4);
    if (regs.fZ) {
      m.step(0x09aa, 12);
      return m.call(0x09aa); // jr z 0x09aa -- delegate to loc_09aa
    }
    m.step(0x09a0, 7);
    m.push16(0x09a3);
    m.step(0x223d, 17);
    m.call(0x223d);
    m.push16(0x09a6);
    m.step(0x0faf, 17);
    m.call(0x0faf); // frog-anim dispatcher
    return block_09a6();
  }

  function block_09a6() {
    regs.xor(regs.a);
    m.step(0x09a7, 4);
    mem.write8(0x825a, regs.a);
    m.step(0x09aa, 13); // (0x825a) = 0
    return m.call(0x09aa); // fall through into loc_09aa
  }

  function block_09ca() {
    regs.a = mem.read8(0x83cd);
    m.step(0x09cd, 13);
    regs.or(regs.a);
    m.step(0x09ce, 4);
    if (regs.fZ) {
      m.ret(11); // ret z taken
      return;
    }
    m.step(0x09cf, 5);
    m.step(0x09aa, 10);
    return m.call(0x09aa); // jp 0x09aa -- delegate to loc_09aa
  }

  function block_09d2() {
    regs.hl = 0x8263;
    m.step(0x09d5, 10);
    m.push16(0x09d8);
    m.step(0x09db, 17);
    m.call(0x09db); // animate lane row from (0x8263)
    m.step(0x099a, 10);
    return block_099a();
  }
}
