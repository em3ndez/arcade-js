// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/*
 * The HL-twin of handler_05c6: clears the payload-selected 3-byte BCD slot,
 * then TAIL-JUMPS to handler_05c6 to render.
 *
 * The payload>=3 branch (jp nc,0x05BD) is a recursive "clear all lower slots"
 * loop. As with the twin handler_05c6 -- which THROWS on its analogous
 * high-payload branch rather than translate unexercised recursion -- this stubs
 * it with NotImplemented. The payload<3 path (the common one) is fully
 * translated.
 */
/**
 * loc_059b  (ROM 0x059B–0x05C5) — clear a BCD slot, then render via handler_05c6.
 *
 *   059b  fe 03        cp   0x03
 *   059d  d2 bd 05     jp   nc,0x05bd     ; payload >= 3 -> recursion (STUBBED)
 *   05a0  f5           push af            ; preserve payload across the clear
 *   05a1  21 b2 60     ld   hl,0x60b2
 *   05a4  a7           and  a             ; Z iff payload == 0
 *   05a5  ca ab 05     jp   z,0x05ab      ; ==0 keep 0x60B2
 *   05a8  21 b5 60     ld   hl,0x60b5     ; else 0x60B5
 *   05ab  fe 02        cp   0x02
 *   05ad  c2 b3 05     jp   nz,0x05b3     ; !=2 keep current
 *   05b0  21 b8 60     ld   hl,0x60b8     ; ==2 -> 0x60B8
 *   05b3  af           xor  a             ; loc_05b3: clear the 3-byte slot
 *   05b4  77           ld   (hl),a
 *   05b5  23           inc  hl
 *   05b6  77           ld   (hl),a
 *   05b7  23           inc  hl
 *   05b8  77           ld   (hl),a
 *   05b9  f1           pop  af            ; restore payload
 *   05ba  c3 c6 05     jp   0x05c6        ; TAIL jump into handler_05c6
 */
export function loc_059b(m) {
  const { regs, mem } = m;

  regs.cp(0x03);
  m.step(0x059d, 7); // cp 0x03
  if (regs.fNC) {
    m.step(0x05bd, 10); // jp nc,0x05bd -- payload >= 3
    throw new NotImplemented(
      "loc_059b payload>=3 recursion at ROM 0x05BD (twin-consistent stub; see the header)",
    );
  }
  m.step(0x05a0, 10); // jp nc not taken

  m.push16(regs.af); // push af (0x05A0) -- preserve payload across the clear
  m.step(0x05a1, 11);
  regs.hl = 0x60b2;
  m.step(0x05a4, 10); // ld hl,0x60b2
  regs.and(regs.a); // and a -- Z iff payload == 0
  m.step(0x05a5, 4);
  if (regs.fZ) {
    m.step(0x05ab, 10); // jp z,0x05ab -- keep 0x60B2
  } else {
    m.step(0x05a8, 10); // jp z not taken
    regs.hl = 0x60b5;
    m.step(0x05ab, 10); // ld hl,0x60b5
  }
  regs.cp(0x02);
  m.step(0x05ad, 7); // cp 0x02
  if (regs.fNZ) {
    m.step(0x05b3, 10); // jp nz,0x05b3 -- keep current
  } else {
    m.step(0x05b0, 10); // jp nz not taken
    regs.hl = 0x60b8;
    m.step(0x05b3, 10); // ld hl,0x60b8
  }

  // -- loc_05b3: clear the selected 3-byte slot --
  regs.xor(regs.a); // A = 0
  m.step(0x05b4, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x05b5, 7); // ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x05b6, 6); // inc hl
  mem.write8(regs.hl, regs.a);
  m.step(0x05b7, 7); // ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x05b8, 6); // inc hl
  mem.write8(regs.hl, regs.a);
  m.step(0x05b9, 7); // ld (hl),a
  regs.af = m.pop16(); // pop af (0x05B9) -- restore payload for handler_05c6
  m.step(0x05ba, 10);

  m.step(0x05c6, 10); // jp 0x05c6 -- TAIL jump, nothing pushed
  return m.call(0x05c6); // its ret returns on our behalf
}
