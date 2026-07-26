// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2fb7  (ROM 0x2fb7-0x2fbf, The Pit) -- a 6-byte column blit: copies B bytes
 * from the source table at IX (post-incrementing) into the tilemap at HL, stepping
 * the destination up one tile-row (-0x20 = DE) per byte, then falls through into
 * loc_2fc0.
 *
 *   2fb7  dd 7e 00     ld   a,(ix+0x00)   ; source byte
 *   2fba  77           ld   (hl),a        ; store into the tilemap cell
 *   2fbb  19           add  hl,de         ; step dest by DE (-0x20 -> one row up)
 *   2fbc  dd 23        inc  ix            ; advance source pointer
 *   2fbe  10 f7        djnz 0x2fb7        ; loop while B != 0
 *   ----                                    (falls through into loc_2fc0)
 *
 * Entered by fall-through from 0x2fb5 (`ld b,0x06`) with IX=(0x80e1) (a pointer
 * into the 0x3048 column table), HL=0x938c (top cell of a video-RAM column), and
 * DE=0xffe0. The loop is a `djnz` count: B bytes are copied and B is the only loop
 * variable, so this is modelled as `for(;;)` with `regs.djnz()` (which touches NO
 * flags -- that is why it is not dec8) deciding continuation AFTER the body. B=0 on
 * entry would wrap to 256 iterations, faithful to the ROM.
 *
 * CONTROL-FLOW EXIT. There is no `ret` and no `jp` here: when B reaches 0 the djnz
 * is not taken and execution FALLS THROUGH into loc_2fc0, which is a distinct
 * routine boundary (it is also the target of `jr c,0x2fc0` at 0x2f9c). Per the
 * translation convention a routine stops at the next externally-entered label and
 * DELEGATES: `return m.call(0x2fc0)`. loc_2fc0's own `ret` then returns to OUR
 * caller, exactly as the fall-through demands. This routine therefore issues no
 * m.ret of its own (a trailing ret would double-pop) and pushes nothing. The djnz's
 * not-taken step already lands PC on 0x2fc0, so the delegation adds no extra m.step.
 *
 * Role is best-effort from the code; the addresses, flags, cycle costs and control
 * flow are exact, one JS statement per Z80 instruction. Tilemap stores (0x9000-
 * 0x93ff) are plain writes -- only 0xb000-0xb007/0xb800 are hardware-write bus
 * cycles, so no write-timing offset is needed here.
 */
export function loc_2fb7(m) {
  const { regs, mem } = m;

  // loc_2fb7: copy B bytes (IX)++ -> (HL), stepping HL by DE each pass.
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x2fba, 19); // 2fb7  ld a,(ix+0x00) -- source byte

    mem.write8(regs.hl, regs.a);
    m.step(0x2fbb, 7); // 2fba  ld (hl),a -- store into the tilemap cell

    regs.addHl(regs.de);
    m.step(0x2fbc, 11); // 2fbb  add hl,de -- step dest up one tile-row (-0x20)

    regs.ix = (regs.ix + 1) & 0xffff;
    m.step(0x2fbe, 10); // 2fbc  inc ix -- advance source pointer

    // 2fbe  djnz 0x2fb7 -- decrement B (no flags), loop while non-zero
    if (regs.djnz() !== 0) {
      m.step(0x2fb7, 13); // djnz taken -> back to the loop top
    } else {
      m.step(0x2fc0, 8); // djnz not taken -> fall through into loc_2fc0
      break;
    }
  }

  // Fall-through into loc_2fc0 (a distinct routine boundary): delegate so loc_2fc0's
  // ret returns to OUR caller. No trailing m.ret -- this routine has none of its own.
  return m.call(0x2fc0);
}
