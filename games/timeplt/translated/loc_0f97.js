// SPDX-License-Identifier: GPL-3.0-only

// loc_0f97  (ROM 0x0F97-0x1097, Time Pilot)
export function loc_0f97(m) {
  const { regs, mem } = m;

  blk_0f97: {
    regs.a = mem.read8(0xb411);
    m.step(0x0f9a, 13); // ld a,(0xb411)

    regs.bit(7, regs.a);
    m.step(0x0f9c, 8); // bit 7,a

    if (regs.fZ) {
      m.step(0x0fb7, 12); // jr z,0x0fb7 taken -- slot idle
      break blk_0f97;
    }
    m.step(0x0f9e, 7); // jr z not taken

    regs.c = regs.a;
    m.step(0x0f9f, 4); // ld c,a

    regs.a = mem.read8(0xc000);
    m.step(0x0fa2, 13); // ld a,(0xc000) -- scanline counter

    regs.add(regs.c);
    m.step(0x0fa3, 4); // add a,c

    if (regs.fNC) {
      m.step(0x0fb7, 12); // jr nc,0x0fb7 taken -- not due yet
      break blk_0f97;
    }
    m.step(0x0fa5, 7); // jr nc not taken

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0fa6, 6); // inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0fa7, 6); // inc hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0fa8, 6); // dec hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0fa9, 6); // dec hl -- HL back where it started

    regs.a = regs.c;
    m.step(0x0faa, 4); // ld a,c

    regs.and(0x7f);
    m.step(0x0fac, 7); // and 0x7f

    mem.write8(0xb411, regs.a);
    m.step(0x0faf, 13); // ld (0xb411),a

    regs.a = mem.read8(0xb010);
    m.step(0x0fb2, 13); // ld a,(0xb010)

    regs.add(0x80);
    m.step(0x0fb4, 7); // add a,0x80

    mem.write8(0xb010, regs.a);
    m.step(0x0fb7, 13); // ld (0xb010),a
  }

  blk_0fb7: {
    regs.a = mem.read8(0xb413);
    m.step(0x0fba, 13); // ld a,(0xb413)

    regs.bit(7, regs.a);
    m.step(0x0fbc, 8); // bit 7,a

    if (regs.fZ) {
      m.step(0x0fd7, 12); // jr z,0x0fd7 taken -- slot idle
      break blk_0fb7;
    }
    m.step(0x0fbe, 7); // jr z not taken

    regs.c = regs.a;
    m.step(0x0fbf, 4); // ld c,a

    regs.a = mem.read8(0xc000);
    m.step(0x0fc2, 13); // ld a,(0xc000) -- scanline counter

    regs.add(regs.c);
    m.step(0x0fc3, 4); // add a,c

    if (regs.fNC) {
      m.step(0x0fd7, 12); // jr nc,0x0fd7 taken -- not due yet
      break blk_0fb7;
    }
    m.step(0x0fc5, 7); // jr nc not taken

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0fc6, 6); // inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0fc7, 6); // inc hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0fc8, 6); // dec hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0fc9, 6); // dec hl -- HL back where it started

    regs.a = regs.c;
    m.step(0x0fca, 4); // ld a,c

    regs.and(0x7f);
    m.step(0x0fcc, 7); // and 0x7f

    mem.write8(0xb413, regs.a);
    m.step(0x0fcf, 13); // ld (0xb413),a

    regs.a = mem.read8(0xb012);
    m.step(0x0fd2, 13); // ld a,(0xb012)

    regs.add(0x80);
    m.step(0x0fd4, 7); // add a,0x80

    mem.write8(0xb012, regs.a);
    m.step(0x0fd7, 13); // ld (0xb012),a
  }

  blk_0fd7: {
    regs.a = mem.read8(0xb415);
    m.step(0x0fda, 13); // ld a,(0xb415)

    regs.bit(7, regs.a);
    m.step(0x0fdc, 8); // bit 7,a

    if (regs.fZ) {
      m.step(0x0ff7, 12); // jr z,0x0ff7 taken -- slot idle
      break blk_0fd7;
    }
    m.step(0x0fde, 7); // jr z not taken

    regs.c = regs.a;
    m.step(0x0fdf, 4); // ld c,a

    regs.a = mem.read8(0xc000);
    m.step(0x0fe2, 13); // ld a,(0xc000) -- scanline counter

    regs.add(regs.c);
    m.step(0x0fe3, 4); // add a,c

    if (regs.fNC) {
      m.step(0x0ff7, 12); // jr nc,0x0ff7 taken -- not due yet
      break blk_0fd7;
    }
    m.step(0x0fe5, 7); // jr nc not taken

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0fe6, 6); // inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0fe7, 6); // inc hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0fe8, 6); // dec hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0fe9, 6); // dec hl -- HL back where it started

    regs.a = regs.c;
    m.step(0x0fea, 4); // ld a,c

    regs.and(0x7f);
    m.step(0x0fec, 7); // and 0x7f

    mem.write8(0xb415, regs.a);
    m.step(0x0fef, 13); // ld (0xb415),a

    regs.a = mem.read8(0xb014);
    m.step(0x0ff2, 13); // ld a,(0xb014)

    regs.add(0x80);
    m.step(0x0ff4, 7); // add a,0x80

    mem.write8(0xb014, regs.a);
    m.step(0x0ff7, 13); // ld (0xb014),a
  }

  blk_0ff7: {
    regs.a = mem.read8(0xb437);
    m.step(0x0ffa, 13); // ld a,(0xb437)

    regs.bit(7, regs.a);
    m.step(0x0ffc, 8); // bit 7,a

    if (regs.fZ) {
      m.step(0x1017, 12); // jr z,0x1017 taken -- slot idle
      break blk_0ff7;
    }
    m.step(0x0ffe, 7); // jr z not taken

    regs.c = regs.a;
    m.step(0x0fff, 4); // ld c,a

    regs.a = mem.read8(0xc000);
    m.step(0x1002, 13); // ld a,(0xc000) -- scanline counter

    regs.add(regs.c);
    m.step(0x1003, 4); // add a,c

    if (regs.fNC) {
      m.step(0x1017, 12); // jr nc,0x1017 taken -- not due yet
      break blk_0ff7;
    }
    m.step(0x1005, 7); // jr nc not taken

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1006, 6); // inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1007, 6); // inc hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1008, 6); // dec hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1009, 6); // dec hl -- HL back where it started

    regs.a = regs.c;
    m.step(0x100a, 4); // ld a,c

    regs.and(0x7f);
    m.step(0x100c, 7); // and 0x7f

    mem.write8(0xb437, regs.a);
    m.step(0x100f, 13); // ld (0xb437),a

    regs.a = mem.read8(0xb036);
    m.step(0x1012, 13); // ld a,(0xb036)

    regs.add(0x80);
    m.step(0x1014, 7); // add a,0x80

    mem.write8(0xb036, regs.a);
    m.step(0x1017, 13); // ld (0xb036),a
  }

  blk_1017: {
    regs.a = mem.read8(0xb439);
    m.step(0x101a, 13); // ld a,(0xb439)

    regs.bit(7, regs.a);
    m.step(0x101c, 8); // bit 7,a

    if (regs.fZ) {
      m.step(0x1037, 12); // jr z,0x1037 taken -- slot idle
      break blk_1017;
    }
    m.step(0x101e, 7); // jr z not taken

    regs.c = regs.a;
    m.step(0x101f, 4); // ld c,a

    regs.a = mem.read8(0xc000);
    m.step(0x1022, 13); // ld a,(0xc000) -- scanline counter

    regs.add(regs.c);
    m.step(0x1023, 4); // add a,c

    if (regs.fNC) {
      m.step(0x1037, 12); // jr nc,0x1037 taken -- not due yet
      break blk_1017;
    }
    m.step(0x1025, 7); // jr nc not taken

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1026, 6); // inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1027, 6); // inc hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1028, 6); // dec hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1029, 6); // dec hl -- HL back where it started

    regs.a = regs.c;
    m.step(0x102a, 4); // ld a,c

    regs.and(0x7f);
    m.step(0x102c, 7); // and 0x7f

    mem.write8(0xb439, regs.a);
    m.step(0x102f, 13); // ld (0xb439),a

    regs.a = mem.read8(0xb038);
    m.step(0x1032, 13); // ld a,(0xb038)

    regs.add(0x80);
    m.step(0x1034, 7); // add a,0x80

    mem.write8(0xb038, regs.a);
    m.step(0x1037, 13); // ld (0xb038),a
  }

  blk_1037: {
    regs.a = mem.read8(0xb43b);
    m.step(0x103a, 13); // ld a,(0xb43b)

    regs.bit(7, regs.a);
    m.step(0x103c, 8); // bit 7,a

    if (regs.fZ) {
      m.step(0x1057, 12); // jr z,0x1057 taken -- slot idle
      break blk_1037;
    }
    m.step(0x103e, 7); // jr z not taken

    regs.c = regs.a;
    m.step(0x103f, 4); // ld c,a

    regs.a = mem.read8(0xc000);
    m.step(0x1042, 13); // ld a,(0xc000) -- scanline counter

    regs.add(regs.c);
    m.step(0x1043, 4); // add a,c

    if (regs.fNC) {
      m.step(0x1057, 12); // jr nc,0x1057 taken -- not due yet
      break blk_1037;
    }
    m.step(0x1045, 7); // jr nc not taken

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1046, 6); // inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1047, 6); // inc hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1048, 6); // dec hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1049, 6); // dec hl -- HL back where it started

    regs.a = regs.c;
    m.step(0x104a, 4); // ld a,c

    regs.and(0x7f);
    m.step(0x104c, 7); // and 0x7f

    mem.write8(0xb43b, regs.a);
    m.step(0x104f, 13); // ld (0xb43b),a

    regs.a = mem.read8(0xb03a);
    m.step(0x1052, 13); // ld a,(0xb03a)

    regs.add(0x80);
    m.step(0x1054, 7); // add a,0x80

    mem.write8(0xb03a, regs.a);
    m.step(0x1057, 13); // ld (0xb03a),a
  }

  blk_1057: {
    regs.a = mem.read8(0xb43d);
    m.step(0x105a, 13); // ld a,(0xb43d)

    regs.bit(7, regs.a);
    m.step(0x105c, 8); // bit 7,a

    if (regs.fZ) {
      m.step(0x1077, 12); // jr z,0x1077 taken -- slot idle
      break blk_1057;
    }
    m.step(0x105e, 7); // jr z not taken

    regs.c = regs.a;
    m.step(0x105f, 4); // ld c,a

    regs.a = mem.read8(0xc000);
    m.step(0x1062, 13); // ld a,(0xc000) -- scanline counter

    regs.add(regs.c);
    m.step(0x1063, 4); // add a,c

    if (regs.fNC) {
      m.step(0x1077, 12); // jr nc,0x1077 taken -- not due yet
      break blk_1057;
    }
    m.step(0x1065, 7); // jr nc not taken

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1066, 6); // inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1067, 6); // inc hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1068, 6); // dec hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1069, 6); // dec hl -- HL back where it started

    regs.a = regs.c;
    m.step(0x106a, 4); // ld a,c

    regs.and(0x7f);
    m.step(0x106c, 7); // and 0x7f

    mem.write8(0xb43d, regs.a);
    m.step(0x106f, 13); // ld (0xb43d),a

    regs.a = mem.read8(0xb03c);
    m.step(0x1072, 13); // ld a,(0xb03c)

    regs.add(0x80);
    m.step(0x1074, 7); // add a,0x80

    mem.write8(0xb03c, regs.a);
    m.step(0x1077, 13); // ld (0xb03c),a
  }

  blk_1077: {
    regs.a = mem.read8(0xb43f);
    m.step(0x107a, 13); // ld a,(0xb43f)

    regs.bit(7, regs.a);
    m.step(0x107c, 8); // bit 7,a

    if (regs.fZ) {
      m.step(0x1097, 12); // jr z,0x1097 taken -- slot idle
      break blk_1077;
    }
    m.step(0x107e, 7); // jr z not taken

    regs.c = regs.a;
    m.step(0x107f, 4); // ld c,a

    regs.a = mem.read8(0xc000);
    m.step(0x1082, 13); // ld a,(0xc000) -- scanline counter

    regs.add(regs.c);
    m.step(0x1083, 4); // add a,c

    if (regs.fNC) {
      m.step(0x1097, 12); // jr nc,0x1097 taken -- not due yet
      break blk_1077;
    }
    m.step(0x1085, 7); // jr nc not taken

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1086, 6); // inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1087, 6); // inc hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1088, 6); // dec hl
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1089, 6); // dec hl -- HL back where it started

    regs.a = regs.c;
    m.step(0x108a, 4); // ld a,c

    regs.and(0x7f);
    m.step(0x108c, 7); // and 0x7f

    mem.write8(0xb43f, regs.a);
    m.step(0x108f, 13); // ld (0xb43f),a

    regs.a = mem.read8(0xb03e);
    m.step(0x1092, 13); // ld a,(0xb03e)

    regs.add(0x80);
    m.step(0x1094, 7); // add a,0x80

    mem.write8(0xb03e, regs.a);
    m.step(0x1097, 13); // ld (0xb03e),a
  }

  m.ret(); // 1097  ret
}
