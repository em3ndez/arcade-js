// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_0066  (ROM 0x0066-0x01a3) — the vblank NMI handler / per-frame service
 * routine. It saves nothing on the stack: the classic fast-NMI idiom swaps to
 * the Z80 shadow register set (`ex af,af'` + `exx`) on entry and swaps back on
 * exit, so it borrows AF/BC/DE/HL for the duration without touching the caller's.
 *
 * First it CLEARS the NMI-enable bit (LS259 b0 via 0xB000) as an acknowledge,
 * then runs a coin/credit watchdog: it cross-checks three redundant copies of a
 * credit counter (0x8000 / 0x801c / 0x812c) and bails to the reset vector
 * 0x01A4 on any mismatch or overflow; services a ring buffer at 0x801e/0x801f
 * (0x8020..); DMA-blits nothing here (The Pit has no i8257) but block-copies a
 * 0x20-byte record 0x8220->0x9840 (sprite RAM); ticks four countdown timers
 * (0x8009/0x8006/0x800f, 0x8007/0x8010); debounces two input ports
 * (0xA800=IN1 -> 0x8015/0x8016, 0xA000=IN0 -> 0x8018/0x8019); and finally runs
 * the coin/credit accounting off the debounced edges (0x8003/0x8004/0x8005),
 * either awarding a credit (jp 0x022d) or dispatching a start (jp 0x021c), or
 * re-enabling the NMI (LS259 b0 = 1) and `ret`-ing at loc_019c.
 *
 * CONVENTIONS (matching entry_0000.js / sub_13c9.js in this same directory):
 *   - A tail-jump into ANOTHER routine (0x01a4 reset, 0x021c, 0x022d) is
 *     `m.step(target, T); return m.call(target)` — the callee's own `ret`
 *     returns to OUR caller, exactly as a `jp` that never comes back. This is
 *     deliberately NOT the `m.call(target); m.ret()` shape (that models a real
 *     CALL+RET pair — a spurious stack push and a second ret's cycles).
 *   - The internal loc_* labels are branch/fall-through targets of THIS one
 *     routine, so they are reached by a DIRECT JS call (`return loc_00a5(m)`),
 *     never m.call — m.call is the inter-routine seam. They are exported per the
 *     loc_<addr>-is-a-ROM-address convention so a future registry can find them.
 *   - Every real `call` (0x4c4d, 0x4c5b) is `m.push16(ret); m.step(target,17);
 *     m.call(target)`.
 *
 *   0066  08           ex   af,af'
 *   0067  d9           exx
 *   0068  3e 00        ld   a,0x00
 *   006a  32 00 b0     ld   (0xb000),a       ; LS259 b0 = 0  -> NMI acknowledge
 *   006d  3a 00 80     ld   a,(0x8000)
 *   0070  fe 0a        cp   0x0a
 *   0072  d2 a4 01     jp   nc,0x01a4        ; credit >= 10 -> reset
 *   0075  47           ld   b,a
 *   0076  3a 1c 80     ld   a,(0x801c)
 *   0079  b8           cp   b
 *   007a  c2 a4 01     jp   nz,0x01a4        ; copy 1 mismatch -> reset
 *   007d  3a 2c 81     ld   a,(0x812c)
 *   0080  b8           cp   b
 *   0081  c2 a4 01     jp   nz,0x01a4        ; copy 2 mismatch -> reset
 *   0084  3a 1f 80     ld   a,(0x801f)
 *   0087  5f           ld   e,a
 *   0088  3a 1e 80     ld   a,(0x801e)
 *   008b  bb           cp   e
 *   008c  28 17        jr   z,0x00a5         ; ring empty -> skip
 *   008e  7b           ld   a,e
 *   008f  3c           inc  a
 *   0090  e6 07        and  0x07
 *   0092  32 1f 80     ld   (0x801f),a
 *   0095  21 20 80     ld   hl,0x8020
 *   0098  16 00        ld   d,0x00
 *   009a  19           add  hl,de
 *   009b  7e           ld   a,(hl)
 *   009c  36 00        ld   (hl),0x00
 *   009e  cb 7f        bit  7,a
 *   00a0  28 03        jr   z,0x00a5
 *   00a2  32 00 b8     ld   (0xb800),a       ; sound latch
 *
 * loc_00a5:
 *   00a5  11 40 98     ld   de,0x9840
 *   00a8  21 20 82     ld   hl,0x8220
 *   00ab  01 20 00     ld   bc,0x0020
 *   00ae  ed b0        ldir                  ; 0x8220.. -> sprite RAM 0x9840..
 *   00b0  3a 09 80     ld   a,(0x8009)
 *   00b3  3d           dec  a
 *   00b4  32 09 80     ld   (0x8009),a
 *   00b7  3a 06 80     ld   a,(0x8006)
 *   00ba  3d           dec  a
 *   00bb  32 06 80     ld   (0x8006),a
 *   00be  20 0c        jr   nz,0x00cc
 *   00c0  3a 0f 80     ld   a,(0x800f)
 *   00c3  3d           dec  a
 *   00c4  32 0f 80     ld   (0x800f),a
 *   00c7  3e 3c        ld   a,0x3c
 *   00c9  32 06 80     ld   (0x8006),a
 *
 * loc_00cc:
 *   00cc  3a 07 80     ld   a,(0x8007)
 *   00cf  3d           dec  a
 *   00d0  32 07 80     ld   (0x8007),a
 *   00d3  20 0c        jr   nz,0x00e1
 *   00d5  3a 10 80     ld   a,(0x8010)
 *   00d8  3c           inc  a
 *   00d9  32 10 80     ld   (0x8010),a
 *   00dc  3e 3c        ld   a,0x3c
 *   00de  32 07 80     ld   (0x8007),a
 *
 * loc_00e1:
 *   00e1  3a 16 80     ld   a,(0x8016)
 *   00e4  47           ld   b,a
 *   00e5  3a 00 a8     ld   a,(0xa800)       ; IN1 (coin/start, active high)
 *   00e8  b8           cp   b
 *   00e9  20 03        jr   nz,0x00ee
 *   00eb  32 15 80     ld   (0x8015),a       ; stable -> latch edge byte
 *
 * loc_00ee:
 *   00ee  32 16 80     ld   (0x8016),a
 *   00f1  3a 19 80     ld   a,(0x8019)
 *   00f4  47           ld   b,a
 *   00f5  3a 00 a0     ld   a,(0xa000)       ; IN0 (joystick, active low, muxed)
 *   00f8  b8           cp   b
 *   00f9  20 03        jr   nz,0x00fe
 *   00fb  32 18 80     ld   (0x8018),a
 *
 * loc_00fe:
 *   00fe  32 19 80     ld   (0x8019),a
 *   0101  3a 15 80     ld   a,(0x8015)
 *   0104  4f           ld   c,a
 *   0105  21 03 80     ld   hl,0x8003
 *   0108  cb 41        bit  0,c
 *   010a  28 04        jr   z,0x0110
 *   010c  36 55        ld   (hl),0x55
 *   010e  18 32        jr   0x0142
 *
 * loc_0110:
 *   0110  7e           ld   a,(hl)
 *   0111  36 aa        ld   (hl),0xaa
 *   0113  fe 55        cp   0x55
 *   0115  20 2b        jr   nz,0x0142
 *   0117  3a 00 80     ld   a,(0x8000)
 *   011a  3c           inc  a
 *   011b  fe 0a        cp   0x0a
 *   011d  38 02        jr   c,0x0121
 *   011f  3e 09        ld   a,0x09
 *
 * loc_0121:
 *   0121  32 00 80     ld   (0x8000),a
 *   0124  32 1c 80     ld   (0x801c),a
 *   0127  32 2c 81     ld   (0x812c),a
 *   012a  3a 48 80     ld   a,(0x8048)
 *   012d  b7           or   a
 *   012e  20 09        jr   nz,0x0139
 *   0130  3a 01 80     ld   a,(0x8001)
 *   0133  3d           dec  a
 *   0134  fe 02        cp   0x02
 *   0136  da 9c 01     jp   c,0x019c
 *
 * loc_0139:
 *   0139  cd 4d 4c     call 0x4c4d
 *   013c  cd 5b 4c     call 0x4c5b
 *   013f  c3 1c 02     jp   0x021c
 *
 * loc_0142:
 *   0142  3a 48 80     ld   a,(0x8048)
 *   0145  b7           or   a
 *   0146  20 08        jr   nz,0x0150
 *   0148  3a 01 80     ld   a,(0x8001)
 *   014b  3d           dec  a
 *   014c  fe 02        cp   0x02
 *   014e  38 4c        jr   c,0x019c
 *
 * loc_0150:
 *   0150  3a 4c 80     ld   a,(0x804c)
 *   0153  57           ld   d,a
 *   0154  1e 01        ld   e,0x01
 *   0156  21 04 80     ld   hl,0x8004
 *   0159  cb 51        bit  2,c
 *   015b  20 04        jr   nz,0x0161
 *   015d  36 aa        ld   (hl),0xaa
 *   015f  18 07        jr   0x0168
 *
 * loc_0161:
 *   0161  7e           ld   a,(hl)
 *   0162  36 55        ld   (hl),0x55
 *   0164  fe aa        cp   0xaa
 *   0166  28 18        jr   z,0x0180
 *
 * loc_0168:
 *   0168  3a 4d 80     ld   a,(0x804d)
 *   016b  57           ld   d,a
 *   016c  1e 02        ld   e,0x02
 *   016e  21 05 80     ld   hl,0x8005
 *   0171  cb 49        bit  1,c
 *   0173  20 04        jr   nz,0x0179
 *   0175  36 aa        ld   (hl),0xaa
 *   0177  18 23        jr   0x019c
 *
 * loc_0179:
 *   0179  7e           ld   a,(hl)
 *   017a  36 55        ld   (hl),0x55
 *   017c  fe aa        cp   0xaa
 *   017e  20 1c        jr   nz,0x019c
 *
 * loc_0180:
 *   0180  3a 00 80     ld   a,(0x8000)
 *   0183  92           sub  d
 *   0184  38 16        jr   c,0x019c
 *   0186  32 00 80     ld   (0x8000),a
 *   0189  32 1c 80     ld   (0x801c),a
 *   018c  32 2c 81     ld   (0x812c),a
 *   018f  7b           ld   a,e
 *   0190  32 01 80     ld   (0x8001),a
 *   0193  32 1d 80     ld   (0x801d),a
 *   0196  32 2d 81     ld   (0x812d),a
 *   0199  c3 2d 02     jp   0x022d
 *
 * loc_019c:
 *   019c  3e 01        ld   a,0x01
 *   019e  32 00 b0     ld   (0xb000),a       ; LS259 b0 = 1 -> re-enable NMI
 *   01a1  08           ex   af,af'
 *   01a2  d9           exx
 *   01a3  c9           ret
 */
export function entry_0066(m) {
  const { regs, mem } = m;

  regs.exAf();
  m.step(0x0067, 4); // ex af,af'
  regs.exx();
  m.step(0x0068, 4); // exx
  regs.a = 0x00;
  m.step(0x006a, 7); // ld a,0x00
  mem.write8(0xb000, regs.a, 10);
  m.step(0x006d, 13); // ld (0xb000),a -- NMI acknowledge (LS259 b0 = 0)
  regs.a = mem.read8(0x8000);
  m.step(0x0070, 13); // ld a,(0x8000)
  regs.cp(0x0a);
  m.step(0x0072, 7); // cp 0x0a
  if (regs.fNC) {
    m.step(0x01a4, 10); // jp nc,0x01a4 taken -- credit overflow, reset
    return m.call(0x01a4);
  }
  m.step(0x0075, 10); // jp nc not taken

  regs.b = regs.a;
  m.step(0x0076, 4); // ld b,a
  regs.a = mem.read8(0x801c);
  m.step(0x0079, 13); // ld a,(0x801c)
  regs.cp(regs.b);
  m.step(0x007a, 4); // cp b
  if (regs.fNZ) {
    m.step(0x01a4, 10); // jp nz,0x01a4 taken -- copy-1 mismatch, reset
    return m.call(0x01a4);
  }
  m.step(0x007d, 10); // jp nz not taken

  regs.a = mem.read8(0x812c);
  m.step(0x0080, 13); // ld a,(0x812c)
  regs.cp(regs.b);
  m.step(0x0081, 4); // cp b
  if (regs.fNZ) {
    m.step(0x01a4, 10); // jp nz,0x01a4 taken -- copy-2 mismatch, reset
    return m.call(0x01a4);
  }
  m.step(0x0084, 10); // jp nz not taken

  regs.a = mem.read8(0x801f);
  m.step(0x0087, 13); // ld a,(0x801f) -- ring tail
  regs.e = regs.a;
  m.step(0x0088, 4); // ld e,a
  regs.a = mem.read8(0x801e);
  m.step(0x008b, 13); // ld a,(0x801e) -- ring head
  regs.cp(regs.e);
  m.step(0x008c, 4); // cp e
  if (regs.fZ) {
    m.step(0x00a5, 12); // jr z,0x00a5 taken -- ring empty
    return loc_00a5(m);
  }
  m.step(0x008e, 7); // jr z not taken

  regs.a = regs.e;
  m.step(0x008f, 4); // ld a,e
  regs.a = regs.inc8(regs.a);
  m.step(0x0090, 4); // inc a
  regs.and(0x07);
  m.step(0x0092, 7); // and 0x07 -- wrap the tail pointer mod 8
  mem.write8(0x801f, regs.a);
  m.step(0x0095, 13); // ld (0x801f),a
  regs.hl = 0x8020;
  m.step(0x0098, 10); // ld hl,0x8020
  regs.d = 0x00;
  m.step(0x009a, 7); // ld d,0x00
  regs.addHl(regs.de);
  m.step(0x009b, 11); // add hl,de
  regs.a = mem.read8(regs.hl);
  m.step(0x009c, 7); // ld a,(hl)
  mem.write8(regs.hl, 0x00);
  m.step(0x009e, 10); // ld (hl),0x00 -- consume the ring slot
  regs.bit(7, regs.a);
  m.step(0x00a0, 8); // bit 7,a
  if (regs.fZ) {
    m.step(0x00a5, 12); // jr z,0x00a5 taken -- no sound command in the slot
    return loc_00a5(m);
  }
  m.step(0x00a2, 7); // jr z not taken

  mem.write8(0xb800, regs.a, 10);
  m.step(0x00a5, 13); // ld (0xb800),a -- fire the queued sound command
  return loc_00a5(m); // fall through
}

export function loc_00a5(m) {
  const { regs, mem } = m;

  regs.de = 0x9840;
  m.step(0x00a8, 10); // ld de,0x9840
  regs.hl = 0x8220;
  m.step(0x00ab, 10); // ld hl,0x8220
  regs.bc = 0x0020;
  m.step(0x00ae, 10); // ld bc,0x0020
  m.ldirAt(0x00ae, 0x00b0); // ldir -- 0x8220.. -> sprite RAM 0x9840..

  regs.a = mem.read8(0x8009);
  m.step(0x00b3, 13); // ld a,(0x8009)
  regs.a = regs.dec8(regs.a);
  m.step(0x00b4, 4); // dec a
  mem.write8(0x8009, regs.a);
  m.step(0x00b7, 13); // ld (0x8009),a
  regs.a = mem.read8(0x8006);
  m.step(0x00ba, 13); // ld a,(0x8006)
  regs.a = regs.dec8(regs.a);
  m.step(0x00bb, 4); // dec a
  mem.write8(0x8006, regs.a);
  m.step(0x00be, 13); // ld (0x8006),a
  if (regs.fNZ) {
    m.step(0x00cc, 12); // jr nz,0x00cc taken -- 0x8006 not expired
    return loc_00cc(m);
  }
  m.step(0x00c0, 7); // jr nz not taken

  regs.a = mem.read8(0x800f);
  m.step(0x00c3, 13); // ld a,(0x800f)
  regs.a = regs.dec8(regs.a);
  m.step(0x00c4, 4); // dec a
  mem.write8(0x800f, regs.a);
  m.step(0x00c7, 13); // ld (0x800f),a
  regs.a = 0x3c;
  m.step(0x00c9, 7); // ld a,0x3c
  mem.write8(0x8006, regs.a);
  m.step(0x00cc, 13); // ld (0x8006),a -- reload the 60-frame timer
  return loc_00cc(m); // fall through
}

export function loc_00cc(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8007);
  m.step(0x00cf, 13); // ld a,(0x8007)
  regs.a = regs.dec8(regs.a);
  m.step(0x00d0, 4); // dec a
  mem.write8(0x8007, regs.a);
  m.step(0x00d3, 13); // ld (0x8007),a
  if (regs.fNZ) {
    m.step(0x00e1, 12); // jr nz,0x00e1 taken -- 0x8007 not expired
    return loc_00e1(m);
  }
  m.step(0x00d5, 7); // jr nz not taken

  regs.a = mem.read8(0x8010);
  m.step(0x00d8, 13); // ld a,(0x8010)
  regs.a = regs.inc8(regs.a);
  m.step(0x00d9, 4); // inc a
  mem.write8(0x8010, regs.a);
  m.step(0x00dc, 13); // ld (0x8010),a
  regs.a = 0x3c;
  m.step(0x00de, 7); // ld a,0x3c
  mem.write8(0x8007, regs.a);
  m.step(0x00e1, 13); // ld (0x8007),a -- reload
  return loc_00e1(m); // fall through
}

export function loc_00e1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8016);
  m.step(0x00e4, 13); // ld a,(0x8016) -- previous IN1 sample
  regs.b = regs.a;
  m.step(0x00e5, 4); // ld b,a
  regs.a = mem.read8(0xa800);
  m.step(0x00e8, 13); // ld a,(0xa800) -- IN1 now
  regs.cp(regs.b);
  m.step(0x00e9, 4); // cp b
  if (regs.fNZ) {
    m.step(0x00ee, 12); // jr nz,0x00ee taken -- bouncing, do not latch
    return loc_00ee(m);
  }
  m.step(0x00eb, 7); // jr nz not taken

  mem.write8(0x8015, regs.a);
  m.step(0x00ee, 13); // ld (0x8015),a -- two equal samples -> stable value
  return loc_00ee(m); // fall through
}

export function loc_00ee(m) {
  const { regs, mem } = m;

  mem.write8(0x8016, regs.a);
  m.step(0x00f1, 13); // ld (0x8016),a -- roll the IN1 sample
  regs.a = mem.read8(0x8019);
  m.step(0x00f4, 13); // ld a,(0x8019) -- previous IN0 sample
  regs.b = regs.a;
  m.step(0x00f5, 4); // ld b,a
  regs.a = mem.read8(0xa000);
  m.step(0x00f8, 13); // ld a,(0xa000) -- IN0 now
  regs.cp(regs.b);
  m.step(0x00f9, 4); // cp b
  if (regs.fNZ) {
    m.step(0x00fe, 12); // jr nz,0x00fe taken -- bouncing
    return loc_00fe(m);
  }
  m.step(0x00fb, 7); // jr nz not taken

  mem.write8(0x8018, regs.a);
  m.step(0x00fe, 13); // ld (0x8018),a -- stable IN0
  return loc_00fe(m); // fall through
}

export function loc_00fe(m) {
  const { regs, mem } = m;

  mem.write8(0x8019, regs.a);
  m.step(0x0101, 13); // ld (0x8019),a -- roll the IN0 sample
  regs.a = mem.read8(0x8015);
  m.step(0x0104, 13); // ld a,(0x8015) -- stable IN1 edge byte
  regs.c = regs.a;
  m.step(0x0105, 4); // ld c,a
  regs.hl = 0x8003;
  m.step(0x0108, 10); // ld hl,0x8003
  regs.bit(0, regs.c);
  m.step(0x010a, 8); // bit 0,c -- coin-1 line
  if (regs.fZ) {
    m.step(0x0110, 12); // jr z,0x0110 taken -- coin-1 not asserted
    return loc_0110(m);
  }
  m.step(0x010c, 7); // jr z not taken

  mem.write8(regs.hl, 0x55);
  m.step(0x010e, 10); // ld (hl),0x55 -- arm coin-1 accumulator
  m.step(0x0142, 12); // jr 0x0142
  return loc_0142(m);
}

export function loc_0110(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x0111, 7); // ld a,(hl)
  mem.write8(regs.hl, 0xaa);
  m.step(0x0113, 10); // ld (hl),0xaa
  regs.cp(0x55);
  m.step(0x0115, 7); // cp 0x55 -- was it armed?
  if (regs.fNZ) {
    m.step(0x0142, 12); // jr nz,0x0142 taken -- not a completed coin edge
    return loc_0142(m);
  }
  m.step(0x0117, 7); // jr nz not taken

  regs.a = mem.read8(0x8000);
  m.step(0x011a, 13); // ld a,(0x8000)
  regs.a = regs.inc8(regs.a);
  m.step(0x011b, 4); // inc a -- add a credit
  regs.cp(0x0a);
  m.step(0x011d, 7); // cp 0x0a
  if (regs.fC) {
    m.step(0x0121, 12); // jr c,0x0121 taken -- under the 9-credit cap
    return loc_0121(m);
  }
  m.step(0x011f, 7); // jr c not taken

  regs.a = 0x09;
  m.step(0x0121, 7); // ld a,0x09 -- clamp to 9
  return loc_0121(m); // fall through
}

export function loc_0121(m) {
  const { regs, mem } = m;

  mem.write8(0x8000, regs.a);
  m.step(0x0124, 13); // ld (0x8000),a
  mem.write8(0x801c, regs.a);
  m.step(0x0127, 13); // ld (0x801c),a -- redundant copy 1
  mem.write8(0x812c, regs.a);
  m.step(0x012a, 13); // ld (0x812c),a -- redundant copy 2
  regs.a = mem.read8(0x8048);
  m.step(0x012d, 13); // ld a,(0x8048)
  regs.or(regs.a);
  m.step(0x012e, 4); // or a
  if (regs.fNZ) {
    m.step(0x0139, 12); // jr nz,0x0139 taken
    return loc_0139(m);
  }
  m.step(0x0130, 7); // jr nz not taken

  regs.a = mem.read8(0x8001);
  m.step(0x0133, 13); // ld a,(0x8001)
  regs.a = regs.dec8(regs.a);
  m.step(0x0134, 4); // dec a
  regs.cp(0x02);
  m.step(0x0136, 7); // cp 0x02
  if (regs.fC) {
    m.step(0x019c, 10); // jp c,0x019c taken
    return loc_019c(m);
  }
  m.step(0x0139, 10); // jp c not taken
  return loc_0139(m);
}

export function loc_0139(m) {
  const { regs, mem } = m;

  m.push16(0x013c);
  m.step(0x4c4d, 17); // call 0x4c4d
  m.call(0x4c4d);
  m.push16(0x013f);
  m.step(0x4c5b, 17); // call 0x4c5b
  m.call(0x4c5b);
  m.step(0x021c, 10); // jp 0x021c
  return m.call(0x021c);
}

export function loc_0142(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8048);
  m.step(0x0145, 13); // ld a,(0x8048)
  regs.or(regs.a);
  m.step(0x0146, 4); // or a
  if (regs.fNZ) {
    m.step(0x0150, 12); // jr nz,0x0150 taken
    return loc_0150(m);
  }
  m.step(0x0148, 7); // jr nz not taken

  regs.a = mem.read8(0x8001);
  m.step(0x014b, 13); // ld a,(0x8001)
  regs.a = regs.dec8(regs.a);
  m.step(0x014c, 4); // dec a
  regs.cp(0x02);
  m.step(0x014e, 7); // cp 0x02
  if (regs.fC) {
    m.step(0x019c, 12); // jr c,0x019c taken
    return loc_019c(m);
  }
  m.step(0x0150, 7); // jr c not taken
  return loc_0150(m); // fall through
}

export function loc_0150(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x804c);
  m.step(0x0153, 13); // ld a,(0x804c) -- coins-per-credit for slot 1
  regs.d = regs.a;
  m.step(0x0154, 4); // ld d,a
  regs.e = 0x01;
  m.step(0x0156, 7); // ld e,0x01
  regs.hl = 0x8004;
  m.step(0x0159, 10); // ld hl,0x8004
  regs.bit(2, regs.c);
  m.step(0x015b, 8); // bit 2,c -- coin-2 line
  if (regs.fNZ) {
    m.step(0x0161, 12); // jr nz,0x0161 taken -- coin-2 asserted
    return loc_0161(m);
  }
  m.step(0x015d, 7); // jr nz not taken

  mem.write8(regs.hl, 0xaa);
  m.step(0x015f, 10); // ld (hl),0xaa -- clear coin-2 accumulator
  m.step(0x0168, 12); // jr 0x0168
  return loc_0168(m);
}

export function loc_0161(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x0162, 7); // ld a,(hl)
  mem.write8(regs.hl, 0x55);
  m.step(0x0164, 10); // ld (hl),0x55
  regs.cp(0xaa);
  m.step(0x0166, 7); // cp 0xaa -- completed coin-2 edge?
  if (regs.fZ) {
    m.step(0x0180, 12); // jr z,0x0180 taken -- award a credit
    return loc_0180(m);
  }
  m.step(0x0168, 7); // jr z not taken
  return loc_0168(m); // fall through
}

export function loc_0168(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x804d);
  m.step(0x016b, 13); // ld a,(0x804d) -- coins-per-credit for slot 2
  regs.d = regs.a;
  m.step(0x016c, 4); // ld d,a
  regs.e = 0x02;
  m.step(0x016e, 7); // ld e,0x02
  regs.hl = 0x8005;
  m.step(0x0171, 10); // ld hl,0x8005
  regs.bit(1, regs.c);
  m.step(0x0173, 8); // bit 1,c -- coin-3 line
  if (regs.fNZ) {
    m.step(0x0179, 12); // jr nz,0x0179 taken
    return loc_0179(m);
  }
  m.step(0x0175, 7); // jr nz not taken

  mem.write8(regs.hl, 0xaa);
  m.step(0x0177, 10); // ld (hl),0xaa
  m.step(0x019c, 12); // jr 0x019c
  return loc_019c(m);
}

export function loc_0179(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x017a, 7); // ld a,(hl)
  mem.write8(regs.hl, 0x55);
  m.step(0x017c, 10); // ld (hl),0x55
  regs.cp(0xaa);
  m.step(0x017e, 7); // cp 0xaa
  if (regs.fNZ) {
    m.step(0x019c, 12); // jr nz,0x019c taken
    return loc_019c(m);
  }
  m.step(0x0180, 7); // jr nz not taken
  return loc_0180(m); // fall through
}

export function loc_0180(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8000);
  m.step(0x0183, 13); // ld a,(0x8000)
  regs.sub(regs.d);
  m.step(0x0184, 4); // sub d -- pay the coins-per-credit cost
  if (regs.fC) {
    m.step(0x019c, 12); // jr c,0x019c taken -- not enough coins yet
    return loc_019c(m);
  }
  m.step(0x0186, 7); // jr c not taken

  mem.write8(0x8000, regs.a);
  m.step(0x0189, 13); // ld (0x8000),a
  mem.write8(0x801c, regs.a);
  m.step(0x018c, 13); // ld (0x801c),a
  mem.write8(0x812c, regs.a);
  m.step(0x018f, 13); // ld (0x812c),a
  regs.a = regs.e;
  m.step(0x0190, 4); // ld a,e -- the coin-slot id
  mem.write8(0x8001, regs.a);
  m.step(0x0193, 13); // ld (0x8001),a
  mem.write8(0x801d, regs.a);
  m.step(0x0196, 13); // ld (0x801d),a
  mem.write8(0x812d, regs.a);
  m.step(0x0199, 13); // ld (0x812d),a
  m.step(0x022d, 10); // jp 0x022d -- credit awarded
  return m.call(0x022d);
}

export function loc_019c(m) {
  const { regs, mem } = m;

  regs.a = 0x01;
  m.step(0x019e, 7); // ld a,0x01
  mem.write8(0xb000, regs.a, 10);
  m.step(0x01a1, 13); // ld (0xb000),a -- LS259 b0 = 1 -> re-enable NMI
  regs.exAf();
  m.step(0x01a2, 4); // ex af,af'
  regs.exx();
  m.step(0x01a3, 4); // exx
  return m.ret(); // ret
}
