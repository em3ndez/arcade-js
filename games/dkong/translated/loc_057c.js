// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_057c  (ROM 0x057C–0x059A) — unpack 3 source bytes into 6 nibbles up a video column (digit.
 * renderer). ROM 0x057C-0x059A (body 0x057C-0x0592 + interior helper sub_0593
 * @0x0593-0x059A).
 *
 * DE (source ptr, e.g. 0x01BF) and IX (destination video cell) are LIVE-IN from
 * the caller sub_1486 (DE set @0x159D, IX from push hl/pop ix @0x15AB). `ex de,hl`
 * moves the source into HL, THEN DE is overwritten with the -0x20 up-a-row step,
 * so DE's live-in value survives only in HL. For each of B=3 bytes:
 * write the HIGH nibble (four rrca), then the LOW nibble; source walked DOWN by
 * `dec hl`. sub_0593 masks to a nibble, stores to (ix+0), and steps IX up a row.
 * Transitive gap the reachcrawler missed -- reachable only through sub_1486.
 */
export function loc_057c(m) {
  const { regs, mem } = m;
  regs.exDeHl();
  m.step(0x057d, 4); // ex de,hl -- HL := source (was DE, live-in)
  regs.de = 0xffe0;
  m.step(0x0580, 10); // ld de,0xffe0 -- step = -0x20 (up one row)
  regs.bc = 0x0304;
  m.step(0x0583, 10); // ld bc,0x0304 -- B=3 bytes, C=4 (unused marker)
  do {
    regs.a = mem.read8(regs.hl);
    m.step(0x0584, 7); // ld a,(hl) -- source byte
    regs.rrca();
    m.step(0x0585, 4); // rrca
    regs.rrca();
    m.step(0x0586, 4); // rrca
    regs.rrca();
    m.step(0x0587, 4); // rrca
    regs.rrca();
    m.step(0x0588, 4); // rrca -- A := high nibble (rotated into low 4 bits)
    m.push16(0x058b);
    m.step(0x0593, 17); // call 0x0593 -- write HIGH nibble, IX -= 0x20
    m.call(0x0593);
    regs.a = mem.read8(regs.hl);
    m.step(0x058c, 7); // ld a,(hl) -- same byte again
    m.push16(0x058f);
    m.step(0x0593, 17); // call 0x0593 -- write LOW nibble, IX -= 0x20
    m.call(0x0593);
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0590, 6); // dec hl -- next source byte (descending)
    regs.djnz();
    m.step(regs.b ? 0x0583 : 0x0592, regs.b ? 13 : 8); // djnz 0x0583
  } while (regs.b);
  m.ret(10); // ret @0x0592

  function sub_0593(m) {
    const { regs, mem } = m;
    regs.and(0x0f);
    m.step(0x0595, 7); // and 0x0f -- mask to a nibble (0..F)
    mem.write8(regs.ix & 0xffff, regs.a);
    m.step(0x0598, 19); // ld (ix+0x00),a -- write digit to video cell
    regs.addIx(regs.de);
    m.step(0x059a, 15); // add ix,de -- IX += -0x20 (up one row)
    m.ret(10); // ret @0x059a
  }
}
