// SPDX-License-Identifier: GPL-3.0-only
// loc_90c4  (ROM 0x90c4-0x91b4) -- picks a start index by scanning table 0x91fe against $0126, clamps it
// against $29, then falls into loc_9108. loc_9108 (mid-entry, dispatched from the c7da state table) reseeds
// $3d and the wave ($7c/$5b/$0200/$51/$7b/$0605, plus $05-sign extra setup + 0xc196), then falls into
// loc_9149. loc_9149 (mid-entry) ticks $0605/$04 (decimal countdown) and on $4e bits reseeds an entry from
// $0200/$3d, then rts. Cycle notes: abs,x/abs,y reads charge 4 (+1 on a page-carry into 0x92xx); STA abs,x 5.
export function loc_90c4(m) {
  const { regs, mem } = m;
  let ea;
  regs.a = mem.read8(0x0126); regs.setNZ(regs.a); m.step(0x90c7, 4);
  regs.x = 0x1c; regs.setNZ(regs.x); m.step(0x90c9, 2);
  do {
    regs.x = regs.dec8(regs.x); m.step(0x90ca, 2);
    ea = (0x91fe + regs.x) & 0xffff; regs.cmp(mem.read8(ea));
    m.step(0x90cd, (ea & 0xff00) !== 0x9100 ? 5 : 4);
    if (regs.fNC) { m.step(0x90c9, 3); continue; }
    m.step(0x90cf, 2); break;
  } while (true);
  regs.y = 0x04; regs.setNZ(regs.y); m.step(0x90d1, 2);
  regs.a = mem.read8(0x016a); regs.setNZ(regs.a); m.step(0x90d4, 4);
  regs.and(0x04); m.step(0x90d6, 2);
  if (regs.fZ) {
    m.step(0x90ea, 3);
  } else {
    m.step(0x90d8, 2);
    regs.a = mem.read8(0x071d); regs.setNZ(regs.a); m.step(0x90db, 4);
    regs.cmp(0x30); m.step(0x90dd, 2);
    if (regs.fNC) {
      m.step(0x90e0, 3);
    } else {
      m.step(0x90df, 2);
      regs.y = regs.inc8(regs.y); m.step(0x90e0, 2);
    }
    regs.cmp(0x50); m.step(0x90e2, 2);
    if (regs.fNC) {
      m.step(0x90e5, 3);
    } else {
      m.step(0x90e4, 2);
      regs.y = regs.inc8(regs.y); m.step(0x90e5, 2);
    }
    regs.cmp(0x70); m.step(0x90e7, 2);
    if (regs.fNC) {
      m.step(0x90ea, 3);
    } else {
      m.step(0x90e9, 2);
      regs.y = regs.inc8(regs.y); m.step(0x90ea, 2);
    }
  }
  regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0x90ec, 3);
  regs.and(0x43); m.step(0x90ee, 2);
  regs.cmp(0x40); m.step(0x90f0, 2);
  if (regs.fNZ) {
    m.step(0x90f4, 3);
  } else {
    m.step(0x90f2, 2);
    regs.y = 0x1b; regs.setNZ(regs.y); m.step(0x90f4, 2);
  }
  mem.write8(0x29, regs.y); m.step(0x90f6, 3);
  regs.cpx(mem.read8(0x29)); m.step(0x90f8, 3);
  if (regs.fC) {
    m.step(0x90fc, 3);
  } else {
    m.step(0x90fa, 2);
    regs.x = mem.read8(0x29); regs.setNZ(regs.x); m.step(0x90fc, 3);
  }
  mem.write8(0x0127, regs.x); m.step(0x90ff, 4);
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0x9101, 3);
  if (regs.fPl) { m.step(0x9108, 3); return loc_9108(m); }
  m.step(0x9103, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9105, 2);
  mem.write8(0x0126, regs.a); m.step(0x9108, 4);
  return loc_9108(m);
}

export function loc_9108(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x3f); regs.setNZ(regs.x); m.step(0x910a, 3);
  mem.write8(0x3d, regs.x); m.step(0x910c, 3);
  if (regs.fZ) {
    m.step(0x9111, 3);
  } else {
    m.step(0x910e, 2);
    m.push16(0x9110); m.step(0x9111, 6); m.call(0x92b2);
  }
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0x9113, 2);
  mem.write8(0x7c, regs.a); m.step(0x9115, 3);
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x9117, 2);
  mem.write8(0x5b, regs.a); m.step(0x9119, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x911b, 2);
  mem.write8(0x0200, regs.a); m.step(0x911e, 4);
  mem.write8(0x51, regs.a); m.step(0x9120, 3);
  mem.write8(0x7b, regs.a); m.step(0x9122, 3);
  mem.write8(0x0605, regs.a); m.step(0x9125, 4);
  regs.x = mem.read8(0x05); regs.setNZ(regs.x); m.step(0x9127, 3);
  if (regs.fPl) {
    m.step(0x9144, 3);
  } else {
    m.step(0x9129, 2);
    regs.a = 0x14; regs.setNZ(regs.a); m.step(0x912b, 2);
    mem.write8(0x0605, regs.a); m.step(0x912e, 4);
    regs.a = 0xff; regs.setNZ(regs.a); m.step(0x9130, 2);
    mem.write8(0x0111, regs.a); m.step(0x9133, 4);
    regs.a = 0x16; regs.setNZ(regs.a); m.step(0x9135, 2);
    mem.write8(0x00, regs.a); m.step(0x9137, 3);
    regs.a = 0x08; regs.setNZ(regs.a); m.step(0x9139, 2);
    mem.write8(0x01, regs.a); m.step(0x913b, 3);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0x913d, 2);
    mem.write8(0x9f, regs.a); m.step(0x913f, 3);
    m.push16(0x9141); m.step(0x9142, 6); m.call(0xc196);
    regs.a = 0x10; regs.setNZ(regs.a); m.step(0x9144, 2);
  }
  mem.write8(0x04, regs.a); m.step(0x9146, 3);
  m.push16(0x9148); m.step(0x9149, 6); m.call(0x92ad);
  return loc_9149(m);
}

export function loc_9149(m) {
  const { regs, mem } = m;
  let ea;
  mem.write8(0x0605, regs.dec8(mem.read8(0x0605))); m.step(0x914c, 6);
  if (regs.fPl) {
    m.step(0x9169, 3);
  } else {
    m.step(0x914e, 2);
    regs.sed(); m.step(0x914f, 2);
    regs.a = mem.read8(0x04); regs.setNZ(regs.a); m.step(0x9151, 3);
    regs.sec(); m.step(0x9152, 2);
    regs.sbc(0x01); m.step(0x9154, 2);
    mem.write8(0x04, regs.a); m.step(0x9156, 3);
    regs.cld(); m.step(0x9157, 2);
    if (regs.fPl) {
      m.step(0x915d, 3);
    } else {
      m.step(0x9159, 2);
      regs.a = 0x10; regs.setNZ(regs.a); m.step(0x915b, 2);
      mem.write8(0x4e, regs.a); m.step(0x915d, 3);
    }
    regs.cmp(0x03); m.step(0x915f, 2);
    if (regs.fNZ) {
      m.step(0x9164, 3);
    } else {
      m.step(0x9161, 2);
      m.push16(0x9163); m.step(0x9164, 6); m.call(0xccfe);
    }
    regs.a = 0x14; regs.setNZ(regs.a); m.step(0x9166, 2);
    mem.write8(0x0605, regs.a); m.step(0x9169, 4);
  }
  m.push16(0x916b); m.step(0x916c, 6); m.call(0xb0ab);
  regs.a = 0x18; regs.setNZ(regs.a); m.step(0x916e, 2);
  regs.y = mem.read8(0x04); regs.setNZ(regs.y); m.step(0x9170, 3);
  regs.cpy(0x08); m.step(0x9172, 2);
  if (regs.fC) {
    m.step(0x9176, 3);
  } else {
    m.step(0x9174, 2);
    regs.a = 0x78; regs.setNZ(regs.a); m.step(0x9176, 2);
  }
  regs.and(mem.read8(0x4e)); m.step(0x9178, 3);
  if (regs.fZ) {
    m.step(0x91ae, 3);
  } else {
    m.step(0x917a, 2);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0x917c, 2);
    mem.write8(0x4e, regs.a); m.step(0x917e, 3);
    regs.a = mem.read8(0x0200); regs.setNZ(regs.a); m.step(0x9181, 4);
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9182, 2);
    regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0x9184, 3);
    ea = (0x0102 + regs.x) & 0xffff; mem.write8(ea, regs.a); m.step(0x9187, 5);
    ea = (0x91fe + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a);
    m.step(0x918a, (ea & 0xff00) !== 0x9100 ? 5 : 4);
    regs.bit(mem.read8(0x05)); m.step(0x918c, 3);
    if (regs.fN) {
      m.step(0x9197, 3);
    } else {
      m.step(0x918e, 2);
      regs.y = 0x01; regs.setNZ(regs.y); m.step(0x9190, 2);
      mem.write8(0x48, regs.y); m.step(0x9192, 3);
      regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0x9195, 4);
      regs.and(0x07); m.step(0x9197, 2);
    }
    mem.write8((0x46 + regs.x) & 0xff, regs.a); m.step(0x9199, 4);
    mem.write8(0x9f, regs.a); m.step(0x919b, 3);
    m.push16(0x919d); m.step(0x919e, 6); m.call(0xc196);
    m.push16(0x91a0); m.step(0x91a1, 6); m.call(0x92c5);
    m.push16(0x91a3); m.step(0x91a4, 6); m.call(0x9234);
    m.push16(0x91a6); m.step(0x91a7, 6); m.call(0xa831);
    regs.a = 0x02; regs.setNZ(regs.a); m.step(0x91a9, 2);
    mem.write8(0x00, regs.a); m.step(0x91ab, 3);
    m.push16(0x91ad); m.step(0x91ae, 6); m.call(0x92ad);
  }
  regs.a = mem.read8(0x4e); regs.setNZ(regs.a); m.step(0x91b0, 3);
  regs.and(0x07); m.step(0x91b2, 2);
  mem.write8(0x4e, regs.a); m.step(0x91b4, 3);
  return m.ret(6);
}
