// SPDX-License-Identifier: GPL-3.0-only

// loc_3d25  (ROM 0x3D25–0x3DD9)
export function loc_3d25(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x3d28, 19); // ld a,(ix+0x00)
  regs.a = regs.inc8(regs.a);
  m.step(0x3d29, 4); // inc a
  if (regs.fNZ) {
    m.ret(11); // 0x3d29 ret nz -- taken
    return;
  }
  m.step(0x3d2a, 5); // ret nz not taken

  regs.a = mem.read8(0xa8f4);
  m.step(0x3d2d, 13); // ld a,(0xa8f4)
  regs.and(regs.a);
  m.step(0x3d2e, 4); // and a
  if (regs.fNZ) {
    m.ret(11); // 0x3d2e ret nz -- taken
    return;
  }
  m.step(0x3d2f, 5); // ret nz not taken

  regs.a = mem.read8(0xa8c6);
  m.step(0x3d32, 13); // ld a,(0xa8c6)
  regs.and(regs.a);
  m.step(0x3d33, 4); // and a
  if (regs.fZ) {
    m.ret(11); // 0x3d33 ret z -- taken
    return;
  }
  m.step(0x3d34, 5); // ret z not taken

  regs.cp(0x01);
  m.step(0x3d36, 7); // cp 0x01

  let atScan = false; // set when control reaches 0x3d45 without the 0x3d40 test
  if (regs.fZ) {
    m.step(0x3d40, 10); // jp z,0x3d40
  } else {
    m.step(0x3d39, 10); // jp z not taken
    regs.a = mem.read8(0xa8e0);
    m.step(0x3d3c, 13); // ld a,(0xa8e0)
    regs.and(regs.a);
    m.step(0x3d3d, 4); // and a
    if (regs.fZ) {
      m.step(0x3d45, 10); // jp z,0x3d45
      atScan = true;
    } else {
      m.step(0x3d40, 10); // jp z not taken
    }
  }

  if (!atScan) {
    regs.a = mem.read8(0xa840);
    m.step(0x3d43, 13); // ld a,(0xa840)
    regs.and(regs.a);
    m.step(0x3d44, 4); // and a
    if (regs.fNZ) {
      m.ret(11); // 0x3d44 ret nz -- taken
      return;
    }
    m.step(0x3d45, 5); // ret nz not taken
  }

  regs.b = 0x02;
  m.step(0x3d47, 7); // ld b,0x02
  regs.a = mem.read8(0xa8d6);
  m.step(0x3d4a, 13); // ld a,(0xa8d6)
  regs.d = regs.a;
  m.step(0x3d4b, 4); // ld d,a
  regs.add(regs.a);
  m.step(0x3d4c, 4); // add a,a
  regs.e = regs.a;
  m.step(0x3d4d, 4); // ld e,a

  let hit = false; // a `jp nc,0x3d6f` fired
  do {
    regs.a = 0x84;
    m.step(0x3d4f, 7); // ld a,0x84
    regs.sub(mem.read8((regs.iy + 0x00) & 0xffff));
    m.step(0x3d52, 19); // sub (iy+0x00)
    regs.add(regs.d);
    m.step(0x3d53, 4); // add a,d
    regs.cp(regs.e);
    m.step(0x3d54, 4); // cp e
    if (regs.fNC) {
      m.step(0x3d6f, 10); // jp nc,0x3d6f
      hit = true;
      break;
    }
    m.step(0x3d57, 10); // jp nc not taken

    regs.a = 0x78;
    m.step(0x3d59, 7); // ld a,0x78
    regs.sub(mem.read8((regs.iy + 0x31) & 0xffff));
    m.step(0x3d5c, 19); // sub (iy+0x31)
    regs.add(regs.d);
    m.step(0x3d5d, 4); // add a,d
    regs.cp(regs.e);
    m.step(0x3d5e, 4); // cp e
    if (regs.fNC) {
      m.step(0x3d6f, 10); // jp nc,0x3d6f
      hit = true;
      break;
    }
    m.step(0x3d61, 10); // jp nc not taken

    regs.exx(); // protects B and D/E across the record step
    m.step(0x3d62, 4); // exx
    regs.de = 0x0010;
    m.step(0x3d65, 10); // ld de,0x0010
    regs.addIx(regs.de);
    m.step(0x3d67, 15); // add ix,de
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x3d69, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x3d6b, 10); // inc iy
    regs.exx();
    m.step(0x3d6c, 4); // exx
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3d4d : 0x3d6e, regs.b !== 0 ? 13 : 8); // djnz 0x3d4d
  } while (regs.b !== 0);

  if (!hit) {
    m.ret(); // 0x3d6e
    return;
  }

  m.push16(0x3d72);
  m.step(0x565f, 17); // call 0x565f
  m.call(0x565f);

  regs.hl = 0xac7f;
  m.step(0x3d75, 10); // ld hl,0xac7f
  m.push16(0x3d78);
  m.step(0x33b8, 17); // call 0x33b8
  m.call(0x33b8);

  regs.h = regs.a;
  m.step(0x3d79, 4); // ld h,a
  regs.a = 0x18;
  m.step(0x3d7b, 7); // ld a,0x18
  regs.exDeHl();
  m.step(0x3d7c, 4); // ex de,hl
  regs.hl = 0xa8d4;
  m.step(0x3d7f, 10); // ld hl,0xa8d4
  regs.incMem8(mem, regs.hl);
  m.step(0x3d80, 11); // inc (hl)
  regs.b = mem.read8(regs.hl);
  m.step(0x3d81, 7); // ld b,(hl)
  regs.bit(0, regs.b);
  m.step(0x3d83, 8); // bit 0,b

  if (regs.fNZ) {
    m.step(0x3d87, 12); // jr nz,0x3d87 taken
  } else {
    m.step(0x3d85, 7); // jr nz not taken
    regs.neg();
    m.step(0x3d87, 8); // neg
  }

  regs.exDeHl();
  m.step(0x3d88, 4); // ex de,hl
  regs.add(regs.h);
  m.step(0x3d89, 4); // add a,h
  regs.exAf(); // park the aimed direction in A'
  m.step(0x3d8a, 4); // ex af,af'
  regs.b = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x3d8d, 19); // ld b,(iy+0x31)
  regs.c = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x3d90, 19); // ld c,(iy+0x00)
  regs.a = mem.read8(0xa8c6);
  m.step(0x3d93, 13); // ld a,(0xa8c6)
  regs.cp(0x01);
  m.step(0x3d95, 7); // cp 0x01

  let slotB = false;
  if (regs.fZ) {
    m.step(0x3d9f, 10); // jp z,0x3d9f
  } else {
    m.step(0x3d98, 10); // jp z not taken
    regs.a = mem.read8(0xa8e0);
    m.step(0x3d9b, 13); // ld a,(0xa8e0)
    regs.and(regs.a);
    m.step(0x3d9c, 4); // and a
    if (regs.fZ) {
      m.step(0x3dcf, 10); // jp z,0x3dcf
      slotB = true;
    } else {
      m.step(0x3d9f, 10); // jp z not taken
    }
  }

  if (slotB) {
    regs.ix = 0xa8e0;
    m.step(0x3dd3, 14); // ld ix,0xa8e0
    regs.iy = 0xaa2c;
    m.step(0x3dd7, 14); // ld iy,0xaa2c
    m.step(0x3da7, 10); // jp 0x3da7 -- backward, into this routine
  } else {
    regs.ix = 0xa840;
    m.step(0x3da3, 14); // ld ix,0xa840
    regs.iy = 0xaa18;
    m.step(0x3da7, 14); // ld iy,0xaa18
  }

  mem.write8((regs.iy + 0x31) & 0xffff, regs.b);
  m.step(0x3daa, 19); // ld (iy+0x31),b
  mem.write8((regs.iy + 0x00) & 0xffff, regs.c);
  m.step(0x3dad, 19); // ld (iy+0x00),c
  regs.exAf(); // the aimed direction back into A
  m.step(0x3dae, 4); // ex af,af'
  m.push16(0x3db1);
  m.step(0x59c5, 17); // call 0x59c5
  m.call(0x59c5);

  mem.write8((regs.ix + 0x0a) & 0xffff, regs.e);
  m.step(0x3db4, 19); // ld (ix+0x0a),e
  mem.write8((regs.ix + 0x0b) & 0xffff, regs.d);
  m.step(0x3db7, 19); // ld (ix+0x0b),d
  mem.write8((regs.ix + 0x0c) & 0xffff, regs.c);
  m.step(0x3dba, 19); // ld (ix+0x0c),c
  mem.write8((regs.ix + 0x0d) & 0xffff, regs.b);
  m.step(0x3dbd, 19); // ld (ix+0x0d),b
  mem.write8((regs.iy + 0x01) & 0xffff, 0x4d);
  m.step(0x3dc1, 19); // ld (iy+0x01),0x4d
  mem.write8((regs.iy + 0x30) & 0xffff, 0x62);
  m.step(0x3dc5, 19); // ld (iy+0x30),0x62
  regs.decMem8(mem, (regs.ix + 0x00) & 0xffff);
  m.step(0x3dc8, 23); // dec (ix+0x00)
  regs.a = mem.read8(0xa8f6);
  m.step(0x3dcb, 13); // ld a,(0xa8f6)
  mem.write8(0xa8f4, regs.a);
  m.step(0x3dce, 13); // ld (0xa8f4),a
  m.ret(); // 0x3dce
}
