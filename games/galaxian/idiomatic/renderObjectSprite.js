// SPDX-License-Identifier: GPL-3.0-only
//
// renderObjectSprite -- ROM 0x0c20, grounding [seen].
//
// WHAT IT IS
//   Builds one hardware sprite record (Y, attr, sprite#, X) at IY from the object struct at IX. This is
//   the per-record worker; stageObjectsToSpriteShadow (0x0bbe) runs it across eight consecutive objects
//   each frame to stage the whole diving swarm onto the sprite hardware.
//
// ROLE IN THE MACHINE
//   Three cases, keyed on the object's two active flags:
//     primary active (byte0 bit0)   -> copy position and fold the signed heading into a display attr.
//     secondary active (byte1 bit0) -> a fixed sprite# 7 and the record's alternate attr.
//     both flags clear              -> park the sprite off-screen at (248, 248).
//   Position mapping: screen X = objX - 8, screen Y = one's-complement(objY) - yOffset (the band offset
//   the caller passes in C). Byte stores wrap mod 256, matching the Z80's 8-bit sprite coordinates.
//
// HEADING FOLD
//   The object's heading (ix+5) is a signed angle. foldAngle() reduces it into a small window by whole
//   24-count sectors, then maps the settled value to a display attribute (the facing/flip bits live in
//   the high bits) added to the record's attribute base (ix+0f), with a one-pixel nudge on the diagonal
//   facings so the sprite lines up with the tile grid.
//
// LIVE-OUT: the four bytes of the sprite record at IY (SPR_Y/SPR_ATTR/SPR_NO/SPR_X).

// Object-struct fields read (base IX).
const OBJ_ACTIVE = 0x00;      // bit 0: primary active flag
const OBJ_ACTIVE2 = 0x01;     // bit 0: secondary active flag
const OBJ_X = 0x03;
const OBJ_Y = 0x04;
const OBJ_ANGLE = 0x05;       // signed heading, folded to a display attr
const OBJ_ATTR_BASE = 0x0f;   // added into the folded attr
const OBJ_ALT_ATTR = 0x12;    // fixed attr for the secondary-active case
const OBJ_SPRITE_NO = 0x16;

// Hardware sprite record written (base IY).
const SPR_Y = 0x00;
const SPR_ATTR = 0x01;
const SPR_NO = 0x02;
const SPR_X = 0x03;

const OFF_SCREEN = 248;
const FULL_TURN = 24;         // one heading sector; folding rotates by whole sectors

export function renderObjectSprite(m, obj = m.regs.ix, sprite = m.regs.iy, yOffset = m.regs.c) {
  const { mem8 } = m;

  if (mem8[obj + OBJ_ACTIVE] & 0x01) {
    // Active: sprite# from the record, position copied, angle folded into the attr.
    mem8[sprite + SPR_NO] = mem8[obj + OBJ_SPRITE_NO];
    copyPosition(mem8, obj, sprite, yOffset);
    foldAngle(mem8, obj, sprite);
    return;
  }

  if (mem8[obj + OBJ_ACTIVE2] & 0x01) {
    // Secondary-active: fixed sprite# 7 and the record's fixed attr.
    mem8[sprite + SPR_NO] = 7;
    copyPosition(mem8, obj, sprite, yOffset);
    mem8[sprite + SPR_ATTR] = mem8[obj + OBJ_ALT_ATTR];
    return;
  }

  // Both flags clear: park the sprite off-screen.
  mem8[sprite + SPR_X] = OFF_SCREEN;
  mem8[sprite + SPR_Y] = OFF_SCREEN;
}

// X = objX - 8; Y = complement(objY) - yOffset. Byte stores wrap.
function copyPosition(mem8, obj, sprite, yOffset) {
  mem8[sprite + SPR_X] = mem8[obj + OBJ_X] - 8;
  mem8[sprite + SPR_Y] = 255 - mem8[obj + OBJ_Y] - yOffset;
}

// Fold the signed angle into [-12, +11] by whole sectors, then map the settled value to a display
// attr (facing flag in the high bits) plus a one-pixel nudge on the diagonal cases.
function foldAngle(mem8, obj, sprite) {
  // Read the record's attribute base (added into whatever the fold produces) and the raw signed heading.
  const attrBase = mem8[obj + OBJ_ATTR_BASE];
  let a = mem8[obj + OBJ_ANGLE];

  // Reduce the angle by whole 24-count sectors until it lands in the small forward (+0..+11) or backward
  // (-12..-1) window, then convert that settled value to a facing attr. Values 0..127 read as "forward"
  // (positive heading), 128..255 as "backward" (negative); each pass rotates one sector and retries.
  for (;;) {
    if (a < 128) {
      if (a < 6) {                              // +0..+5
        // Near-straight forward: set the facing bits (0xc0) and nudge one pixel on both axes (diagonal).
        a = ((a + 17) & 0xff) | 0xc0;
        mem8[sprite + SPR_ATTR] = a + attrBase;
        mem8[sprite + SPR_X] = mem8[sprite + SPR_X] + 1;
        mem8[sprite + SPR_Y] = mem8[sprite + SPR_Y] + 1;
        return;
      }
      if (a < 12) {                             // +6..+11
        // Steeper forward: mirror the angle (255 - a) into the 0x80 facing and nudge one pixel in Y.
        a = ((255 - a + 30) & 0xff) | 0x80;
        mem8[sprite + SPR_ATTR] = a + attrBase;
        mem8[sprite + SPR_Y] = mem8[sprite + SPR_Y] + 1;
        return;
      }
      // Beyond +11: rotate back by one whole sector and retry until the heading lands in range.
      a = (a - FULL_TURN) & 0xff;               // still too far forward
      continue;
    }
    if (a >= 250) {                             // -6..-1
      // Near-straight backward: 0x40 facing bit and a one-pixel X nudge only.
      a = ((255 - a + 18) & 0xff) | 0x40;
      mem8[sprite + SPR_ATTR] = a + attrBase;
      mem8[sprite + SPR_X] = mem8[sprite + SPR_X] + 1;
      return;
    }
    if (a >= 244) {                             // -12..-7
      // Steeper backward: settle the attr with no high facing bits and no pixel nudge.
      a = (a + 29) & 0xff;
      mem8[sprite + SPR_ATTR] = a + attrBase;
      return;
    }
    // Below -12 (still large-positive in two's complement): rotate forward one sector and retry.
    a = (a + FULL_TURN) & 0xff;                 // still too far back
  }
}
