// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_12f2  (ROM 0x12F2–0x1343) — dispatch idx 14: counter-gated state setup; TWIN of loc_1344.
 *
 *   call 0x011c ; 0x622C=0 ; dec (0x6228) ; ldir 8 bytes 0x6228->0x6040 ; and a
 *   counter != 0 -> loc_1334 (0x600A = 0x08, or 0x17 if 0x600F != 0)
 *   counter == 0 -> call 0x13ca(HL=0x60B2,A=0x01) ; render (0x309F/1826/309F) ;
 *                   0x6009=0xC0 ; 0x600A=0x10 ; ret
 *
 * TWIN of loc_1344 (differs in constants). The call 0x13ca needs NO caller-skip guard --
 * sub_13ca's own rst-0x08 abort returns here (to 0x1312) either way.
 * Translated for completeness; not yet wired into the live dispatcher.
 */
export function loc_12f2(m) {
  const { regs, mem } = m;

  m.push16(0x12f5);
  m.step(0x011c, 17);
  m.call(0x011c);
  regs.xor(regs.a); // A = 0
  m.step(0x12f6, 4);
  mem.write8(0x622c, regs.a);
  m.step(0x12f9, 13); // ld (0x622c),a
  regs.hl = 0x6228;
  m.step(0x12fc, 10); // ld hl,0x6228
  regs.decMem8(mem, regs.hl); // dec (hl) -- Z-correct
  m.step(0x12fd, 11);
  regs.a = mem.read8(regs.hl); // A = counter
  m.step(0x12fe, 7); // ld a,(hl)
  regs.de = 0x6040;
  m.step(0x1301, 10); // ld de,0x6040
  regs.bc = 0x0008;
  m.step(0x1304, 10); // ld bc,0x0008
  m.ldir(0x1306); // ldir -- 8 bytes from HL=0x6228 to 0x6040
  regs.and(regs.a); // test the counter
  m.step(0x1307, 4); // and a
  if (regs.fNZ) {
    // -- loc_1334: counter != 0 --
    m.step(0x1334, 10); // jp nz,0x1334
    regs.c = 0x08;
    m.step(0x1336, 7); // ld c,0x08
    regs.a = mem.read8(0x600f);
    m.step(0x1339, 13); // ld a,(0x600f)
    regs.and(regs.a);
    m.step(0x133a, 4); // and a
    if (regs.fZ) {
      m.step(0x133f, 10); // jp z,0x133f -- keep C=0x08
    } else {
      m.step(0x133d, 10); // jp z not taken
      regs.c = 0x17;
      m.step(0x133f, 7); // ld c,0x17
    }
    regs.a = regs.c;
    m.step(0x1340, 4); // ld a,c
    mem.write8(0x600a, regs.a); // 0x600A = 0x08 or 0x17
    m.step(0x1343, 13);
    m.ret();
    return;
  }
  m.step(0x130a, 10); // jp nz not taken

  regs.a = 0x01;
  m.step(0x130c, 7); // ld a,0x01
  regs.hl = 0x60b2;
  m.step(0x130f, 10); // ld hl,0x60b2
  m.push16(0x1312);
  m.step(0x13ca, 17);
  m.call(0x13ca); // HL=0x60B2, A=0x01 -- ordinary call, no guard

  regs.hl = 0x76d4;
  m.step(0x1315, 10); // ld hl,0x76d4
  regs.a = mem.read8(0x600f);
  m.step(0x1318, 13); // ld a,(0x600f)
  regs.and(regs.a);
  m.step(0x1319, 4); // and a
  if (regs.fZ) {
    m.step(0x1322, 12); // jr z,0x1322
  } else {
    m.step(0x131b, 7); // jr z not taken
    regs.de = 0x0302;
    m.step(0x131e, 10); // ld de,0x0302
    m.push16(0x1321);
    m.step(0x309f, 17);
    m.call(0x309f);
    regs.hl = (regs.hl - 1) & 0xffff; // dec hl -- HL = 0x76D3
    m.step(0x1322, 6);
  }
  m.push16(0x1325);
  m.step(0x1826, 17);
  m.call(0x1826); // fill helper -- HL live-in 0x76D4 or 0x76D3
  regs.de = 0x0300;
  m.step(0x1328, 10); // ld de,0x0300
  m.push16(0x132b);
  m.step(0x309f, 17);
  m.call(0x309f);

  regs.hl = 0x6009;
  m.step(0x132e, 10); // ld hl,0x6009
  mem.write8(regs.hl, 0xc0); // arm countdown
  m.step(0x1330, 10); // ld (hl),0xc0
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1331, 6); // inc hl
  mem.write8(regs.hl, 0x10); // 0x600A = 0x10
  m.step(0x1333, 10); // ld (hl),0x10
  m.ret();
}
