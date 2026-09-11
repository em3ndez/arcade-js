// SPDX-License-Identifier: GPL-3.0-only
// loc_dbf7  (ROM 0xdbf7-0xdce0) -- per-frame vector-list emit: seeds $6095/$608d/$6096 & $78 from $2e/$2f,
// advances the 16-bit $2e/$2f counter, builds $60c0-$60c3 from $4d/$4e, fires several draw JSRs (loc_dd0d/
// dd2b/dd27/df39/df1f/d8a9/df75/df53/df57), walks two tables ($7d,x x=11..0 and $78,x x=4..0), then tail-
// jmps loc_df73 with $50-indexed color from $dfe4/$dfe8 tables.
export function loc_dbf7(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x2e); regs.setNZ(regs.a); m.step(0xdbf9, 3);
  if (regs.fZ) {
    m.step(0xdc19, 4); // beq taken crosses db->dc page (+1)
  } else {
    m.step(0xdbfb, 2);
    mem.write8(0x6095, regs.a); m.step(0xdbfe, 4);
    mem.write8(0x608d, regs.a); m.step(0xdc01, 4);
    regs.a = mem.read8(0x2f); regs.setNZ(regs.a); m.step(0xdc03, 3);
    mem.write8(0x6096, regs.a); m.step(0xdc06, 4);
    regs.x = 0x00; regs.setNZ(regs.x); m.step(0xdc08, 2);
    m.push16(0xdc0a); m.step(0xdc0b, 6); m.call(0xdce6);
    regs.cmp(0x01); m.step(0xdc0d, 2);
    let setFF;
    if (regs.fNZ) { setFF = true; m.step(0xdc15, 3); }
    else {
      m.step(0xdc0f, 2);
      regs.a = regs.y; regs.setNZ(regs.a); m.step(0xdc10, 2);
      if (regs.fNZ) { setFF = true; m.step(0xdc15, 3); }
      else {
        m.step(0xdc12, 2);
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0xdc13, 2);
        if (regs.fPl) { setFF = false; m.step(0xdc19, 3); }
        else { setFF = true; m.step(0xdc15, 2); }
      }
    }
    if (setFF) {
      regs.a = 0xff; regs.setNZ(regs.a); m.step(0xdc17, 2);
      mem.write8(0x78, regs.a); m.step(0xdc19, 3);
    }
  }

  // dc19 join
  regs.x = 0x00; regs.setNZ(regs.x); m.step(0xdc1b, 2);
  mem.write8(0x73, regs.x); m.step(0xdc1d, 3);
  { const v = (mem.read8(0x2e) + 1) & 0xff; mem.write8(0x2e, v); regs.setNZ(v); } m.step(0xdc1f, 5);
  if (regs.fNZ) { m.step(0xdc27, 3); }
  else {
    m.step(0xdc21, 2);
    { const v = (mem.read8(0x2f) + 1) & 0xff; mem.write8(0x2f, v); regs.setNZ(v); } m.step(0xdc23, 5);
    if (regs.fPl) { m.step(0xdc27, 3); }
    else {
      m.step(0xdc25, 2);
      mem.write8(0x2f, regs.x); m.step(0xdc27, 3);
    }
  }

  // dc27 join
  mem.write8(0x60db, regs.a); m.step(0xdc2a, 4);
  regs.a = mem.read8(0x60d8); regs.setNZ(regs.a); m.step(0xdc2d, 4);
  regs.and(0x78); m.step(0xdc2f, 2);
  mem.write8(0x4d, regs.a); m.step(0xdc31, 3);
  if (regs.fZ) { m.step(0xdc38, 3); }
  else {
    m.step(0xdc33, 2);
    mem.write8(0x60c0, regs.a); m.step(0xdc36, 4);
    regs.x = 0xa4; regs.setNZ(regs.x); m.step(0xdc38, 2);
  }

  // dc38 join
  mem.write8(0x60c1, regs.x); m.step(0xdc3b, 4);
  regs.x = 0x00; regs.setNZ(regs.x); m.step(0xdc3d, 2);
  regs.a = mem.read8(0x4e); regs.setNZ(regs.a); m.step(0xdc3f, 3);
  if (regs.fZ) { m.step(0xdc47, 3); }
  else {
    m.step(0xdc41, 2);
    regs.a = regs.asl(regs.a); m.step(0xdc42, 2);
    mem.write8(0x60c2, regs.a); m.step(0xdc45, 4);
    regs.x = 0xa4; regs.setNZ(regs.x); m.step(0xdc47, 2);
  }

  // dc47 join
  mem.write8(0x60c3, regs.x); m.step(0xdc4a, 4);
  m.push16(0xdc4c); m.step(0xdc4d, 6); m.call(0xdd0d);
  regs.y = mem.read8(0x4d); regs.setNZ(regs.y); m.step(0xdc4f, 3);
  regs.a = 0xd0; regs.setNZ(regs.a); m.step(0xdc51, 2);
  regs.x = 0xf0; regs.setNZ(regs.x); m.step(0xdc53, 2);
  m.push16(0xdc55); m.step(0xdc56, 6); m.call(0xdd2b);
  regs.y = mem.read8(0x4e); regs.setNZ(regs.y); m.step(0xdc58, 3);
  m.push16(0xdc5a); m.step(0xdc5b, 6); m.call(0xdd27);
  regs.a = mem.read8(0x52); regs.setNZ(regs.a); m.step(0xdc5d, 3);
  regs.and(0x10); m.step(0xdc5f, 2);
  if (regs.fZ) { m.step(0xdc7e, 3); }
  else {
    m.step(0xdc61, 2);
    regs.a = 0x34; regs.setNZ(regs.a); m.step(0xdc63, 2);
    regs.x = 0x82; regs.setNZ(regs.x); m.step(0xdc65, 2);
    m.push16(0xdc67); m.step(0xdc68, 6); m.call(0xdf39);
    regs.y = 0x10; regs.setNZ(regs.y); m.step(0xdc6a, 2);
    regs.a = mem.read8(0x4d); regs.setNZ(regs.a); m.step(0xdc6c, 3);
    regs.and(0x60); m.step(0xdc6e, 2);
    if (regs.fZ) { m.step(0xdc7e, 3); }
    else {
      m.step(0xdc70, 2);
      regs.eor(0x20); m.step(0xdc72, 2);
      if (regs.fZ) { m.step(0xdc78, 3); }
      else {
        m.step(0xdc74, 2);
        regs.a = 0x04; regs.setNZ(regs.a); m.step(0xdc76, 2);
        regs.y = 0x08; regs.setNZ(regs.y); m.step(0xdc78, 2);
      }
      // dc78 join
      mem.write8(0x60e0, regs.a); m.step(0xdc7b, 4);
      mem.write8(0x4000, regs.y); m.step(0xdc7e, 4);
    }
  }

  // dc7e join
  regs.a = 0x34; regs.setNZ(regs.a); m.step(0xdc80, 2);
  regs.x = 0x92; regs.setNZ(regs.x); m.step(0xdc82, 2);
  m.push16(0xdc84); m.step(0xdc85, 6); m.call(0xdf39);

  // dc85..dca5: table walk $7d,x for x = 11..0
  regs.x = 0x0b; regs.setNZ(regs.x); m.step(0xdc87, 2);
  do {
    regs.a = mem.read8((0x7d + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xdc89, 4);
    if (regs.fZ) { m.step(0xdca4, 3); }
    else {
      m.step(0xdc8b, 2);
      mem.write8(0x35, regs.a); m.step(0xdc8d, 3);
      mem.write8(0x38, regs.x); m.step(0xdc8f, 3);
      regs.a = regs.x; regs.setNZ(regs.a); m.step(0xdc90, 2);
      m.push16(0xdc92); m.step(0xdc93, 6); m.call(0xdf1f);
      regs.y = 0xf4; regs.setNZ(regs.y); m.step(0xdc95, 2);
      regs.x = 0xf4; regs.setNZ(regs.x); m.step(0xdc97, 2);
      regs.a = mem.read8(0x35); regs.setNZ(regs.a); m.step(0xdc99, 3);
      m.push16(0xdc9b); m.step(0xdc9c, 6); m.call(0xd8a9);
      regs.a = 0x0c; regs.setNZ(regs.a); m.step(0xdc9e, 2);
      regs.x = regs.a; regs.setNZ(regs.x); m.step(0xdc9f, 2);
      m.push16(0xdca1); m.step(0xdca2, 6); m.call(0xdf75);
      regs.x = mem.read8(0x38); regs.setNZ(regs.x); m.step(0xdca4, 3);
    }
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xdca5, 2);
    if (regs.fPl) { m.step(0xdc87, 3); } else { m.step(0xdca7, 2); break; }
  } while (true);

  // dca7 join
  m.push16(0xdca9); m.step(0xdcaa, 6); m.call(0xdf53);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xdcac, 2);
  regs.x = 0x16; regs.setNZ(regs.x); m.step(0xdcae, 2);
  m.push16(0xdcb0); m.step(0xdcb1, 6); m.call(0xdf75);

  // dcb1..dccb: table walk $78,x for x=$37 = 4..0, y from $dce1,x -> $31e4/$31e5,y
  regs.x = 0x04; regs.setNZ(regs.x); m.step(0xdcb3, 2);
  mem.write8(0x37, regs.x); m.step(0xdcb5, 3);
  do {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xdcb7, 3);
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdcb9, 2);
    regs.a = mem.read8((0x78 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xdcbb, 4);
    if (regs.fZ) { m.step(0xdcc0, 3); }
    else {
      m.step(0xdcbd, 2);
      regs.y = mem.read8((0xdce1 + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xdcc0, 4);
    }
    regs.a = mem.read8((0x31e4 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xdcc3, 4);
    regs.x = mem.read8((0x31e5 + regs.y) & 0xffff); regs.setNZ(regs.x); m.step(0xdcc6, 4);
    m.push16(0xdcc8); m.step(0xdcc9, 6); m.call(0xdf57);
    { const v = (mem.read8(0x37) - 1) & 0xff; mem.write8(0x37, v); regs.setNZ(v); } m.step(0xdccb, 5);
    if (regs.fPl) { m.step(0xdcb5, 3); } else { m.step(0xdccd, 2); break; }
  } while (true);

  // dccd join
  regs.x = 0xac; regs.setNZ(regs.x); m.step(0xdccf, 2);
  regs.a = 0x30; regs.setNZ(regs.a); m.step(0xdcd1, 2);
  m.push16(0xdcd3); m.step(0xdcd4, 6); m.call(0xdf75);
  regs.y = mem.read8(0x50); regs.setNZ(regs.y); m.step(0xdcd6, 3);
  regs.a = mem.read8((0xdfe8 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xdcd9, 4);
  regs.x = mem.read8((0xdfe4 + regs.y) & 0xffff); regs.setNZ(regs.x); m.step(0xdcdc, 4);
  regs.y = 0xc0; regs.setNZ(regs.y); m.step(0xdcde, 2);
  m.step(0xdf73, 3); return m.call(0xdf73);
}
