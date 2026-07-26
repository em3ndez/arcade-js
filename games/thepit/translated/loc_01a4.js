// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_01a4  (ROM 0x01a4-0x01f8, The Pit) — the COLD-BOOT / power-on init entry,
 * reached from the reset vector (loc_0000 -> jp 0x01a4). It brings the machine up
 * from nothing: masks interrupts, points the stack at the top of work RAM, clears
 * the LS259 control latch, seeds a block of work-RAM state bytes, runs the screen /
 * table / sound setup helpers, reads the DSW, burns a long busy-delay, arms a
 * 0x3c-frame vblank delay, and TAIL-jumps into 0x03ac (the attract/main flow).
 *
 *   01a4  f3           di                 ; mask maskable IRQ
 *   01a5  ed 56        im   1
 *   01a7  31 ff 83     ld   sp,0x83ff     ; stack top = top of work RAM
 *   01aa  cd 10 4b     call 0x4b10        ; A=0 -> LS259 latch (clears NMI/mux/etc.)
 *   01ad  3e 00        ld   a,0x00
 *   01af  32 00 80     ld   (0x8000),a
 *   01b2  32 1c 80     ld   (0x801c),a
 *   01b5  32 2c 81     ld   (0x812c),a
 *   01b8  32 01 80     ld   (0x8001),a
 *   01bb  3e 06        ld   a,0x06
 *   01bd  32 15 80     ld   (0x8015),a
 *   01c0  32 16 80     ld   (0x8016),a
 *   01c3  3e 55        ld   a,0x55
 *   01c5  32 04 80     ld   (0x8004),a
 *   01c8  32 05 80     ld   (0x8005),a
 *   01cb  07           rlca               ; 0x55 -> 0xAA
 *   01cc  32 03 80     ld   (0x8003),a    ; stores 0xAA
 *   01cf  cd ea 4b     call 0x4bea        ; zero two work-RAM blocks
 *   01d2  cd c7 4b     call 0x4bc7        ; init two work-RAM tables
 *   01d5  cd 4d 4c     call 0x4c4d        ; set sound-enable latch
 *   01d8  cd 44 4b     call 0x4b44        ; screen/palette setup (A=0 entry)
 *   01db  cd 3c 4b     call 0x4b3c        ; display setup (A=0xC0)
 *   01de  cd 57 4c     call 0x4c57        ; sound-request stub
 *   01e1  3e 01        ld   a,0x01
 *   01e3  32 02 80     ld   (0x8002),a
 *   01e6  cd 55 4b     call 0x4b55        ; read DSW at 0xb000
 *   01e9  01 00 00     ld   bc,0x0000
 * loc_01ec:
 *   01ec  10 fe        djnz 0x01ec        ; tight self-loop (inner delay)
 *   01ee  0d           dec  c
 *   01ef  20 fb        jr   nz,0x01ec     ; outer delay
 *   01f1  3e 3c        ld   a,0x3c
 *   01f3  cd ff 4b     call 0x4bff        ; arm a 0x3c-frame vblank delay
 *   01f6  c3 ac 03     jp   0x03ac        ; TAIL-jump into the attract/main flow
 *
 * di / im 1 are charged for their T-states but change no diffed state: this
 * hardware gates its vblank interrupt through the LS259 latch (io.js nmiMask,
 * b0), not the Z80's IFF/IM, so the CPU interrupt-enable and mode are not part of
 * the state the diff compares. rlca of 0x55 is 0xAA, which is why 0x8003 gets 0xAA
 * while 0x8004/0x8005 keep 0x55. The delay is a nested busy-count: bc = 0x0000, so
 * each `djnz` pass spins 256 times (B: 0->0xFF->..->0x00) and the outer `dec c /
 * jr nz` gives 256 passes = 65536 inner iterations; `djnz` touches no flags, and
 * the outer `jr nz` reads `dec c`'s Z. The closing `jp 0x03ac` is a tail-jump
 * (pushes nothing), so it is `m.step(target,10); return m.call(target)` — NOT the
 * `m.call; m.ret()` shape, which would push a spurious word and charge a second
 * ret (27 T instead of 10). Boot never returns here; 0x03ac drives the game.
 */
export function loc_01a4(m) {
  const { regs, mem } = m;

  m.step(0x01a5, 4); // 01a4  di -- mask IRQ (no diffed effect; latch gates the NMI)

  m.step(0x01a7, 8); // 01a5  im 1 -- interrupt mode 1 (no diffed effect)

  regs.sp = 0x83ff;
  m.step(0x01aa, 10); // 01a7  ld sp,0x83ff -- stack top at the top of work RAM

  m.push16(0x01ad);
  m.step(0x4b10, 17); // 01aa  call 0x4b10 -- A=0 -> LS259 control latch
  m.call(0x4b10);

  regs.a = 0x00;
  m.step(0x01af, 7); // 01ad  ld a,0x00

  mem.write8(0x8000, regs.a);
  m.step(0x01b2, 13); // 01af  ld (0x8000),a

  mem.write8(0x801c, regs.a);
  m.step(0x01b5, 13); // 01b2  ld (0x801c),a

  mem.write8(0x812c, regs.a);
  m.step(0x01b8, 13); // 01b5  ld (0x812c),a

  mem.write8(0x8001, regs.a);
  m.step(0x01bb, 13); // 01b8  ld (0x8001),a

  regs.a = 0x06;
  m.step(0x01bd, 7); // 01bb  ld a,0x06

  mem.write8(0x8015, regs.a);
  m.step(0x01c0, 13); // 01bd  ld (0x8015),a

  mem.write8(0x8016, regs.a);
  m.step(0x01c3, 13); // 01c0  ld (0x8016),a

  regs.a = 0x55;
  m.step(0x01c5, 7); // 01c3  ld a,0x55

  mem.write8(0x8004, regs.a);
  m.step(0x01c8, 13); // 01c5  ld (0x8004),a

  mem.write8(0x8005, regs.a);
  m.step(0x01cb, 13); // 01c8  ld (0x8005),a

  regs.rlca(); // 01cb  rlca -- 0x55 rotates left-circular to 0xAA
  m.step(0x01cc, 4);

  mem.write8(0x8003, regs.a);
  m.step(0x01cf, 13); // 01cc  ld (0x8003),a -- stores 0xAA

  m.push16(0x01d2);
  m.step(0x4bea, 17); // 01cf  call 0x4bea -- zero two work-RAM blocks
  m.call(0x4bea);

  m.push16(0x01d5);
  m.step(0x4bc7, 17); // 01d2  call 0x4bc7 -- init two work-RAM tables
  m.call(0x4bc7);

  m.push16(0x01d8);
  m.step(0x4c4d, 17); // 01d5  call 0x4c4d -- set sound-enable latch
  m.call(0x4c4d);

  m.push16(0x01db);
  m.step(0x4b44, 17); // 01d8  call 0x4b44 -- screen/palette setup (A=0 entry)
  m.call(0x4b44);

  m.push16(0x01de);
  m.step(0x4b3c, 17); // 01db  call 0x4b3c -- display setup (A=0xC0)
  m.call(0x4b3c);

  m.push16(0x01e1);
  m.step(0x4c57, 17); // 01de  call 0x4c57 -- sound-request stub
  m.call(0x4c57);

  regs.a = 0x01;
  m.step(0x01e3, 7); // 01e1  ld a,0x01

  mem.write8(0x8002, regs.a);
  m.step(0x01e6, 13); // 01e3  ld (0x8002),a

  m.push16(0x01e9);
  m.step(0x4b55, 17); // 01e6  call 0x4b55 -- read DSW at 0xb000
  m.call(0x4b55);

  regs.bc = 0x0000;
  m.step(0x01ec, 10); // 01e9  ld bc,0x0000

  // loc_01ec: nested busy-delay. B (=0) spins 256 times per pass; C (=0) gives 256
  // passes -> 65536 inner iterations. The djnz jumps to itself (no body).
  for (;;) {
    for (;;) {
      // 01ec  djnz 0x01ec -- decrement B (no flags), spin while non-zero
      if (regs.djnz() !== 0) {
        m.step(0x01ec, 13); // djnz taken
      } else {
        m.step(0x01ee, 8); // djnz not taken -> fall through to dec c
        break;
      }
    }

    regs.c = regs.dec8(regs.c); // 01ee  dec c
    m.step(0x01ef, 4);

    // 01ef  jr nz,0x01ec -- another 256-count pass while C != 0
    if (regs.fNZ) {
      m.step(0x01ec, 12); // jr nz taken
    } else {
      m.step(0x01f1, 7); // jr nz not taken -> exit the delay
      break;
    }
  }

  regs.a = 0x3c;
  m.step(0x01f3, 7); // 01f1  ld a,0x3c

  m.push16(0x01f6);
  m.step(0x4bff, 17); // 01f3  call 0x4bff -- arm a 0x3c-frame vblank delay
  m.call(0x4bff);

  // 01f6  jp 0x03ac -- tail-jump (pushes nothing; 0x03ac's control flow is ours)
  m.step(0x03ac, 10);
  return m.call(0x03ac);
}
