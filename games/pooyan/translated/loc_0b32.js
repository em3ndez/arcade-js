// SPDX-License-Identifier: GPL-3.0-only
//
// ROM range 0x0b32-0x0c44 = three entry points the batch range lumped under "loc_0b32":
//   loc_0b32 (0x0b32-0x0baa) -- attract sub-state 6 (dispatch target 0x08a1[6]);
//   loc_0bb5 (0x0bb5-0x0c29) -- the shared handler epilogue every 0x08a1 handler ret's into
//                               (0x0899 pushes 0x0bb5 as the handler return);
//   loc_0c2a (0x0c2a-0x0c44) -- IN0 start-poll that jumps attract to sub-state 9 + wipes video RAM.
// The 10 bytes at 0x0bab-0x0bb4 between loc_0b32 and loc_0bb5 are a word table (data): the
// script-pointer choices {0x8659,0x8656,0x8653,0x864e,0x864b} loc_0b32 indexes via 0x0c45.
// Un-annotated instruction addresses = the previous m.step's nextAddr arg.

// loc_0b32 -- verify the (0x82bc) row block (10 equal 0x20-strided pairs, else re-enter 0x08b3),
// run the 0x8d41/0x8e50 frame timers, seat the next script pointer at (0x8e56) from table 0x0bab,
// and every 0x8e53 ticks run a 14x29 column checksum in DE, verified against the (0x8f48) pointer.
export function loc_0b32(m) {
  const { regs, mem } = m;

  regs.hl = 0x82bc;
  m.step(0x0b35, 10); // 0b32  ld hl,0x82bc
  regs.de = 0xffe0;
  m.step(0x0b38, 10); // 0b35  ld de,0xffe0
  regs.b = 0x0a;
  m.step(0x0b3a, 7); // 0b38  ld b,0x0a
  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x0b3b, 7); // 0b3a  ld a,(hl)
    regs.addHl(regs.de);
    m.step(0x0b3c, 11); // 0b3b  add hl,de
    regs.cp(mem.read8(regs.hl));
    m.step(0x0b3d, 7); // 0b3c  cp (hl)
    if (regs.fNZ) {
      m.step(0x08b3, 10); // 0b3d  jp nz,0x08b3 -- row mismatch, re-enter sub-state 0
      return m.call(0x08b3);
    }
    m.step(0x0b40, 10); // 0b3d  jp nz not taken -> djnz
    if (regs.djnz() !== 0) { m.step(0x0b3a, 13); continue; } // 0b40  djnz 0x0b3a
    m.step(0x0b42, 8);
    break;
  }

  regs.hl = 0x8d41;
  m.step(0x0b45, 10); // 0b42  ld hl,0x8d41
  regs.decMem8(mem, regs.hl);
  m.step(0x0b46, 11); // 0b45  dec (hl)
  if (regs.fNZ) {
    m.step(0x0b4b, 12); // 0b46  jr nz,0x0b4b
  } else {
    m.step(0x0b48, 7);
    m.push16(0x0b4b);
    m.step(0x0a28, 17); // 0b48  call 0x0a28
    m.call(0x0a28);
  }
  m.push16(0x0b4e);
  m.step(0x09f8, 17); // 0b4b  call 0x09f8
  m.call(0x09f8);

  regs.hl = 0x8e50;
  m.step(0x0b51, 10); // 0b4e  ld hl,0x8e50
  regs.decMem8(mem, regs.hl);
  m.step(0x0b52, 11); // 0b51  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 0b52  ret nz
  m.step(0x0b53, 5);

  mem.write8(regs.hl, 0x01);
  m.step(0x0b55, 10); // 0b53  ld (hl),0x01
  regs.l = regs.inc8(regs.l);
  m.step(0x0b56, 4); // 0b55  inc l
  regs.decMem8(mem, regs.hl);
  m.step(0x0b57, 11); // 0b56  dec (hl)
  regs.a = mem.read8(0x8e53);
  m.step(0x0b5a, 13); // 0b57  ld a,(0x8e53)
  regs.a = regs.dec8(regs.a);
  m.step(0x0b5b, 4); // 0b5a  dec a
  regs.hl = 0x0bab;
  m.step(0x0b5e, 10); // 0b5b  ld hl,0x0bab
  m.push16(0x0b61);
  m.step(0x0c45, 17); // 0b5e  call 0x0c45 -- DE = table[A]
  m.call(0x0c45);
  mem.write16(0x8e56, regs.de);
  m.step(0x0b65, 20); // 0b61  ld (0x8e56),de
  regs.hl = 0x8e53;
  m.step(0x0b68, 10); // 0b65  ld hl,0x8e53
  regs.decMem8(mem, regs.hl);
  m.step(0x0b69, 11); // 0b68  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 0b69  ret nz
  m.step(0x0b6a, 5);

  regs.hl = 0x8e50;
  m.step(0x0b6d, 10); // 0b6a  ld hl,0x8e50
  mem.write8(regs.hl, 0x96);
  m.step(0x0b6f, 10); // 0b6d  ld (hl),0x96
  regs.l = regs.inc8(regs.l);
  m.step(0x0b70, 4); // 0b6f  inc l
  regs.xor(regs.a);
  m.step(0x0b71, 4); // 0b70  xor a
  mem.write8(regs.hl, regs.a);
  m.step(0x0b72, 7); // 0b71  ld (hl),a
  regs.hl = 0x8462;
  m.step(0x0b75, 10); // 0b72  ld hl,0x8462
  regs.d = regs.a;
  m.step(0x0b76, 4); // 0b75  ld d,a
  regs.e = regs.a;
  m.step(0x0b77, 4); // 0b76  ld e,a
  regs.c = 0x0e;
  m.step(0x0b79, 7); // 0b77  ld c,0x0e

  for (;;) { // outer column loop (0b79)
    regs.b = 0x1d;
    m.step(0x0b7b, 7); // 0b79  ld b,0x1d
    for (;;) { // inner row-sum loop (0b7b)
      regs.a = regs.e;
      m.step(0x0b7c, 4); // 0b7b  ld a,e
      regs.add(mem.read8(regs.hl));
      m.step(0x0b7d, 7); // 0b7c  add a,(hl)
      if (regs.fNC) {
        m.step(0x0b80, 12); // 0b7d  jr nc,0x0b80
      } else {
        m.step(0x0b7f, 7);
        regs.d = regs.inc8(regs.d);
        m.step(0x0b80, 4); // 0b7f  inc d
      }
      regs.e = regs.a;
      m.step(0x0b81, 4); // 0b80  ld e,a
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x0b82, 6); // 0b81  inc hl
      if (regs.djnz() !== 0) { m.step(0x0b7b, 13); continue; } // 0b82  djnz 0x0b7b
      m.step(0x0b84, 8);
      break;
    }
    regs.a = regs.l;
    m.step(0x0b85, 4); // 0b84  ld a,l
    regs.add(0x03);
    m.step(0x0b87, 7); // 0b85  add a,0x03
    regs.l = regs.a;
    m.step(0x0b88, 4); // 0b87  ld l,a
    if (regs.fNC) {
      m.step(0x0b8b, 12); // 0b88  jr nc,0x0b8b
    } else {
      m.step(0x0b8a, 7);
      regs.h = regs.inc8(regs.h);
      m.step(0x0b8b, 4); // 0b8a  inc h
    }
    regs.c = regs.dec8(regs.c);
    m.step(0x0b8c, 4); // 0b8b  dec c
    if (regs.fNZ) { m.step(0x0b79, 12); continue; } // 0b8c  jr nz,0x0b79
    m.step(0x0b8e, 7);
    break;
  }

  regs.hl = mem.read16(0x8f48);
  m.step(0x0b91, 16); // 0b8e  ld hl,(0x8f48)
  regs.a = regs.e;
  m.step(0x0b92, 4); // 0b91  ld a,e
  regs.cp(mem.read8(regs.hl));
  m.step(0x0b93, 7); // 0b92  cp (hl)
  if (regs.fNZ) {
    m.step(0x08b3, 10); // 0b93  jp nz,0x08b3
    return m.call(0x08b3);
  }
  m.step(0x0b96, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0b97, 6); // 0b96  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x0b98, 7); // 0b97  ld a,(hl)
  regs.cp(regs.d);
  m.step(0x0b99, 4); // 0b98  cp d
  if (regs.fNZ) {
    m.step(0x08e9, 10); // 0b99  jp nz,0x08e9
    return m.call(0x08e9);
  }
  m.step(0x0b9c, 10);
  regs.xor(regs.a);
  m.step(0x0b9d, 4); // 0b9c  xor a
  mem.write8(0x8f48, regs.a);
  m.step(0x0ba0, 13); // 0b9d  ld (0x8f48),a
  mem.write8(0x8f49, regs.a);
  m.step(0x0ba3, 13); // 0ba0  ld (0x8f49),a
  regs.a = 0x03;
  m.step(0x0ba5, 7); // 0ba3  ld a,0x03
  mem.write8(0x8805, regs.a);
  m.step(0x0ba8, 13); // 0ba5  ld (0x8805),a
  m.step(0x0e00, 10); // 0ba8  jp 0x0e00 -- advance to the next screen builder
  return m.call(0x0e00);
}

// loc_0bb5 -- shared handler epilogue. Gate on (0x8806)/(0x8805) and the 0x8e51 sub-state, run the
// 0x86bc list scan + 0x20cb table lookup that flags 0x89e5, then on the 0x882c==0x0f coin path read
// 0x8810 and branch to the 0x0da8/0x0dab screen builders; otherwise the (0x8802) drop path.
export function loc_0bb5(m) {
  const { regs, mem } = m;

  bfc: {
    regs.a = mem.read8(0x8806);
    m.step(0x0bb8, 13); // 0bb5  ld a,(0x8806)
    regs.and(regs.a);
    m.step(0x0bb9, 4); // 0bb8  and a
    if (regs.fNZ) { m.step(0x0bfc, 12); break bfc; } // 0bb9  jr nz,0x0bfc
    m.step(0x0bbb, 7);
    regs.a = mem.read8(0x8805);
    m.step(0x0bbe, 13); // 0bbb  ld a,(0x8805)
    regs.a = regs.dec8(regs.a);
    m.step(0x0bbf, 4); // 0bbe  dec a
    if (regs.fNZ) { m.step(0x0bfc, 12); break bfc; } // 0bbf  jr nz,0x0bfc
    m.step(0x0bc1, 7);
    regs.a = mem.read8(0x8e51);
    m.step(0x0bc4, 13); // 0bc1  ld a,(0x8e51)
    regs.cp(0x03);
    m.step(0x0bc6, 7); // 0bc4  cp 0x03
    if (regs.fZ) {
      m.step(0x0bd0, 12); // 0bc6  jr z,0x0bd0
    } else {
      m.step(0x0bc8, 7);
      regs.cp(0x05);
      m.step(0x0bca, 7); // 0bc8  cp 0x05
      if (regs.fZ) {
        m.step(0x0bd0, 12); // 0bca  jr z,0x0bd0
      } else {
        m.step(0x0bcc, 7);
        regs.cp(0x08);
        m.step(0x0bce, 7); // 0bcc  cp 0x08
        if (regs.fNZ) { m.step(0x0bfc, 12); break bfc; } // 0bce  jr nz,0x0bfc
        m.step(0x0bd0, 7);
      }
    }

    // 0bd0: bump 0x8efe, scan the 0x86bc table for the byte at (bc)=0x20c2 (0xff terminator)
    regs.de = 0xffe0;
    m.step(0x0bd3, 10); // 0bd0  ld de,0xffe0
    regs.hl = 0x8efe;
    m.step(0x0bd6, 10); // 0bd3  ld hl,0x8efe
    regs.incMem8(mem, regs.hl);
    m.step(0x0bd7, 11); // 0bd6  inc (hl)
    regs.hl = 0x86bc;
    m.step(0x0bda, 10); // 0bd7  ld hl,0x86bc
    regs.bc = 0x20c2;
    m.step(0x0bdd, 10); // 0bda  ld bc,0x20c2
    let mismatch = false;
    for (;;) {
      regs.a = mem.read8(regs.bc);
      m.step(0x0bde, 7); // 0bdd  ld a,(bc)
      regs.sub(mem.read8(regs.hl));
      m.step(0x0bdf, 7); // 0bde  sub (hl)
      if (regs.fNZ) { m.step(0x0bf7, 12); mismatch = true; break; } // 0bdf  jr nz,0x0bf7
      m.step(0x0be1, 7);
      regs.addHl(regs.de);
      m.step(0x0be2, 11); // 0be1  add hl,de
      regs.bc = (regs.bc + 1) & 0xffff;
      m.step(0x0be3, 6); // 0be2  inc bc
      regs.a = mem.read8(regs.bc);
      m.step(0x0be4, 7); // 0be3  ld a,(bc)
      regs.a = regs.inc8(regs.a);
      m.step(0x0be5, 4); // 0be4  inc a
      if (regs.fNZ) { m.step(0x0bdd, 12); continue; } // 0be5  jr nz,0x0bdd
      m.step(0x0be7, 7);
      break;
    }
    if (!mismatch) {
      regs.de = 0xfbc0;
      m.step(0x0bea, 10); // 0be7  ld de,0xfbc0
      regs.addHl(regs.de);
      m.step(0x0beb, 11); // 0bea  add hl,de
      regs.exDeHl();
      m.step(0x0bec, 4); // 0beb  ex de,hl
      regs.hl = 0x20cb;
      m.step(0x0bef, 10); // 0bec  ld hl,0x20cb
      regs.a = mem.read8(0x8e51);
      m.step(0x0bf2, 13); // 0bef  ld a,(0x8e51)
      m.push16(0x0bf3);
      m.step(0x0020, 11); // 0bf2  rst 0x20 -- A = (0x20cb+A)
      m.call(0x0020);
      regs.exDeHl();
      m.step(0x0bf4, 4); // 0bf3  ex de,hl
      regs.cp(mem.read8(regs.hl));
      m.step(0x0bf5, 7); // 0bf4  cp (hl)
      if (regs.fZ) { m.step(0x0bfc, 12); break bfc; } // 0bf5  jr z,0x0bfc
      m.step(0x0bf7, 7);
    }
    // 0bf7: the scan/lookup disagreed -> arm 0x89e5
    regs.a = 0x01;
    m.step(0x0bf9, 7); // 0bf7  ld a,0x01
    mem.write8(0x89e5, regs.a);
    m.step(0x0bfc, 13); // 0bf9  ld (0x89e5),a
  }

  // 0bfc: coin/credit gate
  regs.a = mem.read8(0x882c);
  m.step(0x0bff, 13); // 0bfc  ld a,(0x882c)
  regs.cp(0x0f);
  m.step(0x0c01, 7); // 0bff  cp 0x0f
  if (regs.fNZ) {
    m.step(0x0c1c, 12); // 0c01  jr nz,0x0c1c
    regs.a = mem.read8(0x8802);
    m.step(0x0c1f, 13); // 0c1c  ld a,(0x8802)
    regs.and(regs.a);
    m.step(0x0c20, 4); // 0c1f  and a
    if (regs.fZ) { m.ret(11); return; } // 0c20  ret z
    m.step(0x0c21, 5);
    regs.hl = 0x8805;
    m.step(0x0c24, 10); // 0c21  ld hl,0x8805
    regs.incMem8(mem, regs.hl);
    m.step(0x0c25, 11); // 0c24  inc (hl)
    regs.xor(regs.a);
    m.step(0x0c26, 4); // 0c25  xor a
    mem.write8(0x880a, regs.a);
    m.step(0x0c29, 13); // 0c26  ld (0x880a),a
    m.ret(); // 0c29  ret
    return;
  }
  m.step(0x0c03, 7);
  regs.a = mem.read8(0x8810);
  m.step(0x0c06, 13); // 0c03  ld a,(0x8810)
  regs.bit(3, regs.a);
  m.step(0x0c08, 8); // 0c06  bit 3,a
  if (regs.fZ) {
    m.step(0x0c13, 12); // 0c08  jr z,0x0c13
    regs.bit(4, regs.a);
    m.step(0x0c15, 8); // 0c13  bit 4,a
    if (regs.fZ) { m.ret(11); return; } // 0c15  ret z
    m.step(0x0c16, 5);
    m.push16(0x0c19);
    m.step(0x0ecf, 17); // 0c16  call 0x0ecf
    m.call(0x0ecf);
    m.step(0x0da8, 10); // 0c19  jp 0x0da8
    return m.call(0x0da8);
  }
  m.step(0x0c0a, 7);
  m.push16(0x0c0d);
  m.step(0x0ecf, 17); // 0c0a  call 0x0ecf
  m.call(0x0ecf);
  regs.hl = 0x0000;
  m.step(0x0c10, 10); // 0c0d  ld hl,0x0000
  m.step(0x0dab, 10); // 0c10  jp 0x0dab
  return m.call(0x0dab);
}

// loc_0c2a -- IN0 (0xa080) start poll: while bit 3 is set, do nothing; on press jump attract to
// sub-state 9 (0x8e51) and clear the 0x400-byte video RAM at 0x8400 to tile 0x10.
export function loc_0c2a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa080);
  m.step(0x0c2d, 13); // 0c2a  ld a,(0xa080)
  regs.bit(3, regs.a);
  m.step(0x0c2f, 8); // 0c2d  bit 3,a
  if (regs.fNZ) { m.ret(11); return; } // 0c2f  ret nz
  m.step(0x0c30, 5);
  regs.a = 0x09;
  m.step(0x0c32, 7); // 0c30  ld a,0x09
  mem.write8(0x8e51, regs.a);
  m.step(0x0c35, 13); // 0c32  ld (0x8e51),a
  regs.hl = 0x8400;
  m.step(0x0c38, 10); // 0c35  ld hl,0x8400
  regs.e = 0x10;
  m.step(0x0c3a, 7); // 0c38  ld e,0x10
  regs.bc = 0x03ff;
  m.step(0x0c3d, 10); // 0c3a  ld bc,0x03ff
  for (;;) {
    mem.write8(regs.hl, regs.e);
    m.step(0x0c3e, 7); // 0c3d  ld (hl),e
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0c3f, 6); // 0c3e  inc hl
    regs.bc = (regs.bc - 1) & 0xffff;
    m.step(0x0c40, 6); // 0c3f  dec bc
    regs.a = regs.b;
    m.step(0x0c41, 4); // 0c40  ld a,b
    regs.or(regs.c);
    m.step(0x0c42, 4); // 0c41  or c
    if (regs.fNZ) { m.step(0x0c3d, 12); continue; } // 0c42  jr nz,0x0c3d
    m.step(0x0c44, 7);
    break;
  }
  m.ret(); // 0c44  ret
}
