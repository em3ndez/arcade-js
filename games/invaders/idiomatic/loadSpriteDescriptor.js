// SPDX-License-Identifier: GPL-3.0-only

/**
 * loadSpriteDescriptor — decode a five-byte object descriptor into registers.
 *
 * WHAT IT IS
 *   The shared decoder for the game's five-byte object descriptors. Reading forward from the pointer
 *   in HL it takes, in order: a two-byte graphics pointer (low then high -> DE), a coordinate byte
 *   (-> A), and two more bytes (-> C then B). It then repoints HL at the composite address C:A
 *   (C high, A low). So after the call DE holds the sprite's bitmap pointer, A/C/B hold the descriptor
 *   fields, and HL points at the object's coordinate word C:A.
 *
 * ROLE IN THE MACHINE
 *   Wrapped by every routine that reads a fixed descriptor cell: loadPlayerShotDescriptor (0x0430)
 *   over the player-shot descriptor, resolveSpriteScreenAddr (0x0742) over 0x2087, and the alien-shot
 *   entries drawAlienShotWithCollision (0x066c) / eraseAlienShot (0x0675). Reads five bytes at HL;
 *   pure register transform, touches no game state.
 *
 * ROM 0x1a3b.  Grounding: [seen].
 *
 * LIVE-OUT: HL = C:A (coordinate word), DE = D:E (graphics pointer), A = coord byte, B and C = the
 *   two trailing descriptor bytes. The seam completes the ret.
 */
export function loadSpriteDescriptor(m, hl = m.regs.hl) {
  // Bytes 0-1: the graphics/bitmap pointer, stored little-endian (low byte first -> E, high -> D).
  const e = m.mem8[hl];
  const d = m.mem8[hl + 1];
  // Byte 2: the coordinate byte (becomes A, and the low half of the returned C:A pointer).
  const a = m.mem8[hl + 2];
  // Bytes 3-4: two trailing descriptor fields into C then B (C also becomes the high half of C:A).
  const c = m.mem8[hl + 3];
  const b = m.mem8[hl + 4];
  // Publish: HL := C:A (coordinate word), DE := D:E (graphics pointer), A/B/C as decoded.
  return [m.regs.hl = (c << 8) | a, m.regs.de = (d << 8) | e, m.regs.a = a, m.regs.b = b, m.regs.c = c];
}
