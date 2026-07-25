// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1362  (ROM 0x1362-0x13c8) — seed the actor/level state block at
 * 0x8068-0x8082 (plus 0x801a) to its start-of-play defaults: a handful of
 * counters get fixed non-zero values, the rest are cleared to zero. Pure
 * immediate loads and stores into work RAM — no flags touched, no calls.
 *
 *   1362  3e 00        ld   a,0x00
 *   1364  32 68 80     ld   (0x8068),a
 *   1367  3e 23        ld   a,0x23
 *   1369  32 6b 80     ld   (0x806b),a
 *   136c  3e 19        ld   a,0x19
 *   136e  32 73 80     ld   (0x8073),a
 *   1371  3e 05        ld   a,0x05
 *   1373  32 71 80     ld   (0x8071),a
 *   1376  3e 02        ld   a,0x02
 *   1378  32 6a 80     ld   (0x806a),a
 *   137b  3e 01        ld   a,0x01
 *   137d  32 6c 80     ld   (0x806c),a
 *   1380  32 6d 80     ld   (0x806d),a
 *   1383  3e 32        ld   a,0x32
 *   1385  32 69 80     ld   (0x8069),a
 *   1388  3e 01        ld   a,0x01
 *   138a  32 70 80     ld   (0x8070),a
 *   138d  3e 00        ld   a,0x00
 *   138f  32 1a 80     ld   (0x801a),a
 *   1392  32 75 80     ld   (0x8075),a
 *   1395  32 a2 80     ld   (0x80a2),a
 *   1398  32 a4 80     ld   (0x80a4),a
 *   139b  32 a7 80     ld   (0x80a7),a
 *   139e  32 a8 80     ld   (0x80a8),a
 *   13a1  32 76 80     ld   (0x8076),a
 *   13a4  32 77 80     ld   (0x8077),a
 *   13a7  32 78 80     ld   (0x8078),a
 *   13aa  32 7a 80     ld   (0x807a),a
 *   13ad  32 79 80     ld   (0x8079),a
 *   13b0  32 7e 80     ld   (0x807e),a
 *   13b3  32 7f 80     ld   (0x807f),a
 *   13b6  32 80 80     ld   (0x8080),a
 *   13b9  32 7c 80     ld   (0x807c),a
 *   13bc  32 7b 80     ld   (0x807b),a
 *   13bf  32 7d 80     ld   (0x807d),a
 *   13c2  32 81 80     ld   (0x8081),a
 *   13c5  32 82 80     ld   (0x8082),a
 *   13c8  c9           ret
 */
export function loc_1362(m) {
  const { regs, mem } = m;
  regs.a = 0x00;
  m.step(0x1364, 7);
  mem.write8(0x8068, regs.a);
  m.step(0x1367, 13);
  regs.a = 0x23;
  m.step(0x1369, 7);
  mem.write8(0x806b, regs.a);
  m.step(0x136c, 13);
  regs.a = 0x19;
  m.step(0x136e, 7);
  mem.write8(0x8073, regs.a);
  m.step(0x1371, 13);
  regs.a = 0x05;
  m.step(0x1373, 7);
  mem.write8(0x8071, regs.a);
  m.step(0x1376, 13);
  regs.a = 0x02;
  m.step(0x1378, 7);
  mem.write8(0x806a, regs.a);
  m.step(0x137b, 13);
  regs.a = 0x01;
  m.step(0x137d, 7);
  mem.write8(0x806c, regs.a);
  m.step(0x1380, 13);
  mem.write8(0x806d, regs.a);
  m.step(0x1383, 13);
  regs.a = 0x32;
  m.step(0x1385, 7);
  mem.write8(0x8069, regs.a);
  m.step(0x1388, 13);
  regs.a = 0x01;
  m.step(0x138a, 7);
  mem.write8(0x8070, regs.a);
  m.step(0x138d, 13);
  regs.a = 0x00;
  m.step(0x138f, 7);
  mem.write8(0x801a, regs.a);
  m.step(0x1392, 13);
  mem.write8(0x8075, regs.a);
  m.step(0x1395, 13);
  mem.write8(0x80a2, regs.a);
  m.step(0x1398, 13);
  mem.write8(0x80a4, regs.a);
  m.step(0x139b, 13);
  mem.write8(0x80a7, regs.a);
  m.step(0x139e, 13);
  mem.write8(0x80a8, regs.a);
  m.step(0x13a1, 13);
  mem.write8(0x8076, regs.a);
  m.step(0x13a4, 13);
  mem.write8(0x8077, regs.a);
  m.step(0x13a7, 13);
  mem.write8(0x8078, regs.a);
  m.step(0x13aa, 13);
  mem.write8(0x807a, regs.a);
  m.step(0x13ad, 13);
  mem.write8(0x8079, regs.a);
  m.step(0x13b0, 13);
  mem.write8(0x807e, regs.a);
  m.step(0x13b3, 13);
  mem.write8(0x807f, regs.a);
  m.step(0x13b6, 13);
  mem.write8(0x8080, regs.a);
  m.step(0x13b9, 13);
  mem.write8(0x807c, regs.a);
  m.step(0x13bc, 13);
  mem.write8(0x807b, regs.a);
  m.step(0x13bf, 13);
  mem.write8(0x807d, regs.a);
  m.step(0x13c2, 13);
  mem.write8(0x8081, regs.a);
  m.step(0x13c5, 13);
  mem.write8(0x8082, regs.a);
  m.step(0x13c8, 13);
  m.ret();
}
