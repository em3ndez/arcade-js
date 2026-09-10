![Galaxian](galaxian.jpg)

# RAM Usage

Work RAM lives at `0x4000`–`0x43FF`. Each name below describes the cell by its role in
the running game; the hex address is the stable identity. Cells that share a byte, or
whose role is only partly pinned, carry a terse caveat.

>>> memory

| Address | Name | Description |
| --- | --- | --- |
| 4005 | gameState | game state index (cleared by the fill re-seed) |
| 400a | sequenceState | top-level sequence state-machine step index |
| 400b | vramWritePtr | 16-bit VRAM fill write cursor |
| 400d | currentPlayer | active player index (0/1) |
| 4010 | in0Shadow | batch 2 |
| 4011 | in1Shadow | batch 2 |
| 4012 | in2Shadow | IN2 input shadow |
| 401a | selftestMode | power-on self-test mode; nonzero routes the vblank NMI to the self-test path (3->1->2->0 then normal) |
| 401e | rngSeed | 8-bit LCG PRNG seed |
| 4020 | objramShadowBase | work-RAM OBJRAM shadow, block-copied to OBJRAM_HW_BASE each vblank |
| 4054 | objStageBlock | batch 2 |
| 4060 | spriteShadowBase | base of the sprite staging/shadow area (4-byte records) |
| 40a1 | displayListCursor | display-list read cursor (low byte of a page-0x40 pointer): next ready draw-command slot, +2 per slot, wraps to 0xc0 |
| 40a2 | player1ScoreBcd | player-1 packed-BCD score (3 bytes) |
| 40a5 | player2ScoreBcd | player-2 packed-BCD score (3 bytes) |
| 40a8 | highScoreBcd | high-score packed-BCD score (3 bytes) |
| 40ad | player1BonusMarkerAwarded | player-1 bonus-marker one-shot flag; base of the per-player bonus-marker table |
| 40ae | player2BonusMarkerAwarded | player-2 bonus-marker one-shot flag; per-player bonus-marker table slot 1 |
| 40b0 | messageScrollEnable | message-scroller enable/countdown flag |
| 40b1 | messageCursorPtr | batch 2 |
| 40b3 | messageTextPtr | batch 2 |
| 40b5 | messageDestPtr | batch 2 |
| 4100 | flagBitsBase | batch 2 |
| 4120 | objectGridBase | base of the 6-row object/occupancy grid (row stride 0x10; occupancy cells at +3) |
| 4123 | occupancyGrid | batch 2 |
| 4165 | secondaryTriggerBlock | secondary spawn trigger-flag block (primary index remapped -17) |
| 4176 | primaryTriggerBlock | primary spawn trigger-flag block (4 flags, 0x4176..0x4179) |
| 4180 | packedFlagBitmap | 16-byte packed bitmap (bit-per-flag) destination |
| 41a0 | savedStateSnapshot | base of a 32-byte saved-state block |
| 41c1 | soundPitch | staged sound pitch value (fed to 0x7800) |
| 41cd | soundSeqActive | sound-sequence active flag |
| 41ce | soundToneDuration | sound tone duration |
| 41d0 | soundLfoResetRequest | sound LFO reset-request flag |
| 41d3 | soundSeqPtr | sound-sequence 16-bit pointer |
| 41e8 | rowOccupancy | batch 2 |
| 41f0 | columnOccupancy | batch 2 |
| 4200 | objActiveFlag | batch 2 |
| 4204 | hitEventFlag | batch 2 |
| 420d | objSweepDirection | object sweep direction flag (0=ascending, 1=descending) |
| 4210 | formationXBounds | batch 2 |
| 421c | coinCreditRowCount | coin/credit icon-tally count (drawn value = count+1, clamped) |
| 421f | soundLfoLevel | sound LFO level shadow |
| 4228 | subcounterRefillFlag | one-shot flag set when a sub-counter refilled this pass |
| 4229 | delayedEventRequest | batch 2 |
| 422a | activeNeighborCount | count of active neighbouring object slots |
| 422e | delayedEventArmed | batch 2 |
| 422f | delayedEventTimer | batch 2 |
| 4238 | objectDrawSuppress | bit0 set suppresses the object-figure grid draw (during VRAM fills/resets); cleared for the figure screen |
| 423f | objMoveCmd | batch 2 |
| 4241 | drawnColumnCount | running count of tile-columns queued to redraw |
| 425f | frameCounter | free-running per-frame counter, decremented once/frame by the VBLANK-NMI; low nibble drives the object-grid draw phase |
| 42b0 | spriteSourceObjBase | base of 8 object records read as sprite sources (32-byte stride) |
| 42d0 | objTable | batch 2 |
| 4330 | descriptorSlotTable | batch 2 |
