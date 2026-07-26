// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4f47  (ROM 0x4f47-0x4f86, The Pit) -- a colour-cycle screen effect gated on
 * two bits of the input/mode byte at 0x8018. It sets the mode byte (0x8001)=0x09,
 * calls loc_4b44, then reads (0x8018): unless BOTH bit 3 AND bit 4 are set it bails
 * out via a tail-jump to loc_4b55; otherwise it runs a 128-pass flood.
 *
 * Each pass (outer loop loc_4f63, fill value A stepping 0x80..0xFF, held at 0x8012):
 *   - floods VIDEO RAM 0x9000-0x93FF with the running index pattern 0,1,..,0xFF
 *     (C repeats every 256 bytes) while flooding COLOUR RAM 0x8800-0x8BFF with the
 *     current fill value A -- 4 blocks of 256 bytes each (B=4 djnz), 1024 bytes total;
 *   - `ld a,0x78` / `call 0x4bff` (A=0x78 delay/timing argument);
 *   - reloads the pass value from 0x8012, `inc a`, and loops while non-zero.
 * A runs 0x80,0x81,..,0xFF; on the 0xFF pass `inc a` wraps to 0x00 (Z set) and the
 * loop falls through to a tail-jump into loc_03ac. So the fill runs 128 passes, and
 * colour RAM is left holding 0xFF (the last pass's value).
 *
 * loc_4f47:
 *   4f47  3e 09        ld   a,0x09
 *   4f49  32 01 80     ld   (0x8001),a       ; mode byte = 9
 *   4f4c  cd 44 4b     call 0x4b44
 *   4f4f  3a 18 80     ld   a,(0x8018)       ; input/mode gate byte
 *   4f52  cb 5f        bit  3,a              ; Z set iff bit3 CLEAR
 *   4f54  ca 55 4b     jp   z,0x4b55         ; bit3 clear -> bail (tail-jump loc_4b55)
 *   4f57  cb 67        bit  4,a              ; Z set iff bit4 CLEAR
 *   4f59  ca 55 4b     jp   z,0x4b55         ; bit4 clear -> bail (tail-jump loc_4b55)
 *   4f5c  3e 01        ld   a,0x01
 *   4f5e  cd ff 4b     call 0x4bff           ; A=0x01
 *   4f61  3e 80        ld   a,0x80           ; first pass value
 * loc_4f63:
 *   4f63  32 12 80     ld   (0x8012),a       ; stash the pass value / loop counter
 *   4f66  06 04        ld   b,0x04           ; 4 fill blocks
 *   4f68  0e 00        ld   c,0x00           ; running tile index
 *   4f6a  21 00 90     ld   hl,0x9000        ; video RAM
 *   4f6d  11 00 88     ld   de,0x8800        ; colour RAM
 * loc_4f70:
 *   4f70  71           ld   (hl),c           ; VRAM tile = running index
 *   4f71  12           ld   (de),a           ; colour RAM = pass value
 *   4f72  23           inc  hl
 *   4f73  13           inc  de
 *   4f74  0c           inc  c                ; Z set when it wraps 0xff->0x00
 *   4f75  20 f9        jr   nz,0x4f70        ; 256 bytes per block (loop while C != 0)
 *   4f77  10 f7        djnz 0x4f70           ; repeat block for each of B=4
 *   4f79  3e 78        ld   a,0x78
 *   4f7b  cd ff 4b     call 0x4bff           ; A=0x78
 *   4f7e  3a 12 80     ld   a,(0x8012)       ; reload the pass value
 *   4f81  3c           inc  a                ; Z set when 0xff wraps to 0x00
 *   4f82  20 df        jr   nz,0x4f63        ; next pass while non-zero (0x80..0xFF)
 *   4f84  c3 ac 03     jp   0x03ac           ; done -> tail-jump loc_03ac
 *
 * CONTROL-FLOW MODELLING (doc 03):
 *   - `call 0x4b44` and both `call 0x4bff` are ordinary calls: push16(return-addr) +
 *     m.step(target,17) + m.call, control resumes at the pushed address after each.
 *     They may clobber A/flags, but every value the routine branches on is
 *     re-established afterwards (`ld a,(0x8018)` reloads A; the inc/dec set their own
 *     flags), so nothing here depends on callee state.
 *   - Both `jp z,0x4b55` are CONDITIONAL TAIL-JUMPS: when taken, loc_4b55's own ret
 *     returns to OUR caller, so each is `m.step(0x4b55,10); return m.call(0x4b55)` with
 *     no trailing m.ret (a call+ret would push a spurious frame and double-pop -- see
 *     loc_0278 / loc_4b46). When NOT taken control falls through (10 T either way for jp cc).
 *   - The final `jp 0x03ac` is an unconditional tail-jump, modelled the same way; this
 *     routine therefore has NO ret of its own.
 *   - `bit 3,a` / `bit 4,a` use regs.bit (Z = !bit, carry preserved); the routine
 *     branches on that Z. `inc c` / `inc a` use inc8 (Z on wrap, carry preserved); the
 *     `jr nz` reads that Z. `djnz` decrements B with no flags (Z from `inc c` survives it).
 *   - The two fill back-edges (`jr nz,0x4f70` and `djnz 0x4f70`) both target 0x4f70, so
 *     the fill is ONE loop with two continue-conditions, not a nested pair.
 * Video/colour RAM writes are not hardware addresses, so they take no bus offset.
 */
export function loc_4f47(m) {
  const { regs, mem } = m;

  regs.a = 0x09;
  m.step(0x4f49, 7); // 4f47  ld a,0x09
  mem.write8(0x8001, regs.a);
  m.step(0x4f4c, 13); // 4f49  ld (0x8001),a -- mode byte = 9

  m.push16(0x4f4f);
  m.step(0x4b44, 17); // 4f4c  call 0x4b44
  m.call(0x4b44);

  regs.a = mem.read8(0x8018);
  m.step(0x4f52, 13); // 4f4f  ld a,(0x8018) -- input/mode gate byte

  regs.bit(3, regs.a);
  m.step(0x4f54, 8); // 4f52  bit 3,a -- Z set iff bit3 CLEAR
  // 4f54  jp z,0x4b55 -- bit3 clear -> bail (tail-jump; loc_4b55's ret returns to OUR caller)
  if (regs.fZ) {
    m.step(0x4b55, 10);
    return m.call(0x4b55);
  }
  m.step(0x4f57, 10); // jp z NOT taken -- bit3 set, continue

  regs.bit(4, regs.a);
  m.step(0x4f59, 8); // 4f57  bit 4,a -- Z set iff bit4 CLEAR
  // 4f59  jp z,0x4b55 -- bit4 clear -> bail (tail-jump)
  if (regs.fZ) {
    m.step(0x4b55, 10);
    return m.call(0x4b55);
  }
  m.step(0x4f5c, 10); // jp z NOT taken -- bit4 set too, run the flood

  regs.a = 0x01;
  m.step(0x4f5e, 7); // 4f5c  ld a,0x01
  m.push16(0x4f61);
  m.step(0x4bff, 17); // 4f5e  call 0x4bff (A=0x01)
  m.call(0x4bff);

  regs.a = 0x80;
  m.step(0x4f63, 7); // 4f61  ld a,0x80 -- first pass value

  // loc_4f63: outer pass loop. A steps 0x80..0xFF (128 passes), held at 0x8012.
  for (;;) {
    mem.write8(0x8012, regs.a);
    m.step(0x4f66, 13); // 4f63  ld (0x8012),a -- stash pass value / counter

    regs.b = 0x04;
    m.step(0x4f68, 7); // 4f66  ld b,0x04 -- 4 fill blocks

    regs.c = 0x00;
    m.step(0x4f6a, 7); // 4f68  ld c,0x00 -- running tile index

    regs.hl = 0x9000;
    m.step(0x4f6d, 10); // 4f6a  ld hl,0x9000 -- video RAM

    regs.de = 0x8800;
    m.step(0x4f70, 10); // 4f6d  ld de,0x8800 -- colour RAM

    // loc_4f70: fill 1024 bytes. Both back-edges target 0x4f70: `jr nz` loops the
    // 256-byte C sweep; `djnz` repeats it for each of B=4 blocks.
    for (;;) {
      mem.write8(regs.hl, regs.c);
      m.step(0x4f71, 7); // 4f70  ld (hl),c -- VRAM tile = running index

      mem.write8(regs.de, regs.a);
      m.step(0x4f72, 7); // 4f71  ld (de),a -- colour RAM = pass value

      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x4f73, 6); // 4f72  inc hl

      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x4f74, 6); // 4f73  inc de

      regs.c = regs.inc8(regs.c);
      m.step(0x4f75, 4); // 4f74  inc c -- Z set when it wraps 0xff->0x00

      // 4f75  jr nz,0x4f70 -- loop the C sweep while C != 0 (256 bytes)
      if (regs.fNZ) {
        m.step(0x4f70, 12); // jr nz taken
        continue;
      }
      m.step(0x4f77, 7); // jr nz NOT taken (C wrapped) -> djnz

      // 4f77  djnz 0x4f70 -- decrement B (no flags), repeat the block while non-zero
      if (regs.djnz() !== 0) {
        m.step(0x4f70, 13); // djnz taken
        continue;
      }
      m.step(0x4f79, 8); // djnz NOT taken -> fill complete
      break;
    }

    regs.a = 0x78;
    m.step(0x4f7b, 7); // 4f79  ld a,0x78
    m.push16(0x4f7e);
    m.step(0x4bff, 17); // 4f7b  call 0x4bff (A=0x78)
    m.call(0x4bff);

    regs.a = mem.read8(0x8012);
    m.step(0x4f81, 13); // 4f7e  ld a,(0x8012) -- reload the pass value

    regs.a = regs.inc8(regs.a);
    m.step(0x4f82, 4); // 4f81  inc a -- Z set when 0xff wraps to 0x00

    // 4f82  jr nz,0x4f63 -- next pass while non-zero (0x80..0xFF), else fall to the tail-jump
    if (regs.fNZ) {
      m.step(0x4f63, 12); // jr nz taken
      continue;
    }
    m.step(0x4f84, 7); // jr nz NOT taken -> done
    break;
  }

  // 4f84  jp 0x03ac -- unconditional TAIL-jump; loc_03ac's ret returns to OUR caller
  m.step(0x03ac, 10);
  return m.call(0x03ac);
}
