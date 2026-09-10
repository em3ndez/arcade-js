![Galaxian](galaxian.jpg)

# Galaxian

>>> cpu Z80

>>> binary 0000:roms/galmidw.u + roms/galmidw.v + roms/galmidw.w + roms/galmidw.y + roms/7l

>>> memoryTable hard

[Hardware Info](Hardware.md)

>>> memoryTable ram

[RAM Usage](RAMUse.md)

```code
; Galaxian (Namco, 1979).
;
; Architecture: on reset ($0000) the CPU jumps to loc_1a55 ($1A55). What
; follows is the code reached from the reset and interrupt entry points, shown
; as instructions; spans never reached appear as data (the "---- data ----"
; blocks).


loc_0000:
0000: AF              XOR     A                   ; clear A to zero for the reset write
0001: 32 01 70        LD      ($7001),A           ; clear the interrupt-enable latch so no vblank fires during boot
0004: C3 55 1A        JP      $1A55               ; {code.loc_1a55} jump into the cold-boot memory wipe

; ---- $0007-$0007: data ----
0007: FF

loc_0008:
0008: 3A 07 40        LD      A,($4007)           ; {hard.workRam+7} read the demo/attract-enable flag
000B: 0F              RRCA                        ; rotate its bit 0 into carry
000C: D0              RET     NC                  ; flag clear -- plain return to the caller
000D: 33              INC     SP                  ; flag set -- bump the stack pointer to drop the return address
000E: 33              INC     SP                  ; drop the second byte of the return address
000F: C9              RET                         ; return past the caller's next step -- a conditional skip

; RST-10 memory-fill primitive: store A into `count` bytes from HL,
; advancing HL (count 0 wraps to a 256-byte fill); leaves HL past the fill
; and B=0
fillMemoryBlock:
0010: 77              LD      (HL),A              ; store the fill byte into the cell the pointer names
0011: 23              INC     HL                  ; step the write pointer forward one cell
0012: 10 FC           DJNZ    $0010               ; {code.fillMemoryBlock} loop until the byte count runs out
0014: C9              RET                         ; block filled -- return

; ---- $0015-$001F: data ----
0015: FF 9F FF 77 23 10 FC 0D 20 F9 C9

; RST-20 indexed table fetch: HL = HL + A (carry into the high byte), then
; A = (HL); returns the fetched byte and the advanced pointer
fetchIndexedTableByte:
0020: 85              ADD     A,L                 ; add the table index to the low byte of the base pointer
0021: 6F              LD      L,A                 ; put the summed low byte back
0022: 3E 00           LD      A,$00               ; clear A to fold the carry in next
0024: 8C              ADC     A,H                 ; carry the index add into the high byte so it survives a page crossing
0025: 67              LD      H,A                 ; put the high byte back -- the pointer now names the n-th entry
0026: 7E              LD      A,(HL)              ; read the table byte
0027: C9              RET                         ; return the fetched byte

loc_0028:
0028: 87              ADD     A,A                 ; double the state index -- two bytes per jump-table entry
0029: E1              POP     HL                  ; pop the return address, which points at the inline jump table
002A: 5F              LD      E,A                 ; move the doubled index into E
002B: 16 00           LD      D,$00               ; clear the high byte of the index
002D: 19              ADD     HL,DE               ; point at the selected jump-table slot
002E: 5E              LD      E,(HL)              ; read the low byte of the handler address
002F: 23              INC     HL                  ; step to the high byte
0030: 56              LD      D,(HL)              ; read the high byte of the handler address
0031: EB              EX      DE,HL               ; move the handler address into HL
0032: E9              JP      (HL)                ; jump to the selected state handler

; ---- $0033-$003B: data ----
0033: FF FF FF FF FF C3 00 00 FF

; advance the 8-bit LCG PRNG seed (RNG_SEED, 0x401e) one step (seed*5+1)
; and return the new byte as this frame's random draw
advanceRandomSeed:
003C: 3A 1E 40        LD      A,($401E)           ; {hard.workRam+1E} read the current random seed
003F: 47              LD      B,A                 ; keep a copy of the seed
0040: 87              ADD     A,A                 ; seed times two
0041: 87              ADD     A,A                 ; seed times four
0042: 80              ADD     A,B                 ; add the original -- seed times five
0043: 3C              INC     A                   ; add one -- the linear-congruential step
0044: 32 1E 40        LD      ($401E),A           ; {hard.workRam+1E} store the new seed back
0047: C9              RET                         ; return it as this draw's random value

; 8-bit unsigned divide of A by D via 8 rounds of compare-subtract-shift
; (restoring divide, divisor walked down one bit per round): quotient in
; C, remainder in A, shifted divisor in D, round counter B spent to 0 --
; pure register math, no memory effect
divideUnsigned8:
0048: 0E 00           LD      C,$00               ; clear the quotient accumulator
004A: 06 08           LD      B,$08               ; eight bits to process

loc_004c:
004C: BA              CP      D                   ; compare the running remainder against the divisor
004D: 38 01           JR      C,$0050             ; {code.loc_0050} remainder too small -- skip the subtract
004F: 92              SUB     D                   ; subtract the divisor

loc_0050:
0050: 3F              CCF                         ; complement carry to form this quotient bit
0051: CB 11           RL      C                   ; shift the quotient bit into C
0053: CB 1A           RR      D                   ; shift the divisor down for the next bit
0055: 10 F5           DJNZ    $004C               ; {code.loc_004c} loop for all eight bits
0057: C9              RET                         ; quotient in C, remainder in A -- return

; ---- $0058-$0065: data ----
0058: FF FF FF FF FF FF FF FF FF FF FF FF FF 8D

loc_0066:
0066: F5              PUSH    AF                  ; save A and flags on entering the vblank interrupt
0067: C5              PUSH    BC                  ; save BC
0068: D5              PUSH    DE                  ; save DE
0069: E5              PUSH    HL                  ; save HL
006A: DD E5           PUSH    IX                  ; save IX
006C: FD E5           PUSH    IY                  ; save IY
006E: AF              XOR     A                   ; zero A
006F: 32 01 70        LD      ($7001),A           ; clear the interrupt-enable latch to acknowledge the vblank
0072: 3A 1A 40        LD      A,($401A)           ; {hard.workRam+1A} read the self-test mode flag
0075: A7              AND     A                   ; test it
0076: C2 CD 1B        JP      NZ,$1BCD            ; {code.loc_1bcd} nonzero -- divert the whole frame to the self-test path
0079: 21 20 40        LD      HL,$4020            ; source: the object-RAM shadow
007C: 11 00 58        LD      DE,$5800            ; dest: the sprite/scroll/bullet hardware
007F: 01 80 00        LD      BC,$0080            ; 128 bytes to copy
0082: ED B0           LDIR                        ; block-copy last frame's composed sprites out to hardware
0084: 3A 00 78        LD      A,($7800)           ; read the watchdog port to pet the watchdog
0087: 3A 15 40        LD      A,($4015)           ; {hard.workRam+15} read a control-history holding cell
008A: 32 16 40        LD      ($4016),A           ; {hard.workRam+16} shift it one step down the two-frame input history
008D: 3A 13 40        LD      A,($4013)           ; {hard.workRam+13} read the next history cell
0090: 32 15 40        LD      ($4015),A           ; {hard.workRam+15} shift it down the history chain
0093: 2A 10 40        LD      HL,($4010)          ; {hard.workRam+10} read the prior raw IN0/IN1 shadow pair
0096: 22 13 40        LD      ($4013),HL          ; {hard.workRam+13} copy the prior raw pair into the history chain
0099: 3A 00 70        LD      A,($7000)           ; read the IN2 input port
009C: 32 12 40        LD      ($4012),A           ; {hard.workRam+12} store it into the IN2 shadow
009F: 3A 00 68        LD      A,($6800)           ; read the IN1 input port
00A2: 32 11 40        LD      ($4011),A           ; {hard.workRam+11} store it into the IN1 shadow
00A5: 3A 00 60        LD      A,($6000)           ; read the IN0 input port
00A8: 32 10 40        LD      ($4010),A           ; {hard.workRam+10} store it into the IN0 shadow
00AB: CB 77           BIT     6,A                 ; test bit 6 -- the service/test switch
00AD: C2 00 00        JP      NZ,$0000            ; {code.loc_0000} switch set -- abandon the frame and cold-reset
00B0: 21 5F 42        LD      HL,$425F            ; point at the free-running frame counter
00B3: 35              DEC     (HL)                ; tick the frame counter down once this frame
00B4: CD EF 18        CALL    $18EF               ; {code.serviceCoinInputs} run the coin-input front-end
00B7: CD 31 19        CALL    $1931               ; {code.tickCoinMeterAndAwardCredits} pulse the coin meter and award credits
00BA: CD 7C 19        CALL    $197C               ; {code.updateCoinLockoutFromCredits} engage or release the coin lockout by credit count
00BD: CD F5 16        CALL    $16F5               ; {code.driveSoundFrame} run the sound driver's per-frame tick
00C0: CD 98 18        CALL    $1898               ; {code.driveSoundLfoLevel} drive the sound LFO level
00C3: CD C0 18        CALL    $18C0               ; {code.advanceMessageScroller} step the scrolling-text effect one glyph
00C6: 21 D8 00        LD      HL,$00D8            ; load the shared interrupt-epilogue address
00C9: E5              PUSH    HL                  ; push it as a fake return so the state handler returns through the register-restore tail
00CA: 3A 05 40        LD      A,($4005)           ; {hard.workRam+5} read the game-state index
00CD: EF              RST     $28                 ; dispatch through the five-entry game-state handler table

; ---- $00CE-$00D7: jump table ----
00CE: E6 00 56 01 F2 03 36 05 7B 07

; Vblank interrupt epilogue: write IRQ_ENABLE (0x7001)=1 to re-arm the
; next frame's interrupt, restore the six register pairs saved by the
; prologue (pop iy/ix/hl/de/bc/af), then ret through the interrupted PC
rearmVblankInterruptAndRestoreRegs:
00D8: FD E1           POP     IY                  ; restore IY on leaving the interrupt
00DA: DD E1           POP     IX                  ; restore IX
00DC: E1              POP     HL                  ; restore HL
00DD: D1              POP     DE                  ; restore DE
00DE: C1              POP     BC                  ; restore BC
00DF: 3E 01           LD      A,$01               ; value 1
00E1: 32 01 70        LD      ($7001),A           ; re-arm the interrupt-enable latch for the next frame
00E4: F1              POP     AF                  ; restore A and flags
00E5: C9              RET                         ; return from the interrupt

; Game-state-0 boot handler (dispatch slot 0 of $0066's game-state table
; {0x00e6,0x0156,0x03f2,0x0536,0x077b}): each frame fills a 32-byte VRAM
; tilemap block at the write cursor (0x400b/0x400c) with the blank tile
; and advances the cursor across 0x5000-0x53ff while per-state timer
; 0x4008 counts down; on expiry resets the state cluster (0x4006=0,
; 0x4007=1, GAME_STATE 0x4005=1, SEQUENCE_STATE 0x400a=0), latches config
; bits from the input/DIP shadows into 0x4000/0x401f/0x400f and a coinage-
; table byte into 0x40ac, unpacks the packed flag bitmask, seeds the
; object shadow and the player-1 status glyphs, and enqueues two deferred
; command words.
fillScreenThenLatchConfigAndAdvanceState:
00E6: 2A 0B 40        LD      HL,($400B)          ; {hard.workRam+B} load the VRAM fill write cursor
00E9: 06 20           LD      B,$20               ; 32 cells this frame
00EB: 3E 10           LD      A,$10               ; the blank tile, value 16
00ED: D7              RST     $10                 ; fill a 32-cell block with the blank tile
00EE: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} store the advanced cursor back
00F1: 21 08 40        LD      HL,$4008            ; point at the boot sub-timer
00F4: 35              DEC     (HL)                ; tick it down
00F5: C0              RET     NZ                  ; still counting -- nothing more this frame
00F6: 2D              DEC     L                   ; step down to the demo-enable cell
00F7: 36 01           LD      (HL),$01            ; set the demo-enable flag to 1
00F9: 2D              DEC     L                   ; step down to the mode cell
00FA: 36 00           LD      (HL),$00            ; clear the mode flag
00FC: 2D              DEC     L                   ; step down to the game-state index
00FD: 36 01           LD      (HL),$01            ; set game state to 1 -- enter attract next frame
00FF: AF              XOR     A                   ; zero A
0100: 32 0A 40        LD      ($400A),A           ; {hard.workRam+A} clear the sequence-state index
0103: 3A 11 40        LD      A,($4011)           ; {hard.workRam+11} read the IN1 shadow (DIP bits)
0106: 07              RLCA                        ; rotate the top coinage bits down
0107: 07              RLCA                        ; second rotate
0108: E6 03           AND     $03                 ; keep the two coinage-mode bits
010A: 32 00 40        LD      ($4000),A           ; {hard.workRam} store the coinage mode
010D: 3A 12 40        LD      A,($4012)           ; {hard.workRam+12} read the IN2 shadow
0110: E6 04           AND     $04                 ; isolate the config bit
0112: 0F              RRCA                        ; rotate it into place
0113: 0F              RRCA                        ; second rotate
0114: 32 1F 40        LD      ($401F),A           ; {hard.workRam+1F} store the config bit
0117: 11 1B 05        LD      DE,$051B            ; source: the packed 16-byte flag bitmask
011A: CD 46 06        CALL    $0646               ; {code.unpackBitmaskToFlagBytes} unpack the bitmask into the 128-byte flag block
011D: 3A 10 40        LD      A,($4010)           ; {hard.workRam+10} read the IN0 shadow
0120: E6 20           AND     $20                 ; isolate the screen-flip/cabinet bit
0122: 07              RLCA                        ; shift it into place
0123: 07              RLCA                        ; shift again
0124: 07              RLCA                        ; shift again
0125: 32 0F 40        LD      ($400F),A           ; {hard.workRam+F} store the cabinet/flip bit
0128: 3A 00 70        LD      A,($7000)           ; read the IN2 input port
012B: E6 03           AND     $03                 ; keep the low two bits as a coinage index
012D: 21 52 01        LD      HL,$0152            ; point at the coinage table in ROM
0130: E7              RST     $20                 ; fetch the coinage-table byte by that index
0131: 32 AC 40        LD      ($40AC),A           ; {hard.workRam+AC} store the selected coinage byte
0134: CD 95 05        CALL    $0595               ; {code.seedObjectShadowFromRom} seed the object shadow
0137: 3E 01           LD      A,$01               ; value 1
0139: 32 40 53        LD      ($5340),A           ; write the player-1 status glyph cell
013C: 3E 25           LD      A,$25               ; glyph value 0x25
013E: 32 20 53        LD      ($5320),A           ; write a status tile
0141: 3E 20           LD      A,$20               ; glyph value 0x20
0143: 32 00 53        LD      ($5300),A           ; write a status tile
0146: 11 04 06        LD      DE,$0604            ; a deferred command word
0149: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue it on the command ring
014C: 11 03 05        LD      DE,$0503            ; a second deferred command word
014F: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue it and return

; ---- $0152-$0155: data ----
0152: 07 10 12 20

; Attract/demo game-state handler (game-state 1): run the per-frame
; formation prep, dispatch on SEQUENCE_STATE (0x400a) to the current
; attract sub-state handler (title/starfield/message-column/canned-demo),
; then tail-run advanceGameStateOnCredit to leave attract for the press-
; start screen once a credit is present.
runAttractSequenceAndAdvanceOnCredit:
0156: CD 0D 09        CALL    $090D               ; {code.advanceFormationSweepOscillator} run the formation-sweep oscillator prep
0159: CD 8E 09        CALL    $098E               ; {code.summarizeFormationOccupancy} summarize formation occupancy into row/column tables
015C: 21 D7 03        LD      HL,$03D7            ; load the attract-tail return address
015F: E5              PUSH    HL                  ; push it so the sub-state returns through the credit hand-off
0160: 3A 0A 40        LD      A,($400A)           ; {hard.workRam+A} read the sequence-state index
0163: EF              RST     $28                 ; dispatch to the matching attract sub-state

; ---- $0164-$018B: jump table ----
0164: 8C 01 BE 01 C6 01 E1 01 18 02 3F 02 67 02 8E 02
0174: C6 01 9D 02 D1 02 2E 03 E8 02 FD 02 14 06 61 06
0184: D8 06 2E 03 22 03 00 00

; runAttractSequenceAndAdvanceOnCredit sequence sub-state 0 setup: enqueue
; two setup command words, enable the starfield (STARS_ENABLE 0x7004) and
; set 0x4007, reset per-sequence cells (CURRENT_PLAYER 0x400d, 0x400e,
; 0x4006, 0x4019), seed the dwell cascade (0x4008=96, 0x4009=16), and
; advance SEQUENCE_STATE (0x400a).
initSequenceEnableStarfield:
018C: 11 01 07        LD      DE,$0701            ; a deferred command word
018F: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue it
0192: 11 00 06        LD      DE,$0600            ; a second command word
0195: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue it
0198: 3E 01           LD      A,$01               ; value 1
019A: 32 07 40        LD      ($4007),A           ; {hard.workRam+7} set the demo-enable flag
019D: 32 04 70        LD      ($7004),A           ; turn the starfield on
01A0: 32 02 70        LD      ($7002),A           ; set a 0x7000-block control latch
01A3: 32 03 70        LD      ($7003),A           ; set another 0x7000-block control latch
01A6: 21 0A 40        LD      HL,$400A            ; point at the sequence-state index
01A9: 34              INC     (HL)                ; advance to the next attract sub-state
01AA: AF              XOR     A                   ; zero A
01AB: 32 19 40        LD      ($4019),A           ; {hard.workRam+19} clear the per-step one-shot countdown
01AE: 32 0D 40        LD      ($400D),A           ; {hard.workRam+D} clear the active-player index
01B1: 32 0E 40        LD      ($400E),A           ; {hard.workRam+E} clear a mode cell
01B4: 32 06 40        LD      ($4006),A           ; {hard.workRam+6} clear the mode/sound flag
01B7: 21 60 10        LD      HL,$1060            ; dwell-cascade reload value
01BA: 22 08 40        LD      ($4008),HL          ; {hard.workRam+8} seed the dwell cascade (sub-timer and dwell tier)
01BD: C9              RET                         ; return

; runAttractSequenceAndAdvanceOnCredit sub-state 1: arm countdown cell
; 0x4019=1, then tick the prescaled sequence timer
; (tickPrescaledSequenceTimer). 0x4019 is decremented by
; holdStartLampsThenAdvanceSequence, which advances SEQUENCE_STATE and
; clears the 0x4100 flag block on its expiry
armStepCountdownAndTickSequenceTimer:
01BE: 3E 01           LD      A,$01               ; value 1
01C0: 32 19 40        LD      ($4019),A           ; {hard.workRam+19} arm the per-step one-shot countdown
01C3: C3 36 03        JP      $0336               ; {code.tickPrescaledSequenceTimer} jump into the shared sub-state tail

; Attract sequence-step setup: clears the 0x4100 flag-bits block (via
; rst-0x10) plus status bytes 0x425f/0x4224, seeds VRAM_WRITE_PTR
; (0x400b)=VRAM_BASE+2, arms the 0x4009 dwell tier to 32, and increments
; SEQUENCE_STATE (0x400a).
primeVramFillAndAdvanceStep:
01C6: 21 00 41        LD      HL,$4100            ; point at the 128-byte flag block
01C9: 06 80           LD      B,$80               ; 128 cells
01CB: AF              XOR     A                   ; fill byte zero
01CC: D7              RST     $10                 ; clear the whole flag block
01CD: 32 5F 42        LD      ($425F),A           ; {hard.workRam+25F} zero the frame counter
01D0: 32 24 42        LD      ($4224),A           ; {hard.workRam+224} clear an activity gate
01D3: 21 02 50        LD      HL,$5002            ; VRAM cursor start
01D6: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} seat the VRAM fill cursor
01D9: 21 09 40        LD      HL,$4009            ; point at the dwell tier
01DC: 36 20           LD      (HL),$20            ; arm the dwell tier to 32
01DE: 2C              INC     L                   ; step up to the sequence-state index
01DF: 34              INC     (HL)                ; advance the sequence state
01E0: C9              RET                         ; return

; runAttractSequenceAndAdvanceOnCredit sequence sub-state 3 (rst-28 table
; @0x0164): each frame fills a 28-cell strip of tile 16 at VRAM_WRITE_PTR
; (0x400b) and advances the cursor +32 (one row); ticks dwell tier 0x4009;
; on its expiry increments SEQUENCE_STATE (0x400a), re-arms the dwell
; cascade (0x4008=64, 0x4009=4), clears the 48-byte OBJ_ACTIVE_FLAG block,
; clears FLIP_SCREEN_X/Y and 0x4018, sets 0x4238=1, and reseeds the
; object-shadow field from ROM template 0x1db1.
fillVramRowThenResetObjectState:
01E1: 2A 0B 40        LD      HL,($400B)          ; {hard.workRam+B} load the VRAM fill cursor
01E4: 06 1C           LD      B,$1C               ; 28 cells
01E6: 3E 10           LD      A,$10               ; the blank tile
01E8: D7              RST     $10                 ; fill 28 cells with the blank tile
01E9: 11 04 00        LD      DE,$0004            ; a 4-cell margin
01EC: 19              ADD     HL,DE               ; advance the cursor past the margin
01ED: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} store the cursor back
01F0: 21 09 40        LD      HL,$4009            ; point at the dwell tier
01F3: 35              DEC     (HL)                ; tick it down
01F4: C0              RET     NZ                  ; still filling rows -- return
01F5: 2C              INC     L                   ; step to the sequence-state index
01F6: 34              INC     (HL)                ; advance the sequence state
01F7: 21 40 04        LD      HL,$0440            ; dwell-cascade reload value
01FA: 22 08 40        LD      ($4008),HL          ; {hard.workRam+8} reseed the dwell cascade
01FD: AF              XOR     A                   ; fill byte zero
01FE: 06 30           LD      B,$30               ; 48 cells
0200: 21 00 42        LD      HL,$4200            ; point at the object-record region
0203: D7              RST     $10                 ; clear 48 object-record bytes
0204: 32 06 70        LD      ($7006),A           ; clear the screen-flip X latch
0207: 32 07 70        LD      ($7007),A           ; clear the screen-flip Y latch
020A: 32 18 40        LD      ($4018),A           ; {hard.workRam+18} clear the orientation flag
020D: 3E 01           LD      A,$01               ; value 1
020F: 32 38 42        LD      ($4238),A           ; {hard.workRam+238} set the object-draw suppress flag
0212: 21 B1 1D        LD      HL,$1DB1            ; the object-shadow reseed template
0215: C3 98 05        JP      $0598               ; {code.seedObjectRamShadowField} reseed the object shadow and return

; runAttractSequenceAndAdvanceOnCredit sequence-state handler (rst-28
; dispatch table @0x0164, state 4): run clearStridedTable, then a two-tier
; dwell (prescaler 0x4008 / dwell 0x4009) — each low-tier expiry reloads
; it to 80 and enqueues a channel-6 renderMessageColumn command (index =
; mid count + 6); on mid-tier expiry advance SEQUENCE_STATE(0x400a),
; reload both tiers (32/4), clear SPRITE_SOURCE_OBJ_BASE(0x42b0) and
; DRAWN_COLUMN_COUNT(0x4241).
emitMessageColumnsThenAdvanceSequence:
0218: CD 63 03        CALL    $0363               ; {code.clearStridedTable} run a shared sub-state update
021B: 21 08 40        LD      HL,$4008            ; point at the boot/dwell sub-timer
021E: 35              DEC     (HL)                ; tick it down
021F: C0              RET     NZ                  ; still counting -- return
0220: 36 50           LD      (HL),$50            ; reload the sub-timer to 0x50
0222: 2C              INC     L                   ; step up to the dwell tier
0223: 16 06           LD      D,$06               ; command channel 6
0225: 7E              LD      A,(HL)              ; read the dwell-tier value
0226: 82              ADD     A,D                 ; form the command parameter from it
0227: 5F              LD      E,A                 ; move it into E
0228: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue the command word
022B: 35              DEC     (HL)                ; tick the dwell tier down
022C: C0              RET     NZ                  ; still counting -- return
022D: 2C              INC     L                   ; step to the sequence-state index
022E: 34              INC     (HL)                ; advance the sequence state
022F: 21 20 04        LD      HL,$0420            ; dwell-cascade reload value
0232: 22 08 40        LD      ($4008),HL          ; {hard.workRam+8} reseed the dwell cascade
0235: 21 B0 42        LD      HL,$42B0            ; point at the object-record array base
0238: AF              XOR     A                   ; fill byte zero
0239: 47              LD      B,A                 ; count zero -- fills a full 256 bytes
023A: D7              RST     $10                 ; clear the object-record array
023B: 32 41 42        LD      ($4241),A           ; {hard.workRam+241} clear the drawn-column count
023E: C9              RET                         ; return

; Sequence-state handler (rst-28 dispatch keyed on SEQUENCE_STATE): runs
; the 4 per-frame subsystem updates, then on the 0x4008 sub-timer's expiry
; activates a descriptor slot (via activateDescriptorSlot, descriptor
; number at 0x4009) and bumps DRAWN_COLUMN_COUNT, and on the 0x4009
; dwell's expiry advances SEQUENCE_STATE.
activateDescriptorSlotsThenAdvanceSequence:
023F: CD 63 03        CALL    $0363               ; {code.clearStridedTable} wipe the strided sway-coordinate table before this frame's redraw
0242: CD BE 0B        CALL    $0BBE               ; {code.stageObjectsToSpriteShadow} stage the eight object records into the sprite shadow
0245: CD C3 0C        CALL    $0CC3               ; {code.driveAllObjectSlots} run each of the eight object slots' AI for this frame
0248: CD 67 03        CALL    $0367               ; {code.redrawTileColumnsPeriodically} repaint the queued tile-columns on the frame-phase beat
024B: 21 08 40        LD      HL,$4008            ; point HL at the fast sub-timer of the dwell cascade
024E: 35              DEC     (HL)                ; tick the sub-timer down one frame
024F: C0              RET     NZ                  ; still counting -- nothing more this frame
0250: 36 D2           LD      (HL),$D2            ; sub-timer expired -- reload it to $d2
0252: 2C              INC     L                   ; step the pointer up to the descriptor-number cell
0253: CD 41 03        CALL    $0341               ; {code.activateDescriptorSlot} activate the descriptor slot named by that number
0256: EB              EX      DE,HL               ; park the descriptor pointer in DE
0257: 21 41 42        LD      HL,$4241            ; point HL at the running tile-column redraw count
025A: 34              INC     (HL)                ; bump the count of columns queued to redraw
025B: EB              EX      DE,HL               ; swap back to the dwell-cell pointer
025C: 35              DEC     (HL)                ; tick the dwell tier down one
025D: C0              RET     NZ                  ; dwell not expired -- done this frame
025E: 36 D2           LD      (HL),$D2            ; dwell expired -- reload it to $d2
0260: 2C              INC     L                   ; step up to the sequence-state index
0261: 34              INC     (HL)                ; advance the attract sequence to its next sub-state
0262: AF              XOR     A                   ; clear A to zero
0263: 32 58 40        LD      ($4058),A           ; {hard.workRam+58} clear cell $4058
0266: C9              RET                         ; return

; Sequence-state handler (rst-28 dispatch keyed on SEQUENCE_STATE): runs
; the 4 per-frame subsystem updates, then counts down the 0x4009 dwell; on
; expiry advances SEQUENCE_STATE, re-arms the 0x4008/0x4009 two-tier timer
; pair (0x40 sub / 0x11 dwell), bumps DRAWN_COLUMN_COUNT, and enqueues a
; channel-6 column-draw command word (arg 0x0f) via enqueueCommandWord.
queueColumnDrawAndAdvanceSequence:
0267: CD 63 03        CALL    $0363               ; {code.clearStridedTable} wipe the strided sway-coordinate table
026A: CD BE 0B        CALL    $0BBE               ; {code.stageObjectsToSpriteShadow} stage the object records into the sprite shadow
026D: CD C3 0C        CALL    $0CC3               ; {code.driveAllObjectSlots} run all eight object slots' AI this frame
0270: CD 67 03        CALL    $0367               ; {code.redrawTileColumnsPeriodically} repaint the queued tile-columns on the beat
0273: 21 09 40        LD      HL,$4009            ; point HL at the dwell tier
0276: 35              DEC     (HL)                ; tick the dwell down one frame
0277: C0              RET     NZ                  ; dwell not up -- nothing more
0278: 2C              INC     L                   ; step up to the sequence-state index
0279: 34              INC     (HL)                ; advance the attract sequence to its next sub-state
027A: AF              XOR     A                   ; clear A
027B: 32 58 40        LD      ($4058),A           ; {hard.workRam+58} clear cell $4058
027E: 21 40 11        LD      HL,$1140            ; load the two-tier reload pair ($40 sub / $11 dwell)
0281: 22 08 40        LD      ($4008),HL          ; {hard.workRam+8} re-arm the dwell cascade
0284: 21 41 42        LD      HL,$4241            ; point HL at the tile-column redraw count
0287: 34              INC     (HL)                ; bump the column redraw count
0288: 11 0F 06        LD      DE,$060F            ; build command word: channel 6, arg $0f (column draw)
028B: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} queue the column-draw command and return

; Sequence-state dwell handler (rst-28 dispatch target, SEQUENCE_STATE
; index 7 via runAttractSequenceAndAdvanceOnCredit table @0x0164): run the
; four shared per-frame subsystem updates (clearStridedTable,
; stageObjectsToSpriteShadow, driveObjectSlots loop 0x0cc3,
; redrawTileColumnsPeriodically), then tail-tick the prescaled sequence-
; dwell timer (tickPrescaledSequenceTimer 0x0336: sub-timer 0x4008 wrap
; reloads to 60 and cascades a tick into dwell tier 0x4009, carrying into
; SEQUENCE_STATE 0x400a on that tier's expiry); performs no staging side
; effect of its own -- a pure dwell state.
dwellThenAdvanceSequence:
028E: CD 63 03        CALL    $0363               ; {code.clearStridedTable} wipe the strided sway-coordinate table
0291: CD BE 0B        CALL    $0BBE               ; {code.stageObjectsToSpriteShadow} stage the object records into the sprite shadow
0294: CD C3 0C        CALL    $0CC3               ; {code.driveAllObjectSlots} run all eight object slots' AI this frame
0297: CD 67 03        CALL    $0367               ; {code.redrawTileColumnsPeriodically} repaint the queued tile-columns on the beat
029A: C3 36 03        JP      $0336               ; {code.tickPrescaledSequenceTimer} pure dwell -- tail into the prescaled sequence timer

; runAttractSequenceAndAdvanceOnCredit sequence-state handler (state index
; 9): each tick clear the strided table and blank a 28-cell row of tile 16
; at VRAM_WRITE_PTR (step cursor +32); on dwell (0x4009) expiry advance
; SEQUENCE_STATE, clear SPRITE_SOURCE_OBJ_BASE (256B) and
; SPRITE_SHADOW_BASE (64B), re-arm the two-tier dwell
; (0x4008=64,0x4009=4), reseed the object shadow, and queue command word
; 6.
blankVramRowThenResetSpriteState:
029D: CD 63 03        CALL    $0363               ; {code.clearStridedTable} wipe the strided sway-coordinate table
02A0: 2A 0B 40        LD      HL,($400B)          ; {hard.workRam+B} load the VRAM fill write cursor
02A3: 06 1C           LD      B,$1C               ; count = 28 cells, one tile-row width
02A5: 3E 10           LD      A,$10               ; fill byte = the blank tile $10
02A7: D7              RST     $10                 ; block-fill a 28-cell blank row of the tilemap
02A8: 11 04 00        LD      DE,$0004            ; step = 4 cells
02AB: 19              ADD     HL,DE               ; advance the cursor past this row
02AC: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} store the advanced VRAM write cursor
02AF: 21 09 40        LD      HL,$4009            ; point HL at the dwell tier
02B2: 35              DEC     (HL)                ; tick the dwell down
02B3: C0              RET     NZ                  ; dwell not up -- done this frame
02B4: 2C              INC     L                   ; step up to the sequence-state index
02B5: 34              INC     (HL)                ; advance the attract sequence to its next sub-state
02B6: 21 B0 42        LD      HL,$42B0            ; point HL at the object-record array base
02B9: AF              XOR     A                   ; fill byte = 0
02BA: 47              LD      B,A                 ; count = 0 (wraps to a full 256)
02BB: D7              RST     $10                 ; block-fill -- clear all 256 bytes of the object records
02BC: 21 60 40        LD      HL,$4060            ; point HL at the sprite-shadow base
02BF: 06 40           LD      B,$40               ; count = 64 bytes
02C1: D7              RST     $10                 ; block-fill -- clear the 64-byte sprite shadow
02C2: 21 40 04        LD      HL,$0440            ; load the two-tier reload pair ($40 sub / $04 dwell)
02C5: 22 08 40        LD      ($4008),HL          ; {hard.workRam+8} re-arm the dwell cascade
02C8: CD 95 05        CALL    $0595               ; {code.seedObjectShadowFromRom} reseed the sprite-code lane of the object shadow from ROM
02CB: 11 00 06        LD      DE,$0600            ; build command word: channel 6, arg 0
02CE: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} queue command 6 and return

; Sequence-state handler: enqueue a channel-7 (arg 1) credit-count redraw
; and a channel-6 (arg 0) message-column draw, increment SEQUENCE_STATE
; (0x400a), and re-arm both dwell-timer tiers (0x4008=96 sub-timer,
; 0x4009=16 mid-tier).
postCreditAndMessageDrawsAndAdvance:
02D1: 11 01 07        LD      DE,$0701            ; command word: channel 7, arg 1 (credit-count redraw)
02D4: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} queue the credit-count redraw
02D7: 11 00 06        LD      DE,$0600            ; command word: channel 6, arg 0 (message-column draw)
02DA: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} queue the message-column draw
02DD: 21 0A 40        LD      HL,$400A            ; point HL at the sequence-state index
02E0: 34              INC     (HL)                ; advance the attract sequence to its next sub-state
02E1: 21 60 10        LD      HL,$1060            ; load the two-tier reload pair ($60 sub / $10 dwell)
02E4: 22 08 40        LD      ($4008),HL          ; {hard.workRam+8} re-arm the dwell cascade
02E7: C9              RET                         ; return

; runAttractSequenceAndAdvanceOnCredit sequence-state handler (state index
; 12): zero-fill the 128-byte FLAG_BITS_BASE block (0x4100), clear status
; cells 0x425f and 0x4238, arm the mid-tier dwell (0x4009=64), then
; advance SEQUENCE_STATE and reseed the stride-2 object-RAM shadow via
; advanceSequenceStateAndReseedObjectShadow.
clearFlagBlockAndReseedObjectShadow:
02E8: 21 00 41        LD      HL,$4100            ; point HL at the 128-byte formation flag block
02EB: 06 80           LD      B,$80               ; count = 128 flag cells
02ED: AF              XOR     A                   ; fill byte = 0
02EE: D7              RST     $10                 ; block-fill -- clear the whole formation flag block
02EF: 32 5F 42        LD      ($425F),A           ; {hard.workRam+25F} clear the frame-counter cell $425f
02F2: 32 38 42        LD      ($4238),A           ; {hard.workRam+238} clear the object-draw-suppress flag $4238
02F5: 21 09 40        LD      HL,$4009            ; point HL at the dwell tier
02F8: 36 40           LD      (HL),$40            ; arm the mid-tier dwell to $40
02FA: C3 93 05        JP      $0593               ; {code.advanceSequenceStateAndReseedObjectShadow} advance the sequence and reseed the object shadow

; runAttractSequenceAndAdvanceOnCredit state 13: unpack a packed
; descriptor bitmask (ROM 0x051b) into the 0x4100 flag block, copy the
; following 8-byte template into 0x4218, clear 0x425f, set 0x421d=1,
; increment SEQUENCE_STATE, stamp 0x400b=0x96, and publish pointer 0x0640
; into 0x4245
loadDescriptorAndAdvanceSequence:
02FD: 11 1B 05        LD      DE,$051B            ; point DE at the packed descriptor bitmask in ROM
0300: CD 46 06        CALL    $0646               ; {code.unpackBitmaskToFlagBytes} unpack it into the 128-cell formation flag block
0303: EB              EX      DE,HL               ; move the advanced source pointer into HL
0304: 11 18 42        LD      DE,$4218            ; point DE at the working buffer $4218
0307: 01 08 00        LD      BC,$0008            ; count = 8 bytes
030A: ED B0           LDIR                        ; copy the trailing 8-byte template into the working buffer
030C: AF              XOR     A                   ; clear A
030D: 32 5F 42        LD      ($425F),A           ; {hard.workRam+25F} clear the frame-counter cell $425f
0310: 3C              INC     A                   ; A = 1
0311: 32 1D 42        LD      ($421D),A           ; {hard.workRam+21D} set the state-advance arm gate $421d
0314: 21 0A 40        LD      HL,$400A            ; point HL at the sequence-state index
0317: 34              INC     (HL)                ; advance the attract sequence to its next sub-state
0318: 2C              INC     L                   ; step up to the VRAM cursor low byte cell
0319: 36 96           LD      (HL),$96            ; stamp $96 into the VRAM cursor low byte
031B: 21 40 06        LD      HL,$0640            ; load the deferred-callback pointer $0640
031E: 22 45 42        LD      ($4245),HL          ; {hard.workRam+245} publish it into $4245
0321: C9              RET                         ; return

; RST-28 sequence-state handler: set SEQUENCE_STATE (0x400a) to 1 and arm
; the step-1 dwell cascade (0x4008/0x4009 = 3,3)
enterSequenceStep1:
0322: 3E 01           LD      A,$01               ; A = 1
0324: 32 0A 40        LD      ($400A),A           ; {hard.workRam+A} force the sequence state to 1
0327: 21 03 03        LD      HL,$0303            ; load the short-dwell pair (3 sub / 3 dwell)
032A: 22 08 40        LD      ($4008),HL          ; {hard.workRam+8} seed the step-1 dwell cascade
032D: C9              RET                         ; return

; Sequence state handler: point HL at the 0x4009 dwell tier and tick the
; shared cascade countdown (tickCascadeCountdown, 0x0331) each frame,
; advancing SEQUENCE_STATE (0x400a) on the tier's expiry.
tickSequenceDwellTimer:
032E: 21 09 40        LD      HL,$4009            ; point HL at the $4009 dwell tier

; shared dec-and-carry timer tick: decrement the byte at HL; on expiry
; step to the next in-page byte and increment it. Both current callers
; pass HL=0x4009, carrying into SEQUENCE_STATE (0x400a)
tickCascadeCountdown:
0331: 35              DEC     (HL)                ; tick the byte HL names down one
0332: C0              RET     NZ                  ; still counting -- nothing more
0333: 2C              INC     L                   ; step to the next byte in the cascade
0334: 34              INC     (HL)                ; carry out: increment it (dwell expiry bumps the sequence state)
0335: C9              RET                         ; return

; Prescaled sequence-dwell state: decrement sub-timer 0x4008 each frame;
; on wrap reload it to 0x3c and tick the 0x4009 dwell tier via
; tickCascadeCountdown (0x0331), advancing SEQUENCE_STATE on that tier's
; expiry.
tickPrescaledSequenceTimer:
0336: 21 08 40        LD      HL,$4008            ; point HL at the fast sub-timer
0339: 35              DEC     (HL)                ; tick the sub-timer down one frame
033A: C0              RET     NZ                  ; sub-timer not wrapped -- done
033B: 36 3C           LD      (HL),$3C            ; wrapped -- reload the sub-timer to 60
033D: 2C              INC     L                   ; step up to the dwell tier
033E: C3 31 03        JP      $0331               ; {code.tickCascadeCountdown} tick the dwell, carrying into the sequence state

; Activate one 32-byte descriptor slot at DESCRIPTOR_SLOT_TABLE (0x4330) +
; (number-1)*32: stamp [0]=1 (active), [1]=0, [2]=0x0d, [4]=0, [5]=0x0c,
; [7]=slot index; leaves [3]/[6] untouched.
activateDescriptorSlot:
0341: 7E              LD      A,(HL)              ; read the descriptor number from the dwell cell
0342: D9              EXX                         ; swap to the alternate register bank
0343: 3D              DEC     A                   ; descriptor number minus one (zero-based)
0344: 47              LD      B,A                 ; keep the slot index in B
0345: 0F              RRCA                        ; shift right...
0346: 0F              RRCA                        ; ...again...
0347: 0F              RRCA                        ; ...a third time to form the slot offset
0348: 5F              LD      E,A                 ; low byte of the slot offset
0349: 16 00           LD      D,$00               ; high byte = 0
034B: 21 30 43        LD      HL,$4330            ; point HL at the descriptor-slot table base
034E: 19              ADD     HL,DE               ; index to this descriptor's 32-byte slot
034F: 36 01           LD      (HL),$01            ; stamp field 0 = 1 -- mark the slot active
0351: 2C              INC     L                   ; step to field 1
0352: 36 00           LD      (HL),$00            ; clear field 1
0354: 2C              INC     L                   ; step to field 2
0355: 36 0D           LD      (HL),$0D            ; stamp field 2 = $0d, the object-AI state index
0357: 2C              INC     L                   ; step to field 3
0358: 2C              INC     L                   ; step to field 4, leaving field 3 untouched
0359: 36 00           LD      (HL),$00            ; clear field 4
035B: 2C              INC     L                   ; step to field 5
035C: 36 0C           LD      (HL),$0C            ; stamp field 5 = $0c
035E: 2C              INC     L                   ; step to field 6
035F: 2C              INC     L                   ; step to field 7, leaving field 6 untouched
0360: 70              LD      (HL),B              ; stamp field 7 = the slot index
0361: D9              EXX                         ; swap the register bank back
0362: C9              RET                         ; return

; Per-state reset: broadcast 0 across the 9-cell stride-2 work-RAM table
; at 0x4028 (0x4028,0x402a,...,0x4038) via broadcastToStridedTable
; (0x0972).
clearStridedTable:
0363: AF              XOR     A                   ; fill value = 0
0364: C3 72 09        JP      $0972               ; {code.broadcastToStridedTable} broadcast 0 across the nine-cell sway coordinate table

; Periodically redraw a run of VRAM tile-columns gated by
; DRAWN_COLUMN_COUNT (0x4241) and the frame-counter phase (0x425f & 0x3f):
; <2 counted returns; the blank phase wipes the columns
; (blankTileColumns), the draw phase repaints them from TILE_COLUMN_TABLE
; (drawTileColumnTriple)
redrawTileColumnsPeriodically:
0367: 3A 41 42        LD      A,($4241)           ; {hard.workRam+241} read the running tile-column redraw count
036A: A7              AND     A                   ; test it
036B: C8              RET     Z                   ; nothing queued -- return
036C: 3D              DEC     A                   ; only one column queued?
036D: C8              RET     Z                   ; if just one, nothing to draw yet -- return
036E: 47              LD      B,A                 ; B = the number of columns to draw
036F: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the frame counter
0372: 4F              LD      C,A                 ; keep the raw counter in C
0373: E6 3F           AND     $3F                 ; mask to the low six bits -- the draw phase
0375: 28 49           JR      Z,$03C0             ; {code.blankTileColumns} phase zero -- go blank the columns
0377: FE 20           CP      $20                 ; phase $20 -- the draw phase?
0379: C0              RET     NZ                  ; any other phase -- nothing this frame
037A: 79              LD      A,C                 ; recall the raw frame counter
037B: 07              RLCA                        ; rotate left...
037C: 07              RLCA                        ; ...twice
037D: E6 03           AND     $03                 ; keep two bits -- a 0..3 table selector
037F: 4F              LD      C,A                 ; stash the selector
0380: 87              ADD     A,A                 ; times two...
0381: 81              ADD     A,C                 ; ...plus one -- times three, the 3-byte row stride
0382: 5F              LD      E,A                 ; low byte of the row offset
0383: 16 00           LD      D,$00               ; high byte = 0
0385: 21 9A 03        LD      HL,$039A            ; point HL at the tile-column source-row table
0388: 19              ADD     HL,DE               ; index to the selected source row
0389: 11 93 51        LD      DE,$5193            ; point DE at the destination VRAM column
038C: CD AF 03        CALL    $03AF               ; {code.drawTileColumnTriple} paint the first column's three cells
038F: 05              DEC     B                   ; one column drawn
0390: C8              RET     Z                   ; that was the only one -- done
0391: 21 A6 03        LD      HL,$03A6            ; point HL at the continuation source-row table

loc_0394:
0394: CD AF 03        CALL    $03AF               ; {code.drawTileColumnTriple} paint the next column
0397: 10 FB           DJNZ    $0394               ; {code.loc_0394} repeat for every remaining queued column
0399: C9              RET                         ; return

; ---- $039A-$03AE: data ----
039A: 01 05 00 02 00 00 03 00 00 08 00 00 01 00 00 10
03AA: 08 00 10 06 00

; Render primitive: copy 3 source bytes up a VRAM tilemap column (dst low
; byte -0x20 per row within the fixed page), then advance +0x62 to line up
; the next column; returns advanced src (HL) and dst (DE/A) for chained
; column draws.
drawTileColumnTriple:
03AF: 0E 03           LD      C,$03               ; count = 3 cells up this column

loc_03b1:
03B1: 7E              LD      A,(HL)              ; read the next source byte
03B2: 12              LD      (DE),A              ; store it into the VRAM column cell
03B3: 23              INC     HL                  ; advance the source pointer
03B4: 7B              LD      A,E                 ; take the destination low byte
03B5: D6 20           SUB     $20                 ; step up one 32-cell tilemap row
03B7: 5F              LD      E,A                 ; store the stepped destination low byte
03B8: 0D              DEC     C                   ; one cell done
03B9: C2 B1 03        JP      NZ,$03B1            ; {code.loc_03b1} loop for all three cells of the column
03BC: C6 62           ADD     A,$62               ; advance to the next column (+$62 lines it up)
03BE: 5F              LD      E,A                 ; store the new destination low byte
03BF: C9              RET                         ; return the advanced pointers

; Render primitive: blank a run of B tilemap columns starting at 0x5193,
; stamping BLANK_TILE (0x10) into 3 cells per column (HL -0x20 per row,
; 16-bit, borrows into the high byte), advancing +0x62 per column (djnz,
; 0->256).
blankTileColumns:
03C0: 21 93 51        LD      HL,$5193            ; point HL at the first VRAM column
03C3: 11 E0 FF        LD      DE,$FFE0            ; step = minus one tilemap row (-$20, 16-bit)

loc_03c6:
03C6: 0E 03           LD      C,$03               ; count = 3 cells per column
03C8: 3E 10           LD      A,$10               ; fill = the blank tile $10

loc_03ca:
03CA: 77              LD      (HL),A              ; stamp the blank tile into this cell
03CB: 19              ADD     HL,DE               ; step up one tilemap row, borrowing into the high byte
03CC: 0D              DEC     C                   ; one cell done
03CD: C2 CA 03        JP      NZ,$03CA            ; {code.loc_03ca} loop for all three cells of the column
03D0: 7D              LD      A,L                 ; take the pointer low byte
03D1: C6 62           ADD     A,$62               ; advance to the next column (+$62)
03D3: 6F              LD      L,A                 ; store the new low byte
03D4: 10 F0           DJNZ    $03C6               ; {code.loc_03c6} repeat for every queued column
03D6: C9              RET                         ; return

; RST continuation (pushed by runAttractSequenceAndAdvanceOnCredit as the
; post-dispatch return): when credit count 0x4002 != 0, advance GAME_STATE
; (0x4005) and reset the attract sub-state cluster — clear 0x4007,
; SEQUENCE_STATE (0x400a), 0x41c2, sound-sweep 0x41df, and
; MESSAGE_SCROLL_ENABLE (0x40b0); zero credits = no-op
advanceGameStateOnCredit:
03D7: 3A 02 40        LD      A,($4002)           ; {hard.workRam+2} read the credit count
03DA: A7              AND     A                   ; test it
03DB: C8              RET     Z                   ; no credit banked -- leave attract running
03DC: 21 05 40        LD      HL,$4005            ; point HL at the game-state index
03DF: 34              INC     (HL)                ; advance the game state (attract to press-start)
03E0: 2C              INC     L                   ; step to $4006
03E1: 2C              INC     L                   ; step to $4007
03E2: 36 00           LD      (HL),$00            ; clear the attract mode flag $4007
03E4: AF              XOR     A                   ; A = 0
03E5: 32 0A 40        LD      ($400A),A           ; {hard.workRam+A} clear the sequence-state index
03E8: 32 C2 41        LD      ($41C2),A           ; {hard.workRam+1C2} clear cell $41c2
03EB: 32 DF 41        LD      ($41DF),A           ; {hard.workRam+1DF} clear the sound-sweep request $41df
03EE: 32 B0 40        LD      ($40B0),A           ; {hard.workRam+B0} clear the message-scroller enable flag
03F1: C9              RET                         ; return

; Game-state-2 (post-credit 'press start') handler: run per-frame
; formation prep
; (advanceFormationSweepOscillator/summarizeFormationOccupancy), dispatch
; on SEQUENCE_STATE (0x400a) to one of four start-screen sub-handlers (res
; etObjectRamAndAdvanceSequence/holdStartLampsThenAdvanceSequence/blankVra
; mRowsThenDriveStartLamps/driveStartButtonLamps), then tail-run
; beginGameOnStartButton to launch a 1-/2-player game on the start button.
runStartScreenAndLaunchGame:
03F2: CD 0D 09        CALL    $090D               ; {code.advanceFormationSweepOscillator} sway the alien block one step
03F5: CD 8E 09        CALL    $098E               ; {code.summarizeFormationOccupancy} fold the occupancy grid into its row/column summaries
03F8: 21 92 04        LD      HL,$0492            ; point at the start-button launcher
03FB: E5              PUSH    HL                  ; push it as the post-dispatch return
03FC: 3A 0A 40        LD      A,($400A)           ; {hard.workRam+A} read the sequence-state index
03FF: EF              RST     $28                 ; dispatch through the inline table to this start-screen sub-state

; ---- $0400-$0407: jump table ----
0400: 08 04 30 04 43 04 73 04

; runStartScreenAndLaunchGame sequence state index 0: seed the stride-2
; OBJRAM shadow from ROM template 0x1d91, zero the sprite-shadow span
; (0x4060, 64 bytes) and the object-record region (0x4260, 256+80 bytes),
; clear 0x4238 and MESSAGE_SCROLL_ENABLE (0x40b0), set VRAM_WRITE_PTR to
; VRAM_BASE+2, arm dwell tier 0x4009=16, and advance SEQUENCE_STATE
; (0x400a).
resetObjectRamAndAdvanceSequence:
0408: 21 91 1D        LD      HL,$1D91            ; point at the start-screen object-shadow ROM template
040B: CD 98 05        CALL    $0598               ; {code.seedObjectRamShadowField} seed the sprite-code lane from that template
040E: 21 60 40        LD      HL,$4060            ; point HL at the sprite-shadow base
0411: 06 40           LD      B,$40               ; count = 64 bytes
0413: AF              XOR     A                   ; fill = 0
0414: D7              RST     $10                 ; block-fill -- clear the 64-byte sprite shadow
0415: 21 60 42        LD      HL,$4260            ; point HL at the object-record region
0418: D7              RST     $10                 ; block-fill -- clear 256 bytes of object records
0419: 06 50           LD      B,$50               ; count = 80 more bytes
041B: D7              RST     $10                 ; block-fill -- clear the trailing 80 bytes of the region
041C: 32 38 42        LD      ($4238),A           ; {hard.workRam+238} clear the object-draw-suppress flag $4238
041F: 32 B0 40        LD      ($40B0),A           ; {hard.workRam+B0} clear the message-scroller enable flag
0422: 21 02 50        LD      HL,$5002            ; point at VRAM base + 2
0425: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} set the VRAM fill write cursor there
0428: 21 09 40        LD      HL,$4009            ; point HL at the dwell tier
042B: 36 10           LD      (HL),$10            ; arm the dwell to $10
042D: 2C              INC     L                   ; step up to the sequence-state index
042E: 34              INC     (HL)                ; advance the sequence to its next sub-state
042F: C9              RET                         ; return

; runStartScreenAndLaunchGame sub-state slot 1: tick countdown 0x4019, and
; while it stays nonzero keep the start-button lamps in step with credits
; (driveStartButtonLamps); on its zero-cross advance SEQUENCE_STATE
; (0x400a) and clear the 128-byte flag-bits block.
holdStartLampsThenAdvanceSequence:
0430: 21 19 40        LD      HL,$4019            ; point HL at the press-start step countdown cell 0x4019
0433: 35              DEC     (HL)                ; count that step timer down one frame
0434: C2 73 04        JP      NZ,$0473            ; {code.driveStartButtonLamps} still counting -- skip ahead to just refresh the start-button lamps
0437: 21 0A 40        LD      HL,$400A            ; timer hit zero: point at the sequence state index
043A: 34              INC     (HL)                ; step the press-start sequence to its next sub-state
043B: 21 00 41        LD      HL,$4100            ; point at the base of the 128-cell formation flag block
043E: 06 80           LD      B,$80               ; 128 cells to clear
0440: AF              XOR     A                   ; fill byte zero -- no live alien
0441: D7              RST     $10                 ; block-fill the whole formation flag block empty
0442: C9              RET                         ; done for this frame

; runStartScreenAndLaunchGame sequence state index 2: fill two 28-cell
; blank-tile (16) rows through VRAM_WRITE_PTR (skipping a 4-cell gap
; between rows) and store the advanced cursor, then tick the dwell tier
; 0x4009; while rows remain, return. On the last row: advance
; SEQUENCE_STATE (0x400a), clear FLIP_SCREEN_X/Y and the 0x4018 direction
; flag, enqueue two command words, and call driveStartButtonLamps
; (0x0473).
blankVramRowsThenDriveStartLamps:
0443: 2A 0B 40        LD      HL,($400B)          ; {hard.workRam+B} load the VRAM fill write cursor
0446: 06 1C           LD      B,$1C               ; 28 cells -- one tilemap row of the press-start screen
0448: 3E 10           LD      A,$10               ; blank tile $10
044A: D7              RST     $10                 ; block-fill one blank row into VRAM
044B: 11 04 00        LD      DE,$0004            ; stride of 4 cells -- the gap over to the next row
044E: 19              ADD     HL,DE               ; step the cursor past the 4-cell gap
044F: 06 1C           LD      B,$1C               ; 28 cells for the second blank row
0451: D7              RST     $10                 ; block-fill the second blank row of tiles
0452: 19              ADD     HL,DE               ; step the cursor past the trailing gap
0453: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} store the advanced VRAM write cursor
0456: 21 09 40        LD      HL,$4009            ; point at the dwell timer tier 0x4009
0459: 35              DEC     (HL)                ; tick the dwell down one frame
045A: C0              RET     NZ                  ; rows still to blank -- return
045B: 2C              INC     L                   ; dwell expired: step to the sequence state 0x400a
045C: 34              INC     (HL)                ; advance to the next press-start sub-state
045D: AF              XOR     A                   ; zero
045E: 32 06 70        LD      ($7006),A           ; clear the screen-flip X latch
0461: 32 07 70        LD      ($7007),A           ; clear the screen-flip Y latch
0464: 32 18 40        LD      ($4018),A           ; {hard.workRam+18} clear the sprite-orientation/direction flag
0467: 11 02 07        LD      DE,$0702            ; command word channel 7 param 2
046A: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue that deferred command
046D: 11 01 06        LD      DE,$0601            ; command word channel 6 param 1
0470: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue that deferred command

; RST-28 state idx 3: drive the two start-button lamp latches
; (0x6000/0x6001) from the credit/start count 0x4002, gated on 0x425f bit5
; — bit5 clear clears both lamps; else 0 credits leaves them, 1 credit
; lights lamp0, >=2 lights both
driveStartButtonLamps:
0473: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the free-running frame counter
0476: E6 20           AND     $20                 ; isolate bit 5 -- the start-lamp blink gate
0478: 28 11           JR      Z,$048B             ; {code.loc_048b} gate closed -- go blank both start lamps this frame
047A: 3A 02 40        LD      A,($4002)           ; {hard.workRam+2} read the credit/start count
047D: A7              AND     A                   ; test it
047E: C8              RET     Z                   ; no credits -- leave the lamps as they are
047F: 47              LD      B,A                 ; stash the credit count
0480: 3E 01           LD      A,$01               ; lamp-on value
0482: 32 00 60        LD      ($6000),A           ; light the one-player start-button lamp
0485: 05              DEC     B                   ; account for one credit
0486: C8              RET     Z                   ; only one credit -- leave the two-player lamp off
0487: 32 01 60        LD      ($6001),A           ; two or more credits -- light the two-player lamp too
048A: C9              RET                         ; done

loc_048b:
048B: 32 00 60        LD      ($6000),A           ; clear the one-player start lamp
048E: 32 01 60        LD      ($6001),A           ; clear the two-player start lamp
0491: C9              RET                         ; done

; Start-button round launcher: IN1_SHADOW bit0 begins a one-player game
; (tail to startOnePlayerGame); bit1 with >=2 credits spends two, blits
; the 32-byte ROM row template into SAVED_STATE_SNAPSHOT (0x41a0),
; optionally arms the state-advance gate on config 0x401f bit0, and enters
; startGameRoundAndClearScores with the 2-player spawn word.
beginGameOnStartButton:
0492: 3A 11 40        LD      A,($4011)           ; {hard.workRam+11} read the IN1 input shadow -- the start buttons
0495: CB 47           BIT     0,A                 ; test the one-player start button
0497: 20 59           JR      NZ,$04F2            ; {code.startOnePlayerGame} pressed -- go begin a one-player game
0499: CB 4F           BIT     1,A                 ; test the two-player start button
049B: C8              RET     Z                   ; neither pressed -- nothing to launch
049C: 3A 02 40        LD      A,($4002)           ; {hard.workRam+2} two-player wanted: read the credit count
049F: FE 02           CP      $02                 ; need at least two credits
04A1: D8              RET     C                   ; fewer than two -- cannot start a two-player game
04A2: D6 02           SUB     $02                 ; spend two credits
04A4: 32 02 40        LD      ($4002),A           ; {hard.workRam+2} store the reduced credit count
04A7: 21 1B 05        LD      HL,$051B            ; source: the 32-byte starting-board template in ROM
04AA: 11 A0 41        LD      DE,$41A0            ; dest: player-two's saved-state board buffer
04AD: 01 20 00        LD      BC,$0020            ; 32 bytes
04B0: ED B0           LDIR                        ; copy the fresh board template into the saved-state snapshot
04B2: 3A 1F 40        LD      A,($401F)           ; {hard.workRam+1F} read the config/DIP bit
04B5: 0F              RRCA                        ; rotate its bit 0 into carry
04B6: DC 0F 05        CALL    C,$050F             ; {code.armStateAdvanceGate} if set, arm the state-advance gate
04B9: 21 00 01        LD      HL,$0100            ; spawn word: high byte 1 marks a two-player game

; Game/round-start entry (fall-through from beginGameOnStartButton, jp
; from startOnePlayerGame): store the player-count/spawn word in
; CURRENT_PLAYER(0x400d), blit the 32-byte ROM row template 0x051b into
; PACKED_FLAG_BITMAP(0x4180), arm the substate-advance gate when 0x401f
; bit0 is set, enter play (GAME_STATE=3, SEQUENCE_STATE=0, 0x4006=1,
; 0x41d1=1), and queue a start message (ch6) plus two channel-4 score-slot
; clears.
startGameRoundAndClearScores:
04BC: 22 0D 40        LD      ($400D),HL          ; {hard.workRam+D} store the player-count/spawn word in the current-player cell
04BF: 21 1B 05        LD      HL,$051B            ; source: the 32-byte starting-board template again
04C2: 11 80 41        LD      DE,$4180            ; dest: player-one's packed board bitmap
04C5: 01 20 00        LD      BC,$0020            ; 32 bytes
04C8: ED B0           LDIR                        ; blit the starting board into the packed flag bitmap
04CA: 3A 1F 40        LD      A,($401F)           ; {hard.workRam+1F} read the config bit again
04CD: 0F              RRCA                        ; bit 0 into carry
04CE: DC 15 05        CALL    C,$0515             ; {code.armSubstateAdvanceGate} if set, arm the sub-state-advance gate
04D1: AF              XOR     A                   ; zero
04D2: 32 0A 40        LD      ($400A),A           ; {hard.workRam+A} reset the sequence state to 0 -- enter play at sub-state 0
04D5: 3E 03           LD      A,$03               ; game-state 3
04D7: 32 05 40        LD      ($4005),A           ; {hard.workRam+5} set the game state to play (player one)
04DA: 3E 01           LD      A,$01               ; value 1
04DC: 32 06 40        LD      ($4006),A           ; {hard.workRam+6} raise the mode/sound gate
04DF: 32 D1 41        LD      ($41D1),A           ; {hard.workRam+1D1} raise the companion sound-enable flag
04E2: 11 04 06        LD      DE,$0604            ; command word channel 6 param 4 -- the start message
04E5: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue it
04E8: 11 00 04        LD      DE,$0400            ; command word channel 4 param 0 -- clear a score slot
04EB: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue it
04EE: 1C              INC     E                   ; bump to param 1 -- the second score-slot clear
04EF: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue it and return through the queue routine

; One-player game-start arm (beginGameOnStartButton bit0 path): spend one
; credit (0x4002--), zero the saved-state snapshot 0x41a0, and enter play
; via startGameRoundAndClearScores with spawn word 0 (GAME_STATE=3, single
; player); no credit -> force GAME_STATE=1. Own write is only the credit
; spend (0x4002, itself); the start is delegated, so not write
startOnePlayerGame:
04F2: 3A 02 40        LD      A,($4002)           ; {hard.workRam+2} read the credit count
04F5: A7              AND     A                   ; test it
04F6: 28 11           JR      Z,$0509             ; {code.loc_0509} no credit -- take the no-credit path
04F8: 3D              DEC     A                   ; spend one credit
04F9: 32 02 40        LD      ($4002),A           ; {hard.workRam+2} store the reduced count
04FC: 21 A0 41        LD      HL,$41A0            ; point at player-two's saved-state buffer
04FF: 06 20           LD      B,$20               ; 32 bytes
0501: AF              XOR     A                   ; fill byte zero
0502: D7              RST     $10                 ; clear the saved-state snapshot -- single player holds no second board
0503: 21 00 00        LD      HL,$0000            ; spawn word 0 -- single player
0506: C3 BC 04        JP      $04BC               ; {code.startGameRoundAndClearScores} enter the round via the game-start routine

loc_0509:
0509: 3E 01           LD      A,$01               ; game-state 1 (attract)
050B: 32 05 40        LD      ($4005),A           ; {hard.workRam+5} no credit to spend -- drop the machine back to attract
050E: C9              RET                         ; done

; store the armed marker (3) into gate byte 0x41b5, which the state
; handler stepPlaySubstate6 tests as nonzero to take its advance/proceed
; path
armStateAdvanceGate:
050F: 3E 03           LD      A,$03               ; the armed marker value 3
0511: 32 B5 41        LD      ($41B5),A           ; {hard.workRam+1B5} arm the state-advance gate the end-of-round handler tests
0514: C9              RET                         ; done

; store the armed marker (3) into gate byte 0x4195, tested by the sub-
; state handler stepAltPlaySubstate6 to take its advance-and-show path
armSubstateAdvanceGate:
0515: 3E 03           LD      A,$03               ; the armed marker value 3
0517: 32 95 41        LD      ($4195),A           ; {hard.workRam+195} arm the sub-state-advance gate for the alternate end-of-round handler
051A: C9              RET                         ; done

; ---- $051B-$0535: data ----
051B: 00 00 00 00 F8 1F F8 1F F8 1F F0 0F E0 07 40 02
052B: 3C 14 00 02 00 02 00 0F 00 00 00

; First/active player's play-state handler (game-state 3): run the per-
; frame formation prep, then tail-dispatch on SEQUENCE_STATE (0x400a) to
; one of eight play sub-states (init/blank/restore-from-
; PACKED_FLAG_BITMAP/dwell/activate/gameplay-frame/substate-6/pack-and-
; switch); its terminal saves this board to PACKED_FLAG_BITMAP (0x4180),
; sets CURRENT_PLAYER=1 and hands off to game-state 4.
runPlayerOnePlayFrame:
0536: CD 0D 09        CALL    $090D               ; {code.advanceFormationSweepOscillator} run the per-frame formation sway
0539: CD 8E 09        CALL    $098E               ; {code.summarizeFormationOccupancy} summarize formation occupancy into row and column summaries
053C: 3A 0A 40        LD      A,($400A)           ; {hard.workRam+A} read the play sub-state index
053F: EF              RST     $28                 ; dispatch through the eight-entry play sub-state jump table below

; ---- $0540-$054F: jump table ----
0540: 50 05 83 05 A5 05 05 06 14 06 61 06 D8 06 3D 07

; play-state sub-state-0 init (dispatched by runPlayerOnePlayFrame state 3
; and runPlayerTwoPlayFrame state 4): clear both start lamps, zero-fill
; work-RAM spans (0x4100-0x417f, 0x4200-0x422f, 0x4260-0x42a5), set
; 0x425f=0 and 0x4226=1, advance SEQUENCE_STATE (0x400a), arm dwell
; 0x4009=0x20, and point the VRAM fill cursor 0x400b at 0x5000
initPlayfieldState:
0550: 21 00 41        LD      HL,$4100            ; point at the formation flag block base
0553: 06 80           LD      B,$80               ; 128 cells
0555: AF              XOR     A                   ; fill byte zero
0556: 32 00 60        LD      ($6000),A           ; clear the one-player start lamp
0559: 32 01 60        LD      ($6001),A           ; clear the two-player start lamp
055C: D7              RST     $10                 ; block-fill the formation flag block empty
055D: 32 5F 42        LD      ($425F),A           ; {hard.workRam+25F} zero the free-running frame counter
0560: 21 00 42        LD      HL,$4200            ; point at the object-record work span from 0x4200
0563: 06 17           LD      B,$17               ; 23 bytes -- the object active-flag and control cells
0565: D7              RST     $10                 ; clear that object span
0566: 2C              INC     L                   ; step to 0x4218
0567: 06 18           LD      B,$18               ; 24 more bytes -- the rest of the object/timer work span
0569: D7              RST     $10                 ; clear that span too
056A: 21 60 42        LD      HL,$4260            ; point at the moving-object / projectile table
056D: 06 46           LD      B,$46               ; 70 bytes
056F: D7              RST     $10                 ; clear the moving-object and projectile records
0570: 3E 01           LD      A,$01               ; value 1
0572: 32 26 42        LD      ($4226),A           ; {hard.workRam+226} set the region-activity gate flag
0575: 21 0A 40        LD      HL,$400A            ; point at the sequence state
0578: 34              INC     (HL)                ; advance to play sub-state 1
0579: 2D              DEC     L                   ; step to the dwell timer 0x4009
057A: 36 20           LD      (HL),$20            ; arm the dwell timer to 32
057C: 21 00 50        LD      HL,$5000            ; the VRAM base
057F: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} rewind the VRAM fill cursor to the top of the tilemap
0582: C9              RET                         ; done

; Play-state sub-state-1 progressive screen clear (state 1 of both play
; tables runPlayerOnePlayFrame/runPlayerTwoPlayFrame): blank 32 VRAM cells
; (tile 16) at VRAM_WRITE_PTR(0x400b), advance the cursor +32, tick phase
; counter 0x4009; on the last phase advance the sequence and reseed the
; OBJRAM shadow (advanceSequenceStateAndReseedObjectShadow).
blankScreenRowsThenAdvanceSequence:
0583: 2A 0B 40        LD      HL,($400B)          ; {hard.workRam+B} load the VRAM fill cursor
0586: 06 20           LD      B,$20               ; 32 cells -- one screen row
0588: 3E 10           LD      A,$10               ; blank tile $10
058A: D7              RST     $10                 ; block-fill one row of blank tiles
058B: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} store the advanced cursor
058E: 21 09 40        LD      HL,$4009            ; point at the phase/dwell counter
0591: 35              DEC     (HL)                ; tick it down one row
0592: C0              RET     NZ                  ; rows still to clear -- return

; Advance the pointer's low byte in-page and increment the byte it now
; names (both callers arrive HL=0x4009, so inc L -> 0x400a bumps
; SEQUENCE_STATE), then fall through to seedObjectShadowFromRom to reseed
; the stride-2 OBJRAM shadow from ROM template 0x1d71
advanceSequenceStateAndReseedObjectShadow:
0593: 2C              INC     L                   ; step to the sequence state 0x400a
0594: 34              INC     (HL)                ; advance to the next play sub-state

; seed the interleaved (stride-2) OBJRAM-shadow field
; 0x4021,0x4023,...,0x405f from ROM template 0x1d71 at screen/formation
; init — sets HL=0x1d71 and delegates to seedObjectRamShadowField
seedObjectShadowFromRom:
0595: 21 71 1D        LD      HL,$1D71            ; source: the ROM object-shadow template

; copy 32 bytes from a ROM template into one interleaved (stride-2) field
; of the OBJRAM shadow (0x4021,0x4023,...,0x405f) at screen/formation init
seedObjectRamShadowField:
0598: 11 21 40        LD      DE,$4021            ; dest: the code lane of the OBJRAM shadow
059B: 06 20           LD      B,$20               ; 32 sprite codes to seed

loc_059d:
059D: 7E              LD      A,(HL)              ; read the next code byte from the ROM template
059E: 12              LD      (DE),A              ; write it into the shadow's code lane
059F: 23              INC     HL                  ; advance the ROM source
05A0: 1C              INC     E                   ; step the dest one cell
05A1: 1C              INC     E                   ; step again -- skip the interleaved coordinate cell (stride 2)
05A2: 10 F9           DJNZ    $059D               ; {code.loc_059d} loop for all 32 codes
05A4: C9              RET                         ; done

; Game-state-3 sequence dispatch slot 2 (board/level-start): unpack the
; packed flag bitmap (0x4180) into the flag grid via
; unpackBitmaskToFlagBytes, copy the trailing 8-byte board template into
; 0x4218, reset status/flip/direction cells (0x425f/0x4220/0x4018=0),
; advance SEQUENCE_STATE, arm the 150-tick dwell timer 0x4009, publish
; deferred-callback pointer 0x0640 into 0x4245, then cue the board-start
; sound when the sound gate is open.
restoreFormationAndEnterPlaySubstate:
05A5: 11 80 41        LD      DE,$4180            ; point at the packed board bitmap (player one)
05A8: CD 46 06        CALL    $0646               ; {code.unpackBitmaskToFlagBytes} unpack the packed bitmap into the 128-cell flag grid
05AB: EB              EX      DE,HL               ; put the pointer just past the mask into HL
05AC: 11 18 42        LD      DE,$4218            ; dest: the working board template buffer
05AF: 01 08 00        LD      BC,$0008            ; 8 bytes
05B2: ED B0           LDIR                        ; copy the trailing 8-byte board template into the working buffer
05B4: AF              XOR     A                   ; zero
05B5: 32 5F 42        LD      ($425F),A           ; {hard.workRam+25F} clear the frame counter
05B8: 32 20 42        LD      ($4220),A           ; {hard.workRam+220} clear the region-clear flag
05BB: 32 06 70        LD      ($7006),A           ; clear the screen-flip X latch
05BE: 32 07 70        LD      ($7007),A           ; clear the screen-flip Y latch
05C1: 32 18 40        LD      ($4018),A           ; {hard.workRam+18} clear the sprite-orientation/direction flag
05C4: 21 0A 40        LD      HL,$400A            ; point at the sequence state
05C7: 34              INC     (HL)                ; advance to the next play sub-state
05C8: 2D              DEC     L                   ; step to the dwell timer 0x4009
05C9: 36 96           LD      (HL),$96            ; arm a long 150-frame dwell
05CB: 21 40 06        LD      HL,$0640            ; the deferred-callback pointer value
05CE: 22 45 42        LD      ($4245),HL          ; {hard.workRam+245} publish it for the play pipeline
05D1: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode/sound gate
05D4: 0F              RRCA                        ; bit 0 into carry
05D5: D0              RET     NC                  ; sound gate closed -- skip the board-start cue
05D6: 3A 0E 40        LD      A,($400E)           ; {hard.workRam+E} read the paired-player flag
05D9: 0F              RRCA                        ; bit 0 into carry
05DA: 38 20           JR      C,$05FC             ; {code.queueBoardStartSoundBurst} paired player -- use the paired board-start sound variant
05DC: 11 00 05        LD      DE,$0500            ; command word channel 5 param 0 -- board-start sound prologue
05DF: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue it

; Post a five-word burst into the command queue via enqueueCommandWord:
; (D,2),(D+1,2),(D+1,4),(7,3),(7,0), each word (channel<<8)|param with
; D=caller's channel. Tail of restoreFormationAndEnterPlaySubstate (falls
; through after 0x0500) and entered from queueBoardStartSoundBurst.
enqueueCommandWordBurst:
05E2: 1E 02           LD      E,$02               ; param 2 (channel stays in D)
05E4: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue word (channel, 2)
05E7: 14              INC     D                   ; bump to the next channel
05E8: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue word (next channel, 2)
05EB: 1E 04           LD      E,$04               ; param 4
05ED: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue word (next channel, 4)
05F0: 11 03 07        LD      DE,$0703            ; command word channel 7 param 3
05F3: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue it
05F6: 11 00 07        LD      DE,$0700            ; command word channel 7 param 0
05F9: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue the last burst word and return through the queue routine

; Board/level-start sound cue, paired-player variant (sole caller
; restoreFormationAndEnterPlaySubstate when sound gate 0x4006 bit0 and
; paired-player flag 0x400e bit0 are set): enqueue a prologue command word
; (channel 5, param 3) then the standard channel 5/6/7 burst via
; enqueueCommandWordBurst
queueBoardStartSoundBurst:
05FC: 11 03 05        LD      DE,$0503            ; command word channel 5 param 3 -- paired-player sound prologue
05FF: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue it
0602: C3 E2 05        JP      $05E2               ; {code.enqueueCommandWordBurst} jump into the five-word sound burst

; Play sub-state timer (dispatch slot 3 of runPlayerOnePlayFrame and
; runPlayerTwoPlayFrame): tick dwell timer 0x4009; on its zero-cross
; reload it to 20, advance SEQUENCE_STATE (0x400a), and enqueue this
; state's command word (0x0682).
advanceSubstateAfterDwellAndQueue:
0605: 21 09 40        LD      HL,$4009            ; point at the dwell timer
0608: 35              DEC     (HL)                ; tick it down
0609: C0              RET     NZ                  ; still dwelling -- return
060A: 36 14           LD      (HL),$14            ; reload the dwell to 20
060C: 2C              INC     L                   ; step to the sequence state
060D: 34              INC     (HL)                ; advance to the next play sub-state
060E: 11 82 06        LD      DE,$0682            ; command word channel 6 param $82 -- this state's cue
0611: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue it and return

; State-timer handler: tick dwell 0x4009; while nonzero return. On expiry
; reload 0x4009=10, advance SEQUENCE_STATE, set OBJ_ACTIVE_FLAG (0x4200)=1
; to enable the object/AI/projectile subsystem, seed player-X reference
; 0x4202=128, refill the 16-byte enemy-launch sub-counter block 0x424a
; from SUBCOUNTER_RELOAD_TABLE (0x15e3), clear scratch 0x4058/0x405a, and
; enqueue channel-7 (arg 3) and channel-2 (arg 0, the 4x4 indicator draw)
; display commands.
activateObjectsAndBeginPlayPhase:
0614: 21 09 40        LD      HL,$4009            ; point at the dwell timer
0617: 35              DEC     (HL)                ; tick it down
0618: C0              RET     NZ                  ; still dwelling -- return
0619: 36 0A           LD      (HL),$0A            ; reload the dwell to 10
061B: 2C              INC     L                   ; step to the sequence state
061C: 34              INC     (HL)                ; advance to the play sub-state
061D: 21 01 00        LD      HL,$0001            ; value 1
0620: 22 00 42        LD      ($4200),HL          ; {hard.workRam+200} raise the object-active master flag -- switch on objects, AI and shots
0623: 3E 80           LD      A,$80               ; 128 -- screen centre
0625: 32 02 42        LD      ($4202),A           ; {hard.workRam+202} park the ship's X at centre
0628: 21 E3 15        LD      HL,$15E3            ; source: the enemy-launch sub-counter reload table
062B: 11 4A 42        LD      DE,$424A            ; dest: the 16-byte launch sub-counter block
062E: 01 10 00        LD      BC,$0010            ; 16 bytes
0631: ED B0           LDIR                        ; refill the enemy-launch sub-counters
0633: AF              XOR     A                   ; zero
0634: 32 58 40        LD      ($4058),A           ; {hard.workRam+58} clear a launch/object scratch cell
0637: 32 5A 40        LD      ($405A),A           ; {hard.workRam+5A} clear a second launch/object scratch cell
063A: 11 03 07        LD      DE,$0703            ; command word channel 7 param 3
063D: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue it
0640: 11 00 02        LD      DE,$0200            ; command word channel 2 param 0 -- the field-indicator draw
0643: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue it and return

; unpack a 16-byte packed bitmask at (DE) into 128 one-byte-per-bit flags
; at FLAG_BITS_BASE (0x4100), LSB-first — write 1 for a set bit, 0 for a
; clear one; returns DE advanced past the 16 mask bytes
unpackBitmaskToFlagBytes:
0646: 21 00 41        LD      HL,$4100            ; point HL at the formation flag block base -- 128 one-byte-per-cell live-alien flags
0649: 06 10           LD      B,$10               ; B counts the 16 packed mask bytes to unpack
064B: 0E 01           LD      C,$01               ; C is the bit selector, starting at bit 0

loc_064d:
064D: 1A              LD      A,(DE)              ; read the next packed mask byte from the source board
064E: A1              AND     C                   ; test the current bit of that mask byte
064F: 28 0B           JR      Z,$065C             ; {code.loc_065c} bit clear -- this grid cell has no alien
0651: 36 01           LD      (HL),$01            ; bit set -- mark this cell as a live alien in the formation

loc_0653:
0653: 23              INC     HL                  ; step to the next flag cell
0654: CB 01           RLC     C                   ; rotate the bit selector to the next bit
0656: 30 F5           JR      NC,$064D            ; {code.loc_064d} still within this mask byte -- test its next bit
0658: 13              INC     DE                  ; mask byte spent -- advance to the next packed source byte
0659: 10 F2           DJNZ    $064D               ; {code.loc_064d} loop until all 16 mask bytes have been unpacked
065B: C9              RET                         ; done -- the whole 128-cell formation is expanded, DE left past the mask

loc_065c:
065C: 36 00           LD      (HL),$00            ; clear this flag cell -- no alien here
065E: C3 53 06        JP      $0653               ; {code.loc_0653} rejoin the cell-step and loop

; Per-frame play pipeline (rst-28 dispatch target reached from three state
; tables: runAttractSequenceAndAdvanceOnCredit state 15 @0x0182,
; runPlayerOnePlayFrame @0x054a, runPlayerTwoPlayFrame @0x078f): run the
; 27 gameplay subsystem updates in fixed ROM order (player/shot
; move+stage, projectiles, object-AI loop 0x0cc3, sprite staging,
; collision flaggers, spawn/launch/pace, sound drivers, stage
; advance/reseed), then -- only while the play field is quiescent (no bit0
; in 0x4208|0x4201|OBJ_ACTIVE_FLAG 0x4200, stage-advance flag 0x4225 bit0
; set, no active sub-slot bit0 across the 14 five-byte records at 0x4260)
; -- decrement the sequence dwell timer 0x4009 and, on its zero-cross,
; advance SEQUENCE_STATE (0x400a).
runGameplayFrameAndAdvanceOnFieldClear:
0661: CD 37 08        CALL    $0837               ; {code.moveControlledObjectAndStageSprite} move the player ship and stage its sprite for this frame
0664: CD 98 08        CALL    $0898               ; {code.advancePlayerShotAndStageSprite} advance the player's shot and stage its sprite
0667: CD 74 0A        CALL    $0A74               ; {code.advanceAndRenderProjectiles} integrate and render the enemy shots this frame
066A: CD C3 0C        CALL    $0CC3               ; {code.driveAllObjectSlots} run the object-AI on all eight alien slots
066D: CD BE 0B        CALL    $0BBE               ; {code.stageObjectsToSpriteShadow} turn the eight object records into sprite-shadow entries
0670: CD 32 0A        CALL    $0A32               ; {code.armBehaviorGateOnInputOrTimer} arm the behavior/fire gate on input or timer
0673: CD 0B 0B        CALL    $0B0B               ; {code.flagPlayerShotHitOnFormation} test the player's shot against the standing formation
0676: CD 77 0B        CALL    $0B77               ; {code.flagProjectileHitsOnPlayer} test the enemy shots against the player ship
0679: CD 27 12        CALL    $1227               ; {code.flagPlayerShotHitsOnObjects} test the player's shot against the diving aliens
067C: CD 9E 12        CALL    $129E               ; {code.flagObjectHitsOnPlayer} test the diving aliens against the player ship
067F: CD E5 08        CALL    $08E5               ; {code.clearGateOnPendingRequest} acknowledge a pending request and clear the behavior gate
0682: CD 0C 14        CALL    $140C               ; {code.spawnObjectsOnDelayedEvent} spawn extra objects when a delayed event has fired
0685: CD 44 13        CALL    $1344               ; {code.launchAttackerFromFormation} launch a diving attacker out of the formation
0688: CD E1 13        CALL    $13E1               ; {code.chooseNextAttackerDirection} choose the next attacker's launch direction
068B: CD F3 14        CALL    $14F3               ; {code.rampCounterToCeiling} step the slow difficulty/pace ramp one notch
068E: CD ED 12        CALL    $12ED               ; {code.handlePlayerHitEvent} handle the player being hit this frame
0691: CD 27 13        CALL    $1327               ; {code.driveGatedSoundStepSequence} tick the player-death sound step sequence
0694: CD A6 16        CALL    $16A6               ; {code.driveDecayingSoundSweep} emit the decaying sound sweep
0697: CD 15 15        CALL    $1515               ; {code.paceEnemyLaunchTrigger} pace the enemy-launch trigger counter
069A: CD 55 15        CALL    $1555               ; {code.scheduleDelayedEvent} arm the delayed-event timer
069D: CD C3 15        CALL    $15C3               ; {code.fireDelayedEventRequest} count the delayed-event timer down and fire it on zero
06A0: CD F4 15        CALL    $15F4               ; {code.selectAttackerRowScan} scan row occupancy for the next row allowed to shoot
06A3: CD 21 16        CALL    $1621               ; {code.armFormationAdvanceTrigger} arm the stage-advance one-shot when the board is clear
06A6: CD 37 16        CALL    $1637               ; {code.advanceStageAndReseedFormation} advance the stage and rebuild the formation when armed
06A9: CD B8 16        CALL    $16B8               ; {code.driveSoundVoicesFromOccupancy} light the marching-hum voices from how full the block is
06AC: CD 88 16        CALL    $1688               ; {code.expireActivityGatedTimer} tick the activity-gated play timer
06AF: CD 8E 19        CALL    $198E               ; {code.computeControlledObjectMoveCommand} compute the demo-mode autopilot move command
06B2: 3A 08 42        LD      A,($4208)           ; {hard.workRam+208} read the shot/behavior gate byte
06B5: 2A 00 42        LD      HL,($4200)          ; {hard.workRam+200} read the object-active flag and the byte above it as a word
06B8: B4              OR      H                   ; fold in the high byte of that pair
06B9: B5              OR      L                   ; fold in the object-active flag
06BA: 0F              RRCA                        ; shift the combined activity bit0 into carry
06BB: D8              RET     C                   ; still something active -- field busy, leave without advancing
06BC: 3A 25 42        LD      A,($4225)           ; {hard.workRam+225} read the stage-advance / region-clear flag
06BF: 0F              RRCA                        ; test its bit0
06C0: D0              RET     NC                  ; board not cleared yet -- leave
06C1: 21 60 42        LD      HL,$4260            ; point at the 14 five-byte moving-object records
06C4: 11 05 00        LD      DE,$0005            ; DE is the 5-byte record stride
06C7: 06 0E           LD      B,$0E               ; B counts all 14 records
06C9: AF              XOR     A                   ; clear the running OR accumulator

loc_06ca:
06CA: B6              OR      (HL)                ; fold in this record's active byte
06CB: 19              ADD     HL,DE               ; step to the next record
06CC: 10 FC           DJNZ    $06CA               ; {code.loc_06ca} loop over all 14 moving-object records
06CE: 0F              RRCA                        ; test bit0 of the combined active bits
06CF: D8              RET     C                   ; a moving object still live -- field busy, leave
06D0: 21 09 40        LD      HL,$4009            ; point at the sequence dwell timer
06D3: 35              DEC     (HL)                ; field is quiescent -- count the dwell down
06D4: C0              RET     NZ                  ; still dwelling -- leave
06D5: 2C              INC     L                   ; step the pointer up to the sequence-state cell
06D6: 34              INC     (HL)                ; dwell expired -- advance the play sub-state
06D7: C9              RET                         ; done

; Play sub-state slot 6 handler (runPlayerOnePlayFrame, game-state 3): by
; arm gate 0x421d and mode flags 0x41b5/0x400e, advance or redirect
; SEQUENCE_STATE (0x400a) and reload dwell timer 0x4009 (=130 on the
; inline advance), queuing two channel-6 command words when 0x4006 bit0 is
; set; shared reset tail advanceDwellOrResetToState1
stepPlaySubstate6:
06D8: 21 0A 40        LD      HL,$400A            ; point HL at the sequence-state cell
06DB: 3A 1D 42        LD      A,($421D)           ; {hard.workRam+21D} read the arm/cycle gate
06DE: A7              AND     A                   ; test it
06DF: 20 20           JR      NZ,$0701            ; {code.loc_0701} armed -- take the alternate branch
06E1: 3A B5 41        LD      A,($41B5)           ; {hard.workRam+1B5} read the mode flag
06E4: A7              AND     A                   ; test it
06E5: 28 3B           JR      Z,$0722             ; {code.advanceDwellOrResetToState1} clear -- drop to the shared advance/reset tail
06E7: 3A 0E 40        LD      A,($400E)           ; {hard.workRam+E} read the second mode flag
06EA: A7              AND     A                   ; test it
06EB: 28 35           JR      Z,$0722             ; {code.advanceDwellOrResetToState1} clear -- drop to the shared tail
06ED: 34              INC     (HL)                ; advance the sequence to the next sub-state
06EE: 2D              DEC     L                   ; step down to the dwell timer
06EF: 36 82           LD      (HL),$82            ; arm the dwell timer to 130
06F1: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode/sound gate
06F4: 0F              RRCA                        ; test its bit0
06F5: D0              RET     NC                  ; sound gate closed -- done
06F6: 11 02 06        LD      DE,$0602            ; command word: channel 6, parameter 2
06F9: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} queue that channel-6 command
06FC: 1E 00           LD      E,$00               ; change the parameter to 0
06FE: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} queue the second channel-6 command and return

loc_0701:
0701: 3A B5 41        LD      A,($41B5)           ; {hard.workRam+1B5} read the mode flag
0704: A7              AND     A                   ; test it
0705: 28 0B           JR      Z,$0712             ; {code.setSequenceStateByModeAndReloadDwell} clear -- take the by-timer branch
0707: 3A 0E 40        LD      A,($400E)           ; {hard.workRam+E} read the second mode flag
070A: A7              AND     A                   ; test it
070B: 28 05           JR      Z,$0712             ; {code.setSequenceStateByModeAndReloadDwell} clear -- take the by-timer branch

; advance the sub-state counter at (HL) (both callers pass
; HL=SEQUENCE_STATE 0x400a) then re-arm the mid-tier dwell timer via
; reloadSequenceDwellTimer (0x070e -> 0x4009=0x50)
advanceSubstateAndReloadDwell:
070D: 34              INC     (HL)                ; advance the sequence sub-state counter

; re-arm the mid-tier sequence dwell timer (0x4009) to 0x50 (80 ticks)
; after the handler sets the next state
reloadSequenceDwellTimer:
070E: 2D              DEC     L                   ; step down to the dwell timer
070F: 36 50           LD      (HL),$50            ; re-arm the dwell timer to 80
0711: C9              RET                         ; done

; Set the sequence-state cell (0x400a) to 4 or 14 depending on mode bit
; 0x4006, then re-arm the sequence dwell timer (delegate 0x070e ->
; 0x4009).
setSequenceStateByModeAndReloadDwell:
0712: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode flag
0715: 0F              RRCA                        ; test its bit0
0716: 30 05           JR      NC,$071D            ; {code.loc_071d} clear -- set the sequence to state 14
0718: 36 04           LD      (HL),$04            ; set the sequence to state 4
071A: C3 0E 07        JP      $070E               ; {code.reloadSequenceDwellTimer} re-arm the dwell timer and return

loc_071d:
071D: 36 0E           LD      (HL),$0E            ; set the sequence to state 14
071F: C3 0E 07        JP      $070E               ; {code.reloadSequenceDwellTimer} re-arm the dwell timer and return

; Shared tail of state-6 handlers stepPlaySubstate6/stepAltPlaySubstate6:
; when mode flag 0x4006 bit0 is clear, advanceSubstateAndReloadDwell
; (advance the sub-state counter at HL, reload the dwell timer); when set,
; reset to state 1 -- GAME_STATE (0x4005)=1, clear 0x4006 and
; SEQUENCE_STATE (0x400a), silenceSoundAndDisableIrqStars, then enqueue
; command word 6.
advanceDwellOrResetToState1:
0722: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode flag
0725: 0F              RRCA                        ; test its bit0
0726: 30 E5           JR      NC,$070D            ; {code.advanceSubstateAndReloadDwell} clear -- just advance the sub-state and reload the dwell (carry on)
0728: 3E 01           LD      A,$01               ; game over: prepare state 1 (attract)
072A: 32 05 40        LD      ($4005),A           ; {hard.workRam+5} set the game state back to 1 -- attract
072D: AF              XOR     A                   ; zero A
072E: 32 06 40        LD      ($4006),A           ; {hard.workRam+6} clear the mode flag
0731: 32 0A 40        LD      ($400A),A           ; {hard.workRam+A} clear the sequence-state cell
0734: CD B5 1C        CALL    $1CB5               ; {code.silenceSoundAndDisableIrqStars} silence audio and halt the interrupt and starfield
0737: 11 00 06        LD      DE,$0600            ; command word: channel 6, parameter 0
073A: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} queue the final command word and return

; State-machine terminal (index 7 of runPlayerOnePlayFrame's table): on
; dwell-timer expiry, clear SEQUENCE_STATE/0x4222/0x422b, pack the flag
; bytes into PACKED_FLAG_BITMAP (0x4180) via 0x0764, copy the 8-byte
; template (0x4218) after it, set CURRENT_PLAYER (0x400d)=1 and GAME_STATE
; (0x4005)=4.
packFlagsToBitmapAndSwitchPlayerState:
073D: 21 09 40        LD      HL,$4009            ; point at the sequence dwell timer
0740: 35              DEC     (HL)                ; count the dwell down
0741: C0              RET     NZ                  ; still dwelling -- leave
0742: 2C              INC     L                   ; step up to the sequence-state cell
0743: AF              XOR     A                   ; zero A
0744: 77              LD      (HL),A              ; clear the sequence-state cell
0745: 32 22 42        LD      ($4222),A           ; {hard.workRam+222} clear the stage-advance pending word
0748: 32 2B 42        LD      ($422B),A           ; {hard.workRam+22B} clear the activity-timer arm flag
074B: 11 80 41        LD      DE,$4180            ; point DE at the player-1 packed board storage
074E: CD 64 07        CALL    $0764               ; {code.packFlagBytesToBitmask} pack the live formation into the 16-byte board bitmap
0751: 21 18 42        LD      HL,$4218            ; source: the 8-byte working template
0754: 01 08 00        LD      BC,$0008            ; copy 8 bytes
0757: ED B0           LDIR                        ; append the template after the packed board
0759: 3E 01           LD      A,$01               ; prepare player index 1
075B: 32 0D 40        LD      ($400D),A           ; {hard.workRam+D} set the active player to player 2
075E: 3E 04           LD      A,$04               ; prepare game state 4
0760: 32 05 40        LD      ($4005),A           ; {hard.workRam+5} hand the machine to the player-two play frame
0763: C9              RET                         ; done

; pack bit0 of the 128 flag bytes at FLAG_BITS_BASE (0x4100), LSB-first,
; into a 16-byte bitmap at (DE); returns DE advanced +16 for a chained
; block copy (exact inverse of unpackBitmaskToFlagBytes)
packFlagBytesToBitmask:
0764: 21 00 41        LD      HL,$4100            ; point HL at the 128 formation flag bytes
0767: 06 10           LD      B,$10               ; B counts the 16 output mask bytes
0769: 0E 01           LD      C,$01               ; C is the bit selector, starting at bit 0

loc_076b:
076B: AF              XOR     A                   ; clear the mask byte being built

loc_076c:
076C: CB 46           BIT     0,(HL)              ; test this flag cell's live-alien bit
076E: 28 01           JR      Z,$0771             ; {code.loc_0771} cell empty -- leave the bit clear
0770: B1              OR      C                   ; cell live -- set the corresponding bit

loc_0771:
0771: 23              INC     HL                  ; step to the next flag cell
0772: CB 01           RLC     C                   ; rotate the bit selector to the next bit
0774: 30 F6           JR      NC,$076C            ; {code.loc_076c} still filling this mask byte -- next cell
0776: 12              LD      (DE),A              ; store the completed mask byte
0777: 13              INC     DE                  ; advance the output pointer
0778: 10 F1           DJNZ    $076B               ; {code.loc_076b} loop until all 16 mask bytes are packed
077A: C9              RET                         ; done -- DE left past the packed bitmap

; Second player's play-state handler (game-state 4; sibling of
; runPlayerOnePlayFrame, differing at sub-states 2/6/7): run the per-frame
; formation prep, then tail-dispatch on SEQUENCE_STATE (0x400a) to one of
; eight play sub-states that restore/save via SAVED_STATE_SNAPSHOT
; (0x41a0); its terminal saves this board to 0x41a0, sets CURRENT_PLAYER=0
; and hands back to game-state 3.
runPlayerTwoPlayFrame:
077B: CD 0D 09        CALL    $090D               ; {code.advanceFormationSweepOscillator} sway the alien formation this frame
077E: CD 8E 09        CALL    $098E               ; {code.summarizeFormationOccupancy} fold the occupancy grid into its row/column summaries
0781: 3A 0A 40        LD      A,($400A)           ; {hard.workRam+A} read the sequence-state cell (the play sub-state)
0784: EF              RST     $28                 ; dispatch through the following handler table by that index

; ---- $0785-$0794: jump table ----
0785: 50 05 83 05 95 07 05 06 14 06 61 06 E8 07 18 08

; runPlayerTwoPlayFrame sub-state slot 2: expand the saved formation
; snapshot (SAVED_STATE_SNAPSHOT 0x41a0) into the flag block, copy the
; trailing 8-byte template into 0x4218, clear 0x425f/0x4220, mirror the
; flip flag 0x400f into the FLIP_SCREEN_X/Y latches when set, advance
; SEQUENCE_STATE, arm state timer 0x4009=150, publish the sub-state
; pointer into 0x4245, and enqueue five intro command words when the sound
; gate 0x4006 bit0 is open.
restoreSavedStateAndEnterPlaySubstate:
0795: 11 A0 41        LD      DE,$41A0            ; point DE at the player-2 saved board storage
0798: CD 46 06        CALL    $0646               ; {code.unpackBitmaskToFlagBytes} expand the saved board back into the 128 flag cells
079B: EB              EX      DE,HL               ; move the advanced source pointer (past the mask) into HL
079C: 11 18 42        LD      DE,$4218            ; destination: the 8-byte working template buffer
079F: 01 08 00        LD      BC,$0008            ; copy 8 bytes
07A2: ED B0           LDIR                        ; copy the trailing template into the working buffer
07A4: AF              XOR     A                   ; zero A
07A5: 32 5F 42        LD      ($425F),A           ; {hard.workRam+25F} reset the frame counter
07A8: 32 20 42        LD      ($4220),A           ; {hard.workRam+220} clear the region-clear flag
07AB: 3A 0F 40        LD      A,($400F)           ; {hard.workRam+F} read the screen-flip / cabinet config bit
07AE: A7              AND     A                   ; test it
07AF: 28 09           JR      Z,$07BA             ; {code.loc_07ba} not flipped -- skip the flip latches
07B1: 32 18 40        LD      ($4018),A           ; {hard.workRam+18} set the orientation flag
07B4: 32 06 70        LD      ($7006),A           ; set the screen-flip X latch
07B7: 32 07 70        LD      ($7007),A           ; set the screen-flip Y latch

loc_07ba:
07BA: 21 0A 40        LD      HL,$400A            ; point HL at the sequence-state cell
07BD: 34              INC     (HL)                ; advance to the next sub-state
07BE: 2D              DEC     L                   ; step down to the dwell timer
07BF: 36 96           LD      (HL),$96            ; arm a long dwell of 150
07C1: 21 30 08        LD      HL,$0830            ; load the deferred-callback handler pointer
07C4: 22 45 42        LD      ($4245),HL          ; {hard.workRam+245} publish it into the callback cell
07C7: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the sound gate
07CA: 0F              RRCA                        ; test its bit0
07CB: D0              RET     NC                  ; sound gate closed -- done
07CC: 11 03 05        LD      DE,$0503            ; command word: channel 5, parameter 3
07CF: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} queue it
07D2: 11 03 06        LD      DE,$0603            ; command word: channel 6, parameter 3
07D5: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} queue it
07D8: 1C              INC     E                   ; bump the parameter to 4
07D9: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} queue channel 6, parameter 4
07DC: 11 03 07        LD      DE,$0703            ; command word: channel 7, parameter 3
07DF: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} queue it
07E2: 11 00 07        LD      DE,$0700            ; command word: channel 7, parameter 0
07E5: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} queue the fifth intro cue and return

; Alternate play sub-state slot 6 handler (runPlayerTwoPlayFrame, game-
; state 4, restore-saved-formation path); mirror of stepPlaySubstate6
; keyed on advance gate 0x4195 + arm gate 0x421d: advance/redirect
; SEQUENCE_STATE (0x400a) and reload dwell 0x4009 (=80 or 130), queuing
; two channel-6 command words on the default inline advance
stepAltPlaySubstate6:
07E8: 21 0A 40        LD      HL,$400A            ; point HL at the sequence-state cell
07EB: 3A 1D 42        LD      A,($421D)           ; {hard.workRam+21D} read the arm/cycle gate
07EE: A7              AND     A                   ; test it
07EF: 20 1B           JR      NZ,$080C            ; {code.loc_080c} armed -- take the alternate branch
07F1: 3A 95 41        LD      A,($4195)           ; {hard.workRam+195} read the advance gate
07F4: A7              AND     A                   ; test it
07F5: CA 22 07        JP      Z,$0722             ; {code.advanceDwellOrResetToState1} clear -- drop to the shared advance/reset tail
07F8: 34              INC     (HL)                ; advance the sequence to the next sub-state
07F9: 2D              DEC     L                   ; step down to the dwell timer
07FA: 36 82           LD      (HL),$82            ; arm the dwell timer to 130
07FC: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the sound gate
07FF: 0F              RRCA                        ; test its bit0
0800: D0              RET     NC                  ; sound gate closed -- done
0801: 11 03 06        LD      DE,$0603            ; command word: channel 6, parameter 3
0804: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} queue it
0807: 1E 00           LD      E,$00               ; change the parameter to 0
0809: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} queue the second channel-6 command and return

loc_080c:
080C: 3A 95 41        LD      A,($4195)           ; {hard.workRam+195} read the advance gate
080F: A7              AND     A                   ; test it
0810: CA 12 07        JP      Z,$0712             ; {code.setSequenceStateByModeAndReloadDwell} clear -- jump to the by-mode state set
0813: 34              INC     (HL)                ; advance the sequence to the next sub-state
0814: 2D              DEC     L                   ; step down to the dwell timer
0815: 36 50           LD      (HL),$50            ; arm the dwell timer to 80
0817: C9              RET                         ; done

; Mirror terminal (index 7 of runPlayerTwoPlayFrame's table): on dwell-
; timer expiry, clear SEQUENCE_STATE, set CURRENT_PLAYER (0x400d)=0 and
; GAME_STATE (0x4005)=3, pack the flag bytes into SAVED_STATE_SNAPSHOT
; (0x41a0) via 0x0764, and copy the 8-byte companion block (0x4218) after
; it.
saveFlagsToSnapshotAndSwitchPlayerState:
0818: 21 09 40        LD      HL,$4009            ; point at the sequence dwell timer
081B: 35              DEC     (HL)                ; count the dwell down
081C: C0              RET     NZ                  ; still dwelling -- leave
081D: 2C              INC     L                   ; step up to the sequence-state cell
081E: AF              XOR     A                   ; zero A
081F: 77              LD      (HL),A              ; clear the sequence-state cell
0820: 32 0D 40        LD      ($400D),A           ; {hard.workRam+D} set the active player back to player 1
0823: 3E 03           LD      A,$03               ; prepare game state 3
0825: 32 05 40        LD      ($4005),A           ; {hard.workRam+5} hand the machine back to the player-one play frame
0828: 11 A0 41        LD      DE,$41A0            ; point DE at the player-2 saved board storage
082B: CD 64 07        CALL    $0764               ; {code.packFlagBytesToBitmask} pack the live formation into the snapshot bitmap
082E: 21 18 42        LD      HL,$4218            ; source: the 8-byte working template
0831: 01 08 00        LD      BC,$0008            ; copy 8 bytes
0834: ED B0           LDIR                        ; append the template after the packed snapshot
0836: C9              RET                         ; done

; When active, step the input/AI-controlled object one unit along its axis
; (clamped to [23,233]); when inactive, park position at 0 or stage
; current position under the alternate code; then stage the negated
; position + code as four (value,code) pairs into OBJ_STAGE_BLOCK.
moveControlledObjectAndStageSprite:
0837: 21 00 42        LD      HL,$4200            ; point HL at the object-active flag
083A: CB 46           BIT     0,(HL)              ; is the ship subsystem switched on?
083C: 28 39           JR      Z,$0877             ; {code.loc_0877} ship not active -- take the parked-ship branch
083E: 2C              INC     L                   ; step past the alternate-mode flag
083F: 2C              INC     L                   ; point at the ship's X position cell
0840: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode flag
0843: 0F              RRCA                        ; shift its bit 0 into carry
0844: D2 92 08        JP      NC,$0892            ; {code.loc_0892} demo mode -- take the auto-pilot move command instead of a controller
0847: 3A 18 40        LD      A,($4018)           ; {hard.workRam+18} read the orientation flag
084A: 0F              RRCA                        ; shift its bit 0 into carry
084B: 38 3F           JR      C,$088C             ; {code.loc_088c} cabinet flipped -- read the second control port
084D: 3A 10 40        LD      A,($4010)           ; {hard.workRam+10} read the first input port shadow (the joystick)

loc_0850:
0850: 47              LD      B,A                 ; keep the movement bits in B
0851: CB 5F           BIT     3,A                 ; test the move-down bit
0853: 28 06           JR      Z,$085B             ; {code.loc_085b} not pressed -- skip the down step
0855: 7E              LD      A,(HL)              ; read the ship's current X
0856: FE 17           CP      $17                 ; compare against the low limit (23)
0858: 38 01           JR      C,$085B             ; {code.loc_085b} at the bottom edge -- don't step past it
085A: 35              DEC     (HL)                ; nudge the ship one pixel down

loc_085b:
085B: CB 50           BIT     2,B                 ; test the move-up bit
085D: 28 06           JR      Z,$0865             ; {code.loc_0865} not pressed -- skip the up step
085F: 7E              LD      A,(HL)              ; read the ship's current X
0860: FE E9           CP      $E9                 ; compare against the top limit (233)
0862: 30 01           JR      NC,$0865            ; {code.loc_0865} at the top edge -- don't step past it
0864: 34              INC     (HL)                ; nudge the ship one pixel up

loc_0865:
0865: 7E              LD      A,(HL)              ; read the ship's final X
0866: 2F              CPL                         ; one's-complement it for the sprite
0867: C6 80           ADD     A,$80               ; offset by 128 to make the on-screen sprite value
0869: 0E 06           LD      C,$06               ; use ship sprite code 6

loc_086b:
086B: 21 54 40        LD      HL,$4054            ; point at the ship's sprite staging block
086E: 06 04           LD      B,$04               ; four sprite copies to write

loc_0870:
0870: 77              LD      (HL),A              ; store the ship sprite value
0871: 2C              INC     L                   ; step to the code cell
0872: 71              LD      (HL),C              ; store the sprite code
0873: 2C              INC     L                   ; step to the next staging pair
0874: 10 FA           DJNZ    $0870               ; {code.loc_0870} loop over all four copies
0876: C9              RET                         ; done staging the ship

loc_0877:
0877: 2C              INC     L                   ; point at the alternate-mode flag
0878: CB 46           BIT     0,(HL)              ; is the death/animation pose set?
087A: 20 06           JR      NZ,$0882            ; {code.loc_0882} yes -- stage the death pose
087C: 2C              INC     L                   ; point at the ship's X cell
087D: 36 00           LD      (HL),$00            ; slam the ship position to zero
087F: C3 65 08        JP      $0865               ; {code.loc_0865} stage the parked ship

loc_0882:
0882: 2C              INC     L                   ; point at the ship's X cell
0883: 7E              LD      A,(HL)              ; read the frozen ship X
0884: 2F              CPL                         ; one's-complement it for the sprite
0885: C6 80           ADD     A,$80               ; offset by 128
0887: 0E 07           LD      C,$07               ; use the death-pose sprite code 7
0889: C3 6B 08        JP      $086B               ; {code.loc_086b} stage the death pose

loc_088c:
088C: 3A 11 40        LD      A,($4011)           ; {hard.workRam+11} read the second input port shadow
088F: C3 50 08        JP      $0850               ; {code.loc_0850} apply those movement bits

loc_0892:
0892: 3A 3F 42        LD      A,($423F)           ; {hard.workRam+23F} read the auto-pilot move command
0895: C3 50 08        JP      $0850               ; {code.loc_0850} apply those movement bits

; Service the player shot (advancePlayerShot 0x08bc), then stage its two
; sprite render cells: 0x409f = (0x4018 bit0 ? counter-1 : ~counter+252)
; and 0x409d = ~field, from {0x4209,0x420a}.
advancePlayerShotAndStageSprite:
0898: CD BC 08        CALL    $08BC               ; {code.advancePlayerShot} advance the player's shot for this frame
089B: 2A 09 42        LD      HL,($4209)          ; {hard.workRam+209} load the shot's climb counter and column together
089E: 3A 18 40        LD      A,($4018)           ; {hard.workRam+18} read the orientation flag
08A1: 0F              RRCA                        ; shift its bit 0 into carry
08A2: 38 0D           JR      C,$08B1             ; {code.loc_08b1} screen flipped -- take the flipped X formula
08A4: 7D              LD      A,L                 ; take the shot's climb counter
08A5: 2F              CPL                         ; complement it
08A6: C6 FC           ADD     A,$FC               ; add 252 to form the drawn shot X
08A8: 32 9F 40        LD      ($409F),A           ; {hard.workRam+9F} write the shot's render X cell
08AB: 7C              LD      A,H                 ; take the shot's column byte
08AC: 2F              CPL                         ; complement it into the code
08AD: 32 9D 40        LD      ($409D),A           ; {hard.workRam+9D} write the shot's render code cell
08B0: C9              RET                         ; done staging the shot

loc_08b1:
08B1: 7D              LD      A,L                 ; take the shot's climb counter
08B2: 3D              DEC     A                   ; subtract one for the flipped X
08B3: 32 9F 40        LD      ($409F),A           ; {hard.workRam+9F} write the shot's render X cell
08B6: 7C              LD      A,H                 ; take the shot's column byte
08B7: 2F              CPL                         ; complement it into the code
08B8: 32 9D 40        LD      ($409D),A           ; {hard.workRam+9D} write the shot's render code cell
08BB: C9              RET                         ; done staging the shot

; Drive the single player shot: while the gate (0x4208 bit0) is armed,
; drain the position counter (0x4209) by 4/frame and raise the retire flag
; (0x420b) as it lands in the near-end window [14,17]; when idle, reset
; the counter to 220 (parked at the bottom) and seed the field (0x420a)
; from the player X (0x4202).
advancePlayerShot:
08BC: 21 08 42        LD      HL,$4208            ; point at the shot in-flight gate
08BF: CB 46           BIT     0,(HL)              ; is a shot in the air?
08C1: 23              INC     HL                  ; point at the shot's climb counter
08C2: 28 0F           JR      Z,$08D3             ; {code.loc_08d3} no shot flying -- go park a fresh one
08C4: 7E              LD      A,(HL)              ; read the shot's climb counter
08C5: D6 04           SUB     $04                 ; climb the bullet four pixels up the screen
08C7: 77              LD      (HL),A              ; store the new position
08C8: D6 0E           SUB     $0E                 ; begin the test for how close it is to the top
08CA: D6 04           SUB     $04                 ; finish the top-window test
08CC: D0              RET     NC                  ; not yet at the top -- done
08CD: 3E 01           LD      A,$01               ; load flag value 1
08CF: 32 0B 42        LD      ($420B),A           ; {hard.workRam+20B} raise the shot-retire request
08D2: C9              RET                         ; done

loc_08d3:
08D3: 36 DC           LD      (HL),$DC            ; park the shot counter at 220 (bottom of screen)
08D5: 2C              INC     L                   ; point at the shot's column cell
08D6: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-active flag
08D9: CB 47           BIT     0,A                 ; is play live?
08DB: 28 05           JR      Z,$08E2             ; {code.loc_08e2} not live -- seed the column to zero
08DD: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the ship's X
08E0: 77              LD      (HL),A              ; seed the shot's column from the ship
08E1: C9              RET                         ; done

loc_08e2:
08E2: 36 00           LD      (HL),$00            ; seed the shot's column to zero
08E4: C9              RET                         ; done

; When request flag 0x420b bit0 is pending, acknowledge it (clear 0x420b)
; and clear the behavior gate 0x4208 that
; runGameplayFrameAndAdvanceOnFieldClear/advanceFormationSweepOscillator
; test.
clearGateOnPendingRequest:
08E5: 3A 0B 42        LD      A,($420B)           ; {hard.workRam+20B} read the shot-retire request flag
08E8: 0F              RRCA                        ; shift its bit 0 into carry
08E9: D0              RET     NC                  ; no pending retire -- done
08EA: AF              XOR     A                   ; zero A
08EB: 32 0B 42        LD      ($420B),A           ; {hard.workRam+20B} clear the retire request
08EE: 32 08 42        LD      ($4208),A           ; {hard.workRam+208} clear the shot in-flight gate so a new shot can fire
08F1: C9              RET                         ; done

; Append a 16-bit command word (D:E) to the command queue at write-head
; 0x40a0 when the head slot is free (bit7 set): store hi byte at the slot,
; lo byte at slot+1, then advance/commit the head (clamped up to floor
; 0xc0).
enqueueCommandWord:
08F2: E5              PUSH    HL                  ; save HL across the enqueue
08F3: 26 40           LD      H,$40               ; high byte of the command-queue page
08F5: 3A A0 40        LD      A,($40A0)           ; {hard.workRam+A0} read the queue write head
08F8: 6F              LD      L,A                 ; point at the head slot
08F9: CB 7E           BIT     7,(HL)              ; is this slot free?
08FB: 28 0E           JR      Z,$090B             ; {code.loc_090b} slot busy -- drop the command
08FD: 72              LD      (HL),D              ; store the channel selector
08FE: 2C              INC     L                   ; step to the parameter cell
08FF: 73              LD      (HL),E              ; store the parameter byte
0900: 2C              INC     L                   ; advance the write head
0901: 7D              LD      A,L                 ; take the new head
0902: FE C0           CP      $C0                 ; compare against the queue floor (0xc0)
0904: 30 02           JR      NC,$0908            ; {code.commitQueueWriteHead} still in range -- keep it
0906: 3E C0           LD      A,$C0               ; wrap the head back up to the floor

; Persist the advanced write-head index (0x40a0) back to the command/event
; queue after an enqueue, then return via the shared stack epilogue $090B.
commitQueueWriteHead:
0908: 32 A0 40        LD      ($40A0),A           ; {hard.workRam+A0} store the advanced write head

loc_090b:
090B: E1              POP     HL                  ; restore HL
090C: C9              RET                         ; done

; Per-frame formation sway: once every 4 frames step the swept 16-bit
; formation word 0x420e one unit toward the FORMATION_X_BOUNDS pair,
; flipping OBJ_SWEEP_DIRECTION (0x420d) at each bound via
; setSweepDescending (0x097d, upper bound) / setSweepAscending (0x0983,
; lower bound), then broadcast the negated low byte across the strided
; per-column table; a leading proximity gate (armed shot lined up on the
; swept column, that column occupied) shortcuts straight to
; broadcastNegatedFormationSweepToStridedTable. Drives the whole alien
; formation's side-to-side oscillation.
advanceFormationSweepOscillator:
090D: 21 08 42        LD      HL,$4208            ; point at the shot in-flight gate
0910: CB 46           BIT     0,(HL)              ; is a shot armed?
0912: 28 2A           JR      Z,$093E             ; {code.loc_093e} no shot -- march the formation normally
0914: 2C              INC     L                   ; point at the shot's climb counter
0915: 7E              LD      A,(HL)              ; read the shot's climb counter
0916: D6 22           SUB     $22                 ; shift into the formation's vertical band
0918: FE 50           CP      $50                 ; is the shot within the block's rows?
091A: 30 22           JR      NC,$093E            ; {code.loc_093e} shot below the block's rows -- march normally
091C: 2C              INC     L                   ; point at the shot's column cell
091D: 3A 0E 42        LD      A,($420E)           ; {hard.workRam+20E} read the formation anchor's low byte
0920: 96              SUB     (HL)                ; measure the shot's offset from the anchor
0921: ED 44           NEG                         ; flip the sign of the offset
0923: 47              LD      B,A                 ; keep the offset in B
0924: C6 02           ADD     A,$02               ; center the alignment window
0926: E6 0F           AND     $0F                 ; look at the fine column offset
0928: FE 03           CP      $03                 ; is the shot lined up under the marching column?
092A: 30 12           JR      NC,$093E            ; {code.loc_093e} not lined up -- march normally
092C: 78              LD      A,B                 ; recover the offset
092D: 0F              RRCA                        ; shift out the column index
092E: 0F              RRCA                        ; shift again
092F: 0F              RRCA                        ; shift again
0930: 0F              RRCA                        ; shift again (offset now in the low nibble)
0931: E6 0F           AND     $0F                 ; isolate the target column number
0933: 5F              LD      E,A                 ; column index low byte
0934: 16 00           LD      D,$00               ; column index high byte zero
0936: 21 F0 41        LD      HL,$41F0            ; point at the column-occupancy summary
0939: 19              ADD     HL,DE               ; index the targeted column
093A: CB 46           BIT     0,(HL)              ; is that column still holding aliens?
093C: 20 4A           JR      NZ,$0988            ; {code.broadcastNegatedFormationSweepToStridedTable} occupied -- freeze the march so the shot's column stays put

loc_093e:
093E: 2A 0E 42        LD      HL,($420E)          ; {hard.workRam+20E} load the 16-bit formation anchor
0941: ED 5B 10 42     LD      DE,($4210)          ; {hard.workRam+210} load the formation's low and high X bounds
0945: 3A 0D 42        LD      A,($420D)           ; {hard.workRam+20D} read the sweep direction flag
0948: A7              AND     A                   ; test which way the block is marching
0949: 20 12           JR      NZ,$095D            ; {code.loc_095d} marching the other way -- take that branch
094B: CB 7C           BIT     7,H                 ; check the anchor's high-byte sign
094D: 20 04           JR      NZ,$0953            ; {code.loc_0953} past the wrap -- skip the bound check
094F: 7D              LD      A,L                 ; anchor low byte
0950: BB              CP      E                   ; compare against the low bound
0951: 30 2A           JR      NC,$097D            ; {code.setSweepDescending} reached the low bound -- turn the block around

loc_0953:
0953: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the frame counter
0956: E6 03           AND     $03                 ; only step one frame in four
0958: C0              RET     NZ                  ; not this frame -- done
0959: 23              INC     HL                  ; step the anchor one unit up
095A: C3 6C 09        JP      $096C               ; {code.loc_096c} commit the new anchor

loc_095d:
095D: CB 7C           BIT     7,H                 ; check the anchor's high-byte sign
095F: 28 04           JR      Z,$0965             ; {code.loc_0965} not past the wrap -- check the bound
0961: 7D              LD      A,L                 ; anchor low byte
0962: BA              CP      D                   ; compare against the high bound
0963: 38 1E           JR      C,$0983             ; {code.setSweepAscending} reached the high bound -- turn the block around

loc_0965:
0965: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the frame counter
0968: E6 03           AND     $03                 ; only step one frame in four
096A: C0              RET     NZ                  ; not this frame -- done
096B: 2B              DEC     HL                  ; step the anchor one unit down

loc_096c:
096C: 22 0E 42        LD      ($420E),HL          ; {hard.workRam+20E} store the advanced formation anchor

; Compute the two's-complement of the formation-sweep low byte (L) and
; broadcast it across the strided work-RAM table 0x4028,0x402a,...,0x4038
; via broadcastToStridedTable.
broadcastNegatedSweepToStridedTable:
096F: 7D              LD      A,L                 ; take the anchor's low byte
0970: ED 44           NEG                         ; negate it for the coordinate lane

; Broadcast the byte in A across the 9-cell stride-2 work-RAM table at
; 0x4028 (0x4028,0x402a,...,0x4038).
broadcastToStridedTable:
0972: 21 28 40        LD      HL,$4028            ; point at the object shadow's coordinate lane
0975: 06 09           LD      B,$09               ; nine cells to update

loc_0977:
0977: 77              LD      (HL),A              ; write the swept column coordinate
0978: 2C              INC     L                   ; skip the interleaved code cell
0979: 2C              INC     L                   ; step to the next coordinate cell
097A: 10 FB           DJNZ    $0977               ; {code.loc_0977} broadcast across all nine sprites
097C: C9              RET                         ; done

; Set object sweep-direction flag 0x420d (OBJ_SWEEP_DIRECTION) to 1,
; switching the oscillator to its decreasing/descending phase; called by
; advanceFormationSweepOscillator when the swept 0x420e word reaches the
; upper bound.
setSweepDescending:
097D: 3E 01           LD      A,$01               ; direction value for marching the other way
097F: 32 0D 42        LD      ($420D),A           ; {hard.workRam+20D} set the block to march the other way
0982: C9              RET                         ; done

; Clear object sweep-direction flag 0x420d (OBJ_SWEEP_DIRECTION) to 0,
; switching the oscillator to its increasing/ascending phase; called by
; advanceFormationSweepOscillator when the swept 0x420e word reaches the
; lower bound.
setSweepAscending:
0983: AF              XOR     A                   ; direction value for marching back
0984: 32 0D 42        LD      ($420D),A           ; {hard.workRam+20D} set the block to march back
0987: C9              RET                         ; done

; Load the swept formation word (0x420e) and tail-jump into
; broadcastNegatedSweepToStridedTable (0x096f), which stores -(low byte)
; across the strided work-RAM table 0x4028,0x402a,...,0x4038.
broadcastNegatedFormationSweepToStridedTable:
0988: 2A 0E 42        LD      HL,($420E)          ; {hard.workRam+20E} load the current formation anchor unchanged
098B: C3 6F 09        JP      $096F               ; {code.broadcastNegatedSweepToStridedTable} re-publish it without marching

; Reduce the occupancy grid (0x4123) into per-row OR summaries
; (ROW_OCCUPANCY 0x41e8, behind 2 guard cells) and per-column OR summaries
; (COLUMN_OCCUPANCY 0x41f0, behind 3 guards), derive the horizontal sweep
; bound pair scanned inward from each end into FORMATION_X_BOUNDS
; (0x4210), and fold four region-clear flags (0x4220/0x4221/0x4225/0x4226)
; from the row summaries and two object-table columns.
summarizeFormationOccupancy:
098E: AF              XOR     A                   ; zero A
098F: 11 E8 41        LD      DE,$41E8            ; point at the row-occupancy summaries (guards first)
0992: 12              LD      (DE),A              ; clear the first guard cell
0993: 1C              INC     E                   ; step
0994: 12              LD      (DE),A              ; clear the second guard cell
0995: 1C              INC     E                   ; step to the first row summary
0996: 0E 06           LD      C,$06               ; six formation rows to fold
0998: 21 23 41        LD      HL,$4123            ; point at the occupancy grid

loc_099b:
099B: 06 0A           LD      B,$0A               ; ten columns per row
099D: AF              XOR     A                   ; clear the row accumulator

loc_099e:
099E: B6              OR      (HL)                ; OR in this cell's occupancy
099F: 2C              INC     L                   ; next column
09A0: 10 FC           DJNZ    $099E               ; {code.loc_099e} fold the whole row together
09A2: 12              LD      (DE),A              ; store this row's occupancy summary
09A3: 1C              INC     E                   ; next summary slot
09A4: 7D              LD      A,L                 ; advance the grid pointer
09A5: C6 06           ADD     A,$06               ; skip to the next row (16-byte stride)
09A7: 6F              LD      L,A                 ; update the pointer
09A8: 0D              DEC     C                   ; one row done
09A9: C2 9B 09        JP      NZ,$099B            ; {code.loc_099b} loop over all six rows
09AC: AF              XOR     A                   ; zero A
09AD: 12              LD      (DE),A              ; clear a column-summary guard cell
09AE: 1C              INC     E                   ; step
09AF: 12              LD      (DE),A              ; clear another guard cell
09B0: 1C              INC     E                   ; step
09B1: 12              LD      (DE),A              ; clear the third guard cell
09B2: 1C              INC     E                   ; step to the first column summary
09B3: 21 23 41        LD      HL,$4123            ; point back at the occupancy grid
09B6: 0E 0A           LD      C,$0A               ; ten formation columns to fold

loc_09b8:
09B8: D5              PUSH    DE                  ; save the summary pointer
09B9: 11 10 00        LD      DE,$0010            ; row-to-row stride of 16
09BC: 06 06           LD      B,$06               ; six rows per column
09BE: AF              XOR     A                   ; clear the column accumulator

loc_09bf:
09BF: B6              OR      (HL)                ; OR in this cell's occupancy
09C0: 19              ADD     HL,DE               ; step down a row
09C1: 10 FC           DJNZ    $09BF               ; {code.loc_09bf} fold the whole column together
09C3: D1              POP     DE                  ; restore the summary pointer
09C4: 12              LD      (DE),A              ; store this column's occupancy summary
09C5: 1C              INC     E                   ; next column slot
09C6: 7D              LD      A,L                 ; back the grid pointer up
09C7: D6 5F           SUB     $5F                 ; return to the next column's top cell
09C9: 6F              LD      L,A                 ; update the pointer
09CA: 0D              DEC     C                   ; one column done
09CB: C2 B8 09        JP      NZ,$09B8            ; {code.loc_09b8} loop over all ten columns
09CE: 21 FC 41        LD      HL,$41FC            ; point at the rightmost column summary
09D1: 06 0A           LD      B,$0A               ; ten columns to scan for the block's extent
09D3: 1E 22           LD      E,$22               ; start the right-edge X bound at 34

loc_09d5:
09D5: CB 46           BIT     0,(HL)              ; test bit 0 of the column-occupancy cell -- is this column of the alien block occupied?
09D7: 20 09           JR      NZ,$09E2            ; {code.loc_09e2} occupied column found -- stop scanning; E holds the low-byte X bound
09D9: 2D              DEC     L                   ; step the pointer back to the next column inward from the right
09DA: 7B              LD      A,E                 ; pull the running low bound into A
09DB: C6 10           ADD     A,$10               ; add 16 -- one empty column widens the block's right edge by 16 pixels
09DD: 5F              LD      E,A                 ; stash the widened low bound back in E
09DE: 10 F5           DJNZ    $09D5               ; {code.loc_09d5} loop across all ten columns from the right
09E0: 1E 22           LD      E,$22               ; whole block empty -- reset the low X bound to 34

loc_09e2:
09E2: 21 F3 41        LD      HL,$41F3            ; point at the column-occupancy summaries again, this time the left end
09E5: 06 0A           LD      B,$0A               ; B = 10 columns to scan from the left
09E7: 16 E0           LD      D,$E0               ; seed the high-byte X bound at 224

loc_09e9:
09E9: CB 46           BIT     0,(HL)              ; is this column occupied, scanning inward from the left?
09EB: 20 09           JR      NZ,$09F6            ; {code.loc_09f6} occupied column found -- stop; D holds the high-byte X bound
09ED: 2C              INC     L                   ; step to the next column inward from the left
09EE: 7A              LD      A,D                 ; pull the running high bound into A
09EF: D6 10           SUB     $10                 ; subtract 16 -- one empty column pulls the left edge in by 16 pixels
09F1: 57              LD      D,A                 ; stash the narrowed high bound back in D
09F2: 10 F5           DJNZ    $09E9               ; {code.loc_09e9} loop across all ten columns from the left
09F4: 16 E0           LD      D,$E0               ; whole block empty -- reset the high X bound to 224

loc_09f6:
09F6: ED 53 10 42     LD      ($4210),DE          ; {hard.workRam+210} store the horizontal extent {high,low} into the formation X-bounds pair
09FA: 21 EA 41        LD      HL,$41EA            ; point at the per-row occupancy summaries (past the guard cells)
09FD: 0E 01           LD      C,$01               ; C = 1, the XOR mask that turns "any occupied" into a clear flag
09FF: 06 04           LD      B,$04               ; B = 4, the top four formation rows
0A01: AF              XOR     A                   ; clear the OR accumulator

loc_0a02:
0A02: B6              OR      (HL)                ; OR in this row's occupancy summary
0A03: 2C              INC     L                   ; step to the next row summary
0A04: 10 FC           DJNZ    $0A02               ; {code.loc_0a02} loop over the top four rows
0A06: A9              XOR     C                   ; flip bit 0 -- now set means "top four rows are empty"
0A07: 32 21 42        LD      ($4221),A           ; {hard.workRam+221} store the top-four-rows clear flag
0A0A: A9              XOR     C                   ; flip bit 0 back so the accumulator reads plain occupancy again
0A0B: B6              OR      (HL)                ; OR in the fifth row summary
0A0C: 2C              INC     L                   ; step to the next row summary
0A0D: B6              OR      (HL)                ; OR in the sixth row summary
0A0E: A9              XOR     C                   ; flip bit 0 -- set means "all six rows empty"
0A0F: 32 20 42        LD      ($4220),A           ; {hard.workRam+220} store the all-rows clear flag
0A12: 21 D0 42        LD      HL,$42D0            ; point at the eight-slot object record array (byte 0 of each)
0A15: 11 20 00        LD      DE,$0020            ; stride is 32 bytes -- one full object record
0A18: 06 07           LD      B,$07               ; B = 7 object-table slots
0A1A: AF              XOR     A                   ; clear the OR accumulator

loc_0a1b:
0A1B: B6              OR      (HL)                ; OR in this object slot's active byte
0A1C: 19              ADD     HL,DE               ; advance one whole record forward
0A1D: 10 FC           DJNZ    $0A1B               ; {code.loc_0a1b} loop over the seven object slots
0A1F: A9              XOR     C                   ; flip bit 0 -- set means "no active objects in those seven slots"
0A20: 32 26 42        LD      ($4226),A           ; {hard.workRam+226} store the object-table clear flag
0A23: A9              XOR     C                   ; flip bit 0 back to plain occupancy
0A24: 21 B1 42        LD      HL,$42B1            ; point at the eight object records' byte 1 (the dying/secondary flag)
0A27: 06 08           LD      B,$08               ; B = 8 slots this time

loc_0a29:
0A29: B6              OR      (HL)                ; OR in this slot's secondary/dying flag
0A2A: 19              ADD     HL,DE               ; advance one whole record forward
0A2B: 10 FC           DJNZ    $0A29               ; {code.loc_0a29} loop over the eight slots
0A2D: A9              XOR     C                   ; flip bit 0 -- set means "that eight-slot field is empty"
0A2E: 32 25 42        LD      ($4225),A           ; {hard.workRam+225} store the eight-slot clear flag
0A31: C9              RET                         ; occupancy summary done -- return

; When enabled (OBJ_ACTIVE_FLAG 0x4200 bit0 set) and not already armed
; (0x4208 bit0 clear): on the timer path (0x4006 bit0 clear) arm the gate
; 0x4208 only when the low 5 bits of 0x425f are zero (~every 32 frames);
; on the input path (0x4006 bit0 set) test bit4 of the selected input
; shadow (0x4010/0x4011 via 0x4018) masked by its guard (0x4013/0x4014)
; and, if active, arm both the gate 0x4208 and companion flag 0x41cc.
armBehaviorGateOnInputOrTimer:
0A32: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-subsystem master switch
0A35: 0F              RRCA                        ; rotate its bit 0 into carry -- is play active?
0A36: D0              RET     NC                  ; subsystem off -- nothing to arm, return
0A37: 3A 08 42        LD      A,($4208)           ; {hard.workRam+208} read the player-shot gate
0A3A: 0F              RRCA                        ; rotate its bit 0 into carry -- is a shot already in flight?
0A3B: D8              RET     C                   ; shot already airborne -- return, don't re-arm
0A3C: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode flag -- live control versus demo autopilot
0A3F: 0F              RRCA                        ; rotate its bit 0 into carry
0A40: 30 26           JR      NC,$0A68            ; {code.loc_0a68} demo mode -- take the timer-fire path
0A42: 3A 18 40        LD      A,($4018)           ; {hard.workRam+18} read the orientation flag
0A45: 0F              RRCA                        ; rotate its bit 0 into carry -- which control port to sample?
0A46: 38 15           JR      C,$0A5D             ; {code.loc_0a5d} flipped cabinet -- read the second input port instead
0A48: 3A 13 40        LD      A,($4013)           ; {hard.workRam+13} read last frame's port-1 reading (the fire-edge guard)
0A4B: 2F              CPL                         ; complement it so a fresh press shows as an edge
0A4C: 47              LD      B,A                 ; hold the edge guard in B
0A4D: 3A 10 40        LD      A,($4010)           ; {hard.workRam+10} read this frame's port-1 input shadow

loc_0a50:
0A50: A0              AND     B                   ; AND with the guard -- keep only newly-pressed bits
0A51: E6 10           AND     $10                 ; isolate bit 4, the fire button
0A53: C8              RET     Z                   ; fire not pressed this frame -- return
0A54: 3E 01           LD      A,$01               ; load 1
0A56: 32 08 42        LD      ($4208),A           ; {hard.workRam+208} arm the player-shot gate -- a shot is now in flight
0A59: 32 CC 41        LD      ($41CC),A           ; {hard.workRam+1CC} set the companion fire flag
0A5C: C9              RET                         ; return

loc_0a5d:
0A5D: 3A 14 40        LD      A,($4014)           ; {hard.workRam+14} read last frame's port-2 reading (the fire-edge guard)
0A60: 2F              CPL                         ; complement it into an edge mask
0A61: 47              LD      B,A                 ; hold the edge guard in B
0A62: 3A 11 40        LD      A,($4011)           ; {hard.workRam+11} read this frame's port-2 input shadow
0A65: C3 50 0A        JP      $0A50               ; {code.loc_0a50} rejoin the shared fire-arm test

loc_0a68:
0A68: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} demo path -- read the free-running frame counter
0A6B: E6 1F           AND     $1F                 ; keep the low five bits
0A6D: C0              RET     NZ                  ; not on a 32-frame boundary -- return, don't fire yet
0A6E: 3E 01           LD      A,$01               ; load 1
0A70: 32 08 42        LD      ($4208),A           ; {hard.workRam+208} arm the player-shot gate -- the autopilot fires
0A73: C9              RET                         ; return

; Integrate and render the 7 moving-object records at 0x4260 (each two
; 5-byte sub-slots; a phase bit 0x425f picks the leading sub-slot):
; advance sub-position (deactivate on overflow), integrate the 16-bit
; position by 2x the signed velocity, deactivate when it leaves the
; vertical window, and write each sprite's Y and code into the sprite
; shadow at 0x4081 (mirrored by direction flag 0x4018, +/-1 code nudge on
; the first three).
advanceAndRenderProjectiles:
0A74: DD 21 60 42     LD      IX,$4260            ; point IX at the enemy-projectile record table
0A78: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the free-running frame counter
0A7B: 0F              RRCA                        ; rotate bit 0 into carry -- the alternating sub-slot phase bit
0A7C: 38 0B           JR      C,$0A89             ; {code.loc_0a89} on the odd phase the first sub-slot already leads -- skip ahead
0A7E: DD 34 01        INC     (IX+$01)            ; nudge the trailing sub-slot's Y source up by one
0A81: DD 34 01        INC     (IX+$01)            ; nudge it again -- two pixels this frame
0A84: 11 05 00        LD      DE,$0005            ; sub-slot stride is 5 bytes
0A87: DD 19           ADD     IX,DE               ; advance IX so the second sub-slot becomes the leading one

loc_0a89:
0A89: FD 21 81 40     LD      IY,$4081            ; point IY at the enemy-bullet sprite shadow band
0A8D: 06 07           LD      B,$07               ; B = 7 projectile records

loc_0a8f:
0A8F: DD CB 00 46     BIT     0,(IX+$00)          ; is this record's leading bullet active?
0A93: 28 27           JR      Z,$0ABC             ; {code.loc_0abc} inactive -- skip to the deactivate/blank branch
0A95: DD 7E 01        LD      A,(IX+$01)          ; read the bullet's Y-source sub-position
0A98: C6 02           ADD     A,$02               ; step it down two pixels
0A9A: DD 77 01        LD      (IX+$01),A          ; store the advanced sub-position
0A9D: C6 04           ADD     A,$04               ; probe four further -- did the bullet run off the bottom?
0A9F: 38 1B           JR      C,$0ABC             ; {code.loc_0abc} overflowed -- deactivate this bullet
0AA1: DD 6E 02        LD      L,(IX+$02)          ; load the 16-bit bullet position, low byte
0AA4: DD 66 03        LD      H,(IX+$03)          ; load the high byte
0AA7: DD 5E 04        LD      E,(IX+$04)          ; read the bullet's signed velocity byte
0AAA: CB 13           RL      E                   ; shift it left -- doubling it and exposing its sign in carry
0AAC: 9F              SBC     A,A                 ; sign-extend the velocity into A (0x00 or 0xff)
0AAD: 57              LD      D,A                 ; D holds the sign extension -- DE is now 2x the signed velocity
0AAE: 19              ADD     HL,DE               ; integrate: advance the position by twice the velocity
0AAF: DD 75 02        LD      (IX+$02),L          ; store the new position low byte
0AB2: DD 74 03        LD      (IX+$03),H          ; store the new position high byte
0AB5: 7C              LD      A,H                 ; take the position high byte
0AB6: C6 10           ADD     A,$10               ; bias it by 16
0AB8: FE 20           CP      $20                 ; compare against the vertical play window
0ABA: 30 0A           JR      NC,$0AC6            ; {code.loc_0ac6} still on screen -- go render the sprite

loc_0abc:
0ABC: AF              XOR     A                   ; clear A for the deactivation writes
0ABD: DD 77 00        LD      (IX+$00),A          ; clear the active flag -- retire this bullet
0AC0: DD 77 01        LD      (IX+$01),A          ; clear its Y sub-position
0AC3: DD 77 03        LD      (IX+$03),A          ; clear its position high byte

loc_0ac6:
0AC6: 3A 18 40        LD      A,($4018)           ; {hard.workRam+18} read the orientation flag
0AC9: 0F              RRCA                        ; rotate its bit 0 into carry -- is the screen flipped?
0ACA: 38 29           JR      C,$0AF5             ; {code.loc_0af5} flipped -- take the mirrored Y formula
0ACC: DD 7E 01        LD      A,(IX+$01)          ; read the bullet's Y sub-position
0ACF: 2F              CPL                         ; complement it -- mirror to screen coordinates
0AD0: 3D              DEC     A                   ; minus one
0AD1: FD 77 02        LD      (IY+$02),A          ; write the bullet sprite's Y into the shadow
0AD4: DD 7E 03        LD      A,(IX+$03)          ; read the bullet's position high byte
0AD7: 2F              CPL                         ; complement it into a sprite code
0AD8: 4F              LD      C,A                 ; hold the code in C
0AD9: 78              LD      A,B                 ; fetch the record index (counting down from 7)
0ADA: FE 05           CP      $05                 ; is this record among the top three?
0ADC: 38 01           JR      C,$0ADF             ; {code.loc_0adf} not the first three -- skip the code nudge
0ADE: 0C              INC     C                   ; nudge the code by one so those three bullets draw a different tile

loc_0adf:
0ADF: FD 71 00        LD      (IY+$00),C          ; write the bullet sprite's code into the shadow
0AE2: 11 05 00        LD      DE,$0005            ; sub-slot stride is 5 bytes
0AE5: DD 19           ADD     IX,DE               ; advance IX to the other sub-slot
0AE7: DD 34 01        INC     (IX+$01)            ; nudge that sub-slot's Y source up by one
0AEA: DD 34 01        INC     (IX+$01)            ; and again -- two pixels
0AED: DD 19           ADD     IX,DE               ; advance IX past to the next record's leading sub-slot
0AEF: 1D              DEC     E                   ; E = 4, one sprite-shadow record's width
0AF0: FD 19           ADD     IY,DE               ; advance IY to the next bullet sprite slot
0AF2: 10 9B           DJNZ    $0A8F               ; {code.loc_0a8f} loop over the seven projectile records
0AF4: C9              RET                         ; all bullets integrated and drawn -- return

loc_0af5:
0AF5: DD 7E 01        LD      A,(IX+$01)          ; flipped-screen path -- read the bullet's Y sub-position
0AF8: D6 04           SUB     $04                 ; subtract 4 -- the mirrored Y offset
0AFA: FD 77 02        LD      (IY+$02),A          ; write the bullet sprite's Y into the shadow
0AFD: DD 7E 03        LD      A,(IX+$03)          ; read the bullet's position high byte
0B00: 2F              CPL                         ; complement it into a sprite code
0B01: 4F              LD      C,A                 ; hold the code in C
0B02: 78              LD      A,B                 ; fetch the record index
0B03: FE 05           CP      $05                 ; is this record among the top three?
0B05: 38 D8           JR      C,$0ADF             ; {code.loc_0adf} not the first three -- skip the code nudge
0B07: 0D              DEC     C                   ; nudge the code down by one for those three bullets
0B08: C3 DF 0A        JP      $0ADF               ; {code.loc_0adf} rejoin the sprite-code store

; Player-shot vs formation collision (called from the
; runGameplayFrameAndAdvanceOnFieldClear per-frame pipeline): while the
; shot gate 0x4208 bit0 is armed, band the shot Y (0x4209) into a
; formation row and the shot X-delta (0x420a minus formation anchor
; 0x420e) into a column, index the FLAG_BITS_BASE grid; if that cell holds
; a live alien clear it, stamp a hit record (0x420b=1, 0x42b1=1, 0x42b2=0,
; 0x42b3=shot position word), and enqueue two command words (kind 1 with
; the grid index, kind 3 with a column code). Registers the player shot
; destroying a formation alien and queues its kill/scoring/sound events.
flagPlayerShotHitOnFormation:
0B0B: 21 08 42        LD      HL,$4208            ; point at the player-shot gate
0B0E: CB 46           BIT     0,(HL)              ; is a shot in flight?
0B10: C8              RET     Z                   ; no shot -- nothing to test against the formation, return
0B11: 23              INC     HL                  ; step to the shot's Y position counter
0B12: 7E              LD      A,(HL)              ; read the shot's Y
0B13: FE 68           CP      $68                 ; compare against 0x68 -- below the formation band?
0B15: D0              RET     NC                  ; shot is too low to hit the block -- return
0B16: D6 1E           SUB     $1E                 ; subtract the top margin above the formation
0B18: D8              RET     C                   ; shot is above the whole block -- return
0B19: 06 06           LD      B,$06               ; B = 6 formation rows to walk down

loc_0b1b:
0B1B: D6 07           SUB     $07                 ; step down seven -- the first part of a row's pitch
0B1D: D8              RET     C                   ; landed in the gutter above this row -- no hit, return
0B1E: D6 05           SUB     $05                 ; step down five -- the rest of a row's pitch
0B20: 38 03           JR      C,$0B25             ; {code.loc_0b25} shot's Y falls in this row -- go compute its column
0B22: 10 F7           DJNZ    $0B1B               ; {code.loc_0b1b} try the next row down
0B24: C9              RET                         ; fell past all six rows -- no hit, return

loc_0b25:
0B25: 23              INC     HL                  ; step to the shot's X-field cell
0B26: 3A 0E 42        LD      A,($420E)           ; {hard.workRam+20E} read the formation anchor's X
0B29: 96              SUB     (HL)                ; subtract the shot's X-field
0B2A: ED 44           NEG                         ; negate -- A is the shot's distance from the anchor
0B2C: 4F              LD      C,A                 ; keep the raw distance in C
0B2D: E6 0F           AND     $0F                 ; isolate the low nibble -- position within a column
0B2F: D6 02           SUB     $02                 ; subtract the 2-pixel column hotspot offset
0B31: FE 0B           CP      $0B                 ; compare against the 11-pixel column width
0B33: D0              RET     NC                  ; shot falls between columns -- no hit, return
0B34: 04              INC     B                   ; adjust B to the landed row index
0B35: 79              LD      A,C                 ; fetch the raw distance again
0B36: E6 F0           AND     $F0                 ; take the high nibble -- the column number
0B38: 80              ADD     A,B                 ; fold the row index into the low bits
0B39: 0F              RRCA                        ; rotate right -- begin swapping to a (column,row) grid index
0B3A: 0F              RRCA                        ; rotate right
0B3B: 0F              RRCA                        ; rotate right
0B3C: 0F              RRCA                        ; rotate right -- nibbles now swapped
0B3D: 5F              LD      E,A                 ; E = the packed grid-cell index
0B3E: 16 00           LD      D,$00               ; D = 0
0B40: 21 00 41        LD      HL,$4100            ; point at the formation flag block base
0B43: 19              ADD     HL,DE               ; index it by the grid cell
0B44: CB 46           BIT     0,(HL)              ; is there a live alien in that cell?
0B46: C8              RET     Z                   ; empty cell -- the shot passes through, return
0B47: 72              LD      (HL),D              ; clear the cell flag -- the alien is destroyed
0B48: 16 01           LD      D,$01               ; D = 1, the kill command channel
0B4A: 5D              LD      E,L                 ; E = the grid cell index, the command parameter
0B4B: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue the kill command word for this cell
0B4E: 7A              LD      A,D                 ; A = 1
0B4F: 32 0B 42        LD      ($420B),A           ; {hard.workRam+20B} raise the shot-retire flag
0B52: 32 B1 42        LD      ($42B1),A           ; {hard.workRam+2B1} stamp the hit record's marker byte
0B55: AF              XOR     A                   ; clear A
0B56: 32 B2 42        LD      ($42B2),A           ; {hard.workRam+2B2} zero the hit record's second byte
0B59: 2A 09 42        LD      HL,($4209)          ; {hard.workRam+209} read the shot's position word
0B5C: 22 B3 42        LD      ($42B3),HL          ; {hard.workRam+2B3} stash it in the hit record's position slot
0B5F: 16 03           LD      D,$03               ; D = 3, the scoring/sound command channel
0B61: 7B              LD      A,E                 ; fetch the grid cell index
0B62: FE 50           CP      $50                 ; compare against 0x50 -- upper versus lower rows
0B64: 38 0C           JR      C,$0B72             ; {code.loc_0b72} lower rows -- take the base scoring code
0B66: E6 70           AND     $70                 ; mask the column bits for a scoring index
0B68: 0F              RRCA                        ; rotate right
0B69: 0F              RRCA                        ; rotate right
0B6A: 0F              RRCA                        ; rotate right
0B6B: 0F              RRCA                        ; rotate right -- shift the column bits down to a small code
0B6C: D6 04           SUB     $04                 ; subtract 4 to bias the code
0B6E: 5F              LD      E,A                 ; E = the column-derived scoring parameter
0B6F: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue the scoring/sound command word and return

loc_0b72:
0B72: 1E 00           LD      E,$00               ; E = 0, the base scoring parameter
0B74: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue the scoring/sound command word and return

; When projectiles are enabled (OBJ_ACTIVE_FLAG 0x4200 bit0 set), loop all
; 14 projectile entries (base 0x4260, stride 5) through
; flagProjectileHitOnPlayer (0x0b8d), which box-tests each vs the player
; and, on overlap, deactivates the entry and raises HIT_EVENT_FLAG
; (0x4204).
flagProjectileHitsOnPlayer:
0B77: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-subsystem master switch
0B7A: 0F              RRCA                        ; rotate its bit 0 into carry -- is play active?
0B7B: D0              RET     NC                  ; subsystem off -- no enemy shots can hit the player, return
0B7C: DD 21 60 42     LD      IX,$4260            ; point IX at the enemy-projectile table base
0B80: 11 05 00        LD      DE,$0005            ; stride is 5 bytes per flat projectile entry
0B83: 06 0E           LD      B,$0E               ; B = 14 projectile entries to test against the player

loc_0b85:
0B85: CD 8D 0B        CALL    $0B8D               ; {code.flagProjectileHitOnPlayer} test one enemy shot against the player ship
0B88: DD 19           ADD     IX,DE               ; step the pointer to the next enemy-shot record
0B8A: 10 F9           DJNZ    $0B85               ; {code.loc_0b85} loop over every enemy-shot slot
0B8C: C9              RET                         ; done sweeping the enemy shots

; Per-entry collision test: for an active enemy-shot entry (bit0 of
; byte0), box-test entry X vs the player-X reference ($4202) and entry Y
; across a near/far band; on overlap deactivate the entry (byte0=0) and
; raise HIT_EVENT_FLAG (0x4204)=1.
flagProjectileHitOnPlayer:
0B8D: DD CB 00 46     BIT     0,(IX+$00)          ; read the enemy shot's active flag
0B91: C8              RET     Z                   ; slot empty -- nothing can hit the player here
0B92: DD 7E 01        LD      A,(IX+$01)          ; read the shot's first coordinate
0B95: C6 1F           ADD     A,$1F               ; add the collision box's half-span (31)
0B97: 93              SUB     E                   ; subtract the reference coordinate to test one edge
0B98: 38 10           JR      C,$0BAA             ; {code.loc_0baa} reference past that edge -- try the other box test
0B9A: D6 09           SUB     $09                 ; narrow by the box span (9)
0B9C: D0              RET     NC                  ; reference outside the box -- no hit
0B9D: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the ship's X
0BA0: DD 96 03        SUB     (IX+$03)            ; distance from the shot's X
0BA3: 83              ADD     A,E                 ; fold in the other-axis reference
0BA4: FE 0B           CP      $0B                 ; compare against the box width (11)
0BA6: D0              RET     NC                  ; outside the box -- no hit
0BA7: C3 B4 0B        JP      $0BB4               ; {code.loc_0bb4} overlap -- go record the hit on the player

loc_0baa:
0BAA: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the ship's X
0BAD: DD 96 03        SUB     (IX+$03)            ; distance from the shot's X
0BB0: C6 02           ADD     A,$02               ; bias by two
0BB2: BB              CP      E                   ; compare against the reference
0BB3: D0              RET     NC                  ; outside the box -- no hit

loc_0bb4:
0BB4: DD 36 00 00     LD      (IX+$00),$00        ; clear the shot's active flag -- retire it on impact
0BB8: 3E 01           LD      A,$01               ; load the hit marker
0BBA: 32 04 42        LD      ($4204),A           ; {hard.workRam+204} raise the player-hit event flag
0BBD: C9              RET                         ; hit recorded -- return

; Per-frame sprite-staging driver: renders 8 consecutive object records
; (SPRITE_SOURCE_OBJ_BASE 0x42b0, 32-byte stride) into 8 consecutive
; sprite-shadow records (SPRITE_SHADOW_BASE 0x4060, 4-byte stride) via
; renderObjectSprite, as a band of 3 then a band of 5 at a Y offset
; selected by $4018 bit0.
stageObjectsToSpriteShadow:
0BBE: 3A 18 40        LD      A,($4018)           ; {hard.workRam+18} read the screen-orientation flag
0BC1: 0F              RRCA                        ; shift its low bit into carry
0BC2: 38 2E           JR      C,$0BF2             ; {code.loc_0bf2} flipped screen -- take the alternate band offsets
0BC4: DD 21 B0 42     LD      IX,$42B0            ; point at the first object record
0BC8: FD 21 60 40     LD      IY,$4060            ; point at the first sprite-shadow slot
0BCC: 06 03           LD      B,$03               ; three sprites in the first band
0BCE: 0E 07           LD      C,$07               ; first band sits at vertical offset 7 (upright)

loc_0bd0:
0BD0: CD 20 0C        CALL    $0C20               ; {code.renderObjectSprite} render this object into its sprite-shadow slot
0BD3: 11 20 00        LD      DE,$0020            ; object records are 32 bytes apart
0BD6: DD 19           ADD     IX,DE               ; advance to the next object record
0BD8: 11 04 00        LD      DE,$0004            ; sprite-shadow slots are 4 bytes apart
0BDB: FD 19           ADD     IY,DE               ; advance to the next sprite-shadow slot
0BDD: 10 F1           DJNZ    $0BD0               ; {code.loc_0bd0} finish the first band of three
0BDF: 06 05           LD      B,$05               ; five sprites in the second band
0BE1: 0C              INC     C                   ; bump the band offset to 8 for the tail band

loc_0be2:
0BE2: CD 20 0C        CALL    $0C20               ; {code.renderObjectSprite} render this object into its sprite-shadow slot
0BE5: 11 20 00        LD      DE,$0020            ; object-record stride is 32
0BE8: DD 19           ADD     IX,DE               ; advance to the next object record
0BEA: 11 04 00        LD      DE,$0004            ; sprite-shadow stride is 4
0BED: FD 19           ADD     IY,DE               ; advance to the next sprite-shadow slot
0BEF: 10 F1           DJNZ    $0BE2               ; {code.loc_0be2} finish the second band of five
0BF1: C9              RET                         ; all eight sprites staged -- return

loc_0bf2:
0BF2: DD 21 B0 42     LD      IX,$42B0            ; point at the first object record (flipped path)
0BF6: FD 21 60 40     LD      IY,$4060            ; point at the first sprite-shadow slot
0BFA: 06 03           LD      B,$03               ; three sprites in the first band
0BFC: 0E 09           LD      C,$09               ; first band sits at vertical offset 9 (flipped)

loc_0bfe:
0BFE: CD 20 0C        CALL    $0C20               ; {code.renderObjectSprite} render this object into its sprite-shadow slot
0C01: 11 20 00        LD      DE,$0020            ; object-record stride is 32
0C04: DD 19           ADD     IX,DE               ; advance to the next object record
0C06: 11 04 00        LD      DE,$0004            ; sprite-shadow stride is 4
0C09: FD 19           ADD     IY,DE               ; advance to the next sprite-shadow slot
0C0B: 10 F1           DJNZ    $0BFE               ; {code.loc_0bfe} finish the first band of three
0C0D: 06 05           LD      B,$05               ; five sprites in the second band
0C0F: 0D              DEC     C                   ; drop the band offset back to 8 for the tail band

loc_0c10:
0C10: CD 20 0C        CALL    $0C20               ; {code.renderObjectSprite} render this object into its sprite-shadow slot
0C13: 11 20 00        LD      DE,$0020            ; object-record stride is 32
0C16: DD 19           ADD     IX,DE               ; advance to the next object record
0C18: 11 04 00        LD      DE,$0004            ; sprite-shadow stride is 4
0C1B: FD 19           ADD     IY,DE               ; advance to the next sprite-shadow slot
0C1D: 10 F1           DJNZ    $0C10               ; {code.loc_0c10} finish the second band of five
0C1F: C9              RET                         ; all eight sprites staged -- return

; Build one hardware sprite record (Y,attr,sprite#,X) at IY from the
; object struct at IX: active (byte0 bit0) copies position (X=objX-8,
; Y=~objY-yOffset) and folds the signed heading (ix+5) into a display attr
; added to base attr (ix+0f); secondary-active (byte1 bit0) uses fixed
; sprite#7 + alt attr (ix+12); both clear parks the sprite off-screen
; (248,248).
renderObjectSprite:
0C20: DD CB 00 46     BIT     0,(IX+$00)          ; is this object active?
0C24: CA 98 0C        JP      Z,$0C98             ; {code.loc_0c98} not active -- handle the dying/parked case
0C27: DD 7E 16        LD      A,(IX+$16)          ; read the object's sprite number
0C2A: FD 77 02        LD      (IY+$02),A          ; write it into the sprite-shadow slot
0C2D: DD 7E 03        LD      A,(IX+$03)          ; read the object's X
0C30: D6 08           SUB     $08                 ; shift to screen X (object X minus 8)
0C32: FD 77 03        LD      (IY+$03),A          ; store the sprite's screen X
0C35: DD 7E 04        LD      A,(IX+$04)          ; read the object's Y
0C38: 2F              CPL                         ; one's-complement it -- screen Y runs inverted
0C39: 91              SUB     C                   ; subtract this band's vertical offset
0C3A: FD 77 00        LD      (IY+$00),A          ; store the sprite's screen Y
0C3D: DD 7E 05        LD      A,(IX+$05)          ; read the object's signed heading

loc_0c40:
0C40: A7              AND     A                   ; test the heading's sign
0C41: F2 58 0C        JP      P,$0C58             ; {code.loc_0c58} heading points up/right -- take the positive branch
0C44: FE FA           CP      $FA                 ; compare against -6
0C46: FA 82 0C        JP      M,$0C82             ; {code.loc_0c82} steeply negative heading -- take that branch
0C49: 2F              CPL                         ; complement the heading
0C4A: C6 12           ADD     A,$12               ; bias it by 18
0C4C: F6 40           OR      $40                 ; set the facing bits (0x40)
0C4E: DD 86 0F        ADD     A,(IX+$0F)          ; add the object's attribute base
0C51: FD 77 01        LD      (IY+$01),A          ; store the sprite's display attribute
0C54: FD 34 03        INC     (IY+$03)            ; nudge screen X a pixel on the diagonal facing
0C57: C9              RET                         ; sprite built -- return

loc_0c58:
0C58: FE 06           CP      $06                 ; heading past the 6-count sector?
0C5A: F2 6E 0C        JP      P,$0C6E             ; {code.loc_0c6e} yes -- take the next sector branch
0C5D: C6 11           ADD     A,$11               ; bias by 17
0C5F: F6 C0           OR      $C0                 ; set the facing bits (0xc0)
0C61: DD 86 0F        ADD     A,(IX+$0F)          ; add the object's attribute base
0C64: FD 77 01        LD      (IY+$01),A          ; store the sprite's display attribute
0C67: FD 34 03        INC     (IY+$03)            ; nudge screen X a pixel on the diagonal
0C6A: FD 34 00        INC     (IY+$00)            ; nudge screen Y a pixel on the diagonal
0C6D: C9              RET                         ; sprite built -- return

loc_0c6e:
0C6E: FE 0C           CP      $0C                 ; heading past the 12-count sector?
0C70: F2 90 0C        JP      P,$0C90             ; {code.loc_0c90} yes -- wrap it back down a whole sector
0C73: 2F              CPL                         ; complement the heading
0C74: C6 1E           ADD     A,$1E               ; bias by 30
0C76: F6 80           OR      $80                 ; set the facing bit (0x80)
0C78: DD 86 0F        ADD     A,(IX+$0F)          ; add the object's attribute base
0C7B: FD 77 01        LD      (IY+$01),A          ; store the sprite's display attribute
0C7E: FD 34 00        INC     (IY+$00)            ; nudge screen Y a pixel on the diagonal
0C81: C9              RET                         ; sprite built -- return

loc_0c82:
0C82: FE F4           CP      $F4                 ; heading below -12?
0C84: FA 94 0C        JP      M,$0C94             ; {code.loc_0c94} yes -- wrap it up a whole sector
0C87: C6 1D           ADD     A,$1D               ; bias by 29
0C89: DD 86 0F        ADD     A,(IX+$0F)          ; add the object's attribute base
0C8C: FD 77 01        LD      (IY+$01),A          ; store the sprite's display attribute
0C8F: C9              RET                         ; sprite built -- return

loc_0c90:
0C90: D6 18           SUB     $18                 ; subtract a whole 24-count heading sector
0C92: 18 AC           JR      $0C40               ; {code.loc_0c40} re-fold the reduced heading into an attribute

loc_0c94:
0C94: C6 18           ADD     A,$18               ; add a whole 24-count heading sector
0C96: 18 A8           JR      $0C40               ; {code.loc_0c40} re-fold the heading into an attribute

loc_0c98:
0C98: DD CB 01 46     BIT     0,(IX+$01)          ; object not primary -- is its dying-animation flag set?
0C9C: CA BA 0C        JP      Z,$0CBA             ; {code.loc_0cba} neither active -- park the sprite off-screen
0C9F: FD 36 02 07     LD      (IY+$02),$07        ; force sprite number 7 (the explosion frame)
0CA3: DD 7E 03        LD      A,(IX+$03)          ; read the object's X
0CA6: D6 08           SUB     $08                 ; shift to screen X (object X minus 8)
0CA8: FD 77 03        LD      (IY+$03),A          ; store the sprite's screen X
0CAB: DD 7E 04        LD      A,(IX+$04)          ; read the object's Y
0CAE: 2F              CPL                         ; one's-complement it -- screen Y runs inverted
0CAF: 91              SUB     C                   ; subtract this band's vertical offset
0CB0: FD 77 00        LD      (IY+$00),A          ; store the sprite's screen Y
0CB3: DD 7E 12        LD      A,(IX+$12)          ; read the object's alternate (death) attribute
0CB6: FD 77 01        LD      (IY+$01),A          ; store it as the sprite attribute
0CB9: C9              RET                         ; dying sprite built -- return

loc_0cba:
0CBA: FD 36 03 F8     LD      (IY+$03),$F8        ; park the sprite's screen X off-screen at 248
0CBE: FD 36 00 F8     LD      (IY+$00),$F8        ; park the sprite's screen Y off-screen at 248
0CC2: C9              RET                         ; sprite parked -- return

; Per-frame driver of all 8 object slots (SPRITE_SOURCE_OBJ_BASE 0x42b0,
; 32-byte stride): calls driveObjectSlot on each record — dying-anim
; handoff, inactive skip, or the state-indexed AI handler — walking the
; record base across the eight slots.
driveAllObjectSlots:
0CC3: DD 21 B0 42     LD      IX,$42B0            ; point at the first object record
0CC7: 11 20 00        LD      DE,$0020            ; object records are 32 bytes apart
0CCA: 06 08           LD      B,$08               ; eight object slots to drive

loc_0ccc:
0CCC: D9              EXX                         ; swap to the alternate register bank
0CCD: CD D6 0C        CALL    $0CD6               ; {code.driveObjectSlot} run this object's AI for the frame
0CD0: D9              EXX                         ; swap the working registers back
0CD1: DD 19           ADD     IX,DE               ; advance to the next object record
0CD3: 10 F7           DJNZ    $0CCC               ; {code.loc_0ccc} loop over all eight object slots
0CD5: C9              RET                         ; all slots driven -- return

; Per-slot object driver: for one object record (IX), hands a dying object
; (record+1 bit0) to the death-animation dispatcher, skips an inactive
; slot (record+0 bit0 clear), else runs the object-AI handler selected by
; the record's state index (record+2, 0..15).
driveObjectSlot:
0CD6: DD CB 01 46     BIT     0,(IX+$01)          ; is this object in its dying animation?
0CDA: C2 E4 10        JP      NZ,$10E4            ; {code.dispatchDeactivatedObjectAnim} yes -- hand it to the death-animation dispatcher
0CDD: DD CB 00 46     BIT     0,(IX+$00)          ; is the object active?
0CE1: C8              RET     Z                   ; inactive slot -- skip it
0CE2: DD 7E 02        LD      A,(IX+$02)          ; read the object's AI state index
0CE5: EF              RST     $28                 ; dispatch to the state handler via the table below

; ---- $0CE6-$0D05: jump table ----
0CE6: 06 0D 71 0D D1 0D 2B 0E 6B 0E 99 0E 07 0F 3C 0F
0CF6: 66 0F AF 0F 1F 10 8E 10 91 10 9B 10 C2 10 D8 10

; Object-AI spawn-init handler (dispatch slot 0 of the 0x0ce6 object-AI
; table; siblings advanceObjectPathStep 0x0d71, advanceObjectDiveStep
; 0x0e6b, reseedFormationObjectState 0x0e99): clear the step timer
; (ix+23), raise spawn flag 0x41c2, derive the sprite position from the
; packed grid cell (positionObjectFromGridCell), enqueue a type-1 spawn
; command word, look up sprite# and flight-curve seed from
; SPAWN_RECORD_TABLE (0x1dd1) by row (top row also tallies its two active
; neighbour slots into ACTIVE_NEIGHBOR_COUNT 0x422a), seed the motion
; counters, advance the sub-state, and set the signed heading from the
; direction bit. First-tick initialization of a freshly-launched attacker
; object.
initSpawnedObjectFromGridCell:
0D06: DD 36 17 00     LD      (IX+$17),$00        ; clear the object's attack-pass counter (the byte read at homing time)
0D0A: 3E 01           LD      A,$01               ; load the spawn marker
0D0C: 32 C2 41        LD      ($41C2),A           ; {hard.workRam+1C2} raise the object's spawn flag
0D0F: CD 47 11        CALL    $1147               ; {code.positionObjectFromGridCell} position the sprite from its packed grid cell
0D12: DD 5E 07        LD      E,(IX+$07)          ; reload the packed formation grid-cell
0D15: 16 01           LD      D,$01               ; mark it as a fresh registration
0D17: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} hand the cell to the spawn bookkeeping
0D1A: 7B              LD      A,E                 ; recover the grid-cell value
0D1B: E6 70           AND     $70                 ; isolate its row bits
0D1D: 21 D1 1D        LD      HL,$1DD1            ; point at the ROM spawn-record table
0D20: 0F              RRCA                        ; shift the row bits down toward an index
0D21: 0F              RRCA                        ; shift again
0D22: 0F              RRCA                        ; shift again -- row is now the table index
0D23: 5F              LD      E,A                 ; hold the row index low byte
0D24: 16 00           LD      D,$00               ; clear the index high byte
0D26: 19              ADD     HL,DE               ; index into the spawn-record table by row
0D27: 7E              LD      A,(HL)              ; read this row's sprite number
0D28: DD 77 16        LD      (IX+$16),A          ; store it as the object's sprite number
0D2B: 23              INC     HL                  ; step to the next table byte
0D2C: 7E              LD      A,(HL)              ; read the flight-curve seed
0D2D: DD 77 18        LD      (IX+$18),A          ; store it in the object's curve slot
0D30: 7B              LD      A,E                 ; recover the row index
0D31: FE 0E           CP      $0E                 ; is this the top row (14)?
0D33: 28 23           JR      Z,$0D58             ; {code.loc_0d58} yes -- tally the top-row neighbours first
0D35: DD 36 0F 00     LD      (IX+$0F),$00        ; clear the object's attribute base

loc_0d39:
0D39: DD 36 10 03     LD      (IX+$10),$03        ; seed the move-throttle counter to 3
0D3D: DD 36 11 0C     LD      (IX+$11),$0C        ; seed the leg counter to 12
0D41: DD 36 13 00     LD      (IX+$13),$00        ; clear the path-step cursor
0D45: DD 34 02        INC     (IX+$02)            ; advance to the next AI state
0D48: DD CB 06 46     BIT     0,(IX+$06)          ; check the object's dive-direction bit
0D4C: 20 05           JR      NZ,$0D53            ; {code.loc_0d53} diving the other way -- use the negative heading
0D4E: DD 36 05 0C     LD      (IX+$05),$0C        ; set the heading to +12
0D52: C9              RET                         ; spawn set up -- return

loc_0d53:
0D53: DD 36 05 F4     LD      (IX+$05),$F4        ; set the heading to -12
0D57: C9              RET                         ; spawn set up -- return

loc_0d58:
0D58: DD 36 0F 18     LD      (IX+$0F),$18        ; set the top-row attribute base (0x18)
0D5C: AF              XOR     A                   ; zero the neighbour count
0D5D: DD CB 20 46     BIT     0,(IX+$20)          ; is the right-hand neighbour slot active?
0D61: 28 01           JR      Z,$0D64             ; {code.loc_0d64} no -- skip it
0D63: 3C              INC     A                   ; count the neighbour

loc_0d64:
0D64: DD CB 40 46     BIT     0,(IX+$40)          ; is the far neighbour slot active?
0D68: 28 01           JR      Z,$0D6B             ; {code.loc_0d6b} no -- skip it
0D6A: 3C              INC     A                   ; count the neighbour

loc_0d6b:
0D6B: 32 2A 42        LD      ($422A),A           ; {hard.workRam+22A} store the live-neighbour count
0D6E: C3 39 0D        JP      $0D39               ; {code.loc_0d39} join the common spawn-seeding tail

; Object-AI state-1 handler: walk the per-object cursor (ix+19) through
; PATH_STEP_TABLE (0x1e00), add the delta pair to Y (ix+3) then direction-
; controlled X (ix+4, dir bit ix+6 bit0); if X (plus 7px margin) crosses
; the near edge force state (ix+2)=5 (fall-away); else advance cursor,
; tick throttle (ix+16, reload 4) and on expiry nudge cross-step (ix+5)
; and tick leg counter (ix+17), advancing state when the leg finishes.
advanceObjectPathStep:
0D71: DD 6E 13        LD      L,(IX+$13)          ; read the object's path-step cursor
0D74: 26 1E           LD      H,$1E               ; point the table high byte at the dive-path table (0x1e)
0D76: DD 7E 03        LD      A,(IX+$03)          ; read the object's X
0D79: 86              ADD     A,(HL)              ; add this step's X delta
0D7A: DD 77 03        LD      (IX+$03),A          ; write the new X
0D7D: 2C              INC     L                   ; advance the cursor to the Y delta
0D7E: DD CB 06 46     BIT     0,(IX+$06)          ; check the dive-direction bit
0D82: 20 24           JR      NZ,$0DA8            ; {code.loc_0da8} diving the other way -- subtract the Y delta
0D84: DD 7E 04        LD      A,(IX+$04)          ; read the object's Y
0D87: 86              ADD     A,(HL)              ; add this step's Y delta
0D88: DD 77 04        LD      (IX+$04),A          ; write the new Y
0D8B: C6 07           ADD     A,$07               ; bias to test the near edge
0D8D: FE 0E           CP      $0E                 ; has it crossed the near edge (14)?
0D8F: 38 3B           JR      C,$0DCC             ; {code.loc_0dcc} yes -- fall away off the bottom
0D91: 2C              INC     L                   ; advance the cursor past this delta pair
0D92: DD 75 13        LD      (IX+$13),L          ; save the path-step cursor
0D95: DD 35 10        DEC     (IX+$10)            ; count down the move throttle
0D98: C0              RET     NZ                  ; not time to step yet -- wait
0D99: DD 36 10 04     LD      (IX+$10),$04        ; reload the throttle to 4
0D9D: DD 35 05        DEC     (IX+$05)            ; ease the heading down one toward level
0DA0: DD 35 11        DEC     (IX+$11)            ; count down the leg counter
0DA3: C0              RET     NZ                  ; legs left -- keep walking the path
0DA4: DD 34 02        INC     (IX+$02)            ; leg run done -- advance the AI state
0DA7: C9              RET                         ; path step done -- return

loc_0da8:
0DA8: DD 7E 04        LD      A,(IX+$04)          ; read the object's Y
0DAB: 96              SUB     (HL)                ; subtract this step's Y delta
0DAC: DD 77 04        LD      (IX+$04),A          ; write the new Y
0DAF: C6 07           ADD     A,$07               ; bias to test the near edge
0DB1: FE 0E           CP      $0E                 ; has it crossed the near edge (14)?
0DB3: 38 17           JR      C,$0DCC             ; {code.loc_0dcc} yes -- fall away off the bottom
0DB5: 2C              INC     L                   ; advance the cursor past this delta pair
0DB6: DD 75 13        LD      (IX+$13),L          ; save the path-step cursor
0DB9: DD 35 10        DEC     (IX+$10)            ; count down the move throttle
0DBC: C0              RET     NZ                  ; not time to step yet -- wait
0DBD: DD 36 10 04     LD      (IX+$10),$04        ; reload the throttle to 4
0DC1: DD 34 05        INC     (IX+$05)            ; ease the heading up one toward level
0DC4: DD 35 11        DEC     (IX+$11)            ; count down the leg counter
0DC7: C0              RET     NZ                  ; legs left -- keep walking the path
0DC8: DD 34 02        INC     (IX+$02)            ; leg run done -- advance the AI state
0DCB: C9              RET                         ; path step done -- return

loc_0dcc:
0DCC: DD 36 02 05     LD      (IX+$02),$05        ; force this object's AI state to 5 -- the reseed-at-the-left-edge state
0DD0: C9              RET                         ; done

; Object-AI state-2 handler (0x0ce6 state table, index 2): tick the actor
; phase counter ix+3, then commit its next horizontal move -- kind
; (ix+7)&0x70==0x60 -> commitMoveToStoredOrPlayerTargetX, else
; commitMoveAcrossPlayerX (target relative to reference X 0x4202)
advanceActorPhaseAndCommitMove:
0DD1: DD 34 03        INC     (IX+$03)            ; tick the actor's phase counter
0DD4: DD 7E 07        LD      A,(IX+$07)          ; read the object's packed formation grid-cell / kind byte
0DD7: E6 70           AND     $70                 ; isolate the row/kind bits
0DD9: FE 60           CP      $60                 ; is it the special stored-target kind
0DDB: 28 43           JR      Z,$0E20             ; {code.commitMoveToStoredOrPlayerTargetX} that kind picks its target off the object table

; Object-AI horizontal target picker: signed-halves the gap between the
; actor's X (record+4) and the player-X reference $4202 (-inferred),
; biases by 16, and clamps to the band on the far/opposite side (right
; 144-208 when actor is left of the reference, left 48-112 when at/right),
; then tail-calls commitMoveToTargetX (0x0df6,) to commit the crossover
; move.
commitMoveAcrossPlayerX:
0DDD: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the player ship's X
0DE0: 47              LD      B,A                 ; hold the ship X
0DE1: DD 7E 04        LD      A,(IX+$04)          ; read this object's own X
0DE4: 90              SUB     B                   ; gap from the ship
0DE5: 38 28           JR      C,$0E0F             ; {code.loc_0e0f} object is left of the ship -- aim at the right-side band
0DE7: 1F              RRA                         ; halve the gap (signed)
0DE8: C6 10           ADD     A,$10               ; bias the target inward by 16
0DEA: FE 30           CP      $30                 ; clamp low -- below 48?
0DEC: 30 02           JR      NC,$0DF0            ; {code.loc_0df0} still in range, keep it
0DEE: 3E 30           LD      A,$30               ; floor the target X at 48

loc_0df0:
0DF0: FE 70           CP      $70                 ; clamp high -- above 112?
0DF2: 38 02           JR      C,$0DF6             ; {code.commitMoveToTargetX} in range, keep it
0DF4: 3E 70           LD      A,$70               ; cap the target X at 112

; Commit an object (IX record) to a horizontal move toward a chosen target
; X: store target X (ix+0x19), the signed per-frame step delta current-
; minus-target (ix+0x09), zero the move accumulator (ix+0x1a..0x1c), and
; advance the planner sub-state (ix+0x02).
commitMoveToTargetX:
0DF6: DD 77 19        LD      (IX+$19),A          ; store the chosen target X for the crossover move
0DF9: DD 96 04        SUB     (IX+$04)            ; target minus current X
0DFC: ED 44           NEG                         ; negate into a signed per-frame step toward the target
0DFE: DD 77 09        LD      (IX+$09),A          ; store the step delta
0E01: AF              XOR     A                   ; zero
0E02: DD 77 1A        LD      (IX+$1A),A          ; clear the move accumulator
0E05: DD 77 1B        LD      (IX+$1B),A          ; clear the move accumulator
0E08: DD 77 1C        LD      (IX+$1C),A          ; clear the move accumulator
0E0B: DD 34 02        INC     (IX+$02)            ; advance the object's planner sub-state
0E0E: C9              RET                         ; done

loc_0e0f:
0E0F: 1F              RRA                         ; halve the (negative) gap
0E10: D6 10           SUB     $10                 ; bias the target
0E12: FE D0           CP      $D0                 ; clamp -- below 208?
0E14: 38 02           JR      C,$0E18             ; {code.loc_0e18} in range, keep it
0E16: 3E D0           LD      A,$D0               ; cap the target X at 208

loc_0e18:
0E18: FE 90           CP      $90                 ; above 144?
0E1A: 30 DA           JR      NC,$0DF6            ; {code.commitMoveToTargetX} in range, commit the crossover target
0E1C: 3E 90           LD      A,$90               ; floor the target X at 144
0E1E: 18 D6           JR      $0DF6               ; {code.commitMoveToTargetX} commit the crossover target on the right-side band

; Alternate horizontal target-select branch: if OBJ_TABLE (0x42d0) bit0 is
; set, commit the actor toward the object-table's stored target X
; (OBJ_TABLE+0x19) via commitMoveToTargetX (0x0df6); otherwise run the
; player-crossover pick via commitMoveAcrossPlayerX (0x0ddd). Chooses an
; attacking object's next horizontal target.
commitMoveToStoredOrPlayerTargetX:
0E20: 3A D0 42        LD      A,($42D0)           ; {hard.workRam+2D0} read the object-table head -- its stored-target flag
0E23: 0F              RRCA                        ; shift that flag's bit0 into carry
0E24: 30 B7           JR      NC,$0DDD            ; {code.commitMoveAcrossPlayerX} no stored target -- pick a crossover target versus the ship
0E26: 3A E9 42        LD      A,($42E9)           ; {hard.workRam+2E9} read the stored target X off the object table
0E29: 18 CB           JR      $0DF6               ; {code.commitMoveToTargetX} commit the move toward the stored target

; Object-AI flight-state handler (RST-28 dispatch slot 3 @0x0ce6): each
; frame bumps the per-object counter (record+3) and runs
; advanceObjectFlightCurve, then folds the per-object increment (record+9)
; + curve heading hi (record+0x19) into a new screen Y (record+4); a too-
; high Y advances the dispatch state (record+2) by 2, a wrapped counter by
; 1; else, gated by OBJ_ACTIVE_FLAG bit0, aims the octant
; (aimObjectAtTarget) and -- when 0x422b bit0 clear -- scans the row table
; (0x4213) for the counter value, firing an aimed projectile
; (spawnAimedProjectileAtPlayer) on a match.
advanceObjectFlightAndFire:
0E2B: DD 34 03        INC     (IX+$03)            ; bump the diving object's flight counter
0E2E: CD 6B 11        CALL    $116B               ; {code.advanceObjectFlightCurve} run one pass of the swoop flight-curve rotation
0E31: DD 7E 09        LD      A,(IX+$09)          ; the object's per-frame Y increment
0E34: DD 86 19        ADD     A,(IX+$19)          ; plus the curve heading -- the new Y delta
0E37: DD 77 04        LD      (IX+$04),A          ; write the diving object's new screen Y
0E3A: C6 07           ADD     A,$07               ; probe near the top edge
0E3C: FE 0E           CP      $0E                 ; test it
0E3E: 38 24           JR      C,$0E64             ; {code.loc_0e64} flown off the top -- end the dive
0E40: DD 7E 03        LD      A,(IX+$03)          ; read the flight counter
0E43: C6 48           ADD     A,$48               ; has it wrapped past its span
0E45: 38 20           JR      C,$0E67             ; {code.loc_0e67} wrapped -- end this dive leg
0E47: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-subsystem master switch
0E4A: 0F              RRCA                        ; its bit0 into carry
0E4B: D0              RET     NC                  ; subsystem off -- do no more
0E4C: CD B0 11        CALL    $11B0               ; {code.aimObjectAtTarget} aim the object's heading at the ship
0E4F: 3A 2B 42        LD      A,($422B)           ; {hard.workRam+22B} read the fire-inhibit flag
0E52: 0F              RRCA                        ; its bit0 into carry
0E53: D8              RET     C                   ; inhibited -- do not fire this frame
0E54: 2A 13 42        LD      HL,($4213)          ; {hard.workRam+213} load the firing-row slot/base pair
0E57: DD 7E 03        LD      A,(IX+$03)          ; the counter to match against a firing row

loc_0e5a:
0E5A: BC              CP      H                   ; does the counter match this firing row
0E5B: CA E0 11        JP      Z,$11E0             ; {code.spawnAimedProjectileAtPlayer} match -- drop an aimed shot at the player
0E5E: C6 19           ADD     A,$19               ; step to the next firing-row value
0E60: 2D              DEC     L                   ; one fewer row slot to test
0E61: 20 F7           JR      NZ,$0E5A            ; {code.loc_0e5a} loop over the firing rows
0E63: C9              RET                         ; no row matched -- hold fire

loc_0e64:
0E64: DD 34 02        INC     (IX+$02)            ; advance the AI state -- extra step for flying off the top

loc_0e67:
0E67: DD 34 02        INC     (IX+$02)            ; advance the AI state -- end the dive
0E6A: C9              RET                         ; done

; Object-AI dive state handler (rst-28 dispatch slot 4 @0x0ce6): steps the
; object's position (record+3) by 1 or 2 on the frame-parity bit
; FRAME_COUNTER, window-checks it (bump the state index record+2 when
; inside [6,9)), else runs advanceObjectFlightCurve and folds its heading
; hi-byte (record+0x19) plus the per-object increment (record+9) into a
; new screen Y (record+4), bumping the state instead on a signed-boundary
; carry.
advanceObjectDiveStep:
0E6B: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the frame counter
0E6E: E6 01           AND     $01                 ; take the frame-parity bit
0E70: 3C              INC     A                   ; 1 or 2 pixels
0E71: DD 86 03        ADD     A,(IX+$03)          ; step the diving object's position down by 1 or 2
0E74: DD 77 03        LD      (IX+$03),A          ; store the stepped position
0E77: D6 06           SUB     $06                 ; window-check it against the [6,9) band
0E79: FE 03           CP      $03                 ; test it
0E7B: 38 18           JR      C,$0E95             ; {code.loc_0e95} inside the window -- advance the state
0E7D: CD 6B 11        CALL    $116B               ; {code.advanceObjectFlightCurve} run one pass of the flight-curve rotation
0E80: DD 7E 19        LD      A,(IX+$19)          ; the curve heading high byte
0E83: A7              AND     A                   ; test its sign
0E84: FA 90 0E        JP      M,$0E90             ; {code.loc_0e90} negative heading -- take the alternate fold
0E87: DD 86 09        ADD     A,(IX+$09)          ; fold heading plus increment into the new Y
0E8A: 38 09           JR      C,$0E95             ; {code.loc_0e95} carried off the boundary -- advance the state

loc_0e8c:
0E8C: DD 77 04        LD      (IX+$04),A          ; write the object's new screen Y
0E8F: C9              RET                         ; done

loc_0e90:
0E90: DD 86 09        ADD     A,(IX+$09)          ; fold the negative heading plus increment
0E93: 38 F7           JR      C,$0E8C             ; {code.loc_0e8c} carry set -- store the new Y and return

loc_0e95:
0E95: DD 34 02        INC     (IX+$02)            ; advance the AI state
0E98: C9              RET                         ; done

; Object-AI state handler (rst-28 dispatch slot 5 @0x0ce6): re-inits the
; object (X record+3=8 left edge, heading record+5=0, ticks leg counter
; record+0x17); when enabled+gated ($4200 bit0, $4224||$4221) rolls a
; fresh random Y (advanceRandomSeed) into record+4, arms hold timer
; record+0x10=40, and advances state; on the special grid-cell value
; (record+7 & 0x70 == 0x70) recounts active neighbors into
; ACTIVE_NEIGHBOR_COUNT (0x422a) and, once none remain, deactivates the
; object (record+0=0) and ramps difficulty/phase counter $421E toward 2.
reseedFormationObjectState:
0E99: DD 36 03 08     LD      (IX+$03),$08        ; park the object's X back at the left edge (8)
0E9D: DD 34 17        INC     (IX+$17)            ; bump the object's attack-pass counter
0EA0: DD 36 05 00     LD      (IX+$05),$00        ; clear the heading
0EA4: DD 7E 07        LD      A,(IX+$07)          ; read the packed grid cell
0EA7: E6 70           AND     $70                 ; isolate the row bits
0EA9: FE 70           CP      $70                 ; the top special-row value?
0EAB: 28 2D           JR      Z,$0EDA             ; {code.loc_0eda} special path -- recount active neighbours

loc_0ead:
0EAD: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-subsystem master switch
0EB0: 0F              RRCA                        ; its bit0 into carry
0EB1: 30 23           JR      NC,$0ED6            ; {code.loc_0ed6} subsystem off -- just advance the state
0EB3: 3A 24 42        LD      A,($4224)           ; {hard.workRam+224} read the near-empty activity gate
0EB6: A7              AND     A                   ; is it open
0EB7: 20 06           JR      NZ,$0EBF            ; {code.loc_0ebf} gate open -- reseed a fresh dive
0EB9: 3A 21 42        LD      A,($4221)           ; {hard.workRam+221} read the top-rows-clear gate
0EBC: A7              AND     A                   ; is it open
0EBD: 28 17           JR      Z,$0ED6             ; {code.loc_0ed6} both gates closed -- just advance the state

loc_0ebf:
0EBF: DD 7E 04        LD      A,(IX+$04)          ; read the object's Y
0EC2: 1F              RRA                         ; halve it
0EC3: 4F              LD      C,A                 ; hold it as the base
0EC4: CD 3C 00        CALL    $003C               ; {code.advanceRandomSeed} draw a fresh random number
0EC7: E6 1F           AND     $1F                 ; keep the low five bits of the roll
0EC9: 81              ADD     A,C                 ; add to the halved base
0ECA: C6 20           ADD     A,$20               ; offset into the play band
0ECC: DD 77 04        LD      (IX+$04),A          ; new random Y -- send the alien around to dive again
0ECF: DD 36 10 28     LD      (IX+$10),$28        ; arm the hold timer to 40
0ED3: DD 34 02        INC     (IX+$02)            ; advance the state

loc_0ed6:
0ED6: DD 34 02        INC     (IX+$02)            ; advance the state
0ED9: C9              RET                         ; done

loc_0eda:
0EDA: 3A 2A 42        LD      A,($422A)           ; {hard.workRam+22A} read the active-neighbour count
0EDD: A7              AND     A                   ; any neighbours left
0EDE: 20 12           JR      NZ,$0EF2            ; {code.loc_0ef2} still have neighbours -- recount them
0EE0: DD 36 00 00     LD      (IX+$00),$00        ; no neighbours -- deactivate this object
0EE4: 3A 1E 42        LD      A,($421E)           ; {hard.workRam+21E} read the difficulty/phase ramp counter
0EE7: 3C              INC     A                   ; bump it
0EE8: FE 03           CP      $03                 ; clamp at 2
0EEA: 38 02           JR      C,$0EEE             ; {code.loc_0eee} in range, keep it
0EEC: 3E 02           LD      A,$02               ; hold the ramp at 2

loc_0eee:
0EEE: 32 1E 42        LD      ($421E),A           ; {hard.workRam+21E} store the ramped phase counter
0EF1: C9              RET                         ; done

loc_0ef2:
0EF2: AF              XOR     A                   ; start a fresh neighbour tally at 0
0EF3: DD CB 20 46     BIT     0,(IX+$20)          ; is the neighbour slot one over active
0EF7: 28 01           JR      Z,$0EFA             ; {code.loc_0efa} no -- skip it
0EF9: 3C              INC     A                   ; count that live neighbour

loc_0efa:
0EFA: DD CB 40 46     BIT     0,(IX+$40)          ; is the neighbour slot two over active
0EFE: 28 01           JR      Z,$0F01             ; {code.loc_0f01} no -- skip it
0F00: 3C              INC     A                   ; count that live neighbour

loc_0f01:
0F01: 32 2A 42        LD      ($422A),A           ; {hard.workRam+22A} store the recounted active-neighbour count
0F04: C3 AD 0E        JP      $0EAD               ; {code.loc_0ead} rejoin the reseed path

; Object-AI state handler (slot 6 of the 0x0ce6 rst-28 jump table,
; dispatched on record+2): bump the frame counter (record+3), reposition
; from the packed grid cell (positionObjectFromGridCell), then when the
; counter reaches the positioned value deactivate the object (record+0=0),
; set its formation-cell flag FLAG_BITS_BASE+cell=1 and enqueue command
; word {0:cell}; a small even gap nudges phase (record+5) by the direction
; bit (record+6), a large (>=25) or odd gap is left alone.
settleObjectIntoFormationCell:
0F07: DD 46 03        LD      B,(IX+$03)          ; take the object's return counter
0F0A: 04              INC     B                   ; bump it one step
0F0B: CD 47 11        CALL    $1147               ; {code.positionObjectFromGridCell} reposition the object from its packed grid cell
0F0E: DD 7E 03        LD      A,(IX+$03)          ; the just-positioned home value
0F11: DD 70 03        LD      (IX+$03),B          ; store the bumped counter
0F14: 90              SUB     B                   ; gap between the home value and the counter
0F15: 28 14           JR      Z,$0F2B             ; {code.loc_0f2b} counter caught its home cell -- settle the alien back in
0F17: FE 19           CP      $19                 ; gap of 25 or more?
0F19: D0              RET     NC                  ; still too far from home -- nothing to do yet
0F1A: E6 01           AND     $01                 ; odd gap?
0F1C: C0              RET     NZ                  ; odd -- leave it this frame
0F1D: DD CB 06 46     BIT     0,(IX+$06)          ; read the object's direction bit
0F21: 20 04           JR      NZ,$0F27            ; {code.loc_0f27} one direction -- nudge the phase down
0F23: DD 34 05        INC     (IX+$05)            ; nudge the phase/heading up
0F26: C9              RET                         ; done

loc_0f27:
0F27: DD 35 05        DEC     (IX+$05)            ; nudge the phase/heading down
0F2A: C9              RET                         ; done

loc_0f2b:
0F2B: DD 36 00 00     LD      (IX+$00),$00        ; deactivate the returning object
0F2F: 26 41           LD      H,$41               ; high byte of the formation flag-block page
0F31: DD 6E 07        LD      L,(IX+$07)          ; the packed grid cell as the low byte -- address its flag cell
0F34: 16 00           LD      D,$00               ; clear D
0F36: 36 01           LD      (HL),$01            ; mark that formation cell alive again -- the alien rejoins the block
0F38: 5D              LD      E,L                 ; the cell index as the command parameter
0F39: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue the landing command word

; Object-AI state-7 handler: bump frame counter (ix+3); steer the object's
; 16-bit X:subpixel pair (ix+4 high, ix+9 low) by ~4x the signed distance
; to the target-X reference $4202 (with the rounding bias) each frame;
; advance state (ix+2) when the dwell timer (ix+16) reaches 0.
homeObjectXTowardPlayer:
0F3C: DD 34 03        INC     (IX+$03)            ; tick the object's frame counter
0F3F: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the player ship's X
0F42: DD 96 04        SUB     (IX+$04)            ; distance from the object to the ship
0F45: ED 44           NEG                         ; negate -- signed toward the ship
0F47: 17              RLA                         ; double it
0F48: 5F              LD      E,A                 ; low byte of the approach step
0F49: 9F              SBC     A,A                 ; sign-extend
0F4A: 57              LD      D,A                 ; high byte of the approach step
0F4B: CB 13           RL      E                   ; finish scaling the signed distance up (x4)
0F4D: CB 12           RL      D                   ; carry into the high byte
0F4F: DD 66 04        LD      H,(IX+$04)          ; object X high byte
0F52: DD 6E 09        LD      L,(IX+$09)          ; object X sub-pixel low byte
0F55: A7              AND     A                   ; clear carry for the subtract
0F56: ED 52           SBC     HL,DE               ; steer the 16-bit X:sub-pixel pair toward the ship
0F58: DD 74 04        LD      (IX+$04),H          ; store the object's new X
0F5B: DD 75 09        LD      (IX+$09),L          ; store the sub-pixel remainder
0F5E: DD 35 10        DEC     (IX+$10)            ; tick the homing dwell timer
0F61: C0              RET     NZ                  ; still homing -- stay in this state
0F62: DD 34 02        INC     (IX+$02)            ; dwell up -- advance the AI state
0F65: C9              RET                         ; done

; Object-AI state-8 handler: tick arm counter ix+3; while ix+3 or position
; ix+4 is outside [0x60,0xA0) keep cruising cross-player
; (beginObjectCrossPlayerMove); once both in-window advance state ix+2 by
; 2, seed move timers ix+0x10=3/ix+0x11=12, clear ix+5/ix+0x13, and set
; direction ix+6 from the reference-X (0x4202) compare
armDirectedMoveWhenInWindow:
0F66: DD 34 03        INC     (IX+$03)            ; tick the arm counter
0F69: DD 7E 03        LD      A,(IX+$03)          ; read it
0F6C: D6 60           SUB     $60                 ; relative to the window base 0x60
0F6E: FE 40           CP      $40                 ; inside the [0x60,0xA0) window?
0F70: 30 09           JR      NC,$0F7B            ; {code.beginObjectCrossPlayerMove} counter outside the window -- keep cruising
0F72: DD 7E 04        LD      A,(IX+$04)          ; read the object's X
0F75: D6 60           SUB     $60                 ; relative to the window base
0F77: FE 40           CP      $40                 ; X inside the [0x60,0xA0) window?
0F79: 38 0C           JR      C,$0F87             ; {code.loc_0f87} both counter and X in the window -- commit the directed move

; Shared object-AI tail: call commitMoveAcrossPlayerX (0x0ddd) to pick and
; commit a horizontal target on the far/opposite side of the player-X
; reference, then arm the object's flight-curve step seed record+0x18=3
; (-> (3&3)+1 = 4 curve steps in advanceObjectFlightCurve 0x116b) and its
; move throttle record+0x10=100.
beginObjectCrossPlayerMove:
0F7B: CD DD 0D        CALL    $0DDD               ; {code.commitMoveAcrossPlayerX} pick a crossover target versus the ship
0F7E: DD 36 18 03     LD      (IX+$18),$03        ; seed the flight-curve step count to 3
0F82: DD 36 10 64     LD      (IX+$10),$64        ; arm the move throttle to 100
0F86: C9              RET                         ; done

loc_0f87:
0F87: DD 34 02        INC     (IX+$02)            ; advance the AI state
0F8A: DD 34 02        INC     (IX+$02)            ; advance it again -- skip to the swoop state
0F8D: DD 36 10 03     LD      (IX+$10),$03        ; seed the first move timer
0F91: DD 36 11 0C     LD      (IX+$11),$0C        ; seed the second move timer (12)
0F95: DD 36 05 00     LD      (IX+$05),$00        ; clear the heading
0F99: DD 36 13 00     LD      (IX+$13),$00        ; clear the working cell
0F9D: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the ship X
0FA0: DD 96 04        SUB     (IX+$04)            ; which side of the ship the object sits on
0FA3: 38 05           JR      C,$0FAA             ; {code.loc_0faa} object right of the ship -- set direction 1
0FA5: DD 36 06 00     LD      (IX+$06),$00        ; face/move one way
0FA9: C9              RET                         ; done

loc_0faa:
0FAA: DD 36 06 01     LD      (IX+$06),$01        ; face/move the other way
0FAE: C9              RET                         ; done

; Object-AI homing flight-state handler (RST-28 dispatch slot 9 @0x0ce6):
; like advanceObjectFlightAndFire but per the mode byte (record+0x17)
; first homes the column (record+9) toward the target column (0x4202) --
; mode==4 on odd frame parity (0x425f bit0), mode>4 always, mode<4 never;
; screen Y (record+4)=column+curve heading; a too-high Y sets state 5, a
; wrapped counter sets state 4, else the move-throttle (record+0x10)
; advances state (dec) on expiry; otherwise, gated by OBJ_ACTIVE_FLAG
; bit0, aims (aimObjectAtTarget) and fires (spawnAimedProjectileAtPlayer)
; on a row-table (0x4213) match. Unreached in attract+1P captures.
advanceHomingObjectFlightAndFire:
0FAF: DD 34 03        INC     (IX+$03)            ; bump the homing object's flight counter
0FB2: CD 6B 11        CALL    $116B               ; {code.advanceObjectFlightCurve} run one pass of the flight-curve rotation
0FB5: DD 7E 17        LD      A,(IX+$17)          ; read the homing mode byte
0FB8: FE 04           CP      $04                 ; mode 4?
0FBA: 28 48           JR      Z,$1004             ; {code.loc_1004} mode 4 -- home only on odd frames
0FBC: 30 4D           JR      NC,$100B            ; {code.loc_100b} mode above 4 -- home every frame

loc_0fbe:
0FBE: DD 7E 09        LD      A,(IX+$09)          ; the per-object column increment
0FC1: DD 86 19        ADD     A,(IX+$19)          ; plus the curve heading
0FC4: DD 77 04        LD      (IX+$04),A          ; write the new screen Y
0FC7: C6 07           ADD     A,$07               ; probe the top edge
0FC9: FE 0E           CP      $0E                 ; test it
0FCB: 38 29           JR      C,$0FF6             ; {code.loc_0ff6} flown off the top -- end the leg
0FCD: DD 7E 03        LD      A,(IX+$03)          ; read the flight counter
0FD0: C6 40           ADD     A,$40               ; wrapped past its span?
0FD2: 38 27           JR      C,$0FFB             ; {code.loc_0ffb} wrapped -- end the leg
0FD4: DD 35 10        DEC     (IX+$10)            ; tick the move throttle
0FD7: 28 27           JR      Z,$1000             ; {code.loc_1000} throttle expired -- change state
0FD9: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-subsystem master switch
0FDC: 0F              RRCA                        ; its bit0 into carry
0FDD: D0              RET     NC                  ; subsystem off -- do no more
0FDE: CD B0 11        CALL    $11B0               ; {code.aimObjectAtTarget} aim the object's heading at the ship
0FE1: 3A 2B 42        LD      A,($422B)           ; {hard.workRam+22B} read the fire-inhibit flag
0FE4: 0F              RRCA                        ; its bit0 into carry
0FE5: D8              RET     C                   ; inhibited -- do not fire
0FE6: 2A 13 42        LD      HL,($4213)          ; {hard.workRam+213} load the firing-row slot/base pair
0FE9: DD 7E 03        LD      A,(IX+$03)          ; the counter to match against a firing row

loc_0fec:
0FEC: BC              CP      H                   ; compare this firing-row threshold against the diving object's counter
0FED: CA E0 11        JP      Z,$11E0             ; {code.spawnAimedProjectileAtPlayer} on a match, fire an aimed shot down at the player
0FF0: C6 19           ADD     A,$19               ; step the threshold to the next firing row (0x19 apart)
0FF2: 2D              DEC     L                   ; count down the rows left to scan
0FF3: 20 F7           JR      NZ,$0FEC            ; {code.loc_0fec} keep scanning the row table for a firing row
0FF5: C9              RET                         ; no row lined up this frame -- no shot

loc_0ff6:
0FF6: DD 36 02 05     LD      (IX+$02),$05        ; send this object to AI state 5 (reseed and loop it around again)
0FFA: C9              RET                         ; done

loc_0ffb:
0FFB: DD 36 02 04     LD      (IX+$02),$04        ; hand this object to AI state 4 (the dive stepper)
0FFF: C9              RET                         ; done

loc_1000:
1000: DD 35 02        DEC     (IX+$02)            ; step this object's AI state back one
1003: C9              RET                         ; done

loc_1004:
1004: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the free-running frame counter
1007: E6 01           AND     $01                 ; test its low bit -- home the column only on odd frames
1009: 28 B3           JR      Z,$0FBE             ; {code.loc_0fbe} even frame -- skip the home step, go compute the swoop Y

loc_100b:
100B: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the target column (the ship's X)
100E: DD 96 09        SUB     (IX+$09)            ; subtract this object's current column
1011: 38 06           JR      C,$1019             ; {code.loc_1019} target is to the left -- go step the column down
1013: DD 34 09        INC     (IX+$09)            ; target is to the right -- step the column up toward it
1016: C3 BE 0F        JP      $0FBE               ; {code.loc_0fbe} go compute the swoop Y

loc_1019:
1019: DD 35 09        DEC     (IX+$09)            ; step the column down toward the target
101C: C3 BE 0F        JP      $0FBE               ; {code.loc_0fbe} go compute the swoop Y

; Object-AI descending path-walk handler (rst-28 dispatch slot 10
; @0x0cfa): subtracts the current PATH_STEP_TABLE (0x1e00) X delta from
; record+3 and advances the walk cursor (record+0x13); unless the
; direction bit (record+6 bit0) hands the Y half to
; advanceObjectPathStepAscending, subtracts the Y delta from record+4;
; ticks the move throttle (record+0x10, reload 4) and leg counter
; (record+0x11), and on a finished leg advances the state and reloads
; throttle=3/leg=12/heading=12/cursor=0. The subtract-direction mirror of
; advanceObjectPathStep.
advanceObjectPathStepDescending:
101F: DD 6E 13        LD      L,(IX+$13)          ; load the walk cursor into the path-step table pointer
1022: 26 1E           LD      H,$1E               ; high byte 0x1e -- point at the path-step table (0x1e00)
1024: DD 7E 03        LD      A,(IX+$03)          ; read the object's X coordinate
1027: 96              SUB     (HL)                ; subtract this step's X delta (descending walk)
1028: DD 77 03        LD      (IX+$03),A          ; store the stepped X back
102B: 2C              INC     L                   ; advance the cursor to this step's Y delta
102C: DD CB 06 46     BIT     0,(IX+$06)          ; test the object's direction bit
1030: 20 2E           JR      NZ,$1060            ; {code.advanceObjectPathStepAscending} direction set -- hand the Y half to the ascending walk
1032: DD 7E 04        LD      A,(IX+$04)          ; read the object's Y coordinate
1035: 96              SUB     (HL)                ; subtract this step's Y delta
1036: DD 77 04        LD      (IX+$04),A          ; store the stepped Y back
1039: 2C              INC     L                   ; advance the cursor past the Y delta
103A: DD 75 13        LD      (IX+$13),L          ; save the advanced walk cursor
103D: DD 35 10        DEC     (IX+$10)            ; tick the move throttle
1040: C0              RET     NZ                  ; not due yet -- hold this frame
1041: DD 36 10 04     LD      (IX+$10),$04        ; reload the throttle to 4 frames
1045: DD 35 05        DEC     (IX+$05)            ; step the heading one down
1048: DD 35 11        DEC     (IX+$11)            ; tick the leg counter
104B: C0              RET     NZ                  ; leg not finished -- keep walking it
104C: DD 34 02        INC     (IX+$02)            ; leg done -- advance the object's AI state
104F: DD 36 10 03     LD      (IX+$10),$03        ; reload the throttle to 3 for the next leg
1053: DD 36 11 0C     LD      (IX+$11),$0C        ; reload the leg counter to 12
1057: DD 36 05 0C     LD      (IX+$05),$0C        ; reset the heading to 12
105B: DD 36 13 00     LD      (IX+$13),$00        ; rewind the walk cursor to the start of the table
105F: C9              RET                         ; done

; Ascending/mirrored path-walk arm: add the PATH_STEP_TABLE byte at HL to
; Y (ix+4) and advance the walk cursor; tick the move throttle (ix+16),
; and on expiry step the heading (ix+5) and tick the leg counter (ix+17);
; on leg finish advance the dispatch state (ix+2) and reload throttle=3,
; leg=12, heading=244, cursor=0.
advanceObjectPathStepAscending:
1060: DD 7E 04        LD      A,(IX+$04)          ; read the object's Y coordinate
1063: 86              ADD     A,(HL)              ; add this step's Y delta (ascending walk)
1064: DD 77 04        LD      (IX+$04),A          ; store the stepped Y back
1067: 2C              INC     L                   ; advance the walk cursor
1068: DD 75 13        LD      (IX+$13),L          ; save the walk cursor
106B: DD 35 10        DEC     (IX+$10)            ; tick the move throttle
106E: C0              RET     NZ                  ; not due yet -- hold this frame
106F: DD 36 10 04     LD      (IX+$10),$04        ; reload the throttle to 4 frames
1073: DD 34 05        INC     (IX+$05)            ; step the heading one up
1076: DD 35 11        DEC     (IX+$11)            ; tick the leg counter
1079: C0              RET     NZ                  ; leg not finished -- keep walking it
107A: DD 34 02        INC     (IX+$02)            ; leg done -- advance the object's AI state
107D: DD 36 10 03     LD      (IX+$10),$03        ; reload the throttle to 3 for the next leg
1081: DD 36 11 0C     LD      (IX+$11),$0C        ; reload the leg counter to 12
1085: DD 36 05 F4     LD      (IX+$05),$F4        ; reset the heading to 244 (-12)
1089: DD 36 13 00     LD      (IX+$13),$00        ; rewind the walk cursor to the start of the table
108D: C9              RET                         ; done

; Object-AI dispatch slot 11 (@0x0cfc): a bare trampoline that forwards
; unchanged to advanceObjectPathStep (0x0d71, the slot-1 path-walk
; handler); it performs no work and holds no state of its own.
advanceObjectPathStepAlias:
108E: C3 71 0D        JP      $0D71               ; {code.advanceObjectPathStep} forward to the slot-1 path walk unchanged

; Object-AI state-12 handler: tick sub-counter ix+3, force state ix+2=8
; (re-enter the arm-window state armDirectedMoveWhenInWindow), and begin a
; fresh cross-player horizontal move (beginObjectCrossPlayerMove)
restartObjectMoveRun:
1091: DD 34 03        INC     (IX+$03)            ; tick this object's move-run sub-counter
1094: DD 36 02 08     LD      (IX+$02),$08        ; force the object's AI state to 8 (re-arm the directed-move window)
1098: C3 7B 0F        JP      $0F7B               ; {code.beginObjectCrossPlayerMove} begin a fresh cross-player horizontal move

; Object-AI state-13 entry: derive step count n=(~seed[ix+7])&3; write n+1
; to step-count (ix+22) and code byte ((n+1)<<4)+140 to ix+3; arm phase
; timer (ix+16)=24; advance sub-state (ix+2); clear ready flag (ix+15)
; then re-arm it (=24) only when n==0.
initObjectPhaseSteps:
109B: DD 7E 07        LD      A,(IX+$07)          ; read the object's packed grid-cell seed
109E: 2F              CPL                         ; complement it
109F: E6 03           AND     $03                 ; keep the low two bits -- the phase-step count 0..3
10A1: 47              LD      B,A                 ; stash the step count
10A2: 3C              INC     A                   ; add one to it
10A3: DD 77 16        LD      (IX+$16),A          ; store the step count (n+1) in the record
10A6: 07              RLCA                        ; shift left to build the code byte
10A7: 07              RLCA                        ; shift left again
10A8: 07              RLCA                        ; shift left again
10A9: 07              RLCA                        ; shift left again -- (n+1) times sixteen
10AA: C6 8C           ADD     A,$8C               ; add 140 to form the sprite code byte
10AC: DD 77 03        LD      (IX+$03),A          ; store the code byte in the record
10AF: DD 36 10 18     LD      (IX+$10),$18        ; arm the phase timer to 24
10B3: DD 34 02        INC     (IX+$02)            ; advance the object's sub-state
10B6: DD 36 0F 00     LD      (IX+$0F),$00        ; clear the object's ready flag
10BA: 78              LD      A,B                 ; recall the step count
10BB: A7              AND     A                   ; test it
10BC: C0              RET     NZ                  ; nonzero -- leave the ready flag clear
10BD: DD 36 0F 18     LD      (IX+$0F),$18        ; step count was zero -- re-arm the ready flag to 24
10C1: C9              RET                         ; done

; object-AI state 14 (driveObjectSlot state table idx 14, table @0x0ce6):
; bump the object record's tick (ix+4) and count down its dwell timer
; (ix+16); while it runs, return. On expiry, enqueue a channel-6 command
; word carrying the object's payload selector (ix+7 + 75), dispatched to
; renderMessageColumn (0x22f1), and advance the object state (ix+2).
advanceObjectAndQueueMessageColumn:
10C2: DD 34 04        INC     (IX+$04)            ; bump the object's message-column tick
10C5: DD 35 10        DEC     (IX+$10)            ; count down its dwell timer
10C8: C0              RET     NZ                  ; still counting -- hold this frame
10C9: DD 7E 07        LD      A,(IX+$07)          ; read the object's message payload selector
10CC: C6 4B           ADD     A,$4B               ; add 75 to form the message-column parameter
10CE: 5F              LD      E,A                 ; low byte of the command word
10CF: 16 06           LD      D,$06               ; high byte 6 -- the message-column draw channel
10D1: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue the deferred message-column draw command
10D4: DD 34 02        INC     (IX+$02)            ; advance the object's AI state
10D7: C9              RET                         ; done

; Per-frame settle handler: step the object coordinate ix+0x04 up one
; count per frame until it lands within 5 of the rest value 0xc8 (200),
; then hold.
settleObjectXAtRest:
10D8: DD 7E 04        LD      A,(IX+$04)          ; read the object's coordinate
10DB: D6 C8           SUB     $C8                 ; measure its distance below the rest value 200
10DD: FE 05           CP      $05                 ; is it within 5 of rest?
10DF: D8              RET     C                   ; yes -- hold it at rest
10E0: DD 34 04        INC     (IX+$04)            ; otherwise step it one closer to rest
10E3: C9              RET                         ; done

; Deactivated/dying-object animation sub-state dispatcher: read the object
; record's sub-state field (ix+2) and tail-dispatch via rst-28 (no
; continuation pushed) to the matching phase handler (armObjectAnimAndRequ
; estSound/tickDeactivatedObjectAnim/endObjectAnimOnTimerExpiry/noopAnimDi
; spatchSlot); the selected handler's own return returns to
; dispatchDeactivatedObjectAnim's caller.
dispatchDeactivatedObjectAnim:
10E4: DD 7E 02        LD      A,(IX+$02)          ; read the deactivated object's animation sub-state
10E7: EF              RST     $28                 ; dispatch through the animation jump table by that sub-state

; ---- $10E8-$10EF: jump table ----
10E8: F0 10 12 11 3D 11 46 11

; Sub-state-0 entry of a deactivated object's animation: seed the
; animation timers, advance its sub-state, and post a position-keyed sound
; request
armObjectAnimAndRequestSound:
10F0: DD 36 10 04     LD      (IX+$10),$04        ; seed the fast animation timer to 4
10F4: DD 36 11 04     LD      (IX+$11),$04        ; seed the slow animation timer to 4
10F8: DD 36 12 1C     LD      (IX+$12),$1C        ; seed the animation companion counter to 28
10FC: DD 34 02        INC     (IX+$02)            ; advance the animation sub-state
10FF: DD 7E 07        LD      A,(IX+$07)          ; read the object's position field
1102: FE 70           CP      $70                 ; is it in the upper region (>=112)?
1104: 30 06           JR      NC,$110C            ; {code.loc_110c} yes -- request the alternate explosion sound
1106: 3E 07           LD      A,$07               ; sound-sweep request code 7
1108: 32 DF 41        LD      ($41DF),A           ; {hard.workRam+1DF} post the sound-sweep request
110B: C9              RET                         ; done

loc_110c:
110C: 3E 17           LD      A,$17               ; alternate sound-sweep request code 0x17
110E: 32 DF 41        LD      ($41DF),A           ; {hard.workRam+1DF} post the alternate sound-sweep request
1111: C9              RET                         ; done

; Sub-state-1 tick of the deactivated/dying object animation: count the
; fast timer (ix+16) down, reloading it (=4) and bumping the companion
; (ix+18) on elapse; then the slow timer (ix+17); on slow elapse either
; retire the object (state byte ix+1=0) or — when the position field
; ix+7>=112 — reload fast=50, seed the companion from global $422D+32, and
; advance the sub-state (ix+2).
tickDeactivatedObjectAnim:
1112: DD 35 10        DEC     (IX+$10)            ; tick the fast animation timer
1115: C0              RET     NZ                  ; not due yet -- hold this frame
1116: DD 36 10 04     LD      (IX+$10),$04        ; reload the fast timer to 4
111A: DD 34 12        INC     (IX+$12)            ; bump the animation companion counter
111D: DD 35 11        DEC     (IX+$11)            ; tick the slow animation timer
1120: C0              RET     NZ                  ; slow timer not expired -- hold
1121: DD 7E 07        LD      A,(IX+$07)          ; read the object's position field
1124: FE 70           CP      $70                 ; is it in the upper region (>=112)?
1126: 30 05           JR      NC,$112D            ; {code.loc_112d} yes -- restart the animation lower down
1128: DD 36 01 00     LD      (IX+$01),$00        ; clear the object's dying flag -- retire it
112C: C9              RET                         ; done

loc_112d:
112D: DD 36 10 32     LD      (IX+$10),$32        ; reload the fast timer to 50
1131: 3A 2D 42        LD      A,($422D)           ; {hard.workRam+22D} read the global neighbour-bonus base
1134: C6 20           ADD     A,$20               ; add 32
1136: DD 77 12        LD      (IX+$12),A          ; seed the companion counter from it
1139: DD 34 02        INC     (IX+$02)            ; advance the animation sub-state
113C: C9              RET                         ; done

; Sub-state-2 tick of the deactivated-object animation: count the dwell
; timer down and clear the object's state flag when it expires
endObjectAnimOnTimerExpiry:
113D: DD 35 10        DEC     (IX+$10)            ; tick the animation dwell timer
1140: C0              RET     NZ                  ; still counting -- hold this frame
1141: DD 36 01 00     LD      (IX+$01),$00        ; clear the object's dying flag -- end the animation
1145: C9              RET                         ; done

; No-op terminal slot (sub-state 3) of the object-animation dispatch table
noopAnimDispatchSlot:
1146: C9              RET                         ; terminal no-op slot of the animation table

; Unpack an object's packed grid-cell (record+7) into its position fields,
; matching the): row bits set the X field record+3=124-3/4*row; column
; bits set the Y field record+4=formation anchor(0x420e)+col*16+7. Display
; axes are rotated 90deg from the formation grid.
positionObjectFromGridCell:
1147: DD 7E 07        LD      A,(IX+$07)          ; read the object's packed formation grid-cell
114A: E6 70           AND     $70                 ; isolate the row bits (mask 0x70)
114C: 0F              RRCA                        ; shift the row value down
114D: 4F              LD      C,A                 ; stash it
114E: 0F              RRCA                        ; shift once more
114F: 81              ADD     A,C                 ; add -- three-quarters of the row value
1150: ED 44           NEG                         ; negate it
1152: C6 7C           ADD     A,$7C               ; add 124 -- X = 124 minus three-quarters of the row
1154: DD 77 03        LD      (IX+$03),A          ; store the object's screen X
1157: DD 7E 07        LD      A,(IX+$07)          ; re-read the packed grid-cell
115A: E6 0F           AND     $0F                 ; isolate the column bits (mask 0x0f)
115C: 07              RLCA                        ; shift the column value up
115D: 07              RLCA                        ; shift again
115E: 07              RLCA                        ; shift again
115F: 07              RLCA                        ; shift again -- column times sixteen
1160: C6 07           ADD     A,$07               ; add the 7-pixel hotspot
1162: 4F              LD      C,A                 ; stash column offset
1163: 3A 0E 42        LD      A,($420E)           ; {hard.workRam+20E} read the swaying formation anchor
1166: 81              ADD     A,C                 ; add the column offset so Y tracks the anchor
1167: DD 77 04        LD      (IX+$04),A          ; store the object's screen Y
116A: C9              RET                         ; done

; Run ((record+0x18 seed)&3)+1 steps of a cross-coupled fixed-point
; rotation over two 16-bit accumulators in the object record (hi/lo at
; record+0x19/+0x1b and +0x1a/+0x1c), each step adding twice the other
; accumulator's sign-extended high byte with a high-byte==128 overflow-
; revert guard; the accumulator high bytes become the swoop/flight offset
; the dive AI adds to screen Y.
advanceObjectFlightCurve:
116B: DD 7E 18        LD      A,(IX+$18)          ; read the flight-curve step seed
116E: E6 03           AND     $03                 ; keep its low two bits
1170: 3C              INC     A                   ; add one -- 1 to 4 rotation steps
1171: 47              LD      B,A                 ; loop count into B
1172: DD 66 19        LD      H,(IX+$19)          ; load flight accumulator A high byte
1175: DD 6E 1A        LD      L,(IX+$1A)          ; load flight accumulator A low byte
1178: DD 56 1B        LD      D,(IX+$1B)          ; load flight accumulator B high byte
117B: DD 5E 1C        LD      E,(IX+$1C)          ; load flight accumulator B low byte

loc_117e:
117E: 7D              LD      A,L                 ; take accumulator A low
117F: 4C              LD      C,H                 ; stash accumulator A high
1180: 87              ADD     A,A                 ; double it -- pull the sign into carry
1181: 30 01           JR      NC,$1184            ; {code.loc_1184} no carry -- skip the high-byte borrow
1183: 25              DEC     H                   ; carry -- sign-extend by borrowing the high byte down

loc_1184:
1184: 82              ADD     A,D                 ; add accumulator B low (cross-couple)
1185: 57              LD      D,A                 ; store it into B low
1186: 3E 00           LD      A,$00               ; clear A for the high-byte add
1188: 8C              ADC     A,H                 ; add accumulator A high with carry
1189: FE 80           CP      $80                 ; did the high byte hit the 128 overflow point?
118B: 20 01           JR      NZ,$118E            ; {code.loc_118e} no -- keep the new value
118D: 79              LD      A,C                 ; overflow -- revert to the saved high byte

loc_118e:
118E: 67              LD      H,A                 ; store accumulator B's new high byte
118F: 4D              LD      C,L                 ; stash accumulator A low
1190: ED 44           NEG                         ; negate it -- the cross term is anti-symmetric
1192: 87              ADD     A,A                 ; double it -- pull the sign into carry
1193: 30 01           JR      NC,$1196            ; {code.loc_1196} no carry -- skip the borrow
1195: 2D              DEC     L                   ; carry -- borrow the tracking low byte down

loc_1196:
1196: 83              ADD     A,E                 ; add accumulator B's other low half (cross-couple back)
1197: 5F              LD      E,A                 ; store it
1198: 3E 00           LD      A,$00               ; clear A for the high-byte add
119A: 8D              ADC     A,L                 ; add with carry
119B: FE 80           CP      $80                 ; hit the 128 overflow point?
119D: 20 01           JR      NZ,$11A0            ; {code.loc_11a0} no -- keep it
119F: 79              LD      A,C                 ; overflow -- revert to the saved value

loc_11a0:
11A0: 6F              LD      L,A                 ; store the updated tracking low byte
11A1: 10 DB           DJNZ    $117E               ; {code.loc_117e} run the remaining rotation steps
11A3: DD 74 19        LD      (IX+$19),H          ; write flight accumulator A high back
11A6: DD 75 1A        LD      (IX+$1A),L          ; write flight accumulator A low back
11A9: DD 72 1B        LD      (IX+$1B),D          ; write flight accumulator B high back
11AC: DD 73 1C        LD      (IX+$1C),E          ; write flight accumulator B low back
11AF: C9              RET                         ; done -- the accumulator high bytes are the swoop offset

; Aim an object at the target-X anchor: from the vertical drop (0xf0 -
; sprite Y, ix+3) and the horizontal delta (target-X 0x4202 - sprite X,
; ix+4) derive a direction octant via computeDirectionOctantFromSlope
; (computeDirectionOctantFromSlope), mirroring the octant for a left-of-
; target delta, and store it in the object's direction field (ix+5).
aimObjectAtTarget:
11B0: 3E F0           LD      A,$F0               ; load 240, the bottom reference line
11B2: DD 96 03        SUB     (IX+$03)            ; subtract the object's X (record+3) to gauge its distance from the 240 reference line
11B5: 57              LD      D,A                 ; stash the drop for the slope
11B6: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the target-X anchor (the ship's X)
11B9: DD 96 04        SUB     (IX+$04)            ; subtract the object's Y (record+4) to get the aim delta toward the ship
11BC: 38 07           JR      C,$11C5             ; {code.loc_11c5} target is left of the object -- take the mirrored branch
11BE: CD D0 11        CALL    $11D0               ; {code.computeDirectionOctantFromSlope} turn the slope into a direction octant
11C1: DD 77 05        LD      (IX+$05),A          ; store the octant as the object's heading
11C4: C9              RET                         ; done

loc_11c5:
11C5: ED 44           NEG                         ; make the leftward delta positive
11C7: CD D0 11        CALL    $11D0               ; {code.computeDirectionOctantFromSlope} compute the octant from the slope
11CA: ED 44           NEG                         ; mirror the octant back for the left side
11CC: DD 77 05        LD      (IX+$05),A          ; store the mirrored heading
11CF: C9              RET                         ; done

; Turn a slope (dividend/divisor, divided via divideUnsigned8) into a 0-7
; direction octant: clamp a top-bit-set (steepest) quotient to 0x80,
; return the top three bits as the octant in A. Consumed by
; aimObjectAtTarget (aimObjectAtTarget) as the object's stored heading.
computeDirectionOctantFromSlope:
11D0: CD 48 00        CALL    $0048               ; {code.divideUnsigned8} divide to get the slope quotient
11D3: 79              LD      A,C                 ; take the quotient
11D4: A7              AND     A                   ; test its top bit
11D5: F2 DA 11        JP      P,$11DA             ; {code.loc_11da} top bit clear -- use it as-is
11D8: 3E 80           LD      A,$80               ; top bit set (steepest) -- clamp to 0x80

loc_11da:
11DA: 07              RLCA                        ; rotate the quotient up
11DB: 07              RLCA                        ; rotate up again
11DC: 07              RLCA                        ; rotate up again -- bring the top three bits down
11DD: E6 07           AND     $07                 ; keep the 0-7 direction octant
11DF: C9              RET                         ; done

; Claim the first free slot in the 14-entry projectile table at 0x4260
; (stride 5, bit0 of entry[0]=active) and populate it from the IX object:
; entry[0]=active, entry[1]=sprite Y, entry[3]=sprite X, entry[4]=X
; velocity scaled toward the player-X reference 0x4202 (via
; computeJitteredXVelocity, mirrored when the target is to the left); no-
; op when the table is full. An aimed enemy shot at the player. Tail-
; called by advanceObjectFlightAndFire/advanceHomingObjectFlightAndFire on
; a firing-row match.
spawnAimedProjectileAtPlayer:
11E0: 11 05 00        LD      DE,$0005            ; de = 5, the stride of one enemy-shot record in the bullet table
11E3: 21 60 42        LD      HL,$4260            ; point HL at the enemy-shot table base (0x4260)
11E6: 06 0E           LD      B,$0E               ; B = 14, scan all fourteen shot slots

loc_11e8:
11E8: CB 46           BIT     0,(HL)              ; test bit 0 of this slot -- is it already carrying a live bullet?
11EA: 28 04           JR      Z,$11F0             ; {code.loc_11f0} slot is free -- go seed a new aimed shot here
11EC: 19              ADD     HL,DE               ; step HL to the next shot record
11ED: 10 F9           DJNZ    $11E8               ; {code.loc_11e8} keep scanning slots for a free one
11EF: C9              RET                         ; every shot slot is busy -- give up, no new bullet this call

loc_11f0:
11F0: 36 01           LD      (HL),$01            ; mark the found slot active (bit 0) -- a bullet now lives here
11F2: 23              INC     HL                  ; advance to the slot's X byte
11F3: DD 7E 03        LD      A,(IX+$03)          ; read the firing alien's sprite X (record+3)
11F6: 77              LD      (HL),A              ; seat the bullet's X at the alien's column
11F7: 3E F0           LD      A,$F0               ; A = 0xf0
11F9: 96              SUB     (HL)                ; subtract the bullet X to gauge its distance from the far edge
11FA: 57              LD      D,A                 ; stash that in D
11FB: 23              INC     HL                  ; step toward the slot's Y byte
11FC: 23              INC     HL                  ; (second step to the Y byte)
11FD: DD 7E 04        LD      A,(IX+$04)          ; read the firing alien's Y field (record+4)
1200: 77              LD      (HL),A              ; seat the bullet's Y at the alien
1201: 23              INC     HL                  ; advance to the slot's velocity byte
1202: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the player ship's position (0x4202)
1205: DD 96 04        SUB     (IX+$04)            ; subtract the alien's field to get the aim delta toward the ship
1208: 38 05           JR      C,$120F             ; {code.loc_120f} ship is on the other side -- take the negated branch
120A: CD 18 12        CALL    $1218               ; {code.computeJitteredXVelocity} turn the delta into a jittered aim velocity
120D: 77              LD      (HL),A              ; store the aimed velocity into the bullet
120E: C9              RET                         ; bullet seeded -- done

loc_120f:
120F: ED 44           NEG                         ; negate the delta to a positive magnitude
1211: CD 18 12        CALL    $1218               ; {code.computeJitteredXVelocity} turn that magnitude into a jittered aim velocity
1214: ED 44           NEG                         ; negate it back to aim the bullet the other way
1216: 77              LD      (HL),A              ; store the aimed velocity into the bullet
1217: C9              RET                         ; done

; RNG-jittered slope scaler: divide dividend/divisor via divideUnsigned8,
; add a bounded PRNG draw (0..31, advanceRandomSeed/$003C) plus a floor of
; 6, and clamp to 0x7f on positive overflow; return the value in A. Its
; consumer spawnAimedProjectileAtPlayer stores it as a spawned object's
; scaled X velocity (0x4260 table entry[4], mirrored when left of target).
computeJitteredXVelocity:
1218: CD 48 00        CALL    $0048               ; {code.divideUnsigned8} call the page-zero helper feeding the aim
121B: CD 3C 00        CALL    $003C               ; {code.advanceRandomSeed} draw a fresh random number from the seed
121E: E6 1F           AND     $1F                 ; keep the low five bits -- a 0..31 jitter
1220: 81              ADD     A,C                 ; add the base slope in C
1221: C6 06           ADD     A,$06               ; add a floor of 6 so the shot always drifts toward the ship
1223: F0              RET     P                   ; result stayed positive -- use it as the velocity
1224: 3E 7F           LD      A,$7F               ; overshoot -- clamp the velocity to 0x7f
1226: C9              RET                         ; return the aim velocity

; Player-shot vs object-table sweep: when the shot gate 0x4208 bit0 is
; armed, box-test the shot reference (0x4209/0x420a) against each of the 7
; object records (OBJ_TABLE 0x42d0, stride 0x20) via
; flagPlayerShotHitOnObject, scoring and deactivating any it overlaps.
; Gate clear -> no-op.
flagPlayerShotHitsOnObjects:
1227: 3A 08 42        LD      A,($4208)           ; {hard.workRam+208} read the player-shot gate (0x4208)
122A: 0F              RRCA                        ; rotate bit 0 into carry -- is a shot in flight?
122B: D0              RET     NC                  ; no shot airborne -- nothing to collide, return
122C: DD 21 D0 42     LD      IX,$42D0            ; point IX at the object table (0x42d0), the divers
1230: 11 20 00        LD      DE,$0020            ; DE = 32, one object record's stride
1233: 06 07           LD      B,$07               ; B = 7, test all seven attacker records

loc_1235:
1235: D9              EXX                         ; swap to the alternate register bank for the loop bookkeeping
1236: CD 3F 12        CALL    $123F               ; {code.flagPlayerShotHitOnObject} box-test this diver against the player's shot
1239: D9              EXX                         ; swap the register bank back
123A: DD 19           ADD     IX,DE               ; step IX to the next object record
123C: 10 F7           DJNZ    $1235               ; {code.loc_1235} keep checking every diver against the shot
123E: C9              RET                         ; done sweeping the divers

; Per-object hit test: for an active object at IX, box-test its position
; (ix+3/ix+4) against the player-shot reference (0x4209/0x420a) inside a
; 6-wide x 12-tall window; on overlap raise shot-retire flag 0x420b=1 and
; tail-call awardKillScoreByBandAndDeactivate to score+deactivate the
; object. Sibling of flagPlayerShotHitOnFormation (0x0b0b).
flagPlayerShotHitOnObject:
123F: DD CB 00 46     BIT     0,(IX+$00)          ; skip an inactive object slot
1243: C8              RET     Z                   ; return on an inactive slot
1244: 2A 09 42        LD      HL,($4209)          ; {hard.workRam+209} load the shot's position pair (0x4209 X, high byte Y)
1247: DD 7E 03        LD      A,(IX+$03)          ; read the object's sprite X (record+3)
124A: 95              SUB     L                   ; subtract the shot X
124B: C6 02           ADD     A,$02               ; bias by 2 to centre the hit box
124D: FE 06           CP      $06                 ; inside a 6-wide window on X?
124F: D0              RET     NC                  ; miss on X -- return
1250: DD 7E 04        LD      A,(IX+$04)          ; read the object's sprite Y (record+4)
1253: 94              SUB     H                   ; subtract the shot Y
1254: C6 05           ADD     A,$05               ; bias by 5 to centre the hit box
1256: FE 0C           CP      $0C                 ; inside a 12-tall window on Y?
1258: D0              RET     NC                  ; miss on Y -- return
1259: 3E 01           LD      A,$01               ; a hit
125B: 32 0B 42        LD      ($420B),A           ; {hard.workRam+20B} raise the shot's retire flag (0x420b) so it clears next frame

; Deactivate the hit object (slot[0]=0,[1]=1,[2]=0) and award a kill score
; sized by which of 3 bands its position/type field (obj+7) falls in vs
; threshold 0x50; on band-exhaust raise inhibit word 0x422b=0xf001, fold a
; neighbour bonus when ACTIVE_NEIGHBOR_COUNT(0x422a)==2 (record at
; 0x422d), and enqueue the channel-3 score-add command (BCD score handler
; 0x21a6).
awardKillScoreByBandAndDeactivate:
125E: DD 36 00 00     LD      (IX+$00),$00        ; deactivate the struck object (record+0 = 0)
1262: DD 36 01 01     LD      (IX+$01),$01        ; flip on its dying-animation flag (record+1 = 1)
1266: DD 36 02 00     LD      (IX+$02),$00        ; reset its AI state index (record+2 = 0)
126A: 11 04 03        LD      DE,$0304            ; D=3 the score command channel, E=4 the starting score code
126D: 01 50 03        LD      BC,$0350            ; B=3 score bands, C=0x50 the first band threshold
1270: DD 7E 07        LD      A,(IX+$07)          ; read the object's position/type field (record+7)

loc_1273:
1273: B9              CP      C                   ; is the field below this band's threshold?
1274: DA F2 08        JP      C,$08F2             ; {code.enqueueCommandWord} yes -- hand the score word to the command queue
1277: 1C              INC     E                   ; step E to the next-higher score code
1278: D6 10           SUB     $10                 ; drop the threshold by 0x10 for the next band
127A: 10 F7           DJNZ    $1273               ; {code.loc_1273} test the next band down
127C: 21 01 F0        LD      HL,$F001            ; HL = 0xf001, the top-row neighbour-bonus seed
127F: 22 2B 42        LD      ($422B),HL          ; {hard.workRam+22B} stash it into 0x422b
1282: 3A 2A 42        LD      A,($422A)           ; {hard.workRam+22A} read the count of active neighbours (0x422a)
1285: FE 02           CP      $02                 ; exactly two neighbours left?
1287: CC 92 12        CALL    Z,$1292             ; {code.bumpCountIfNeighborsInactive} yes -- fold in the neighbour bonus
128A: 32 2D 42        LD      ($422D),A           ; {hard.workRam+22D} record the neighbour-bonus code at 0x422d
128D: 83              ADD     A,E                 ; add the bonus to the score code
128E: 5F              LD      E,A                 ; put the summed code back in E
128F: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} hand the kill's score word to the command queue

; Return the count incremented by one only when both look-ahead object
; slots are inactive, else unchanged
bumpCountIfNeighborsInactive:
1292: DD CB 20 46     BIT     0,(IX+$20)          ; is the slot one row above (record+0x20) still active?
1296: C0              RET     NZ                  ; yes -- no bonus, return
1297: DD CB 40 46     BIT     0,(IX+$40)          ; is the slot two rows above (record+0x40) still active?
129B: C0              RET     NZ                  ; yes -- no bonus, return
129C: 3C              INC     A                   ; both neighbours gone -- bump the bonus code
129D: C9              RET                         ; return the bonus

; Object vs player collision sweep: when the object subsystem 0x4200 bit0
; is enabled, box-test each of the 7 objects (OBJ_TABLE 0x42d0, stride
; 0x20) against the player-X reference 0x4202 via flagObjectHitOnPlayer,
; raising HIT_EVENT_FLAG (0x4204) on any overlap. Disabled -> no-op.
flagObjectHitsOnPlayer:
129E: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-active master flag (0x4200)
12A1: 0F              RRCA                        ; rotate bit 0 into carry -- is play live?
12A2: D0              RET     NC                  ; subsystem off -- no collisions, return
12A3: DD 21 D0 42     LD      IX,$42D0            ; point IX at the object table (0x42d0), the divers
12A7: 11 20 00        LD      DE,$0020            ; DE = 32, one object record's stride
12AA: 06 07           LD      B,$07               ; B = 7, all seven divers

loc_12ac:
12AC: D9              EXX                         ; swap register bank for the loop
12AD: CD B6 12        CALL    $12B6               ; {code.flagObjectHitOnPlayer} test this diver against the player ship
12B0: D9              EXX                         ; swap the register bank back
12B1: DD 19           ADD     IX,DE               ; step IX to the next diver
12B3: 10 F7           DJNZ    $12AC               ; {code.loc_12ac} keep checking every diver against the ship
12B5: C9              RET                         ; done

; Per-object player-collision test: for an active object at IX, classify
; (ix+3)+0x21 into a near (<5) or far (<0x11) window and test player-X
; reference 0x4202 minus (ix+4) against the window's band (near +7/0x0f,
; far +0x0a/0x15); on overlap raise HIT_EVENT_FLAG 0x4204=1 (consumed by
; handlePlayerHitEvent 0x12ed) and tail-call
; awardKillScoreByBandAndDeactivate.
flagObjectHitOnPlayer:
12B6: DD CB 00 46     BIT     0,(IX+$00)          ; skip an inactive diver
12BA: C8              RET     Z                   ; return on an inactive slot
12BB: DD 7E 03        LD      A,(IX+$03)          ; read the diver's sprite X (record+3)
12BE: C6 21           ADD     A,$21               ; add 0x21 to place it against the ship's row band
12C0: D6 05           SUB     $05                 ; subtract 5 -- lower edge of the near band
12C2: 38 16           JR      C,$12DA             ; {code.loc_12da} below it -- try the far band instead
12C4: D6 0C           SUB     $0C                 ; subtract 0x0c -- span of the near band
12C6: D0              RET     NC                  ; past the band -- no collision, return
12C7: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the ship's position (0x4202)
12CA: DD 96 04        SUB     (IX+$04)            ; subtract the diver's Y field
12CD: C6 0A           ADD     A,$0A               ; bias by 0x0a to centre the box
12CF: FE 15           CP      $15                 ; within a 0x15-wide window of the ship?
12D1: D0              RET     NC                  ; miss -- return
12D2: 3E 01           LD      A,$01               ; a collision
12D4: 32 04 42        LD      ($4204),A           ; {hard.workRam+204} raise the player-hit event flag (0x4204)
12D7: C3 5E 12        JP      $125E               ; {code.awardKillScoreByBandAndDeactivate} go deactivate and score the diver

loc_12da:
12DA: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the ship's position (0x4202)
12DD: DD 96 04        SUB     (IX+$04)            ; subtract the diver's Y field
12E0: C6 07           ADD     A,$07               ; bias by 7 to centre the far-band box
12E2: FE 0F           CP      $0F                 ; within a 0x0f window of the ship?
12E4: D0              RET     NC                  ; miss -- return
12E5: 3E 01           LD      A,$01               ; a collision
12E7: 32 04 42        LD      ($4204),A           ; {hard.workRam+204} raise the player-hit event flag (0x4204)
12EA: C3 5E 12        JP      $125E               ; {code.awardKillScoreByBandAndDeactivate} go deactivate and score the diver

; Sole consumer of HIT_EVENT_FLAG (0x4204, raised by
; flagProjectileHitOnPlayer 0x0b8d when an enemy shot overlaps the
; player); called from the per-frame pipeline
; runGameplayFrameAndAdvanceOnFieldClear. If bit0 clear, no-op; else clear
; it, zero OBJ_ACTIVE_FLAG (0x4200) and set 0x4201=1, arm pulse counters
; 0x4205=10/0x4206=4 (the exact pair driveGatedSoundStepSequence ticks
; down), enqueue the hit sound command (2,5), decrement pace counter
; 0x421a (floored at 0), step the [0,5] cycle counter 0x421d, and pulse
; SOUND_W_REG3=1 when 0x4006 bit0 is set.
handlePlayerHitEvent:
12ED: 21 04 42        LD      HL,$4204            ; point HL at the player-hit event flag (0x4204)
12F0: CB 46           BIT     0,(HL)              ; was the ship hit this frame?
12F2: C8              RET     Z                   ; no hit -- return
12F3: 36 00           LD      (HL),$00            ; clear the hit flag
12F5: 21 00 01        LD      HL,$0100            ; HL = 0x0100
12F8: 22 00 42        LD      ($4200),HL          ; {hard.workRam+200} clear the object-active flag and arm death mode (0x4200/0x4201)
12FB: 21 0A 04        LD      HL,$040A            ; HL = 0x040a
12FE: 22 05 42        LD      ($4205),HL          ; {hard.workRam+205} seed the death timer and animation counter (0x4205/0x4206)
1301: 11 05 02        LD      DE,$0205            ; DE = the death-event command word
1304: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} hand the death word to the command queue
1307: 3A 1A 42        LD      A,($421A)           ; {hard.workRam+21A} read the pace/difficulty counter (0x421a)
130A: A7              AND     A                   ; is it already zero?
130B: 28 01           JR      Z,$130E             ; {code.loc_130e} yes -- leave it at zero
130D: 3D              DEC     A                   ; otherwise ease the difficulty down one

loc_130e:
130E: 32 1A 42        LD      ($421A),A           ; {hard.workRam+21A} store the pace counter back
1311: 21 1D 42        LD      HL,$421D            ; point HL at the arm gate (0x421d)
1314: 35              DEC     (HL)                ; count it down one
1315: 7E              LD      A,(HL)              ; read the new value
1316: FE 06           CP      $06                 ; has it dipped below 6?
1318: 38 02           JR      C,$131C             ; {code.loc_131c} below 6 -- keep the countdown value
131A: 36 05           LD      (HL),$05            ; 6 or above (the count wrapped) -- reset it to 5

loc_131c:
131C: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode flag (0x4006)
131F: 0F              RRCA                        ; rotate bit 0 into carry
1320: D0              RET     NC                  ; demo mode -- return without the death sound
1321: 3E 01           LD      A,$01               ; A = 1
1323: 32 03 68        LD      ($6803),A           ; kick the death sound at sound register 3 (0x6803)
1326: C9              RET                         ; return

; Per-frame play-pipeline ticker (runGameplayFrameAndAdvanceOnFieldClear)
; gated by 0x4201 bit0 (armed by handlePlayerHitEvent/handlePlayerHitEvent
; with 0x4205=10, 0x4206=4): prescaler 0x4205 (reload 10) fires once per
; 10 eligible frames, enqueuing command word (2, step=0x4206) and
; decrementing the step; when 0x4206 drains, disable (0x4201=0) and
; silence SOUND_W_REG3 (0x6803=0).
driveGatedSoundStepSequence:
1327: 3A 01 42        LD      A,($4201)           ; {hard.workRam+201} read the death-mode flag (0x4201)
132A: 0F              RRCA                        ; rotate bit 0 into carry -- is the ship dying?
132B: D0              RET     NC                  ; not dying -- return
132C: 21 05 42        LD      HL,$4205            ; point HL at the death sub-timer (0x4205)
132F: 35              DEC     (HL)                ; count it down
1330: C0              RET     NZ                  ; still running -- return
1331: 36 0A           LD      (HL),$0A            ; reload the sub-timer to 10 for the next animation beat
1333: 23              INC     HL                  ; step to the animation frame counter (0x4206)
1334: 16 02           LD      D,$02               ; D = 2, the animation command channel
1336: 5E              LD      E,(HL)              ; read the frame counter into E as the parameter
1337: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} hand the animation word to the command queue
133A: 35              DEC     (HL)                ; count down the animation frames
133B: C0              RET     NZ                  ; more frames to play -- return
133C: AF              XOR     A                   ; A = 0
133D: 32 01 42        LD      ($4201),A           ; {hard.workRam+201} clear the death-mode flag -- animation over
1340: 32 03 68        LD      ($6803),A           ; silence the death sound (0x6803)
1343: C9              RET                         ; return

; One-shot on SUBCOUNTER_REFILL_FLAG (0x4228, consumed): while region-
; clear gate 0x4220 bit0 is clear, derive a 1..4 slot budget from the pace
; counter (0x421a+0x421b), claim the first both-bytes-zero object slot
; scanning down from 0x4391 (stride 31), stamp the launch direction
; (0x4215) into slot+6, scan COLUMN_OCCUPANCY for an occupied column by
; direction, walk that FLAG_BITS_BASE grid column for a filled cell, clear
; the cell, activate the slot (byte0=1, phase byte2=0, slot+7=cell-low),
; and enqueue a type-1 spawn command word. Launches one new diving
; attacker out of the standing formation when the pace/refill timer fires.
launchAttackerFromFormation:
1344: 3A 28 42        LD      A,($4228)           ; {hard.workRam+228} read the launch-refill trigger flag (0x4228)
1347: 0F              RRCA                        ; rotate bit 0 into carry -- did a sub-counter just refill?
1348: D0              RET     NC                  ; no trigger -- return
1349: AF              XOR     A                   ; A = 0
134A: 32 28 42        LD      ($4228),A           ; {hard.workRam+228} clear the one-shot trigger flag (0x4228)
134D: 3A 20 42        LD      A,($4220)           ; {hard.workRam+220} read the region-clear flag (0x4220)
1350: 0F              RRCA                        ; rotate bit 0 into carry
1351: D8              RET     C                   ; formation region empty -- nothing to launch, return
1352: 2A 1A 42        LD      HL,($421A)          ; {hard.workRam+21A} load the pace counter as a word (0x421a)
1355: 7C              LD      A,H                 ; take its high byte
1356: 85              ADD     A,L                 ; add the low byte
1357: 1F              RRA                         ; halve the sum
1358: FE 04           CP      $04                 ; is it under 4?
135A: 38 02           JR      C,$135E             ; {code.loc_135e} yes -- keep it as the slot budget
135C: 3E 03           LD      A,$03               ; cap the slot budget at 3

loc_135e:
135E: 3C              INC     A                   ; bump to a 1..4 slot budget
135F: 47              LD      B,A                 ; B = that budget, the number of slots to try
1360: 21 91 43        LD      HL,$4391            ; point HL at the object-slot scan base (0x4391)
1363: 11 E1 FF        LD      DE,$FFE1            ; DE = -31, the reverse record stride

loc_1366:
1366: 7E              LD      A,(HL)              ; read the slot's high byte
1367: 2B              DEC     HL                  ; step back one byte
1368: B6              OR      (HL)                ; OR in the low byte -- is the slot empty?
1369: 28 04           JR      Z,$136F             ; {code.loc_136f} empty slot found -- go launch an attacker here
136B: 19              ADD     HL,DE               ; step HL back to the previous record
136C: 10 F8           DJNZ    $1366               ; {code.loc_1366} try the next slot in the budget
136E: C9              RET                         ; no free slot in budget -- give up

loc_136f:
136F: E5              PUSH    HL                  ; push the found slot address
1370: DD E1           POP     IX                  ; pop it into IX as the launch slot
1372: 3A 15 42        LD      A,($4215)           ; {hard.workRam+215} read the chosen launch direction (0x4215)
1375: DD 77 06        LD      (IX+$06),A          ; stamp it into the slot's direction byte (record+6)
1378: A7              AND     A                   ; test the direction
1379: 20 30           JR      NZ,$13AB            ; {code.loc_13ab} nonzero direction -- take the other launch branch
137B: 21 FC 41        LD      HL,$41FC            ; point HL at the column-occupancy scan tail (0x41fc)
137E: 01 0A 00        LD      BC,$000A            ; BC = 10, the scan length
1381: 3E 01           LD      A,$01               ; A = 1, look for an occupied-column marker
1383: ED B9           CPDR                        ; scan down the occupancy bytes for a set column
1385: C0              RET     NZ                  ; none found -- return
1386: E0              RET     PO                  ; parity guard -- return if the scan found nothing
1387: 1E 3F           LD      E,$3F               ; E = 0x3f, the flag-block column step base
1389: 2C              INC     L                   ; nudge L onto the found column's flag-block cursor

loc_138a:
138A: 3A EF 41        LD      A,($41EF)           ; {hard.workRam+1EF} read the sweep/config flag at 0x41ef
138D: 0F              RRCA                        ; rotate bit 0 into carry
138E: 30 2D           JR      NC,$13BD            ; {code.loc_13bd} jump to the alternate column geometry when clear
1390: 16 04           LD      D,$04               ; D = 4, the grid rows to climb per column
1392: 26 41           LD      H,$41               ; point H at flag-block page 0x41
1394: 7D              LD      A,L                 ; take the column cursor low byte
1395: E6 0F           AND     $0F                 ; mask to the column nibble
1397: C6 50           ADD     A,$50               ; add 0x50 to land on the bottom cell of the column
1399: 6F              LD      L,A                 ; set L to that flag-block cell

loc_139a:
139A: 42              LD      B,D                 ; B = 4, reset the per-column row count

loc_139b:
139B: CB 46           BIT     0,(HL)              ; test bit 0 -- is there a live alien in this cell?
139D: 20 2F           JR      NZ,$13CE            ; {code.loc_13ce} filled cell found -- go launch it as a diver
139F: 7D              LD      A,L                 ; take the cell cursor
13A0: D6 10           SUB     $10                 ; step up one grid row (16 back)
13A2: 6F              LD      L,A                 ; set L to the row above
13A3: 10 F6           DJNZ    $139B               ; {code.loc_139b} keep climbing this column
13A5: 83              ADD     A,E                 ; advance to the next column's base cell
13A6: 6F              LD      L,A                 ; set L there
13A7: 0D              DEC     C                   ; one fewer column to scan
13A8: 20 F0           JR      NZ,$139A            ; {code.loc_139a} scan the next column
13AA: C9              RET                         ; no filled cell found -- return

loc_13ab:
13AB: 21 F3 41        LD      HL,$41F3            ; point HL into the column-occupancy strip to scan for an occupied column
13AE: 01 0A 00        LD      BC,$000A            ; set the scan count to ten columns
13B1: 3E 01           LD      A,$01               ; the value to hunt for is 1 -- a column that still holds a live alien
13B3: ED B1           CPIR                        ; scan forward for the first occupied column
13B5: C0              RET     NZ                  ; no occupied column found -- give up this launch
13B6: E0              RET     PO                  ; the scan ran off the end -- give up this launch
13B7: 1E 41           LD      E,$41               ; seat E as the high byte of the formation flag-block pointer
13B9: 2D              DEC     L                   ; step back to the column that matched
13BA: C3 8A 13        JP      $138A               ; {code.loc_138a} jump back into the launcher's cell-walk

loc_13bd:
13BD: 16 05           LD      D,$05               ; D counts five rows down this column of the formation
13BF: 26 41           LD      H,$41               ; H is the flag-block page 0x41
13C1: 7D              LD      A,L                 ; take the matched column index
13C2: E6 0F           AND     $0F                 ; keep just the column nibble
13C4: C6 60           ADD     A,$60               ; form the flag-block address for the bottom row of this column
13C6: 6F              LD      L,A                 ; HL now points at a cell in the standing-formation flag block
13C7: 7B              LD      A,E                 ; take the running row pointer
13C8: C6 10           ADD     A,$10               ; step it one grid row (0x10) further
13CA: 5F              LD      E,A                 ; stash it back
13CB: C3 9A 13        JP      $139A               ; {code.loc_139a} jump back to walk this column for a filled cell

loc_13ce:
13CE: 36 00           LD      (HL),$00            ; clear the formation cell -- the alien leaves the standing block
13D0: DD 75 07        LD      (IX+$07),L          ; record the cell's low byte in the new attacker slot as its packed grid cell
13D3: DD 36 00 01     LD      (IX+$00),$01        ; mark the object slot active
13D7: DD 36 02 00     LD      (IX+$02),$00        ; clear its AI state index to 0 -- the spawn-init state
13DB: 16 01           LD      D,$01               ; command channel 1 -- a spawn word
13DD: 5D              LD      E,L                 ; the spawn parameter is the cell index
13DE: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue the attacker's spawn command word

; Sets the shared attacker launch/curve direction flag $4215 (0 or 1): the
; 16-bit formation anchor $420E's sign picks which FORMATION_X_BOUNDS
; (0x4210) edge to measure the 8-bit gap against; within 28px of that edge
; the flag is forced away from the edge (0 near the high bound, 1 near the
; low bound), otherwise a fresh random bit (advanceRandomSeed & 1).
; Consumed by the spawner launchAttackerFromFormation (seeds a new
; attacker's direction field record+6) and spawnObjectsOnDelayedEvent
; (left/right column scan).
chooseNextAttackerDirection:
13E1: 2A 0E 42        LD      HL,($420E)          ; {hard.workRam+20E} load the 16-bit formation anchor
13E4: ED 5B 10 42     LD      DE,($4210)          ; {hard.workRam+210} load the formation's left/right X bounds
13E8: CB 7C           BIT     7,H                 ; test the anchor's sign to pick which edge is close
13EA: 28 0B           JR      Z,$13F7             ; {code.loc_13f7} anchor ascending -- measure against the other bound
13EC: 7D              LD      A,L                 ; take the anchor low byte
13ED: 92              SUB     D                   ; subtract the high bound
13EE: FE 1C           CP      $1C                 ; is the block within 28 pixels of that edge?
13F0: 30 11           JR      NC,$1403            ; {code.loc_1403} far enough from the edge -- pick a random direction
13F2: AF              XOR     A                   ; near the high bound -- force launch direction 0
13F3: 32 15 42        LD      ($4215),A           ; {hard.workRam+215} store the chosen launch direction flag
13F6: C9              RET                         ; done

loc_13f7:
13F7: 7B              LD      A,E                 ; take the low bound
13F8: 95              SUB     L                   ; subtract the anchor low byte
13F9: FE 1C           CP      $1C                 ; is the block within 28 pixels of that edge?
13FB: 30 06           JR      NC,$1403            ; {code.loc_1403} far enough -- pick a random direction
13FD: 3E 01           LD      A,$01               ; near the low bound -- force launch direction 1
13FF: 32 15 42        LD      ($4215),A           ; {hard.workRam+215} store the chosen launch direction flag
1402: C9              RET                         ; done

loc_1403:
1403: CD 3C 00        CALL    $003C               ; {code.advanceRandomSeed} draw a fresh random byte from the seed
1406: E6 01           AND     $01                 ; keep one bit
1408: 32 15 42        LD      ($4215),A           ; {hard.workRam+215} store that as a random launch direction
140B: C9              RET                         ; done

; Delayed-spawn dispatcher (per-frame from update pipeline
; runGameplayFrameAndAdvanceOnFieldClear): gated on region-clear 0x4220
; bit0 clear, OBJ_ACTIVE_FLAG 0x4200 bit0 set, and DELAYED_EVENT_REQUEST
; 0x4229 bit0 set (consumed as a one-shot), and only while the OBJ_TABLE
; 0x42d0 head word is even; then route by launch direction 0x4215 bit0 --
; set = full trigger-block spawn (spawnObjectsFromTriggerFlags 0x14be),
; else scan the primary trigger block 0x4176.. high->low
; (spawnPrimaryAndSecondaryObjects 0x1472), then the secondary window
; (spawnIntoFreeDescriptorSlot 0x1446).
spawnObjectsOnDelayedEvent:
140C: 3A 20 42        LD      A,($4220)           ; {hard.workRam+220} read the region-clear flag
140F: 0F              RRCA                        ; shift its bit0 into carry
1410: D8              RET     C                   ; region already clear -- nothing to spawn, bail
1411: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-subsystem master switch
1414: 0F              RRCA                        ; shift its bit0 into carry
1415: D0              RET     NC                  ; subsystem off -- bail
1416: 3A 29 42        LD      A,($4229)           ; {hard.workRam+229} read the delayed-event request flag
1419: 0F              RRCA                        ; shift its bit0 into carry
141A: D0              RET     NC                  ; no request pending -- bail
141B: AF              XOR     A                   ; clear A
141C: 32 29 42        LD      ($4229),A           ; {hard.workRam+229} consume the request -- one-shot clear
141F: 2A D0 42        LD      HL,($42D0)          ; {hard.workRam+2D0} load the object-table head word
1422: 7C              LD      A,H                 ; take the head high byte
1423: B5              OR      L                   ; fold in the low byte
1424: 0F              RRCA                        ; test the head word's low bit
1425: D8              RET     C                   ; head word odd -- bail
1426: 3A 15 42        LD      A,($4215)           ; {hard.workRam+215} read the launch-direction flag
1429: 4F              LD      C,A                 ; stash it in C as the spawn code
142A: 0F              RRCA                        ; shift its bit0 into carry
142B: DA BE 14        JP      C,$14BE             ; {code.spawnObjectsFromTriggerFlags} direction set -- run the full trigger-block spawn
142E: 21 79 41        LD      HL,$4179            ; else point at the top of the primary trigger block
1431: 06 04           LD      B,$04               ; scan four trigger flags

loc_1433:
1433: CB 46           BIT     0,(HL)              ; is this primary trigger flag set?
1435: 20 3B           JR      NZ,$1472            ; {code.spawnPrimaryAndSecondaryObjects} yes -- spawn a primary and its secondaries
1437: 2D              DEC     L                   ; step down to the next trigger flag
1438: 10 F9           DJNZ    $1433               ; {code.loc_1433} loop over the four primary flags
143A: 2E 6A           LD      L,$6A               ; no primary set -- point at the top of the secondary block
143C: 06 04           LD      B,$04               ; scan four secondary flags

loc_143e:
143E: CB 46           BIT     0,(HL)              ; is this secondary trigger flag set?
1440: 20 04           JR      NZ,$1446            ; {code.spawnIntoFreeDescriptorSlot} yes -- seed a free descriptor slot
1442: 2D              DEC     L                   ; step down to the next flag
1443: 10 F9           DJNZ    $143E               ; {code.loc_143e} loop over the four secondary flags
1445: C9              RET                         ; nothing triggered -- done

; Free-slot finder: scan the 4 descriptor slots at DESCRIPTOR_SLOT_TABLE
; (0x4330) high->low (stride 32) for one whose two guard bytes are both
; zero; on a hit tail-call
; activateObjectSlotAndEnqueueSpawn(trigger,slot,spawnCode) to seed the
; slot and enqueue its spawn word; no free slot -> no-op. Reached from
; spawnObjectsOnDelayedEvent/spawnObjectsFromTriggerFlags.
spawnIntoFreeDescriptorSlot:
1446: DD 21 90 43     LD      IX,$4390            ; point IX at the last descriptor slot
144A: 11 E0 FF        LD      DE,$FFE0            ; DE is the -32 stride to walk slots downward
144D: 06 04           LD      B,$04               ; four descriptor slots to check

loc_144f:
144F: DD 7E 00        LD      A,(IX+$00)          ; read the slot's first guard byte
1452: DD B6 01        OR      (IX+$01)            ; OR in the second guard byte
1455: 28 05           JR      Z,$145C             ; {code.activateObjectSlotAndEnqueueSpawn} both zero -- this slot is free
1457: DD 19           ADD     IX,DE               ; step down to the previous descriptor slot
1459: 10 F4           DJNZ    $144F               ; {code.loc_144f} loop over the four slots
145B: C9              RET                         ; no free slot -- done

; Activate a claimed free object slot: consume the trigger flag it was
; found under (write 0 at HL), mark the slot at IX active (byte0=1, phase
; byte2=0), record the spawn code (C -> byte6) and the trigger pointer's
; low byte as the source index (byte7), then enqueue a type-1 spawn
; command word keyed by that source index; returns the trigger pointer
; unchanged for the caller. Tail/called from the free-slot finders
; spawnIntoFreeDescriptorSlot, spawnPrimaryAndSecondaryObjects,
; spawnObjectsFromTriggerFlags (IX=0x42d0).
activateObjectSlotAndEnqueueSpawn:
145C: 36 00           LD      (HL),$00            ; consume the trigger flag that found this slot
145E: DD 36 00 01     LD      (IX+$00),$01        ; mark the slot active
1462: DD 36 02 00     LD      (IX+$02),$00        ; clear its AI state to 0 -- spawn-init
1466: DD 71 06        LD      (IX+$06),C          ; store the spawn code in slot byte 6
1469: DD 75 07        LD      (IX+$07),L          ; store the trigger's low byte as the slot's source index
146C: 16 01           LD      D,$01               ; command channel 1 -- a spawn word
146E: 5D              LD      E,L                 ; the parameter is the source index
146F: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue the spawn command word

; Spawn a primary object into OBJ_TABLE (0x42d0) via
; activateObjectSlotAndEnqueueSpawn, then walk 3 trigger flags backed up
; (-0x0f) from the primary trigger's low byte and, for each set flag,
; spawn a secondary into the next slot (from 0x42f0) until a budget of 2
; is spent.
spawnPrimaryAndSecondaryObjects:
1472: DD 21 D0 42     LD      IX,$42D0            ; point IX at the primary object table
1476: CD 5C 14        CALL    $145C               ; {code.activateObjectSlotAndEnqueueSpawn} activate the primary object and enqueue its spawn
1479: 7D              LD      A,L                 ; take the trigger index
147A: D6 0F           SUB     $0F                 ; back up fifteen to reach the secondary trigger flags
147C: 6F              LD      L,A                 ; stash it back
147D: FD 21 F0 42     LD      IY,$42F0            ; point IY at the first secondary object slot
1481: 06 03           LD      B,$03               ; up to three secondary flags to walk
1483: 0E 02           LD      C,$02               ; secondary spawn budget of two

loc_1485:
1485: CB 46           BIT     0,(HL)              ; is this secondary trigger flag set?
1487: C4 8E 14        CALL    NZ,$148E            ; {code.spawnSecondaryObjectAndAdvanceWalk} yes -- spawn a secondary into the current slot
148A: 2D              DEC     L                   ; step down to the next flag
148B: 10 F8           DJNZ    $1485               ; {code.loc_1485} loop over the flags
148D: C9              RET                         ; done

; Per-slot step of the secondary-object spawn walk: spawn into the current
; IY slot via spawnSecondaryObjectIntoSlot (0x149b), advance IY by 32 to
; the next record and decrement the C budget; when the budget reaches 0
; also force the caller's B loop counter to 1 so the enclosing walk ends
; after this pass. Called from
; spawnPrimaryAndSecondaryObjects/spawnObjectsFromTriggerFlags.
spawnSecondaryObjectAndAdvanceWalk:
148E: CD 9B 14        CALL    $149B               ; {code.spawnSecondaryObjectIntoSlot} spawn a secondary into the current IY slot
1491: 11 20 00        LD      DE,$0020            ; the slot stride is 32 bytes
1494: FD 19           ADD     IY,DE               ; advance IY to the next object slot
1496: 0D              DEC     C                   ; spend one of the secondary budget
1497: C0              RET     NZ                  ; budget remains -- return
1498: 06 01           LD      B,$01               ; budget spent -- force the outer walk to end after this pass
149A: C9              RET                         ; done

; Called per-slot from spawnSecondaryObjectAndAdvanceWalk's spawn walk (IY
; stepped by 0x20): if neither of the IY slot's two live flags (byte0 bit0
; / byte1 bit0) is set, consume the trigger flag at HL (set 0), mark the
; slot alive (byte0=1), clear its state (byte2=0), inherit field 6 from
; the IX source record, stash the trigger index (byte7), and enqueue
; activation command (1<<8)|index.
spawnSecondaryObjectIntoSlot:
149B: FD CB 00 46     BIT     0,(IY+$00)          ; is this slot already carrying a live object?
149F: C0              RET     NZ                  ; occupied -- skip it
14A0: FD CB 01 46     BIT     0,(IY+$01)          ; is the slot mid dying-animation?
14A4: C0              RET     NZ                  ; busy -- skip it
14A5: 36 00           LD      (HL),$00            ; consume the trigger flag
14A7: FD 36 00 01     LD      (IY+$00),$01        ; mark the secondary slot active
14AB: FD 36 02 00     LD      (IY+$02),$00        ; clear its AI state to 0 -- spawn-init
14AF: DD 7E 06        LD      A,(IX+$06)          ; read the primary source's direction/spawn code
14B2: FD 77 06        LD      (IY+$06),A          ; inherit it into the secondary slot
14B5: FD 75 07        LD      (IY+$07),L          ; store the trigger index as the slot's source
14B8: 16 01           LD      D,$01               ; command channel 1 -- a spawn word
14BA: 5D              LD      E,L                 ; the parameter is the source index
14BB: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue the spawn command word

; Scan the primary trigger block (0x4176, 4 flags): first set flag spawns
; a primary into OBJ_TABLE via activateObjectSlotAndEnqueueSpawn plus up
; to 2 secondaries from the secondary block (0x4165) via
; spawnSecondaryObjectIntoSlot; if no primary flag is set, scan the
; secondary block and on the first set flag seed a free descriptor slot
; via spawnIntoFreeDescriptorSlot.
spawnObjectsFromTriggerFlags:
14BE: 21 76 41        LD      HL,$4176            ; point HL at the base of the primary trigger block
14C1: 06 04           LD      B,$04               ; scan four trigger flags

loc_14c3:
14C3: CB 46           BIT     0,(HL)              ; is this primary trigger flag set?
14C5: 20 10           JR      NZ,$14D7            ; {code.loc_14d7} yes -- spawn a primary and its secondaries
14C7: 2C              INC     L                   ; step up to the next trigger flag
14C8: 10 F9           DJNZ    $14C3               ; {code.loc_14c3} loop over the four primary flags
14CA: 2E 65           LD      L,$65               ; no primary set -- point at the base of the secondary block
14CC: 06 04           LD      B,$04               ; scan four secondary flags

loc_14ce:
14CE: CB 46           BIT     0,(HL)              ; is this secondary trigger flag set?
14D0: C2 46 14        JP      NZ,$1446            ; {code.spawnIntoFreeDescriptorSlot} yes -- seed a free descriptor slot
14D3: 2C              INC     L                   ; step up to the next flag
14D4: 10 F8           DJNZ    $14CE               ; {code.loc_14ce} loop over the four secondary flags
14D6: C9              RET                         ; nothing triggered -- done

loc_14d7:
14D7: DD 21 D0 42     LD      IX,$42D0            ; point IX at the primary object table
14DB: CD 5C 14        CALL    $145C               ; {code.activateObjectSlotAndEnqueueSpawn} activate the primary object and enqueue its spawn
14DE: 7D              LD      A,L                 ; take the trigger index
14DF: D6 11           SUB     $11                 ; back up seventeen to reach the secondary trigger flags
14E1: 6F              LD      L,A                 ; stash it back
14E2: FD 21 F0 42     LD      IY,$42F0            ; point IY at the first secondary object slot
14E6: 06 03           LD      B,$03               ; up to three secondary flags to walk
14E8: 0E 02           LD      C,$02               ; secondary spawn budget of two

loc_14ea:
14EA: CB 46           BIT     0,(HL)              ; is this secondary trigger flag set?
14EC: C4 8E 14        CALL    NZ,$148E            ; {code.spawnSecondaryObjectAndAdvanceWalk} yes -- spawn a secondary into the current slot
14EF: 2C              INC     L                   ; step up to the next flag
14F0: 10 F8           DJNZ    $14EA               ; {code.loc_14ea} loop over the flags
14F2: C9              RET                         ; done

; Gated two-tier prescaler (outer 0x4218 reload 60 -> inner 0x4219 reload
; 20): while OBJ_ACTIVE_FLAG(0x4200) bit0 set and inhibit 0x422b bit0
; clear, step the 0..7 counter 0x421a up by one per double-wrap, clamped
; at 7 (a slow pace/difficulty ramp; advanceStageAndReseedFormation resets
; 0x421a=0 on a stage advance).
rampCounterToCeiling:
14F3: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-subsystem master switch
14F6: 0F              RRCA                        ; shift its bit0 into carry
14F7: D0              RET     NC                  ; subsystem off -- bail
14F8: 3A 2B 42        LD      A,($422B)           ; {hard.workRam+22B} read the ramp inhibit flag
14FB: 0F              RRCA                        ; shift its bit0 into carry
14FC: D8              RET     C                   ; inhibited -- bail
14FD: 21 18 42        LD      HL,$4218            ; point at the outer prescaler of the difficulty ramp
1500: 35              DEC     (HL)                ; tick the outer prescaler down
1501: C0              RET     NZ                  ; not yet wrapped -- done
1502: 36 3C           LD      (HL),$3C            ; reload the outer prescaler to 60
1504: 23              INC     HL                  ; step to the inner prescaler
1505: 35              DEC     (HL)                ; tick the inner prescaler down
1506: C0              RET     NZ                  ; not yet wrapped -- done
1507: 36 14           LD      (HL),$14            ; reload the inner prescaler to 20
1509: 23              INC     HL                  ; step to the 0..7 pace/difficulty counter
150A: 7E              LD      A,(HL)              ; read the pace counter
150B: FE 07           CP      $07                 ; is it already at the ceiling of 7?
150D: C8              RET     Z                   ; pinned at 7 -- done
150E: 30 02           JR      NC,$1512            ; {code.loc_1512} somehow above 7 -- clamp it
1510: 34              INC     (HL)                ; bump the pace counter up one notch
1511: C9              RET                         ; done

loc_1512:
1512: 36 07           LD      (HL),$07            ; clamp the pace counter to 7
1514: C9              RET                         ; done

; Gated prescaler that ticks a master counter (0x424a) and, on expiry,
; sweeps a difficulty-scaled span of attacker sub-counters, refilling each
; expired one and raising the spawn-trigger flag SUBCOUNTER_REFILL_FLAG
; (0x4228) that launchAttackerFromFormation consumes to launch a new
; attacker.
paceEnemyLaunchTrigger:
1515: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-subsystem master switch
1518: 0F              RRCA                        ; shift its bit0 into carry
1519: D0              RET     NC                  ; subsystem off -- bail
151A: 3A 20 42        LD      A,($4220)           ; {hard.workRam+220} read the region-clear flag
151D: 0F              RRCA                        ; shift its bit0 into carry
151E: D8              RET     C                   ; region clear -- nothing to launch, bail
151F: 3A 2B 42        LD      A,($422B)           ; {hard.workRam+22B} read the pacing inhibit flag
1522: 0F              RRCA                        ; shift its bit0 into carry
1523: D8              RET     C                   ; inhibited -- bail
1524: 2A 1A 42        LD      HL,($421A)          ; {hard.workRam+21A} load the pace/stage word
1527: 7C              LD      A,H                 ; take the stage high byte
1528: FE 02           CP      $02                 ; is the stage at least 2?
152A: 30 01           JR      NC,$152D            ; {code.loc_152d} yes -- keep it as the widening term
152C: AF              XOR     A                   ; early stages -- zero the term

loc_152d:
152D: 85              ADD     A,L                 ; add the pace counter low byte
152E: E6 0F           AND     $0F                 ; keep the low nibble
1530: 3C              INC     A                   ; add one
1531: 47              LD      B,A                 ; B is the difficulty-scaled span of sub-counters to sweep
1532: 21 4A 42        LD      HL,$424A            ; point at the master launch-delay counter
1535: 11 E3 15        LD      DE,$15E3            ; point DE at the sub-counter reload table in ROM
1538: 35              DEC     (HL)                ; tick the master counter down
1539: 28 05           JR      Z,$1540             ; {code.loc_1540} master expired -- refill the sub-counters this pass
153B: AF              XOR     A                   ; not yet
153C: 32 28 42        LD      ($4228),A           ; {hard.workRam+228} clear the spawn-trigger refill flag
153F: C9              RET                         ; done

loc_1540:
1540: 0E 00           LD      C,$00               ; start the refill tally at zero
1542: 1A              LD      A,(DE)              ; read the master's reload value from the table
1543: 77              LD      (HL),A              ; reload the master delay counter

loc_1544:
1544: 23              INC     HL                  ; step to the next attacker sub-counter
1545: 13              INC     DE                  ; step the reload table pointer
1546: 35              DEC     (HL)                ; tick this sub-counter down
1547: CC DF 15        CALL    Z,$15DF             ; {code.reloadExpiredCounterAndTally} sub-counter expired -- reload it and bump the refill tally
154A: 10 F8           DJNZ    $1544               ; {code.loc_1544} sweep the whole difficulty-scaled span
154C: 79              LD      A,C                 ; take the refill tally
154D: A7              AND     A                   ; did any sub-counter refill?
154E: C8              RET     Z                   ; none -- done
154F: 3E 01           LD      A,$01               ; load 1
1551: 32 28 42        LD      ($4228),A           ; {hard.workRam+228} raise the spawn-trigger flag -- an attacker may launch
1554: C9              RET                         ; done

; Guarded (OBJ_ACTIVE_FLAG & 0x41ef bit0 set, inhibit 0x422b bit0 clear)
; two-tier timer that arms the delayed-event triple; mode bit 0x4006 clear
; -> on outer(0x4245,60)/inner(0x4246,5) cascade elapse arm fixed
; (DELAYED_EVENT_TIMER 0x422f=90, 0x424a=45, DELAYED_EVENT_ARMED
; 0x422e=1); mode set -> derive the payload from 0x4221 or the byte-sums
; of 0x4177/0x421a and fan it via rotations into the triple.
scheduleDelayedEvent:
1555: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-subsystem master switch
1558: 0F              RRCA                        ; shift its bit0 into carry
1559: D0              RET     NC                  ; subsystem off -- bail
155A: 3A EF 41        LD      A,($41EF)           ; {hard.workRam+1EF} read the delayed-event enable gate
155D: 0F              RRCA                        ; shift its bit0 into carry
155E: D0              RET     NC                  ; gate clear -- bail
155F: 3A 2B 42        LD      A,($422B)           ; {hard.workRam+22B} read the inhibit flag
1562: 0F              RRCA                        ; shift its bit0 into carry
1563: D8              RET     C                   ; inhibited -- bail
1564: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode flag
1567: 0F              RRCA                        ; shift its bit0 into carry
1568: 30 3D           JR      NC,$15A7            ; {code.loc_15a7} mode clear -- take the fixed-arm branch
156A: 21 45 42        LD      HL,$4245            ; point at the outer delay prescaler
156D: 35              DEC     (HL)                ; tick the outer prescaler down
156E: C0              RET     NZ                  ; not yet wrapped -- done
156F: 36 3C           LD      (HL),$3C            ; reload the outer prescaler to 60
1571: 3A 21 42        LD      A,($4221)           ; {hard.workRam+221} read the activity gate
1574: 0F              RRCA                        ; shift its bit0 into carry
1575: 38 2C           JR      C,$15A3             ; {code.loc_15a3} gate set -- take the alternate arm branch
1577: 23              INC     HL                  ; step to the inner delay counter
1578: 35              DEC     (HL)                ; tick the inner counter down
1579: C0              RET     NZ                  ; not yet wrapped -- done
157A: 34              INC     (HL)                ; counter hit zero -- restore it and recompute the delay
157B: 2A 77 41        LD      HL,($4177)          ; {hard.workRam+177} load the word at the derived-term source cell
157E: 7C              LD      A,H                 ; take its high byte
157F: 85              ADD     A,L                 ; fold in its low byte
1580: E6 03           AND     $03                 ; keep the low two bits
1582: 4F              LD      C,A                 ; stash that term in C
1583: 2A 1A 42        LD      HL,($421A)          ; {hard.workRam+21A} load the pace/stage word
1586: 7C              LD      A,H                 ; take its high byte
1587: 85              ADD     A,L                 ; fold in its low byte
1588: C8              RET     Z                   ; zero -- bail
1589: 0F              RRCA                        ; shift down one bit
158A: 0F              RRCA                        ; shift down another bit
158B: E6 03           AND     $03                 ; keep the low two bits
158D: 2F              CPL                         ; invert them
158E: C6 0A           ADD     A,$0A               ; add ten
1590: 91              SUB     C                   ; subtract the derived term
1591: 32 46 42        LD      ($4246),A           ; {hard.workRam+246} store the computed inner delay for the delayed-event timer

loc_1594:
1594: 07              RLCA                        ; shift the delayed-event payload in A left one -- begin scaling it into the timer values
1595: 07              RLCA                        ; shift it left again -- A is now four times the payload
1596: 32 2F 42        LD      ($422F),A           ; {hard.workRam+22F} seat that as the delayed-event countdown timer
1599: 07              RLCA                        ; shift left once more -- A is now eight times the payload
159A: 32 4A 42        LD      ($424A),A           ; {hard.workRam+24A} seat the larger value as the enemy-launch master counter
159D: 3E 01           LD      A,$01               ; load 1
159F: 32 2E 42        LD      ($422E),A           ; {hard.workRam+22E} raise the delayed-event armed flag
15A2: C9              RET                         ; done arming the delayed-event triple

loc_15a3:
15A3: 3E 02           LD      A,$02               ; load payload 2
15A5: 18 ED           JR      $1594               ; {code.loc_1594} fall into the arming fan with that payload

loc_15a7:
15A7: 21 45 42        LD      HL,$4245            ; point at the delayed-event outer cascade counter
15AA: 35              DEC     (HL)                ; count the outer cascade down one this frame
15AB: C0              RET     NZ                  ; still running -- leave
15AC: 36 3C           LD      (HL),$3C            ; reload the outer counter to 60
15AE: 23              INC     HL                  ; step to the inner cascade counter
15AF: 35              DEC     (HL)                ; count the inner counter down
15B0: C0              RET     NZ                  ; still running -- leave
15B1: 36 05           LD      (HL),$05            ; reload the inner counter to 5
15B3: 3E 5A           LD      A,$5A               ; load 90
15B5: 32 2F 42        LD      ($422F),A           ; {hard.workRam+22F} arm the delayed-event countdown timer at 90
15B8: 3E 2D           LD      A,$2D               ; load 45
15BA: 32 4A 42        LD      ($424A),A           ; {hard.workRam+24A} set the enemy-launch master counter to 45
15BD: 3E 01           LD      A,$01               ; load 1
15BF: 32 2E 42        LD      ($422E),A           ; {hard.workRam+22E} raise the delayed-event armed flag
15C2: C9              RET                         ; done -- the delayed event is armed

; Delayed one-shot: while DELAYED_EVENT_ARMED (0x422e) bit0 set, count
; DELAYED_EVENT_TIMER (0x422f) down each frame; on the zero tick disarm
; (one-shot) and, only if OBJ_ACTIVE_FLAG & 0x41ef bit0 both set, raise
; DELAYED_EVENT_REQUEST (0x4229).
fireDelayedEventRequest:
15C3: 21 2E 42        LD      HL,$422E            ; point at the delayed-event armed flag
15C6: CB 46           BIT     0,(HL)              ; test whether the delayed event is armed
15C8: C8              RET     Z                   ; not armed -- leave
15C9: 23              INC     HL                  ; step to the delayed-event countdown timer
15CA: 35              DEC     (HL)                ; count the timer down one frame
15CB: C0              RET     NZ                  ; still counting -- leave
15CC: 2B              DEC     HL                  ; back to the armed flag
15CD: 36 00           LD      (HL),$00            ; disarm it -- this fires only once
15CF: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-subsystem active flag
15D2: 0F              RRCA                        ; shift its bit 0 into carry
15D3: D0              RET     NC                  ; subsystem off -- drop the event
15D4: 3A EF 41        LD      A,($41EF)           ; {hard.workRam+1EF} read the companion enable flag
15D7: 0F              RRCA                        ; shift its bit 0 into carry
15D8: D0              RET     NC                  ; companion gate closed -- drop the event
15D9: 3E 01           LD      A,$01               ; load 1
15DB: 32 29 42        LD      ($4229),A           ; {hard.workRam+229} raise the delayed-event request for the spawner
15DE: C9              RET                         ; done -- the request is posted

; Reload one expired counter cell from its ROM table and return the refill
; tally incremented
reloadExpiredCounterAndTally:
15DF: 1A              LD      A,(DE)              ; fetch the reload value from the ROM table
15E0: 77              LD      (HL),A              ; stamp it into the expired sub-counter cell
15E1: 0C              INC     C                   ; bump the refill tally
15E2: C9              RET                         ; return the incremented tally

; ---- $15E3-$15F3: data ----
15E3: 05 2F 43 77 71 6D 67 65 4F 49 43 3D 3B 35 2B 29
15F3: 25

; Seed slot/base from alt flag 0x421b (nonzero -> slot 2/base 157, else
; slot 1/base 132), scan up to four two-byte slots of ROW_OCCUPANCY
; (0x41e8) advancing while neither byte of a slot has bit0 set, and store
; the resulting (slot index, base) pair into 0x4213 for the object-AI row
; scans (advanceObjectFlightAndFire/advanceHomingObjectFlightAndFire).
selectAttackerRowScan:
15F4: 21 E8 41        LD      HL,$41E8            ; point at the row-occupancy summary table
15F7: 06 04           LD      B,$04               ; scan up to four row slots
15F9: 3A 1B 42        LD      A,($421B)           ; {hard.workRam+21B} read the stage/alternate selector
15FC: A7              AND     A                   ; test it
15FD: 20 16           JR      NZ,$1615            ; {code.loc_1615} nonzero -- take the alternate seed
15FF: 1E 01           LD      E,$01               ; slot index starts at 1
1601: 16 84           LD      D,$84               ; row base starts at 132

loc_1603:
1603: CB 46           BIT     0,(HL)              ; is the first byte of this row slot occupied?
1605: 20 09           JR      NZ,$1610            ; {code.loc_1610} occupied -- take this slot
1607: 23              INC     HL                  ; step to the slot's second byte
1608: CB 46           BIT     0,(HL)              ; is the second byte occupied?
160A: 20 04           JR      NZ,$1610            ; {code.loc_1610} occupied -- take this slot
160C: 23              INC     HL                  ; step to the next row slot
160D: 1C              INC     E                   ; advance the slot index
160E: 10 F3           DJNZ    $1603               ; {code.loc_1603} loop across the remaining row slots

loc_1610:
1610: ED 53 13 42     LD      ($4213),DE          ; {hard.workRam+213} store the found slot index and base for the flight-and-fire row scan
1614: C9              RET                         ; done

loc_1615:
1615: 1E 02           LD      E,$02               ; alternate: slot index 2
1617: 16 9D           LD      D,$9D               ; alternate: row base 157
1619: 18 E8           JR      $1603               ; {code.loc_1603} run the same row scan

; ---- $161B-$1620: data ----
161B: 1E 03 16 B6 18 E2

; Gated one-shot: when both status gates 0x4220 and 0x4225 have bit0 set
; and the pending word 0x4222 is not already armed, write mem16[0x4222]=1
; (enable byte=1, countdown 0x4223=0). advanceStageAndReseedFormation
; later consumes this delayed one-shot to advance the stage/formation
; selector 0x421b (clamped 0..7), reseed the formation anchor 0x420e=1 and
; reset the pace counter 0x421a=0.
armFormationAdvanceTrigger:
1621: 3A 20 42        LD      A,($4220)           ; {hard.workRam+220} read the all-rows-clear flag
1624: 0F              RRCA                        ; shift its bit 0 into carry
1625: D0              RET     NC                  ; block not clear -- leave
1626: 3A 25 42        LD      A,($4225)           ; {hard.workRam+225} read the object-field-clear flag
1629: 0F              RRCA                        ; shift its bit 0 into carry
162A: D0              RET     NC                  ; field not clear -- leave
162B: 3A 22 42        LD      A,($4222)           ; {hard.workRam+222} read the pending stage-advance enable
162E: 0F              RRCA                        ; shift its bit 0 into carry
162F: D8              RET     C                   ; already armed -- leave
1630: 21 01 00        LD      HL,$0001            ; value 1 in the low byte, zero countdown in the high byte
1633: 22 22 42        LD      ($4222),HL          ; {hard.workRam+222} arm the stage-advance one-shot
1636: C9              RET                         ; done -- the stage advance is queued

; On the armed stage-advance one-shot (enable 0x4222 bit0 + countdown
; 0x4223 hitting zero): disarm the enable, rebuild the 128-flag formation
; block from the packed template, reseed the formation anchor 0x420e, step
; the stage selector 0x421b (low byte saturating at 7, high byte
; counting), enqueue a command word, and service a pending two-slot
; request 0x421e -> 0x4177/0x4178.
advanceStageAndReseedFormation:
1637: 21 22 42        LD      HL,$4222            ; point at the stage-advance enable
163A: CB 46           BIT     0,(HL)              ; test whether a stage advance is armed
163C: C8              RET     Z                   ; not armed -- leave
163D: 23              INC     HL                  ; step to the stage-advance countdown
163E: 35              DEC     (HL)                ; count it down
163F: C0              RET     NZ                  ; still counting -- leave
1640: 2B              DEC     HL                  ; back to the enable
1641: 36 00           LD      (HL),$00            ; disarm the stage-advance one-shot
1643: 11 1B 05        LD      DE,$051B            ; point at the packed formation template in ROM
1646: CD 46 06        CALL    $0646               ; {code.unpackBitmaskToFlagBytes} unpack it into all 128 formation flags -- a fresh full block of aliens
1649: AF              XOR     A                   ; clear A to zero
164A: 32 1A 42        LD      ($421A),A           ; {hard.workRam+21A} reset the launch-pace counter
164D: 32 5F 42        LD      ($425F),A           ; {hard.workRam+25F} zero the free-running frame counter
1650: 21 01 00        LD      HL,$0001            ; value 1
1653: 22 0E 42        LD      ($420E),HL          ; {hard.workRam+20E} reseed the formation sway anchor
1656: 2A 1B 42        LD      HL,($421B)          ; {hard.workRam+21B} read the stage-selector word
1659: 24              INC     H                   ; bump its high byte -- the running level count
165A: 7D              LD      A,L                 ; take the low byte -- the stage index
165B: FE 07           CP      $07                 ; is it already at 7?
165D: 28 03           JR      Z,$1662             ; {code.loc_1662} at 7 -- hold there
165F: 30 22           JR      NC,$1683            ; {code.loc_1683} past 7 -- clamp it back
1661: 3C              INC     A                   ; otherwise step the stage up one

loc_1662:
1662: 6F              LD      L,A                 ; put the stage index back in the low byte
1663: 22 1B 42        LD      ($421B),HL          ; {hard.workRam+21B} store the stepped stage selector
1666: 11 00 07        LD      DE,$0700            ; stage command word
1669: CD F2 08        CALL    $08F2               ; {code.enqueueCommandWord} enqueue the stage-advance display command
166C: 3A 1E 42        LD      A,($421E)           ; {hard.workRam+21E} read the pending two-slot spawn request
166F: A7              AND     A                   ; test it
1670: C8              RET     Z                   ; none pending -- leave
1671: 21 77 41        LD      HL,$4177            ; point at the first spawn-slot flag
1674: 36 01           LD      (HL),$01            ; raise it
1676: 3D              DEC     A                   ; one request consumed
1677: 32 1E 42        LD      ($421E),A           ; {hard.workRam+21E} write back the remaining request count
167A: C8              RET     Z                   ; only one requested -- leave
167B: 23              INC     HL                  ; step to the second spawn-slot flag
167C: 36 01           LD      (HL),$01            ; raise it too
167E: AF              XOR     A                   ; clear A
167F: 32 1E 42        LD      ($421E),A           ; {hard.workRam+21E} clear the request count
1682: C9              RET                         ; done rebuilding the harder stage

loc_1683:
1683: 3E 07           LD      A,$07               ; clamp the stage index at 7
1685: C3 62 16        JP      $1662               ; {code.loc_1662} store the clamped stage and continue

; Gated countdown: while arm flag 0x422b bit0 is set AND an activity gate
; is open (0x4224!=0 || 0x4221!=0 || 0x4226 bit0), tick counter 0x422c and
; clear the arm flag 0x422b once it reaches zero -- ends an activity-gated
; timed phase.
expireActivityGatedTimer:
1688: 21 2B 42        LD      HL,$422B            ; point at the activity timer's arm flag
168B: CB 46           BIT     0,(HL)              ; test whether the timer is armed
168D: C8              RET     Z                   ; not armed -- leave
168E: 3A 24 42        LD      A,($4224)           ; {hard.workRam+224} read the near-empty activity gate
1691: A7              AND     A                   ; test it
1692: 20 0B           JR      NZ,$169F            ; {code.loc_169f} gate open -- tick the timer
1694: 3A 21 42        LD      A,($4221)           ; {hard.workRam+221} read the top-rows-clear gate
1697: A7              AND     A                   ; test it
1698: 20 05           JR      NZ,$169F            ; {code.loc_169f} gate open -- tick the timer
169A: 3A 26 42        LD      A,($4226)           ; {hard.workRam+226} read the object-slots-clear gate
169D: 0F              RRCA                        ; shift its bit 0 into carry
169E: D0              RET     NC                  ; all gates closed -- hold the timer where it is

loc_169f:
169F: 23              INC     HL                  ; step to the timer counter
16A0: 35              DEC     (HL)                ; count it down
16A1: C0              RET     NZ                  ; still running -- leave
16A2: 2B              DEC     HL                  ; back to the arm flag
16A3: 36 00           LD      (HL),$00            ; clear the arm flag -- the active-play phase has ended
16A5: C9              RET                         ; done

; On alternate frames, emit the sweep countdown (rotated right two) to the
; discrete-sound register and tick it down, fading to silence
driveDecayingSoundSweep:
16A6: 3A 07 40        LD      A,($4007)           ; {hard.workRam+7} read the demo/attract-mode flag
16A9: 0F              RRCA                        ; shift its bit 0 into carry
16AA: D8              RET     C                   ; in demo mode -- skip the sweep this frame
16AB: 21 DF 41        LD      HL,$41DF            ; point at the sound-sweep countdown level
16AE: 7E              LD      A,(HL)              ; read it
16AF: A7              AND     A                   ; test it
16B0: C8              RET     Z                   ; nothing left to sweep -- leave
16B1: 0F              RRCA                        ; rotate the level right one
16B2: 0F              RRCA                        ; rotate it right again -- scale it down
16B3: 32 04 68        LD      ($6804),A           ; emit the fading level to the discrete-sound register
16B6: 35              DEC     (HL)                ; tick the sweep down toward silence
16B7: C9              RET                         ; done

; On even frames (0x4007 bit0 clear) sum the 6x10 OCCUPANCY_GRID (0x4123,
; stride 16) into a tally seeded at 1, light min(tally,3) of the three
; sound-write latches SOUND_W_REG0..2 (0x6800-2) and zero the rest, then
; set the near-empty flag 0x4224 (=1 when tally<2, consumed by
; expireActivityGatedTimer).
driveSoundVoicesFromOccupancy:
16B8: 3A 07 40        LD      A,($4007)           ; {hard.workRam+7} read the demo/attract-mode flag
16BB: 0F              RRCA                        ; shift its bit 0 into carry
16BC: D8              RET     C                   ; in demo mode -- skip this frame
16BD: 21 23 41        LD      HL,$4123            ; point at the formation occupancy grid
16C0: 11 06 00        LD      DE,$0006            ; the 6-byte skip that steps to the next grid row
16C3: 4B              LD      C,E                 ; count six grid rows
16C4: 3E 01           LD      A,$01               ; seed the occupancy tally at 1

loc_16c6:
16C6: 06 0A           LD      B,$0A               ; ten columns in this row

loc_16c8:
16C8: 86              ADD     A,(HL)              ; add this cell's occupancy into the tally
16C9: 2C              INC     L                   ; step to the next column
16CA: 10 FC           DJNZ    $16C8               ; {code.loc_16c8} loop the whole row of ten
16CC: 19              ADD     HL,DE               ; skip forward to the start of the next row
16CD: 0D              DEC     C                   ; one row counted
16CE: C2 C6 16        JP      NZ,$16C6            ; {code.loc_16c6} loop the remaining rows
16D1: 21 00 68        LD      HL,$6800            ; point at the first formation-hum sound latch
16D4: 06 03           LD      B,$03               ; three hum latches to drive

loc_16d6:
16D6: 3D              DEC     A                   ; spend one from the tally
16D7: 28 14           JR      Z,$16ED             ; {code.loc_16ed} tally used up -- silence the rest
16D9: 36 01           LD      (HL),$01            ; light this hum latch
16DB: 2C              INC     L                   ; next latch
16DC: 10 F8           DJNZ    $16D6               ; {code.loc_16d6} light up to three latches by how full the block still is

loc_16de:
16DE: FE 02           CP      $02                 ; is the tally below 2?
16E0: 38 05           JR      C,$16E7             ; {code.loc_16e7} yes -- mark the block near-empty
16E2: AF              XOR     A                   ; clear A
16E3: 32 24 42        LD      ($4224),A           ; {hard.workRam+224} clear the near-empty flag
16E6: C9              RET                         ; done

loc_16e7:
16E7: 3E 01           LD      A,$01               ; load 1
16E9: 32 24 42        LD      ($4224),A           ; {hard.workRam+224} raise the near-empty flag
16EC: C9              RET                         ; done

loc_16ed:
16ED: 36 00           LD      (HL),$00            ; silence this hum latch
16EF: 2C              INC     L                   ; next latch
16F0: 10 FB           DJNZ    $16ED               ; {code.loc_16ed} zero the remaining latches
16F2: C3 DE 16        JP      $16DE               ; {code.loc_16de} go set the near-empty flag

; Sound-driver per-frame tick: clear the composite sound-flag byte
; (0x41c0) and prime SOUND_PITCH (0x41c1)=0xFF, run the seven
; channel/effect updaters in fixed ROM order, then latch the composed
; bytes -- composite -> SOUND_W_REG6 (0x6806), its rotate-right ->
; SOUND_W_REG7 (0x6807), pitch shadow -> SOUND_PITCH_W (0x7800)
driveSoundFrame:
16F5: AF              XOR     A                   ; clear A
16F6: 32 C0 41        LD      ($41C0),A           ; {hard.workRam+1C0} clear the composite sound-flag byte for this frame
16F9: 3D              DEC     A                   ; A becomes 0xff
16FA: 32 C1 41        LD      ($41C1),A           ; {hard.workRam+1C1} prime the sound-pitch shadow to 0xff
16FD: CD 47 17        CALL    $1747               ; {code.armSoundSequenceOnRequest} arm the sound sequence on any pending request
1700: CD D0 17        CALL    $17D0               ; {code.updateSoundSweepVoice} update the sound-sweep voice
1703: CD 19 18        CALL    $1819               ; {code.armSoundSequenceBySelector} arm a sound sequence by its selector
1706: CD 5D 17        CALL    $175D               ; {code.advanceAllSoundSequenceChannels} step all three sound-sequence channels
1709: CD 4F 18        CALL    $184F               ; {code.advancePulseToneEnvelope} tick the pulse-tone envelope
170C: CD 76 18        CALL    $1876               ; {code.driveRisingPitchRamp} drive the rising pitch ramp
170F: CD 23 17        CALL    $1723               ; {code.advanceGatedSquareTone} advance the gated square-wave tone
1712: 3A C0 41        LD      A,($41C0)           ; {hard.workRam+1C0} read back the composed sound-flag byte
1715: 32 06 68        LD      ($6806),A           ; latch it to the sound write register
1718: 0F              RRCA                        ; rotate it right one
1719: 32 07 68        LD      ($6807),A           ; latch the rotated copy to the next sound register
171C: 3A C1 41        LD      A,($41C1)           ; {hard.workRam+1C1} read the composed pitch shadow
171F: 32 00 78        LD      ($7800),A           ; latch the pitch to the sound hardware
1722: C9              RET                         ; done -- the frame's sound is out

; Per-frame tick of a gated square-wave tone channel: drives the tone
; toggler while gate counter 0x41cc is armed, and at the expiry step parks
; 0x41cc=0 and re-arms SOUND_TONE_DURATION (0x41ce) to 8.
advanceGatedSquareTone:
1723: 3A CC 41        LD      A,($41CC)           ; {hard.workRam+1CC} read the square-tone gate counter
1726: 3D              DEC     A                   ; step it down one
1727: C2 33 17        JP      NZ,$1733            ; {code.driveGatedSquareTone} not at expiry -- go toggle the tone
172A: 32 CC 41        LD      ($41CC),A           ; {hard.workRam+1CC} park the gate counter at 0
172D: 3E 08           LD      A,$08               ; load 8
172F: 32 CE 41        LD      ($41CE),A           ; {hard.workRam+1CE} re-arm the tone duration
1732: C9              RET                         ; done

; Per-frame tick of a gated square-wave tone: run the duration counter
; down driving the toggled bit to the sound register, silence when spent
driveGatedSquareTone:
1733: 3A CE 41        LD      A,($41CE)           ; {hard.workRam+1CE} read the sound effect's frame-countdown timer
1736: A7              AND     A                   ; test whether the tone still has frames left
1737: CA 43 17        JP      Z,$1743             ; {code.loc_1743} duration spent -- jump to silence the register
173A: 3D              DEC     A                   ; count the tone duration down one frame
173B: 32 CE 41        LD      ($41CE),A           ; {hard.workRam+1CE} store the ticked duration back
173E: 3A 07 40        LD      A,($4007)           ; {hard.workRam+7} read the demo/attract-mode flag -- its inverse is written to the sound register, gating the tone by mode
1741: EE 01           XOR     $01                 ; invert bit 0 of the mode flag before the sound write

loc_1743:
1743: 32 05 68        LD      ($6805),A           ; write the toggled bit to discrete-sound register 5
1746: C9              RET                         ; done with the square tone this frame

; Arm the gated sound sequence on an outstanding request: clear the
; request gate, raise the active flags, and publish the sequence-data
; pointer (SOUND_SEQ_PTR).
armSoundSequenceOnRequest:
1747: 3A D1 41        LD      A,($41D1)           ; {hard.workRam+1D1} read the sound-sequence request gate
174A: 3D              DEC     A                   ; decrement it -- test whether a request is pending
174B: C0              RET     NZ                  ; no outstanding request -- nothing to arm
174C: 32 D1 41        LD      ($41D1),A           ; {hard.workRam+1D1} clear the request gate
174F: 3C              INC     A                   ; form the value 1
1750: 32 D2 41        LD      ($41D2),A           ; {hard.workRam+1D2} raise the sound-sequence active flag
1753: 32 D6 41        LD      ($41D6),A           ; {hard.workRam+1D6} set the sequence step/duration counter to 1
1756: 21 68 1E        LD      HL,$1E68            ; point at the sound-sequence data
1759: 22 D3 41        LD      ($41D3),HL          ; {hard.workRam+1D3} publish the sequence pointer
175C: C9              RET                         ; sequence armed -- return

; Advances all three sound-sequence channels one step per frame by calling
; advanceSoundSequenceChannel on descriptors 0x41d2, 0x41cf, and
; SOUND_SEQ_ACTIVE (0x41cd) in turn.
advanceAllSoundSequenceChannels:
175D: 21 D2 41        LD      HL,$41D2            ; point at sound-sequence channel descriptor one
1760: CD 6C 17        CALL    $176C               ; {code.advanceSoundSequenceChannel} advance that channel one step
1763: 21 CF 41        LD      HL,$41CF            ; point at channel descriptor two
1766: CD 6C 17        CALL    $176C               ; {code.advanceSoundSequenceChannel} advance that channel one step
1769: 21 CD 41        LD      HL,$41CD            ; point at channel descriptor three (the active flag), fall through

; Advance one sound-sequence channel (descriptor at HL): if active, stage
; 0x41c0=2 and publish current tone 0x41d5 -> SOUND_PITCH (0x41c1), tick
; duration 0x41d6; on expiry read next SOUND_SEQ_PTR byte (0xE0
; deactivates the channel), else split it into a low-5-bit
; SOUND_TONE_TABLE index -> 0x41d5 and high-3-bit SOUND_DURATION_TABLE
; index -> 0x41d6, advancing the cursor.
advanceSoundSequenceChannel:
176C: 7E              LD      A,(HL)              ; read this channel's active flag
176D: A7              AND     A                   ; test whether the channel is sounding
176E: C8              RET     Z                   ; channel idle -- nothing to advance
176F: EB              EX      DE,HL               ; keep the channel-flag pointer aside in DE
1770: 3E 02           LD      A,$02               ; load the sounding marker 2
1772: 32 C0 41        LD      ($41C0),A           ; {hard.workRam+1C0} mark this voice sounding in the composite sound-flag byte
1775: 3A D5 41        LD      A,($41D5)           ; {hard.workRam+1D5} read the channel's current tone value
1778: 32 C1 41        LD      ($41C1),A           ; {hard.workRam+1C1} publish it as the staged sound pitch
177B: 3A D6 41        LD      A,($41D6)           ; {hard.workRam+1D6} read the tone's duration counter
177E: 3D              DEC     A                   ; tick the duration down one frame
177F: C2 A2 17        JP      NZ,$17A2            ; {code.loc_17a2} still sounding -- store the ticked duration and return
1782: 2A D3 41        LD      HL,($41D3)          ; {hard.workRam+1D3} duration spent: load the sequence pointer
1785: 7E              LD      A,(HL)              ; fetch the next sequence byte
1786: FE E0           CP      $E0                 ; is it the 0xe0 end marker?
1788: 28 1C           JR      Z,$17A6             ; {code.loc_17a6} end marker -- deactivate this channel
178A: 23              INC     HL                  ; step past the fetched byte
178B: 22 D3 41        LD      ($41D3),HL          ; {hard.workRam+1D3} save the advanced sequence pointer
178E: 47              LD      B,A                 ; keep the raw sequence byte in B
178F: E6 1F           AND     $1F                 ; take its low 5 bits as the tone-table index
1791: 21 A9 17        LD      HL,$17A9            ; point at the tone table
1794: E7              RST     $20                 ; fetch the indexed tone value
1795: 32 D5 41        LD      ($41D5),A           ; {hard.workRam+1D5} store it as the channel's new tone
1798: 78              LD      A,B                 ; bring the raw sequence byte back
1799: E6 E0           AND     $E0                 ; take its high 3 bits as the duration index
179B: 07              RLCA                        ; rotate the duration bits down
179C: 07              RLCA                        ; rotate again
179D: 07              RLCA                        ; third rotate aligns the high nibble into the low bits
179E: 21 C8 17        LD      HL,$17C8            ; point at the tone-duration table
17A1: E7              RST     $20                 ; fetch the indexed duration

loc_17a2:
17A2: 32 D6 41        LD      ($41D6),A           ; {hard.workRam+1D6} store the channel's new duration counter
17A5: C9              RET                         ; done advancing this channel

loc_17a6:
17A6: AF              XOR     A                   ; form zero
17A7: 12              LD      (DE),A              ; clear the channel's active flag via the saved pointer
17A8: C9              RET                         ; channel deactivated -- return

; ---- $17A9-$17CF: data ----
17A9: FF 00 40 55 5F 68 70 80 8E 9A A0 AA B4 B8 C0 C7
17B9: CD D0 D5 DA DC E0 1C 35 87 A5 C4 D3 CA E3 E6 01
17C9: 02 04 08 10 20 40 00

; Per-frame sound-sweep voice updater (2nd of the sound-driver tick
; driveSoundFrame's channel/effect updaters): gated on 0x4006 bit0; while
; its counter cell 0x41c2 != 1 delegate to the sound-counter manager
; advanceSoundSweepAndStagePitch (steps sweep cell 0x41c3 while sound
; counter 0x41c4 < 96 ceiling, stages SOUND_PITCH 0x41c1); on the tick
; where 0x41c2 == 1, reload the idle template -- 0x41c2=0, 0x41c3=2,
; 0x41c4=160 (counter parked past the 96 ceiling so the sweep stops
; bumping until it decays). Own writes are only that constant idle-
; template reload (grounds no cell); the sweep/pitch production is
; delegated to routines, so this stays.
updateSoundSweepVoice:
17D0: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the sound-driver enable flag
17D3: 0F              RRCA                        ; rotate its bit 0 into carry
17D4: D0              RET     NC                  ; sound driver off -- nothing to do
17D5: 21 C2 41        LD      HL,$41C2            ; point at the sweep-voice counter cell
17D8: 7E              LD      A,(HL)              ; read the sweep counter
17D9: 3D              DEC     A                   ; is it about to hit its idle mark?
17DA: C2 E5 17        JP      NZ,$17E5            ; {code.advanceSoundSweepAndStagePitch} not the idle tick -- go run the sweep
17DD: 77              LD      (HL),A              ; idle tick: park the counter at zero
17DE: 21 02 A0        LD      HL,$A002            ; load the idle sweep template
17E1: 22 C3 41        LD      ($41C3),HL          ; {hard.workRam+1C3} reload the idle sweep cells so the sweep stops bumping
17E4: C9              RET                         ; sweep parked -- return

; Sound-counter manager head: early-return while gate 0x4226 bit0 is set;
; else step the pointer forward one cell; if gate 0x425f bit0 is set hand
; straight to stageSoundPitchBySelector; otherwise bump the pointed sweep
; cell (0x41c3) while sound counter 0x41c4 < 96, then fall into
; tickSoundCounterAndStagePitch, ultimately staging SOUND_PITCH (0x41c1).
advanceSoundSweepAndStagePitch:
17E5: 3A 26 42        LD      A,($4226)           ; {hard.workRam+226} read the sweep activity gate
17E8: 0F              RRCA                        ; rotate its bit 0 into carry
17E9: D8              RET     C                   ; gate set -- hold the sweep this frame
17EA: 23              INC     HL                  ; step the sweep pointer forward one cell
17EB: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the free-running frame counter
17EE: 0F              RRCA                        ; test its low bit (frame parity)
17EF: 38 10           JR      C,$1801             ; {code.stageSoundPitchBySelector} odd frame -- skip the bump and stage the pitch
17F1: 3A C4 41        LD      A,($41C4)           ; {hard.workRam+1C4} read the sound counter
17F4: FE 60           CP      $60                 ; compare against the 96 ceiling
17F6: 30 01           JR      NC,$17F9            ; {code.tickSoundCounterAndStagePitch} at or over the ceiling -- don't bump the sweep
17F8: 34              INC     (HL)                ; bump the sweep cell one step

; Sound-counter tick tail (entered by fall-through from
; advanceSoundSweepAndStagePitch): when the count in A is nonzero,
; decrement sound-counter 0x41c4 and store it back, then tail-call
; stageSoundPitchBySelector to stage the pitch keyed on (HL)&3.
tickSoundCounterAndStagePitch:
17F9: A7              AND     A                   ; test the sound counter value
17FA: CA 01 18        JP      Z,$1801             ; {code.stageSoundPitchBySelector} counter spent -- straight to staging the pitch
17FD: 3D              DEC     A                   ; tick the sound counter down
17FE: 32 C4 41        LD      ($41C4),A           ; {hard.workRam+1C4} store the sound counter back

; Pitch-selector dispatcher, tail-called from the sound-counter managers
; advanceSoundSweepAndStagePitch/tickSoundCounterAndStagePitch: reads
; (HL)&0x03; a nonzero selector -> stagePitchFromSoundCounter(selector)
; (warble recomputed from sound counter 0x41c4), zero ->
; stageSoundPitch(96) (fixed pitch). Both delegates stage SOUND_PITCH
; (0x41c1).
stageSoundPitchBySelector:
1801: 7E              LD      A,(HL)              ; read the sweep cell the pointer names
1802: E6 03           AND     $03                 ; take its low-2-bit pitch selector
1804: C2 0C 18        JP      NZ,$180C            ; {code.stagePitchFromSoundCounter} nonzero selector -- compute a warble pitch
1807: 3E 60           LD      A,$60               ; selector zero: fixed pitch 96
1809: C3 15 18        JP      $1815               ; {code.stageSoundPitch} go stage the fixed pitch

; Recomputes a staged sound pitch from counter cell 0x41c4 — on an odd
; selector applies a +96 bias and rotate-right warble, else passes it
; through — then stages it via stageSoundPitch into SOUND_PITCH (0x41c1).
stagePitchFromSoundCounter:
180C: 0F              RRCA                        ; rotate the selector's low bit into carry
180D: 3A C4 41        LD      A,($41C4)           ; {hard.workRam+1C4} read the sound counter as the warble base
1810: 30 03           JR      NC,$1815            ; {code.stageSoundPitch} even selector -- stage the counter as is
1812: C6 60           ADD     A,$60               ; odd selector -- bias the warble by 96
1814: 1F              RRA                         ; halve it back down

; Stage a pitch byte into SOUND_PITCH, the shadow the per-frame sound
; driver latches to the pitch port.
stageSoundPitch:
1815: 32 C1 41        LD      ($41C1),A           ; {hard.workRam+1C1} publish the staged sound pitch
1818: C9              RET                         ; pitch staged -- return

; When the sound driver is enabled (0x4006 bit0), reads request selector
; 0x41df: any value != 6 is handed to armSoundSequenceForSelector16;
; selector 6 arms this sequence (unless SOUND_SEQ_ACTIVE 0x41cd already
; set) by raising 0x41cf/0x41d6 and publishing SOUND_SEQ_PTR
; (0x41d3)=0x1ebd.
armSoundSequenceBySelector:
1819: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the sound-driver enable flag
181C: 0F              RRCA                        ; rotate its bit 0 into carry
181D: D0              RET     NC                  ; sound driver off -- nothing to arm
181E: 3A DF 41        LD      A,($41DF)           ; {hard.workRam+1DF} read the sound-request selector
1821: FE 06           CP      $06                 ; is the selector 6?
1823: C2 3A 18        JP      NZ,$183A            ; {code.armSoundSequenceForSelector16} not selector 6 -- hand off to the 0x16 arm
1826: 3A CD 41        LD      A,($41CD)           ; {hard.workRam+1CD} selector 6: read the sound-sequence active flag
1829: 0F              RRCA                        ; test its bit 0
182A: D8              RET     C                   ; a sequence already active -- don't re-arm
182B: 3E 01           LD      A,$01               ; form 1
182D: 32 CF 41        LD      ($41CF),A           ; {hard.workRam+1CF} raise the sequence active flag
1830: 32 D6 41        LD      ($41D6),A           ; {hard.workRam+1D6} set the step/duration counter to 1
1833: 21 BD 1E        LD      HL,$1EBD            ; point at sequence data 0x1ebd
1836: 22 D3 41        LD      ($41D3),HL          ; {hard.workRam+1D3} publish the sound-sequence pointer
1839: C9              RET                         ; sequence armed -- return

; Dispatch arm for sound-request selector 0x16: clear its sub-flag, raise
; SOUND_SEQ_ACTIVE and companion, and publish sequence pointer 0x1edf.
armSoundSequenceForSelector16:
183A: FE 16           CP      $16                 ; is the selector 0x16?
183C: C0              RET     NZ                  ; some other selector -- ignore it
183D: AF              XOR     A                   ; form zero
183E: 32 CF 41        LD      ($41CF),A           ; {hard.workRam+1CF} clear the companion sequence flag
1841: 3C              INC     A                   ; form 1
1842: 32 CD 41        LD      ($41CD),A           ; {hard.workRam+1CD} raise the sound-sequence active flag
1845: 32 D6 41        LD      ($41D6),A           ; {hard.workRam+1D6} set the step/duration counter to 1
1848: 21 DF 1E        LD      HL,$1EDF            ; point at sequence data 0x1edf
184B: 22 D3 41        LD      ($41D3),HL          ; {hard.workRam+1D3} publish the sound-sequence pointer
184E: C9              RET                         ; sequence armed -- return

; sound-envelope word tick (called per-frame by the sound driver
; driveSoundFrame, 0x170c slot): if the 0x41c7/0x41c8 word's low-byte bit0
; is set, re-arm the word to its 0x8000 sentinel (0x41c7=0, 0x41c8=128);
; else hand the high byte to pulseSoundToneFromCountdown (0x185e) to stage
; the pulsed tone.
advancePulseToneEnvelope:
184F: 2A C7 41        LD      HL,($41C7)          ; {hard.workRam+1C7} load the pulse-tone envelope word
1852: CB 45           BIT     0,L                 ; test bit 0 of its low byte (the sentinel marker)
1854: CA 5E 18        JP      Z,$185E             ; {code.pulseSoundToneFromCountdown} not at the sentinel -- pulse the tone from the high byte
1857: 21 00 80        LD      HL,$8000            ; form the 0x8000 sentinel
185A: 22 C7 41        LD      ($41C7),HL          ; {hard.workRam+1C7} re-arm the envelope word to its sentinel
185D: C9              RET                         ; envelope re-armed -- return

; High-byte handler of a decrementing sound-envelope word (0x41c7, high
; byte 0x41c8): idle when the high byte is zero, else stores it
; decremented and stages a bit2-gated two-level pulse (129/0) via
; stagePitchAndRaiseSoundFlag.
pulseSoundToneFromCountdown:
185E: 7C              LD      A,H                 ; take the envelope word's high byte
185F: A7              AND     A                   ; test it
1860: C8              RET     Z                   ; high byte spent -- silent, return
1861: 3D              DEC     A                   ; tick the countdown high byte down
1862: 32 C8 41        LD      ($41C8),A           ; {hard.workRam+1C8} store it back
1865: E6 04           AND     $04                 ; test its bit 2 (the pulse phase)
1867: CA 6C 18        JP      Z,$186C             ; {code.stagePitchAndRaiseSoundFlag} phase bit clear -- take the low pulse level
186A: 3E 81           LD      A,$81               ; phase bit set -- take the high pulse level 129

; Stage pitch (A-1) into SOUND_PITCH and raise the 0x41c0 composite sound
; flag the driver latches to the sound registers.
stagePitchAndRaiseSoundFlag:
186C: 3D              DEC     A                   ; form the two-level pulse value
186D: 32 C1 41        LD      ($41C1),A           ; {hard.workRam+1C1} stage it as the sound pitch
1870: 3E 01           LD      A,$01               ; form 1
1872: 32 C0 41        LD      ($41C0),A           ; {hard.workRam+1C0} raise the composite sound-flag byte
1875: C9              RET                         ; pulse staged -- return

; Pitch-ramp arm tick: while arm counter 0x41c9 stays nonzero it advances
; the rising pitch ramp one step via advanceSoundPitchRamp; at its reset
; point it clears 0x41c9 and reloads the {countdown,pitch} pair 0x41ca=32.
driveRisingPitchRamp:
1876: 21 C9 41        LD      HL,$41C9            ; point at the pitch-ramp arm counter
1879: 7E              LD      A,(HL)              ; read the arm counter
187A: 3D              DEC     A                   ; is the arm about to reach its reset point?
187B: C2 86 18        JP      NZ,$1886            ; {code.advanceSoundPitchRamp} arm still running -- advance the ramp
187E: 77              LD      (HL),A              ; clear the arm counter
187F: 21 20 00        LD      HL,$0020            ; form 32 (countdown 32, pitch 0)
1882: 22 CA 41        LD      ($41CA),HL          ; {hard.workRam+1CA} reload the ramp's countdown/pitch pair
1885: C9              RET                         ; ramp re-armed -- return

; Advance a rising sound-pitch ramp one step over a {countdown,pitch}
; pair: tick the countdown, add a fixed step to the pitch, publish it to
; SOUND_PITCH, and clear the 0x41c0 composite flag; idle when the
; countdown is drained.
advanceSoundPitchRamp:
1886: 23              INC     HL                  ; step to the ramp's countdown byte
1887: 7E              LD      A,(HL)              ; read the ramp countdown
1888: A7              AND     A                   ; test it
1889: C8              RET     Z                   ; ramp drained -- idle, return
188A: 35              DEC     (HL)                ; tick the ramp countdown down
188B: 23              INC     HL                  ; step to the ramp's pitch byte
188C: 7E              LD      A,(HL)              ; read the current ramp pitch
188D: C6 04           ADD     A,$04               ; step the pitch up by 4 -- the rising ramp
188F: 77              LD      (HL),A              ; store the raised pitch back
1890: 32 C1 41        LD      ($41C1),A           ; {hard.workRam+1C1} publish it as the staged sound pitch
1893: AF              XOR     A                   ; form zero
1894: 32 C0 41        LD      ($41C0),A           ; {hard.workRam+1C0} clear the composite sound-flag byte
1897: C9              RET                         ; pitch ramped -- return

; Per-frame LFO-level driver called from $0066 (VBLANK-NMI): with no reset
; request (SOUND_LFO_RESET_REQUEST 0x41d0 == 0) run decaySoundLfoLevel;
; otherwise consume the request (clear 0x41d0) and slam full level (15)
; across the LFO frequency latches via broadcastSoundLfoLevel.
driveSoundLfoLevel:
1898: 3A D0 41        LD      A,($41D0)           ; {hard.workRam+1D0} read the LFO reset-request flag
189B: A7              AND     A                   ; test it
189C: 28 08           JR      Z,$18A6             ; {code.decaySoundLfoLevel} no reset request -- run the normal LFO decay
189E: AF              XOR     A                   ; form zero
189F: 32 D0 41        LD      ($41D0),A           ; {hard.workRam+1D0} consume the reset request
18A2: 3E 0F           LD      A,$0F               ; form the full LFO level 15
18A4: 18 0C           JR      $18B2               ; {code.broadcastSoundLfoLevel} go slam that level across the LFO latches

; Per-frame LFO decay guard: only on the 0x425f==0xff tick with
; SOUND_LFO_LEVEL (0x421f) nonzero, decrement the level and fan it across
; the LFO frequency latches via broadcastSoundLfoLevel (0x18b2).
decaySoundLfoLevel:
18A6: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the frame counter
18A9: C6 01           ADD     A,$01               ; add one to it
18AB: D0              RET     NC                  ; only act on the 0xff tick -- otherwise return
18AC: 3A 1F 42        LD      A,($421F)           ; {hard.workRam+21F} read the current LFO level
18AF: A7              AND     A                   ; test it
18B0: C8              RET     Z                   ; level already at zero -- nothing to decay
18B1: 3D              DEC     A                   ; decay the LFO level one step

; Save a sound LFO level to SOUND_LFO_LEVEL, then fan it (rotated right
; one bit per write) across the four SOUND_LFO_FREQ hardware latches.
broadcastSoundLfoLevel:
18B2: 32 1F 42        LD      ($421F),A           ; {hard.workRam+21F} store the LFO level shadow
18B5: 06 04           LD      B,$04               ; four LFO frequency latches to write
18B7: 21 04 60        LD      HL,$6004            ; point at the LFO frequency latch base

loc_18ba:
18BA: 77              LD      (HL),A              ; write the level to this LFO frequency latch
18BB: 23              INC     HL                  ; step to the next latch
18BC: 0F              RRCA                        ; rotate the level right one bit for the next latch
18BD: 10 FB           DJNZ    $18BA               ; {code.loc_18ba} loop over all four latches
18BF: C9              RET                         ; LFO level fanned out -- return

; Message-scroller per-frame step: while MESSAGE_SCROLL_ENABLE (0x40b0)
; bit0 set, emit one glyph up its VRAM column -- advancing
; MESSAGE_TEXT_PTR (0x40b3) +1 and MESSAGE_DEST_PTR (0x40b5) up one row
; (-32) -- then tick the delay counter (which stops the scroller on its
; zero-crossing).
advanceMessageScroller:
18C0: 3A B0 40        LD      A,($40B0)           ; {hard.workRam+B0} read the message-scroller enable/countdown flag
18C3: 0F              RRCA                        ; test its bit 0 (scroller running?)
18C4: D0              RET     NC                  ; scroller off -- nothing to advance
18C5: 2A B1 40        LD      HL,($40B1)          ; {hard.workRam+B1} load the message cursor pointer
18C8: 7E              LD      A,(HL)              ; read the cursor's step byte
18C9: E6 07           AND     $07                 ; take its low 3 bits (the per-glyph sub-step)
18CB: 20 1B           JR      NZ,$18E8            ; {code.endMessageScrollOnExpiry} mid-glyph -- just tick the delay counter
18CD: EB              EX      DE,HL               ; keep the cursor pointer aside in DE
18CE: 2A B3 40        LD      HL,($40B3)          ; {hard.workRam+B3} load the message text pointer
18D1: 7E              LD      A,(HL)              ; read the next glyph byte from the text
18D2: FE 3F           CP      $3F                 ; is it the 0x3f end-of-message marker?
18D4: 28 11           JR      Z,$18E7             ; {code.endMessageScrollOnExpiryFromDe} end of text -- go to the delay/end path
18D6: 23              INC     HL                  ; step the text pointer forward
18D7: 22 B3 40        LD      ($40B3),HL          ; {hard.workRam+B3} save the advanced text pointer
18DA: D6 30           SUB     $30                 ; bias the glyph code to its tile value
18DC: 2A B5 40        LD      HL,($40B5)          ; {hard.workRam+B5} load the message destination pointer
18DF: 77              LD      (HL),A              ; write the glyph tile into VRAM
18E0: 01 E0 FF        LD      BC,$FFE0            ; form -32 (one tilemap row up)
18E3: 09              ADD     HL,BC               ; move the destination up one row
18E4: 22 B5 40        LD      ($40B5),HL          ; {hard.workRam+B5} save the advanced destination pointer

; DE-entry adapter to endMessageScrollOnExpiry (0x18e8): restore the
; countdown pointer from DE (ex de,hl) then tick it and clear
; MESSAGE_SCROLL_ENABLE (0x40b0) on the zero-crossing to end the message
; scroll.
endMessageScrollOnExpiryFromDe:
18E7: EB              EX      DE,HL               ; restore the countdown pointer from DE

; Tick a countdown at (HL) and, on the zero-crossing, clear
; MESSAGE_SCROLL_ENABLE (0x40b0) to stop the scroller.
endMessageScrollOnExpiry:
18E8: 35              DEC     (HL)                ; tick the scroller's delay countdown
18E9: C0              RET     NZ                  ; still running -- return
18EA: AF              XOR     A                   ; form zero
18EB: 32 B0 40        LD      ($40B0),A           ; {hard.workRam+B0} clear the scroll-enable flag to stop the scroller
18EE: C9              RET                         ; scroller done -- return

; Per-frame coin/input service front-end (first in $0066's service
; cluster): in config mode 3 (0x4000==3) delegate to presetCreditCount;
; else combine input shadows (IN0_SHADOW 0x4010 | 0x4013), complement, and
; mask by guard cells 0x4015 & 0x4016 -- bit7 set -> addCreditForCoin;
; else the low two bits each tick coin-pulse counter 0x4004 (up to twice).
serviceCoinInputs:
18EF: 3A 00 40        LD      A,($4000)           ; {hard.workRam} read the coinage/config mode
18F2: FE 03           CP      $03                 ; is it config mode 3 (the preset mode)?
18F4: 28 21           JR      Z,$1917             ; {code.presetCreditCount} mode 3 -- hand off to preset the credit count
18F6: 21 10 40        LD      HL,$4010            ; point at the IN0 input shadow
18F9: 7E              LD      A,(HL)              ; read this frame's IN0 shadow
18FA: 2C              INC     L                   ; step toward the prior-frame history cell
18FB: 2C              INC     L                   ; keep stepping
18FC: 2C              INC     L                   ; now at last frame's IN0 history
18FD: B6              OR      (HL)                ; combine this frame's coin bits with last frame's
18FE: 2C              INC     L                   ; step toward the first coin guard cell
18FF: 2C              INC     L                   ; now at the first coin guard cell
1900: 2F              CPL                         ; complement the coin bits (active-low to active-high)
1901: A6              AND     (HL)                ; mask by the first coin guard cell
1902: 2C              INC     L                   ; step to the second coin guard cell
1903: A6              AND     (HL)                ; mask by the second coin guard cell
1904: CB 7F           BIT     7,A                 ; test the direct-credit coin bit (bit 7)
1906: 20 16           JR      NZ,$191E            ; {code.addCreditForCoin} coin present -- add a credit
1908: E6 03           AND     $03                 ; otherwise take the low two coin-pulse bits
190A: C8              RET     Z                   ; no coin pulse -- nothing to count
190B: 21 04 40        LD      HL,$4004            ; point at the coarse coin-pulse counter
190E: 34              INC     (HL)                ; count one coin pulse
190F: CB 47           BIT     0,A                 ; was the first pulse bit set?
1911: C8              RET     Z                   ; no -- done after one bump
1912: E6 02           AND     $02                 ; test the second pulse bit
1914: C8              RET     Z                   ; not set -- done
1915: 34              INC     (HL)                ; count a second coin pulse
1916: C9              RET                         ; coin service done -- return

; mode-3 branch of coin service serviceCoinInputs: preset the credit count
; to 9 and clear the coin-phase flag
presetCreditCount:
1917: 21 00 09        LD      HL,$0900            ; build the word: low byte 0 for the coin-phase flag, high byte 9 for the credit count
191A: 22 01 40        LD      ($4001),HL          ; {hard.workRam+1} stamp the mode-3 preset -- coin-phase flag 0 and nine credits in one store
191D: C9              RET                         ; done presetting credits

; Coin-service credit bump (serviceCoinInputs bit7 branch): if credit
; count 0x4002 < 99 increment it, raise event flag 0x41c9=1, and tail-
; enqueue a channel-7 command that redraws the credit-count HUD (dispatch
; 0x24b7 arg 1 renders 0x4002 capped at 99 as two BCD digits); at the 99
; cap do nothing.
addCreditForCoin:
191E: 21 02 40        LD      HL,$4002            ; point at the credit count
1921: 7E              LD      A,(HL)              ; read the current credit count
1922: FE 63           CP      $63                 ; compare it against the 99-credit ceiling
1924: D0              RET     NC                  ; already at 99 -- drop this coin
1925: 34              INC     (HL)                ; bank one more credit
1926: 3E 01           LD      A,$01               ; load 1
1928: 32 C9 41        LD      ($41C9),A           ; {hard.workRam+1C9} raise the credit-event flag that arms the credit chime
192B: 11 01 07        LD      DE,$0701            ; command word: channel 7, parameter 1 -- redraw the credit-count display
192E: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue the credit-count HUD redraw and return

; Per-frame coin/credit service tick: while reload cell 0x4003 counts down
; pulse the coin-counter, and on expiry decrement coarse coin counter
; 0x4004, refill 0x4003=15, then award credit(s) to credit count 0x4002
; per coinage mode 0x4000.
tickCoinMeterAndAwardCredits:
1931: 21 03 40        LD      HL,$4003            ; point at the coin-meter pulse-width timer
1934: 7E              LD      A,(HL)              ; read it
1935: A7              AND     A                   ; test whether a coin-meter pulse is already in progress
1936: 20 3C           JR      NZ,$1974            ; {code.pulseCoinCounter} mid-pulse -- go drive the coin-counter output
1938: 2C              INC     L                   ; step to the coarse queued-coin counter
1939: B6              OR      (HL)                ; is there a coin pulse waiting to be serviced?
193A: C8              RET     Z                   ; nothing queued -- leave the meter alone
193B: 35              DEC     (HL)                ; consume one queued coin
193C: 2D              DEC     L                   ; back to the pulse-width timer cell
193D: 36 0F           LD      (HL),$0F            ; reload the coin-meter pulse timer to 15
193F: 3A 00 40        LD      A,($4000)           ; {hard.workRam} read the coinage mode setting
1942: FE 03           CP      $03                 ; free-play mode 3?
1944: C8              RET     Z                   ; free play -- award no credit
1945: 3D              DEC     A                   ; step the mode value toward the two-coins path test
1946: 28 1C           JR      Z,$1964             ; {code.awardCreditEverySecondCoin} mode 1 -- take the two-coins-per-credit path
1948: 21 02 40        LD      HL,$4002            ; point at the credit count
194B: 3D              DEC     A                   ; step toward the one-coin-per-credit test
194C: CC 4F 19        CALL    Z,$194F             ; {code.incrementCreditCount} mode 2 -- award one credit (also falls straight through)

; Step the credit count at (HL) (both callers
; tickCoinMeterAndAwardCredits/awardCreditEverySecondCoin pass 0x4002)
; toward the 99 ceiling: ==99 return; >99 clampCreditsToMax (pin to 99);
; else increment, set ready flag 0x41c9=1 (arms driveRisingPitchRamp), and
; enqueue command word (7,1). 0x4002 as credit count is corroborated by
; clampCreditsToMax/driveStartButtonLamps/advanceGameStateOnCredit.
incrementCreditCount:
194F: 7E              LD      A,(HL)              ; read the credit count
1950: FE 63           CP      $63                 ; at the 99 ceiling?
1952: C8              RET     Z                   ; yes -- leave it untouched
1953: 30 0C           JR      NC,$1961            ; {code.clampCreditsToMax} over the ceiling -- go clamp it
1955: 34              INC     (HL)                ; award one credit
1956: 3E 01           LD      A,$01               ; load 1
1958: 32 C9 41        LD      ($41C9),A           ; {hard.workRam+1C9} raise the credit-event flag that arms the chime
195B: 11 01 07        LD      DE,$0701            ; command word: channel 7, parameter 1 -- redraw the credit count
195E: C3 F2 08        JP      $08F2               ; {code.enqueueCommandWord} enqueue the credit-count HUD redraw and return

; overshoot arm of the credit clamp: pin the credit counter back to its 99
; ceiling
clampCreditsToMax:
1961: 36 63           LD      (HL),$63            ; pin the credit count back to its 99 ceiling
1963: C9              RET                         ; done clamping

; Two-coins-per-credit path (mode-1 arm of coin dispatcher
; tickCoinMeterAndAwardCredits): if coin-phase flag 0x4001 bit0 is clear
; (first coin of a pair) delegate to setCoinPhaseFlag to raise it; if
; already set (second coin) clear 0x4001 and delegate to
; incrementCreditCount(0x4002) to award one credit.
awardCreditEverySecondCoin:
1964: 21 01 40        LD      HL,$4001            ; point at the coin-phase flag
1967: CB 46           BIT     0,(HL)              ; first or second coin of the pair?
1969: 28 06           JR      Z,$1971             ; {code.setCoinPhaseFlag} first coin -- just raise the phase flag
196B: 36 00           LD      (HL),$00            ; second coin -- clear the phase flag
196D: 2C              INC     L                   ; step to the credit count
196E: C3 4F 19        JP      $194F               ; {code.incrementCreditCount} award the credit for the completed coin pair

; set arm of the coin-phase toggle: raise the coins-per-credit flag when
; the first coin of a pair is received
setCoinPhaseFlag:
1971: 36 01           LD      (HL),$01            ; mark the first coin of a pair received
1973: C9              RET                         ; done arming the phase

; drive the coin-counter output pulse and tick down its pulse-width timer
pulseCoinCounter:
1974: 0F              RRCA                        ; rotate the pulse timer toward the coin-counter output bit
1975: 0F              RRCA                        ; rotate again
1976: 0F              RRCA                        ; rotate again -- into the output bit position
1977: 32 03 60        LD      ($6003),A           ; drive the coin-counter hardware output pulse
197A: 35              DEC     (HL)                ; tick the pulse-width timer down
197B: C9              RET                         ; done pulsing the counter

; Drive the coin-lockout latch from the credit count 0x4002: at >=9
; release via clearCoinLockout (0x1989 -> COIN_LOCKOUT 0x6002=0); below 9
; engage it (COIN_LOCKOUT=1).
updateCoinLockoutFromCredits:
197C: 3A 02 40        LD      A,($4002)           ; {hard.workRam+2} read the credit count
197F: FE 09           CP      $09                 ; nine or more credits banked?
1981: 30 06           JR      NC,$1989            ; {code.clearCoinLockout} yes -- release the coin mechanism
1983: 3E 01           LD      A,$01               ; load 1
1985: 32 02 60        LD      ($6002),A           ; engage the coin lockout below nine credits
1988: C9              RET                         ; done

; release the coin mechanism by clearing the coin-lockout latch
clearCoinLockout:
1989: AF              XOR     A                   ; clear A
198A: 32 02 60        LD      ($6002),A           ; release the coin-lockout latch
198D: C9              RET                         ; done

; Once per 32-frame phase (0x425f) and while $4007 bit0 and
; OBJ_ACTIVE_FLAG (0x4200) bit0 are set: fold both object tables' position
; weights (accumulateObjectPositionWeight 0x1a12), add a scaled
; anchor(0x420e)-vs-reference(0x4202) offset and a random +/-1 nudge, and
; bucket the result into OBJ_MOVE_CMD (0x423f) = 0/4/8.
computeControlledObjectMoveCommand:
198E: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the free-running frame counter
1991: C6 09           ADD     A,$09               ; offset it by nine
1993: E6 1F           AND     $1F                 ; is this the one-in-32 autopilot frame?
1995: C0              RET     NZ                  ; not this frame -- skip the demo autopilot
1996: 3A 07 40        LD      A,($4007)           ; {hard.workRam+7} read the demo-enable flag
1999: 0F              RRCA                        ; shift its low bit into carry
199A: D0              RET     NC                  ; demo not enabled -- skip
199B: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-active master switch
199E: 0F              RRCA                        ; shift its low bit into carry
199F: D0              RET     NC                  ; objects inactive -- skip
19A0: DD 21 D0 42     LD      IX,$42D0            ; point IX at the attacker object table
19A4: 06 00           LD      B,$00               ; clear the threat-weight accumulator
19A6: D9              EXX                         ; swap to the alternate register set to hold the accumulator
19A7: 11 20 00        LD      DE,$0020            ; stride is 32 bytes per attacker record
19AA: 06 07           LD      B,$07               ; seven attacker records to fold in

loc_19ac:
19AC: D9              EXX                         ; bring the accumulator back
19AD: DD 66 03        LD      H,(IX+$03)          ; read the object's X
19B0: DD 6E 04        LD      L,(IX+$04)          ; read the object's Y
19B3: DD 4E 1A        LD      C,(IX+$1A)          ; read the object's flight-curve field byte
19B6: CD 12 1A        CALL    $1A12               ; {code.accumulateObjectPositionWeight} fold this attacker's threat weight into the accumulator
19B9: D9              EXX                         ; stash the accumulator again
19BA: DD 19           ADD     IX,DE               ; advance to the next attacker record
19BC: 10 EE           DJNZ    $19AC               ; {code.loc_19ac} loop over all seven attackers
19BE: DD 21 60 42     LD      IX,$4260            ; point IX at the moving-shot table
19C2: 11 05 00        LD      DE,$0005            ; stride is 5 bytes per shot record
19C5: 06 07           LD      B,$07               ; seven shot records to fold in

loc_19c7:
19C7: D9              EXX                         ; bring the accumulator back
19C8: DD 66 01        LD      H,(IX+$01)          ; read the shot's X
19CB: DD 6E 03        LD      L,(IX+$03)          ; read the shot's Y
19CE: DD 4E 04        LD      C,(IX+$04)          ; read the shot's field byte
19D1: CD 12 1A        CALL    $1A12               ; {code.accumulateObjectPositionWeight} fold this shot's threat weight into the accumulator
19D4: D9              EXX                         ; stash the accumulator
19D5: DD 19           ADD     IX,DE               ; advance to the next shot record
19D7: 10 EE           DJNZ    $19C7               ; {code.loc_19c7} loop over all seven shots
19D9: D9              EXX                         ; bring the finished accumulator into the main register set
19DA: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the ship's X, the target reference
19DD: 4F              LD      C,A                 ; hold it
19DE: 3A 0E 42        LD      A,($420E)           ; {hard.workRam+20E} read the formation anchor low byte
19E1: C6 80           ADD     A,$80               ; bias it by 128
19E3: 91              SUB     C                   ; form the offset between the formation and the ship
19E4: CB 2F           SRA     A                   ; scale the offset down, sign-preserving
19E6: CB 2F           SRA     A                   ; scale down again
19E8: CB 2F           SRA     A                   ; scale down again
19EA: CB 2F           SRA     A                   ; scale down again
19EC: CB 2F           SRA     A                   ; scale down again
19EE: 80              ADD     A,B                 ; add in the accumulated object threat weight
19EF: CB 2F           SRA     A                   ; halve the combined steer bias
19F1: 4F              LD      C,A                 ; hold the biased steer value
19F2: CD 3C 00        CALL    $003C               ; {code.advanceRandomSeed} draw a random number
19F5: 41              LD      B,C                 ; restore the biased steer value into B
19F6: 87              ADD     A,A                 ; shift the draw's top bit into carry
19F7: 9F              SBC     A,A                 ; turn that bit into all-zeros or all-ones
19F8: 20 01           JR      NZ,$19FB            ; {code.loc_19fb} top bit set (a=0xff) -- apply the -1 jitter
19FA: 3C              INC     A                   ; otherwise make the jitter +1

loc_19fb:
19FB: 80              ADD     A,B                 ; apply the plus-or-minus-one jitter to the steer bias
19FC: C6 01           ADD     A,$01               ; nudge up by one
19FE: FA 0E 1A        JP      M,$1A0E             ; {code.loc_1a0e} negative bias -- command a move one way
1A01: FE 02           CP      $02                 ; is the value two or more?
1A03: 30 05           JR      NC,$1A0A            ; {code.loc_1a0a} two or more -- command a move the other way
1A05: AF              XOR     A                   ; otherwise hold -- command zero

loc_1a06:
1A06: 32 3F 42        LD      ($423F),A           ; {hard.workRam+23F} write the demo move command
1A09: C9              RET                         ; done

loc_1a0a:
1A0A: 3E 04           LD      A,$04               ; move command 4
1A0C: 18 F8           JR      $1A06               ; {code.loc_1a06} go store it

loc_1a0e:
1A0E: 3E 08           LD      A,$08               ; move command 8
1A10: 18 F4           JR      $1A06               ; {code.loc_1a06} go store it

; Per-object contribution to accumulator B (register-compute, no memory
; write): skip unless object (IX) is active (byte0 bit0), Y in one of two
; 52-row bands from 128, and X delta from reference 0x4202 in the lower
; half; else fold flag bit7 + delta bits5-6 + band into a 0-15 index and
; add signed OBJ_STEP_TABLE[idx] (0x1a45) to B.
accumulateObjectPositionWeight:
1A12: DD CB 00 46     BIT     0,(IX+$00)          ; is this object active?
1A16: C8              RET     Z                   ; inactive -- contribute nothing to the weight
1A17: 7C              LD      A,H                 ; take the object's vertical position
1A18: D6 80           SUB     $80                 ; measure it down from row 128
1A1A: D8              RET     C                   ; above that line -- too high to count, skip
1A1B: 1E 00           LD      E,$00               ; band index starts at 0
1A1D: D6 34           SUB     $34                 ; into the first 52-row band?
1A1F: 38 04           JR      C,$1A25             ; {code.loc_1a25} yes -- keep band 0
1A21: 1C              INC     E                   ; second band
1A22: D6 34           SUB     $34                 ; into the second 52-row band?
1A24: D0              RET     NC                  ; below both bands -- too low, skip

loc_1a25:
1A25: 3A 02 42        LD      A,($4202)           ; {hard.workRam+202} read the ship's X reference
1A28: 95              SUB     L                   ; horizontal distance from the ship
1A29: D6 40           SUB     $40                 ; center the delta
1A2B: FE 80           CP      $80                 ; compare against the sideways window
1A2D: D0              RET     NC                  ; too far to the side -- skip this object
1A2E: E6 60           AND     $60                 ; keep the two coarse delta bits
1A30: 6F              LD      L,A                 ; hold them
1A31: 79              LD      A,C                 ; take the object's field byte
1A32: E6 80           AND     $80                 ; keep its flag bit 7
1A34: B5              OR      L                   ; combine it with the delta bits
1A35: 0F              RRCA                        ; rotate toward the low nibble
1A36: 0F              RRCA                        ; rotate again
1A37: 0F              RRCA                        ; rotate again
1A38: 0F              RRCA                        ; rotate again -- flag and delta packed low
1A39: B3              OR      E                   ; fold in the row band
1A3A: 5F              LD      E,A                 ; that is the 0-15 table index
1A3B: 16 00           LD      D,$00               ; clear the index high byte
1A3D: 21 45 1A        LD      HL,$1A45            ; point at the object-step weight table
1A40: 19              ADD     HL,DE               ; index into it
1A41: 7E              LD      A,(HL)              ; read the signed step weight
1A42: 80              ADD     A,B                 ; add it to the running threat accumulator
1A43: 47              LD      B,A                 ; keep the updated accumulator
1A44: C9              RET                         ; done scoring this object

; ---- $1A45-$1A54: data ----
1A45: 02 03 FE 02 FF FE 00 FF 00 01 01 02 02 FE FE 03

loc_1a55:
1A55: 21 00 50        LD      HL,$5000            ; point at tile VRAM base for the cold-boot wipe
1A58: 06 04           LD      B,$04               ; four 256-byte pages of tile VRAM to blank

loc_1a5a:
1A5A: 3E 10           LD      A,$10               ; the blank tile value, 16

loc_1a5c:
1A5C: 77              LD      (HL),A              ; write the blank tile into this cell
1A5D: 2C              INC     L                   ; step to the next cell in the page
1A5E: C2 5C 1A        JP      NZ,$1A5C            ; {code.loc_1a5c} fill the whole 256-byte page
1A61: 24              INC     H                   ; advance to the next VRAM page
1A62: 3A 00 78        LD      A,($7800)           ; pet the watchdog mid-wipe
1A65: 10 F3           DJNZ    $1A5A               ; {code.loc_1a5a} blank all four VRAM pages
1A67: 21 00 58        LD      HL,$5800            ; point at OBJRAM, the sprite/scroll/bullet hardware
1A6A: AF              XOR     A                   ; fill value zero

loc_1a6b:
1A6B: 77              LD      (HL),A              ; zero this OBJRAM byte
1A6C: 2C              INC     L                   ; next byte
1A6D: C2 6B 1A        JP      NZ,$1A6B            ; {code.loc_1a6b} zero the whole 256-byte OBJRAM page
1A70: AF              XOR     A                   ; value zero
1A71: 21 00 60        LD      HL,$6000            ; point at the 0x6000 output latches -- start lamps, lockout, coin counter
1A74: 06 04           LD      B,$04               ; four latches to clear

loc_1a76:
1A76: 77              LD      (HL),A              ; clear this output latch
1A77: 23              INC     HL                  ; next latch
1A78: 10 FC           DJNZ    $1A76               ; {code.loc_1a76} clear all four 0x6000 latches
1A7A: 3C              INC     A                   ; value 1
1A7B: 06 04           LD      B,$04               ; four sound-LFO frequency latches to set

loc_1a7d:
1A7D: 77              LD      (HL),A              ; write 1 to this LFO frequency latch
1A7E: 23              INC     HL                  ; next latch
1A7F: 10 FC           DJNZ    $1A7D               ; {code.loc_1a7d} set all four
1A81: AF              XOR     A                   ; value zero
1A82: 06 08           LD      B,$08               ; eight sound registers
1A84: 21 00 68        LD      HL,$6800            ; point at the eight sound write registers

loc_1a87:
1A87: 77              LD      (HL),A              ; silence this sound register
1A88: 23              INC     HL                  ; next register
1A89: 10 FC           DJNZ    $1A87               ; {code.loc_1a87} silence all eight sound registers
1A8B: 06 08           LD      B,$08               ; eight control latches
1A8D: 21 01 70        LD      HL,$7001            ; point at the 0x7000 control latches -- irq enable, starfield, screen flips

loc_1a90:
1A90: 77              LD      (HL),A              ; clear this control latch
1A91: 23              INC     HL                  ; next latch
1A92: 10 FC           DJNZ    $1A90               ; {code.loc_1a90} clear the eight 0x7000 control latches
1A94: 3D              DEC     A                   ; value 0xff
1A95: 32 00 78        LD      ($7800),A           ; prime the pitch-write / watchdog port
1A98: 0E 20           LD      C,$20               ; thirty-two walking-pattern RAM-test passes

loc_1a9a:
1A9A: 21 00 40        LD      HL,$4000            ; point at work-RAM base
1A9D: 06 04           LD      B,$04               ; four pages of work RAM
1A9F: 79              LD      A,C                 ; seed the pattern from this pass number

loc_1aa0:
1AA0: C6 2F           ADD     A,$2F               ; advance the walking test pattern by 0x2f
1AA2: 77              LD      (HL),A              ; write the pattern byte to work RAM
1AA3: 2C              INC     L                   ; next cell
1AA4: C2 A0 1A        JP      NZ,$1AA0            ; {code.loc_1aa0} fill this 256-byte page with the pattern
1AA7: 3C              INC     A                   ; bump the pattern for the next page
1AA8: 24              INC     H                   ; advance to the next work-RAM page
1AA9: 10 F5           DJNZ    $1AA0               ; {code.loc_1aa0} write all four work-RAM pages
1AAB: 21 00 40        LD      HL,$4000            ; back to work-RAM base to verify
1AAE: 06 04           LD      B,$04               ; four pages to check
1AB0: 79              LD      A,C                 ; same pass seed

loc_1ab1:
1AB1: C6 2F           ADD     A,$2F               ; regenerate the expected pattern byte
1AB3: BE              CP      (HL)                ; compare it against what work RAM holds
1AB4: 20 45           JR      NZ,$1AFB            ; {code.loc_1afb} mismatch -- RAM fault, bail to the error path
1AB6: 2C              INC     L                   ; next cell
1AB7: C2 B1 1A        JP      NZ,$1AB1            ; {code.loc_1ab1} verify the whole page
1ABA: 3C              INC     A                   ; bump the expected pattern for the next page
1ABB: 24              INC     H                   ; next page
1ABC: 10 F3           DJNZ    $1AB1               ; {code.loc_1ab1} verify all four pages
1ABE: 3A 00 78        LD      A,($7800)           ; pet the watchdog between passes
1AC1: 0D              DEC     C                   ; one fewer walking-pattern pass
1AC2: C2 9A 1A        JP      NZ,$1A9A            ; {code.loc_1a9a} run all thirty-two passes
1AC5: 31 00 44        LD      SP,$4400            ; seat the Z80 stack pointer at the top of work RAM
1AC8: 0E 20           LD      C,$20               ; begin the next init pass, count 32

loc_1aca:
1ACA: 21 00 50        LD      HL,$5000            ; point HL at the tile VRAM base 0x5000 -- the region the walking-pattern RAM test writes and reads back
1ACD: 06 04           LD      B,$04               ; B counts the four 256-byte pages to sweep
1ACF: 79              LD      A,C                 ; seed the pattern value A from the round counter C

loc_1ad0:
1AD0: C6 2F           ADD     A,$2F               ; step the pattern by 0x2f to make the next cell's test byte
1AD2: 77              LD      (HL),A              ; write the pattern byte into the cell
1AD3: 2C              INC     L                   ; advance to the next cell in the page
1AD4: C2 D0 1A        JP      NZ,$1AD0            ; {code.loc_1ad0} loop until the low byte wraps -- the whole 256-byte page filled
1AD7: 3C              INC     A                   ; bump the pattern once per page so each page differs
1AD8: 24              INC     H                   ; step HL to the next 256-byte page
1AD9: 10 F5           DJNZ    $1AD0               ; {code.loc_1ad0} repeat the fill for all four pages
1ADB: 3A 00 78        LD      A,($7800)           ; read the watchdog port to pet it so the board won't reset mid-test
1ADE: 21 00 50        LD      HL,$5000            ; re-point HL at the base for the read-back verify pass
1AE1: 06 04           LD      B,$04               ; B counts the four pages again
1AE3: 79              LD      A,C                 ; re-seed the expected pattern from the round counter C

loc_1ae4:
1AE4: C6 2F           ADD     A,$2F               ; regenerate the expected byte, stepping by 0x2f
1AE6: BE              CP      (HL)                ; compare the expected byte against what was stored
1AE7: 20 16           JR      NZ,$1AFF            ; {code.loc_1aff} on a mismatch bail to the RAM-fail display path
1AE9: 2C              INC     L                   ; advance to the next cell
1AEA: C2 E4 1A        JP      NZ,$1AE4            ; {code.loc_1ae4} loop until the page wraps
1AED: 3C              INC     A                   ; bump the expected pattern once per page
1AEE: 24              INC     H                   ; step to the next page
1AEF: 10 F3           DJNZ    $1AE4               ; {code.loc_1ae4} repeat the verify for all four pages
1AF1: 3A 00 78        LD      A,($7800)           ; pet the watchdog after the verify sweep
1AF4: 0D              DEC     C                   ; count down the test-round counter C
1AF5: C2 CA 1A        JP      NZ,$1ACA            ; {code.loc_1aca} more rounds left -- restart the fill-and-verify sweep
1AF8: C3 70 1B        JP      $1B70               ; {code.loc_1b70} every round passed -- jump on to the ROM checksum test

loc_1afb:
1AFB: 3E 01           LD      A,$01               ; load result code 1 (RAM test passed)
1AFD: 18 05           JR      $1B04               ; {code.loc_1b04} jump to store the result code

loc_1aff:
1AFF: CD 5D 1B        CALL    $1B5D               ; {code.loc_1b5d} blank the VRAM test region before drawing the failure message
1B02: 3E 02           LD      A,$02               ; load error code 2 (RAM test failed)

loc_1b04:
1B04: 32 F3 51        LD      ($51F3),A           ; store the result/error code into status VRAM cell 0x51f3
1B07: 11 2D 1B        LD      DE,$1B2D            ; point DE at the message glyph template at 0x1b2d

loc_1b0a:
1B0A: 21 33 52        LD      HL,$5233            ; point HL at the destination VRAM cell 0x5233 for the message
1B0D: 01 20 00        LD      BC,$0020            ; BC = 0x20, one 32-cell tile row per glyph step
1B10: D9              EXX                         ; swap in the alternate register set to hold the glyph counter
1B11: 06 07           LD      B,$07               ; seven glyphs to place down the column

loc_1b13:
1B13: D9              EXX                         ; swap back to the main registers to place a glyph
1B14: 1A              LD      A,(DE)              ; read one glyph byte from the message template
1B15: 77              LD      (HL),A              ; write it into the VRAM cell
1B16: 09              ADD     HL,BC               ; step down 32 cells -- one tile row -- to the next glyph slot
1B17: 13              INC     DE                  ; advance the template pointer
1B18: D9              EXX                         ; swap in the alternate set to reach the counter
1B19: 10 F8           DJNZ    $1B13               ; {code.loc_1b13} loop for all seven glyphs of the message

loc_1b1b:
1B1B: AF              XOR     A                   ; clear A to zero for the interrupt-off write
1B1C: 32 01 70        LD      ($7001),A           ; clear the interrupt-enable latch 0x7001 so no vblank fires
1B1F: 3A 00 78        LD      A,($7800)           ; pet the watchdog while holding the error display
1B22: 3A 00 60        LD      A,($6000)           ; read IN0 at 0x6000
1B25: E6 40           AND     $40                 ; mask bit 6, the service/test switch
1B27: C2 1B 1B        JP      NZ,$1B1B            ; {code.loc_1b1b} still held -- loop, holding the failure screen up
1B2A: C3 00 00        JP      $0000               ; {code.loc_0000} switch released -- jump to the cold-reset vector

; ---- $1B2D-$1B33: data ----
1B2D: 1D 11 22 10 14 11 12

loc_1b34:
1B34: 4F              LD      C,A                 ; save the accumulated checksum into C
1B35: 3A 00 60        LD      A,($6000)           ; read IN0 at 0x6000
1B38: 47              LD      B,A                 ; B = IN0
1B39: 3A 00 68        LD      A,($6800)           ; read IN1 at 0x6800
1B3C: A0              AND     B                   ; AND IN1 with IN0
1B3D: E6 04           AND     $04                 ; mask bit 2 of the combined inputs
1B3F: 28 10           JR      Z,$1B51             ; {code.loc_1b51} bit clear -- skip showing the checksum digits
1B41: 79              LD      A,C                 ; A = saved checksum C
1B42: E6 0F           AND     $0F                 ; take the low nibble of the checksum
1B44: 32 D3 51        LD      ($51D3),A           ; write it as a digit into status VRAM cell 0x51d3
1B47: 79              LD      A,C                 ; A = saved checksum C again
1B48: 0F              RRCA                        ; rotate right to bring the high nibble down
1B49: 0F              RRCA                        ; rotate right
1B4A: 0F              RRCA                        ; rotate right
1B4B: 0F              RRCA                        ; rotate right -- high nibble now in the low bits
1B4C: E6 0F           AND     $0F                 ; mask the low nibble
1B4E: 32 F3 51        LD      ($51F3),A           ; write the high checksum digit into status VRAM cell 0x51f3

loc_1b51:
1B51: 11 56 1B        LD      DE,$1B56            ; point DE at the checksum-fail message template at 0x1b56
1B54: 18 B4           JR      $1B0A               ; {code.loc_1b0a} jump to the glyph-placing loop to draw the message

; ---- $1B56-$1B5C: data ----
1B56: 1D 1F 22 10 14 11 12

loc_1b5d:
1B5D: 21 00 50        LD      HL,$5000            ; point HL at the tile VRAM base 0x5000 to blank it
1B60: 06 04           LD      B,$04               ; B counts the four pages to blank

loc_1b62:
1B62: 3E 10           LD      A,$10               ; load the blank tile value 0x10

loc_1b64:
1B64: 77              LD      (HL),A              ; write the blank tile into the cell
1B65: 2C              INC     L                   ; advance to the next cell
1B66: C2 64 1B        JP      NZ,$1B64            ; {code.loc_1b64} loop until the page wraps
1B69: 24              INC     H                   ; step to the next page
1B6A: 3A 00 78        LD      A,($7800)           ; pet the watchdog between pages
1B6D: 10 F3           DJNZ    $1B62               ; {code.loc_1b62} blank all four VRAM pages
1B6F: C9              RET                         ; return

loc_1b70:
1B70: CD 5D 1B        CALL    $1B5D               ; {code.loc_1b5d} blank the VRAM before running the ROM checksum
1B73: 21 00 00        LD      HL,$0000            ; point HL at ROM start 0x0000
1B76: 06 28           LD      B,$28               ; B = 0x28, the number of ROM pages to sum
1B78: AF              XOR     A                   ; clear the checksum accumulator A

loc_1b79:
1B79: 86              ADD     A,(HL)              ; add the ROM byte to the running checksum
1B7A: 2C              INC     L                   ; advance to the next byte
1B7B: C2 79 1B        JP      NZ,$1B79            ; {code.loc_1b79} loop until the page wraps
1B7E: 24              INC     H                   ; step to the next ROM page
1B7F: 4F              LD      C,A                 ; stash the running sum in C across the watchdog read
1B80: 3A 00 78        LD      A,($7800)           ; pet the watchdog between pages
1B83: 79              LD      A,C                 ; restore the running sum into A
1B84: 10 F3           DJNZ    $1B79               ; {code.loc_1b79} sum all 0x28 ROM pages
1B86: A7              AND     A                   ; test the final checksum
1B87: C2 34 1B        JP      NZ,$1B34            ; {code.loc_1b34} nonzero -- ROM checksum bad, branch to the fail-display decode
1B8A: 21 00 40        LD      HL,$4000            ; point HL at work-RAM base 0x4000
1B8D: 06 C0           LD      B,$C0               ; B = 0xc0 bytes to clear
1B8F: D7              RST     $10                 ; fill 0xc0 bytes of zero from 0x4000, clearing the low work RAM
1B90: 3D              DEC     A                   ; A = 0xff for the next fill
1B91: 06 40           LD      B,$40               ; B = 0x40 bytes
1B93: D7              RST     $10                 ; fill 0x40 bytes of 0xff over the command-queue region
1B94: AF              XOR     A                   ; A = 0 again
1B95: D7              RST     $10                 ; fill a full 256-byte page of zero (count 0 wraps to 256)
1B96: D7              RST     $10                 ; fill another 256-byte page of zero
1B97: 06 A0           LD      B,$A0               ; B = 0xa0 bytes
1B99: D7              RST     $10                 ; fill 0xa0 more bytes of zero, finishing the work-RAM clear
1B9A: 32 01 70        LD      ($7001),A           ; clear the interrupt-enable latch 0x7001
1B9D: 32 05 70        LD      ($7005),A           ; clear the 0x7005 control latch
1BA0: 32 06 70        LD      ($7006),A           ; clear the screen-flip X latch 0x7006
1BA3: 32 07 70        LD      ($7007),A           ; clear the screen-flip Y latch 0x7007
1BA6: 32 18 40        LD      ($4018),A           ; {hard.workRam+18} clear the orientation flag 0x4018
1BA9: 3A 00 78        LD      A,($7800)           ; pet the watchdog
1BAC: 3E 20           LD      A,$20               ; A = 0x20
1BAE: 32 08 40        LD      ($4008),A           ; {hard.workRam+8} seat the boot per-state timer 0x4008 at 0x20
1BB1: 3E 03           LD      A,$03               ; A = 3
1BB3: 32 1A 40        LD      ($401A),A           ; {hard.workRam+1A} set the self-test mode flag 0x401a to 3, routing the vblank to the object-color-ramp pass
1BB6: 21 C0 C0        LD      HL,$C0C0            ; HL = 0xc0c0
1BB9: 22 A0 40        LD      ($40A0),HL          ; {hard.workRam+A0} seat the command-queue write head 0x40a0 at 0xc0c0
1BBC: 3E 01           LD      A,$01               ; A = 1
1BBE: 32 04 70        LD      ($7004),A           ; turn the starfield on via 0x7004
1BC1: 32 02 70        LD      ($7002),A           ; set the 0x7002 control latch to 1
1BC4: 32 03 70        LD      ($7003),A           ; set the 0x7003 control latch to 1
1BC7: 32 01 70        LD      ($7001),A           ; re-arm the interrupt-enable latch 0x7001 so the vblank heartbeat starts
1BCA: C3 00 20        JP      $2000               ; {code.enterMainLoop} jump to the main program loop at 0x2000

loc_1bcd:
1BCD: 21 D8 00        LD      HL,$00D8            ; HL = 0x00d8, the return address to leave under the selected sub-handler
1BD0: E5              PUSH    HL                  ; push that return address so the chosen self-test handler returns through it
1BD1: 3D              DEC     A                   ; decrement the self-test mode value to test for 1
1BD2: CA 3A 1C        JP      Z,$1C3A             ; {code.driveSoundFrameAndScanInput} mode 1 -- run the sound-and-input self-test scan
1BD5: 3D              DEC     A                   ; decrement again to test for 2
1BD6: CA 28 1D        JP      Z,$1D28             ; {code.advanceScreenFillStrip} mode 2 -- run the per-frame screen-fill strip painter
1BD9: 3D              DEC     A                   ; decrement again to test for 3
1BDA: C2 00 00        JP      NZ,$0000            ; {code.loc_0000} any value past 3 is invalid -- drop to the cold-reset vector
1BDD: 21 00 58        LD      HL,$5800            ; mode 3 falls through here: point HL at the OBJRAM hardware base 0x5800
1BE0: 3A 1E 40        LD      A,($401E)           ; {hard.workRam+1E} seed the color ramp from the current random seed 0x401e

loc_1be3:
1BE3: 77              LD      (HL),A              ; write the color byte into the OBJRAM cell
1BE4: C6 2F           ADD     A,$2F               ; step the color ramp by 0x2f for the next cell
1BE6: 2C              INC     L                   ; advance to the next OBJRAM cell
1BE7: C2 E3 1B        JP      NZ,$1BE3            ; {code.loc_1be3} loop across the whole 256-byte OBJRAM page
1BEA: 3A 1E 40        LD      A,($401E)           ; {hard.workRam+1E} re-seed the expected color from 0x401e for the verify pass

loc_1bed:
1BED: BE              CP      (HL)                ; compare the expected color against what was stored
1BEE: 20 3C           JR      NZ,$1C2C            ; {code.loc_1c2c} on a mismatch bail to the OBJRAM-fail path
1BF0: C6 2F           ADD     A,$2F               ; step the expected color by 0x2f
1BF2: 2C              INC     L                   ; advance to the next cell
1BF3: C2 ED 1B        JP      NZ,$1BED            ; {code.loc_1bed} loop across the page verifying
1BF6: 3A 00 78        LD      A,($7800)           ; pet the watchdog after the verify sweep
1BF9: CD 3C 00        CALL    $003C               ; {code.advanceRandomSeed} draw a fresh random number, advancing the seed so next frame's ramp differs
1BFC: 21 08 40        LD      HL,$4008            ; point HL at the boot per-state timer 0x4008
1BFF: 35              DEC     (HL)                ; count the timer down one frame
1C00: C0              RET     NZ                  ; timer still running -- return and keep filling the ramp next frame
1C01: AF              XOR     A                   ; timer expired -- A = 0 for the one-time setup that follows
1C02: 21 00 58        LD      HL,$5800            ; point HL at the OBJRAM base 0x5800
1C05: 47              LD      B,A                 ; B = 0 so the fill covers a full 256-byte page
1C06: D7              RST     $10                 ; clear the whole OBJRAM page to zero
1C07: 3E 01           LD      A,$01               ; A = 1
1C09: 32 06 40        LD      ($4006),A           ; {hard.workRam+6} set the mode flag 0x4006 to 1
1C0C: 32 1A 40        LD      ($401A),A           ; {hard.workRam+1A} set the self-test mode 0x401a to 1, routing to the sound-and-input scan next
1C0F: 32 00 60        LD      ($6000),A           ; light the 1-player start lamp latch at 0x6000
1C12: 32 01 60        LD      ($6001),A           ; light the 2-player start lamp latch at 0x6001
1C15: 32 02 60        LD      ($6002),A           ; engage the coin-lockout latch at 0x6002
1C18: 32 26 42        LD      ($4226),A           ; {hard.workRam+226} set 0x4226 to 1
1C1B: 32 5F 42        LD      ($425F),A           ; {hard.workRam+25F} set the frame counter 0x425f to 1
1C1E: 32 38 42        LD      ($4238),A           ; {hard.workRam+238} set the object-draw-suppress flag 0x4238 so the figure grid stays blank
1C21: 3E 1F           LD      A,$1F               ; A = 0x1f
1C23: 32 13 52        LD      ($5213),A           ; write 0x1f into status VRAM cell 0x5213
1C26: 3E 1B           LD      A,$1B               ; A = 0x1b
1C28: 32 F3 51        LD      ($51F3),A           ; write 0x1b into status VRAM cell 0x51f3
1C2B: C9              RET                         ; return

loc_1c2c:
1C2C: 21 00 58        LD      HL,$5800            ; OBJRAM verify failed: point HL at the OBJRAM base 0x5800
1C2F: AF              XOR     A                   ; A = 0

loc_1c30:
1C30: 77              LD      (HL),A              ; write zero into the OBJRAM cell
1C31: 2C              INC     L                   ; advance to the next cell
1C32: C2 30 1C        JP      NZ,$1C30            ; {code.loc_1c30} loop, clearing the whole page
1C35: 3E 03           LD      A,$03               ; load error code 3 (OBJRAM test failed)
1C37: C3 04 1B        JP      $1B04               ; {code.loc_1b04} jump to the error-display path to show code 3

; Per-frame audio+input service (game-state A==1 branch of
; dispatchSelfTestMode): tick the sound driver (0x16f5) and the decaying
; sweep (0x16a6), pet the watchdog (read 0x7800), then read IN0 (0x6000)
; and, if any arm bit is set (mask 0x83 = bits 7/1/0), raise the pitch-
; ramp arm cell 0x41c9; falls through into the input-scan chain with the
; raw IN0.
driveSoundFrameAndScanInput:
1C3A: CD F5 16        CALL    $16F5               ; {code.driveSoundFrame} run the sound driver's per-frame tick
1C3D: CD A6 16        CALL    $16A6               ; {code.driveDecayingSoundSweep} run the sound sweep driver
1C40: 3A 00 78        LD      A,($7800)           ; pet the watchdog
1C43: 3A 00 60        LD      A,($6000)           ; read IN0 at 0x6000
1C46: 47              LD      B,A                 ; B = IN0
1C47: E6 83           AND     $83                 ; mask bits 7,1,0 of IN0
1C49: 28 05           JR      Z,$1C50             ; {code.requestSoundOnInput1AndContinueScan} none of those set -- skip
1C4B: 3E 01           LD      A,$01               ; A = 1
1C4D: 32 C9 41        LD      ($41C9),A           ; {hard.workRam+1C9} set 0x41c9 to 1 on that input

; Read input port IN1 (0x6800); if either of its low two bits is set, seed
; the shared control/sound-request byte 0x41df=0x16; then tail-continue
; the input scan via requestSound6AndContinueInputScan (0x1c5d), handing
; it the caller's IN0 (B) and the full IN1 byte for the downstream IN0|IN1
; bit tests
requestSoundOnInput1AndContinueScan:
1C50: 3A 00 68        LD      A,($6800)           ; read IN1 at 0x6800
1C53: 4F              LD      C,A                 ; C = IN1
1C54: E6 03           AND     $03                 ; mask bits 1,0 of IN1
1C56: 28 05           JR      Z,$1C5D             ; {code.requestSound6AndContinueInputScan} none set -- skip
1C58: 3E 16           LD      A,$16               ; A = 0x16
1C5A: 32 DF 41        LD      ($41DF),A           ; {hard.workRam+1DF} stage sound-sweep request 0x16 into 0x41df

; On folded input IN0|IN1 bits 2-3 (mask 0x0c), seeds sound-request
; selector 0x41df=6 (the value armSoundSequenceBySelector 0x1819 keys on
; to arm sound sequence 0x1ebd, gated on sound driver 0x4006 bit0), then
; falls through to armInputFlagAndDrawInputColumns (0x1c68) to continue
; the input-column scan.
requestSound6AndContinueInputScan:
1C5D: 78              LD      A,B                 ; A = IN0
1C5E: B1              OR      C                   ; OR in IN1
1C5F: E6 0C           AND     $0C                 ; mask bits 3,2 of the combined inputs
1C61: 28 05           JR      Z,$1C68             ; {code.armInputFlagAndDrawInputColumns} none set -- skip
1C63: 3E 06           LD      A,$06               ; A = 6
1C65: 32 DF 41        LD      ($41DF),A           ; {hard.workRam+1DF} stage sound-sweep request 6 into 0x41df

; Input-scan link: fold the two input-port bytes and, when their shared
; bit4 is set, raise companion input flag 0x41cc=1, then tail-delegate to
; drawInputTextColumnsAndSeedScreenFill (attract/reset input-column draw +
; screen-fill seed).
armInputFlagAndDrawInputColumns:
1C68: 78              LD      A,B                 ; A = IN0
1C69: B1              OR      C                   ; OR in IN1
1C6A: E6 10           AND     $10                 ; mask bit 4 of the combined inputs
1C6C: 28 05           JR      Z,$1C73             ; {code.drawInputTextColumnsAndSeedScreenFill} clear -- skip
1C6E: 3E 01           LD      A,$01               ; A = 1
1C70: 32 CC 41        LD      ($41CC),A           ; {hard.workRam+1CC} set 0x41cc to 1 on that input

; Attract/reset init: decode three 2-bit input-port fields (IN1 6-7, IN2
; 0-1, IN2 2) into text-descriptor indices and paint each column, then
; (unless IN0 bit6 is set) seed the screen-fill state (0x4006=0, 0x401a=2,
; dwell pair 0x4008/0x4009=0x3010, VRAM_WRITE_PTR 0x400b=VRAM_BASE), clear
; the 4-byte start-lamp/coin latch block, and silence the sound hardware.
drawInputTextColumnsAndSeedScreenFill:
1C73: 3A 00 68        LD      A,($6800)           ; read IN1 at 0x6800
1C76: 07              RLCA                        ; rotate left to bring the high bits down
1C77: 07              RLCA                        ; rotate left again
1C78: E6 03           AND     $03                 ; keep the two extracted bits
1C7A: CD CF 1C        CALL    $1CCF               ; {code.drawTextColumnByIndex} run the input-test feedback handler for this input group
1C7D: 3A 00 70        LD      A,($7000)           ; read IN2 at 0x7000
1C80: E6 03           AND     $03                 ; keep its low two bits
1C82: C6 04           ADD     A,$04               ; offset the group index by 4
1C84: CD CF 1C        CALL    $1CCF               ; {code.drawTextColumnByIndex} run the input-test feedback handler for the next input group
1C87: 3A 00 70        LD      A,($7000)           ; read IN2 at 0x7000
1C8A: 0F              RRCA                        ; rotate right to reach the wanted bit
1C8B: 0F              RRCA                        ; rotate right again
1C8C: E6 01           AND     $01                 ; keep the single extracted bit
1C8E: C6 08           ADD     A,$08               ; offset the group index by 8
1C90: CD CF 1C        CALL    $1CCF               ; {code.drawTextColumnByIndex} run the input-test feedback handler for the last input group
1C93: 3A 00 60        LD      A,($6000)           ; read IN0 at 0x6000
1C96: E6 40           AND     $40                 ; mask bit 6, the service/test switch
1C98: C0              RET     NZ                  ; still held -- stay in the sound/input test, return
1C99: AF              XOR     A                   ; switch released -- A = 0 to leave this test
1C9A: 32 06 40        LD      ($4006),A           ; {hard.workRam+6} clear the mode flag 0x4006
1C9D: 3E 02           LD      A,$02               ; A = 2
1C9F: 32 1A 40        LD      ($401A),A           ; {hard.workRam+1A} set the self-test mode 0x401a to 2, routing to the screen-fill strip painter next
1CA2: 21 10 30        LD      HL,$3010            ; HL = 0x3010
1CA5: 22 08 40        LD      ($4008),HL          ; {hard.workRam+8} seat the timer pair at 0x4008/0x4009 for the fill phase
1CA8: 21 00 50        LD      HL,$5000            ; HL = tile VRAM base 0x5000
1CAB: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} seat the VRAM fill write cursor 0x400b at 0x5000
1CAE: AF              XOR     A                   ; A = 0
1CAF: 21 00 60        LD      HL,$6000            ; point HL at the 0x6000 output-latch base
1CB2: 06 04           LD      B,$04               ; B = 4 latches to clear
1CB4: D7              RST     $10                 ; clear the four 0x6000 latches -- start lamps, coin lockout, coin counter

; Hardware quiesce: set the four SOUND_LFO_FREQ latches (0x6004-7)=1,
; clear the eight sound registers (0x6800-7), clear IRQ_ENABLE (0x7001)
; and STARS_ENABLE (0x7004), and drive SOUND_PITCH_W (0x7800)=0xff --
; silences audio and halts the vblank interrupt + starfield.
silenceSoundAndDisableIrqStars:
1CB5: 3E 01           LD      A,$01               ; load $01, the value the sound LFO latches take
1CB7: 21 04 60        LD      HL,$6004            ; point at the discrete-sound LFO frequency latch base
1CBA: 06 04           LD      B,$04               ; four LFO latches to set
1CBC: D7              RST     $10                 ; block-fill the four LFO frequency latches with $01
1CBD: AF              XOR     A                   ; clear A to $00, the silence value
1CBE: 06 08           LD      B,$08               ; eight sound registers to clear
1CC0: 21 00 68        LD      HL,$6800            ; point at the eight discrete-sound write registers
1CC3: D7              RST     $10                 ; block-fill all eight sound registers with 0 -- kill the voices
1CC4: 06 05           LD      B,$05               ; five control latches to clear
1CC6: 21 01 70        LD      HL,$7001            ; point at the interrupt-enable / starfield control-latch bank at 0x7001
1CC9: D7              RST     $10                 ; block-fill five control latches with 0 -- halt the vblank interrupt and starfield
1CCA: 3D              DEC     A                   ; step A down to $ff
1CCB: 32 00 78        LD      ($7800),A           ; drive the sound pitch latch to $ff
1CCE: C9              RET                         ; done quiescing the sound and video hardware

; Index the 5-byte text-descriptor table (TEXT_DESCRIPTOR_TABLE) by A and
; paint that descriptor's on-screen text column via
; drawTextColumnFromDescriptor.
drawTextColumnByIndex:
1CCF: 47              LD      B,A                 ; save the text-descriptor index in B
1CD0: 87              ADD     A,A                 ; double it
1CD1: 87              ADD     A,A                 ; double again -- index times four
1CD2: 80              ADD     A,B                 ; add the original back -- index times five, the 5-byte descriptor stride
1CD3: 5F              LD      E,A                 ; low byte of the table offset
1CD4: 16 00           LD      D,$00               ; high byte zero
1CD6: 21 F6 1C        LD      HL,$1CF6            ; point at the text-descriptor table base
1CD9: 19              ADD     HL,DE               ; step to this descriptor's entry
1CDA: 06 02           LD      B,$02               ; two 16-bit words to pull off the descriptor

; Unpack a 5-byte text descriptor at the record pointer (source word, dest
; word, count byte) and paint `count` chars up a VRAM column (stride -32)
; via drawTextColumn (0x1ceb), each source byte mapped to a font tile.
drawTextColumnFromDescriptor:
1CDC: 5E              LD      E,(HL)              ; read the low byte of a descriptor word
1CDD: 23              INC     HL                  ; advance
1CDE: 56              LD      D,(HL)              ; read the high byte of the word
1CDF: 23              INC     HL                  ; advance
1CE0: D5              PUSH    DE                  ; stash the word -- first the source pointer, then the VRAM destination
1CE1: 10 F9           DJNZ    $1CDC               ; {code.drawTextColumnFromDescriptor} loop for the second descriptor word
1CE3: 46              LD      B,(HL)              ; fifth descriptor byte is the glyph count
1CE4: D9              EXX                         ; swap to the alternate register bank
1CE5: E1              POP     HL                  ; recover the VRAM destination cell
1CE6: D1              POP     DE                  ; recover the source text pointer
1CE7: 01 E0 FF        LD      BC,$FFE0            ; set the step to -32, one tilemap row up per glyph
1CEA: D9              EXX                         ; back to the main bank

; draw a run of characters down a VRAM column, mapping each source byte to
; a font tile (byte - 0x30)
drawTextColumn:
1CEB: D9              EXX                         ; into the drawing bank
1CEC: 1A              LD      A,(DE)              ; read one source character byte
1CED: D6 30           SUB     $30                 ; convert the ASCII code to its tile number
1CEF: 77              LD      (HL),A              ; poke the glyph into the VRAM cell
1CF0: 13              INC     DE                  ; step to the next source character
1CF1: 09              ADD     HL,BC               ; move the VRAM cursor one row up the column
1CF2: D9              EXX                         ; back out of the drawing bank
1CF3: 10 F6           DJNZ    $1CEB               ; {code.drawTextColumn} loop for the whole glyph count
1CF5: C9              RET                         ; text column drawn

; ---- $1CF6-$1D27: data ----
1CF6: 12 1F D6 52 10 22 1F D6 52 10 32 1F D6 52 10 42
1D06: 1F D6 52 10 52 1F D8 52 0B 5D 1F D8 52 0B 68 1F
1D16: D8 52 0B 73 1F D8 52 0B 7E 1F DA 52 09 87 1F DA
1D26: 52 09

; Head of the per-frame tile-strip screen-fill: pet the watchdog, read
; strip gate 0x4008 -- if zero restart the outer fill dwell
; (restartScreenFillOnDwellExpiry), else load VRAM write cursor 0x400b and
; draw the strip's first half (drawScreenFillStripFirstHalf).
advanceScreenFillStrip:
1D28: 21 08 40        LD      HL,$4008            ; point at the strip-fill sub-timer
1D2B: 3A 00 78        LD      A,($7800)           ; read the watchdog port to pet it
1D2E: 7E              LD      A,(HL)              ; read the strip-fill timer
1D2F: A7              AND     A                   ; test it
1D30: CA 51 1D        JP      Z,$1D51             ; {code.restartScreenFillOnDwellExpiry} timer spent -> handle the dwell/exit path
1D33: D9              EXX                         ; swap to the fill bank
1D34: 2A 0B 40        LD      HL,($400B)          ; {hard.workRam+B} load the VRAM fill write cursor
1D37: 06 10           LD      B,$10               ; sixteen tile pairs for the first half-strip

; First half of the animated screen-fill tile strip: stamp `count` two-
; tile pairs (48,50) forward from the VRAM cursor (two cells per pass,
; count 0 wraps to 256), then fall into drawScreenFillStripSecondHalf
; which stamps 16 more pairs and ticks the strip dwell.
drawScreenFillStripFirstHalf:
1D39: 36 30           LD      (HL),$30            ; lay a fill tile
1D3B: 23              INC     HL                  ; next cell
1D3C: 36 32           LD      (HL),$32            ; lay the paired fill tile
1D3E: 23              INC     HL                  ; next cell
1D3F: 10 F8           DJNZ    $1D39               ; {code.drawScreenFillStripFirstHalf} fill the whole first half-strip
1D41: 06 10           LD      B,$10               ; sixteen more pairs for the second half

; Second half of the tile-strip fill (fallen into from
; drawScreenFillStripFirstHalf, which stamps tile pair 0x30/0x32 and sets
; B=0x10): stamps B pairs of tiles 52/54 forward from the cursor (HL, two
; cells per pass, count 0 wraps to 256), saves the advanced cursor to
; VRAM_WRITE_PTR (0x400b), ticks strip dwell 0x4008; on its expiry
; restartScreenFillOnDwellExpiry(0x4008).
drawScreenFillStripSecondHalf:
1D43: 36 34           LD      (HL),$34            ; lay a fill tile
1D45: 23              INC     HL                  ; next cell
1D46: 36 36           LD      (HL),$36            ; lay the paired fill tile
1D48: 23              INC     HL                  ; next cell
1D49: 10 F8           DJNZ    $1D43               ; {code.drawScreenFillStripSecondHalf} fill the second half-strip
1D4B: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} save the advanced fill cursor
1D4E: D9              EXX                         ; back to the main bank
1D4F: 35              DEC     (HL)                ; count the strip-fill timer down one
1D50: C0              RET     NZ                  ; more strips left to paint -> return

; Screen-fill outer-dwell tick: entered from the tile-strip fill updater
; (advanceScreenFillStrip gate-zero path / drawScreenFillStripSecondHalf
; fall-through, HL=0x4008), bump to the high-tier dwell byte 0x4009 and
; tick it; if already 0 or on the zero-crossing, restart the fill via
; resetScreenFillState (0x1d58).
restartScreenFillOnDwellExpiry:
1D51: 23              INC     HL                  ; point at the dwell tier just above the timer
1D52: 7E              LD      A,(HL)              ; read the dwell counter
1D53: A7              AND     A                   ; test it
1D54: 28 02           JR      Z,$1D58             ; {code.resetScreenFillState} dwell spent -> finish the fill phase
1D56: 35              DEC     (HL)                ; count the dwell down
1D57: C0              RET     NZ                  ; still dwelling -> return

; input-gated reset of the screen-fill state: rewind the VRAM write cursor
; to base, re-arm the full-page fill length, and clear the dispatch flag
; and game state
resetScreenFillState:
1D58: 3A 00 60        LD      A,($6000)           ; read the IN0 input port
1D5B: E6 40           AND     $40                 ; isolate the service/test switch bit
1D5D: C0              RET     NZ                  ; test switch held -> leave without resetting
1D5E: 21 00 50        LD      HL,$5000            ; point at the tilemap VRAM base
1D61: 22 0B 40        LD      ($400B),HL          ; {hard.workRam+B} rewind the fill cursor to the top of VRAM
1D64: 3E 20           LD      A,$20               ; reload value for the strip timer
1D66: 32 08 40        LD      ($4008),A           ; {hard.workRam+8} arm the strip-fill timer again
1D69: AF              XOR     A                   ; clear A
1D6A: 32 1A 40        LD      ($401A),A           ; {hard.workRam+1A} clear the self-test mode flag -> back to the normal frame path
1D6D: 32 05 40        LD      ($4005),A           ; {hard.workRam+5} set the game state to 0, the boot handler
1D70: C9              RET                         ; screen-fill phase complete

; ---- $1D71-$1FFF: data ----
1D71: 00 05 00 00 01 01 02 03 03 04 04 04 04 00 00 00
1D81: 00 00 00 05 05 05 05 05 00 00 06 06 06 06 06 06
1D91: 00 05 00 00 01 01 02 03 03 04 04 04 04 00 00 00
1DA1: 06 06 06 06 06 06 05 06 06 06 06 06 06 06 06 06
1DB1: 00 05 00 00 01 01 02 03 05 04 05 04 04 00 00 00
1DC1: 00 06 06 06 06 06 06 06 06 06 00 00 07 07 06 06
1DD1: 00 00 00 00 04 01 04 02 04 01 03 03 02 02 01 02
1DE1: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1DF1: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 FF
1E01: 00 FF 00 FF 00 FF 01 FF 00 FF 00 FF 01 FF 00 FF
1E11: 01 FF 00 00 01 FF 00 FF 01 00 01 FF 00 00 01 FF
1E21: 01 00 01 FF 01 00 01 00 01 FF 01 00 01 00 01 00
1E31: 01 00 01 00 01 00 01 01 01 00 01 00 01 01 01 00
1E41: 01 01 01 00 01 01 00 00 01 01 01 01 00 00 01 01
1E51: 00 01 01 01 00 01 01 01 00 01 00 01 01 01 00 01
1E61: 00 01 00 01 00 01 00 11 10 0F 0E 0D 0C 0B 0A 09
1E71: 08 07 41 42 41 42 45 42 45 47 45 47 6A 60 41 42
1E81: 41 42 45 42 45 47 45 47 6A 60 45 23 24 23 24 23
1E91: 24 23 24 23 24 23 24 23 24 23 24 02 03 05 06 07
1EA1: 08 09 0A 02 03 05 06 07 08 09 0A 02 03 05 06 07
1EB1: 08 09 0A 02 03 05 06 07 08 09 0A E0 08 07 06 05
1EC1: 03 02 08 07 06 05 03 02 02 03 05 06 07 08 09 0A
1ED1: 0B 0C 0D 0E 0F 10 0F 0E 0D 0C 0B 0C 0D E0 02 17
1EE1: 16 01 16 02 03 05 06 07 18 20 07 06 05 03 02 03
1EF1: 06 07 08 09 0A 19 20 0A 09 08 07 08 0A 0B 0C 0D
1F01: 0E 1A 20 0E 0D 0C 0B 0A 0B 0D 0E 0F 10 11 1B 3C
1F11: E0 31 40 43 4F 49 4E 40 31 40 43 52 45 44 49 54
1F21: 40 32 40 43 4F 49 4E 53 40 31 40 43 52 45 44 49
1F31: 54 31 40 43 4F 49 4E 40 32 40 43 52 45 44 49 54
1F41: 53 46 52 45 45 40 50 4C 41 59 40 40 40 40 40 40
1F51: 40 42 4F 4E 55 53 40 40 37 30 30 30 42 4F 4E 55
1F61: 53 40 31 30 30 30 30 42 4F 4E 55 53 40 31 32 30
1F71: 30 30 42 4F 4E 55 53 40 32 30 30 30 30 47 41 4C
1F81: 41 58 49 50 40 32 47 41 4C 41 58 49 50 40 33 00
1F91: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1FA1: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1FB1: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1FC1: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1FD1: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1FE1: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1FF1: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00

; Main-loop entry: clear the score/HUD scratch block (0x40a2-0x40bf), then
; hand off to the free-running per-frame main loop generator.
enterMainLoop:
2000: 21 A2 40        LD      HL,$40A2            ; point at the score/HUD scratch block
2003: 06 1E           LD      B,$1E               ; thirty bytes to clear

loc_2005:
2005: 36 00           LD      (HL),$00            ; zero one scratch byte
2007: 23              INC     HL                  ; next byte
2008: 10 FB           DJNZ    $2005               ; {code.loc_2005} clear the whole score/HUD scratch block

loc_200a:
200A: 26 40           LD      H,$40               ; high byte of the display-list page
200C: 3A A1 40        LD      A,($40A1)           ; {hard.workRam+A1} read the display-list read cursor
200F: 6F              LD      L,A                 ; form the pointer to the current slot
2010: 7E              LD      A,(HL)              ; read the slot's control byte
2011: 87              ADD     A,A                 ; shift bit 7, the free/ready marker, into carry
2012: 30 05           JR      NC,$2019            ; {code.decodeDisplayListSlotAndDispatch} slot holds work -> decode it
2014: CD 67 20        CALL    $2067               ; {code.drawObjectFigureGridColumn} slot free -> run the object-figure grid draw as idle work
2017: 18 F1           JR      $200A               ; {code.loc_200a} loop back to drain the display list

; decode one ready display-list slot (control low nibble selects an even
; draw-handler index), retire both slot bytes, advance and wrap the
; display-list read cursor, then dispatch the selected draw handler
decodeDisplayListSlotAndDispatch:
2019: E6 0F           AND     $0F                 ; keep the channel's low nibble
201B: 4F              LD      C,A                 ; the draw-handler index
201C: 06 00           LD      B,$00               ; high byte of the index zero
201E: 36 FF           LD      (HL),$FF            ; retire this slot's control byte
2020: 2C              INC     L                   ; next byte of the slot
2021: 5E              LD      E,(HL)              ; read the slot's parameter byte
2022: 36 FF           LD      (HL),$FF            ; retire the parameter byte too
2024: 2C              INC     L                   ; advance the read cursor
2025: 7D              LD      A,L                 ; cursor low byte
2026: FE C0           CP      $C0                 ; past the queue body floor at $c0?
2028: 30 02           JR      NC,$202C            ; {code.loc_202c} still in range -> keep it
202A: 3E C0           LD      A,$C0               ; wrap the read cursor back to the queue body floor

loc_202c:
202C: 32 A1 40        LD      ($40A1),A           ; {hard.workRam+A1} store the advanced read cursor
202F: 7B              LD      A,E                 ; the parameter byte into A for the handler
2030: 21 3D 20        LD      HL,$203D            ; point at the draw-handler jump table
2033: 09              ADD     HL,BC               ; index it by the channel
2034: 5E              LD      E,(HL)              ; low byte of the handler address
2035: 23              INC     HL                  ; next
2036: 56              LD      D,(HL)              ; high byte of the handler address
2037: 21 0A 20        LD      HL,$200A            ; load the drain loop as the return address
203A: E5              PUSH    HL                  ; push it so the handler returns into the drain
203B: EB              EX      DE,HL               ; handler address into HL
203C: E9              JP      (HL)                ; jump to the selected draw handler

; ---- $203D-$2054: data ----
203D: 55 20 5E 20 5F 21 A6 21 FE 21 31 22 F1 22 B7 24
204D: E4 7B 73 8E 10 FF FF FF

; Draw-dispatch table entry 0 (jump table 0x203d, dispatched by $202C):
; maps the packed coordinate in A to its tilemap-VRAM cell
; (mapPackedCoordToVram 0x20e1), folds that coord into a frame-timer-
; animated 2-bit tile variant (computeTileVariantFromValueAndTimer 0x2104
; vs frame counter 0x425f), then draws a 2x2 block when coord bit4 is set
; (mapper carry
drawAnimatedTileFigureAtPackedCoord:
2055: CD E1 20        CALL    $20E1               ; {code.mapPackedCoordToVram} map the packed coordinate to its VRAM cell
2058: CD 04 21        CALL    $2104               ; {code.computeTileVariantFromValueAndTimer} fold the coordinate into a frame-animated tile variant
205B: C3 31 21        JP      $2131               ; {code.drawTileGlyphOrBlock} draw the glyph or 2x2 block and return

; Channel-1 display-list draw handler (jump table 0x203d): map the packed
; coordinate to its VRAM cell (mapPackedCoordToVram) and stamp a fixed
; 0x2c-family tile figure there — a 2x2 tile block when coord bit4 is set,
; else a vertical tile pair.
drawFixedTileFigureAtPackedCoord:
205E: CD E1 20        CALL    $20E1               ; {code.mapPackedCoordToVram} map the packed coordinate to its VRAM cell
2061: DA 83 25        JP      C,$2583             ; {code.drawFixedTileBlock2x2} coordinate bit 4 set -> stamp the 2x2 tile block
2064: C3 A7 25        JP      $25A7               ; {code.drawFixedTilePairVertical} else stamp the vertical tile pair

; Object-figure draw head, run as the display-list drain's idle-work step
; (when the queue is free): on FRAME_COUNTER low-nibble phase 0 repaint
; the player-status column (repaintPlayerStatusColumnFromModeGate);
; otherwise, unless OBJECT_DRAW_SUPPRESS bit0 gates it off, index the
; object grid OBJECT_GRID_BASE by that phase and draw its column of six
; rows (stride 0x10) through routeObjectGridCellDraw.
drawObjectFigureGridColumn:
2067: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the free-running frame counter
206A: 47              LD      B,A                 ; keep the raw counter in B
206B: E6 0F           AND     $0F                 ; its low nibble is the object-grid draw phase
206D: 28 2D           JR      Z,$209C             ; {code.repaintPlayerStatusColumnFromModeGate} phase 0 -> repaint the player-status column instead
206F: 21 20 41        LD      HL,$4120            ; point at the object grid base
2072: 85              ADD     A,L                 ; offset to this phase's column
2073: 6F              LD      L,A                 ; form the column pointer
2074: 3A 38 42        LD      A,($4238)           ; {hard.workRam+238} read the object-draw suppress flag
2077: 0F              RRCA                        ; shift its bit 0 into carry
2078: D8              RET     C                   ; draw suppressed -> skip this grid column
2079: 0E 10           LD      C,$10               ; row stride of 16 through the grid
207B: 06 06           LD      B,$06               ; six rows in the column

; One cell of the object-figure grid column: the grid pointer low byte is
; the packed draw coordinate; if the cell flag bit0 is set draw its timer-
; animated figure (drawAnimatedObjectGridCellAndAdvance), else stamp the
; fixed tile figure (drawFixedTileFigureAtPackedCoord) and run the loop
; epilogue objectGridWalkLoopEpilogue over the remaining rows.
routeObjectGridCellDraw:
207D: C5              PUSH    BC                  ; save the row count and stride
207E: E5              PUSH    HL                  ; save the grid cell pointer
207F: 7D              LD      A,L                 ; the cell's low byte is its packed draw coordinate
2080: CB 46           BIT     0,(HL)              ; is this grid cell occupied by a live figure?
2082: 20 05           JR      NZ,$2089            ; {code.drawAnimatedObjectGridCellAndAdvance} occupied -> draw the animated figure
2084: CD 5E 20        CALL    $205E               ; {code.drawFixedTileFigureAtPackedCoord} empty -> stamp the fixed tile figure

; ---- $2087-$2088: data ----
2087: 18 0B

; Animated object-grid cell draw plus the loop tail: map the cell's packed
; coordinate to its VRAM cell, fold FRAME_COUNTER into a 2-bit tile
; variant, stamp the glyph or 2x2 block, then advance the grid pointer by
; the row stride and continue over the remaining rows of the column.
drawAnimatedObjectGridCellAndAdvance:
2089: CD E1 20        CALL    $20E1               ; {code.mapPackedCoordToVram} map the cell's packed coordinate to its VRAM cell
208C: 0E 00           LD      C,$00               ; variant bias zero
208E: CD 1D 21        CALL    $211D               ; {code.computeTileVariantFromTimer} fold the frame counter into a tile variant
2091: CD 31 21        CALL    $2131               ; {code.drawTileGlyphOrBlock} draw the glyph or 2x2 block

; Shared loop epilogue of the object-grid column walk (a second entry
; sharing the drawAnimatedObjectGridCellAndAdvance tail, reached from the
; fixed-figure path): advance the grid pointer by the row stride and loop
; to routeObjectGridCellDraw while rows remain, else return.
objectGridWalkLoopEpilogue:
2094: E1              POP     HL                  ; recover the grid cell pointer
2095: C1              POP     BC                  ; recover the row count and stride
2096: 7D              LD      A,L                 ; cell low byte
2097: 81              ADD     A,C                 ; step down by the row stride
2098: 6F              LD      L,A                 ; advance to the next row's cell
2099: 10 E2           DJNZ    $207D               ; {code.routeObjectGridCellDraw} walk all six rows of the column
209B: C9              RET                         ; column drawn

; Repaint the player-status column while latching the mode gate: when mode
; byte 0x4006 is nonzero, save it into the repaint-gate byte 0x40ab and
; repaint the column; when 0x4006 is zero, repaint only if 0x40ab is
; already set.
repaintPlayerStatusColumnFromModeGate:
209C: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode gate byte
209F: A7              AND     A                   ; test it
20A0: 28 05           JR      Z,$20A7             ; {code.repaintPlayerStatusColumnIfSaved} mode clear -> only repaint if already latched
20A2: 32 AB 40        LD      ($40AB),A           ; {hard.workRam+AB} latch the mode into the repaint-gate byte
20A5: 18 05           JR      $20AC               ; {code.repaintPlayerStatusColumn} go repaint the status column

; Repaint the player-status VRAM column via repaintPlayerStatusColumn, but
; only when the saved status byte 0x40ab is nonzero; a zero saved byte
; returns without painting.
repaintPlayerStatusColumnIfSaved:
20A7: 3A AB 40        LD      A,($40AB)           ; {hard.workRam+AB} read the repaint-gate byte
20AA: A7              AND     A                   ; test it
20AB: C8              RET     Z                   ; not armed -> nothing to repaint

; Repaint the player-status column: select CURRENT_PLAYER's (0x400d)
; status-column VRAM base via selectPlayerStatusVram (0x214e); B bit4
; clear -> paint it (paintPlayerStatusColumn 0x20cd); bit4 set -> blank
; its three cells (tile 16, stride -32) and, when the paired-player flag
; $400E is set, paint the other player's (player^1) column too.
repaintPlayerStatusColumn:
20AC: 3A 0D 40        LD      A,($400D)           ; {hard.workRam+D} read the active player index
20AF: CD 4E 21        CALL    $214E               ; {code.selectPlayerStatusVram} select that player's status-column VRAM base
20B2: 11 E0 FF        LD      DE,$FFE0            ; set the step to -32, one row up per status cell
20B5: CB 60           BIT     4,B                 ; check the blank-vs-paint flag
20B7: 28 14           JR      Z,$20CD             ; {code.paintPlayerStatusColumn} clear -> paint the column
20B9: 3E 10           LD      A,$10               ; the blank tile $10
20BB: 77              LD      (HL),A              ; blank the top status cell
20BC: 19              ADD     HL,DE               ; step up a row
20BD: 77              LD      (HL),A              ; blank the middle status cell
20BE: 19              ADD     HL,DE               ; step up a row
20BF: 77              LD      (HL),A              ; blank the bottom status cell
20C0: 3A 0E 40        LD      A,($400E)           ; {hard.workRam+E} read the paired-player flag
20C3: A7              AND     A                   ; test it
20C4: C8              RET     Z                   ; single player -> done
20C5: 3A 0D 40        LD      A,($400D)           ; {hard.workRam+D} read the active player index again
20C8: EE 01           XOR     $01                 ; flip to the other player
20CA: CD 4E 21        CALL    $214E               ; {code.selectPlayerStatusVram} select the other player's status-column base

; Paint a 3-cell VRAM column from HL stepping by DE (top=code+1, middle
; tile 0x25, bottom tile 0x20) for the player-status indicator; then, only
; when flags(B) bit4 is clear and gate 0x4006==0, clear status flag
; 0x40ab.
paintPlayerStatusColumn:
20CD: 3C              INC     A                   ; top cell tile is code+1
20CE: 77              LD      (HL),A              ; paint the top status cell
20CF: 19              ADD     HL,DE               ; step up a row
20D0: 36 25           LD      (HL),$25            ; paint the middle status tile $25
20D2: 19              ADD     HL,DE               ; step up a row
20D3: 36 20           LD      (HL),$20            ; paint the bottom status tile $20
20D5: CB 60           BIT     4,B                 ; check the blank-vs-paint flag
20D7: C0              RET     NZ                  ; blank branch -> done
20D8: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode gate byte
20DB: A7              AND     A                   ; test it
20DC: C0              RET     NZ                  ; mode set -> leave the gate latched
20DD: 32 AB 40        LD      ($40AB),A           ; {hard.workRam+AB} clear the repaint-gate byte
20E0: C9              RET                         ; status column painted

; Map a packed coordinate byte to a tilemap-VRAM cell address (VRAM_BASE +
; (high<<8) + low)..5, carry=coord bit 4 (callers branch on it).
mapPackedCoordToVram:
20E1: 47              LD      B,A                 ; keep the packed coordinate in B
20E2: E6 0F           AND     $0F                 ; take the low nibble of the coordinate
20E4: 0F              RRCA                        ; rotate it toward its field position
20E5: 0F              RRCA                        ; rotate again
20E6: 4F              LD      C,A                 ; stash the partial
20E7: E6 03           AND     $03                 ; top two bits give the VRAM page high byte
20E9: 67              LD      H,A                 ; high byte of the cell address
20EA: 79              LD      A,C                 ; recover the partial
20EB: E6 C0           AND     $C0                 ; mask the low bits for the cell within the page
20ED: 6F              LD      L,A                 ; seed the low byte
20EE: 78              LD      A,B                 ; back to the full coordinate
20EF: 0F              RRCA                        ; shift the high nibble down
20F0: 0F              RRCA                        ; shift
20F1: 0F              RRCA                        ; shift
20F2: 0F              RRCA                        ; high nibble now sits in the low bits
20F3: E6 07           AND     $07                 ; keep three bits of it -- the column
20F5: 4F              LD      C,A                 ; the column count
20F6: 1F              RRA                         ; shift, staging a carry
20F7: F5              PUSH    AF                  ; save that carry for the caller to branch on
20F8: 89              ADC     A,C                 ; fold the carry back in
20F9: 2F              CPL                         ; complement to flip the column into place
20FA: E6 0F           AND     $0F                 ; keep the low nibble
20FC: 85              ADD     A,L                 ; merge into the cell low byte
20FD: 6F              LD      L,A                 ; finished low byte
20FE: 11 00 50        LD      DE,$5000            ; the tilemap VRAM base
2101: 19              ADD     HL,DE               ; offset the cell into VRAM
2102: F1              POP     AF                  ; restore the coordinate-bit carry for the caller
2103: C9              RET                         ; HL now names the VRAM cell

; register-compute: bias a value (B) into a timer-animated 2-bit tile-
; variant index -- saturate to the 0x80 out-of-range marker at/above 112,
; else fold the value's low nibble with a carry set when the frame counter
; (0x425f) low nibble is smaller, via computeTileVariantFromTimer
; (0x211d).
computeTileVariantFromValueAndTimer:
2104: F5              PUSH    AF                  ; save flags across the compute
2105: 78              LD      A,B                 ; the value to bias
2106: FE 70           CP      $70                 ; is it at or above 112, out of range?
2108: 38 04           JR      C,$210E             ; {code.loc_210e} in range -> fold it with the timer

; Clamp's out-of-range arm: forces the fold index B to the fixed 0x80
; sentinel when the input is beyond range.
markValueOutOfRange:
210A: 06 80           LD      B,$80               ; force the out-of-range tile sentinel $80
210C: F1              POP     AF                  ; restore flags
210D: C9              RET                         ; done

loc_210e:
210E: E6 0F           AND     $0F                 ; keep the value's low nibble
2110: 47              LD      B,A                 ; stash it
2111: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the frame counter
2114: E6 0F           AND     $0F                 ; take its low nibble
2116: 0E 00           LD      C,$00               ; carry-in zero
2118: B8              CP      B                   ; compare the timer nibble against the value
2119: 30 01           JR      NC,$211C            ; {code.loc_211c} timer nibble is not smaller -> no borrow
211B: 0D              DEC     C                   ; timer nibble smaller -> set the carry-in to -1

loc_211c:
211C: F1              POP     AF                  ; drop the extra word off the stack, then fall into the tile-variant fold

; Fold register B to a 2-bit tile-variant index = (nibble-swap(per-frame
; counter FRAME_COUNTER)+B+C)&3, or saturate to the 0x80 out-of-range
; sentinel via markValueOutOfRange when B>=112; leaves A/flags unchanged.
computeTileVariantFromTimer:
211D: F5              PUSH    AF                  ; save the caller's accumulator while B is folded into an animated tile-variant index
211E: 78              LD      A,B                 ; copy the candidate index B into A to range-check it
211F: FE 70           CP      $70                 ; compare it against 112, the out-of-range cutoff
2121: 30 E7           JR      NC,$210A            ; {code.markValueOutOfRange} B at or above 112 is out of range -- jump off to pin the index to the $80 marker
2123: 3A 5F 42        LD      A,($425F)           ; {hard.workRam+25F} read the free-running per-frame counter
2126: 0F              RRCA                        ; rotate the frame counter right one bit
2127: 0F              RRCA                        ; rotate again
2128: 0F              RRCA                        ; rotate again
2129: 0F              RRCA                        ; four rotates swap the frame counter's nibbles
212A: 80              ADD     A,B                 ; add the candidate index B into the animated base
212B: 81              ADD     A,C                 ; add C on top
212C: E6 03           AND     $03                 ; keep the low two bits -- the 0..3 tile-variant this frame
212E: 47              LD      B,A                 ; hand the variant back in B
212F: F1              POP     AF                  ; restore the caller's accumulator untouched
2130: C9              RET                         ; return with B holding the tile variant

; Tile-figure draw dispatch keyed on carry: carry set stamps a 2x2 tile
; block selected by B (drawSelectedTileBlockOrFallback, fallback tile 0xa4
; when B negative); carry clear fetches B's tile code from table 0x2157
; and paints a double-height glyph at HL (drawDoubleHeightTile).
drawTileGlyphOrBlock:
2131: EB              EX      DE,HL               ; the VRAM destination arriving in DE becomes the draw pointer HL
2132: 38 09           JR      C,$213D             ; {code.drawSelectedTileBlockOrFallback} carry set means stamp a 2x2 tile block instead of a glyph
2134: 21 57 21        LD      HL,$2157            ; point at the glyph tile-code table
2137: 78              LD      A,B                 ; index it by the selector B
2138: E7              RST     $20                 ; fetch the B-th tile code from the table
2139: EB              EX      DE,HL               ; put the VRAM cell back in HL for the draw
213A: C3 A9 25        JP      $25A9               ; {code.drawDoubleHeightTile} paint the double-height glyph at that cell

; Select a 2x2 tile block by the signed selector B: non-negative -> look
; the block up in the tile-block table by that index and stamp it at the
; pending DE destination; negative -> stamp the fixed fallback block (tile
; 0xa4) there.
drawSelectedTileBlockOrFallback:
213D: 78              LD      A,B                 ; copy the signed block selector B
213E: A7              AND     A                   ; test its sign
213F: F2 46 21        JP      P,$2146             ; {code.drawIndexedTileBlock} non-negative selector -- look the tile block up by index
2142: 3E A4           LD      A,$A4               ; negative selector -- use the fixed fallback tile $a4
2144: 18 04           JR      $214A               ; {code.drawTileBlock2x2AtDe} go stamp the 2x2 block

; Look up a 2x2 tile-block code in TILE_BLOCK_TABLE (0x215b) by index,
; then stamp that block at the pending VRAM destination via
; drawTileBlock2x2AtDe.
drawIndexedTileBlock:
2146: 21 5B 21        LD      HL,$215B            ; point at the ROM tile-block table
2149: E7              RST     $20                 ; fetch this index's 2x2 tile-block code

; DE-entry adapter over drawTileBlock2x2: ex de,hl so the pointer arriving
; in DE becomes the draw destination (old HL handed back in DE), then
; stamp a 2x2 tile block from the seed tile in A at that VRAM cell.
drawTileBlock2x2AtDe:
214A: EB              EX      DE,HL               ; bring the pending VRAM destination (in DE) into HL to draw at
214B: C3 85 25        JP      $2585               ; {code.drawTileBlock2x2} stamp a 2x2 tile block from the seed tile in A

; Selects a player's status-column VRAM base (player 1 -> 0x5340, else
; player 2 -> 0x50e0), returned in HL.
selectPlayerStatusVram:
214E: 21 40 53        LD      HL,$5340            ; default to the player-1 status-column VRAM base
2151: A7              AND     A                   ; test the player index
2152: C8              RET     Z                   ; player 1 -- keep the 0x5340 base and return
2153: 21 E0 50        LD      HL,$50E0            ; otherwise point at the player-2 status-column VRAM base
2156: C9              RET                         ; return that status-column base

; ---- $2157-$215E: data ----
2157: 41 35 41 31 44 38 44 3C

; Display-list channel-2 handler: draw one of three 4x4-tile forms at a
; fixed VRAM region selected by the command arg -- form 0 blanks the block
; then overlays a 2x2 icon (blank4x4AndDraw2x2Icon 0x219b), form 1 just
; blanks it (blankTileBlock4x4 0x2187), else fold (form-2) into a
; complemented tile code over base 0xc0 and stamp four 2x2 tile blocks at
; 0x51da/0x51dc/0x521a/0x521c (a contiguous 4x4 cell region, seed +4 per
; block, via drawTileBlock2x2 0x2585).
draw4x4TileForm:
215F: A7              AND     A                   ; test the form selector
2160: 28 39           JR      Z,$219B             ; {code.blank4x4AndDraw2x2Icon} form 0 -- blank the 4x4 block then overlay a 2x2 icon
2162: 3D              DEC     A                   ; drop to form 1
2163: 28 22           JR      Z,$2187             ; {code.blankTileBlock4x4} form 1 -- just blank the 4x4 block
2165: 3D              DEC     A                   ; otherwise it is form 2, the folded tile-code form
2166: 87              ADD     A,A                 ; shift the value left one bit
2167: 87              ADD     A,A                 ; shift again
2168: 87              ADD     A,A                 ; shift again
2169: 87              ADD     A,A                 ; four doublings move the low nibble up into the high nibble
216A: 2F              CPL                         ; complement it
216B: E6 30           AND     $30                 ; keep the two form bits
216D: C6 C0           ADD     A,$C0               ; bias over tile base $c0 to form the block tile code
216F: 21 DA 51        LD      HL,$51DA            ; aim at the first 2x2 block cell
2172: CD 85 25        CALL    $2585               ; {code.drawTileBlock2x2} stamp the first block
2175: 21 DC 51        LD      HL,$51DC            ; aim at the second block cell (seed advanced +4)
2178: CD 85 25        CALL    $2585               ; {code.drawTileBlock2x2} stamp the second 2x2 block
217B: 21 1A 52        LD      HL,$521A            ; aim at the third block cell
217E: CD 85 25        CALL    $2585               ; {code.drawTileBlock2x2} stamp the third block
2181: 21 1C 52        LD      HL,$521C            ; aim at the last block cell
2184: C3 85 25        JP      $2585               ; {code.drawTileBlock2x2} stamp the last block and return

; Blank a 4x4 tile block in VRAM at 0x51da, writing BLANK_TILE(0x40) to
; four rows of four cells (row start stride 32).
blankTileBlock4x4:
2187: 21 DA 51        LD      HL,$51DA            ; point at the top-left of the 4x4 tile region
218A: 11 1C 00        LD      DE,$001C            ; the row-advance step (28) that jumps to the next row of four
218D: 0E 04           LD      C,$04               ; four rows of tiles to blank

loc_218f:
218F: 06 04           LD      B,$04               ; four cells across this row

loc_2191:
2191: 36 40           LD      (HL),$40            ; write the blank tile $40 into this cell
2193: 23              INC     HL                  ; step to the next cell
2194: 10 FB           DJNZ    $2191               ; {code.loc_2191} repeat across the four cells of the row
2196: 19              ADD     HL,DE               ; jump the cursor to the next row's start
2197: 0D              DEC     C                   ; one fewer row left
2198: 20 F5           JR      NZ,$218F            ; {code.loc_218f} repeat for all four rows
219A: C9              RET                         ; the 4x4 block is blanked -- return

; Indicator form 0: clear the 4x4 tile block (blankTileBlock4x4) then
; overlay a 2x2 icon seeded with tile 96 at $51FC.
blank4x4AndDraw2x2Icon:
219B: CD 87 21        CALL    $2187               ; {code.blankTileBlock4x4} blank the 4x4 block first
219E: 3E 60           LD      A,$60               ; seed tile 96 for the icon
21A0: 21 FC 51        LD      HL,$51FC            ; aim at the icon's VRAM cell
21A3: C3 85 25        JP      $2585               ; {code.drawTileBlock2x2} stamp the 2x2 icon and return

; add this score type's packed-BCD increment into the current player's
; score, award the bonus marker at the threshold, repaint the score
; digits, and promote the high score when beaten
addBcdScoreIncrementAndUpdateHighScore:
21A6: 4F              LD      C,A                 ; save the score-type index in C
21A7: CF              RST     $08                 ; fire the RST-08 page-zero helper before folding in the score
21A8: CD 90 22        CALL    $2290               ; {code.selectCurrentPlayerScore} select the current player's 3-byte packed-BCD score field into DE
21AB: 79              LD      A,C                 ; recover the score-type index
21AC: 81              ADD     A,C                 ; add it again
21AD: 81              ADD     A,C                 ; times three -- each score-increment entry is three bytes
21AE: 4F              LD      C,A                 ; the byte offset into C
21AF: 06 00           LD      B,$00               ; clear B so BC is the 16-bit offset
21B1: 21 D0 22        LD      HL,$22D0            ; point at the ROM score-increment table
21B4: 09              ADD     HL,BC               ; index to this score type's 3-byte increment
21B5: A7              AND     A                   ; clear carry before the running BCD add
21B6: 06 03           LD      B,$03               ; three packed-BCD bytes to add

loc_21b8:
21B8: 1A              LD      A,(DE)              ; read one byte of the current score
21B9: 8E              ADC     A,(HL)              ; add the matching increment byte with carry
21BA: 27              DAA                         ; decimal-adjust to keep the digit pair packed BCD
21BB: 12              LD      (DE),A              ; store the summed digit pair back
21BC: 13              INC     DE                  ; next score byte
21BD: 23              INC     HL                  ; next increment byte
21BE: 10 F8           DJNZ    $21B8               ; {code.loc_21b8} repeat for all three BCD bytes
21C0: 1B              DEC     DE                  ; step back to the score's top byte
21C1: D5              PUSH    DE                  ; save the score pointer
21C2: 1B              DEC     DE                  ; step down to the mid byte
21C3: 67              LD      H,A                 ; the top score byte into H
21C4: 1A              LD      A,(DE)              ; read the mid score byte
21C5: 6F              LD      L,A                 ; into L -- HL holds the score's top two bytes
21C6: 29              ADD     HL,HL               ; double it
21C7: 29              ADD     HL,HL               ; double again
21C8: 29              ADD     HL,HL               ; double again
21C9: 29              ADD     HL,HL               ; four doublings scale the score's high word
21CA: 7C              LD      A,H                 ; take the high byte of the scaled score
21CB: 21 AC 40        LD      HL,$40AC            ; point at the bonus-award score threshold byte
21CE: BE              CP      (HL)                ; compare the scaled score against the threshold
21CF: D4 9C 22        CALL    NC,$229C            ; {code.awardBonusMarker} at or over the threshold -- award the one-shot bonus marker
21D2: 13              INC     DE                  ; step back up to the score's top byte for the repaint
21D3: 3A 0D 40        LD      A,($400D)           ; {hard.workRam+D} read the active player index
21D6: CD 56 22        CALL    $2256               ; {code.drawScoreToSelectedPlayerField} repaint that player's score digits into VRAM
21D9: D1              POP     DE                  ; restore the score pointer
21DA: 21 AA 40        LD      HL,$40AA            ; point at the top byte of the high score
21DD: 06 03           LD      B,$03               ; three bytes to compare, top-down

loc_21df:
21DF: 1A              LD      A,(DE)              ; read the player's score byte
21E0: BE              CP      (HL)                ; compare it against the high-score byte
21E1: D8              RET     C                   ; player's score is lower -- no new record, return
21E2: 20 05           JR      NZ,$21E9            ; {code.loc_21e9} player's score is higher -- go copy it into the high score
21E4: 1B              DEC     DE                  ; equal so far -- step both pointers down a byte
21E5: 2B              DEC     HL                  ; step the high-score pointer down too
21E6: 10 F7           DJNZ    $21DF               ; {code.loc_21df} compare the next byte
21E8: C9              RET                         ; all three equal -- no new record, return

loc_21e9:
21E9: CD 90 22        CALL    $2290               ; {code.selectCurrentPlayerScore} reselect the current player's score field into DE
21EC: 21 A8 40        LD      HL,$40A8            ; point at the high-score field
21EF: 06 03           LD      B,$03               ; three bytes to copy

loc_21f1:
21F1: 1A              LD      A,(DE)              ; read a score byte
21F2: 77              LD      (HL),A              ; store it into the high score
21F3: 13              INC     DE                  ; next score byte
21F4: 23              INC     HL                  ; next high-score byte
21F5: 10 FA           DJNZ    $21F1               ; {code.loc_21f1} copy all three bytes
21F7: 1B              DEC     DE                  ; step back to the score's top byte

; Paint the high-score number: set the VRAM cursor to field 0x5241 and
; draw 6 packed-BCD digits from the caller's source pointer
; (drawBcdNumberColumn); reached from the high-score update tail
; addBcdScoreIncrementAndUpdateHighScore (after a higher total is copied
; to 0x40a8) and the opcode-5 high-score redraw drawScoreFieldByIndex.
drawHighScoreDigits:
21F8: DD 21 41 52     LD      IX,$5241            ; aim the digit cursor at the high-score VRAM field
21FC: 18 63           JR      $2261               ; {code.drawBcdNumberColumn} paint the six BCD digits up that column

; Clear the packed-BCD score field selected by index A (0=P1 0x40a2, 1=P2
; 0x40a5, 2=high 0x40a8) -- zero its three digit bytes plus the per-player
; bonus companion (0x40ad/0x40ae; high score re-zeros its own first byte)
; -- then repaint via drawScoreFieldByIndex; index>=3 descends over all
; lower fields.
clearAndRedrawScoreField:
21FE: FE 03           CP      $03                 ; is the field index 3 or more?
2200: 30 26           JR      NC,$2228            ; {code.loc_2228} yes -- descend and clear every lower field
2202: F5              PUSH    AF                  ; save the field index
2203: 21 A2 40        LD      HL,$40A2            ; default to the player-1 score field
2206: 11 AD 40        LD      DE,$40AD            ; and its bonus-marker companion cell
2209: A7              AND     A                   ; test index 0
220A: 28 0E           JR      Z,$221A             ; {code.loc_221a} index 0 -- player-1 field selected, go clear it
220C: 21 A5 40        LD      HL,$40A5            ; index 1 -- point at the player-2 score field
220F: 11 AE 40        LD      DE,$40AE            ; its bonus-marker companion cell
2212: 3D              DEC     A                   ; drop toward index 1
2213: 28 05           JR      Z,$221A             ; {code.loc_221a} index 1 confirmed -- go clear it
2215: 21 A8 40        LD      HL,$40A8            ; otherwise index 2 -- the high-score field
2218: 5D              LD      E,L                 ; aim the companion pointer at the same high-score field
2219: 54              LD      D,H                 ; both halves of DE now point at the high-score field

loc_221a:
221A: 36 00           LD      (HL),$00            ; zero the field's first score byte
221C: 23              INC     HL                  ; step to the next byte
221D: 36 00           LD      (HL),$00            ; zero the second byte
221F: 23              INC     HL                  ; step to the next byte
2220: 36 00           LD      (HL),$00            ; zero the third byte
2222: EB              EX      DE,HL               ; switch to the bonus-marker companion cell
2223: 36 00           LD      (HL),$00            ; zero it too
2225: F1              POP     AF                  ; recover the field index
2226: 18 09           JR      $2231               ; {code.drawScoreFieldByIndex} go repaint that field's digits

loc_2228:
2228: 3D              DEC     A                   ; step down to the next lower field index
2229: F5              PUSH    AF                  ; save it
222A: CD FE 21        CALL    $21FE               ; {code.clearAndRedrawScoreField} clear and redraw that lower field
222D: F1              POP     AF                  ; recover the index
222E: C8              RET     Z                   ; reached field 0 -- done
222F: 18 F7           JR      $2228               ; {code.loc_2228} otherwise keep descending

; Redraw the packed-BCD score column selected by counter index: 0 ->
; player-1 score (primary field), 1 -> player-2 score (drawn only when the
; live flag 0x400e is set, which also picks the alt field), 2 -> high
; score; index >=3 recurses down, redrawing every field from index-1 to 0.
drawScoreFieldByIndex:
2231: FE 03           CP      $03                 ; is the field index 3 or more?
2233: 30 18           JR      NC,$224D            ; {code.loc_224d} yes -- descend and redraw every lower field
2235: A7              AND     A                   ; test index 0
2236: 11 A4 40        LD      DE,$40A4            ; point at the player-1 score (top byte for the up-column draw)
2239: 28 1B           JR      Z,$2256             ; {code.drawScoreToSelectedPlayerField} index 0 -- draw the player-1 score
223B: 3D              DEC     A                   ; drop toward index 1
223C: 20 0A           JR      NZ,$2248            ; {code.loc_2248} not index 1 -- it must be index 2, the high score
223E: 3A 0E 40        LD      A,($400E)           ; {hard.workRam+E} index 1 -- read the two-player-active flag
2241: A7              AND     A                   ; test it
2242: C8              RET     Z                   ; no second player -- skip drawing the player-2 score
2243: 11 A7 40        LD      DE,$40A7            ; point at the player-2 score (top byte)
2246: 18 0E           JR      $2256               ; {code.drawScoreToSelectedPlayerField} draw the player-2 score

loc_2248:
2248: 11 AA 40        LD      DE,$40AA            ; index 2 -- point at the high-score field (top byte)
224B: 18 AB           JR      $21F8               ; {code.drawHighScoreDigits} draw the high-score digits

loc_224d:
224D: 3D              DEC     A                   ; step down to the next lower field index
224E: F5              PUSH    AF                  ; save it
224F: CD 31 22        CALL    $2231               ; {code.drawScoreFieldByIndex} redraw that lower field
2252: F1              POP     AF                  ; recover the index
2253: C8              RET     Z                   ; reached field 0 -- done
2254: 18 F7           JR      $224D               ; {code.loc_224d} otherwise keep descending

; select the VRAM score-digit field cursor by selector A (0 ->
; DIGIT_FIELD_PRIMARY 0x5381, else DIGIT_FIELD_ALT 0x5121), then paint the
; packed-BCD number column (source DE) into it via drawBcdNumberColumn
; (0x2261). No work-RAM write.
drawScoreToSelectedPlayerField:
2256: DD 21 81 53     LD      IX,$5381            ; default the digit cursor to the primary-player score field
225A: A7              AND     A                   ; test the field selector
225B: 28 04           JR      Z,$2261             ; {code.drawBcdNumberColumn} selector 0 -- use the primary field
225D: DD 21 21 51     LD      IX,$5121            ; otherwise use the alternate-player score field

; Paint three packed-BCD bytes (walked downward from the DE source) as six
; digit tiles up the IX VRAM column -- high nibble then low per byte,
; stepping the cursor one row up (-32) per digit -- with a 4-digit
; leading-zero blank budget via drawBcdDigit; callers point it at the
; score/high-score VRAM fields.
drawBcdNumberColumn:
2261: 21 E0 FF        LD      HL,$FFE0            ; the per-digit cursor step -- up one tilemap row (-32)
2264: EB              EX      DE,HL               ; DE holds the -32 step, HL the packed-BCD source pointer
2265: 06 03           LD      B,$03               ; three packed-BCD bytes to paint
2267: 0E 04           LD      C,$04               ; four-digit leading-zero blanking budget

loc_2269:
2269: 7E              LD      A,(HL)              ; read a packed-BCD byte
226A: 0F              RRCA                        ; rotate the high nibble down
226B: 0F              RRCA                        ; rotate again
226C: 0F              RRCA                        ; rotate again
226D: 0F              RRCA                        ; four rotates bring the high nibble into the low nibble
226E: CD 79 22        CALL    $2279               ; {code.drawBcdDigit} paint that high digit
2271: 7E              LD      A,(HL)              ; re-read the byte for its low nibble
2272: CD 79 22        CALL    $2279               ; {code.drawBcdDigit} paint the low digit
2275: 2B              DEC     HL                  ; step to the next lower BCD byte
2276: 10 F1           DJNZ    $2269               ; {code.loc_2269} repeat for all three bytes
2278: C9              RET                         ; the score column is painted -- return

; Paints one BCD digit as a font tile (digit+0x90) with leading-zero
; blanking, then advances the cursor.
drawBcdDigit:
2279: E6 0F           AND     $0F                 ; isolate the single digit
227B: 28 04           JR      Z,$2281             ; {code.loc_2281} digit is zero -- maybe blank it as a leading zero
227D: 0E 00           LD      C,$00               ; nonzero digit ends leading-zero blanking
227F: 18 07           JR      $2288               ; {code.loc_2288} go paint the digit

loc_2281:
2281: 79              LD      A,C                 ; check the leading-zero budget
2282: A7              AND     A                   ; test it
2283: 28 03           JR      Z,$2288             ; {code.loc_2288} budget spent -- paint the zero normally
2285: 3E 80           LD      A,$80               ; still leading zeros -- force a blank-tile seed
2287: 0D              DEC     C                   ; consume one from the leading-zero budget

loc_2288:
2288: C6 90           ADD     A,$90               ; bias the digit into its font tile code
228A: DD 77 00        LD      (IX+$00),A          ; write the digit tile into the VRAM cell
228D: DD 19           ADD     IX,DE               ; step the cursor up one tilemap row
228F: C9              RET                         ; digit drawn -- return

; Selects the current player's 3-byte packed-BCD score field (player 1 ->
; 0x40a2, else player 2 -> 0x40a5), returned in DE.
selectCurrentPlayerScore:
2290: 11 A2 40        LD      DE,$40A2            ; default DE to the player-1 packed-BCD score field
2293: 3A 0D 40        LD      A,($400D)           ; {hard.workRam+D} read the active player index
2296: A7              AND     A                   ; test it
2297: C8              RET     Z                   ; player 1 -- keep the player-1 score field
2298: 11 A5 40        LD      DE,$40A5            ; player 2 -- point at the player-2 score field
229B: C9              RET                         ; return DE at the selected score field

; One-shot per current player (guard flag table 0x40ad indexed by
; CURRENT_PLAYER 0x400d): on the first score-threshold trip flag the
; player's slot, raise sound-envelope trigger 0x41c7=1, increment marker
; counter 0x421d, and repaint the marker row (drawMarkerRow).
awardBonusMarker:
229C: 3A 0D 40        LD      A,($400D)           ; {hard.workRam+D} read the active player index
229F: 21 AD 40        LD      HL,$40AD            ; base of the per-player bonus-marker one-shot flags
22A2: 85              ADD     A,L                 ; index by the player
22A3: 6F              LD      L,A                 ; HL now points at this player's marker flag
22A4: CB 46           BIT     0,(HL)              ; has this player's bonus already been awarded?
22A6: C0              RET     NZ                  ; yes -- one-shot, do nothing
22A7: 36 01           LD      (HL),$01            ; mark this player's bonus as awarded
22A9: 3E 01           LD      A,$01               ; load 1
22AB: 32 C7 41        LD      ($41C7),A           ; {hard.workRam+1C7} raise the bonus-sound envelope trigger
22AE: 21 1D 42        LD      HL,$421D            ; point at the bonus-marker counter
22B1: 34              INC     (HL)                ; bump the marker count
22B2: 46              LD      B,(HL)              ; load the new count into B for the marker-row repaint

; Redraw the 5-slot marker row at MARKER_ROW_VRAM (0x539e): paint
; `markers` marker tiles (102) growing upward, then blank the remaining
; slots until the signed slot counter goes negative; when OBJ_ACTIVE_FLAG
; (0x4200) is set the displayed count is dropped by one, and if that
; empties it every slot is blanked instead.
drawMarkerRow:
22B3: 21 9E 53        LD      HL,$539E            ; point HL at the 5-slot marker row in VRAM at 0x539e
22B6: 0E 05           LD      C,$05               ; C counts the five marker-row slots
22B8: 3A 00 42        LD      A,($4200)           ; {hard.workRam+200} read the object-active flag 0x4200 -- is a round in progress
22BB: A7              AND     A                   ; test it
22BC: 28 03           JR      Z,$22C1             ; {code.loc_22c1} not in play -- draw the full marker count untouched
22BE: 05              DEC     B                   ; round live: drop the displayed marker count by one
22BF: 28 08           JR      Z,$22C9             ; {code.loc_22c9} if that emptied the count, blank every slot instead

loc_22c1:
22C1: 3E 66           LD      A,$66               ; A holds the marker glyph, tile 0x66
22C3: CD 93 25        CALL    $2593               ; {code.drawTileBlock2x2Up} stamp a 2x2 marker block growing upward into this slot
22C6: 0D              DEC     C                   ; one row slot consumed
22C7: 10 F8           DJNZ    $22C1               ; {code.loc_22c1} loop, one marker block per counted marker

loc_22c9:
22C9: 0D              DEC     C                   ; step to the next slot
22CA: F8              RET     M                   ; stop once the slot counter runs past the end
22CB: CD 91 25        CALL    $2591               ; {code.drawFixedTileBlock2x2Up} blank this leftover slot with the filler 2x2 block
22CE: 18 F9           JR      $22C9               ; {code.loc_22c9} loop, blanking the remaining marker slots

; ---- $22D0-$22F0: data ----
22D0: 30 00 00 40 00 00 50 00 00 60 00 00 60 00 00 80
22E0: 00 00 00 01 00 50 01 00 00 02 00 00 03 00 00 08
22F0: 00

; Message painter indexed by A: bit7 blanks the text column, bit6 records
; dest/text/cursor pointers + clears the column + arms
; MESSAGE_SCROLL_ENABLE, else draws each glyph up the column (stride -32)
; to the 63 terminator.
renderMessageColumn:
22F1: 21 5C 23        LD      HL,$235C            ; point HL at the message-pointer table at 0x235c
22F4: 87              ADD     A,A                 ; double the message index -- two-byte table entries, and float the mode bits into carry/sign
22F5: F5              PUSH    AF                  ; stash the doubled index and its mode flags
22F6: E6 3F           AND     $3F                 ; mask off the mode bits, keeping just the table offset
22F8: 5F              LD      E,A                 ; low byte of the offset
22F9: 16 00           LD      D,$00               ; high byte is zero
22FB: 19              ADD     HL,DE               ; index into the message-pointer table
22FC: 5E              LD      E,(HL)              ; fetch the entry's low byte
22FD: 23              INC     HL                  ; step to the high byte
22FE: 56              LD      D,(HL)              ; fetch the entry's high byte -- DE now points at the message descriptor
22FF: EB              EX      DE,HL               ; move that descriptor pointer into HL
2300: 5E              LD      E,(HL)              ; read the descriptor's dest-cell low byte
2301: 23              INC     HL                  ; step forward
2302: 56              LD      D,(HL)              ; read the dest-cell high byte -- DE is the VRAM destination cell
2303: 23              INC     HL                  ; step past to the glyph text bytes
2304: EB              EX      DE,HL               ; HL becomes the VRAM destination, DE the text source
2305: 01 E0 FF        LD      BC,$FFE0            ; BC is -32, the stride that walks one tile row up the column
2308: F1              POP     AF                  ; recover the doubled index and mode flags
2309: 38 0E           JR      C,$2319             ; {code.loc_2319} original bit7 set -- go blank the text column
230B: FA 23 23        JP      M,$2323             ; {code.loc_2323} original bit6 set -- go record the pointers and arm the scroller

loc_230e:
230E: 1A              LD      A,(DE)              ; read the next glyph byte from the text
230F: D6 30           SUB     $30                 ; shift the character code down to its tile index
2311: FE 0F           CP      $0F                 ; is this the end-of-text terminator
2313: C8              RET     Z                   ; yes -- the column is done
2314: 77              LD      (HL),A              ; poke the glyph tile into the current VRAM cell
2315: 13              INC     DE                  ; step to the next glyph
2316: 09              ADD     HL,BC               ; move up one tile row
2317: 18 F5           JR      $230E               ; {code.loc_230e} loop for the rest of the column

loc_2319:
2319: 1A              LD      A,(DE)              ; read the next source byte
231A: FE 3F           CP      $3F                 ; is this the terminator
231C: C8              RET     Z                   ; yes -- the blanking pass is done
231D: 36 40           LD      (HL),$40            ; write the blank tile 0x40 into this cell
231F: 13              INC     DE                  ; step to the next source byte
2320: 09              ADD     HL,BC               ; move up one tile row
2321: 18 F6           JR      $2319               ; {code.loc_2319} loop, blanking the rest of the column

loc_2323:
2323: 22 B5 40        LD      ($40B5),HL          ; {hard.workRam+B5} stash the VRAM destination cell into the scroller dest pointer 0x40b5
2326: EB              EX      DE,HL               ; swap so HL holds the text source
2327: 22 B3 40        LD      ($40B3),HL          ; {hard.workRam+B3} stash the text source into the scroller text pointer 0x40b3
232A: 7B              LD      A,E                 ; low byte of the destination cell
232B: E6 1F           AND     $1F                 ; keep the column position within the 32-wide row
232D: 47              LD      B,A                 ; B holds that column
232E: 87              ADD     A,A                 ; double the column
232F: C6 20           ADD     A,$20               ; add 32
2331: 6F              LD      L,A                 ; form the low byte of the cursor cell address
2332: 26 40           LD      H,$40               ; high byte 0x40 -- the cursor lives in work RAM
2334: 22 B1 40        LD      ($40B1),HL          ; {hard.workRam+B1} stash the cursor into the scroller cursor pointer 0x40b1
2337: E5              PUSH    HL                  ; save the cursor address
2338: CB 3B           SRL     E                   ; halve the low bits
233A: CB 3B           SRL     E                   ; halve again
233C: 7A              LD      A,D                 ; high byte of the destination
233D: E6 03           AND     $03                 ; keep its low two bits
233F: 0F              RRCA                        ; rotate them up toward the top of the byte
2340: 0F              RRCA                        ; rotate again
2341: B3              OR      E                   ; fold in the shifted low part
2342: E6 F8           AND     $F8                 ; mask to the row-aligned start value
2344: 4F              LD      C,A                 ; C holds the scroller's starting tile value
2345: 21 00 50        LD      HL,$5000            ; point HL at the VRAM base 0x5000
2348: 78              LD      A,B                 ; add the column
2349: 85              ADD     A,L                 ; fold it into the pointer
234A: 6F              LD      L,A                 ; HL now points at the top of the message column
234B: 11 20 00        LD      DE,$0020            ; stride of +32, one tile row down
234E: 43              LD      B,E                 ; B counts 32 rows down the column

loc_234f:
234F: 36 10           LD      (HL),$10            ; blank this column cell with tile 0x10
2351: 19              ADD     HL,DE               ; step down one row
2352: 10 FB           DJNZ    $234F               ; {code.loc_234f} loop down the whole column
2354: E1              POP     HL                  ; recover the cursor cell address
2355: 71              LD      (HL),C              ; seed the cursor cell with the scroller's starting value
2356: 3E 01           LD      A,$01               ; arm value 1
2358: 32 B0 40        LD      ($40B0),A           ; {hard.workRam+B0} raise the message-scroller enable flag 0x40b0
235B: C9              RET                         ; done -- the scroller is armed

; ---- $235C-$24B6: data ----
235C: 7E 23 8B 23 9F 23 AC 23 B9 23 C6 23 D1 23 EF 23
236C: 01 24 1B 24 35 24 4C 24 61 24 76 24 8B 24 A0 24
237C: AB 24 96 52 47 41 4D 45 40 40 4F 56 45 52 3F F1
238C: 52 50 55 53 48 40 53 54 41 52 54 40 42 55 54 54
239C: 4F 4E 3F 94 52 50 4C 41 59 45 52 40 30 4E 45 3F
23AC: 94 52 50 4C 41 59 45 52 40 54 57 4F 3F 80 52 48
23BC: 49 47 48 40 53 43 4F 52 45 3F 7F 53 43 52 45 44
23CC: 49 54 40 40 3F 98 53 42 4F 4E 55 53 40 47 41 4C
23DC: 41 58 49 50 40 46 4F 52 40 40 40 30 30 30 40 D0
23EC: D1 D2 3F D1 52 43 4F 4E 56 4F 59 40 40 43 48 41
23FC: 52 47 45 52 3F 4F 53 5B 40 53 43 4F 52 45 40 41
240C: 44 56 41 4E 43 45 40 54 41 42 4C 45 40 5B 3F 69
241C: 53 4D 49 53 53 49 4F 4E D3 40 44 45 53 54 52 4F
242C: 59 40 41 4C 49 45 4E 53 3F 27 53 57 45 40 41 52
243C: 45 40 54 48 45 40 47 41 4C 41 58 49 41 4E 53 3F
244C: D9 52 40 40 33 30 40 40 40 40 40 40 40 36 30 40
245C: 40 D0 D1 D2 3F D7 52 40 40 34 30 40 40 40 40 40
246C: 40 40 38 30 40 40 D0 D1 D2 3F D5 52 40 40 35 30
247C: 40 40 40 40 40 40 31 30 30 40 40 D0 D1 D2 3F D3
248C: 52 40 40 36 30 40 40 40 40 40 40 33 30 30 40 40
249C: D0 D1 D2 3F 7C 52 CA CB CC CD CE CF 9E 9F 3F 7F
24AC: 53 46 52 45 45 40 50 4C 41 59 3F

; render one HUD field selected by the argument: the coin/credit icon-
; tally row, the credit-count digits, the two-nibble status readout, or
; the bonus-marker row
renderHudFieldBySelector:
24B7: A7              AND     A                   ; test the HUD-field selector in A
24B8: 28 66           JR      Z,$2520             ; {code.loc_2520} selector 0 -- draw the coin/credit icon-tally row
24BA: 3D              DEC     A                   ; drop to selector 1
24BB: 28 2E           JR      Z,$24EB             ; {code.loc_24eb} selector 1 -- draw the credit-count digits
24BD: 3D              DEC     A                   ; drop to selector 2
24BE: 28 08           JR      Z,$24C8             ; {code.loc_24c8} selector 2 -- draw the two-nibble config readout
24C0: 3A 1D 42        LD      A,($421D)           ; {hard.workRam+21D} selector 3: read the bonus-marker count 0x421d
24C3: 47              LD      B,A                 ; hand it to B for the marker draw
24C4: CF              RST     $08                 ; fire the restart-8 page-zero helper
24C5: C3 B3 22        JP      $22B3               ; {code.drawMarkerRow} draw the bonus-marker row

loc_24c8:
24C8: 3A AC 40        LD      A,($40AC)           ; {hard.workRam+AC} read the coinage/config byte 0x40ac
24CB: FE FF           CP      $FF                 ; is it the 0xff disabled marker
24CD: C8              RET     Z                   ; yes -- nothing to show, return
24CE: 3E 06           LD      A,$06               ; message index 6 -- the config label
24D0: CD F1 22        CALL    $22F1               ; {code.renderMessageColumn} paint that label column
24D3: 3A AC 40        LD      A,($40AC)           ; {hard.workRam+AC} re-read the config byte
24D6: E6 0F           AND     $0F                 ; keep its low nibble
24D8: 32 38 51        LD      ($5138),A           ; stamp it into the low-nibble config cell 0x5138
24DB: 3A AC 40        LD      A,($40AC)           ; {hard.workRam+AC} re-read the config byte
24DE: E6 F0           AND     $F0                 ; keep its high nibble
24E0: 20 01           JR      NZ,$24E3            ; {code.loc_24e3} high nibble present -- draw it
24E2: 3C              INC     A                   ; high nibble zero -- bump so it renders as a blank leading digit

loc_24e3:
24E3: 0F              RRCA                        ; rotate the high nibble down toward the low four bits
24E4: 0F              RRCA                        ; rotate again
24E5: 0F              RRCA                        ; rotate again
24E6: 0F              RRCA                        ; rotate again -- the high nibble is now a digit
24E7: 32 58 51        LD      ($5158),A           ; stamp it into the high-nibble config cell 0x5158
24EA: C9              RET                         ; done

loc_24eb:
24EB: 3A 06 40        LD      A,($4006)           ; {hard.workRam+6} read the mode flag 0x4006
24EE: 0F              RRCA                        ; shift its bit0 into carry
24EF: D8              RET     C                   ; in-game mode -- skip the credit HUD entirely
24F0: 3A 11 40        LD      A,($4011)           ; {hard.workRam+11} read the second-input shadow 0x4011
24F3: E6 C0           AND     $C0                 ; keep the top two coinage-DIP bits
24F5: FE C0           CP      $C0                 ; are both set -- free play
24F7: 3E 10           LD      A,$10               ; message index 0x10 -- the FREE PLAY banner
24F9: CA F1 22        JP      Z,$22F1             ; {code.renderMessageColumn} free play -- paint that banner and return
24FC: 3E 05           LD      A,$05               ; message index 5 -- the CREDIT label
24FE: CD F1 22        CALL    $22F1               ; {code.renderMessageColumn} paint the credit label column
2501: 3A 02 40        LD      A,($4002)           ; {hard.workRam+2} read the credit count 0x4002
2504: FE 63           CP      $63                 ; is it at or past 99
2506: 38 02           JR      C,$250A             ; {code.loc_250a} below the cap -- use it
2508: 3E 63           LD      A,$63               ; clamp the credit count to 99

loc_250a:
250A: CD 69 25        CALL    $2569               ; {code.byteToPackedBcd} convert the credit count to packed BCD
250D: 47              LD      B,A                 ; keep the two digits in B
250E: E6 F0           AND     $F0                 ; isolate the tens nibble
2510: 28 07           JR      Z,$2519             ; {code.loc_2519} no tens -- skip the tens digit
2512: 0F              RRCA                        ; rotate the tens nibble down
2513: 0F              RRCA                        ; rotate again
2514: 0F              RRCA                        ; rotate again
2515: 0F              RRCA                        ; rotate again -- tens is now a digit
2516: 32 9F 52        LD      ($529F),A           ; stamp the tens digit into the credit tens cell 0x529f

loc_2519:
2519: 78              LD      A,B                 ; recover the two digits
251A: E6 0F           AND     $0F                 ; isolate the units nibble
251C: 32 7F 52        LD      ($527F),A           ; stamp the units digit into the credit units cell 0x527f
251F: C9              RET                         ; done

loc_2520:
2520: CF              RST     $08                 ; fire the restart-8 page-zero helper
2521: 3A 20 42        LD      A,($4220)           ; {hard.workRam+220} read the formation-clear flag 0x4220
2524: A7              AND     A                   ; test it
2525: 28 05           JR      Z,$252C             ; {code.loc_252c} formation not clear -- skip the sound reset
2527: 3E 01           LD      A,$01               ; arm value 1
2529: 32 D0 41        LD      ($41D0),A           ; {hard.workRam+1D0} request a sound-LFO reset via 0x41d0

loc_252c:
252C: 3A 1C 42        LD      A,($421C)           ; {hard.workRam+21C} read the coin/credit icon-tally count 0x421c
252F: 3C              INC     A                   ; the drawn value is the count plus one
2530: FE 30           CP      $30                 ; is it at or past 48
2532: 38 02           JR      C,$2536             ; {code.loc_2536} below the cap -- use it
2534: 3E 30           LD      A,$30               ; clamp the tally to 48

loc_2536:
2536: CD 69 25        CALL    $2569               ; {code.byteToPackedBcd} convert the tally to packed BCD
2539: F5              PUSH    AF                  ; save the digits
253A: 21 7E 50        LD      HL,$507E            ; point HL at the icon-tally row base 0x507e
253D: E6 F0           AND     $F0                 ; isolate the tens nibble
253F: 28 10           JR      Z,$2551             ; {code.loc_2551} no tens -- skip the tens icons
2541: 0F              RRCA                        ; rotate the tens nibble down
2542: 0F              RRCA                        ; rotate again
2543: 0F              RRCA                        ; rotate again
2544: 0F              RRCA                        ; rotate again -- tens is now a count
2545: 47              LD      B,A                 ; B counts the tens icons to draw
2546: 0E 10           LD      C,$10               ; C starts the running slot budget at 16

loc_2548:
2548: 3E 68           LD      A,$68               ; the tens icon glyph, tile 0x68
254A: CD 85 25        CALL    $2585               ; {code.drawTileBlock2x2} stamp a 2x2 tens icon into the row
254D: 0D              DEC     C                   ; step the slot budget
254E: 0D              DEC     C                   ; step it again -- a tens icon spans two slots
254F: 10 F7           DJNZ    $2548               ; {code.loc_2548} loop, one icon per tens

loc_2551:
2551: F1              POP     AF                  ; recover the digits
2552: E6 0F           AND     $0F                 ; isolate the units nibble
2554: 47              LD      B,A                 ; B counts the units icons to draw
2555: 11 1F 00        LD      DE,$001F            ; stride of +31 between icon pairs
2558: 28 08           JR      Z,$2562             ; {code.loc_2562} no units -- skip to the blank tail

loc_255a:
255A: 3E 6C           LD      A,$6C               ; the units icon glyph, tile 0x6c
255C: CD A0 25        CALL    $25A0               ; {code.stampTilePair} stamp a units icon pair into the row
255F: 0D              DEC     C                   ; step the slot budget
2560: 10 F8           DJNZ    $255A               ; {code.loc_255a} loop, one icon per unit

loc_2562:
2562: 0D              DEC     C                   ; step the slot budget
2563: F8              RET     M                   ; stop once the row is filled
2564: CD 9E 25        CALL    $259E               ; {code.drawFixedTilePairHorizontal} blank this leftover slot with the fixed tile pair
2567: 18 F9           JR      $2562               ; {code.loc_2562} loop, blanking the rest of the row

; Convert a binary byte to packed BCD -- value mod 100 as two decimal
; digits, tens in the high nibble and units in the low nibble -- returned
; in A.
byteToPackedBcd:
2569: 47              LD      B,A                 ; B keeps the raw byte
256A: E6 0F           AND     $0F                 ; take its low nibble
256C: C6 00           ADD     A,$00               ; no change, priming the decimal adjust
256E: 27              DAA                         ; decimal-adjust the low nibble into BCD
256F: 4F              LD      C,A                 ; C holds that units contribution
2570: 78              LD      A,B                 ; recover the raw byte
2571: E6 F0           AND     $F0                 ; take its high nibble
2573: 28 0B           JR      Z,$2580             ; {code.loc_2580} no high nibble -- just add the units part
2575: 0F              RRCA                        ; rotate the high nibble down
2576: 0F              RRCA                        ; rotate again
2577: 0F              RRCA                        ; rotate again
2578: 0F              RRCA                        ; rotate again -- high nibble is now a count
2579: 47              LD      B,A                 ; B counts how many sixteens to add
257A: AF              XOR     A                   ; clear the running total

loc_257b:
257B: C6 16           ADD     A,$16               ; add decimal 16 per high-nibble unit
257D: 27              DAA                         ; keep the running total in BCD
257E: 10 FB           DJNZ    $257B               ; {code.loc_257b} loop for each sixteen

loc_2580:
2580: 81              ADD     A,C                 ; add in the units contribution
2581: 27              DAA                         ; final decimal adjust
2582: C9              RET                         ; return the packed-BCD value

; Stamp a 2x2 tile block at the HL destination seeded from the fixed glyph
; code 44 (0x2c), laying tiles 0x2c..0x2f; the block form of the fixed
; 0x2c glyph family.
drawFixedTileBlock2x2:
2583: 3E 2C           LD      A,$2C               ; seed the fixed glyph code 0x2c

; Draw a 2x2 tile block at HL from seed tile A via two stampTilePair calls
; -- top pair (A,A+1) then bottom pair (A+2,A+3) one tilemap row down;
; preserves DE.
drawTileBlock2x2:
2585: D5              PUSH    DE                  ; save DE
2586: 11 1F 00        LD      DE,$001F            ; stride of +31 between the pair and the next row
2589: CD A0 25        CALL    $25A0               ; {code.stampTilePair} stamp the top tile pair

; Shared tail of the 2x2 tile-block writers: stamp the bottom tile pair
; via stampTilePair, then restore the caller's pushed DE from the stack
; and return.
drawBottomTilePairRestoreDe:
258C: CD A0 25        CALL    $25A0               ; {code.stampTilePair} stamp the bottom tile pair
258F: D1              POP     DE                  ; restore DE
2590: C9              RET                         ; done -- a 2x2 tile block drawn

; Draw a 2x2 tile block upward from the pointer using the fixed decorative
; tile seed 46 (drawTileBlock2x2Up); used by drawMarkerRow to blank unused
; marker-row slots.
drawFixedTileBlock2x2Up:
2591: 3E 2E           LD      A,$2E               ; seed the fixed filler glyph code 0x2e

; Draw a 2x2 tile block growing upward from HL: a top pair (tile, tile+1)
; via stampTilePair with a -33 net stride, then a bottom pair seeded four
; codes lower one row above; preserves DE. The upward counterpart of
; drawTileBlock2x2.
drawTileBlock2x2Up:
2593: D5              PUSH    DE                  ; save DE
2594: 11 DF FF        LD      DE,$FFDF            ; stride of -33 -- up one row and back a column
2597: CD A0 25        CALL    $25A0               ; {code.stampTilePair} stamp the top tile pair growing upward
259A: C6 FC           ADD     A,$FC               ; step the tile code back by four for the bottom pair
259C: 18 EE           JR      $258C               ; {code.drawBottomTilePairRestoreDe} join the block tail to stamp the bottom pair

; Stamp a horizontal tile pair from the fixed glyph code 0x2c (44) via
; stampTilePair, returning the advanced tile/pointer for the caller's
; loop.
drawFixedTilePairHorizontal:
259E: 3E 2C           LD      A,$2C               ; seed the fixed glyph code 0x2c

; Stamps a pair of consecutive tile codes into two adjacent cells ((HL)=A,
; (HL+1)=A+1), then steps HL by the stride and the tile code by two.
stampTilePair:
25A0: 77              LD      (HL),A              ; stamp tile A at the current cell
25A1: 3C              INC     A                   ; step the tile code
25A2: 23              INC     HL                  ; step to the next cell
25A3: 77              LD      (HL),A              ; stamp tile A+1 alongside it
25A4: 3C              INC     A                   ; step the tile code again
25A5: 19              ADD     HL,DE               ; advance the pointer by the stride
25A6: C9              RET                         ; done -- a tile pair stamped

; Stamp a vertical (double-height) tile pair from the fixed glyph code
; 0x2c (44) via drawDoubleHeightTile -- seed at HL and the stepped code
; one tilemap row below.
drawFixedTilePairVertical:
25A7: 3E 2C           LD      A,$2C               ; seed the fixed glyph code 0x2c

; Stamps the two halves of a double-height glyph: tile A at (HL) and
; tile+2 at (HL+0x20), one tilemap row apart; preserves DE.
drawDoubleHeightTile:
25A9: D5              PUSH    DE                  ; save DE
25AA: 11 20 00        LD      DE,$0020            ; stride of +32 -- one tile row down
25AD: 77              LD      (HL),A              ; stamp the top half of the double-height glyph
25AE: C6 02           ADD     A,$02               ; step the code by two for the bottom half
25B0: 19              ADD     HL,DE               ; move down one tile row
25B1: 77              LD      (HL),A              ; stamp the bottom half
25B2: D1              POP     DE                  ; restore DE
25B3: C9              RET                         ; done -- a double-height glyph drawn

; ---- $25B4-$27FF: data ----
25B4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
25C4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
25D4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
25E4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
25F4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2604: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2614: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2624: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2634: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2644: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2654: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2664: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2674: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2684: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2694: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
26A4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
26B4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
26C4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
26D4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
26E4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
26F4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2704: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2714: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2724: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2734: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2744: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2754: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2764: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2774: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2784: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
2794: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
27A4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
27B4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
27C4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
27D4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
27E4: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
27F4: 00 00 00 00 00 00 00 00 00 00 00 00
```
