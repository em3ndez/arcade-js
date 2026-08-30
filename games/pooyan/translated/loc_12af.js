// SPDX-License-Identifier: GPL-3.0-only

// loc_12af  (ROM 0x12af-0x12fa) -- a per-object update tick driven off IX (the current object
// record). First calls 0x4006 (housekeeping); if (ix+0x08) is already set it delegates to 0x13fe.
// Otherwise it advances a sub-position accumulator: (ix+0x05) += (ix+0x09), carrying into (ix+0x06)
// (the coarse position/frame counter). With the phase gate (0x8901) < 3 it delegates to 0x1399;
// past that it walks a variable-length table at 0x12fb via loc_0c45, indexes it by (0x8d41 & 0x0f)
// through rst 0x20, and compares the fetched value to (ix+0x06): equal -> 0x1383; below 0x14 ->
// ret; at/above 0x14 -> latch (ix+0x08)=1 and jp 0x381e (spawn/next-state) with DE=0x3838.
export function loc_12af(m) {
  const { regs, mem } = m;

  m.push16(0x12b2);
  m.step(0x4006, 17); // 12af  call 0x4006 (pattern A: rets to 0x12b2)
  m.call(0x4006, "per-object housekeeping");

  regs.a = mem.read8((regs.ix + 0x08) & 0xffff);
  m.step(0x12b5, 19); // 12b2  ld a,(ix+0x08)
  regs.and(regs.a);
  m.step(0x12b6, 4); // 12b5  and a
  if (regs.fNZ) {
    m.step(0x13fe, 10); // 12b6  jp nz,0x13fe -- (ix+0x08) latched -> delegate
    return m.call(0x13fe, "object flagged (ix+0x08!=0) -> 0x13fe");
  }
  m.step(0x12b9, 10); // 12b6  jp nz not taken

  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x12bc, 19); // 12b9  ld a,(ix+0x05)
  regs.add(mem.read8((regs.ix + 0x09) & 0xffff));
  m.step(0x12bf, 19); // 12bc  add a,(ix+0x09)
  if (regs.fNC) {
    m.step(0x12c4, 12); // 12bf  jr nc,0x12c4 (no carry)
  } else {
    m.step(0x12c1, 7); // 12bf  jr nc not taken (carry into coarse counter)
    regs.incMem8(mem, (regs.ix + 0x06) & 0xffff);
    m.step(0x12c4, 23); // 12c1  inc (ix+0x06)
  }

  // loc_12c4
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);
  m.step(0x12c7, 19); // 12c4  ld (ix+0x05),a
  regs.b = regs.a;
  m.step(0x12c8, 4); // 12c7  ld b,a
  regs.a = mem.read8(0x8901);
  m.step(0x12cb, 13); // 12c8  ld a,(0x8901)
  regs.cp(0x03);
  m.step(0x12cd, 7); // 12cb  cp 0x03
  if (regs.fC) {
    m.step(0x1399, 10); // 12cd  jp c,0x1399 -- phase gate < 3 -> delegate
    return m.call(0x1399, "(0x8901)<3 -> 0x1399");
  }
  m.step(0x12d0, 10); // 12cd  jp c not taken

  // loc_12d0
  regs.hl = 0x12fb;
  m.step(0x12d3, 10); // 12d0  ld hl,0x12fb -- table base
  regs.a = mem.read8(0x8907);
  m.step(0x12d6, 13); // 12d3  ld a,(0x8907)
  regs.and(0x1f);
  m.step(0x12d8, 7); // 12d6  and 0x1f
  regs.a = regs.srl(regs.a);
  m.step(0x12da, 8); // 12d8  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x12dc, 8); // 12da  srl a

  m.push16(0x12df);
  m.step(0x0c45, 17); // 12dc  call 0x0c45 (pattern A: rets to 0x12df)
  m.call(0x0c45, "variable-length table walk -> HL");

  regs.exDeHl();
  m.step(0x12e0, 4); // 12df  ex de,hl -> DE = table pointer
  regs.a = mem.read8(0x8d41);
  m.step(0x12e3, 13); // 12e0  ld a,(0x8d41)
  regs.and(0x0f);
  m.step(0x12e5, 7); // 12e3  and 0x0f -> index

  m.push16(0x12e6);
  m.step(0x0020, 11); // 12e5  rst 0x20 -> loc_0020 table lookup (rets to 0x12e6)
  m.call(0x0020, "rst 0x20 HL+=A; A=(HL)");

  regs.c = regs.a;
  m.step(0x12e7, 4); // 12e6  ld c,a
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x12ea, 19); // 12e7  ld a,(ix+0x06)
  regs.cp(regs.c);
  m.step(0x12eb, 4); // 12ea  cp c
  if (regs.fZ) {
    m.step(0x1383, 10); // 12eb  jp z,0x1383 -- coarse counter == table value
    return m.call(0x1383, "(ix+0x06)==table value -> 0x1383");
  }
  m.step(0x12ee, 10); // 12eb  jp z not taken

  regs.cp(0x14);
  m.step(0x12f0, 7); // 12ee  cp 0x14
  if (regs.fC) {
    m.ret(11); // 12f0  ret c -- (ix+0x06) < 0x14, still travelling
    return;
  }
  m.step(0x12f1, 5); // 12f0  ret c not taken

  mem.write8((regs.ix + 0x08) & 0xffff, 0x01);
  m.step(0x12f5, 19); // 12f1  ld (ix+0x08),0x01 -- latch
  regs.de = 0x3838;
  m.step(0x12f8, 10); // 12f5  ld de,0x3838
  m.step(0x381e, 10); // 12f8  jp 0x381e
  return m.call(0x381e, "reached end -> spawn/next-state 0x381e");
}
