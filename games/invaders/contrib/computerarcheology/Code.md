![Space Invaders](invaders.jpg)

# Space Invaders

>>> cpu 8080

>>> binary 0000:roms/invaders.h + roms/invaders.g + roms/invaders.f + roms/invaders.e

>>> memoryTable hard

[Hardware Info](Hardware.md)

>>> memoryTable ram

[RAM Usage](RAMUse.md)

```code
; Space Invaders (Taito / Midway, 1978).
;
; What follows is the code reached from the reset and interrupt entry points,
; shown as instructions; spans never reached appear as data (the "---- data
; ----" blocks).


; reset vector: jumps to boot init (bootInit), which enters the attract
; loop
resetEntry:
0000: 00              NOP                         
0001: 00              NOP                         
0002: 00              NOP                         
0003: C3 D4 18        JMP     $18D4               ; power-on: jump into the machine boot-up sequence

; ---- $0006-$0007: data ----
0006: 00 00

loc_0008:
0008: F5              PUSH    PSW                 ; mid-screen raster interrupt -- save the working registers
0009: C5              PUSH    B                   
000A: D5              PUSH    D                   
000B: E5              PUSH    H                   
000C: C3 8C 00        JMP     $008C               ; enter the mid-screen interrupt body

; ---- $000F-$000F: data ----
000F: 00

loc_0010:
0010: F5              PUSH    PSW                 ; vblank interrupt -- save the working registers
0011: C5              PUSH    B                   
0012: D5              PUSH    D                   
0013: E5              PUSH    H                   
0014: 3E 80           MVI     A,$80               
0016: 32 72 20        STA     $2072               ; stamp the raster draw-phase flag to the vblank half
0019: 21 C0 20        LXI     H,$20C0             
001C: 35              DCR     M                   ; tick the frame-delay counter down one -- every busy-wait delay spins on it
001D: CD CD 17        CALL    $17CD               ; {code.loc_17cd} run the tilt/panic check
0020: DB 01           IN      $01                 ; read the coin and start input port
0022: 0F              RRC                         ; rotate the coin-switch bit into carry
0023: DA 67 00        JC      $0067               ; coin switch idle: branch to re-arm the coin latch
0026: 3A EA 20        LDA     $20EA               ; load the coin-switch edge latch
0029: A7              ANA     A                   
002A: CA 42 00        JZ      $0042               ; no armed coin edge: skip crediting
002D: 3A EB 20        LDA     $20EB               ; load the running credit tally
0030: FE 99           CPI     $99                 ; is the credit tally at its 99 cap?
0032: CA 3E 00        JZ      $003E               ; credits capped: skip the increment
0035: C6 01           ADI     $01                 
0037: 27              DAA                         ; add one credit in binary-coded decimal
0038: 32 EB 20        STA     $20EB               ; store the new credit tally
003B: CD 47 19        CALL    $1947               ; {code.drawCreditCount} repaint the on-screen credit count

loc_003e:
003E: AF              XRA     A                   

loc_003f:
003F: 32 EA 20        STA     $20EA               ; clear the coin-switch edge latch -- consume the press

loc_0042:
0042: 3A E9 20        LDA     $20E9               ; load the master game-active gate
0045: A7              ANA     A                   
0046: CA 82 00        JZ      $0082               ; no game or demo live: end the interrupt here
0049: 3A EF 20        LDA     $20EF               ; load the game-in-progress flag
004C: A7              ANA     A                   
004D: C2 6F 00        JNZ     $006F               ; a game is under way: run the in-game frame work
0050: 3A EB 20        LDA     $20EB               ; load the running credit tally
0053: A7              ANA     A                   
0054: C2 5D 00        JNZ     $005D               ; a credit is banked: branch to bring up the credit screen
0057: CD BF 0A        CALL    $0ABF               ; {code.loc_0abf} run one attract-mode task this frame
005A: C3 82 00        JMP     $0082               

loc_005d:
005D: 3A 93 20        LDA     $2093               ; load the credit-screen-shown latch
0060: A7              ANA     A                   
0061: C2 82 00        JNZ     $0082               ; credit screen already shown: end the interrupt
0064: C3 65 07        JMP     $0765               ; bring up the credit and start screen

loc_0067:
0067: 3E 01           MVI     A,$01               
0069: 32 EA 20        STA     $20EA               ; re-arm the coin-switch edge latch for the next press
006C: C3 3F 00        JMP     $003F               

loc_006f:
006F: CD 40 17        CALL    $1740               ; {code.stepFleetMarchSound} sound the fleet-march beat

loc_0072:
0072: 3A 32 20        LDA     $2032               
0075: 32 80 20        STA     $2080               ; copy a per-frame status byte into its shadow cell
0078: CD 00 01        CALL    $0100               ; {code.drawPendingAlien} paint the marching alien queued for this frame
007B: CD 48 02        CALL    $0248               ; {code.loc_0248} run the per-frame object-record table
007E: CD 13 09        CALL    $0913               ; {code.tickSaucerSpawnTimer} step the saucer-spawn countdown
0081: 00              NOP                         

loc_0082:
0082: E1              POP     H                   
0083: D1              POP     D                   
0084: C1              POP     B                   
0085: F1              POP     PSW                 
0086: FB              EI                          ; re-enable interrupts before returning from the frame
0087: C9              RET                         

; ---- $0088-$008B: data ----
0088: 00 00 00 00

loc_008c:
008C: AF              XRA     A                   
008D: 32 72 20        STA     $2072               ; stamp the raster draw-phase flag to the mid-screen half
0090: 3A E9 20        LDA     $20E9               ; load the master game-active gate
0093: A7              ANA     A                   
0094: CA 82 00        JZ      $0082               ; no game or demo live: end the interrupt
0097: 3A EF 20        LDA     $20EF               ; load the game-in-progress flag
009A: A7              ANA     A                   
009B: C2 A5 00        JNZ     $00A5               ; a game is under way: service the mid-screen objects
009E: 3A C1 20        LDA     $20C1               ; load the task-select flags
00A1: 0F              RRC                         ; test the low task-select bit
00A2: D2 82 00        JNC     $0082               ; that task not selected: end the interrupt

loc_00a5:
00A5: 21 20 20        LXI     H,$2020             ; point at the mid-screen object-record table
00A8: CD 4B 02        CALL    $024B               ; {code.loc_024b} run the mid-screen object-record table
00AB: CD 41 01        CALL    $0141               ; {code.loc_0141} advance the fleet -- pick the next alien to repaint
00AE: C3 82 00        JMP     $0082               

; load the active player's saved field record: mirror the reference-alien
; coord word to $2009/ALIEN_DRAW_ADDR, derive the count at $2008, set
; FLEET_MOVE_DIR on the 0xfe edge sentinel
loadReferenceAlienState:
00B1: CD 86 08        CALL    $0886               ; {code.activeFieldRecordPointer} address the active player's field-save slot
00B4: E5              PUSH    H                   
00B5: 7E              MOV     A,M                 
00B6: 23              INX     H                   
00B7: 66              MOV     H,M                 
00B8: 6F              MOV     L,A                 
00B9: 22 09 20        SHLD    $2009               ; publish the saved fleet reference corner into the live anchor
00BC: 22 0B 20        SHLD    $200B               ; also seed the alien draw pointer with that corner
00BF: E1              POP     H                   
00C0: 2B              DCX     H                   
00C1: 7E              MOV     A,M                 ; read back the saved per-player fleet-step delta
00C2: FE 03           CPI     $03                 ; is the delta exactly three?
00C4: C2 C8 00        JNZ     $00C8               
00C7: 3D              DCR     A                   ; trim the delta by one when it reads three

loc_00c8:
00C8: 32 08 20        STA     $2008               ; store it as the working fleet-step count
00CB: FE FE           CPI     $FE                 ; does the delta carry the reversed-heading sentinel?
00CD: 3E 00           MVI     A,$00               
00CF: C2 D3 00        JNZ     $00D3               
00D2: 3C              INR     A                   ; raise the flag when the leftward-heading sentinel is present

loc_00d3:
00D3: 32 0D 20        STA     $200D               ; store the fleet move-direction flag
00D6: C9              RET                         

loc_00d7:
00D7: 3E 02           MVI     A,$02               
00D9: 32 FB 21        STA     $21FB               ; arm player one's initial fleet-step delta to two pixels
00DC: 32 FB 22        STA     $22FB               ; arm player two's initial fleet-step delta to two pixels
00DF: C3 E4 08        JMP     $08E4               ; blank the fixed status strip -- a no-op in two-player mode

; ---- $00E2-$00FF: data ----
00E2: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00F2: 00 00 00 00 00 00 00 00 00 00 00 00 00 00

; draw the pending marching alien: bail to tickAlienExplosionDespawn when
; PLAYER_SHOT_HIT is set; else if the alien at
; (ACTIVE_PLAYER_PAGE:ALIEN_DRAW_INDEX) is live, build its sprite from
; ALIEN_SPRITE_TABLE (id bit0-cleared, rotate-left-3; +0x30 alternate
; frame via selectAlternateSpriteFrame when ALIEN_MARCH_FRAME_TOGGLE is
; set) and blitShiftedSprite 16 rows at ALIEN_DRAW_ADDR; clears
; ALIEN_DRAW_PENDING on every non-bail path
drawPendingAlien:
0100: 21 02 20        LXI     H,$2002             
0103: 7E              MOV     A,M                 ; read the alien-explosion latch
0104: A7              ANA     A                   
0105: C2 38 15        JNZ     $1538               ; an alien is mid-explosion: tick its despawn timer instead of drawing
0108: E5              PUSH    H                   
0109: 3A 06 20        LDA     $2006               ; load the alien draw-index cursor
010C: 6F              MOV     L,A                 
010D: 3A 67 20        LDA     $2067               ; load the active player's alien page
0110: 67              MOV     H,A                 
0111: 7E              MOV     A,M                 ; read the queued alien's liveness byte
0112: A7              ANA     A                   
0113: E1              POP     H                   
0114: CA 36 01        JZ      $0136               ; queued alien is dead: draw nothing, just release the pending flag
0117: 23              INX     H                   
0118: 23              INX     H                   
0119: 7E              MOV     A,M                 ; read the alien's current sprite id
011A: 23              INX     H                   
011B: 46              MOV     B,M                 ; read the two-frame walk toggle
011C: E6 FE           ANI     $FE                 ; clear the low bit to select the base pose
011E: 07              RLC                         
011F: 07              RLC                         
0120: 07              RLC                         ; scale the sprite id into a table offset -- sixteen bytes per sprite
0121: 5F              MOV     E,A                 
0122: 16 00           MVI     D,$00               
0124: 21 00 1C        LXI     H,$1C00             ; point at the alien sprite table
0127: 19              DAD     D                   ; index to this alien's sprite
0128: EB              XCHG                        
0129: 78              MOV     A,B                 
012A: A7              ANA     A                   
012B: C4 3B 01        CNZ     $013B               ; alternate-frame flag set: advance to the second walk-pose bank
012E: 2A 0B 20        LHLD    $200B               ; load the queued screen address
0131: 06 10           MVI     B,$10               
0133: CD D3 15        CALL    $15D3               ; {code.blitShiftedSprite} shift-blit the sixteen-row alien sprite to the screen

loc_0136:
0136: AF              XRA     A                   
0137: 32 00 20        STA     $2000               ; clear the draw-pending flag -- frees the selector to queue the next alien
013A: C9              RET                         

; bump sprite pointer to 2nd bank (DE += 0x30)
selectAlternateSpriteFrame:
013B: 21 30 00        LXI     H,$0030             
013E: 19              DAD     D                   ; advance the sprite pointer one bank (0x30) to the alternate walk pose
013F: EB              XCHG                        
0140: C9              RET                         

loc_0141:
0141: 3A 68 20        LDA     $2068               ; load the fleet-march enable gate
0144: A7              ANA     A                   
0145: C8              RZ                          ; march disabled: do nothing this frame
0146: 3A 00 20        LDA     $2000               ; load the draw-pending flag
0149: A7              ANA     A                   
014A: C0              RNZ                         ; previous alien not yet painted: pick none this frame
014B: 3A 67 20        LDA     $2067               ; load the active player's alien page
014E: 67              MOV     H,A                 
014F: 3A 06 20        LDA     $2006               ; load the alien scan cursor
0152: 16 02           MVI     D,$02               ; allow two full passes over the field

loc_0154:
0154: 3C              INR     A                   ; step the scan cursor to the next alien cell
0155: FE 37           CPI     $37                 ; reached the end of the 55-cell field?
0157: CC A1 01        CZ      $01A1               ; end of a pass: step the fleet and fold its drop into the reference corner
015A: 6F              MOV     L,A                 
015B: 46              MOV     B,M                 ; read that alien's liveness byte
015C: 05              DCR     B                   
015D: C2 54 01        JNZ     $0154               ; cell not alive: keep scanning
0160: 32 06 20        STA     $2006               ; save the cursor at the alien just found
0163: CD 7A 01        CALL    $017A               ; {code.alienIndexToScreenCoords} resolve that alien's screen coordinate
0166: 61              MOV     H,C                 
0167: 22 0B 20        SHLD    $200B               ; stash the packed draw coordinate for the paint pass
016A: 7D              MOV     A,L                 
016B: FE 28           CPI     $28                 ; has this alien descended into the bottom band?
016D: DA 71 19        JC      $1971               ; invasion reached the floor: arm the round-ending restart
0170: 7A              MOV     A,D                 
0171: 32 04 20        STA     $2004               ; latch the alien's row span for the draw pass
0174: 3E 01           MVI     A,$01               
0176: 32 00 20        STA     $2000               ; raise the draw-pending flag to hand off the blit
0179: C9              RET                         

; resolve L over 0x0b into (L,C,D) using the B,C pair at $2009/$200A
alienIndexToScreenCoords:
017A: 16 00           MVI     D,$00               ; zero the whole-row counter
017C: 7D              MOV     A,L                 
017D: 21 09 20        LXI     H,$2009             ; point at the fleet reference corner
0180: 46              MOV     B,M                 ; seed the first coordinate from the reference corner
0181: 23              INX     H                   
0182: 4E              MOV     C,M                 ; seed the second coordinate from the reference corner

loc_0183:
0183: FE 0B           CPI     $0B                 ; compare the remaining index against the 11-column row width
0185: FA 94 01        JM      $0194               ; less than one row left: switch to counting leftover columns
0188: DE 0B           SBI     $0B                 ; subtract one whole row of eleven from the index
018A: 5F              MOV     E,A                 
018B: 78              MOV     A,B                 
018C: C6 10           ADI     $10                 ; step the first coordinate down one grid row (16 pixels)
018E: 47              MOV     B,A                 
018F: 7B              MOV     A,E                 
0190: 14              INR     D                   ; count one whole row consumed
0191: C3 83 01        JMP     $0183               

loc_0194:
0194: 68              MOV     L,B                 

loc_0195:
0195: A7              ANA     A                   ; any leftover columns to place?
0196: C8              RZ                          ; no remainder: the coordinate pair is resolved
0197: 5F              MOV     E,A                 
0198: 79              MOV     A,C                 
0199: C6 10           ADI     $10                 ; step the second coordinate across one grid column (16 pixels)
019B: 4F              MOV     C,A                 
019C: 7B              MOV     A,E                 
019D: 3D              DCR     A                   ; one fewer leftover column
019E: C3 95 01        JMP     $0195               

loc_01a1:
01A1: 15              DCR     D                   ; count down the remaining passes
01A2: CA CD 01        JZ      $01CD               ; two barren passes: abandon the scan this frame
01A5: 21 06 20        LXI     H,$2006             
01A8: 36 00           MVI     M,$00               ; restart the scan cursor at the top of the field
01AA: 23              INX     H                   
01AB: 4E              MOV     C,M                 ; read this pass's staged vertical drop
01AC: 36 00           MVI     M,$00               ; clear the staged drop
01AE: CD D9 01        CALL    $01D9               ; {code.advanceRecordTotals} fold the drop into the reference corner -- the whole fleet steps down
01B1: 21 05 20        LXI     H,$2005             
01B4: 7E              MOV     A,M                 
01B5: 3C              INR     A                   
01B6: E6 01           ANI     $01                 
01B8: 77              MOV     M,A                 ; toggle the two-frame walk animation for this pass
01B9: AF              XRA     A                   ; reset the scan cursor to zero
01BA: 21 67 20        LXI     H,$2067             
01BD: 66              MOV     H,M                 ; re-read the active player's page
01BE: C9              RET                         

; ---- $01BF-$01BF: data ----
01BF: 00

; seat the player-1 alien-status base ALIEN_FIELD_P1 then
; markAllAliensAlive (fill 0x37 cells with 0x01)
markAllAliensAliveP1:
01C0: 21 00 21        LXI     H,$2100             ; point the wave-arm at player one's alien field

; HL-relative fill of 0x37 bytes with 0x01
markAllAliensAlive:
01C3: 06 37           MVI     B,$37               ; prepare to fill 55 alien cells

loc_01c5:
01C5: 36 01           MVI     M,$01               ; mark this alien alive
01C7: 23              INX     H                   
01C8: 05              DCR     B                   
01C9: C2 C5 01        JNZ     $01C5               ; loop until all 55 aliens are marked alive
01CC: C9              RET                         

loc_01cd:
01CD: E1              POP     H                   ; discard the scan's return address -- unwind to abandon the frame
01CE: C9              RET                         

; draw the full-width bottom ground line via fillScreenRow(0x01, 0xe0,
; PLAYFIELD_VRAM_BASE)
drawBottomLine:
01CF: 3E 01           MVI     A,$01               ; the lit pixel byte for the ground line
01D1: 06 E0           MVI     B,$E0               ; span all 224 screen columns
01D3: 21 02 24        LXI     H,$2402             ; start at the first playfield byte -- the bottom ground row
01D6: C3 CC 14        JMP     $14CC               ; fill a lit pixel across the full-width floor

; record accumulate: [HL+2]+=C, [HL+3]+=[HL+1]; return 2nd total in A
advanceRecordTotals:
01D9: 23              INX     H                   
01DA: 46              MOV     B,M                 ; read the record's per-step advance
01DB: 23              INX     H                   
01DC: 79              MOV     A,C                 
01DD: 86              ADD     M                   ; add the caller's step into the first running total
01DE: 77              MOV     M,A                 
01DF: 23              INX     H                   
01E0: 78              MOV     A,B                 
01E1: 86              ADD     M                   ; add the per-step advance into the second running total
01E2: 77              MOV     M,A                 
01E3: C9              RET                         

; preset the copy count to 0xc0, then initWorkRam blockCopies the ROM
; template WORKRAM_INIT_IMAGE into the work-RAM base; memory-only
seedWorkRamImage:
01E4: 06 C0           MVI     B,$C0               ; set the copy length to 0xc0 (192) bytes -- then fall into the work-RAM stamper

; boot-init: blockCopy the caller's B bytes from ROM image
; WORKRAM_INIT_IMAGE into the base of work RAM
initWorkRam:
01E6: 11 00 1B        LXI     D,$1B00             ; point the source at the work-RAM template image in ROM ($1b00)
01E9: 21 00 20        LXI     H,$2000             ; point the destination at the base of work RAM ($2000)
01EC: C3 32 1A        JMP     $1A32               ; block-copy the template down into work RAM

; seat the player-1 shield buffer base PLAYER1_SHIELD_BUFFER, then
; initShieldBuffers replicates the shield template into four slots
initPlayer1ShieldBuffers:
01EF: 21 42 21        LXI     H,$2142             ; point at player 1's shield backup buffer ($2142)
01F2: C3 F8 01        JMP     $01F8               ; fill that buffer with four fresh bunker shields

; seat the player-2 shield buffer base PLAYER2_SHIELD_BUFFER, then
; initShieldBuffers replicates the shield template into four slots
initPlayer2ShieldBuffers:
01F5: 21 42 22        LXI     H,$2242             ; point at player 2's shield backup buffer ($2242) -- then fall into the filler

; replicate the 0x2c-byte shield template SHIELD_TEMPLATE into four
; consecutive shield buffers from HL
initShieldBuffers:
01F8: 0E 04           MVI     C,$04               ; four bunker shields to lay down
01FA: 11 20 1D        LXI     D,$1D20             ; point the source at one pristine shield template in ROM ($1d20)

loc_01fd:
01FD: D5              PUSH    D                   ; loop top -- hold the template source so every bunker copies from the same template
01FE: 06 2C           MVI     B,$2C               ; one shield block = 0x2c bytes
0200: CD 32 1A        CALL    $1A32               ; {code.blockCopy} copy one pristine shield into the current buffer slot
0203: D1              POP     D                   ; rewind the source to the template start for the next bunker
0204: 0D              DCR     C                   ; one bunker done
0205: C2 FD 01        JNZ     $01FD               ; repeat until all four bunkers are stamped
0208: C9              RET                         

; force save mode (A=1), then saveOrRestorePlayer1Shields captures the
; four player-1 shields into PLAYER1_SHIELD_BUFFER; memory-only
savePlayer1Shields:
0209: 3E 01           MVI     A,$01               ; select save mode -- 1 = capture the on-screen shields
020B: C3 1B 02        JMP     $021B               ; run player 1's shield save/restore

; force save mode (A=1), then saveOrRestorePlayer2Shields captures the
; four player-2 shields into PLAYER2_SHIELD_BUFFER; memory-only
savePlayer2Shields:
020E: 3E 01           MVI     A,$01               ; select save mode -- 1 = capture the on-screen shields
0210: C3 14 02        JMP     $0214               ; run player 2's shield save/restore

; force restore mode (A=0), then saveOrRestorePlayer2Shields OR-blits the
; player-2 shields back from PLAYER2_SHIELD_BUFFER; memory-only
restorePlayer2Shields:
0213: AF              XRA     A                   ; select restore mode -- 0 = paint the saved shields back -- then fall into player 2's shield body

; seat DE=PLAYER2_SHIELD_BUFFER, then drawOrSaveShields saves-or-restores
; the four player-2 shield blocks per the caller's mode; memory-only
saveOrRestorePlayer2Shields:
0214: 11 42 22        LXI     D,$2242             ; point at player 2's shield backup buffer ($2242)
0217: C3 1E 02        JMP     $021E               ; run the shared four-block shield save/restore

; force restore mode (A=0), then saveOrRestorePlayer1Shields OR-blits the
; player-1 shields back from PLAYER1_SHIELD_BUFFER; memory-only
restorePlayer1Shields:
021A: AF              XRA     A                   ; select restore mode -- 0 = paint the saved shields back -- then fall into player 1's shield body

; seat DE=PLAYER1_SHIELD_BUFFER, then drawOrSaveShields saves-or-restores
; the four player-1 shield blocks per the caller's mode; memory-only
saveOrRestorePlayer1Shields:
021B: 11 42 21        LXI     D,$2142             ; point at player 1's shield backup buffer, then run the shared save/restore body

; shield save/restore: store SHIELD_SAVE_RESTORE_MODE, then four 22x2
; blocks from SHIELD_VRAM_BASE (stride DRAW_BLOCK_STRIDE) --
; captureScreenRect when set, orBlitBitmap when clear
drawOrSaveShields:
021E: 32 81 20        STA     $2081               ; record the save/restore direction where every pass re-reads it
0221: 01 02 16        LXI     B,$1602             ; one bunker block is 0x16 columns wide by 2 bytes tall
0224: 21 06 28        LXI     H,$2806             ; start at the first bunker's on-screen rectangle
0227: 3E 04           MVI     A,$04               ; four bunkers to walk

loc_0229:
0229: F5              PUSH    PSW                 
022A: C5              PUSH    B                   
022B: 3A 81 20        LDA     $2081               ; re-read the save/restore direction for this block
022E: A7              ANA     A                   
022F: C2 42 02        JNZ     $0242               ; on a save, capture the screen rectangle instead
0232: CD 69 1A        CALL    $1A69               ; {code.orBlitBitmap} restore: OR the stored bunker bitmap back onto the screen

loc_0235:
0235: C1              POP     B                   
0236: F1              POP     PSW                 
0237: 3D              DCR     A                   ; count off this bunker
0238: C8              RZ                          ; done once all four bunkers are handled
0239: D5              PUSH    D                   
023A: 11 E0 02        LXI     D,$02E0             ; step to the next bunker -- 0x17 columns further over
023D: 19              DAD     D                   
023E: D1              POP     D                   
023F: C3 29 02        JMP     $0229               

loc_0242:
0242: CD 7C 14        CALL    $147C               ; {code.captureScreenRect} save: capture the bunker's screen rectangle into the backup buffer
0245: C3 35 02        JMP     $0235               

loc_0248:
0248: 21 10 20        LXI     H,$2010             ; seat the in-game object table, then walk it

loc_024b:
024B: 7E              MOV     A,M                 ; read the record's high timer byte / table sentinel
024C: FE FF           CPI     $FF                 
024E: C8              RZ                          ; 0xff ends the table
024F: FE FE           CPI     $FE                 
0251: CA 81 02        JZ      $0281               ; 0xfe marks a skipped record -- step past it
0254: 23              INX     H                   
0255: 46              MOV     B,M                 ; read the record's low timer byte
0256: 4F              MOV     C,A                 
0257: B0              ORA     B                   ; is the 16-bit frame timer still running?
0258: 79              MOV     A,C                 
0259: C2 77 02        JNZ     $0277               ; timer still counting -- decrement it and move on
025C: 23              INX     H                   
025D: 7E              MOV     A,M                 ; read the record's gate byte
025E: A7              ANA     A                   
025F: C2 88 02        JNZ     $0288               ; timer done but the gate byte still counting -- tick it down
0262: 23              INX     H                   
0263: 5E              MOV     E,M                 ; load the record's handler address, low byte
0264: 23              INX     H                   
0265: 56              MOV     D,M                 ; and its high byte
0266: E5              PUSH    H                   
0267: EB              XCHG                        
0268: E5              PUSH    H                   
0269: 21 6F 02        LXI     H,$026F             
026C: E3              XTHL                        
026D: D5              PUSH    D                   
026E: E9              PCHL                        ; call this record's handler

loc_026f:
026F: E1              POP     H                   
0270: 11 0C 00        LXI     D,$000C             ; advance past the handler data to the next record
0273: 19              DAD     D                   
0274: C3 4B 02        JMP     $024B               

loc_0277:
0277: 05              DCR     B                   ; tick the 16-bit frame timer down one
0278: 04              INR     B                   
0279: C2 7D 02        JNZ     $027D               
027C: 3D              DCR     A                   ; borrow into the high byte when the low byte rolls under

loc_027d:
027D: 05              DCR     B                   
027E: 70              MOV     M,B                 ; write the decremented timer back into the record
027F: 2B              DCX     H                   
0280: 77              MOV     M,A                 

loc_0281:
0281: 11 10 00        LXI     D,$0010             ; step to the next 16-byte record
0284: 19              DAD     D                   
0285: C3 4B 02        JMP     $024B               

loc_0288:
0288: 35              DCR     M                   ; tick the record's gate byte down one
0289: 2B              DCX     H                   
028A: 2B              DCX     H                   
028B: C3 81 02        JMP     $0281               

loc_028e:
028E: E1              POP     H                   
028F: 23              INX     H                   
0290: 7E              MOV     A,M                 ; read the ship record's animation-mode byte
0291: FE FF           CPI     $FF                 
0293: CA 3B 03        JZ      $033B               ; 0xff is the cursor-arm mode -- go move the ship
0296: 23              INX     H                   
0297: 35              DCR     M                   ; count the inner frame timer down
0298: C0              RNZ                         ; still running -- the ordinary pass, nothing more to do
0299: 47              MOV     B,A                 
029A: AF              XRA     A                   
029B: 32 68 20        STA     $2068               ; clear the cursor-move pacing cells
029E: 32 69 20        STA     $2069               
02A1: 3E 30           MVI     A,$30               ; reseat the ship's startup-hold countdown
02A3: 32 6A 20        STA     $206A               
02A6: 78              MOV     A,B                 
02A7: 36 05           MVI     M,$05               ; reseed the inner frame timer to 5
02A9: 23              INX     H                   
02AA: 35              DCR     M                   ; count the outer animation counter down
02AB: C2 9B 03        JNZ     $039B               ; frames remain -- step one animation frame
02AE: 2A 1A 20        LHLD    $201A               ; animation done: fetch the ship's last screen position
02B1: 06 10           MVI     B,$10               
02B3: CD 24 14        CALL    $1424               ; {code.clearSpriteColumn} wipe the ship's old 16-row sprite column
02B6: 21 10 20        LXI     H,$2010             
02B9: 11 10 1B        LXI     D,$1B10             
02BC: 06 10           MVI     B,$10               
02BE: CD 32 1A        CALL    $1A32               ; {code.blockCopy} restore the ship record from its ROM template
02C1: 06 00           MVI     B,$00               
02C3: CD DC 19        CALL    $19DC               ; {code.clearSoundPort3Bit} silence the ship's sound cues
02C6: 3A 6D 20        LDA     $206D               ; check the warm-restart-suppress flag
02C9: A7              ANA     A                   
02CA: C0              RNZ                         ; suppressed -- return without restarting
02CB: 3A EF 20        LDA     $20EF               ; is a real game in progress?
02CE: A7              ANA     A                   
02CF: C8              RZ                          ; in the attract demo there is nothing to restart
02D0: 31 00 24        LXI     SP,$2400            ; reset the stack -- this frame is a player death
02D3: FB              EI                          ; re-enable interrupts
02D4: CD D7 19        CALL    $19D7               ; {code.clearGameActive} drop the game-active flag
02D7: CD 2E 09        CALL    $092E               ; {code.readActivePlayerPageTopByte} read the active player's reserve-ship count
02DA: A7              ANA     A                   
02DB: CA 6D 16        JZ      $166D               ; no ships left -- game over
02DE: CD E7 18        CALL    $18E7               ; {code.otherPlayerFlagPtr} point at the other player's in-play flag
02E1: 7E              MOV     A,M                 
02E2: A7              ANA     A                   
02E3: CA 2C 03        JZ      $032C               ; other player not in -- continue the same player on an extra life
02E6: 3A CE 20        LDA     $20CE               ; is this a two-player game?
02E9: A7              ANA     A                   
02EA: CA 2C 03        JZ      $032C               ; one-player game -- likewise continue the same player

loc_02ed:
02ED: 3A 67 20        LDA     $2067               ; read which player is active before the reseed clobbers it
02F0: F5              PUSH    PSW                 
02F1: 0F              RRC                         ; test the active-player bit
02F2: DA 32 03        JC      $0332               ; player 1 was active -- save player 1's shields
02F5: CD 0E 02        CALL    $020E               ; {code.savePlayer2Shields} save the outgoing player 2's shields to their page buffer

loc_02f8:
02F8: CD 78 08        CALL    $0878               ; {code.stageActivePlayerFieldSave} stage the outgoing player's fleet reference for their next turn
02FB: 73              MOV     M,E                 ; write the fleet reference coordinate into the save record
02FC: 23              INX     H                   
02FD: 72              MOV     M,D                 
02FE: 2B              DCX     H                   
02FF: 2B              DCX     H                   
0300: 70              MOV     M,B                 ; and the working alien count
0301: 00              NOP                         
0302: CD E4 01        CALL    $01E4               ; {code.seedWorkRamImage} reseed the work RAM image from ROM for the incoming player
0305: F1              POP     PSW                 
0306: 0F              RRC                         ; recover which player was active
0307: 3E 21           MVI     A,$21               ; default the incoming player to page 0x21 with silent sound-select
0309: 06 00           MVI     B,$00               
030B: D2 12 03        JNC     $0312               
030E: 06 20           MVI     B,$20               ; handing to player 2 instead: their alternate sound tone
0310: 3E 22           MVI     A,$22               ; and their page 0x22

loc_0312:
0312: 32 67 20        STA     $2067               ; publish the incoming player's page
0315: CD B6 0A        CALL    $0AB6               ; {code.waitLongDelay} hold the round-start splash on screen
0318: AF              XRA     A                   
0319: 32 11 20        STA     $2011               ; idle the first object record for the new round
031C: 78              MOV     A,B                 
031D: D3 05           OUT     $05                 ; emit the incoming player's sound-select
031F: 3C              INR     A                   
0320: 32 98 20        STA     $2098               ; seat the sound-port-5 shadow to match
0323: CD D6 09        CALL    $09D6               ; {code.clearPlayfield} wipe the playfield
0326: CD 7F 1A        CALL    $1A7F               ; {code.decrementShipsAndDrawReadout} spend one of the incoming player's ships and repaint the lives readout
0329: C3 F9 07        JMP     $07F9               ; enter the incoming player's round

loc_032c:
032C: CD 7F 1A        CALL    $1A7F               ; {code.decrementShipsAndDrawReadout} extra-life path: spend one ship and repaint the lives readout
032F: C3 17 08        JMP     $0817               ; re-enter the field without reloading the fleet -- the wave continues

loc_0332:
0332: CD 09 02        CALL    $0209               ; {code.savePlayer1Shields} player 1 was active -- save player 1's shields
0335: C3 F8 02        JMP     $02F8               

; ---- $0338-$033A: data ----
0338: 00 00 00

loc_033b:
033B: 21 68 20        LXI     H,$2068             
033E: 36 01           MVI     M,$01               ; mark the fleet-march enable
0340: 23              INX     H                   
0341: 7E              MOV     A,M                 ; is the cursor already enabled?
0342: A7              ANA     A                   
0343: C3 B0 03        JMP     $03B0               

loc_0346:
0346: 00              NOP                         
0347: 2B              DCX     H                   
0348: 36 01           MVI     M,$01               ; enable the cursor once the startup hold has elapsed

loc_034a:
034A: 3A 1B 20        LDA     $201B               ; read the ship's current column
034D: 47              MOV     B,A                 
034E: 3A EF 20        LDA     $20EF               ; in a real game?
0351: A7              ANA     A                   
0352: C2 63 03        JNZ     $0363               ; yes -- move by live player input
0355: 3A 1D 20        LDA     $201D               ; attract demo -- read the scripted move direction
0358: 0F              RRC                         ; right requested?
0359: DA 81 03        JC      $0381               ; step the ship right
035C: 0F              RRC                         ; left requested?
035D: DA 8E 03        JC      $038E               ; step the ship left
0360: C3 6F 03        JMP     $036F               ; no move -- just redraw

loc_0363:
0363: CD C0 17        CALL    $17C0               ; {code.readActivePlayerInput} read the active player's joystick
0366: 07              RLC                         ; right pressed?
0367: 07              RLC                         
0368: DA 81 03        JC      $0381               ; step the ship right
036B: 07              RLC                         ; left pressed?
036C: DA 8E 03        JC      $038E               ; step the ship left

loc_036f:
036F: 21 18 20        LXI     H,$2018             ; point at the ship's sprite descriptor
0372: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor} decode the ship's sprite descriptor
0375: CD 47 1A        CALL    $1A47               ; {code.coordToScreenAddr} resolve its screen address
0378: CD 39 14        CALL    $1439               ; {code.drawSpriteColumn} blit the ship's sprite column
037B: 3E 00           MVI     A,$00               
037D: 32 12 20        STA     $2012               ; clear the ship's draw-pending flag
0380: C9              RET                         

loc_0381:
0381: 78              MOV     A,B                 
0382: FE D9           CPI     $D9                 ; at the right screen bound?
0384: CA 6F 03        JZ      $036F               ; yes -- hold and redraw
0387: 3C              INR     A                   ; nudge the ship one column right
0388: 32 1B 20        STA     $201B               
038B: C3 6F 03        JMP     $036F               

loc_038e:
038E: 78              MOV     A,B                 
038F: FE 30           CPI     $30                 ; at the left screen bound?
0391: CA 6F 03        JZ      $036F               ; yes -- hold and redraw
0394: 3D              DCR     A                   ; nudge the ship one column left
0395: 32 1B 20        STA     $201B               
0398: C3 6F 03        JMP     $036F               

loc_039b:
039B: 3C              INR     A                   ; advance one animation frame
039C: E6 01           ANI     $01                 ; take the frame's phase bit
039E: 32 15 20        STA     $2015               ; record the animation phase
03A1: 07              RLC                         ; shift the phase into the sprite's low-byte offset
03A2: 07              RLC                         
03A3: 07              RLC                         
03A4: 07              RLC                         
03A5: 21 70 1C        LXI     H,$1C70             ; base at the ship's two-frame explosion sprite
03A8: 85              ADD     L                   
03A9: 6F              MOV     L,A                 
03AA: 22 18 20        SHLD    $2018               ; point the sprite descriptor at the selected frame
03AD: C3 6F 03        JMP     $036F               

loc_03b0:
03B0: C2 4A 03        JNZ     $034A               ; cursor already enabled -- move it now
03B3: 23              INX     H                   
03B4: 35              DCR     M                   ; count the startup-hold down
03B5: C2 4A 03        JNZ     $034A               ; still counting -- move the cursor this pass
03B8: C3 46 03        JMP     $0346               ; hold elapsed -- enable the cursor, then move

loc_03bb:
03BB: 11 2A 20        LXI     D,$202A             ; point at the shot's raster-phase byte
03BE: CD 06 1A        CALL    $1A06               ; {code.objectMatchesDrawPhase} is this the raster half the shot belongs to?
03C1: E1              POP     H                   
03C2: D0              RNC                         ; wrong half -- skip so the shot is not torn
03C3: 23              INX     H                   
03C4: 7E              MOV     A,M                 ; read the player-shot status
03C5: A7              ANA     A                   
03C6: C8              RZ                          ; status 0 -- no shot in play
03C7: FE 01           CPI     $01                 
03C9: CA FA 03        JZ      $03FA               ; status 1 -- launch a new shot
03CC: FE 02           CPI     $02                 
03CE: CA 0A 04        JZ      $040A               ; status 2 -- step the shot in flight
03D1: 23              INX     H                   
03D2: FE 03           CPI     $03                 
03D4: C2 2A 04        JNZ     $042A               ; any later status -- run the end-of-shot tally
03D7: 35              DCR     M                   ; status 3 retiring -- count the retire timer down
03D8: CA 36 04        JZ      $0436               ; timer drained -- the shot is fully gone, reseed it
03DB: 7E              MOV     A,M                 
03DC: FE 0F           CPI     $0F                 
03DE: C0              RNZ                         ; only the 0x0f frame advances the retire animation
03DF: E5              PUSH    H                   
03E0: CD 30 04        CALL    $0430               ; {code.loadPlayerShotDescriptor} decode the shot's sprite descriptor
03E3: CD 52 14        CALL    $1452               ; {code.eraseShiftedSprite} erase the shot at its current spot
03E6: E1              POP     H                   
03E7: 23              INX     H                   
03E8: 34              INR     M                   ; step the shot to the next explosion cell
03E9: 23              INX     H                   
03EA: 23              INX     H                   
03EB: 35              DCR     M                   ; pull the shot's Y back two pixels
03EC: 35              DCR     M                   
03ED: 23              INX     H                   
03EE: 35              DCR     M                   ; and its X back three
03EF: 35              DCR     M                   
03F0: 35              DCR     M                   
03F1: 23              INX     H                   
03F2: 36 08           MVI     M,$08               ; set the explosion sprite's height to eight rows
03F4: CD 30 04        CALL    $0430               ; {code.loadPlayerShotDescriptor} re-decode the descriptor at the moved position
03F7: C3 00 14        JMP     $1400               ; OR-blit the explosion frame

loc_03fa:
03FA: 3C              INR     A                   ; bump the status to flying
03FB: 77              MOV     M,A                 
03FC: 3A 1B 20        LDA     $201B               ; read the ship's column
03FF: C6 08           ADI     $08                 ; offset to the muzzle
0401: 32 2A 20        STA     $202A               ; seat the shot's launch X at the ship's muzzle
0404: CD 30 04        CALL    $0430               ; {code.loadPlayerShotDescriptor} decode the shot's sprite descriptor
0407: C3 00 14        JMP     $1400               ; OR-blit the new shot in

loc_040a:
040A: CD 30 04        CALL    $0430               ; {code.loadPlayerShotDescriptor} decode the shot's descriptor
040D: D5              PUSH    D                   
040E: E5              PUSH    H                   
040F: C5              PUSH    B                   
0410: CD 52 14        CALL    $1452               ; {code.eraseShiftedSprite} erase the shot at its old position
0413: C1              POP     B                   
0414: E1              POP     H                   
0415: D1              POP     D                   
0416: 3A 2C 20        LDA     $202C               ; read the shot's per-frame Y step
0419: 85              ADD     L                   ; advance the shot up the screen
041A: 6F              MOV     L,A                 
041B: 32 29 20        STA     $2029               ; store the advanced Y
041E: CD 91 14        CALL    $1491               ; {code.drawSpriteWithCollision} redraw the shot, testing for a collision
0421: 3A 61 20        LDA     $2061               ; did it hit something?
0424: A7              ANA     A                   
0425: C8              RZ                          ; no hit -- keep flying
0426: 32 02 20        STA     $2002               ; latch the hit for the shot resolver
0429: C9              RET                         

loc_042a:
042A: FE 05           CPI     $05                 
042C: C8              RZ                          ; status 5 is the explosion state -- idle this frame
042D: C3 36 04        JMP     $0436               

; load the player-shot 5-byte descriptor at PLAYER_SHOT_DESC via
; loadSpriteDescriptor; HL := its screen address
loadPlayerShotDescriptor:
0430: 21 27 20        LXI     H,$2027             ; point at the player shot's sprite descriptor
0433: C3 3B 1A        JMP     $1A3B               ; decode it through the shared descriptor loader

loc_0436:
0436: CD 30 04        CALL    $0430               ; {code.loadPlayerShotDescriptor} decode the shot's descriptor
0439: CD 52 14        CALL    $1452               ; {code.eraseShiftedSprite} erase the spent shot
043C: 21 25 20        LXI     H,$2025             
043F: 11 25 1B        LXI     D,$1B25             
0442: 06 07           MVI     B,$07               
0444: CD 32 1A        CALL    $1A32               ; {code.blockCopy} reload the 7-byte shot record from its template so a new shot can fire
0447: 2A 8D 20        LHLD    $208D               ; read the saucer score-key counter
044A: 2C              INR     L                   ; advance it one step
044B: 7D              MOV     A,L                 
044C: FE 63           CPI     $63                 
044E: DA 53 04        JC      $0453               
0451: 2E 54           MVI     L,$54               ; wrap the key back to its low bound at 0x63

loc_0453:
0453: 22 8D 20        SHLD    $208D               
0456: 2A 8F 20        LHLD    $208F               ; read the saucer direction-sequence counter
0459: 2C              INR     L                   ; advance it one step
045A: 22 8F 20        SHLD    $208F               
045D: 3A 84 20        LDA     $2084               ; is a saucer already on screen?
0460: A7              ANA     A                   
0461: C0              RNZ                         ; yes -- leave its movement alone
0462: 7E              MOV     A,M                 ; read the next direction-sequence byte
0463: E6 01           ANI     $01                 
0465: 01 29 02        LXI     B,$0229             ; pick the rightward saucer movement pair
0468: C2 6E 04        JNZ     $046E               
046B: 01 E0 FE        LXI     B,$FEE0             ; or the leftward saucer movement pair

loc_046e:
046E: 21 8A 20        LXI     H,$208A             
0471: 71              MOV     M,C                 ; publish the saucer's step low byte
0472: 23              INX     H                   
0473: 23              INX     H                   
0474: 70              MOV     M,B                 ; and its step high byte
0475: C9              RET                         

loc_0476:
0476: E1              POP     H                   
0477: 3A 32 1B        LDA     $1B32               ; read this shot's control byte from its ROM template
047A: 32 32 20        STA     $2032               ; refresh the record's control byte each pass
047D: 2A 38 20        LHLD    $2038               ; read the shot's step-gate countdown
0480: 7D              MOV     A,L                 
0481: B4              ORA     H                   ; is the gate still zero?
0482: C2 8A 04        JNZ     $048A               ; gate open -- run the shot
0485: 2B              DCX     H                   ; still dormant -- wrap the gate word and wait
0486: 22 38 20        SHLD    $2038               
0489: C9              RET                         

loc_048a:
048A: 11 35 20        LXI     D,$2035             
048D: 3E F9           MVI     A,$F9               
048F: CD 50 05        CALL    $0550               ; {code.copyRecordToWorkBuffer} lift this shot's descriptor strip into the shared scratch buffer
0492: 3A 46 20        LDA     $2046               
0495: 32 70 20        STA     $2070               ; stage this column's shot-rate cells for the shared step routine
0498: 3A 56 20        LDA     $2056               
049B: 32 71 20        STA     $2071               
049E: CD 63 05        CALL    $0563               ; {code.stepAlienShot} step the alien shot
04A1: 3A 78 20        LDA     $2078               ; is the shot mid-explosion?
04A4: A7              ANA     A                   
04A5: 21 35 20        LXI     H,$2035             
04A8: C2 5B 05        JNZ     $055B               ; yes -- write the working strip back and keep the blowup running
04AB: 11 30 1B        LXI     D,$1B30             
04AE: 21 30 20        LXI     H,$2030             
04B1: 06 10           MVI     B,$10               
04B3: C3 32 1A        JMP     $1A32               ; otherwise reseed the whole record from its ROM template

loc_04b6:
04B6: E1              POP     H                   
04B7: 3A 6E 20        LDA     $206E               ; check this shot's self-disable flag
04BA: A7              ANA     A                   
04BB: C0              RNZ                         ; disabled once one alien remains -- do nothing
04BC: 3A 80 20        LDA     $2080               ; gate byte -- this shot only steps when it reads 1
04BF: FE 01           CPI     $01                 
04C1: C0              RNZ                         
04C2: 11 45 20        LXI     D,$2045             
04C5: 3E ED           MVI     A,$ED               
04C7: CD 50 05        CALL    $0550               ; {code.copyRecordToWorkBuffer} lift this shot's descriptor strip into the shared scratch buffer
04CA: 3A 36 20        LDA     $2036               
04CD: 32 70 20        STA     $2070               ; stage this column's shot-rate cells for the shared step routine
04D0: 3A 56 20        LDA     $2056               
04D3: 32 71 20        STA     $2071               
04D6: CD 63 05        CALL    $0563               ; {code.stepAlienShot} step the alien shot
04D9: 3A 76 20        LDA     $2076               ; read the firing-column cursor
04DC: FE 10           CPI     $10                 
04DE: DA E7 04        JC      $04E7               
04E1: 3A 48 1B        LDA     $1B48               ; wrap the cursor back to its start once it reaches 16
04E4: 32 76 20        STA     $2076               

loc_04e7:
04E7: 3A 78 20        LDA     $2078               ; is the shot mid-explosion?
04EA: A7              ANA     A                   
04EB: 21 45 20        LXI     H,$2045             
04EE: C2 5B 05        JNZ     $055B               ; yes -- write the working strip back and keep the blowup running
04F1: 11 40 1B        LXI     D,$1B40             
04F4: 21 40 20        LXI     H,$2040             
04F7: 06 10           MVI     B,$10               
04F9: CD 32 1A        CALL    $1A32               ; {code.blockCopy} otherwise reseed the whole record from its ROM template
04FC: 3A 82 20        LDA     $2082               ; how many aliens are left?
04FF: 3D              DCR     A                   
0500: C2 08 05        JNZ     $0508               
0503: 3E 01           MVI     A,$01               ; just one alien left -- latch this shot off for the rest of the wave
0505: 32 6E 20        STA     $206E               

loc_0508:
0508: 2A 76 20        LHLD    $2076               ; read the firing-column word
050B: C3 7E 06        JMP     $067E               ; stash it for the next pass

; ---- $050E-$050E: data ----
050E: E1

; object step handler called by the saucer handler saucerHandler: prime
; the record's strip (copyRecordToWorkBuffer), stage the two per-column
; rate cells, step the alien shot (stepAlienShot), clamp the firing column
; at 21, then either restore the strip or blit the record template and
; stow the column
alienShotSlot4Handler:
050F: 11 55 20        LXI     D,$2055             
0512: 3E DB           MVI     A,$DB               
0514: CD 50 05        CALL    $0550               ; {code.copyRecordToWorkBuffer} lift this shot's descriptor strip into the shared scratch buffer
0517: 3A 46 20        LDA     $2046               
051A: 32 70 20        STA     $2070               ; stage this column's shot-rate cells for the shared step routine
051D: 3A 36 20        LDA     $2036               
0520: 32 71 20        STA     $2071               
0523: CD 63 05        CALL    $0563               ; {code.stepAlienShot} step the alien shot
0526: 3A 76 20        LDA     $2076               ; read the firing-column cursor
0529: FE 15           CPI     $15                 
052B: DA 34 05        JC      $0534               
052E: 3A 58 1B        LDA     $1B58               ; wrap the cursor back to its start once it reaches 21
0531: 32 76 20        STA     $2076               

loc_0534:
0534: 3A 78 20        LDA     $2078               ; is the shot mid-explosion?
0537: A7              ANA     A                   
0538: 21 55 20        LXI     H,$2055             
053B: C2 5B 05        JNZ     $055B               ; yes -- write the working strip back and keep the blowup running
053E: 11 50 1B        LXI     D,$1B50             
0541: 21 50 20        LXI     H,$2050             
0544: 06 10           MVI     B,$10               
0546: CD 32 1A        CALL    $1A32               ; {code.blockCopy} otherwise reseed the whole record from its ROM template
0549: 2A 76 20        LHLD    $2076               ; carry the firing-column word forward for the next pass
054C: 22 58 20        SHLD    $2058               
054F: C9              RET                         

; stash A -> ALIEN_SHOT_SPRITE_FRAME_CEILING, then blockCopy 0x0b bytes
; (DE)->work buffer OBJECT_WORK_BUFFER (prime an object strip)
copyRecordToWorkBuffer:
0550: 32 7F 20        STA     $207F               ; park the caller's marker byte where the step routine reads it back
0553: 21 73 20        LXI     H,$2073             
0556: 06 0B           MVI     B,$0B               
0558: C3 32 1A        JMP     $1A32               ; copy the 11-byte object strip into the shared scratch buffer

; blockCopy 0x0b bytes work buffer OBJECT_WORK_BUFFER ->(HL) (restore the
; object strip; twin of copyRecordToWorkBuffer)
copyWorkBufferToRecord:
055B: 11 73 20        LXI     D,$2073             
055E: 06 0B           MVI     B,$0B               
0560: C3 32 1A        JMP     $1A32               ; pour the 11 scratch bytes back into the caller's record

; alien-shot handler -- step the active alien shot (draw-phase gate,
; blowup animation, descend one step, redraw with collision, retire across
; the shield/ground bands) or, when idle, spawn a new one from a firing
; column (task-flag/rate-timer gated, column picked via the cursor list or
; a Y-scale)
stepAlienShot:
0563: 21 73 20        LXI     H,$2073             
0566: 7E              MOV     A,M                 ; read the shot's status byte
0567: E6 80           ANI     $80                 
0569: C2 C1 05        JNZ     $05C1               ; a shot is live -- step it
056C: 3A C1 20        LDA     $20C1               ; check the task flags
056F: FE 04           CPI     $04                 
0571: 3A 69 20        LDA     $2069               ; read the fire-enable gate
0574: CA B7 05        JZ      $05B7               ; task flag 4 forces an immediate launch
0577: A7              ANA     A                   
0578: C8              RZ                          ; not enabled to fire -- nothing to do
0579: 23              INX     H                   
057A: 36 00           MVI     M,$00               ; reset the launch-attempt counter
057C: 3A 70 20        LDA     $2070               ; read the first per-column rate gate
057F: A7              ANA     A                   
0580: CA 89 05        JZ      $0589               
0583: 47              MOV     B,A                 
0584: 3A CF 20        LDA     $20CF               ; compare it against the current firing cadence
0587: B8              CMP     B                   
0588: D0              RNC                         ; too soon -- hold fire this frame

loc_0589:
0589: 3A 71 20        LDA     $2071               ; read the second per-column rate gate
058C: A7              ANA     A                   
058D: CA 96 05        JZ      $0596               
0590: 47              MOV     B,A                 
0591: 3A CF 20        LDA     $20CF               ; compare it against the firing cadence
0594: B8              CMP     B                   
0595: D0              RNC                         ; too soon -- hold fire

loc_0596:
0596: 23              INX     H                   
0597: 7E              MOV     A,M                 ; read the column-select mode
0598: A7              ANA     A                   
0599: CA 1B 06        JZ      $061B               ; mode 0 -- aim the shot at the player's column
059C: 2A 76 20        LHLD    $2076               ; otherwise read the next firing column from the cursor list
059F: 4E              MOV     C,M                 
05A0: 23              INX     H                   
05A1: 00              NOP                         
05A2: 22 76 20        SHLD    $2076               ; advance the column cursor

loc_05a5:
05A5: CD 2F 06        CALL    $062F               ; {code.findLiveAlienInColumn} find a live alien down that column
05A8: D0              RNC                         ; no alien there -- abort the launch this frame
05A9: CD 7A 01        CALL    $017A               ; {code.alienIndexToScreenCoords} convert that alien's grid cell to screen coordinates
05AC: 79              MOV     A,C                 
05AD: C6 07           ADI     $07                 ; offset the shot just below the alien
05AF: 67              MOV     H,A                 
05B0: 7D              MOV     A,L                 
05B1: D6 0A           SUI     $0A                 ; and just to its left
05B3: 6F              MOV     L,A                 
05B4: 22 7B 20        SHLD    $207B               ; seat the shot's start coordinate

loc_05b7:
05B7: 21 73 20        LXI     H,$2073             
05BA: 7E              MOV     A,M                 
05BB: F6 80           ORI     $80                 ; bring the shot live
05BD: 77              MOV     M,A                 
05BE: 23              INX     H                   
05BF: 34              INR     M                   ; bump the launch-attempt counter
05C0: C9              RET                         

loc_05c1:
05C1: 11 7C 20        LXI     D,$207C             
05C4: CD 06 1A        CALL    $1A06               ; {code.objectMatchesDrawPhase} is this the shot's raster half?
05C7: D0              RNC                         ; wrong half -- wait
05C8: 23              INX     H                   
05C9: 7E              MOV     A,M                 
05CA: E6 01           ANI     $01                 
05CC: C2 44 06        JNZ     $0644               ; already blowing up -- run the explosion animation
05CF: 23              INX     H                   
05D0: 34              INR     M                   ; tick the shot's animation counter
05D1: CD 75 06        CALL    $0675               ; {code.eraseAlienShot} erase the shot before moving it
05D4: 3A 79 20        LDA     $2079               ; read the shot's current sprite frame
05D7: C6 03           ADI     $03                 ; step the animation by three
05D9: 21 7F 20        LXI     H,$207F             
05DC: BE              CMP     M                   
05DD: DA E2 05        JC      $05E2               
05E0: D6 0C           SUI     $0C                 ; wrap the frame past its ceiling

loc_05e2:
05E2: 32 79 20        STA     $2079               ; store the new sprite frame
05E5: 3A 7B 20        LDA     $207B               ; read the shot's coordinate
05E8: 47              MOV     B,A                 
05E9: 3A 7E 20        LDA     $207E               ; add the signed per-frame descent step
05EC: 80              ADD     B                   
05ED: 32 7B 20        STA     $207B               ; move the shot along its travel
05F0: CD 6C 06        CALL    $066C               ; {code.drawAlienShotWithCollision} redraw the shot, testing for a collision
05F3: 3A 7B 20        LDA     $207B               ; read the shot's coordinate
05F6: FE 15           CPI     $15                 
05F8: DA 12 06        JC      $0612               ; reached the floor band -- blow it up
05FB: 3A 61 20        LDA     $2061               ; did it hit something?
05FE: A7              ANA     A                   
05FF: C8              RZ                          ; no -- keep flying
0600: 3A 7B 20        LDA     $207B               ; read the shot's coordinate
0603: FE 1E           CPI     $1E                 
0605: DA 12 06        JC      $0612               ; hit below the shield band -- blow it up
0608: FE 27           CPI     $27                 
060A: 00              NOP                         
060B: D2 12 06        JNC     $0612               ; hit above the shield band -- blow it up
060E: 97              SUB     A                   
060F: 32 15 20        STA     $2015               ; hit within the shield band -- cancel the round-start arm

loc_0612:
0612: 3A 73 20        LDA     $2073               
0615: F6 01           ORI     $01                 ; flag the shot as blowing up
0617: 32 73 20        STA     $2073               
061A: C9              RET                         

loc_061b:
061B: 3A 1B 20        LDA     $201B               ; aim mode: read the player ship's column
061E: C6 08           ADI     $08                 ; offset to the ship's center
0620: 67              MOV     H,A                 
0621: CD 6F 15        CALL    $156F               ; {code.scaleYToBlock} scale it to a grid column
0624: 79              MOV     A,C                 
0625: FE 0C           CPI     $0C                 
0627: DA A5 05        JC      $05A5               ; use that column if inside the rack
062A: 0E 0B           MVI     C,$0B               ; otherwise clamp to the last column
062C: C3 A5 05        JMP     $05A5               

; scan five object slots (stride 0x0b) on ACTIVE_PLAYER_PAGE from low byte
; C-1
findLiveAlienInColumn:
062F: 0D              DCR     C                   ; index the column base -- caller's column minus one
0630: 3A 67 20        LDA     $2067               ; select the active player's alien grid page
0633: 67              MOV     H,A                 
0634: 69              MOV     L,C                 
0635: 16 05           MVI     D,$05               ; five rows to scan down this column

loc_0637:
0637: 7E              MOV     A,M                 ; read the alien's liveness byte
0638: A7              ANA     A                   
0639: 37              STC                         
063A: C0              RNZ                         ; found a live alien -- report it
063B: 7D              MOV     A,L                 
063C: C6 0B           ADI     $0B                 ; step down to the next cell in the column -- 11 bytes on
063E: 6F              MOV     L,A                 
063F: 15              DCR     D                   
0640: C2 37 06        JNZ     $0637               ; keep scanning the column
0643: C9              RET                         ; column empty -- no alien to fire

; step the alien-shot blowup: decrement ALIEN_SHOT_BLOWUP_TIMER; at 3
; eraseAlienShot then re-seat
; ALIEN_SHOT_SPRITE_PTR=ALIEN_SHOT_BLOWUP_SPRITE and recenter the
; descriptor (ALIEN_SHOT_COORD/$207C -= 2, ALIEN_SHOT_ROW_COUNT=6) and
; drawAlienShotWithCollision (tail); at 0 just eraseAlienShot (tail); else
; idle
stepAlienShotBlowup:
0644: 21 78 20        LXI     H,$2078             
0647: 35              DCR     M                   ; tick the blowup countdown down one
0648: 7E              MOV     A,M                 
0649: FE 03           CPI     $03                 
064B: C2 67 06        JNZ     $0667               ; past the burst's start frame -- check whether it is over
064E: CD 75 06        CALL    $0675               ; {code.eraseAlienShot} burst starting -- erase the spent shot sprite
0651: 21 DC 1C        LXI     H,$1CDC             
0654: 22 79 20        SHLD    $2079               ; swap the descriptor over to the explosion graphic
0657: 21 7C 20        LXI     H,$207C             
065A: 35              DCR     M                   ; pull both coordinate bytes back two pixels to center the wider burst
065B: 35              DCR     M                   
065C: 2B              DCX     H                   
065D: 35              DCR     M                   
065E: 35              DCR     M                   
065F: 3E 06           MVI     A,$06               
0661: 32 7D 20        STA     $207D               ; force the burst to six rows tall
0664: C3 6C 06        JMP     $066C               ; draw the explosion

loc_0667:
0667: A7              ANA     A                   
0668: C0              RNZ                         ; still bursting -- idle this frame
0669: C3 75 06        JMP     $0675               ; countdown done -- erase the burst so the shot despawns

; seat HL at the alien-shot descriptor ALIEN_SHOT_SPRITE_PTR,
; loadSpriteDescriptor, then drawSpriteWithCollision
drawAlienShotWithCollision:
066C: 21 79 20        LXI     H,$2079             ; point at the alien-shot descriptor
066F: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor} decode it
0672: C3 91 14        JMP     $1491               ; OR-blit the shot, latching any collision

; seat HL at the alien-shot descriptor ALIEN_SHOT_SPRITE_PTR,
; loadSpriteDescriptor, then eraseShiftedSprite (AND the sprite's bits out
; of the screen)
eraseAlienShot:
0675: 21 79 20        LXI     H,$2079             ; point at the alien-shot sprite descriptor ($2079)
0678: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor} decode that descriptor -- screen address plus sprite geometry
067B: C3 52 14        JMP     $1452               ; erase the shot -- AND its shifted bits back out of the screen

loc_067e:
067E: 22 48 20        SHLD    $2048               ; stash the 16-bit pointer into the $2048 work cell
0681: C9              RET                         

loc_0682:
0682: E1              POP     H                   
0683: 3A 80 20        LDA     $2080               ; read the saucer-path mode gate ($2080)
0686: FE 02           CPI     $02                 ; the saucer path runs only when the gate reads 2
0688: C0              RNZ                         
0689: 21 83 20        LXI     H,$2083             ; point at the saucer object record ($2083)
068C: 7E              MOV     A,M                 ; read the record's first byte -- 0 means no saucer armed
068D: A7              ANA     A                   
068E: CA 0F 05        JZ      $050F               ; no saucer armed -> service the record through the alien-shot step at $050f
0691: 3A 56 20        LDA     $2056               ; read the saucer-suppress gate ($2056)
0694: A7              ANA     A                   
0695: C2 0F 05        JNZ     $050F               ; when the suppress gate is set, delegate to the alien-shot step at $050f
0698: 23              INX     H                   ; advance to the saucer on-field flag ($2084)
0699: 7E              MOV     A,M                 ; read whether a saucer is currently on the field
069A: A7              ANA     A                   
069B: C2 AB 06        JNZ     $06AB               ; a saucer is already up -> skip the launch decision
069E: 3A 82 20        LDA     $2082               ; read the live-alien tally ($2082)
06A1: FE 08           CPI     $08                 ; the mystery ship only appears while at least 8 aliens remain
06A3: DA 0F 05        JC      $050F               ; too few aliens left -> no saucer this pass, delegate
06A6: 36 01           MVI     M,$01               ; launch the saucer -- raise its on-field flag
06A8: CD 3C 07        CALL    $073C               ; {code.drawSaucerSprite} draw the saucer's first frame

loc_06ab:
06AB: 11 8A 20        LXI     D,$208A             ; point at the saucer's horizontal position and step pair ($208a)
06AE: CD 06 1A        CALL    $1A06               ; {code.objectMatchesDrawPhase} service the saucer only in the raster half matching its draw-phase bit
06B1: D0              RNC                         
06B2: 21 85 20        LXI     H,$2085             ; point at the saucer-hit flag ($2085)
06B5: 7E              MOV     A,M                 
06B6: A7              ANA     A                   
06B7: C2 D6 06        JNZ     $06D6               ; the saucer was shot -> run its explosion and score sequence
06BA: 21 8A 20        LXI     H,$208A             ; point at the saucer's horizontal position accumulator ($208a)
06BD: 7E              MOV     A,M                 
06BE: 23              INX     H                   
06BF: 23              INX     H                   
06C0: 86              ADD     M                   ; advance the saucer one step across the top of the field
06C1: 32 8A 20        STA     $208A               ; store the saucer's new horizontal position
06C4: CD 3C 07        CALL    $073C               ; {code.drawSaucerSprite} redraw the saucer at its new spot
06C7: 21 8A 20        LXI     H,$208A             
06CA: 7E              MOV     A,M                 
06CB: FE 28           CPI     $28                 ; still within the visible band? -- low edge at 40
06CD: DA F9 06        JC      $06F9               ; crossed the left edge -> retire the saucer
06D0: FE E1           CPI     $E1                 ; high edge at 225
06D2: D2 F9 06        JNC     $06F9               ; crossed the right edge -> retire the saucer
06D5: C9              RET                         

loc_06d6:
06D6: 06 FE           MVI     B,$FE               ; prepare mask 0xfe -- clear the saucer whine bit
06D8: CD DC 19        CALL    $19DC               ; {code.clearSoundPort3Bit} silence the saucer's continuous whine
06DB: 23              INX     H                   ; step to the hit-sequence phase counter ($2086)
06DC: 35              DCR     M                   ; tick the explosion phase counter down
06DD: 7E              MOV     A,M                 
06DE: FE 1F           CPI     $1F                 ; phase 31 -> fire the explosion tone and draw the burst
06E0: CA 4B 07        JZ      $074B               
06E3: FE 18           CPI     $18                 ; phase 24 -> award the mystery score and show its glyphs
06E5: CA 0C 07        JZ      $070C               
06E8: A7              ANA     A                   ; any other nonzero phase -> hold the score display and keep counting
06E9: C0              RNZ                         
06EA: 06 EF           MVI     B,$EF               ; phase 0: prepare mask 0xef -- clear the UFO-hit tone bit
06EC: 21 98 20        LXI     H,$2098             ; point at the port-5 sound shadow ($2098)
06EF: 7E              MOV     A,M                 
06F0: A0              ANA     B                   ; drop the UFO-hit tone bit from the shadow
06F1: 77              MOV     M,A                 
06F2: E6 20           ANI     $20                 ; keep only the retained fleet-march select bit
06F4: D3 05           OUT     $05                 ; write the sound port 5 latch
06F6: 00              NOP                         
06F7: 00              NOP                         
06F8: 00              NOP                         

loc_06f9:
06F9: CD 42 07        CALL    $0742               ; {code.resolveSpriteScreenAddr} resolve the saucer's screen address
06FC: CD CB 14        CALL    $14CB               ; {code.clearScreenStrip} blank the saucer's strip off the display
06FF: 21 83 20        LXI     H,$2083             ; point at the saucer object record ($2083)
0702: 06 0A           MVI     B,$0A               ; reseed 10 record bytes
0704: CD 5F 07        CALL    $075F               ; {code.copyTemplateToRecord} restamp the saucer record from its ROM template for the next appearance

; clear the saucer sound bit: SOUND_PORT3_SHADOW &= 0xfe via
; clearSoundPort3Bit, mirror to sound port 3; value-out A
stopSaucerSound:
0707: 06 FE           MVI     B,$FE               ; mask 0xfe -- clear the saucer whine bit
0709: C3 DC 19        JMP     $19DC               ; silence the saucer whine and mirror the shadow to sound port 3

; award the mystery-saucer score: raise SCORE_ADD_PENDING, read the key
; via SAUCER_SCORE_KEY_PTR, match it in SAUCER_SCORE_KEY_TABLE, copy the
; parallel SAUCER_SCORE_SPRITE_TABLE entry into the saucer sprite record
; $2087, store key*16 to SCORE_ADD_VALUE, resolveSpriteScreenAddr then
; drawThreeSprites (tail)
awardSaucerScore:
070C: 3E 01           MVI     A,$01               
070E: 32 F1 20        STA     $20F1               ; raise the pending-score flag ($20f1) so the main loop banks the value
0711: 2A 8D 20        LHLD    $208D               ; load the current saucer-score key pointer ($208d)
0714: 46              MOV     B,M                 ; read the live score key it points at
0715: 0E 04           MVI     C,$04               ; up to four table entries to scan
0717: 21 50 1D        LXI     H,$1D50             ; point at the score-sprite id table ($1d50)
071A: 11 4C 1D        LXI     D,$1D4C             ; point at the parallel score-key table ($1d4c)

loc_071d:
071D: 1A              LDAX    D                   ; read this key-table entry
071E: B8              CMP     B                   ; match it against the live key
071F: CA 28 07        JZ      $0728               ; on a match, take the paired sprite id
0722: 23              INX     H                   
0723: 13              INX     D                   
0724: 0D              DCR     C                   
0725: C2 1D 07        JNZ     $071D               ; walk both tables in lockstep until the key matches

loc_0728:
0728: 7E              MOV     A,M                 ; read the matched score-sprite id
0729: 32 87 20        STA     $2087               ; stamp it into the saucer sprite record ($2087) for drawing
072C: 26 00           MVI     H,$00               
072E: 68              MOV     L,B                 
072F: 29              DAD     H                   ; multiply the key by 16 -- the saucer's point value
0730: 29              DAD     H                   
0731: 29              DAD     H                   
0732: 29              DAD     H                   
0733: 22 F2 20        SHLD    $20F2               ; store key*16 as the score to add ($20f2)
0736: CD 42 07        CALL    $0742               ; {code.resolveSpriteScreenAddr} resolve the death spot to a screen address
0739: C3 F1 08        JMP     $08F1               ; draw the three-glyph point value at the death spot

; resolve the sprite descriptor at $2087 to its screen address + gfx
; pointer (resolveSpriteScreenAddr), then blit the sprite column into
; video RAM (drawSpriteColumn)
drawSaucerSprite:
073C: CD 42 07        CALL    $0742               ; {code.resolveSpriteScreenAddr} resolve the saucer record to a screen address and gfx pointer
073F: C3 39 14        JMP     $1439               ; blit the saucer's column into video RAM -- byte-aligned

; load the sprite descriptor at $2087 then coordToScreenAddr; HL := screen
; address, DE := gfx pointer
resolveSpriteScreenAddr:
0742: 21 87 20        LXI     H,$2087             ; point at the saucer sprite record ($2087)
0745: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor} decode its five-byte descriptor -- gfx pointer plus packed coordinate
0748: C3 47 1A        JMP     $1A47               ; fold the coordinate into a video-RAM address

; on saucer destruction: OR the port-5 UFO-hit sound bit and
; latchSoundPort5, repoint the saucer sprite record at SAUCER_HIT_SPRITE,
; then draw it
playSaucerHitSoundAndDrawSprite:
074B: 06 10           MVI     B,$10               ; select bit 4 -- the UFO-explosion tone
074D: 21 98 20        LXI     H,$2098             ; point at the port-5 sound shadow ($2098)
0750: 7E              MOV     A,M                 
0751: B0              ORA     B                   ; raise the UFO-explosion tone bit
0752: 77              MOV     M,A                 
0753: CD 70 17        CALL    $1770               ; {code.latchSoundPort5} latch the two high sound-select bits out to sound port 5
0756: 21 7C 1D        LXI     H,$1D7C             ; point at the saucer-explosion graphic ($1d7c)
0759: 22 87 20        SHLD    $2087               ; repoint the saucer record at the burst graphic
075C: C3 3C 07        JMP     $073C               ; draw the burst so the bang and the flash land the same frame

; blockCopy B bytes from ROM template SAUCER_RECORD_TEMPLATE into the
; caller's object record (HL)
copyTemplateToRecord:
075F: 11 83 1B        LXI     D,$1B83             ; point the byte-mover at the ROM object template ($1b83)
0762: C3 32 1A        JMP     $1A32               ; copy the template bytes into the caller's object record

loc_0765:
0765: 3E 01           MVI     A,$01               
0767: 32 93 20        STA     $2093               ; latch the credit-screen-shown flag ($2093) so it draws once
076A: 31 00 24        LXI     SP,$2400            ; reset the stack pointer to the top of work RAM ($2400)
076D: FB              EI                          ; re-enable interrupts
076E: CD 79 19        CALL    $1979               ; {code.drawCreditReadout} repaint the credit readout
0771: CD D6 09        CALL    $09D6               ; {code.clearPlayfield} clear the play-field
0774: 21 13 30        LXI     H,$3013             
0777: 11 F3 1F        LXI     D,$1FF3             
077A: 0E 04           MVI     C,$04               
077C: CD F3 08        CALL    $08F3               ; {code.drawSpriteList} draw the 4-glyph push-start prompt near the top of the screen

loc_077f:
077F: 3A EB 20        LDA     $20EB               ; read the banked credit tally ($20eb)
0782: 3D              DCR     A                   ; is exactly one credit banked?
0783: 21 10 28        LXI     H,$2810             
0786: 0E 14           MVI     C,$14               
0788: C2 57 08        JNZ     $0857               ; two or more credits -> also offer the two-player start
078B: 11 CF 1A        LXI     D,$1ACF             ; point at the one-player select prompt text ($1acf)
078E: CD F3 08        CALL    $08F3               ; {code.drawSpriteList} draw the one-player select prompt
0791: DB 01           IN      $01                 ; read the start-button input port 1
0793: E6 04           ANI     $04                 ; one-player start button -- bit 2
0795: CA 7F 07        JZ      $077F               ; no start pressed -> poll again next frame

loc_0798:
0798: 06 99           MVI     B,$99               ; one-player start: deduct one credit (0x99 = BCD -1)
079A: AF              XRA     A                   ; one-player mode flag (0)

loc_079b:
079B: 32 CE 20        STA     $20CE               ; record the player-count mode ($20ce)
079E: 3A EB 20        LDA     $20EB               ; read the credit tally
07A1: 80              ADD     B                   ; charge the started game's credits -- BCD-add the deduction
07A2: 27              DAA                         
07A3: 32 EB 20        STA     $20EB               
07A6: CD 47 19        CALL    $1947               ; {code.drawCreditCount} repaint the credit readout
07A9: 21 00 00        LXI     H,$0000             
07AC: 22 F8 20        SHLD    $20F8               ; zero player 1's score value ($20f8)
07AF: 22 FC 20        SHLD    $20FC               ; zero player 2's score value ($20fc)
07B2: CD 25 19        CALL    $1925               ; {code.drawPlayer1Score} repaint player 1's score line
07B5: CD 2B 19        CALL    $192B               ; {code.drawPlayer2Score} repaint player 2's score line
07B8: CD D7 19        CALL    $19D7               ; {code.clearGameActive} drop the game-active flag -- the round chain re-raises it
07BB: 21 01 01        LXI     H,$0101             
07BE: 7C              MOV     A,H                 
07BF: 32 EF 20        STA     $20EF               ; raise the game-in-progress flag ($20ef)
07C2: 22 E7 20        SHLD    $20E7               ; seed the per-player flag pair at $20e7 to 1/1
07C5: 22 E5 20        SHLD    $20E5               ; arm both players' extra-ship award ($20e5)
07C8: CD 56 19        CALL    $1956               ; {code.redrawScorePanel} repaint the whole score panel
07CB: CD EF 01        CALL    $01EF               ; {code.initPlayer1ShieldBuffers} lay in fresh shields for player 1
07CE: CD F5 01        CALL    $01F5               ; {code.initPlayer2ShieldBuffers} lay in fresh shields for player 2
07D1: CD D1 08        CALL    $08D1               ; {code.readStartingShips} read the starting-ship count from the dip switches
07D4: 32 FF 21        STA     $21FF               ; store it as player 1's reserve-ship count ($21ff)
07D7: 32 FF 22        STA     $22FF               ; store it as player 2's reserve-ship count ($22ff)
07DA: CD D7 00        CALL    $00D7               ; {code.loc_00d7} seed the per-player fleet-step cells and blank the fixed strip
07DD: AF              XRA     A                   
07DE: 32 FE 21        STA     $21FE               ; zero player 1's round counter ($21fe)
07E1: 32 FE 22        STA     $22FE               ; zero player 2's round counter ($22fe)
07E4: CD C0 01        CALL    $01C0               ; {code.markAllAliensAliveP1} mark player 1's whole alien field alive
07E7: CD 04 19        CALL    $1904               ; {code.markAllAliensAliveP2} mark player 2's whole alien field alive
07EA: 21 78 38        LXI     H,$3878             ; the fleet's starting reference corner (0x3878)
07ED: 22 FC 21        SHLD    $21FC               ; seat it as player 1's saved fleet coordinate ($21fc)
07F0: 22 FC 22        SHLD    $22FC               ; seat it as player 2's saved fleet coordinate ($22fc)
07F3: CD E4 01        CALL    $01E4               ; {code.seedWorkRamImage} reseed work RAM from its ROM image
07F6: CD 7F 1A        CALL    $1A7F               ; {code.decrementShipsAndDrawReadout} take the first ship into play and repaint the ships readout

loc_07f9:
07F9: CD 8D 08        CALL    $088D               ; {code.loc_088d} play the round-start splash -- hold ~176 frames flashing the score
07FC: CD D6 09        CALL    $09D6               ; {code.clearPlayfield} wipe the play-field for the new round
07FF: 00              NOP                         
0800: AF              XRA     A                   
0801: 32 C1 20        STA     $20C1               ; clear the per-frame drawing-task flags ($20c1)

loc_0804:
0804: CD CF 01        CALL    $01CF               ; {code.drawBottomLine} repaint the bottom ground line
0807: 3A 67 20        LDA     $2067               ; read the active-player page byte ($2067)
080A: 0F              RRC                         ; test the active-player select bit
080B: DA 72 08        JC      $0872               ; player 1 -> restore player 1's shields and enter the round
080E: CD 13 02        CALL    $0213               ; {code.restorePlayer2Shields} restore player 2's saved shields onto the field
0811: CD CF 01        CALL    $01CF               ; {code.drawBottomLine} repaint the bottom line after the shield restore

loc_0814:
0814: CD B1 00        CALL    $00B1               ; {code.loadReferenceAlienState} reload this player's saved fleet position so the march resumes

loc_0817:
0817: CD D1 19        CALL    $19D1               ; {code.setGameActive} raise the master game-active flag -- play begins
081A: 06 20           MVI     B,$20               
081C: CD FA 18        CALL    $18FA               ; {code.startSound} cue the round-start sound (port-3 mask 0x20)

loc_081f:
081F: CD 18 16        CALL    $1618               ; {code.advanceRoundState} advance the pre-round arm step / player-shot arm
0822: CD 0A 19        CALL    $190A               ; {code.resolveShotAndFleetEdge} step the player shot and reverse-and-drop the fleet at an edge
0825: CD F3 15        CALL    $15F3               ; {code.countLiveAliens} recount the surviving aliens into the tally ($2082)
0828: CD 88 09        CALL    $0988               ; {code.applyPendingScoreAdd} fold any queued score into the player's running total
082B: 3A 82 20        LDA     $2082               ; read the live-alien tally
082E: A7              ANA     A                   
082F: CA EF 09        JZ      $09EF               ; wave cleared -> hand off to this player's next round
0832: CD 0E 17        CALL    $170E               ; {code.selectAlienShotRate} pick the alien-shot cadence from how thin the fleet is
0835: CD 35 09        CALL    $0935               ; {code.awardExtraShip} grant the one-time bonus ship at the score threshold
0838: CD D8 08        CALL    $08D8               ; {code.setAlienShotStepWhenFew} speed the alien shots when only a few aliens remain
083B: CD 2C 17        CALL    $172C               ; {code.updatePlayerShotSound} match the player-shot sound bit to whether a shot is in flight
083E: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet} check the round-start arm trigger
0841: CA 49 08        JZ      $0849               ; skip the round-start blip when the arm trigger is set
0844: 06 04           MVI     B,$04               
0846: CD FA 18        CALL    $18FA               ; {code.startSound} play the round-start sound cue (0x04)

loc_0849:
0849: CD 75 17        CALL    $1775               ; {code.advanceFleetMarchSound} advance the fleet-march footstep pitch and tempo
084C: D3 06           OUT     $06                 ; kick the hardware watchdog (port 6) -- each frame or it resets
084E: CD 04 18        CALL    $1804               ; {code.updateSaucerSound} drive the saucer whine on and off from its flags
0851: C3 1F 08        JMP     $081F               ; repeat the frame loop

; ---- $0854-$0856: data ----
0854: 00 00 00

loc_0857:
0857: 11 BA 1A        LXI     D,$1ABA             ; point at the two-player select prompt text ($1aba)
085A: CD F3 08        CALL    $08F3               ; {code.drawSpriteList} draw the two-player select prompt
085D: 06 98           MVI     B,$98               ; a two-player start would deduct two credits (0x98 = BCD -2)
085F: DB 01           IN      $01                 ; read the start-button input port 1
0861: 0F              RRC                         
0862: 0F              RRC                         ; two-player start button -- bit 1
0863: DA 6D 08        JC      $086D               ; two-player start pressed -> begin a two-player game
0866: 0F              RRC                         ; one-player start button -- bit 2
0867: DA 98 07        JC      $0798               ; one-player start pressed -> begin a one-player game
086A: C3 7F 07        JMP     $077F               ; no start pressed -> poll again next frame

loc_086d:
086D: 3E 01           MVI     A,$01               ; two-player mode flag (1)
086F: C3 9B 07        JMP     $079B               ; enter the shared game-start init

loc_0872:
0872: CD 1A 02        CALL    $021A               ; {code.restorePlayer1Shields} restore player 1's saved shields onto the field
0875: C3 14 08        JMP     $0814               ; enter the round with the field reloaded

; stage the active player's field save: B := [$2008], DE := [$2009] word,
; HL := activeFieldRecordPointer
stageActivePlayerFieldSave:
0878: 3A 08 20        LDA     $2008               ; read the working alien count ($2008)
087B: 47              MOV     B,A                 
087C: 2A 09 20        LHLD    $2009               ; read the reference-alien coordinate word ($2009)
087F: EB              XCHG                        
0880: C3 86 08        JMP     $0886               ; aim at the active player's field-save slot

; ---- $0883-$0885: data ----
0883: 00 00 00

; build HL = (ACTIVE_PLAYER_PAGE << 8) | 0xfc
activeFieldRecordPointer:
0886: 3A 67 20        LDA     $2067               ; read the active-player page byte ($2067)
0889: 67              MOV     H,A                 ; use it as the record's high byte
088A: 2E FC           MVI     L,$FC               ; pin the low byte to 0xfc -- the field-save record at page:0xfc
088C: C9              RET                         

loc_088d:
088D: 21 11 2B        LXI     H,$2B11             ; aim at the round-start banner's on-screen position
0890: 11 70 1B        LXI     D,$1B70             
0893: 0E 0E           MVI     C,$0E               
0895: CD F3 08        CALL    $08F3               ; {code.drawSpriteList} lay down the 14-glyph round-start banner
0898: 3A 67 20        LDA     $2067               ; read the active-player select bit
089B: 0F              RRC                         
089C: 3E 1C           MVI     A,$1C               
089E: 21 11 37        LXI     H,$3711             
08A1: D4 FF 08        CNC     $08FF               ; for player 2, add one more banner sprite
08A4: 3E B0           MVI     A,$B0               
08A6: 32 C0 20        STA     $20C0               ; hold ~176 frames -- seed the vblank-drained delay timer ($20c0)

loc_08a9:
08A9: 3A C0 20        LDA     $20C0               ; read the delay timer the interrupt drains
08AC: A7              ANA     A                   
08AD: C8              RZ                          ; the splash ends when the timer reaches 0
08AE: E6 04           ANI     $04                 ; flash phase -- bit 2 of the counter
08B0: C2 BC 08        JNZ     $08BC               ; off half -> blank the score strip
08B3: CD CA 09        CALL    $09CA               ; {code.currentPlayerRecordPtr} on half -> point at the active player's score record
08B6: CD 31 19        CALL    $1931               ; {code.drawScoreRecord} repaint the active player's score
08B9: C3 A9 08        JMP     $08A9               ; hold this frame and re-test the timer

loc_08bc:
08BC: 06 20           MVI     B,$20               ; score-strip width 0x20
08BE: 21 1C 27        LXI     H,$271C             ; player 1's score-strip address
08C1: 3A 67 20        LDA     $2067               
08C4: 0F              RRC                         
08C5: DA CB 08        JC      $08CB               ; select the score strip for the active player
08C8: 21 1C 39        LXI     H,$391C             ; player 2's score-strip address

loc_08cb:
08CB: CD CB 14        CALL    $14CB               ; {code.clearScreenStrip} blank the score strip -- the off half of the flash
08CE: C3 A9 08        JMP     $08A9               ; hold this frame and re-test the timer

; A = (port2 & 3) + 3
readStartingShips:
08D1: DB 02           IN      $02                 ; read hardware input port 2 -- carries the starting-ships dip switch
08D3: E6 03           ANI     $03                 ; keep the low two bits -- the ships-count selection
08D5: C6 03           ADI     $03                 ; bias up by three -- a 3..6 starting-ship count
08D7: C9              RET                         

; if ALIEN_COUNT < 9: ALIEN_SHOT_STEP = 0xfb
setAlienShotStepWhenFew:
08D8: 3A 82 20        LDA     $2082               ; read the live-alien tally
08DB: FE 09           CPI     $09                 ; compare it against nine
08DD: D0              RNC                         ; leave the alien-shot step untouched while nine or more aliens remain
08DE: 3E FB           MVI     A,$FB               ; load the fast alien-shot descent step
08E0: 32 7E 20        STA     $207E               ; stamp it as the alien shots' per-frame Y step once the fleet is thin
08E3: C9              RET                         

; return early when TWO_PLAYER_GAME is set, else clearScreenStrip blanks a
; 0x20-column VRAM strip at $391C
blankScreenStrip:
08E4: 3A CE 20        LDA     $20CE               ; read the two-player-game flag
08E7: A7              ANA     A                   ; test the two-player flag
08E8: C0              RNZ                         ; in a two-player game, leave the screen strip alone
08E9: 21 1C 39        LXI     H,$391C             ; point at the fixed screen strip to blank
08EC: 06 20           MVI     B,$20               ; set the run length to 0x20 columns
08EE: C3 CB 14        JMP     $14CB               ; hand off to the strip clearer to zero the run

; seat count C=3, then drawSpriteList blits three consecutive 8x8 sprites
; from (DE)
drawThreeSprites:
08F1: 0E 03           MVI     C,$03               ; fix the glyph count at three -- falls into the sprite-list driver

; draw C consecutive sprite ids from (DE) as a run of 8x8 sprites via
; drawSprite8x8
drawSpriteList:
08F3: 1A              LDAX    D                   ; fetch the next sprite id from the list
08F4: D5              PUSH    D                   
08F5: CD FF 08        CALL    $08FF               ; {code.drawSprite8x8} draw the glyph for that id
08F8: D1              POP     D                   
08F9: 13              INX     D                   ; step to the next sprite id
08FA: 0D              DCR     C                   ; count down the remaining glyphs
08FB: C2 F3 08        JNZ     $08F3               ; loop until the whole run is drawn
08FE: C9              RET                         

; resolve sprite id A to its 8-byte source at SPRITE_BITMAP_TABLE+8*A,
; latch A to port 6, blit an 8x8 sprite via drawSpriteColumn
drawSprite8x8:
08FF: 11 00 1E        LXI     D,$1E00             ; point at the base of the 8-bytes-per-glyph sprite bitmap table
0902: E5              PUSH    H                   
0903: 26 00           MVI     H,$00               ; clear the index high byte
0905: 6F              MOV     L,A                 ; seat the sprite id as the low index byte
0906: 29              DAD     H                   ; double the index
0907: 29              DAD     H                   ; double it again
0908: 29              DAD     H                   ; double a third time -- id x8, eight bytes per glyph
0909: 19              DAD     D                   ; add the table base -> the glyph's eight source bytes
090A: EB              XCHG                        
090B: E1              POP     H                   
090C: 06 08           MVI     B,$08               ; set the column height to eight rows
090E: D3 06           OUT     $06                 ; kick the hardware watchdog
0910: C3 39 14        JMP     $1439               ; blit the glyph's eight-row column into video memory

; gate on $2009<0x78, decrement 16-bit timer SAUCER_TIMER, reload 0x0600 +
; set flag $2083 on wrap
tickSaucerSpawnTimer:
0913: 3A 09 20        LDA     $2009               ; read the fleet-position anchor low byte -- the saucer-timer gate
0916: FE 78           CPI     $78                 ; compare it against 0x78
0918: D0              RNC                         ; freeze the saucer timer this pass unless the anchor is below 0x78
0919: 2A 91 20        LHLD    $2091               ; read the 16-bit saucer-spawn countdown
091C: 7D              MOV     A,L                 
091D: B4              ORA     H                   ; test whether the countdown has reached zero
091E: C2 29 09        JNZ     $0929               ; skip the reload while the countdown is still running
0921: 21 00 06        LXI     H,$0600             ; reload the countdown to its fixed spawn interval
0924: 3E 01           MVI     A,$01               ; raise the saucer-arm flag value
0926: 32 83 20        STA     $2083               ; arm the mystery saucer so its handler may launch one

loc_0929:
0929: 2B              DCX     H                   ; count the timer down by one
092A: 22 91 20        SHLD    $2091               ; store the updated countdown back
092D: C9              RET                         

; read the byte at the top of the active player's page
; ((mem[ACTIVE_PLAYER_PAGE]<<8)|0xff)
readActivePlayerPageTopByte:
092E: CD 11 16        CALL    $1611               ; {code.activePlayerPageBase} form the active player's page base (page<<8)
0931: 2E FF           MVI     L,$FF               ; address the top byte of that page -- the reserve-ship count
0933: 7E              MOV     A,M                 ; read the reserve-ship count
0934: C9              RET                         

; award the next reserve ship once the active player's tally passes the
; port-2-selected threshold: bump the stored ship count, redraw the
; reserve-ship column (RESERVE_SHIP_SPRITE) and lives digit, clear the
; award flag, seat SFX_OFF_TIMER=0xff, and cue the extra-ship sound (tail
; startSound 0x10)
awardExtraShip:
0935: CD 10 19        CALL    $1910               ; {code.activePlayerFlagPtr} get the active player's flag-pair slot
0938: 2B              DCX     H                   ; step back two bytes...
0939: 2B              DCX     H                   ; ...to the "extra ship not yet awarded" flag
093A: 7E              MOV     A,M                 ; read that award flag
093B: A7              ANA     A                   ; test the award flag
093C: C8              RZ                          ; bail if the bonus ship was already granted this game
093D: 06 15           MVI     B,$15               ; default the bonus threshold to BCD 1500
093F: DB 02           IN      $02                 ; read input port 2 -- the bonus-score dip switch
0941: E6 08           ANI     $08                 ; isolate the bonus-score dip bit
0943: CA 48 09        JZ      $0948               ; keep the 1500 threshold when the dip is clear
0946: 06 10           MVI     B,$10               ; else select the BCD 1000 bonus threshold

loc_0948:
0948: CD CA 09        CALL    $09CA               ; {code.currentPlayerRecordPtr} point at the active player's score record
094B: 23              INX     H                   ; step to its high byte -- the top two BCD score digits
094C: 7E              MOV     A,M                 ; read that score byte
094D: B8              CMP     B                   ; compare the score against the bonus threshold
094E: D8              RC                          ; bail until the score reaches the threshold
094F: CD 2E 09        CALL    $092E               ; {code.readActivePlayerPageTopByte} address the reserve-ship count at the top of the player's page
0952: 34              INR     M                   ; award the extra ship -- bump the reserve count by one
0953: 7E              MOV     A,M                 ; read the new reserve count
0954: F5              PUSH    PSW                 
0955: 21 01 25        LXI     H,$2501             ; seat the reserve-icon row base column

loc_0958:
0958: 24              INR     H                   ; step the icon column forward...
0959: 24              INR     H                   ; ...by two per reserve ship
095A: 3D              DCR     A                   ; count down the ships
095B: C2 58 09        JNZ     $0958               ; walk to the new ship's icon slot
095E: 06 10           MVI     B,$10               ; set the icon column height to 16 rows
0960: 11 60 1C        LXI     D,$1C60             ; point at the reserve-ship icon bitmap
0963: CD 39 14        CALL    $1439               ; {code.drawSpriteColumn} blit the reserve-ship icon into its column slot
0966: F1              POP     PSW                 
0967: 3C              INR     A                   ; add the ship in play to get the lives-digit value
0968: CD 8B 1A        CALL    $1A8B               ; {code.drawLivesDigit} redraw the numeric lives digit
096B: CD 10 19        CALL    $1910               ; {code.activePlayerFlagPtr} re-fetch the active player's flag-pair slot
096E: 2B              DCX     H                   ; step back two bytes...
096F: 2B              DCX     H                   ; ...to the award flag
0970: 36 00           MVI     M,$00               ; latch the award flag off -- the bonus fires only once per game
0972: 3E FF           MVI     A,$FF               ; set a long one-shot window...
0974: 32 99 20        STA     $2099               ; ...into the sound-off timer so the award chime rings out
0977: 06 10           MVI     B,$10               ; select sound bit 4 -- the extra-ship chime
0979: C3 FA 18        JMP     $18FA               ; cue the award chime

; HL = INVADER_SCORE_TABLE + clamp-index of A (offset 0 if A<2, 1 if
; 2<=A<4, 2 if A>=4)
invaderScoreEntryPtr:
097C: 21 A0 1D        LXI     H,$1DA0             ; point at the base of the three-tier invader score table
097F: FE 02           CPI     $02                 ; compare the invader-tier key against two
0981: D8              RC                          ; select the first tier's score entry when the key is below two
0982: 23              INX     H                   ; else advance to the second tier's entry
0983: FE 04           CPI     $04                 ; compare the key against four
0985: D8              RC                          ; select the second tier when the key is below four
0986: 23              INX     H                   ; else advance to the third tier's entry
0987: C9              RET                         

; when SCORE_ADD_PENDING is set, clear it and BCD-add the two-byte
; SCORE_ADD_VALUE into the active player's record accumulator (base from
; currentPlayerRecordPtr, 8080 DAA decimal carry), then redraw the total
; as four BCD glyphs at the record's screen address (tail drawBcdWord); a
; clear flag is a no-op
applyPendingScoreAdd:
0988: CD CA 09        CALL    $09CA               ; {code.currentPlayerRecordPtr} point HL at the active player's score record
098B: 3A F1 20        LDA     $20F1               ; read the pending score-add flag
098E: A7              ANA     A                   ; test whether a score add is queued
098F: C8              RZ                          ; return early when nothing is pending
0990: AF              XRA     A                   
0991: 32 F1 20        STA     $20F1               ; clear the pending flag so the next kill re-arms it
0994: E5              PUSH    H                   
0995: 2A F2 20        LHLD    $20F2               ; read the queued two-byte score delta
0998: EB              XCHG                        
0999: E1              POP     H                   
099A: 7E              MOV     A,M                 ; read the score's low BCD byte
099B: 83              ADD     E                   ; add the delta's low byte
099C: 27              DAA                         ; decimal-adjust to keep valid BCD digits
099D: 77              MOV     M,A                 ; store the updated low score byte
099E: 5F              MOV     E,A                 
099F: 23              INX     H                   
09A0: 7E              MOV     A,M                 ; read the score's high BCD byte
09A1: 8A              ADC     D                   ; add the delta's high byte with the decimal carry
09A2: 27              DAA                         ; decimal-adjust the high byte
09A3: 77              MOV     M,A                 ; store the updated high score byte
09A4: 57              MOV     D,A                 
09A5: 23              INX     H                   
09A6: 7E              MOV     A,M                 ; read the low byte of the score's stored screen address
09A7: 23              INX     H                   
09A8: 66              MOV     H,M                 ; read the high byte -- HL now points at the score on screen
09A9: 6F              MOV     L,A                 
09AA: C3 AD 09        JMP     $09AD               ; repaint the new four-digit total

; draw the 16-bit value in DE as four BCD digit glyphs -- high byte D then
; low byte E -- via drawBcdByte
drawBcdWord:
09AD: 7A              MOV     A,D                 
09AE: CD B2 09        CALL    $09B2               ; {code.drawBcdByte} draw the two most-significant digits -- the score's high byte
09B1: 7B              MOV     A,E                 ; load the low byte and fall through to draw its two digits

; draw the byte in A as two digit glyphs, high nibble then low, via
; drawDigit (BCD: each nibble is 0-9)
drawBcdByte:
09B2: D5              PUSH    D                   
09B3: F5              PUSH    PSW                 
09B4: 0F              RRC                         ; shift the high nibble down to the low four bits -- four rotates
09B5: 0F              RRC                         
09B6: 0F              RRC                         
09B7: 0F              RRC                         
09B8: E6 0F           ANI     $0F                 ; isolate the high decimal digit
09BA: CD C5 09        CALL    $09C5               ; {code.drawDigit} plot the high digit glyph
09BD: F1              POP     PSW                 
09BE: E6 0F           ANI     $0F                 ; isolate the low decimal digit
09C0: CD C5 09        CALL    $09C5               ; {code.drawDigit} plot the low digit glyph
09C3: D1              POP     D                   
09C4: C9              RET                         

; map a 0-9 value to its glyph id (A += 0x1a) and draw it via
; drawSprite8x8
drawDigit:
09C5: C6 1A           ADI     $1A                 ; add 0x1a to reach that digit's glyph id in the sprite table
09C7: C3 FF 08        JMP     $08FF               ; plot the digit as an 8x8 glyph

; HL = bit0 of ACTIVE_PLAYER_PAGE ? PLAYER1_OBJ_DESC : PLAYER2_OBJ_DESC
; (active player's data pointer)
currentPlayerRecordPtr:
09CA: 3A 67 20        LDA     $2067               ; read the active-player selector
09CD: 0F              RRC                         ; rotate the player bit into carry
09CE: 21 F8 20        LXI     H,$20F8             ; point HL at player 1's score record
09D1: D8              RC                          ; keep it when player 1 is active
09D2: 21 FC 20        LXI     H,$20FC             ; otherwise point at player 2's score record
09D5: C9              RET                         

; clear the play-field framebuffer
clearPlayfield:
09D6: 21 02 24        LXI     H,$2402             ; point at the first play-area byte -- past the two-byte bottom margin

loc_09d9:
09D9: 36 00           MVI     M,$00               ; blank the current framebuffer byte
09DB: 23              INX     H                   ; step one byte down the column
09DC: 7D              MOV     A,L                 
09DD: E6 1F           ANI     $1F                 ; take the within-column offset -- low five bits
09DF: FE 1C           CPI     $1C                 ; check whether this column's play area is finished
09E1: DA E8 09        JC      $09E8               ; stay in the play area until the reserved band is reached
09E4: 11 06 00        LXI     D,$0006             
09E7: 19              DAD     D                   ; skip the six reserved band bytes to the next column's play area

loc_09e8:
09E8: 7C              MOV     A,H                 
09E9: FE 40           CPI     $40                 ; check whether the sweep has passed the end of video RAM
09EB: DA D9 09        JC      $09D9               ; loop until every column is cleared
09EE: C9              RET                         

loc_09ef:
09EF: CD 3C 0A        CALL    $0A3C               ; {code.loc_0a3c} wait out the between-round handshake
09F2: AF              XRA     A                   
09F3: 32 E9 20        STA     $20E9               ; drop the game-active flag for the handoff
09F6: CD D6 09        CALL    $09D6               ; {code.clearPlayfield} wipe the play area
09F9: 3A 67 20        LDA     $2067               ; read the active-player selector before the work-RAM reseed
09FC: F5              PUSH    PSW                 ; save the selector -- the reseed overwrites this cell
09FD: CD E4 01        CALL    $01E4               ; {code.seedWorkRamImage} restamp work RAM from the ROM template
0A00: F1              POP     PSW                 ; recover the saved selector
0A01: 32 67 20        STA     $2067               ; restore it so the same player continues
0A04: 3A 67 20        LDA     $2067               ; read the active player's page
0A07: 67              MOV     H,A                 
0A08: E5              PUSH    H                   
0A09: 2E FE           MVI     L,$FE               ; address this player's round counter at page:0xfe
0A0B: 7E              MOV     A,M                 ; read the round counter
0A0C: E6 07           ANI     $07                 ; mask to the low three bits -- rounds 0-7
0A0E: 3C              INR     A                   ; advance to the next round
0A0F: 77              MOV     M,A                 ; store the bumped round index
0A10: 21 A2 1D        LXI     H,$1DA2             ; point at the round fleet-start table

loc_0a13:
0A13: 23              INX     H                   ; step the table pointer forward one entry per round index
0A14: 3D              DCR     A                   
0A15: C2 13 0A        JNZ     $0A13               
0A18: 7E              MOV     A,M                 ; read this round's fleet-start byte
0A19: E1              POP     H                   
0A1A: 2E FC           MVI     L,$FC               ; address this player's field-save record at page:0xfc
0A1C: 77              MOV     M,A                 ; seed the fleet reference-alien low byte for the new round
0A1D: 23              INX     H                   
0A1E: 36 38           MVI     M,$38               ; set the fixed reference-alien high byte -- 0x38
0A20: 7C              MOV     A,H                 
0A21: 0F              RRC                         ; rotate the page bit into carry to pick the player
0A22: DA 33 0A        JC      $0A33               ; branch to the player-1 refill when player 1 is active
0A25: 3E 21           MVI     A,$21               ; load player 2's sound-select value
0A27: 32 98 20        STA     $2098               ; seed player 2's port-5 sound latch shadow
0A2A: CD F5 01        CALL    $01F5               ; {code.initPlayer2ShieldBuffers} re-stock player 2's shield buffers
0A2D: CD 04 19        CALL    $1904               ; {code.markAllAliensAliveP2} mark all of player 2's aliens alive
0A30: C3 04 08        JMP     $0804               ; enter the round-start preamble

loc_0a33:
0A33: CD EF 01        CALL    $01EF               ; {code.initPlayer1ShieldBuffers} re-stock player 1's shield buffers
0A36: CD C0 01        CALL    $01C0               ; {code.markAllAliensAliveP1} mark all of player 1's aliens alive
0A39: C3 04 08        JMP     $0804               ; enter the round-start preamble

loc_0a3c:
0A3C: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet} poll the round-start arm trigger
0A3F: C2 52 0A        JNZ     $0A52               ; if not yet armed, wait for it to arm
0A42: 3E 30           MVI     A,$30               ; load a 48-frame hold
0A44: 32 C0 20        STA     $20C0               ; seat the frame-delay countdown

loc_0a47:
0A47: 3A C0 20        LDA     $20C0               ; read the frame-delay countdown
0A4A: A7              ANA     A                   
0A4B: C8              RZ                          ; proceed once the hold times out
0A4C: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet} re-poll the arm trigger
0A4F: CA 47 0A        JZ      $0A47               ; keep holding while still armed

loc_0a52:
0A52: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet} wait for the arm trigger to read armed
0A55: C2 52 0A        JNZ     $0A52               ; loop until it arms
0A58: C9              RET                         

; poll [$2015] against 0xff and report equality in the Z flag; reads no
; register, writes no memory
isArmTriggerSet:
0A59: 3A 15 20        LDA     $2015               ; read the round-start arm sentinel
0A5C: FE FF           CPI     $FF                 ; test whether it holds the armed value 0xff
0A5E: C9              RET                         

; if [GAME_IN_PROGRESS]!=0: startSound(0x08), index the 3-entry table via
; invaderScoreEntryPtr(B), stamp SCORE_ADD_VALUE=table byte /
; SCORE_ADD_PENDING=0x01 /
queueInvaderKillScore:
0A5F: 3A EF 20        LDA     $20EF               ; read the game-in-progress flag
0A62: A7              ANA     A                   
0A63: CA 7C 0A        JZ      $0A7C               ; skip scoring and sound during the attract demo
0A66: 48              MOV     C,B                 
0A67: 06 08           MVI     B,$08               ; select the invader-die sound -- port-3 bit 3
0A69: CD FA 18        CALL    $18FA               ; {code.startSound} fire the invader-die tone
0A6C: 41              MOV     B,C                 
0A6D: 78              MOV     A,B                 
0A6E: CD 7C 09        CALL    $097C               ; {code.invaderScoreEntryPtr} look up this alien row's point value
0A71: 7E              MOV     A,M                 ; read the point value byte
0A72: 21 F3 20        LXI     H,$20F3             ; address the pending score-add packet
0A75: 36 00           MVI     M,$00               ; clear the delta's high byte -- a single-byte value
0A77: 2B              DCX     H                   
0A78: 77              MOV     M,A                 ; stage the point value as the pending delta
0A79: 2B              DCX     H                   
0A7A: 36 01           MVI     M,$01               ; raise the pending flag so the score is folded in later

loc_0a7c:
0A7C: 21 62 20        LXI     H,$2062             ; return the kill-explosion sprite descriptor pointer
0A7F: C9              RET                         

; arm ISR anim task (TASK_FLAGS 0x20c1=2) and wait until ANIM_DONE_FLAG
; 0x20cb is raised, then clear the task
runAttractAnimTask:
0A80: 3E 02           MVI     A,$02               ; select the attract-animation task bit
0A82: 32 C1 20        STA     $20C1               ; arm the interrupt-driven title animation task

loc_0a85:
0A85: D3 06           OUT     $06                 ; kick the hardware watchdog while spinning
0A87: 3A CB 20        LDA     $20CB               ; read the animation-done flag
0A8A: A7              ANA     A                   
0A8B: CA 85 0A        JZ      $0A85               ; spin until the interrupt signals the animation finished
0A8E: AF              XRA     A                   
0A8F: 32 C1 20        STA     $20C1               ; disarm the task so the interrupt stops servicing it
0A92: C9              RET                         

; type c sprite bytes from de onto hl, pacing 7 vblank frames per byte on
; FRAME_DELAY_TIMER
typePacedSpriteRun:
0A93: D5              PUSH    D                   
0A94: 1A              LDAX    D                   ; read the current glyph id from the source list
0A95: CD FF 08        CALL    $08FF               ; {code.drawSprite8x8} draw the glyph, advancing the screen destination
0A98: D1              POP     D                   
0A99: 3E 07           MVI     A,$07               ; load the 7-frame typing pace
0A9B: 32 C0 20        STA     $20C0               ; seat the frame-delay countdown

loc_0a9e:
0A9E: 3A C0 20        LDA     $20C0               ; read the frame-delay countdown
0AA1: 3D              DCR     A                   
0AA2: C2 9E 0A        JNZ     $0A9E               ; wait the pace out -- one frame per pass
0AA5: 13              INX     D                   ; advance to the next glyph id
0AA6: 0D              DCR     C                   ; count this glyph off
0AA7: C2 93 0A        JNZ     $0A93               ; repeat until the run is drawn
0AAA: C9              RET                         

loc_0aab:
0AAB: 21 50 20        LXI     H,$2050             ; point HL at the attract-animation object scratch
0AAE: C3 4B 02        JMP     $024B               

; 0x40-frame attract delay -> waitFrames
waitShortDelay:
0AB1: 3E 40           MVI     A,$40               ; load the 0x40-frame short attract delay count
0AB3: C3 D7 0A        JMP     $0AD7               ; wait that many displayed frames on the frame counter

; 0x80-frame attract delay -> waitFrames
waitLongDelay:
0AB6: 3E 80           MVI     A,$80               ; load the 0x80-frame long attract delay count
0AB8: C3 D7 0A        JMP     $0AD7               ; wait that many displayed frames on the frame counter

loc_0abb:
0ABB: E1              POP     H                   ; discard the dispatcher's return address
0ABC: C3 72 00        JMP     $0072               ; run the per-frame demo record tail -- draw the pending alien, tick the saucer-spawn timer -- exiting through the interrupt epilogue

loc_0abf:
0ABF: 3A C1 20        LDA     $20C1               ; read the per-frame task bitfield
0AC2: 0F              RRC                         ; shift task bit 0 into carry
0AC3: DA BB 0A        JC      $0ABB               ; bit 0 set -- run the demo record tail
0AC6: 0F              RRC                         ; test task bit 1
0AC7: DA 68 18        JC      $1868               ; bit 1 set -- step one scripted-animation frame
0ACA: 0F              RRC                         ; test task bit 2
0ACB: DA AB 0A        JC      $0AAB               ; bit 2 set -- run the attract-object handler
0ACE: C9              RET                         ; no frame task queued -- return

; type the 0x0f-byte block to ATTRACT_BODY_SCREEN_ADDR using the caller's
; source de -> typePacedSpriteRun
typeAttractBlock:
0ACF: 21 14 2B        LXI     H,$2B14             ; point at the fixed attract-body screen destination
0AD2: 0E 0F           MVI     C,$0F               ; set the 0x0f-glyph block length
0AD4: C3 93 0A        JMP     $0A93               ; type the block one glyph per cadence window from the caller's source

; vblank busy-wait: seed FRAME_DELAY_TIMER 0x20c0 = a and wait until the
; vblank ISR drains it to 0
waitFrames:
0AD7: 32 C0 20        STA     $20C0               ; seed the frame-delay counter with the requested count

loc_0ada:
0ADA: 3A C0 20        LDA     $20C0               ; re-read the frame-delay counter
0ADD: A7              ANA     A                   ; test whether it has reached zero
0ADE: C2 DA 0A        JNZ     $0ADA               ; keep waiting while the interrupt drains it toward zero
0AE1: C9              RET                         

; blockCopy the 12-byte draw/animation sequence from (DE) into
; ANIM_FRAME_COUNTER
loadDrawSequenceBlock:
0AE2: 21 C2 20        LXI     H,$20C2             ; point at the animation state block -- frame counter plus coordinate steps
0AE5: 06 0C           MVI     B,$0C               ; set the 12-byte copy length
0AE7: C3 32 1A        JMP     $1A32               ; copy the draw sequence from the caller's source into the animation slot

; attract round setup + free-run demo loop: silence sound, ei, type the
; attract screens, seed the field, then per-frame advanceRoundState
; (advances ATTRACT_DEMO_PTR 0x20ed) until $2015 leaves 0xff; falls into
; finishAttractCycle
runAttractCycle:
0AEA: AF              XRA     A                   ; clear A to silence the sound ports
0AEB: D3 03           OUT     $03                 ; silence the discrete-sound output port
0AED: D3 05           OUT     $05                 ; silence the fleet-march and saucer sound port
0AEF: CD 82 19        CALL    $1982               ; {code.storeTaskFlags} clear the per-frame task flags
0AF2: FB              EI                          ; enable interrupts so the frame heartbeat paces the delays
0AF3: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay} hold for the short attract delay
0AF6: 3A EC 20        LDA     $20EC               ; read the attract-screen alternator
0AF9: A7              ANA     A                   ; test which of the two attract screens to show
0AFA: 21 17 30        LXI     H,$3017             ; point at the heading's screen destination
0AFD: 0E 04           MVI     C,$04               ; set the 4-glyph heading length
0AFF: C2 E8 0B        JNZ     $0BE8               ; on the alternate attract screen, type the PLAY heading instead
0B02: 11 FA 1C        LXI     D,$1CFA             ; select the default attract-heading text source
0B05: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun} type the heading one glyph per cadence window
0B08: 11 AF 1D        LXI     D,$1DAF             ; point at the SPACE INVADERS title-block source

loc_0b0b:
0B0B: CD CF 0A        CALL    $0ACF               ; {code.typeAttractBlock} type the 0x0f-glyph title block
0B0E: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay} short attract delay
0B11: CD 15 18        CALL    $1815               ; {code.drawScoreAdvanceTable} draw the score-advance points table
0B14: CD B6 0A        CALL    $0AB6               ; {code.waitLongDelay} long attract delay
0B17: 3A EC 20        LDA     $20EC               ; re-read the attract-screen alternator
0B1A: A7              ANA     A                   ; test the screen mode
0B1B: C2 4A 0B        JNZ     $0B4A               ; skip the reveal sequence on the alternate screen
0B1E: 11 95 1A        LXI     D,$1A95             ; point at the first reveal draw sequence
0B21: CD E2 0A        CALL    $0AE2               ; {code.loadDrawSequenceBlock} load it into the animation slot
0B24: CD 80 0A        CALL    $0A80               ; {code.runAttractAnimTask} arm the animation task and wait for the reveal to finish
0B27: 11 B0 1B        LXI     D,$1BB0             ; point at the second reveal draw sequence
0B2A: CD E2 0A        CALL    $0AE2               ; {code.loadDrawSequenceBlock} load it into the animation slot
0B2D: CD 80 0A        CALL    $0A80               ; {code.runAttractAnimTask} run the second reveal
0B30: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay} short attract delay
0B33: 11 C9 1F        LXI     D,$1FC9             ; point at the third reveal draw sequence
0B36: CD E2 0A        CALL    $0AE2               ; {code.loadDrawSequenceBlock} load it into the animation slot
0B39: CD 80 0A        CALL    $0A80               ; {code.runAttractAnimTask} run the third reveal
0B3C: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay} short attract delay
0B3F: 21 B7 33        LXI     H,$33B7             ; point at the screen strip to clear
0B42: 06 0A           MVI     B,$0A               ; set the 0x0a-row clear height
0B44: CD CB 14        CALL    $14CB               ; {code.clearScreenStrip} blank that screen strip
0B47: CD B6 0A        CALL    $0AB6               ; {code.waitLongDelay} long attract delay

loc_0b4a:
0B4A: CD D6 09        CALL    $09D6               ; {code.clearPlayfield} clear the playfield -- leaving the score band and status line
0B4D: 3A FF 21        LDA     $21FF               ; read the starting-ships latch
0B50: A7              ANA     A                   ; test whether the reserve-ship count has been seeded
0B51: C2 5D 0B        JNZ     $0B5D               ; skip seeding when it is already set
0B54: CD D1 08        CALL    $08D1               ; {code.readStartingShips} read the starting-ships dip setting
0B57: 32 FF 21        STA     $21FF               ; store it as the reserve-ship count
0B5A: CD 7F 1A        CALL    $1A7F               ; {code.decrementShipsAndDrawReadout} decrement the ship count and paint its readout

loc_0b5d:
0B5D: CD E4 01        CALL    $01E4               ; {code.seedWorkRamImage} reseed work RAM from the ROM image
0B60: CD C0 01        CALL    $01C0               ; {code.markAllAliensAliveP1} mark a full player-1 alien wave alive
0B63: CD EF 01        CALL    $01EF               ; {code.initPlayer1ShieldBuffers} initialize the player-1 shield buffers
0B66: CD 1A 02        CALL    $021A               ; {code.restorePlayer1Shields} paint the player-1 shields
0B69: 3E 01           MVI     A,$01               ; arm the demo's per-frame record task -- bit 0
0B6B: 32 C1 20        STA     $20C1               ; store it into the task bitfield
0B6E: CD CF 01        CALL    $01CF               ; {code.drawBottomLine} draw the ground line across the bottom of the field

loc_0b71:
0B71: CD 18 16        CALL    $1618               ; {code.advanceRoundState} advance the demo/round state one step
0B74: CD F1 0B        CALL    $0BF1               ; {code.updateFleetAndDrawCopyright} run the fleet-edge update and the input-gated copyright draw
0B77: D3 06           OUT     $06                 ; kick the watchdog with the result
0B79: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet} poll the round-state arm trigger
0B7C: CA 71 0B        JZ      $0B71               ; loop back to keep running the demo until the round-state trigger changes
0B7F: AF              XRA     A                   
0B80: 32 25 20        STA     $2025               ; clear the player-shot status

loc_0b83:
0B83: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet} poll the arm trigger again
0B86: C2 83 0B        JNZ     $0B83               ; spin here until the round-state trigger settles before teardown

; attract round teardown: credit/high-score panel + typed script + ISR-
; handshaked reveal (runHandshakedAttractAnim), flip SCREEN_MODE_TOGGLE
; 0x20ec, tail-jmp enterAttractCycle
finishAttractCycle:
0B89: AF              XRA     A                   
0B8A: 32 C1 20        STA     $20C1               ; clear the per-frame task bitfield -- nothing queued during teardown
0B8D: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay} short settle delay
0B90: CD 88 19        CALL    $1988               ; {code.loc_1988} blank the play field
0B93: 0E 0C           MVI     C,$0C               ; set the 0x0c-glyph panel length
0B95: 21 11 2C        LXI     H,$2C11             ; point at the insert-coin panel screen destination
0B98: 11 90 1F        LXI     D,$1F90             ; point at the insert-coin glyph-id source
0B9B: CD F3 08        CALL    $08F3               ; {code.drawSpriteList} draw the sprite-list panel
0B9E: 3A EC 20        LDA     $20EC               ; read the attract-screen alternator
0BA1: FE 00           CPI     $00                 ; test for the first attract screen
0BA3: C2 AE 0B        JNZ     $0BAE               ; skip the extra glyph on the alternate screen
0BA6: 21 11 33        LXI     H,$3311             ; point at the extra glyph's screen destination
0BA9: 3E 02           MVI     A,$02               ; select sprite id 0x02
0BAB: CD FF 08        CALL    $08FF               ; {code.drawSprite8x8} draw that single 8x8 glyph

loc_0bae:
0BAE: 01 9C 1F        LXI     B,$1F9C             ; point at the draw-record source
0BB1: CD 56 18        CALL    $1856               ; {code.fetchNextDrawRecord} fetch the next draw record -- destination plus glyph source
0BB4: CD 4C 18        CALL    $184C               ; {code.typeDrawScriptRecord} type the record out glyph by glyph
0BB7: DB 02           IN      $02                 ; read input port 2
0BB9: 07              RLC                         ; shift the second-script select bit into carry
0BBA: DA C3 0B        JC      $0BC3               ; skip the extra script when that bit is set
0BBD: 01 A0 1F        LXI     B,$1FA0             ; point at the extra draw script
0BC0: CD 3A 18        CALL    $183A               ; {code.typeDrawScript} type the extra draw script

loc_0bc3:
0BC3: CD B6 0A        CALL    $0AB6               ; {code.waitLongDelay} long hold so the screen can be read
0BC6: 3A EC 20        LDA     $20EC               ; read the attract-screen alternator
0BC9: FE 00           CPI     $00                 ; test for the first attract screen
0BCB: C2 DA 0B        JNZ     $0BDA               ; skip the reveal animation on the alternate screen
0BCE: 11 D5 1F        LXI     D,$1FD5             ; point at the reveal draw sequence
0BD1: CD E2 0A        CALL    $0AE2               ; {code.loadDrawSequenceBlock} load it into the animation slot
0BD4: CD 80 0A        CALL    $0A80               ; {code.runAttractAnimTask} arm the animation task and wait for it
0BD7: CD 9E 18        CALL    $189E               ; {code.runHandshakedAttractAnim} run the interrupt-handshaked reveal animation

loc_0bda:
0BDA: 21 EC 20        LXI     H,$20EC             ; point at the attract-screen alternator
0BDD: 7E              MOV     A,M                 ; read its current value
0BDE: 3C              INR     A                   ; bump it
0BDF: E6 01           ANI     $01                 ; keep only the low bit -- flip between the two screens
0BE1: 77              MOV     M,A                 ; store the flipped alternator
0BE2: CD D6 09        CALL    $09D6               ; {code.clearPlayfield} clear the playfield
0BE5: C3 DF 18        JMP     $18DF               ; rejoin the top of the attract cycle

loc_0be8:
0BE8: 11 AB 1D        LXI     D,$1DAB             ; select the PLAY attract-heading source
0BEB: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun} type that heading
0BEE: C3 0B 0B        JMP     $0B0B               ; rejoin the attract setup after the heading

; pre-round redraw trampoline: run resolveShotAndFleetEdge (fleet
; edge/direction update) then tail into drawTaitoCopyright
updateFleetAndDrawCopyright:
0BF1: CD 0A 19        CALL    $190A               ; {code.resolveShotAndFleetEdge} resolve the in-flight player shot and update the fleet's edge and direction
0BF4: C3 9A 19        JMP     $199A               ; tail into the input-gated copyright draw

; ---- $0BF7-$13FF: data ----
0BF7: 13 00 08 13 0E 26 02 0E 0F 00 00 00 00 00 00 00
0C07: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0C17: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0C27: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0C37: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0C47: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0C57: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0C67: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0C77: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0C87: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0C97: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0CA7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0CB7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0CC7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0CD7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0CE7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0CF7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0D07: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0D17: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0D27: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0D37: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0D47: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0D57: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0D67: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0D77: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0D87: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0D97: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0DA7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0DB7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0DC7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0DD7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0DE7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0DF7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0E07: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0E17: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0E27: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0E37: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0E47: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0E57: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0E67: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0E77: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0E87: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0E97: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0EA7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0EB7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0EC7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0ED7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0EE7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0EF7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0F07: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0F17: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0F27: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0F37: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0F47: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0F57: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0F67: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0F77: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0F87: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0F97: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0FA7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0FB7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0FC7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0FD7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0FE7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0FF7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1007: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1017: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1027: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1037: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1047: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1057: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1067: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1077: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1087: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1097: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
10A7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
10B7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
10C7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
10D7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
10E7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
10F7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1107: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1117: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1127: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1137: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1147: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1157: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1167: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1177: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1187: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1197: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
11A7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
11B7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
11C7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
11D7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
11E7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
11F7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1207: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1217: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1227: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1237: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1247: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1257: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1267: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1277: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1287: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1297: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
12A7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
12B7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
12C7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
12D7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
12E7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
12F7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1307: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1317: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1327: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1337: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1347: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1357: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1367: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1377: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1387: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
1397: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
13A7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
13B7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
13C7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
13D7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
13E7: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
13F7: 00 00 00 00 00 00 00 00 00

; seat the pixel-shift offset, then OR-blit a hardware-shifted B-row
; sprite into (HL)/(HL+1)
orBlitShiftedSprite:
1400: 00              NOP                         
1401: CD 74 14        CALL    $1474               ; {code.seatBlitPosition} seat the shifter offset and resolve the screen destination
1404: 00              NOP                         

loc_1405:
1405: C5              PUSH    B                   
1406: E5              PUSH    H                   
1407: 1A              LDAX    D                   ; fetch the next source byte
1408: D3 04           OUT     $04                 ; feed it to the hardware bit shifter
140A: DB 03           IN      $03                 ; read back the aligned low half
140C: B6              ORA     M                   ; merge it into the current screen byte, preserving what is already there
140D: 77              MOV     M,A                 ; store the merged low half
140E: 23              INX     H                   ; point at the next screen byte -- the high half
140F: 13              INX     D                   ; advance the source pointer
1410: AF              XRA     A                   ; zero the shifter input
1411: D3 04           OUT     $04                 ; clock the shifter with zero to get the overflow half
1413: DB 03           IN      $03                 ; read that high half
1415: B6              ORA     M                   ; merge it into the next screen byte, preserving the background
1416: 77              MOV     M,A                 ; store the merged high half
1417: E1              POP     H                   
1418: 01 20 00        LXI     B,$0020             ; one screen-row stride
141B: 09              DAD     B                   ; step the destination down one screen row
141C: C1              POP     B                   
141D: 05              DCR     B                   ; count down the rows
141E: C2 05 14        JNZ     $1405               ; repeat for each sprite row
1421: C9              RET                         

; ---- $1422-$1423: data ----
1422: 00 00

; seat the shift offset, then zero the 2-byte-wide x B-row sprite
; footprint at HL
clearSpriteColumn:
1424: CD 74 14        CALL    $1474               ; {code.seatBlitPosition} seat the shifter offset and resolve the screen destination

loc_1427:
1427: C5              PUSH    B                   
1428: E5              PUSH    H                   
1429: AF              XRA     A                   
142A: 77              MOV     M,A                 ; clear the first screen byte
142B: 23              INX     H                   
142C: 77              MOV     M,A                 ; clear the second, adjacent screen byte
142D: 23              INX     H                   
142E: E1              POP     H                   
142F: 01 20 00        LXI     B,$0020             ; one screen-row stride
1432: 09              DAD     B                   ; step the destination down one screen row
1433: C1              POP     B                   
1434: 05              DCR     B                   ; count down the rows
1435: C2 27 14        JNZ     $1427               ; repeat for each row of the sprite footprint
1438: C9              RET                         

; copy B bytes into B adjacent screen columns (stride 0x20 right per byte)
drawSpriteColumn:
1439: C5              PUSH    B                   
143A: 1A              LDAX    D                   ; read the next source byte of the sprite column
143B: 77              MOV     M,A                 ; write it into the current screen cell
143C: 13              INX     D                   ; advance the source one byte
143D: 01 20 00        LXI     B,$0020             
1440: 09              DAD     B                   ; drop the destination one framebuffer row (0x20) -- bytes stack into a vertical column
1441: C1              POP     B                   
1442: 05              DCR     B                   ; count the row down
1443: C2 39 14        JNZ     $1439               ; loop until the whole column is copied
1446: C9              RET                         

; ---- $1447-$1451: data ----
1447: 00 00 00 00 00 00 00 00 00 00 00

; erase a hardware-shifted sprite by AND-ing its complemented bits out of
; the screen over B rows
eraseShiftedSprite:
1452: CD 74 14        CALL    $1474               ; {code.seatBlitPosition} seat the shift alignment and resolve the first row's screen address

loc_1455:
1455: C5              PUSH    B                   
1456: E5              PUSH    H                   
1457: 1A              LDAX    D                   ; read the sprite's source byte for this row
1458: D3 04           OUT     $04                 ; feed the source byte to the board's bit shifter
145A: DB 03           IN      $03                 ; read back the pixel-aligned first half
145C: 2F              CMA                         ; complement it into a clear-mask
145D: A6              ANA     M                   ; AND the mask into the left screen byte -- clearing the sprite's set bits
145E: 77              MOV     M,A                 
145F: 23              INX     H                   ; advance to the adjacent screen byte
1460: 13              INX     D                   ; advance the source one byte
1461: AF              XRA     A                   
1462: D3 04           OUT     $04                 ; feed zero to the shifter for the carried-over half
1464: DB 03           IN      $03                 ; read the shifted second half
1466: 2F              CMA                         ; complement it into a clear-mask
1467: A6              ANA     M                   ; AND it into the right screen byte -- clearing the spilled bits
1468: 77              MOV     M,A                 
1469: E1              POP     H                   
146A: 01 20 00        LXI     B,$0020             
146D: 09              DAD     B                   ; step down one framebuffer row (0x20)
146E: C1              POP     B                   
146F: 05              DCR     B                   ; count the row down
1470: C2 55 14        JNZ     $1455               ; repeat for each sprite row
1473: C9              RET                         

; OUT port 2 := L&7 (MB14241 shift offset), then HL :=
; coordToScreenAddr(HL) -- seat the next blit
seatBlitPosition:
1474: 7D              MOV     A,L                 
1475: E6 07           ANI     $07                 ; keep the low 3 bits of the coordinate -- the sub-byte pixel offset
1477: D3 02           OUT     $02                 ; latch that offset into the board's bit shifter (port 0x02)
1479: C3 47 1A        JMP     $1A47               ; fold the coordinate into a video-RAM byte address

; block-copy a B-column x C-byte screen rectangle into a byte stream
captureScreenRect:
147C: C5              PUSH    B                   
147D: E5              PUSH    H                   

loc_147e:
147E: 7E              MOV     A,M                 ; read a screen byte of the rectangle
147F: 12              STAX    D                   ; append it to the destination stream
1480: 13              INX     D                   ; advance the destination stream one byte
1481: 23              INX     H                   ; advance one byte down the screen column
1482: 0D              DCR     C                   ; count down the bytes in this column
1483: C2 7E 14        JNZ     $147E               ; loop over the column's bytes
1486: E1              POP     H                   
1487: 01 20 00        LXI     B,$0020             
148A: 09              DAD     B                   ; re-base to the next screen column (0x20 over)
148B: C1              POP     B                   
148C: 05              DCR     B                   ; count down the columns
148D: C2 7C 14        JNZ     $147C               ; loop over each column of the rectangle
1490: C9              RET                         

; OR-blit a hardware-shifted sprite while testing overlap, setting
; COLLISION_FLAG on any hit
drawSpriteWithCollision:
1491: CD 74 14        CALL    $1474               ; {code.seatBlitPosition} seat the shift alignment and the first row's screen address
1494: AF              XRA     A                   
1495: 32 61 20        STA     $2061               ; clear the collision flag before the blit

loc_1498:
1498: C5              PUSH    B                   
1499: E5              PUSH    H                   
149A: 1A              LDAX    D                   ; read the sprite's source byte for this row
149B: D3 04           OUT     $04                 ; feed it to the board's bit shifter
149D: DB 03           IN      $03                 ; read back the pixel-aligned first half
149F: F5              PUSH    PSW                 
14A0: A6              ANA     M                   ; test the shifted half against what is already on screen
14A1: CA A9 14        JZ      $14A9               ; skip ahead if there is no overlap
14A4: 3E 01           MVI     A,$01               
14A6: 32 61 20        STA     $2061               ; set the collision flag on overlap

loc_14a9:
14A9: F1              POP     PSW                 
14AA: B6              ORA     M                   ; OR the half onto the left screen byte -- merging without erasing
14AB: 77              MOV     M,A                 
14AC: 23              INX     H                   ; advance to the adjacent screen byte
14AD: 13              INX     D                   ; advance the source one byte
14AE: AF              XRA     A                   
14AF: D3 04           OUT     $04                 ; feed zero to the shifter for the carried-over half
14B1: DB 03           IN      $03                 ; read the shifted second half
14B3: F5              PUSH    PSW                 
14B4: A6              ANA     M                   ; test the second half against the screen
14B5: CA BD 14        JZ      $14BD               ; skip ahead if there is no overlap
14B8: 3E 01           MVI     A,$01               
14BA: 32 61 20        STA     $2061               ; set the collision flag on overlap

loc_14bd:
14BD: F1              POP     PSW                 
14BE: B6              ORA     M                   ; OR the second half onto the adjacent screen byte
14BF: 77              MOV     M,A                 
14C0: E1              POP     H                   
14C1: 01 20 00        LXI     B,$0020             
14C4: 09              DAD     B                   ; step down one framebuffer row (0x20)
14C5: C1              POP     B                   
14C6: 05              DCR     B                   ; count the row down
14C7: C2 98 14        JNZ     $1498               ; repeat for each sprite row
14CA: C9              RET                         

; zero A then fillScreenRow(0) -- blank a run of B screen columns from HL
clearScreenStrip:
14CB: AF              XRA     A                   ; select black (0) as the fill value, then fall into the row fill

; fill B columns with A stepping 0x20 right from HL (a horizontal band);
; leave HL one stride past
fillScreenRow:
14CC: C5              PUSH    B                   
14CD: 77              MOV     M,A                 ; write the fill byte into the screen cell
14CE: 01 20 00        LXI     B,$0020             
14D1: 09              DAD     B                   ; step one framebuffer column over (0x20)
14D2: C1              POP     B                   
14D3: 05              DCR     B                   ; count down the columns
14D4: C2 CC 14        JNZ     $14CC               ; loop across the screen width
14D7: C9              RET                         

; resolve a player-shot collision (dispatched while
; PLAYER_SHOT_STATUS==2): ret unless a hit is latched (PLAYER_SHOT_HIT,
; which playerShotHandler copies from COLLISION_FLAG); then by the shot Y
; at $2029 either stand down into state 3 + clearShotHitAndSilence (missed
; off the top), mark the saucer hit + retire the shot
; (markSaucerHitAndRetireShot, saucer altitude band), or scale the coords
; to a 55-cell alien-rack index (alienGridCellPtr) and on a live cell kill
; the alien + queue the invader-die sound/explosion
; (queueInvaderKillScore), enter state 5, blit, and arm the explosion
; despawn timer ALIEN_EXPLOSION_TIMER
resolvePlayerShotHit:
14D8: 3A 25 20        LDA     $2025               ; read the player-shot state
14DB: FE 05           CPI     $05                 ; check for the exploding state
14DD: C8              RZ                          ; return if the shot is already exploding
14DE: FE 02           CPI     $02                 ; check for the in-flight state
14E0: C0              RNZ                         ; return unless the shot is airborne
14E1: 3A 29 20        LDA     $2029               ; read the shot's Y position
14E4: FE D8           CPI     $D8                 ; compare it against the top of the play area
14E6: 47              MOV     B,A                 
14E7: D2 30 15        JNC     $1530               ; if the shot ran off the top, stand it down -- a clean miss
14EA: 3A 02 20        LDA     $2002               ; read the shot's collision latch
14ED: A7              ANA     A                   ; test whether anything was actually struck
14EE: C8              RZ                          ; return if the shot has hit nothing yet
14EF: 78              MOV     A,B                 
14F0: FE CE           CPI     $CE                 ; compare the Y against the flying-saucer altitude band
14F2: D2 79 15        JNC     $1579               ; within the saucer band -- score the saucer and retire the shot
14F5: C6 06           ADI     $06                 ; bias the Y by +6 onto the alien-rack coordinate
14F7: 47              MOV     B,A                 
14F8: 3A 09 20        LDA     $2009               ; read the fleet's reference-X anchor
14FB: FE 90           CPI     $90                 ; check whether that anchor is still in range
14FD: D2 04 15        JNC     $1504               ; skip the rack bounds guard when the anchor is out of range
1500: B8              CMP     B                   ; compare the anchor against the shot's rack coordinate
1501: D2 30 15        JNC     $1530               ; stand down if the shot is outside the live rack

loc_1504:
1504: 68              MOV     L,B                 
1505: CD 62 15        CALL    $1562               ; {code.scaleXToBlock} scale the rack coordinate to a fleet-grid column index
1508: 3A 2A 20        LDA     $202A               ; read the shot's companion coordinate
150B: 67              MOV     H,A                 
150C: CD 6F 15        CALL    $156F               ; {code.scaleYToBlock} scale that coordinate to a grid residual
150F: 22 64 20        SHLD    $2064               ; stash the packed grid residual for the explosion despawn
1512: 3E 05           MVI     A,$05               
1514: 32 25 20        STA     $2025               ; commit the shot to the exploding state (5)
1517: CD 81 15        CALL    $1581               ; {code.alienGridCellPtr} resolve the alien's liveness cell in the active player's grid
151A: 7E              MOV     A,M                 ; read that grid cell
151B: A7              ANA     A                   ; test whether the alien is alive
151C: CA 30 15        JZ      $1530               ; stand down if the cell is already dead -- the shot hit empty space
151F: 36 00           MVI     M,$00               ; clear the cell -- the alien dies
1521: CD 5F 0A        CALL    $0A5F               ; {code.queueInvaderKillScore} queue the invader's points and fire the invader-die sound
1524: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor} decode the explosion sprite descriptor
1527: CD D3 15        CALL    $15D3               ; {code.blitShiftedSprite} draw the explosion burst
152A: 3E 10           MVI     A,$10               
152C: 32 03 20        STA     $2003               ; arm the explosion despawn timer
152F: C9              RET                         

loc_1530:
1530: 3E 03           MVI     A,$03               
1532: 32 25 20        STA     $2025               ; set the shot to the stand-down state (3)
1535: C3 4A 15        JMP     $154A               ; clear the hit latch and silence the die tone

; decrement the despawn countdown ALIEN_EXPLOSION_TIMER; while nonzero
; return; on expiry reload the sprite address from ALIEN_EXPLOSION_ADDR,
; clearSpriteColumn, then retirePlayerShot
tickAlienExplosionDespawn:
1538: 21 03 20        LXI     H,$2003             ; point at the explosion despawn timer
153B: 35              DCR     M                   ; count the despawn timer down one tick
153C: C0              RNZ                         ; return while the explosion is still showing
153D: 2A 64 20        LHLD    $2064               ; reload the explosion's stored screen position
1540: 06 10           MVI     B,$10               
1542: CD 24 14        CALL    $1424               ; {code.clearSpriteColumn} clear the explosion sprite's sixteen-row column

; set PLAYER_SHOT_STATUS to 4 (retiring), then clearShotHitAndSilence
; (clear PLAYER_SHOT_HIT and silence its sound)
retirePlayerShot:
1545: 3E 04           MVI     A,$04               
1547: 32 25 20        STA     $2025               ; set the shot to its retiring state (4)

; clear PLAYER_SHOT_HIT, then clearSoundPort3Bit(0xf7) masks bit 3 off
; SOUND_PORT3_SHADOW; value-out A
clearShotHitAndSilence:
154A: AF              XRA     A                   
154B: 32 02 20        STA     $2002               ; clear the player-shot collision latch -- re-arm hit detection for the next shot
154E: 06 F7           MVI     B,$F7               ; load the AND mask that clears only the invader-die sound bit (0xf7 = all but bit 3)
1550: C3 DC 19        JMP     $19DC               ; clear that port-3 sound bit -- silence the invader-die tone

; ---- $1553-$1553: data ----
1553: 00

; count in C the 0x10 steps that lift A to/above threshold H (pre-
; normalizing a negative A via normalizeUpBySteps)
countStepsToThreshold:
1554: 0E 00           MVI     C,$00               ; zero the grid-step counter
1556: BC              CMP     H                   ; compare the coordinate against the threshold
1557: D4 90 15        CNC     $1590               ; if the coordinate already reads at/above the threshold, lift it up into range first

loc_155a:
155A: BC              CMP     H                   ; compare the coordinate against the threshold
155B: D0              RNC                         ; return once the coordinate reaches or passes the threshold -- the count is the block index
155C: C6 10           ADI     $10                 ; add one 16-pixel grid step to the coordinate
155E: 0C              INR     C                   ; bump the step count
155F: C3 5A 15        JMP     $155A               ; keep stepping

; scale the X coordinate to a grid block index in B via
; countStepsToThreshold (threshold $2009), residual in L
scaleXToBlock:
1562: 3A 09 20        LDA     $2009               ; read the fleet's reference X base
1565: 65              MOV     H,L                 ; put the target X coordinate into H as the threshold
1566: CD 54 15        CALL    $1554               ; {code.countStepsToThreshold} count 16-pixel steps from the base up to the coordinate
1569: 41              MOV     B,C                 ; copy the step count into B
156A: 05              DCR     B                   ; turn it into a 0-based block index
156B: DE 10           SBI     $10                 ; back off one full 16-pixel step to leave the residual within the block
156D: 6F              MOV     L,A                 ; mirror the residual into L
156E: C9              RET                         

; scale the Y coordinate to a grid block index in C via
; countStepsToThreshold (threshold $200A), residual in H
scaleYToBlock:
156F: 3A 0A 20        LDA     $200A               ; read the fleet's reference Y base
1572: CD 54 15        CALL    $1554               ; {code.countStepsToThreshold} count 16-pixel steps from the base up to the Y coordinate
1575: DE 10           SBI     $10                 ; back off one full 16-pixel step to leave the residual
1577: 67              MOV     H,A                 ; mirror the residual into H
1578: C9              RET                         

; flag SAUCER_HIT (the saucer enters its explosion/score sequence, read by
; updateSaucerSound + the saucer handler), then retirePlayerShot --
; reached from resolvePlayerShotHit when the shot collides in the saucer
; altitude band
markSaucerHitAndRetireShot:
1579: 3E 01           MVI     A,$01               
157B: 32 85 20        STA     $2085               ; raise the saucer-hit flag -- the saucer switches into its explosion and score run
157E: C3 45 15        JMP     $1545               ; retire the player shot that struck it

; compute record pointer HL from index B, offset C, and the record-page
; cell
alienGridCellPtr:
1581: 78              MOV     A,B                 ; take the alien row/block index
1582: 07              RLC                         ; rotate left -- x2
1583: 07              RLC                         ; rotate left -- x4
1584: 07              RLC                         ; rotate left -- x8 of the row index
1585: 80              ADD     B                   ; add the row index...
1586: 80              ADD     B                   ; ...again...
1587: 80              ADD     B                   ; ...again -- total x11, the grid's 11-column row stride
1588: 81              ADD     C                   ; add the column offset
1589: 3D              DCR     A                   ; subtract one for the 1-based bias -- the low byte now indexes the alien in the 55-cell grid
158A: 6F              MOV     L,A                 ; stash that grid offset as the pointer low byte
158B: 3A 67 20        LDA     $2067               ; read the active player's field page number
158E: 67              MOV     H,A                 ; form the pointer high byte -- HL now points at this alien's liveness byte
158F: C9              RET                         

; normalize A up in 0x10 steps until non-negative, counting the steps in C
normalizeUpBySteps:
1590: 0C              INR     C                   ; count a 16-pixel step
1591: C6 10           ADI     $10                 ; add one 16-pixel step, lifting the value toward range
1593: FA 90 15        JM      $1590               ; keep stepping while the value still reads negative (sign bit set)
1596: C9              RET                         

; fleet edge / direction reversal: scan the edge column selected by
; FLEET_MOVE_DIR (fleetReachedEdge); on a hit flip the direction and
; republish $2008 (step count, via fleetStepSize) and FLEET_STEP_DY
; (mirrored from FLEET_DROP_DELTA), else leave state unchanged; RAM-only
reverseFleetAtEdge:
1597: 3A 0D 20        LDA     $200D               ; read the fleet's horizontal heading
159A: A7              ANA     A                   ; test the heading
159B: C2 B7 15        JNZ     $15B7               ; if sweeping left (nonzero), branch to test the left edge
159E: 21 A4 3E        LXI     H,$3EA4             ; sweeping right -- point at the right-edge screen column
15A1: CD C5 15        CALL    $15C5               ; {code.fleetReachedEdge} scan that column for an alien pixel
15A4: D0              RNC                         ; not at the edge yet -- leave the fleet state untouched and return
15A5: 06 FE           MVI     B,$FE               ; reached the right edge: set the new step to -2 pixels (turn to move left)
15A7: 3E 01           MVI     A,$01               ; set the new heading to moving-left

loc_15a9:
15A9: 32 0D 20        STA     $200D               ; publish the new heading
15AC: 78              MOV     A,B                 
15AD: 32 08 20        STA     $2008               ; publish the new horizontal step
15B0: 3A 0E 20        LDA     $200E               ; read the one-row drop delta
15B3: 32 07 20        STA     $2007               ; arm the one-row descent for the next sweep
15B6: C9              RET                         

loc_15b7:
15B7: 21 24 25        LXI     H,$2524             ; sweeping left -- point at the left-edge screen column
15BA: CD C5 15        CALL    $15C5               ; {code.fleetReachedEdge} scan that column for an alien pixel
15BD: D0              RNC                         ; not at the edge yet -- leave the fleet state untouched and return
15BE: CD F1 18        CALL    $18F1               ; {code.fleetStepSize} reached the left edge: fetch the rightward step size (2, or 3 when one alien remains)
15C1: AF              XRA     A                   ; set the new heading to moving-right (zero)
15C2: C3 A9 15        JMP     $15A9               ; publish the heading and step, then arm the row drop

; scan 0x17 (23) bytes upward from HL for the first nonzero (fleet edge
; reached); carry
fleetReachedEdge:
15C5: 06 17           MVI     B,$17               ; scan 23 bytes -- the height of the edge column

loc_15c7:
15C7: 7E              MOV     A,M                 ; read the next column byte
15C8: A7              ANA     A                   ; test it
15C9: C2 6B 16        JNZ     $166B               ; a nonzero byte is a lit alien pixel -- report the edge reached (carry set)
15CC: 23              INX     H                   ; step up to the next byte in the column
15CD: 05              DCR     B                   ; count down the remaining bytes
15CE: C2 C7 15        JNZ     $15C7               ; keep scanning the column
15D1: C9              RET                         

; ---- $15D2-$15D2: data ----
15D2: 00

; seat the shift offset, then overwrite-blit a hardware-shifted B-row
; sprite into (HL)/(HL+1)
blitShiftedSprite:
15D3: CD 74 14        CALL    $1474               ; {code.seatBlitPosition} seat the shift alignment (L's low 3 bits) and fold the coordinate into a screen address
15D6: E5              PUSH    H                   

loc_15d7:
15D7: C5              PUSH    B                   
15D8: E5              PUSH    H                   
15D9: 1A              LDAX    D                   ; read this source row's byte
15DA: D3 04           OUT     $04                 ; feed the source byte into the hardware bit shifter (port 4)
15DC: DB 03           IN      $03                 ; read back the pixel-shifted left half (port 3)
15DE: 77              MOV     M,A                 ; store the left half to the current screen byte
15DF: 23              INX     H                   ; step to the neighbouring screen byte
15E0: 13              INX     D                   ; advance to the next source byte
15E1: AF              XRA     A                   
15E2: D3 04           OUT     $04                 ; feed a zero into the shifter to fetch the spilled-over half
15E4: DB 03           IN      $03                 ; read back the right half the shift pushed into the next byte
15E6: 77              MOV     M,A                 ; store the right half one byte over
15E7: E1              POP     H                   
15E8: 01 20 00        LXI     B,$0020             ; load the one-screen-row stride (0x20)
15EB: 09              DAD     B                   ; drop the destination pointer down one screen row
15EC: C1              POP     B                   
15ED: 05              DCR     B                   ; count down the source rows
15EE: C2 D7 15        JNZ     $15D7               ; keep drawing while rows remain
15F1: E1              POP     H                   
15F2: C9              RET                         

; count live cells across the active player's 0x37-byte alien field into
; ALIEN_COUNT; set LAST_ALIEN_FLAG at exactly one survivor
countLiveAliens:
15F3: CD 11 16        CALL    $1611               ; {code.activePlayerPageBase} point HL at the active player's alien-field page
15F6: 01 00 37        LXI     B,$3700             ; prime the sweep -- 0x37 (55) grid cells to scan, survivor count starts at zero

loc_15f9:
15F9: 7E              MOV     A,M                 ; read a liveness cell
15FA: A7              ANA     A                   
15FB: CA FF 15        JZ      $15FF               ; dead alien (cell zero) -- do not count it
15FE: 0C              INR     C                   ; live alien -- bump the survivor count

loc_15ff:
15FF: 23              INX     H                   ; step to the next grid cell
1600: 05              DCR     B                   
1601: C2 F9 15        JNZ     $15F9               ; loop across all 55 cells
1604: 79              MOV     A,C                 
1605: 32 82 20        STA     $2082               ; publish the live-alien tally that fleet tempo and wave-end read
1608: FE 01           CPI     $01                 ; exactly one alien left?
160A: C0              RNZ                         ; return unless a single survivor remains
160B: 21 6B 20        LXI     H,$206B             
160E: 36 01           MVI     M,$01               ; raise the lone-survivor flag
1610: C9              RET                         

; HL := page byte (mem[ACTIVE_PLAYER_PAGE]) << 8
activePlayerPageBase:
1611: 2E 00           MVI     L,$00               ; zero the low byte -- the page base sits at offset 0
1613: 3A 67 20        LDA     $2067               ; read which player's page is live (0x21 or 0x22)
1616: 67              MOV     H,A                 ; form page<<8 as the page base address
1617: C9              RET                         

; gated pre-round step: when armed ($2015==0xff) and the field is idle,
; advance ATTRACT_DEMO_PTR (attract) or arm the shot on a fresh fire edge
; (play, GAME_IN_PROGRESS set)
advanceRoundState:
1618: 3A 15 20        LDA     $2015               ; read the round-arm sentinel
161B: FE FF           CPI     $FF                 ; is the round armed (sentinel 0xff)?
161D: C0              RNZ                         ; return unless the round is armed
161E: 21 10 20        LXI     H,$2010             
1621: 7E              MOV     A,M                 ; read the first field-object cell
1622: 23              INX     H                   
1623: 46              MOV     B,M                 ; read the second field-object cell
1624: B0              ORA     B                   
1625: C0              RNZ                         ; return while the field is still busy (either cell nonzero)
1626: 3A 25 20        LDA     $2025               ; read the player-shot status
1629: A7              ANA     A                   
162A: C0              RNZ                         ; return while a player shot is already in flight
162B: 3A EF 20        LDA     $20EF               ; read the game-in-progress flag
162E: A7              ANA     A                   
162F: CA 52 16        JZ      $1652               ; no game running -> take the scripted-demo path
1632: 3A 2D 20        LDA     $202D               ; read the fire-button latch
1635: A7              ANA     A                   
1636: C2 48 16        JNZ     $1648               ; latch already set -> go wait for the button to release
1639: CD C0 17        CALL    $17C0               ; {code.readActivePlayerInput} read the active player's controls
163C: E6 10           ANI     $10                 ; isolate the fire button (bit 4)
163E: C8              RZ                          ; return if the fire button is not pressed
163F: 3E 01           MVI     A,$01               
1641: 32 25 20        STA     $2025               ; arm the player's shot
1644: 32 2D 20        STA     $202D               ; latch the press so it counts as a single shot
1647: C9              RET                         

loc_1648:
1648: CD C0 17        CALL    $17C0               ; {code.readActivePlayerInput} read the active player's controls
164B: E6 10           ANI     $10                 ; isolate the fire button
164D: C0              RNZ                         ; keep waiting while the button is still held
164E: 32 2D 20        STA     $202D               ; button released -- clear the fire latch so a new press can fire
1651: C9              RET                         

loc_1652:
1652: 21 25 20        LXI     H,$2025             
1655: 36 01           MVI     M,$01               ; mark a scripted-demo shot as armed
1657: 2A ED 20        LHLD    $20ED               ; load the scripted-demo pointer
165A: 23              INX     H                   ; step the demo pointer forward one byte
165B: 7D              MOV     A,L                 
165C: FE 7E           CPI     $7E                 ; past the end of the demo window?
165E: DA 63 16        JC      $1663               
1661: 2E 74           MVI     L,$74               ; wrap the demo pointer back to the window start (0x74)

loc_1663:
1663: 22 ED 20        SHLD    $20ED               ; store the advanced demo pointer
1666: 7E              MOV     A,M                 ; read the byte the demo pointer now names
1667: 32 1D 20        STA     $201D               ; drive the demo ship's direction from it
166A: C9              RET                         

loc_166b:
166B: 37              STC                         ; set the carry flag -- a return-true helper
166C: C9              RET                         

loc_166d:
166D: AF              XRA     A                   ; clear A for the reserve-lives digit
166E: CD 8B 1A        CALL    $1A8B               ; {code.drawLivesDigit} redraw the reserve-lives digit

loc_1671:
1671: CD 10 19        CALL    $1910               ; {code.activePlayerFlagPtr} point at the active-player in-play flag
1674: 36 00           MVI     M,$00               ; clear the active player's in-play flag
1676: CD CA 09        CALL    $09CA               ; {code.currentPlayerRecordPtr} point at the active player's score record
1679: 23              INX     H                   ; advance to the score's high byte
167A: 11 F5 20        LXI     D,$20F5             ; point at the stored high-score record
167D: 1A              LDAX    D                   
167E: BE              CMP     M                   ; compare the player's score against the high score (high byte)
167F: 1B              DCX     D                   
1680: 2B              DCX     H                   
1681: 1A              LDAX    D                   
1682: CA 8B 16        JZ      $168B               ; high bytes equal -> compare the low byte
1685: D2 98 16        JNC     $1698               ; high score still leads -> leave it
1688: C3 8F 16        JMP     $168F               ; player beat it -> take the new high score

loc_168b:
168B: BE              CMP     M                   ; compare the low byte
168C: D2 98 16        JNC     $1698               ; high score still leads -> leave it

loc_168f:
168F: 7E              MOV     A,M                 ; copy the player's score...
1690: 12              STAX    D                   ; ...into the high-score record low byte
1691: 13              INX     D                   
1692: 23              INX     H                   
1693: 7E              MOV     A,M                 ; read the player's score high byte
1694: 12              STAX    D                   ; ...and store its high byte
1695: CD 50 19        CALL    $1950               ; {code.drawHighScore} redraw the high-score readout

loc_1698:
1698: 3A CE 20        LDA     $20CE               ; read the two-player-game flag
169B: A7              ANA     A                   
169C: CA C9 16        JZ      $16C9               ; single-player game -> skip the two-player banner
169F: 21 03 28        LXI     H,$2803             ; point at the two-player game-over banner position
16A2: 11 A6 1A        LXI     D,$1AA6             
16A5: 0E 14           MVI     C,$14               
16A7: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun} type out the game-over text run
16AA: 25              DCR     H                   
16AB: 25              DCR     H                   
16AC: 06 1B           MVI     B,$1B               ; default to the player-1 number glyph
16AE: 3A 67 20        LDA     $2067               ; read which player is active
16B1: 0F              RRC                         ; test the active-player bit
16B2: DA B7 16        JC      $16B7               
16B5: 06 1C           MVI     B,$1C               ; switch to the player-2 number glyph

loc_16b7:
16B7: 78              MOV     A,B                 
16B8: CD FF 08        CALL    $08FF               ; {code.drawSprite8x8} draw the player-number glyph
16BB: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay} hold for a short delay
16BE: CD E7 18        CALL    $18E7               ; {code.otherPlayerFlagPtr} point at the other player's flag
16C1: 7E              MOV     A,M                 ; read the other player's flag
16C2: A7              ANA     A                   
16C3: CA C9 16        JZ      $16C9               ; other player is out too -> continue to game over
16C6: C3 ED 02        JMP     $02ED               ; other player still has ships -> hand the machine to them

loc_16c9:
16C9: 21 18 2D        LXI     H,$2D18             ; point at the game-over field-clear text position
16CC: 11 A6 1A        LXI     D,$1AA6             
16CF: 0E 0A           MVI     C,$0A               
16D1: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun} type out the closing text run
16D4: CD B6 0A        CALL    $0AB6               ; {code.waitLongDelay} hold for a long delay
16D7: CD D6 09        CALL    $09D6               ; {code.clearPlayfield} clear the playfield
16DA: AF              XRA     A                   
16DB: 32 EF 20        STA     $20EF               ; mark the game no longer in progress
16DE: D3 05           OUT     $05                 ; silence the fleet-march sound port
16E0: CD D1 19        CALL    $19D1               ; {code.setGameActive} set the game-active state flag
16E3: C3 89 0B        JMP     $0B89               ; drop back into the attract cycle

loc_16e6:
16E6: 31 00 24        LXI     SP,$2400            ; reset the stack pointer to the top of RAM
16E9: FB              EI                          ; re-enable interrupts
16EA: AF              XRA     A                   
16EB: 32 15 20        STA     $2015               ; clear the round-arm sentinel

loc_16ee:
16EE: CD D8 14        CALL    $14D8               ; {code.resolvePlayerShotHit} run the player-shot collision step for the death animation
16F1: 06 04           MVI     B,$04               ; select port-3 bit 2 -- the base-explosion cue
16F3: CD FA 18        CALL    $18FA               ; {code.startSound} sound the base-explosion cue each pass
16F6: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet} test the round-arm trigger
16F9: C2 EE 16        JNZ     $16EE               ; loop the death animation until the trigger clears
16FC: CD D7 19        CALL    $19D7               ; {code.clearGameActive} clear the game-active state flag
16FF: 21 01 27        LXI     H,$2701             ; point at the reserve-ship icons screen position
1702: CD FA 19        CALL    $19FA               ; {code.clearScreenRegion} clear the reserve-ship icon region
1705: AF              XRA     A                   ; clear A for the reserve-lives digit
1706: CD 8B 1A        CALL    $1A8B               ; {code.drawLivesDigit} redraw the reserve-lives digit
1709: 06 FB           MVI     B,$FB               ; mask to clear the base-explosion cue (port-3 bit 2)
170B: C3 6B 19        JMP     $196B               ; jump into the score-panel redraw

; select the alien-shot rate: scan ALIEN_SHOT_RATE_THRESHOLDS for the
; first entry >= the active player's score key, store the parallel
; ALIEN_SHOT_RATE_TABLE byte to $20CF (read by the shot stepper
; stepAlienShot)
selectAlienShotRate:
170E: CD CA 09        CALL    $09CA               ; {code.currentPlayerRecordPtr} point at the active player's score record
1711: 23              INX     H                   ; step to the score's high byte -- the difficulty key
1712: 7E              MOV     A,M                 ; read the difficulty key
1713: 11 B8 1C        LXI     D,$1CB8             ; point at the score-threshold table
1716: 21 A1 1A        LXI     H,$1AA1             ; point at the parallel fire-cadence table
1719: 0E 04           MVI     C,$04               ; four score bands to test
171B: 47              MOV     B,A                 

loc_171c:
171C: 1A              LDAX    D                   ; read the current band's threshold
171D: B8              CMP     B                   ; compare it against the score key
171E: D2 27 17        JNC     $1727               ; threshold reaches the key -> take this band's cadence
1721: 23              INX     H                   ; advance the cadence pointer to the next band
1722: 13              INX     D                   ; advance the threshold pointer to the next band
1723: 0D              DCR     C                   
1724: C2 1C 17        JNZ     $171C               ; keep scanning the bands

loc_1727:
1727: 7E              MOV     A,M                 ; read the matching fire-cadence byte
1728: 32 CF 20        STA     $20CF               ; publish the alien-fire cadence the shot stepper reads
172B: C9              RET                         

; mode-gated sound step: PLAYER_SHOT_STATUS!=0 -> startSound(0x02), else
; clearSoundPort3Bit(0xfd)
updatePlayerShotSound:
172C: 3A 25 20        LDA     $2025               ; read the player-shot status
172F: FE 00           CPI     $00                 
1731: C2 39 17        JNZ     $1739               ; a shot is in flight -> raise the shot cue
1734: 06 FD           MVI     B,$FD               ; mask to clear the player-shot cue (port-3 bit 1)
1736: C3 DC 19        JMP     $19DC               ; no shot -> silence the player-shot cue

loc_1739:
1739: 06 02           MVI     B,$02               ; mask to set the player-shot cue (port-3 bit 1)
173B: C3 FA 18        JMP     $18FA               ; sound the player-shot cue while the shot is live

; ---- $173E-$173F: data ----
173E: 00 00

; fleet-march sound beat: tick FLEET_SOUND_OFF_TIMER/FLEET_SOUND_TIMER, on
; beat emit SOUND_PORT5_SHADOW and re-arm, silencing at the edges; set
; FLEET_SOUND_STEP
stepFleetMarchSound:
1740: 21 9B 20        LXI     H,$209B             ; point at the note-off countdown
1743: 35              DCR     M                   ; tick the note-off countdown
1744: CC 6D 17        CZ      $176D               ; on zero, cut the current march note
1747: 3A 68 20        LDA     $2068               ; read the fleet-march enable flag
174A: A7              ANA     A                   
174B: CA 6D 17        JZ      $176D               ; march disabled -> silence and stop this tick
174E: 21 96 20        LXI     H,$2096             ; point at the beat countdown
1751: 35              DCR     M                   ; tick the beat countdown
1752: C0              RNZ                         ; no footstep until the beat expires
1753: 21 98 20        LXI     H,$2098             
1756: 7E              MOV     A,M                 
1757: D3 05           OUT     $05                 ; sound the current march tone on port 5
1759: 3A 82 20        LDA     $2082               ; read the live-alien count
175C: A7              ANA     A                   
175D: CA 6D 17        JZ      $176D               ; last alien gone -> let this beat fade without re-arming
1760: 2B              DCX     H                   
1761: 7E              MOV     A,M                 ; read the tempo period
1762: 2B              DCX     H                   
1763: 77              MOV     M,A                 ; reload the beat countdown from the tempo period
1764: 2B              DCX     H                   
1765: 36 01           MVI     M,$01               ; ask the frame loop to step the march pitch and tempo
1767: 3E 04           MVI     A,$04               
1769: 32 9B 20        STA     $209B               ; ring this note for four ticks before the note-off timer cuts it
176C: C9              RET                         

; OUT 5 := mem[SOUND_PORT5_SHADOW] & 0x30 (sound-off helper)
silenceFleetMarchNote:
176D: 3A 98 20        LDA     $2098               ; load the port-5 sound shadow to mute the march tone from

; mask A to the two sound-select bits, OUT sound port 5
latchSoundPort5:
1770: E6 30           ANI     $30                 ; keep only the two latched high bits -- mute the four march tones
1772: D3 05           OUT     $05                 ; drive the latched bits onto sound port 5
1774: C9              RET                         

; on FLEET_SOUND_STEP, pick the fleet tempo for ALIEN_COUNT from
; FLEET_RATE_THRESHOLDS/FLEET_RATE_TABLE into FLEET_SOUND_PERIOD and
; rotate the port-5 fleet tone; tick SFX_OFF_TIMER
advanceFleetMarchSound:
1775: 3A 95 20        LDA     $2095               ; read the march beat trigger
1778: A7              ANA     A                   
1779: CA AA 17        JZ      $17AA               ; no fresh beat -> skip to the SFX-off tick
177C: 21 11 1A        LXI     H,$1A11             ; point at the fleet-rate thresholds table
177F: 11 21 1A        LXI     D,$1A21             ; point at the parallel beat-period table
1782: 3A 82 20        LDA     $2082               ; read the live-alien count

loc_1785:
1785: BE              CMP     M                   ; compare it against the current rate threshold
1786: D2 8E 17        JNC     $178E               ; count reaches the threshold -> take this band's period
1789: 23              INX     H                   ; advance the threshold pointer to the next band
178A: 13              INX     D                   ; advance the period pointer to the next band
178B: C3 85 17        JMP     $1785               ; test the next band

loc_178e:
178E: 1A              LDAX    D                   ; read the matching beat period
178F: 32 97 20        STA     $2097               ; set the march tempo the metronome reloads from
1792: 21 98 20        LXI     H,$2098             ; point at the port-5 sound shadow
1795: 7E              MOV     A,M                 
1796: E6 30           ANI     $30                 ; hold the two latched high bits aside -- a ringing saucer-hit
1798: 47              MOV     B,A                 
1799: 7E              MOV     A,M                 
179A: E6 0F           ANI     $0F                 ; take the low march-tone nibble
179C: 07              RLC                         ; rotate the lit tone bit up one step -- the four-note march
179D: FE 10           CPI     $10                 ; did the tone roll past the nibble?
179F: C2 A4 17        JNZ     $17A4               
17A2: 3E 01           MVI     A,$01               ; wrap the march tone back to the first note

loc_17a4:
17A4: B0              ORA     B                   ; merge the latched high bits back in
17A5: 77              MOV     M,A                 ; store the stepped march tone
17A6: AF              XRA     A                   
17A7: 32 95 20        STA     $2095               ; clear the beat trigger now that it is serviced

loc_17aa:
17AA: 21 99 20        LXI     H,$2099             ; point at the one-shot SFX-off timer
17AD: 35              DCR     M                   ; count down the SFX-off window
17AE: C0              RNZ                         ; still running -> leave the cue alone
17AF: 06 EF           MVI     B,$EF               ; mask to clear the port-3 one-shot cue (bit 4)
17B1: C3 DC 19        JMP     $19DC               ; window expired -> auto-silence that one-shot cue

; ---- $17B4-$17BF: data ----
17B4: 06 EF 21 98 20 7E A0 77 D3 05 C9 00

; read the player-selected input port into A
readActivePlayerInput:
17C0: 3A 67 20        LDA     $2067               ; read the active-player selector byte
17C3: 0F              RRC                         ; rotate the player-1/player-2 select bit into carry
17C4: D2 CA 17        JNC     $17CA               ; selector clear (player 2) -- go read input port 2
17C7: DB 01           IN      $01                 ; read player 1's control input port
17C9: C9              RET                         

loc_17ca:
17CA: DB 02           IN      $02                 ; read player 2's control input port
17CC: C9              RET                         

loc_17cd:
17CD: DB 02           IN      $02                 ; read input port 2 -- carries the tilt switch
17CF: E6 04           ANI     $04                 ; isolate the tilt-switch bit
17D1: C8              RZ                          ; not tilted -- return
17D2: 3A 9A 20        LDA     $209A               ; load the tilt-in-progress flag
17D5: A7              ANA     A                   
17D6: C0              RNZ                         ; tilt already being handled -- return
17D7: 31 00 24        LXI     SP,$2400            ; reset the stack pointer to the top of work RAM
17DA: 06 04           MVI     B,$04               

loc_17dc:
17DC: CD D6 09        CALL    $09D6               ; {code.clearPlayfield} blank the playfield
17DF: 05              DCR     B                   
17E0: C2 DC 17        JNZ     $17DC               ; repeat the clear four times
17E3: 3E 01           MVI     A,$01               
17E5: 32 9A 20        STA     $209A               ; raise the tilt-in-progress flag
17E8: CD D7 19        CALL    $19D7               ; {code.clearGameActive} clear the game-active flag
17EB: FB              EI                          ; re-enable interrupts
17EC: 11 BC 1C        LXI     D,$1CBC             ; point at the tilt-message glyph string
17EF: 21 16 30        LXI     H,$3016             ; point at its screen destination
17F2: 0E 04           MVI     C,$04               ; four glyphs to type
17F4: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun} type the tilt message onto the screen at the paced cadence
17F7: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay} wait a short delay
17FA: AF              XRA     A                   
17FB: 32 9A 20        STA     $209A               ; clear the tilt-in-progress flag
17FE: 32 93 20        STA     $2093               
1801: C3 C9 16        JMP     $16C9               ; jump back to the main loop

; per-frame saucer sound gate: SAUCER_ACTIVE==0 -> stopSaucerSound, else
; drive the UFO tone
updateSaucerSound:
1804: 21 84 20        LXI     H,$2084             ; point at the flying-saucer active flag
1807: 7E              MOV     A,M                 
1808: A7              ANA     A                   
1809: CA 07 07        JZ      $0707               ; no saucer on screen -- silence the saucer whine
180C: 23              INX     H                   ; step to the saucer-hit flag
180D: 7E              MOV     A,M                 
180E: A7              ANA     A                   
180F: C0              RNZ                         ; saucer already shot -- leave the sound latch alone so its death tone rings
1810: 06 01           MVI     B,$01               ; select the saucer-whine sound bit
1812: C3 FA 18        JMP     $18FA               ; hold the continuous saucer whine on

; draw the attract score-advance table: header string +
; SCORE_ADVANCE_DRAW_SCRIPT column script (no delay), then tail
; typeSecondDrawScript (typed $1DCF script)
drawScoreAdvanceTable:
1815: 21 10 28        LXI     H,$2810             ; point the header blit at its screen destination
1818: 11 A3 1C        LXI     D,$1CA3             ; point at the score-advance header's sprite-id list
181B: 0E 15           MVI     C,$15               ; 21 sprite ids to lay down
181D: CD F3 08        CALL    $08F3               ; {code.drawSpriteList} draw the score-advance header line
1820: 3E 0A           MVI     A,$0A               
1822: 32 6C 20        STA     $206C               ; set the typed cadence to ten frames per glyph
1825: 01 BE 1D        LXI     B,$1DBE             ; point the cursor at the first, no-delay draw script

loc_1828:
1828: CD 56 18        CALL    $1856               ; {code.fetchNextDrawRecord} pull the next four-byte draw record
182B: DA 37 18        JC      $1837               ; table terminator -- tail into the second, typed script
182E: CD 44 18        CALL    $1844               ; {code.drawSpriteColumn16} blit this record as a fixed 16-row sprite column
1831: C3 28 18        JMP     $1828               ; loop to the next record

; ---- $1834-$1836: data ----
1834: CD B1 0A

; point at the $1DCF script and fall into typeDrawScript
typeSecondDrawScript:
1837: 01 CF 1D        LXI     B,$1DCF             ; point the cursor at the second attract draw script

; walk a draw script (fetchNextDrawRecord + typeDrawScriptRecord per
; record) until the 0xff terminator
typeDrawScript:
183A: CD 56 18        CALL    $1856               ; {code.fetchNextDrawRecord} pull the next draw record from the script
183D: D8              RC                          ; script terminator -- done
183E: CD 4C 18        CALL    $184C               ; {code.typeDrawScriptRecord} type this record's glyphs at the paced cadence
1841: C3 3A 18        JMP     $183A               ; loop to the next record

; draw a fixed 16-row sprite column (row count forced to 0x10) via
; drawSpriteColumn, preserving BC
drawSpriteColumn16:
1844: C5              PUSH    B                   
1845: 06 10           MVI     B,$10               ; fix the column height at 16 rows
1847: CD 39 14        CALL    $1439               ; {code.drawSpriteColumn} copy the 16-row sprite column down the screen
184A: C1              POP     B                   
184B: C9              RET                         

; type one script record: c = TYPE_PACE_COUNT 0x206c, de/hl from the
; fetched record -> typePacedSpriteRun
typeDrawScriptRecord:
184C: C5              PUSH    B                   
184D: 3A 6C 20        LDA     $206C               ; read the typed-output cadence count
1850: 4F              MOV     C,A                 
1851: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun} type the record's glyphs one at a time, paced per frame
1854: C1              POP     B                   
1855: C9              RET                         

; fetch the next 4-byte draw record addressed by BC (A=(BC), advance BC)
fetchNextDrawRecord:
1856: 0A              LDAX    B                   ; read the record's first byte at the cursor
1857: FE FF           CPI     $FF                 ; test it against the 0xff table terminator
1859: 37              STC                         ; arm carry as the end-of-script signal
185A: C8              RZ                          ; terminator reached -- return, script finished
185B: 6F              MOV     L,A                 ; start the destination screen address -- low byte
185C: 03              INX     B                   
185D: 0A              LDAX    B                   
185E: 67              MOV     H,A                 ; complete the destination screen address in HL
185F: 03              INX     B                   
1860: 0A              LDAX    B                   
1861: 5F              MOV     E,A                 ; start the graphics-source pointer -- low byte
1862: 03              INX     B                   
1863: 0A              LDAX    B                   
1864: 57              MOV     D,A                 ; complete the graphics-source pointer in DE
1865: 03              INX     B                   
1866: A7              ANA     A                   ; clear carry -- more records follow
1867: C9              RET                         

; step one scripted-animation frame: bump the counter ANIM_FRAME_COUNTER,
; advanceRecordTotals over ANIM_COORD_STEP_LO and load the descriptor from
; ANIM_SPRITE_COORD, set ANIM_DONE_FLAG at ANIM_END_COORD, else compute
; ANIM_SPRITE_SRC from ANIM_BASE_SPRITE_SRC and blitShiftedSprite
stepAnimationFrame:
1868: 21 C2 20        LXI     H,$20C2             ; point at the animation frame counter
186B: 34              INR     M                   ; bump the animation frame counter
186C: 23              INX     H                   ; step to the coordinate step byte
186D: 4E              MOV     C,M                 ; take the per-frame coordinate step
186E: CD D9 01        CALL    $01D9               ; {code.advanceRecordTotals} glide the sprite's screen coordinate forward by the step
1871: 47              MOV     B,A                 ; keep the progress total -- the coordinate's high byte
1872: 3A CA 20        LDA     $20CA               ; load the scripted end coordinate
1875: B8              CMP     B                   ; compare progress against the end point
1876: CA 98 18        JZ      $1898               ; reached the end -- latch done and stop
1879: 3A C2 20        LDA     $20C2               ; reload the frame counter
187C: E6 04           ANI     $04                 ; test counter bit 2 -- the two-pose alternation timer
187E: 2A CC 20        LHLD    $20CC               ; load the base sprite-graphic pointer
1881: C2 88 18        JNZ     $1888               ; bit set -- keep the base pose
1884: 11 30 00        LXI     D,$0030             ; else reach the alternate-pose bank, +0x30
1887: 19              DAD     D                   

loc_1888:
1888: 22 C7 20        SHLD    $20C7               ; store the chosen sprite source into the frame descriptor
188B: 21 C5 20        LXI     H,$20C5             ; point at the sprite coordinate descriptor
188E: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor} decode the five-byte sprite descriptor
1891: EB              XCHG                        ; move the screen coordinate into HL for the blit
1892: C3 D3 15        JMP     $15D3               ; shift-blit the frame through the hardware bit shifter

; ---- $1895-$1897: data ----
1895: 00 00 00

loc_1898:
1898: 3E 01           MVI     A,$01               
189A: 32 CB 20        STA     $20CB               ; raise the animation-done handshake flag
189D: C9              RET                         

; ISR-handshaked attract animation: arm TASK_FLAGS 0x20c1=4, spin
; ATTRACT_ANIM_ACK 0x2055 bit0 set-then-clear, draw, tail waitLongDelay
; (the ISR anim it arms drives object handler 0x050e)
runHandshakedAttractAnim:
189E: 21 50 20        LXI     H,$2050             ; point at the attract-demo object table
18A1: 11 C0 1B        LXI     D,$1BC0             ; point at the fixed object descriptor template in ROM
18A4: 06 10           MVI     B,$10               ; 16 bytes to copy
18A6: CD 32 1A        CALL    $1A32               ; {code.blockCopy} seed the attract-demo object record from the ROM template
18A9: 3E 02           MVI     A,$02               
18AB: 32 80 20        STA     $2080               ; prime the object's mode byte
18AE: 3E FF           MVI     A,$FF               
18B0: 32 7E 20        STA     $207E               ; prime the alien-shot step cell
18B3: 3E 04           MVI     A,$04               
18B5: 32 C1 20        STA     $20C1               ; arm the per-frame interrupt task that walks the attract animation

loc_18b8:
18B8: 3A 55 20        LDA     $2055               ; read the animation acknowledge flag
18BB: E6 01           ANI     $01                 ; test its handshake bit
18BD: CA B8 18        JZ      $18B8               ; spin until the interrupt raises the acknowledge -- step underway

loc_18c0:
18C0: 3A 55 20        LDA     $2055               ; reread the acknowledge flag
18C3: E6 01           ANI     $01                 ; test its handshake bit
18C5: C2 C0 18        JNZ     $18C0               ; spin until the interrupt drops the acknowledge -- step complete
18C8: 21 11 33        LXI     H,$3311             ; point at the revealed sprite's screen slot
18CB: 3E 26           MVI     A,$26               ; select the revealed sprite id
18CD: 00              NOP                         
18CE: CD FF 08        CALL    $08FF               ; {code.drawSprite8x8} draw the revealed sprite
18D1: C3 B6 0A        JMP     $0AB6               ; settle for the long attract delay

; boot init: seed work RAM (initWorkRam) and the score panel
; (redrawScorePanel), then enter the attract loop at enterAttractCycle
bootInit:
18D4: 31 00 24        LXI     SP,$2400            ; seat the stack pointer at the top of work RAM
18D7: 06 00           MVI     B,$00               
18D9: CD E6 01        CALL    $01E6               ; {code.initWorkRam} stamp work RAM from its baked cold-start image
18DC: CD 56 19        CALL    $1956               ; {code.redrawScorePanel} paint the static score panel -- header, both scores, high score, credit line

; attract-cycle join: set $20CF=8 then continue into runAttractCycle;
; reached from boot init and the finishAttractCycle loop-back
enterAttractCycle:
18DF: 3E 08           MVI     A,$08               ; load the attract round/mode seed 0x08
18E1: 32 CF 20        STA     $20CF               ; seed the attract round/mode cell (0x20cf)
18E4: C3 EA 0A        JMP     $0AEA               ; run the attract setup and free-running demo loop

; HL := 0x20e7 + bit0 of (0x2067)
otherPlayerFlagPtr:
18E7: 3A 67 20        LDA     $2067               ; read the active-player selector byte (0x2067)
18EA: 21 E7 20        LXI     H,$20E7             ; point at the per-player flag pair's base cell (0x20e7)
18ED: 0F              RRC                         ; rotate the player-select bit into carry
18EE: D0              RNC                         ; keep the base cell -- player two -- when the select bit is clear
18EF: 23              INX     H                   ; otherwise step to the player-one slot (0x20e8)
18F0: C9              RET                         

; B := 2, or 3 when (0x2082) == 1
fleetStepSize:
18F1: 06 02           MVI     B,$02               ; preset the fleet's horizontal step to 2 columns
18F3: 3A 82 20        LDA     $2082               ; read the live alien count (0x2082)
18F6: 3D              DCR     A                   ; test for exactly one alien left
18F7: C0              RNZ                         ; keep step 2 while more than one alien remains
18F8: 04              INR     B                   ; one alien left -- bump the step to 3 so the last alien sprints
18F9: C9              RET                         

; (0x2094) |= B, mirror to sound port, A := result
startSound:
18FA: 3A 94 20        LDA     $2094               ; read the port-3 sound-latch shadow (0x2094)
18FD: B0              ORA     B                   ; raise the requested cue bit(s) in the latch
18FE: 32 94 20        STA     $2094               ; store the updated latch back to its shadow
1901: D3 03           OUT     $03                 ; write the latch to sound port 3, sounding the cue
1903: C9              RET                         

; seat the player-2 alien-status base ALIEN_FIELD_P2 then
; markAllAliensAlive (0x37-byte 0x01 fill)
markAllAliensAliveP2:
1904: 21 00 22        LXI     H,$2200             ; point at player two's alien field base (0x2200)
1907: C3 C3 01        JMP     $01C3               ; fill the 55 liveness cells with a fresh full fleet

; run the state-2 handler resolvePlayerShotHit, then tail into the fleet
; edge/direction update reverseFleetAtEdge; RAM-only, callers ignore the
; result
resolveShotAndFleetEdge:
190A: CD D8 14        CALL    $14D8               ; {code.resolvePlayerShotHit} resolve the player shot's collision -- miss, saucer, or alien kill
190D: C3 97 15        JMP     $1597               ; then run the fleet edge turn -- reverse and drop at a boundary

; HL := $20E7 + (bit0 of ACTIVE_PLAYER_PAGE clear ? 1 : 0)
activePlayerFlagPtr:
1910: 21 E7 20        LXI     H,$20E7             ; point at the per-player flag pair's base cell (0x20e7)
1913: 3A 67 20        LDA     $2067               ; read the active-player selector byte (0x2067)
1916: 0F              RRC                         ; rotate the player-select bit into carry
1917: D8              RC                          ; keep the base cell -- player one -- when the select bit is set
1918: 23              INX     H                   ; otherwise step to the player-two slot (0x20e8)
1919: C9              RET                         

; drawSpriteList the score-header line (SCORE_HEADER_TEXT) to
; SCORE_HEADER_SCREEN_ADDR
drawScoreHeader:
191A: 0E 1C           MVI     C,$1C               ; set the glyph count to 0x1c -- 28 glyphs for the header line
191C: 21 1E 24        LXI     H,$241E             ; point at the header's fixed screen slot (0x241e)
191F: 11 E4 1A        LXI     D,$1AE4             ; point at the preset header text ids (0x1ae4)
1922: C3 F3 08        JMP     $08F3               ; draw the 28-glyph header line through the sprite-list driver

; seat the player-1 score record pointer PLAYER1_OBJ_DESC, then
; drawScoreRecord (tail) -- draw the P1 BCD total as four glyphs at the
; record's screen address; RAM-only
drawPlayer1Score:
1925: 21 F8 20        LXI     H,$20F8             ; point at player one's four-byte score record (0x20f8)
1928: C3 31 19        JMP     $1931               ; unpack the record and paint its BCD score

; seat the player-2 score record pointer PLAYER2_OBJ_DESC, then
; drawScoreRecord (tail) -- draw the P2 BCD total; RAM-only
drawPlayer2Score:
192B: 21 FC 20        LXI     H,$20FC             ; point at player two's score record
192E: C3 31 19        JMP     $1931               ; fall into the shared score-record drawer

; shared score-record draw: unpack a four-byte record at HL (a BCD value
; word then its two-byte screen address) and draw the value as four BCD
; glyphs there (tail drawBcdWord); reached for P1 (0x20f8), P2 (0x20fc)
; and the high score (0x20f4)
drawScoreRecord:
1931: 5E              MOV     E,M                 ; read the score value's low BCD byte
1932: 23              INX     H                   
1933: 56              MOV     D,M                 ; read the score value's high BCD byte
1934: 23              INX     H                   
1935: 7E              MOV     A,M                 ; read the record's screen-address low byte
1936: 23              INX     H                   
1937: 66              MOV     H,M                 ; read the record's screen-address high byte
1938: 6F              MOV     L,A                 ; seat HL at the record's own screen slot
1939: C3 AD 09        JMP     $09AD               ; draw the value as four BCD digits at that slot

; drawSpriteList the 'CREDIT' label (CREDIT_LABEL_TEXT) to
; CREDIT_LABEL_SCREEN_ADDR
drawCreditLabel:
193C: 0E 07           MVI     C,$07               ; set the glyph count to seven -- the CREDIT letters
193E: 21 01 35        LXI     H,$3501             ; point at the credit label's screen slot
1941: 11 A9 1F        LXI     D,$1FA9             ; point at the CREDIT label's glyph-id list
1944: C3 F3 08        JMP     $08F3               ; blit the seven-glyph label run

; draw the BCD credit tally CREDIT_COUNT as two decimal glyphs at
; CREDIT_COUNT_SCREEN_ADDR via drawBcdByte
drawCreditCount:
1947: 3A EB 20        LDA     $20EB               ; read the BCD credit tally
194A: 21 01 3C        LXI     H,$3C01             ; point at the credit-count screen slot
194D: C3 B2 09        JMP     $09B2               ; draw the tally as two decimal digits

; seat the high-score record pointer HIGH_SCORE_OBJ_DESC, then
; drawScoreRecord (tail) -- draw the high-score BCD total; also called by
; $1671 to repaint after a new high; RAM-only
drawHighScore:
1950: 21 F4 20        LXI     H,$20F4             ; point at the high-score record
1953: C3 31 19        JMP     $1931               ; fall into the shared score-record drawer

; boot/attract score-panel repaint: clearScreen, then redraw the score
; header (drawScoreHeader), player-1/2 scores
; (drawPlayer1Score/drawPlayer2Score), the high score (drawHighScore), the
; CREDIT label (drawCreditLabel), and the credit tally (drawCreditCount);
; RAM-only
redrawScorePanel:
1956: CD 5C 1A        CALL    $1A5C               ; {code.clearScreen} blank the whole video window
1959: CD 1A 19        CALL    $191A               ; {code.drawScoreHeader} draw the score header line
195C: CD 25 19        CALL    $1925               ; {code.drawPlayer1Score} repaint player one's score
195F: CD 2B 19        CALL    $192B               ; {code.drawPlayer2Score} repaint player two's score
1962: CD 50 19        CALL    $1950               ; {code.drawHighScore} repaint the high score
1965: CD 3C 19        CALL    $193C               ; {code.drawCreditLabel} draw the CREDIT label
1968: C3 47 19        JMP     $1947               ; draw the credit tally

loc_196b:
196B: CD DC 19        CALL    $19DC               ; {code.clearSoundPort3Bit} mask a bit off the sound-port-3 shadow and mirror it out
196E: C3 71 16        JMP     $1671               

loc_1971:
1971: 3E 01           MVI     A,$01               
1973: 32 6D 20        STA     $206D               ; raise the record-0 warm-restart suppress flag
1976: C3 E6 16        JMP     $16E6               

; boot/attract credit readout: clearGameActive, then repaint the credit
; panel -- drawCreditCount (the BCD credit tally) then drawCreditLabel
; (the CREDIT label, tail)
drawCreditReadout:
1979: CD D7 19        CALL    $19D7               ; {code.clearGameActive}
197C: CD 47 19        CALL    $1947               ; {code.drawCreditCount}
197F: C3 3C 19        JMP     $193C               

; store A -> TASK_FLAGS
storeTaskFlags:
1982: 32 C1 20        STA     $20C1               ; store the per-frame task bitfield
1985: C9              RET                         

; ---- $1986-$1987: data ----
1986: 8B 19

loc_1988:
1988: C3 D6 09        JMP     $09D6               ; clear the play-field interior -- keep the score band and status strip

; ---- $198B-$1999: data ----
198B: 21 03 28 11 BE 19 0E 13 C3 F3 08 00 00 00 00

; behind a two-step port-1 input code (INPUT_CODE_STAGE_FLAG),
; drawSpriteList the Taito copyright (TAITO_COPYRIGHT_TEXT) to
; TAITO_COPYRIGHT_SCREEN_ADDR
drawTaitoCopyright:
199A: 3A 1E 20        LDA     $201E               ; read the one-shot input-code stage latch
199D: A7              ANA     A                   ; test whether the first stage is still pending
199E: C2 AC 19        JNZ     $19AC               ; if already latched, skip to the second code check
19A1: DB 01           IN      $01                 ; read input port 1
19A3: E6 76           ANI     $76                 ; keep only the code bits -- mask 0x76
19A5: D6 72           SUI     $72                 ; demand the first code 0x72
19A7: C0              RNZ                         ; bail with no draw unless it matches
19A8: 3C              INR     A                   ; bump the accumulator to one -- the latch value
19A9: 32 1E 20        STA     $201E               ; latch stage one so later frames skip straight to stage two

loc_19ac:
19AC: DB 01           IN      $01                 ; re-read input port 1 for the second code
19AE: E6 76           ANI     $76                 ; keep only the code bits -- mask 0x76
19B0: FE 34           CPI     $34                 ; demand the second code 0x34
19B2: C0              RNZ                         ; bail with no draw until it is present
19B3: 21 1B 2E        LXI     H,$2E1B             ; point at the copyright line's screen slot
19B6: 11 F7 0B        LXI     D,$0BF7             ; point at the copyright glyph-id list
19B9: 0E 09           MVI     C,$09               ; set the glyph count to nine
19BB: C3 F3 08        JMP     $08F3               ; blit the nine-glyph copyright line

; ---- $19BE-$19D0: data ----
19BE: 28 13 00 08 13 0E 26 02 0E 11 0F 0E 11 00 13 08
19CE: 0E 0D 28

; store 1 -> GAME_ACTIVE (shared tail storeGameActive); mark the game
; active
setGameActive:
19D1: 3E 01           MVI     A,$01               ; load 1 to raise the master "a game is live" flag

; store A -> GAME_ACTIVE (shared tail)
storeGameActive:
19D3: 32 E9 20        STA     $20E9               ; store the accumulator into the game-active flag
19D6: C9              RET                         

; store 0 -> GAME_ACTIVE (shared tail storeGameActive); clear the game-
; active flag
clearGameActive:
19D7: AF              XRA     A                   ; clear the accumulator to 0 to drop the game-active flag
19D8: C3 D3 19        JMP     $19D3               ; write it through the shared flag store at $19d3

; ---- $19DB-$19DB: data ----
19DB: 00

; SOUND_PORT3_SHADOW &= B, mirror to sound port 3, A := result
clearSoundPort3Bit:
19DC: 3A 94 20        LDA     $2094               ; read the port-3 sound-latch shadow
19DF: A0              ANA     B                   ; AND with the keep-mask -- clear the target cue's bit
19E0: 32 94 20        STA     $2094               ; store the edited latch back to the shadow
19E3: D3 03           OUT     $03                 ; mirror it out to the sound port so the cue turns off
19E5: C9              RET                         

; draw A reserve-ship icons (RESERVE_SHIP_SPRITE) at
; RESERVE_SHIP_ICONS_SCREEN_ADDR, blanking the remainder; skip drawing
; when the count is zero
drawReserveLifeIcons:
19E6: 21 01 27        LXI     H,$2701             ; point at the reserve-ship icon row in video RAM
19E9: CA FA 19        JZ      $19FA               ; no reserve ships: skip drawing, jump to the blank sweep

loc_19ec:
19EC: 11 60 1C        LXI     D,$1C60             ; point at the reserve-ship icon bitmap
19EF: 06 10           MVI     B,$10               ; 16 bytes -- one ship icon
19F1: 4F              MOV     C,A                 ; hold the remaining icon count in C
19F2: CD 39 14        CALL    $1439               ; {code.drawSpriteColumn} blit one ship icon, advancing the destination one slot right
19F5: 79              MOV     A,C                 ; recover the icon counter
19F6: 3D              DCR     A                   ; one fewer icon to draw
19F7: C2 EC 19        JNZ     $19EC               ; loop until every reserve icon is drawn

; repeatedly clearScreenStrip to blank a wider screen region
clearScreenRegion:
19FA: 06 10           MVI     B,$10               ; 16-column strip width
19FC: CD CB 14        CALL    $14CB               ; {code.clearScreenStrip} blank one 16-column strip from the current pointer
19FF: 7C              MOV     A,H                 ; take the strip base's high byte
1A00: FE 35           CPI     $35                 ; reached the terminator row at video page 0x35?
1A02: C2 FA 19        JNZ     $19FA               ; keep clearing strips until the sweep hits it
1A05: C9              RET                         

; raster draw-phase predicate: carry := (mem[DE] & 0x80) ===
; mem[DRAW_PHASE_FLAG] -- true when the object's phase bit (bit7 of its
; byte) matches the current raster half (DRAW_PHASE_FLAG is 0x80 in the
; vblank half, 0x00 in the mid-screen half); the three object dispatchers
; rnc-skip an object that does not belong to this half-frame
objectMatchesDrawPhase:
1A06: 21 72 20        LXI     H,$2072             ; point at the current raster-half flag
1A09: 46              MOV     B,M                 ; load the half-frame flag -- 0x80 top half, 0x00 mid
1A0A: 1A              LDAX    D                   ; read the object's first byte
1A0B: E6 80           ANI     $80                 ; isolate its phase bit (bit 7)
1A0D: A8              XRA     B                   ; compare the object's phase against the live half-frame
1A0E: C0              RNZ                         ; return with carry clear if the object belongs to the other half
1A0F: 37              STC                         ; object is in this half: set carry to signal a match
1A10: C9              RET                         

; ---- $1A11-$1A31: data ----
1A11: 32 2B 24 1C 16 11 0D 0A 08 07 06 05 04 03 02 01
1A21: 34 2E 27 22 1C 18 15 13 10 0E 0D 0C 0B 09 07 05
1A31: FF

; block-copy B bytes (DE)->(HL), both advancing
blockCopy:
1A32: 1A              LDAX    D                   ; read a source byte
1A33: 77              MOV     M,A                 ; write it to the destination
1A34: 23              INX     H                   ; advance the destination pointer
1A35: 13              INX     D                   ; advance the source pointer
1A36: 05              DCR     B                   ; one fewer byte to copy
1A37: C2 32 1A        JNZ     $1A32               ; loop until the block is moved -- a count of 0 copies a full 256 bytes
1A3A: C9              RET                         

; read 5-byte descriptor at (HL) -> DE/A/C/B, then HL=C:A
loadSpriteDescriptor:
1A3B: 5E              MOV     E,M                 ; read the graphics-pointer low byte
1A3C: 23              INX     H                   
1A3D: 56              MOV     D,M                 ; read the graphics-pointer high byte -- forms the sprite bitmap pointer
1A3E: 23              INX     H                   
1A3F: 7E              MOV     A,M                 ; read the coordinate byte
1A40: 23              INX     H                   
1A41: 4E              MOV     C,M                 ; read the next descriptor field
1A42: 23              INX     H                   
1A43: 46              MOV     B,M                 ; read the last descriptor field
1A44: 61              MOV     H,C                 ; build the coordinate word's high byte
1A45: 6F              MOV     L,A                 ; and its low byte -- now points at the object's coordinate word
1A46: C9              RET                         

; HL := (HL >> 3) with H forced into the 0x2000-0x3fff video-RAM page
coordToScreenAddr:
1A47: C5              PUSH    B                   
1A48: 06 03           MVI     B,$03               ; three shift passes -- divide the coordinate by eight

loc_1a4a:
1A4A: 7C              MOV     A,H                 
1A4B: 1F              RAR                         ; shift the high byte right, its low bit falling into carry
1A4C: 67              MOV     H,A                 
1A4D: 7D              MOV     A,L                 
1A4E: 1F              RAR                         ; pull that carry into the low byte's top -- one 16-bit right shift
1A4F: 6F              MOV     L,A                 
1A50: 05              DCR     B                   ; one shift pass done
1A51: C2 4A 1A        JNZ     $1A4A               ; repeat until divided by eight -- eight pixels per byte
1A54: 7C              MOV     A,H                 ; take the shifted high byte
1A55: E6 3F           ANI     $3F                 ; mask it into the video page
1A57: F6 20           ORI     $20                 ; force the address into the 0x2000-0x3fff video window
1A59: 67              MOV     H,A                 ; seat the clamped high byte back into the screen address
1A5A: C1              POP     B                   
1A5B: C9              RET                         

; zero video RAM 0x2400..0x3fff
clearScreen:
1A5C: 21 00 24        LXI     H,$2400             ; point at the first byte of video memory

loc_1a5f:
1A5F: 36 00           MVI     M,$00               ; blank this screen byte -- eight pixels off
1A61: 23              INX     H                   ; step to the next screen byte
1A62: 7C              MOV     A,H                 
1A63: FE 40           CPI     $40                 ; stop once the pointer reaches the end of video memory -- high byte 0x40
1A65: C2 5F 1A        JNZ     $1A5F               ; keep going until the whole screen is cleared
1A68: C9              RET                         

; OR-merge C source bytes down each of B columns (columns 0x20 apart);
; advance HL and DE
orBlitBitmap:
1A69: C5              PUSH    B                   
1A6A: E5              PUSH    H                   ; remember where this row starts

loc_1a6b:
1A6B: 1A              LDAX    D                   ; read a byte of the source bitmap
1A6C: B6              ORA     M                   ; merge it over what is already on screen -- the background shows through
1A6D: 77              MOV     M,A                 ; write the merged byte back to the screen
1A6E: 13              INX     D                   ; advance to the next source byte
1A6F: 23              INX     H                   ; advance to the next screen byte
1A70: 0D              DCR     C                   ; count down the bytes left in this row
1A71: C2 6B 1A        JNZ     $1A6B               ; loop across the row
1A74: E1              POP     H                   ; back to this row's start
1A75: 01 20 00        LXI     B,$0020             ; load the screen row stride -- 0x20 bytes
1A78: 09              DAD     B                   ; step the destination down one screen row
1A79: C1              POP     B                   
1A7A: 05              DCR     B                   ; count down the rows left
1A7B: C2 69 1A        JNZ     $1A69               ; loop to blit the next row
1A7E: C9              RET                         

; reserve-ships readout: readActivePlayerPageTopByte gives the count at
; the active page top; if zero bail; else store count-1 back (a ship
; enters play), drawReserveLifeIcons(count-1) the reserve row, then
; drawLivesDigit(count)
decrementShipsAndDrawReadout:
1A7F: CD 2E 09        CALL    $092E               ; {code.readActivePlayerPageTopByte} read the active player's remaining-ship count
1A82: A7              ANA     A                   ; test whether any ships remain
1A83: C8              RZ                          ; return if no ships are left
1A84: F5              PUSH    PSW                 ; keep the full ship count aside
1A85: 3D              DCR     A                   ; spend one ship -- the one entering play
1A86: 77              MOV     M,A                 ; store the reduced count back
1A87: CD E6 19        CALL    $19E6               ; {code.drawReserveLifeIcons} repaint the reserve-ship icon row -- ships held back
1A8A: F1              POP     PSW                 ; restore the full count for the lives digit

; draw the low nibble of A as a digit glyph at LIVES_DIGIT_SCREEN_ADDR via
; drawDigit
drawLivesDigit:
1A8B: 21 01 25        LXI     H,$2501             ; point at the lives-digit slot on screen
1A8E: E6 0F           ANI     $0F                 ; keep the count to a single digit -- low nibble
1A90: C3 C5 09        JMP     $09C5               ; draw the digit glyph

; ---- $1A93-$1FFF: data ----
1A93: 00 00 00 00 FF B8 FE 20 1C 10 9E 00 20 1C 30 10
1AA3: 0B 08 07 06 00 0C 04 26 0E 15 04 11 26 26 0F 0B
1AB3: 00 18 04 11 24 26 25 1B 26 0E 11 26 1C 0F 0B 00
1AC3: 18 04 11 12 26 01 14 13 13 0E 0D 26 0E 0D 0B 18
1AD3: 26 1B 0F 0B 00 18 04 11 26 26 01 14 13 13 0E 0D
1AE3: 26 26 12 02 0E 11 04 24 1B 25 26 07 08 3F 12 02
1AF3: 0E 11 04 26 12 02 0E 11 04 24 1C 25 26 01 00 00
1B03: 10 00 00 00 00 02 78 38 78 38 00 F8 00 00 80 00
1B13: 8E 02 FF 05 0C 60 1C 20 30 10 01 00 00 00 00 00
1B23: BB 03 00 10 90 1C 28 30 01 04 00 FF FF 00 00 02
1B33: 76 04 00 00 00 00 00 04 EE 1C 00 00 03 00 00 00
1B43: B6 04 00 00 01 00 1D 04 E2 1C 00 00 03 00 00 00
1B53: 82 06 00 00 01 06 1D 04 D0 1C 00 00 03 FF 00 C0
1B63: 1C 00 00 10 21 01 00 30 00 12 00 00 00 0F 0B 00
1B73: 18 26 0F 0B 00 18 04 11 24 1B 25 FC 00 01 FF FF
1B83: 00 00 00 20 64 1D D0 29 18 02 54 1D 00 08 00 06
1B93: 00 00 01 40 00 01 00 00 10 9E 00 20 1C 00 03 04
1BA3: 78 14 13 08 1A 3D 68 FC FC 68 3D 1A 00 00 00 01
1BB3: B8 98 A0 1B 10 FF 00 A0 1B 00 00 00 00 00 10 00
1BC3: 0E 05 00 00 00 00 00 07 D0 1C C8 9B 03 00 00 03
1BD3: 04 78 14 0B 19 3A 6D FA FA 6D 3A 19 00 00 00 00
1BE3: 00 00 00 00 00 00 01 00 00 01 74 1F 00 80 00 00
1BF3: 00 00 00 1C 2F 00 00 1C 27 00 00 1C 39 00 00 39
1C03: 79 7A 6E EC FA FA EC 6E 7A 79 39 00 00 00 00 00
1C13: 78 1D BE 6C 3C 3C 3C 6C BE 1D 78 00 00 00 00 00
1C23: 00 19 3A 6D FA FA 6D 3A 19 00 00 00 00 00 00 38
1C33: 7A 7F 6D EC FA FA EC 6D 7F 7A 38 00 00 00 00 00
1C43: 0E 18 BE 6D 3D 3C 3D 6D BE 18 0E 00 00 00 00 00
1C53: 00 1A 3D 68 FC FC 68 3D 1A 00 00 00 00 00 00 0F
1C63: 1F 1F 1F 1F 7F FF 7F 1F 1F 1F 1F 0F 00 00 04 01
1C73: 13 03 07 B3 0F 2F 03 2F 49 04 03 00 01 40 08 05
1C83: A3 0A 03 5B 0F 27 27 0B 4B 40 84 11 48 0F 99 3C
1C93: 7E 3D BC 3E 7C 99 27 1B 1A 26 0F 0E 08 0D 13 12
1CA3: 28 12 02 0E 11 04 26 00 03 15 00 0D 02 04 26 13
1CB3: 00 01 0B 04 28 02 10 20 30 13 08 0B 13 00 08 49
1CC3: 22 14 81 42 00 42 81 14 22 49 08 00 00 44 AA 10
1CD3: 88 54 22 10 AA 44 22 54 88 4A 15 BE 3F 5E 25 04
1CE3: FC 04 10 FC 10 20 FC 20 80 FC 80 00 FE 00 24 FE
1CF3: 12 00 FE 00 48 FE 90 0F 0B 00 29 00 00 01 07 01
1D03: 01 01 04 0B 01 06 03 01 01 0B 09 02 08 02 0B 04
1D13: 07 0A 05 02 05 04 06 07 08 0A 06 0A 03 FF 0F FF
1D23: 1F FF 3F FF 7F FF FF FC FF F8 FF F0 FF F0 FF F0
1D33: FF F0 FF F0 FF F0 FF F0 FF F8 FF FC FF FF FF FF
1D43: FF FF 7F FF 3F FF 1F FF 0F 05 10 15 30 94 97 9A
1D53: 9D 10 05 05 10 15 10 10 05 30 10 10 10 05 15 10
1D63: 05 00 00 00 00 04 0C 1E 37 3E 7C 74 7E 7E 74 7C
1D73: 3E 37 1E 0C 04 00 00 00 00 00 22 00 A5 40 08 98
1D83: 3D B6 3C 36 1D 10 48 62 B6 1D 98 08 42 90 08 00
1D93: 00 26 1F 1A 1B 1A 1A 1B 1F 1A 1D 1A 1A 10 20 30
1DA3: 60 50 48 48 48 40 40 40 0F 0B 00 18 12 0F 00 02
1DB3: 04 26 26 08 0D 15 00 03 04 11 12 0E 2C 68 1D 0C
1DC3: 2C 20 1C 0A 2C 40 1C 08 2C 00 1C FF 0E 2E E0 1D
1DD3: 0C 2E EA 1D 0A 2E F4 1D 08 2E 99 1C FF 27 38 26
1DE3: 0C 18 12 13 04 11 18 27 1D 1A 26 0F 0E 08 0D 13
1DF3: 12 27 1C 1A 26 0F 0E 08 0D 13 12 00 00 00 1F 24
1E03: 44 24 1F 00 00 00 7F 49 49 49 36 00 00 00 3E 41
1E13: 41 41 22 00 00 00 7F 41 41 41 3E 00 00 00 7F 49
1E23: 49 49 41 00 00 00 7F 48 48 48 40 00 00 00 3E 41
1E33: 41 45 47 00 00 00 7F 08 08 08 7F 00 00 00 00 41
1E43: 7F 41 00 00 00 00 02 01 01 01 7E 00 00 00 7F 08
1E53: 14 22 41 00 00 00 7F 01 01 01 01 00 00 00 7F 20
1E63: 18 20 7F 00 00 00 7F 10 08 04 7F 00 00 00 3E 41
1E73: 41 41 3E 00 00 00 7F 48 48 48 30 00 00 00 3E 41
1E83: 45 42 3D 00 00 00 7F 48 4C 4A 31 00 00 00 32 49
1E93: 49 49 26 00 00 00 40 40 7F 40 40 00 00 00 7E 01
1EA3: 01 01 7E 00 00 00 7C 02 01 02 7C 00 00 00 7F 02
1EB3: 0C 02 7F 00 00 00 63 14 08 14 63 00 00 00 60 10
1EC3: 0F 10 60 00 00 00 43 45 49 51 61 00 00 00 3E 45
1ED3: 49 51 3E 00 00 00 00 21 7F 01 00 00 00 00 23 45
1EE3: 49 49 31 00 00 00 42 41 49 59 66 00 00 00 0C 14
1EF3: 24 7F 04 00 00 00 72 51 51 51 4E 00 00 00 1E 29
1F03: 49 49 46 00 00 00 40 47 48 50 60 00 00 00 36 49
1F13: 49 49 36 00 00 00 31 49 49 4A 3C 00 00 00 08 14
1F23: 22 41 00 00 00 00 00 41 22 14 08 00 00 00 00 00
1F33: 00 00 00 00 00 00 14 14 14 14 14 00 00 00 22 14
1F43: 7F 14 22 00 00 00 03 04 78 04 03 00 00 24 1B 26
1F53: 0E 11 26 1C 26 0F 0B 00 18 04 11 12 25 26 26 28
1F63: 1B 26 0F 0B 00 18 04 11 26 26 1B 26 02 0E 08 0D
1F73: 26 01 01 00 00 01 00 02 01 00 02 01 00 60 10 0F
1F83: 10 60 30 18 1A 3D 68 FC FC 68 3D 1A 00 08 0D 12
1F93: 04 11 13 26 26 02 0E 08 0D 0D 2A 50 1F 0A 2A 62
1FA3: 1F 07 2A E1 1F FF 02 11 04 03 08 13 26 00 60 10
1FB3: 0F 10 60 38 19 3A 6D FA FA 6D 3A 19 00 00 20 40
1FC3: 4D 50 20 00 00 00 00 00 FF B8 FF 80 1F 10 97 00
1FD3: 80 1F 00 00 01 D0 22 20 1C 10 94 00 20 1C 28 1C
1FE3: 26 0F 0B 00 18 04 11 12 26 1C 26 02 0E 08 0D 12
1FF3: 0F 14 12 07 26 00 08 08 08 08 08 00 00
```
