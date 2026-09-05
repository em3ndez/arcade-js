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
0003: C3 D4 18        JMP     $18D4               

; ---- $0006-$0007: data ----
0006: 00 00

loc_0008:
0008: F5              PUSH    PSW                 
0009: C5              PUSH    B                   
000A: D5              PUSH    D                   
000B: E5              PUSH    H                   
000C: C3 8C 00        JMP     $008C               

; ---- $000F-$000F: data ----
000F: 00

loc_0010:
0010: F5              PUSH    PSW                 
0011: C5              PUSH    B                   
0012: D5              PUSH    D                   
0013: E5              PUSH    H                   
0014: 3E 80           MVI     A,$80               
0016: 32 72 20        STA     $2072               
0019: 21 C0 20        LXI     H,$20C0             
001C: 35              DCR     M                   
001D: CD CD 17        CALL    $17CD               ; {code.loc_17cd}
0020: DB 01           IN      $01                 
0022: 0F              RRC                         
0023: DA 67 00        JC      $0067               
0026: 3A EA 20        LDA     $20EA               
0029: A7              ANA     A                   
002A: CA 42 00        JZ      $0042               
002D: 3A EB 20        LDA     $20EB               
0030: FE 99           CPI     $99                 
0032: CA 3E 00        JZ      $003E               
0035: C6 01           ADI     $01                 
0037: 27              DAA                         
0038: 32 EB 20        STA     $20EB               
003B: CD 47 19        CALL    $1947               ; {code.drawCreditCount}

loc_003e:
003E: AF              XRA     A                   

loc_003f:
003F: 32 EA 20        STA     $20EA               

loc_0042:
0042: 3A E9 20        LDA     $20E9               
0045: A7              ANA     A                   
0046: CA 82 00        JZ      $0082               
0049: 3A EF 20        LDA     $20EF               
004C: A7              ANA     A                   
004D: C2 6F 00        JNZ     $006F               
0050: 3A EB 20        LDA     $20EB               
0053: A7              ANA     A                   
0054: C2 5D 00        JNZ     $005D               
0057: CD BF 0A        CALL    $0ABF               ; {code.loc_0abf}
005A: C3 82 00        JMP     $0082               

loc_005d:
005D: 3A 93 20        LDA     $2093               
0060: A7              ANA     A                   
0061: C2 82 00        JNZ     $0082               
0064: C3 65 07        JMP     $0765               

loc_0067:
0067: 3E 01           MVI     A,$01               
0069: 32 EA 20        STA     $20EA               
006C: C3 3F 00        JMP     $003F               

loc_006f:
006F: CD 40 17        CALL    $1740               ; {code.stepFleetMarchSound}

loc_0072:
0072: 3A 32 20        LDA     $2032               
0075: 32 80 20        STA     $2080               
0078: CD 00 01        CALL    $0100               ; {code.drawPendingAlien}
007B: CD 48 02        CALL    $0248               ; {code.loc_0248}
007E: CD 13 09        CALL    $0913               ; {code.tickSaucerSpawnTimer}
0081: 00              NOP                         

loc_0082:
0082: E1              POP     H                   
0083: D1              POP     D                   
0084: C1              POP     B                   
0085: F1              POP     PSW                 
0086: FB              EI                          
0087: C9              RET                         

; ---- $0088-$008B: data ----
0088: 00 00 00 00

loc_008c:
008C: AF              XRA     A                   
008D: 32 72 20        STA     $2072               
0090: 3A E9 20        LDA     $20E9               
0093: A7              ANA     A                   
0094: CA 82 00        JZ      $0082               
0097: 3A EF 20        LDA     $20EF               
009A: A7              ANA     A                   
009B: C2 A5 00        JNZ     $00A5               
009E: 3A C1 20        LDA     $20C1               
00A1: 0F              RRC                         
00A2: D2 82 00        JNC     $0082               

loc_00a5:
00A5: 21 20 20        LXI     H,$2020             
00A8: CD 4B 02        CALL    $024B               ; {code.loc_024b}
00AB: CD 41 01        CALL    $0141               ; {code.loc_0141}
00AE: C3 82 00        JMP     $0082               

; load the active player's saved field record: mirror the reference-alien
; coord word to $2009/ALIEN_DRAW_ADDR, derive the count at $2008, set
; FLEET_MOVE_DIR on the 0xfe edge sentinel
loadReferenceAlienState:
00B1: CD 86 08        CALL    $0886               ; {code.activeFieldRecordPointer}
00B4: E5              PUSH    H                   
00B5: 7E              MOV     A,M                 
00B6: 23              INX     H                   
00B7: 66              MOV     H,M                 
00B8: 6F              MOV     L,A                 
00B9: 22 09 20        SHLD    $2009               
00BC: 22 0B 20        SHLD    $200B               
00BF: E1              POP     H                   
00C0: 2B              DCX     H                   
00C1: 7E              MOV     A,M                 
00C2: FE 03           CPI     $03                 
00C4: C2 C8 00        JNZ     $00C8               
00C7: 3D              DCR     A                   

loc_00c8:
00C8: 32 08 20        STA     $2008               
00CB: FE FE           CPI     $FE                 
00CD: 3E 00           MVI     A,$00               
00CF: C2 D3 00        JNZ     $00D3               
00D2: 3C              INR     A                   

loc_00d3:
00D3: 32 0D 20        STA     $200D               
00D6: C9              RET                         

loc_00d7:
00D7: 3E 02           MVI     A,$02               
00D9: 32 FB 21        STA     $21FB               
00DC: 32 FB 22        STA     $22FB               
00DF: C3 E4 08        JMP     $08E4               

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
0103: 7E              MOV     A,M                 
0104: A7              ANA     A                   
0105: C2 38 15        JNZ     $1538               
0108: E5              PUSH    H                   
0109: 3A 06 20        LDA     $2006               
010C: 6F              MOV     L,A                 
010D: 3A 67 20        LDA     $2067               
0110: 67              MOV     H,A                 
0111: 7E              MOV     A,M                 
0112: A7              ANA     A                   
0113: E1              POP     H                   
0114: CA 36 01        JZ      $0136               
0117: 23              INX     H                   
0118: 23              INX     H                   
0119: 7E              MOV     A,M                 
011A: 23              INX     H                   
011B: 46              MOV     B,M                 
011C: E6 FE           ANI     $FE                 
011E: 07              RLC                         
011F: 07              RLC                         
0120: 07              RLC                         
0121: 5F              MOV     E,A                 
0122: 16 00           MVI     D,$00               
0124: 21 00 1C        LXI     H,$1C00             
0127: 19              DAD     D                   
0128: EB              XCHG                        
0129: 78              MOV     A,B                 
012A: A7              ANA     A                   
012B: C4 3B 01        CNZ     $013B               
012E: 2A 0B 20        LHLD    $200B               
0131: 06 10           MVI     B,$10               
0133: CD D3 15        CALL    $15D3               ; {code.blitShiftedSprite}

loc_0136:
0136: AF              XRA     A                   
0137: 32 00 20        STA     $2000               
013A: C9              RET                         

; bump sprite pointer to 2nd bank (DE += 0x30)
selectAlternateSpriteFrame:
013B: 21 30 00        LXI     H,$0030             
013E: 19              DAD     D                   
013F: EB              XCHG                        
0140: C9              RET                         

loc_0141:
0141: 3A 68 20        LDA     $2068               
0144: A7              ANA     A                   
0145: C8              RZ                          
0146: 3A 00 20        LDA     $2000               
0149: A7              ANA     A                   
014A: C0              RNZ                         
014B: 3A 67 20        LDA     $2067               
014E: 67              MOV     H,A                 
014F: 3A 06 20        LDA     $2006               
0152: 16 02           MVI     D,$02               

loc_0154:
0154: 3C              INR     A                   
0155: FE 37           CPI     $37                 
0157: CC A1 01        CZ      $01A1               
015A: 6F              MOV     L,A                 
015B: 46              MOV     B,M                 
015C: 05              DCR     B                   
015D: C2 54 01        JNZ     $0154               
0160: 32 06 20        STA     $2006               
0163: CD 7A 01        CALL    $017A               ; {code.alienIndexToScreenCoords}
0166: 61              MOV     H,C                 
0167: 22 0B 20        SHLD    $200B               
016A: 7D              MOV     A,L                 
016B: FE 28           CPI     $28                 
016D: DA 71 19        JC      $1971               
0170: 7A              MOV     A,D                 
0171: 32 04 20        STA     $2004               
0174: 3E 01           MVI     A,$01               
0176: 32 00 20        STA     $2000               
0179: C9              RET                         

; resolve L over 0x0b into (L,C,D) using the B,C pair at $2009/$200A
alienIndexToScreenCoords:
017A: 16 00           MVI     D,$00               
017C: 7D              MOV     A,L                 
017D: 21 09 20        LXI     H,$2009             
0180: 46              MOV     B,M                 
0181: 23              INX     H                   
0182: 4E              MOV     C,M                 

loc_0183:
0183: FE 0B           CPI     $0B                 
0185: FA 94 01        JM      $0194               
0188: DE 0B           SBI     $0B                 
018A: 5F              MOV     E,A                 
018B: 78              MOV     A,B                 
018C: C6 10           ADI     $10                 
018E: 47              MOV     B,A                 
018F: 7B              MOV     A,E                 
0190: 14              INR     D                   
0191: C3 83 01        JMP     $0183               

loc_0194:
0194: 68              MOV     L,B                 

loc_0195:
0195: A7              ANA     A                   
0196: C8              RZ                          
0197: 5F              MOV     E,A                 
0198: 79              MOV     A,C                 
0199: C6 10           ADI     $10                 
019B: 4F              MOV     C,A                 
019C: 7B              MOV     A,E                 
019D: 3D              DCR     A                   
019E: C3 95 01        JMP     $0195               

loc_01a1:
01A1: 15              DCR     D                   
01A2: CA CD 01        JZ      $01CD               
01A5: 21 06 20        LXI     H,$2006             
01A8: 36 00           MVI     M,$00               
01AA: 23              INX     H                   
01AB: 4E              MOV     C,M                 
01AC: 36 00           MVI     M,$00               
01AE: CD D9 01        CALL    $01D9               ; {code.advanceRecordTotals}
01B1: 21 05 20        LXI     H,$2005             
01B4: 7E              MOV     A,M                 
01B5: 3C              INR     A                   
01B6: E6 01           ANI     $01                 
01B8: 77              MOV     M,A                 
01B9: AF              XRA     A                   
01BA: 21 67 20        LXI     H,$2067             
01BD: 66              MOV     H,M                 
01BE: C9              RET                         

; ---- $01BF-$01BF: data ----
01BF: 00

; seat the player-1 alien-status base ALIEN_FIELD_P1 then
; markAllAliensAlive (fill 0x37 cells with 0x01)
markAllAliensAliveP1:
01C0: 21 00 21        LXI     H,$2100             

; HL-relative fill of 0x37 bytes with 0x01
markAllAliensAlive:
01C3: 06 37           MVI     B,$37               

loc_01c5:
01C5: 36 01           MVI     M,$01               
01C7: 23              INX     H                   
01C8: 05              DCR     B                   
01C9: C2 C5 01        JNZ     $01C5               
01CC: C9              RET                         

loc_01cd:
01CD: E1              POP     H                   
01CE: C9              RET                         

; draw the full-width bottom ground line via fillScreenRow(0x01, 0xe0,
; PLAYFIELD_VRAM_BASE)
drawBottomLine:
01CF: 3E 01           MVI     A,$01               
01D1: 06 E0           MVI     B,$E0               
01D3: 21 02 24        LXI     H,$2402             
01D6: C3 CC 14        JMP     $14CC               

; record accumulate: [HL+2]+=C, [HL+3]+=[HL+1]; return 2nd total in A
advanceRecordTotals:
01D9: 23              INX     H                   
01DA: 46              MOV     B,M                 
01DB: 23              INX     H                   
01DC: 79              MOV     A,C                 
01DD: 86              ADD     M                   
01DE: 77              MOV     M,A                 
01DF: 23              INX     H                   
01E0: 78              MOV     A,B                 
01E1: 86              ADD     M                   
01E2: 77              MOV     M,A                 
01E3: C9              RET                         

; preset the copy count to 0xc0, then initWorkRam blockCopies the ROM
; template WORKRAM_INIT_IMAGE into the work-RAM base; memory-only
seedWorkRamImage:
01E4: 06 C0           MVI     B,$C0               

; boot-init: blockCopy the caller's B bytes from ROM image
; WORKRAM_INIT_IMAGE into the base of work RAM
initWorkRam:
01E6: 11 00 1B        LXI     D,$1B00             
01E9: 21 00 20        LXI     H,$2000             
01EC: C3 32 1A        JMP     $1A32               

; seat the player-1 shield buffer base PLAYER1_SHIELD_BUFFER, then
; initShieldBuffers replicates the shield template into four slots
initPlayer1ShieldBuffers:
01EF: 21 42 21        LXI     H,$2142             
01F2: C3 F8 01        JMP     $01F8               

; seat the player-2 shield buffer base PLAYER2_SHIELD_BUFFER, then
; initShieldBuffers replicates the shield template into four slots
initPlayer2ShieldBuffers:
01F5: 21 42 22        LXI     H,$2242             

; replicate the 0x2c-byte shield template SHIELD_TEMPLATE into four
; consecutive shield buffers from HL
initShieldBuffers:
01F8: 0E 04           MVI     C,$04               
01FA: 11 20 1D        LXI     D,$1D20             

loc_01fd:
01FD: D5              PUSH    D                   
01FE: 06 2C           MVI     B,$2C               
0200: CD 32 1A        CALL    $1A32               ; {code.blockCopy}
0203: D1              POP     D                   
0204: 0D              DCR     C                   
0205: C2 FD 01        JNZ     $01FD               
0208: C9              RET                         

; force save mode (A=1), then saveOrRestorePlayer1Shields captures the
; four player-1 shields into PLAYER1_SHIELD_BUFFER; memory-only
savePlayer1Shields:
0209: 3E 01           MVI     A,$01               
020B: C3 1B 02        JMP     $021B               

; force save mode (A=1), then saveOrRestorePlayer2Shields captures the
; four player-2 shields into PLAYER2_SHIELD_BUFFER; memory-only
savePlayer2Shields:
020E: 3E 01           MVI     A,$01               
0210: C3 14 02        JMP     $0214               

; force restore mode (A=0), then saveOrRestorePlayer2Shields OR-blits the
; player-2 shields back from PLAYER2_SHIELD_BUFFER; memory-only
restorePlayer2Shields:
0213: AF              XRA     A                   

; seat DE=PLAYER2_SHIELD_BUFFER, then drawOrSaveShields saves-or-restores
; the four player-2 shield blocks per the caller's mode; memory-only
saveOrRestorePlayer2Shields:
0214: 11 42 22        LXI     D,$2242             
0217: C3 1E 02        JMP     $021E               

; force restore mode (A=0), then saveOrRestorePlayer1Shields OR-blits the
; player-1 shields back from PLAYER1_SHIELD_BUFFER; memory-only
restorePlayer1Shields:
021A: AF              XRA     A                   

; seat DE=PLAYER1_SHIELD_BUFFER, then drawOrSaveShields saves-or-restores
; the four player-1 shield blocks per the caller's mode; memory-only
saveOrRestorePlayer1Shields:
021B: 11 42 21        LXI     D,$2142             

; shield save/restore: store SHIELD_SAVE_RESTORE_MODE, then four 22x2
; blocks from SHIELD_VRAM_BASE (stride DRAW_BLOCK_STRIDE) --
; captureScreenRect when set, orBlitBitmap when clear
drawOrSaveShields:
021E: 32 81 20        STA     $2081               
0221: 01 02 16        LXI     B,$1602             
0224: 21 06 28        LXI     H,$2806             
0227: 3E 04           MVI     A,$04               

loc_0229:
0229: F5              PUSH    PSW                 
022A: C5              PUSH    B                   
022B: 3A 81 20        LDA     $2081               
022E: A7              ANA     A                   
022F: C2 42 02        JNZ     $0242               
0232: CD 69 1A        CALL    $1A69               ; {code.orBlitBitmap}

loc_0235:
0235: C1              POP     B                   
0236: F1              POP     PSW                 
0237: 3D              DCR     A                   
0238: C8              RZ                          
0239: D5              PUSH    D                   
023A: 11 E0 02        LXI     D,$02E0             
023D: 19              DAD     D                   
023E: D1              POP     D                   
023F: C3 29 02        JMP     $0229               

loc_0242:
0242: CD 7C 14        CALL    $147C               ; {code.captureScreenRect}
0245: C3 35 02        JMP     $0235               

loc_0248:
0248: 21 10 20        LXI     H,$2010             

loc_024b:
024B: 7E              MOV     A,M                 
024C: FE FF           CPI     $FF                 
024E: C8              RZ                          
024F: FE FE           CPI     $FE                 
0251: CA 81 02        JZ      $0281               
0254: 23              INX     H                   
0255: 46              MOV     B,M                 
0256: 4F              MOV     C,A                 
0257: B0              ORA     B                   
0258: 79              MOV     A,C                 
0259: C2 77 02        JNZ     $0277               
025C: 23              INX     H                   
025D: 7E              MOV     A,M                 
025E: A7              ANA     A                   
025F: C2 88 02        JNZ     $0288               
0262: 23              INX     H                   
0263: 5E              MOV     E,M                 
0264: 23              INX     H                   
0265: 56              MOV     D,M                 
0266: E5              PUSH    H                   
0267: EB              XCHG                        
0268: E5              PUSH    H                   
0269: 21 6F 02        LXI     H,$026F             
026C: E3              XTHL                        
026D: D5              PUSH    D                   
026E: E9              PCHL                        

loc_026f:
026F: E1              POP     H                   
0270: 11 0C 00        LXI     D,$000C             
0273: 19              DAD     D                   
0274: C3 4B 02        JMP     $024B               

loc_0277:
0277: 05              DCR     B                   
0278: 04              INR     B                   
0279: C2 7D 02        JNZ     $027D               
027C: 3D              DCR     A                   

loc_027d:
027D: 05              DCR     B                   
027E: 70              MOV     M,B                 
027F: 2B              DCX     H                   
0280: 77              MOV     M,A                 

loc_0281:
0281: 11 10 00        LXI     D,$0010             
0284: 19              DAD     D                   
0285: C3 4B 02        JMP     $024B               

loc_0288:
0288: 35              DCR     M                   
0289: 2B              DCX     H                   
028A: 2B              DCX     H                   
028B: C3 81 02        JMP     $0281               

loc_028e:
028E: E1              POP     H                   
028F: 23              INX     H                   
0290: 7E              MOV     A,M                 
0291: FE FF           CPI     $FF                 
0293: CA 3B 03        JZ      $033B               
0296: 23              INX     H                   
0297: 35              DCR     M                   
0298: C0              RNZ                         
0299: 47              MOV     B,A                 
029A: AF              XRA     A                   
029B: 32 68 20        STA     $2068               
029E: 32 69 20        STA     $2069               
02A1: 3E 30           MVI     A,$30               
02A3: 32 6A 20        STA     $206A               
02A6: 78              MOV     A,B                 
02A7: 36 05           MVI     M,$05               
02A9: 23              INX     H                   
02AA: 35              DCR     M                   
02AB: C2 9B 03        JNZ     $039B               
02AE: 2A 1A 20        LHLD    $201A               
02B1: 06 10           MVI     B,$10               
02B3: CD 24 14        CALL    $1424               ; {code.clearSpriteColumn}
02B6: 21 10 20        LXI     H,$2010             
02B9: 11 10 1B        LXI     D,$1B10             
02BC: 06 10           MVI     B,$10               
02BE: CD 32 1A        CALL    $1A32               ; {code.blockCopy}
02C1: 06 00           MVI     B,$00               
02C3: CD DC 19        CALL    $19DC               ; {code.clearSoundPort3Bit}
02C6: 3A 6D 20        LDA     $206D               
02C9: A7              ANA     A                   
02CA: C0              RNZ                         
02CB: 3A EF 20        LDA     $20EF               
02CE: A7              ANA     A                   
02CF: C8              RZ                          
02D0: 31 00 24        LXI     SP,$2400            
02D3: FB              EI                          
02D4: CD D7 19        CALL    $19D7               ; {code.clearGameActive}
02D7: CD 2E 09        CALL    $092E               ; {code.readActivePlayerPageTopByte}
02DA: A7              ANA     A                   
02DB: CA 6D 16        JZ      $166D               
02DE: CD E7 18        CALL    $18E7               ; {code.otherPlayerFlagPtr}
02E1: 7E              MOV     A,M                 
02E2: A7              ANA     A                   
02E3: CA 2C 03        JZ      $032C               
02E6: 3A CE 20        LDA     $20CE               
02E9: A7              ANA     A                   
02EA: CA 2C 03        JZ      $032C               

loc_02ed:
02ED: 3A 67 20        LDA     $2067               
02F0: F5              PUSH    PSW                 
02F1: 0F              RRC                         
02F2: DA 32 03        JC      $0332               
02F5: CD 0E 02        CALL    $020E               ; {code.savePlayer2Shields}

loc_02f8:
02F8: CD 78 08        CALL    $0878               ; {code.stageActivePlayerFieldSave}
02FB: 73              MOV     M,E                 
02FC: 23              INX     H                   
02FD: 72              MOV     M,D                 
02FE: 2B              DCX     H                   
02FF: 2B              DCX     H                   
0300: 70              MOV     M,B                 
0301: 00              NOP                         
0302: CD E4 01        CALL    $01E4               ; {code.seedWorkRamImage}
0305: F1              POP     PSW                 
0306: 0F              RRC                         
0307: 3E 21           MVI     A,$21               
0309: 06 00           MVI     B,$00               
030B: D2 12 03        JNC     $0312               
030E: 06 20           MVI     B,$20               
0310: 3E 22           MVI     A,$22               

loc_0312:
0312: 32 67 20        STA     $2067               
0315: CD B6 0A        CALL    $0AB6               ; {code.waitLongDelay}
0318: AF              XRA     A                   
0319: 32 11 20        STA     $2011               
031C: 78              MOV     A,B                 
031D: D3 05           OUT     $05                 
031F: 3C              INR     A                   
0320: 32 98 20        STA     $2098               
0323: CD D6 09        CALL    $09D6               ; {code.clearPlayfield}
0326: CD 7F 1A        CALL    $1A7F               ; {code.decrementShipsAndDrawReadout}
0329: C3 F9 07        JMP     $07F9               

loc_032c:
032C: CD 7F 1A        CALL    $1A7F               ; {code.decrementShipsAndDrawReadout}
032F: C3 17 08        JMP     $0817               

loc_0332:
0332: CD 09 02        CALL    $0209               ; {code.savePlayer1Shields}
0335: C3 F8 02        JMP     $02F8               

; ---- $0338-$033A: data ----
0338: 00 00 00

loc_033b:
033B: 21 68 20        LXI     H,$2068             
033E: 36 01           MVI     M,$01               
0340: 23              INX     H                   
0341: 7E              MOV     A,M                 
0342: A7              ANA     A                   
0343: C3 B0 03        JMP     $03B0               

loc_0346:
0346: 00              NOP                         
0347: 2B              DCX     H                   
0348: 36 01           MVI     M,$01               

loc_034a:
034A: 3A 1B 20        LDA     $201B               
034D: 47              MOV     B,A                 
034E: 3A EF 20        LDA     $20EF               
0351: A7              ANA     A                   
0352: C2 63 03        JNZ     $0363               
0355: 3A 1D 20        LDA     $201D               
0358: 0F              RRC                         
0359: DA 81 03        JC      $0381               
035C: 0F              RRC                         
035D: DA 8E 03        JC      $038E               
0360: C3 6F 03        JMP     $036F               

loc_0363:
0363: CD C0 17        CALL    $17C0               ; {code.readActivePlayerInput}
0366: 07              RLC                         
0367: 07              RLC                         
0368: DA 81 03        JC      $0381               
036B: 07              RLC                         
036C: DA 8E 03        JC      $038E               

loc_036f:
036F: 21 18 20        LXI     H,$2018             
0372: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor}
0375: CD 47 1A        CALL    $1A47               ; {code.coordToScreenAddr}
0378: CD 39 14        CALL    $1439               ; {code.drawSpriteColumn}
037B: 3E 00           MVI     A,$00               
037D: 32 12 20        STA     $2012               
0380: C9              RET                         

loc_0381:
0381: 78              MOV     A,B                 
0382: FE D9           CPI     $D9                 
0384: CA 6F 03        JZ      $036F               
0387: 3C              INR     A                   
0388: 32 1B 20        STA     $201B               
038B: C3 6F 03        JMP     $036F               

loc_038e:
038E: 78              MOV     A,B                 
038F: FE 30           CPI     $30                 
0391: CA 6F 03        JZ      $036F               
0394: 3D              DCR     A                   
0395: 32 1B 20        STA     $201B               
0398: C3 6F 03        JMP     $036F               

loc_039b:
039B: 3C              INR     A                   
039C: E6 01           ANI     $01                 
039E: 32 15 20        STA     $2015               
03A1: 07              RLC                         
03A2: 07              RLC                         
03A3: 07              RLC                         
03A4: 07              RLC                         
03A5: 21 70 1C        LXI     H,$1C70             
03A8: 85              ADD     L                   
03A9: 6F              MOV     L,A                 
03AA: 22 18 20        SHLD    $2018               
03AD: C3 6F 03        JMP     $036F               

loc_03b0:
03B0: C2 4A 03        JNZ     $034A               
03B3: 23              INX     H                   
03B4: 35              DCR     M                   
03B5: C2 4A 03        JNZ     $034A               
03B8: C3 46 03        JMP     $0346               

loc_03bb:
03BB: 11 2A 20        LXI     D,$202A             
03BE: CD 06 1A        CALL    $1A06               ; {code.objectMatchesDrawPhase}
03C1: E1              POP     H                   
03C2: D0              RNC                         
03C3: 23              INX     H                   
03C4: 7E              MOV     A,M                 
03C5: A7              ANA     A                   
03C6: C8              RZ                          
03C7: FE 01           CPI     $01                 
03C9: CA FA 03        JZ      $03FA               
03CC: FE 02           CPI     $02                 
03CE: CA 0A 04        JZ      $040A               
03D1: 23              INX     H                   
03D2: FE 03           CPI     $03                 
03D4: C2 2A 04        JNZ     $042A               
03D7: 35              DCR     M                   
03D8: CA 36 04        JZ      $0436               
03DB: 7E              MOV     A,M                 
03DC: FE 0F           CPI     $0F                 
03DE: C0              RNZ                         
03DF: E5              PUSH    H                   
03E0: CD 30 04        CALL    $0430               ; {code.loadPlayerShotDescriptor}
03E3: CD 52 14        CALL    $1452               ; {code.eraseShiftedSprite}
03E6: E1              POP     H                   
03E7: 23              INX     H                   
03E8: 34              INR     M                   
03E9: 23              INX     H                   
03EA: 23              INX     H                   
03EB: 35              DCR     M                   
03EC: 35              DCR     M                   
03ED: 23              INX     H                   
03EE: 35              DCR     M                   
03EF: 35              DCR     M                   
03F0: 35              DCR     M                   
03F1: 23              INX     H                   
03F2: 36 08           MVI     M,$08               
03F4: CD 30 04        CALL    $0430               ; {code.loadPlayerShotDescriptor}
03F7: C3 00 14        JMP     $1400               

loc_03fa:
03FA: 3C              INR     A                   
03FB: 77              MOV     M,A                 
03FC: 3A 1B 20        LDA     $201B               
03FF: C6 08           ADI     $08                 
0401: 32 2A 20        STA     $202A               
0404: CD 30 04        CALL    $0430               ; {code.loadPlayerShotDescriptor}
0407: C3 00 14        JMP     $1400               

loc_040a:
040A: CD 30 04        CALL    $0430               ; {code.loadPlayerShotDescriptor}
040D: D5              PUSH    D                   
040E: E5              PUSH    H                   
040F: C5              PUSH    B                   
0410: CD 52 14        CALL    $1452               ; {code.eraseShiftedSprite}
0413: C1              POP     B                   
0414: E1              POP     H                   
0415: D1              POP     D                   
0416: 3A 2C 20        LDA     $202C               
0419: 85              ADD     L                   
041A: 6F              MOV     L,A                 
041B: 32 29 20        STA     $2029               
041E: CD 91 14        CALL    $1491               ; {code.drawSpriteWithCollision}
0421: 3A 61 20        LDA     $2061               
0424: A7              ANA     A                   
0425: C8              RZ                          
0426: 32 02 20        STA     $2002               
0429: C9              RET                         

loc_042a:
042A: FE 05           CPI     $05                 
042C: C8              RZ                          
042D: C3 36 04        JMP     $0436               

; load the player-shot 5-byte descriptor at PLAYER_SHOT_DESC via
; loadSpriteDescriptor; HL := its screen address
loadPlayerShotDescriptor:
0430: 21 27 20        LXI     H,$2027             
0433: C3 3B 1A        JMP     $1A3B               

loc_0436:
0436: CD 30 04        CALL    $0430               ; {code.loadPlayerShotDescriptor}
0439: CD 52 14        CALL    $1452               ; {code.eraseShiftedSprite}
043C: 21 25 20        LXI     H,$2025             
043F: 11 25 1B        LXI     D,$1B25             
0442: 06 07           MVI     B,$07               
0444: CD 32 1A        CALL    $1A32               ; {code.blockCopy}
0447: 2A 8D 20        LHLD    $208D               
044A: 2C              INR     L                   
044B: 7D              MOV     A,L                 
044C: FE 63           CPI     $63                 
044E: DA 53 04        JC      $0453               
0451: 2E 54           MVI     L,$54               

loc_0453:
0453: 22 8D 20        SHLD    $208D               
0456: 2A 8F 20        LHLD    $208F               
0459: 2C              INR     L                   
045A: 22 8F 20        SHLD    $208F               
045D: 3A 84 20        LDA     $2084               
0460: A7              ANA     A                   
0461: C0              RNZ                         
0462: 7E              MOV     A,M                 
0463: E6 01           ANI     $01                 
0465: 01 29 02        LXI     B,$0229             
0468: C2 6E 04        JNZ     $046E               
046B: 01 E0 FE        LXI     B,$FEE0             

loc_046e:
046E: 21 8A 20        LXI     H,$208A             
0471: 71              MOV     M,C                 
0472: 23              INX     H                   
0473: 23              INX     H                   
0474: 70              MOV     M,B                 
0475: C9              RET                         

loc_0476:
0476: E1              POP     H                   
0477: 3A 32 1B        LDA     $1B32               
047A: 32 32 20        STA     $2032               
047D: 2A 38 20        LHLD    $2038               
0480: 7D              MOV     A,L                 
0481: B4              ORA     H                   
0482: C2 8A 04        JNZ     $048A               
0485: 2B              DCX     H                   
0486: 22 38 20        SHLD    $2038               
0489: C9              RET                         

loc_048a:
048A: 11 35 20        LXI     D,$2035             
048D: 3E F9           MVI     A,$F9               
048F: CD 50 05        CALL    $0550               ; {code.copyRecordToWorkBuffer}
0492: 3A 46 20        LDA     $2046               
0495: 32 70 20        STA     $2070               
0498: 3A 56 20        LDA     $2056               
049B: 32 71 20        STA     $2071               
049E: CD 63 05        CALL    $0563               ; {code.stepAlienShot}
04A1: 3A 78 20        LDA     $2078               
04A4: A7              ANA     A                   
04A5: 21 35 20        LXI     H,$2035             
04A8: C2 5B 05        JNZ     $055B               
04AB: 11 30 1B        LXI     D,$1B30             
04AE: 21 30 20        LXI     H,$2030             
04B1: 06 10           MVI     B,$10               
04B3: C3 32 1A        JMP     $1A32               

loc_04b6:
04B6: E1              POP     H                   
04B7: 3A 6E 20        LDA     $206E               
04BA: A7              ANA     A                   
04BB: C0              RNZ                         
04BC: 3A 80 20        LDA     $2080               
04BF: FE 01           CPI     $01                 
04C1: C0              RNZ                         
04C2: 11 45 20        LXI     D,$2045             
04C5: 3E ED           MVI     A,$ED               
04C7: CD 50 05        CALL    $0550               ; {code.copyRecordToWorkBuffer}
04CA: 3A 36 20        LDA     $2036               
04CD: 32 70 20        STA     $2070               
04D0: 3A 56 20        LDA     $2056               
04D3: 32 71 20        STA     $2071               
04D6: CD 63 05        CALL    $0563               ; {code.stepAlienShot}
04D9: 3A 76 20        LDA     $2076               
04DC: FE 10           CPI     $10                 
04DE: DA E7 04        JC      $04E7               
04E1: 3A 48 1B        LDA     $1B48               
04E4: 32 76 20        STA     $2076               

loc_04e7:
04E7: 3A 78 20        LDA     $2078               
04EA: A7              ANA     A                   
04EB: 21 45 20        LXI     H,$2045             
04EE: C2 5B 05        JNZ     $055B               
04F1: 11 40 1B        LXI     D,$1B40             
04F4: 21 40 20        LXI     H,$2040             
04F7: 06 10           MVI     B,$10               
04F9: CD 32 1A        CALL    $1A32               ; {code.blockCopy}
04FC: 3A 82 20        LDA     $2082               
04FF: 3D              DCR     A                   
0500: C2 08 05        JNZ     $0508               
0503: 3E 01           MVI     A,$01               
0505: 32 6E 20        STA     $206E               

loc_0508:
0508: 2A 76 20        LHLD    $2076               
050B: C3 7E 06        JMP     $067E               

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
0514: CD 50 05        CALL    $0550               ; {code.copyRecordToWorkBuffer}
0517: 3A 46 20        LDA     $2046               
051A: 32 70 20        STA     $2070               
051D: 3A 36 20        LDA     $2036               
0520: 32 71 20        STA     $2071               
0523: CD 63 05        CALL    $0563               ; {code.stepAlienShot}
0526: 3A 76 20        LDA     $2076               
0529: FE 15           CPI     $15                 
052B: DA 34 05        JC      $0534               
052E: 3A 58 1B        LDA     $1B58               
0531: 32 76 20        STA     $2076               

loc_0534:
0534: 3A 78 20        LDA     $2078               
0537: A7              ANA     A                   
0538: 21 55 20        LXI     H,$2055             
053B: C2 5B 05        JNZ     $055B               
053E: 11 50 1B        LXI     D,$1B50             
0541: 21 50 20        LXI     H,$2050             
0544: 06 10           MVI     B,$10               
0546: CD 32 1A        CALL    $1A32               ; {code.blockCopy}
0549: 2A 76 20        LHLD    $2076               
054C: 22 58 20        SHLD    $2058               
054F: C9              RET                         

; stash A -> ALIEN_SHOT_SPRITE_FRAME_CEILING, then blockCopy 0x0b bytes
; (DE)->work buffer OBJECT_WORK_BUFFER (prime an object strip)
copyRecordToWorkBuffer:
0550: 32 7F 20        STA     $207F               
0553: 21 73 20        LXI     H,$2073             
0556: 06 0B           MVI     B,$0B               
0558: C3 32 1A        JMP     $1A32               

; blockCopy 0x0b bytes work buffer OBJECT_WORK_BUFFER ->(HL) (restore the
; object strip; twin of copyRecordToWorkBuffer)
copyWorkBufferToRecord:
055B: 11 73 20        LXI     D,$2073             
055E: 06 0B           MVI     B,$0B               
0560: C3 32 1A        JMP     $1A32               

; alien-shot handler -- step the active alien shot (draw-phase gate,
; blowup animation, descend one step, redraw with collision, retire across
; the shield/ground bands) or, when idle, spawn a new one from a firing
; column (task-flag/rate-timer gated, column picked via the cursor list or
; a Y-scale)
stepAlienShot:
0563: 21 73 20        LXI     H,$2073             
0566: 7E              MOV     A,M                 
0567: E6 80           ANI     $80                 
0569: C2 C1 05        JNZ     $05C1               
056C: 3A C1 20        LDA     $20C1               
056F: FE 04           CPI     $04                 
0571: 3A 69 20        LDA     $2069               
0574: CA B7 05        JZ      $05B7               
0577: A7              ANA     A                   
0578: C8              RZ                          
0579: 23              INX     H                   
057A: 36 00           MVI     M,$00               
057C: 3A 70 20        LDA     $2070               
057F: A7              ANA     A                   
0580: CA 89 05        JZ      $0589               
0583: 47              MOV     B,A                 
0584: 3A CF 20        LDA     $20CF               
0587: B8              CMP     B                   
0588: D0              RNC                         

loc_0589:
0589: 3A 71 20        LDA     $2071               
058C: A7              ANA     A                   
058D: CA 96 05        JZ      $0596               
0590: 47              MOV     B,A                 
0591: 3A CF 20        LDA     $20CF               
0594: B8              CMP     B                   
0595: D0              RNC                         

loc_0596:
0596: 23              INX     H                   
0597: 7E              MOV     A,M                 
0598: A7              ANA     A                   
0599: CA 1B 06        JZ      $061B               
059C: 2A 76 20        LHLD    $2076               
059F: 4E              MOV     C,M                 
05A0: 23              INX     H                   
05A1: 00              NOP                         
05A2: 22 76 20        SHLD    $2076               

loc_05a5:
05A5: CD 2F 06        CALL    $062F               ; {code.findLiveAlienInColumn}
05A8: D0              RNC                         
05A9: CD 7A 01        CALL    $017A               ; {code.alienIndexToScreenCoords}
05AC: 79              MOV     A,C                 
05AD: C6 07           ADI     $07                 
05AF: 67              MOV     H,A                 
05B0: 7D              MOV     A,L                 
05B1: D6 0A           SUI     $0A                 
05B3: 6F              MOV     L,A                 
05B4: 22 7B 20        SHLD    $207B               

loc_05b7:
05B7: 21 73 20        LXI     H,$2073             
05BA: 7E              MOV     A,M                 
05BB: F6 80           ORI     $80                 
05BD: 77              MOV     M,A                 
05BE: 23              INX     H                   
05BF: 34              INR     M                   
05C0: C9              RET                         

loc_05c1:
05C1: 11 7C 20        LXI     D,$207C             
05C4: CD 06 1A        CALL    $1A06               ; {code.objectMatchesDrawPhase}
05C7: D0              RNC                         
05C8: 23              INX     H                   
05C9: 7E              MOV     A,M                 
05CA: E6 01           ANI     $01                 
05CC: C2 44 06        JNZ     $0644               
05CF: 23              INX     H                   
05D0: 34              INR     M                   
05D1: CD 75 06        CALL    $0675               ; {code.eraseAlienShot}
05D4: 3A 79 20        LDA     $2079               
05D7: C6 03           ADI     $03                 
05D9: 21 7F 20        LXI     H,$207F             
05DC: BE              CMP     M                   
05DD: DA E2 05        JC      $05E2               
05E0: D6 0C           SUI     $0C                 

loc_05e2:
05E2: 32 79 20        STA     $2079               
05E5: 3A 7B 20        LDA     $207B               
05E8: 47              MOV     B,A                 
05E9: 3A 7E 20        LDA     $207E               
05EC: 80              ADD     B                   
05ED: 32 7B 20        STA     $207B               
05F0: CD 6C 06        CALL    $066C               ; {code.drawAlienShotWithCollision}
05F3: 3A 7B 20        LDA     $207B               
05F6: FE 15           CPI     $15                 
05F8: DA 12 06        JC      $0612               
05FB: 3A 61 20        LDA     $2061               
05FE: A7              ANA     A                   
05FF: C8              RZ                          
0600: 3A 7B 20        LDA     $207B               
0603: FE 1E           CPI     $1E                 
0605: DA 12 06        JC      $0612               
0608: FE 27           CPI     $27                 
060A: 00              NOP                         
060B: D2 12 06        JNC     $0612               
060E: 97              SUB     A                   
060F: 32 15 20        STA     $2015               

loc_0612:
0612: 3A 73 20        LDA     $2073               
0615: F6 01           ORI     $01                 
0617: 32 73 20        STA     $2073               
061A: C9              RET                         

loc_061b:
061B: 3A 1B 20        LDA     $201B               
061E: C6 08           ADI     $08                 
0620: 67              MOV     H,A                 
0621: CD 6F 15        CALL    $156F               ; {code.scaleYToBlock}
0624: 79              MOV     A,C                 
0625: FE 0C           CPI     $0C                 
0627: DA A5 05        JC      $05A5               
062A: 0E 0B           MVI     C,$0B               
062C: C3 A5 05        JMP     $05A5               

; scan five object slots (stride 0x0b) on ACTIVE_PLAYER_PAGE from low byte
; C-1
findLiveAlienInColumn:
062F: 0D              DCR     C                   
0630: 3A 67 20        LDA     $2067               
0633: 67              MOV     H,A                 
0634: 69              MOV     L,C                 
0635: 16 05           MVI     D,$05               

loc_0637:
0637: 7E              MOV     A,M                 
0638: A7              ANA     A                   
0639: 37              STC                         
063A: C0              RNZ                         
063B: 7D              MOV     A,L                 
063C: C6 0B           ADI     $0B                 
063E: 6F              MOV     L,A                 
063F: 15              DCR     D                   
0640: C2 37 06        JNZ     $0637               
0643: C9              RET                         

; step the alien-shot blowup: decrement ALIEN_SHOT_BLOWUP_TIMER; at 3
; eraseAlienShot then re-seat
; ALIEN_SHOT_SPRITE_PTR=ALIEN_SHOT_BLOWUP_SPRITE and recenter the
; descriptor (ALIEN_SHOT_COORD/$207C -= 2, ALIEN_SHOT_ROW_COUNT=6) and
; drawAlienShotWithCollision (tail); at 0 just eraseAlienShot (tail); else
; idle
stepAlienShotBlowup:
0644: 21 78 20        LXI     H,$2078             
0647: 35              DCR     M                   
0648: 7E              MOV     A,M                 
0649: FE 03           CPI     $03                 
064B: C2 67 06        JNZ     $0667               
064E: CD 75 06        CALL    $0675               ; {code.eraseAlienShot}
0651: 21 DC 1C        LXI     H,$1CDC             
0654: 22 79 20        SHLD    $2079               
0657: 21 7C 20        LXI     H,$207C             
065A: 35              DCR     M                   
065B: 35              DCR     M                   
065C: 2B              DCX     H                   
065D: 35              DCR     M                   
065E: 35              DCR     M                   
065F: 3E 06           MVI     A,$06               
0661: 32 7D 20        STA     $207D               
0664: C3 6C 06        JMP     $066C               

loc_0667:
0667: A7              ANA     A                   
0668: C0              RNZ                         
0669: C3 75 06        JMP     $0675               

; seat HL at the alien-shot descriptor ALIEN_SHOT_SPRITE_PTR,
; loadSpriteDescriptor, then drawSpriteWithCollision
drawAlienShotWithCollision:
066C: 21 79 20        LXI     H,$2079             
066F: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor}
0672: C3 91 14        JMP     $1491               

; seat HL at the alien-shot descriptor ALIEN_SHOT_SPRITE_PTR,
; loadSpriteDescriptor, then eraseShiftedSprite (AND the sprite's bits out
; of the screen)
eraseAlienShot:
0675: 21 79 20        LXI     H,$2079             
0678: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor}
067B: C3 52 14        JMP     $1452               

loc_067e:
067E: 22 48 20        SHLD    $2048               
0681: C9              RET                         

loc_0682:
0682: E1              POP     H                   
0683: 3A 80 20        LDA     $2080               
0686: FE 02           CPI     $02                 
0688: C0              RNZ                         
0689: 21 83 20        LXI     H,$2083             
068C: 7E              MOV     A,M                 
068D: A7              ANA     A                   
068E: CA 0F 05        JZ      $050F               
0691: 3A 56 20        LDA     $2056               
0694: A7              ANA     A                   
0695: C2 0F 05        JNZ     $050F               
0698: 23              INX     H                   
0699: 7E              MOV     A,M                 
069A: A7              ANA     A                   
069B: C2 AB 06        JNZ     $06AB               
069E: 3A 82 20        LDA     $2082               
06A1: FE 08           CPI     $08                 
06A3: DA 0F 05        JC      $050F               
06A6: 36 01           MVI     M,$01               
06A8: CD 3C 07        CALL    $073C               ; {code.drawSaucerSprite}

loc_06ab:
06AB: 11 8A 20        LXI     D,$208A             
06AE: CD 06 1A        CALL    $1A06               ; {code.objectMatchesDrawPhase}
06B1: D0              RNC                         
06B2: 21 85 20        LXI     H,$2085             
06B5: 7E              MOV     A,M                 
06B6: A7              ANA     A                   
06B7: C2 D6 06        JNZ     $06D6               
06BA: 21 8A 20        LXI     H,$208A             
06BD: 7E              MOV     A,M                 
06BE: 23              INX     H                   
06BF: 23              INX     H                   
06C0: 86              ADD     M                   
06C1: 32 8A 20        STA     $208A               
06C4: CD 3C 07        CALL    $073C               ; {code.drawSaucerSprite}
06C7: 21 8A 20        LXI     H,$208A             
06CA: 7E              MOV     A,M                 
06CB: FE 28           CPI     $28                 
06CD: DA F9 06        JC      $06F9               
06D0: FE E1           CPI     $E1                 
06D2: D2 F9 06        JNC     $06F9               
06D5: C9              RET                         

loc_06d6:
06D6: 06 FE           MVI     B,$FE               
06D8: CD DC 19        CALL    $19DC               ; {code.clearSoundPort3Bit}
06DB: 23              INX     H                   
06DC: 35              DCR     M                   
06DD: 7E              MOV     A,M                 
06DE: FE 1F           CPI     $1F                 
06E0: CA 4B 07        JZ      $074B               
06E3: FE 18           CPI     $18                 
06E5: CA 0C 07        JZ      $070C               
06E8: A7              ANA     A                   
06E9: C0              RNZ                         
06EA: 06 EF           MVI     B,$EF               
06EC: 21 98 20        LXI     H,$2098             
06EF: 7E              MOV     A,M                 
06F0: A0              ANA     B                   
06F1: 77              MOV     M,A                 
06F2: E6 20           ANI     $20                 
06F4: D3 05           OUT     $05                 
06F6: 00              NOP                         
06F7: 00              NOP                         
06F8: 00              NOP                         

loc_06f9:
06F9: CD 42 07        CALL    $0742               ; {code.resolveSpriteScreenAddr}
06FC: CD CB 14        CALL    $14CB               ; {code.clearScreenStrip}
06FF: 21 83 20        LXI     H,$2083             
0702: 06 0A           MVI     B,$0A               
0704: CD 5F 07        CALL    $075F               ; {code.copyTemplateToRecord}

; clear the saucer sound bit: SOUND_PORT3_SHADOW &= 0xfe via
; clearSoundPort3Bit, mirror to sound port 3; value-out A
stopSaucerSound:
0707: 06 FE           MVI     B,$FE               
0709: C3 DC 19        JMP     $19DC               

; award the mystery-saucer score: raise SCORE_ADD_PENDING, read the key
; via SAUCER_SCORE_KEY_PTR, match it in SAUCER_SCORE_KEY_TABLE, copy the
; parallel SAUCER_SCORE_SPRITE_TABLE entry into the saucer sprite record
; $2087, store key*16 to SCORE_ADD_VALUE, resolveSpriteScreenAddr then
; drawThreeSprites (tail)
awardSaucerScore:
070C: 3E 01           MVI     A,$01               
070E: 32 F1 20        STA     $20F1               
0711: 2A 8D 20        LHLD    $208D               
0714: 46              MOV     B,M                 
0715: 0E 04           MVI     C,$04               
0717: 21 50 1D        LXI     H,$1D50             
071A: 11 4C 1D        LXI     D,$1D4C             

loc_071d:
071D: 1A              LDAX    D                   
071E: B8              CMP     B                   
071F: CA 28 07        JZ      $0728               
0722: 23              INX     H                   
0723: 13              INX     D                   
0724: 0D              DCR     C                   
0725: C2 1D 07        JNZ     $071D               

loc_0728:
0728: 7E              MOV     A,M                 
0729: 32 87 20        STA     $2087               
072C: 26 00           MVI     H,$00               
072E: 68              MOV     L,B                 
072F: 29              DAD     H                   
0730: 29              DAD     H                   
0731: 29              DAD     H                   
0732: 29              DAD     H                   
0733: 22 F2 20        SHLD    $20F2               
0736: CD 42 07        CALL    $0742               ; {code.resolveSpriteScreenAddr}
0739: C3 F1 08        JMP     $08F1               

; resolve the sprite descriptor at $2087 to its screen address + gfx
; pointer (resolveSpriteScreenAddr), then blit the sprite column into
; video RAM (drawSpriteColumn)
drawSaucerSprite:
073C: CD 42 07        CALL    $0742               ; {code.resolveSpriteScreenAddr}
073F: C3 39 14        JMP     $1439               

; load the sprite descriptor at $2087 then coordToScreenAddr; HL := screen
; address, DE := gfx pointer
resolveSpriteScreenAddr:
0742: 21 87 20        LXI     H,$2087             
0745: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor}
0748: C3 47 1A        JMP     $1A47               

; on saucer destruction: OR the port-5 UFO-hit sound bit and
; latchSoundPort5, repoint the saucer sprite record at SAUCER_HIT_SPRITE,
; then draw it
playSaucerHitSoundAndDrawSprite:
074B: 06 10           MVI     B,$10               
074D: 21 98 20        LXI     H,$2098             
0750: 7E              MOV     A,M                 
0751: B0              ORA     B                   
0752: 77              MOV     M,A                 
0753: CD 70 17        CALL    $1770               ; {code.latchSoundPort5}
0756: 21 7C 1D        LXI     H,$1D7C             
0759: 22 87 20        SHLD    $2087               
075C: C3 3C 07        JMP     $073C               

; blockCopy B bytes from ROM template SAUCER_RECORD_TEMPLATE into the
; caller's object record (HL)
copyTemplateToRecord:
075F: 11 83 1B        LXI     D,$1B83             
0762: C3 32 1A        JMP     $1A32               

loc_0765:
0765: 3E 01           MVI     A,$01               
0767: 32 93 20        STA     $2093               
076A: 31 00 24        LXI     SP,$2400            
076D: FB              EI                          
076E: CD 79 19        CALL    $1979               ; {code.drawCreditReadout}
0771: CD D6 09        CALL    $09D6               ; {code.clearPlayfield}
0774: 21 13 30        LXI     H,$3013             
0777: 11 F3 1F        LXI     D,$1FF3             
077A: 0E 04           MVI     C,$04               
077C: CD F3 08        CALL    $08F3               ; {code.drawSpriteList}

loc_077f:
077F: 3A EB 20        LDA     $20EB               
0782: 3D              DCR     A                   
0783: 21 10 28        LXI     H,$2810             
0786: 0E 14           MVI     C,$14               
0788: C2 57 08        JNZ     $0857               
078B: 11 CF 1A        LXI     D,$1ACF             
078E: CD F3 08        CALL    $08F3               ; {code.drawSpriteList}
0791: DB 01           IN      $01                 
0793: E6 04           ANI     $04                 
0795: CA 7F 07        JZ      $077F               

loc_0798:
0798: 06 99           MVI     B,$99               
079A: AF              XRA     A                   

loc_079b:
079B: 32 CE 20        STA     $20CE               
079E: 3A EB 20        LDA     $20EB               
07A1: 80              ADD     B                   
07A2: 27              DAA                         
07A3: 32 EB 20        STA     $20EB               
07A6: CD 47 19        CALL    $1947               ; {code.drawCreditCount}
07A9: 21 00 00        LXI     H,$0000             
07AC: 22 F8 20        SHLD    $20F8               
07AF: 22 FC 20        SHLD    $20FC               
07B2: CD 25 19        CALL    $1925               ; {code.drawPlayer1Score}
07B5: CD 2B 19        CALL    $192B               ; {code.drawPlayer2Score}
07B8: CD D7 19        CALL    $19D7               ; {code.clearGameActive}
07BB: 21 01 01        LXI     H,$0101             
07BE: 7C              MOV     A,H                 
07BF: 32 EF 20        STA     $20EF               
07C2: 22 E7 20        SHLD    $20E7               
07C5: 22 E5 20        SHLD    $20E5               
07C8: CD 56 19        CALL    $1956               ; {code.redrawScorePanel}
07CB: CD EF 01        CALL    $01EF               ; {code.initPlayer1ShieldBuffers}
07CE: CD F5 01        CALL    $01F5               ; {code.initPlayer2ShieldBuffers}
07D1: CD D1 08        CALL    $08D1               ; {code.readStartingShips}
07D4: 32 FF 21        STA     $21FF               
07D7: 32 FF 22        STA     $22FF               
07DA: CD D7 00        CALL    $00D7               ; {code.loc_00d7}
07DD: AF              XRA     A                   
07DE: 32 FE 21        STA     $21FE               
07E1: 32 FE 22        STA     $22FE               
07E4: CD C0 01        CALL    $01C0               ; {code.markAllAliensAliveP1}
07E7: CD 04 19        CALL    $1904               ; {code.markAllAliensAliveP2}
07EA: 21 78 38        LXI     H,$3878             
07ED: 22 FC 21        SHLD    $21FC               
07F0: 22 FC 22        SHLD    $22FC               
07F3: CD E4 01        CALL    $01E4               ; {code.seedWorkRamImage}
07F6: CD 7F 1A        CALL    $1A7F               ; {code.decrementShipsAndDrawReadout}

loc_07f9:
07F9: CD 8D 08        CALL    $088D               ; {code.loc_088d}
07FC: CD D6 09        CALL    $09D6               ; {code.clearPlayfield}
07FF: 00              NOP                         
0800: AF              XRA     A                   
0801: 32 C1 20        STA     $20C1               

loc_0804:
0804: CD CF 01        CALL    $01CF               ; {code.drawBottomLine}
0807: 3A 67 20        LDA     $2067               
080A: 0F              RRC                         
080B: DA 72 08        JC      $0872               
080E: CD 13 02        CALL    $0213               ; {code.restorePlayer2Shields}
0811: CD CF 01        CALL    $01CF               ; {code.drawBottomLine}

loc_0814:
0814: CD B1 00        CALL    $00B1               ; {code.loadReferenceAlienState}

loc_0817:
0817: CD D1 19        CALL    $19D1               ; {code.setGameActive}
081A: 06 20           MVI     B,$20               
081C: CD FA 18        CALL    $18FA               ; {code.startSound}

loc_081f:
081F: CD 18 16        CALL    $1618               ; {code.advanceRoundState}
0822: CD 0A 19        CALL    $190A               ; {code.resolveShotAndFleetEdge}
0825: CD F3 15        CALL    $15F3               ; {code.countLiveAliens}
0828: CD 88 09        CALL    $0988               ; {code.applyPendingScoreAdd}
082B: 3A 82 20        LDA     $2082               
082E: A7              ANA     A                   
082F: CA EF 09        JZ      $09EF               
0832: CD 0E 17        CALL    $170E               ; {code.selectAlienShotRate}
0835: CD 35 09        CALL    $0935               ; {code.awardExtraShip}
0838: CD D8 08        CALL    $08D8               ; {code.setAlienShotStepWhenFew}
083B: CD 2C 17        CALL    $172C               ; {code.updatePlayerShotSound}
083E: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet}
0841: CA 49 08        JZ      $0849               
0844: 06 04           MVI     B,$04               
0846: CD FA 18        CALL    $18FA               ; {code.startSound}

loc_0849:
0849: CD 75 17        CALL    $1775               ; {code.advanceFleetMarchSound}
084C: D3 06           OUT     $06                 
084E: CD 04 18        CALL    $1804               ; {code.updateSaucerSound}
0851: C3 1F 08        JMP     $081F               

; ---- $0854-$0856: data ----
0854: 00 00 00

loc_0857:
0857: 11 BA 1A        LXI     D,$1ABA             
085A: CD F3 08        CALL    $08F3               ; {code.drawSpriteList}
085D: 06 98           MVI     B,$98               
085F: DB 01           IN      $01                 
0861: 0F              RRC                         
0862: 0F              RRC                         
0863: DA 6D 08        JC      $086D               
0866: 0F              RRC                         
0867: DA 98 07        JC      $0798               
086A: C3 7F 07        JMP     $077F               

loc_086d:
086D: 3E 01           MVI     A,$01               
086F: C3 9B 07        JMP     $079B               

loc_0872:
0872: CD 1A 02        CALL    $021A               ; {code.restorePlayer1Shields}
0875: C3 14 08        JMP     $0814               

; stage the active player's field save: B := [$2008], DE := [$2009] word,
; HL := activeFieldRecordPointer
stageActivePlayerFieldSave:
0878: 3A 08 20        LDA     $2008               
087B: 47              MOV     B,A                 
087C: 2A 09 20        LHLD    $2009               
087F: EB              XCHG                        
0880: C3 86 08        JMP     $0886               

; ---- $0883-$0885: data ----
0883: 00 00 00

; build HL = (ACTIVE_PLAYER_PAGE << 8) | 0xfc
activeFieldRecordPointer:
0886: 3A 67 20        LDA     $2067               
0889: 67              MOV     H,A                 
088A: 2E FC           MVI     L,$FC               
088C: C9              RET                         

loc_088d:
088D: 21 11 2B        LXI     H,$2B11             
0890: 11 70 1B        LXI     D,$1B70             
0893: 0E 0E           MVI     C,$0E               
0895: CD F3 08        CALL    $08F3               ; {code.drawSpriteList}
0898: 3A 67 20        LDA     $2067               
089B: 0F              RRC                         
089C: 3E 1C           MVI     A,$1C               
089E: 21 11 37        LXI     H,$3711             
08A1: D4 FF 08        CNC     $08FF               
08A4: 3E B0           MVI     A,$B0               
08A6: 32 C0 20        STA     $20C0               

loc_08a9:
08A9: 3A C0 20        LDA     $20C0               
08AC: A7              ANA     A                   
08AD: C8              RZ                          
08AE: E6 04           ANI     $04                 
08B0: C2 BC 08        JNZ     $08BC               
08B3: CD CA 09        CALL    $09CA               ; {code.currentPlayerRecordPtr}
08B6: CD 31 19        CALL    $1931               ; {code.drawScoreRecord}
08B9: C3 A9 08        JMP     $08A9               

loc_08bc:
08BC: 06 20           MVI     B,$20               
08BE: 21 1C 27        LXI     H,$271C             
08C1: 3A 67 20        LDA     $2067               
08C4: 0F              RRC                         
08C5: DA CB 08        JC      $08CB               
08C8: 21 1C 39        LXI     H,$391C             

loc_08cb:
08CB: CD CB 14        CALL    $14CB               ; {code.clearScreenStrip}
08CE: C3 A9 08        JMP     $08A9               

; A = (port2 & 3) + 3
readStartingShips:
08D1: DB 02           IN      $02                 
08D3: E6 03           ANI     $03                 
08D5: C6 03           ADI     $03                 
08D7: C9              RET                         

; if ALIEN_COUNT < 9: ALIEN_SHOT_STEP = 0xfb
setAlienShotStepWhenFew:
08D8: 3A 82 20        LDA     $2082               
08DB: FE 09           CPI     $09                 
08DD: D0              RNC                         
08DE: 3E FB           MVI     A,$FB               
08E0: 32 7E 20        STA     $207E               
08E3: C9              RET                         

; return early when TWO_PLAYER_GAME is set, else clearScreenStrip blanks a
; 0x20-column VRAM strip at $391C
blankScreenStrip:
08E4: 3A CE 20        LDA     $20CE               
08E7: A7              ANA     A                   
08E8: C0              RNZ                         
08E9: 21 1C 39        LXI     H,$391C             
08EC: 06 20           MVI     B,$20               
08EE: C3 CB 14        JMP     $14CB               

; seat count C=3, then drawSpriteList blits three consecutive 8x8 sprites
; from (DE)
drawThreeSprites:
08F1: 0E 03           MVI     C,$03               

; draw C consecutive sprite ids from (DE) as a run of 8x8 sprites via
; drawSprite8x8
drawSpriteList:
08F3: 1A              LDAX    D                   
08F4: D5              PUSH    D                   
08F5: CD FF 08        CALL    $08FF               ; {code.drawSprite8x8}
08F8: D1              POP     D                   
08F9: 13              INX     D                   
08FA: 0D              DCR     C                   
08FB: C2 F3 08        JNZ     $08F3               
08FE: C9              RET                         

; resolve sprite id A to its 8-byte source at SPRITE_BITMAP_TABLE+8*A,
; latch A to port 6, blit an 8x8 sprite via drawSpriteColumn
drawSprite8x8:
08FF: 11 00 1E        LXI     D,$1E00             
0902: E5              PUSH    H                   
0903: 26 00           MVI     H,$00               
0905: 6F              MOV     L,A                 
0906: 29              DAD     H                   
0907: 29              DAD     H                   
0908: 29              DAD     H                   
0909: 19              DAD     D                   
090A: EB              XCHG                        
090B: E1              POP     H                   
090C: 06 08           MVI     B,$08               
090E: D3 06           OUT     $06                 
0910: C3 39 14        JMP     $1439               

; gate on $2009<0x78, decrement 16-bit timer SAUCER_TIMER, reload 0x0600 +
; set flag $2083 on wrap
tickSaucerSpawnTimer:
0913: 3A 09 20        LDA     $2009               
0916: FE 78           CPI     $78                 
0918: D0              RNC                         
0919: 2A 91 20        LHLD    $2091               
091C: 7D              MOV     A,L                 
091D: B4              ORA     H                   
091E: C2 29 09        JNZ     $0929               
0921: 21 00 06        LXI     H,$0600             
0924: 3E 01           MVI     A,$01               
0926: 32 83 20        STA     $2083               

loc_0929:
0929: 2B              DCX     H                   
092A: 22 91 20        SHLD    $2091               
092D: C9              RET                         

; read the byte at the top of the active player's page
; ((mem[ACTIVE_PLAYER_PAGE]<<8)|0xff)
readActivePlayerPageTopByte:
092E: CD 11 16        CALL    $1611               ; {code.activePlayerPageBase}
0931: 2E FF           MVI     L,$FF               
0933: 7E              MOV     A,M                 
0934: C9              RET                         

; award the next reserve ship once the active player's tally passes the
; port-2-selected threshold: bump the stored ship count, redraw the
; reserve-ship column (RESERVE_SHIP_SPRITE) and lives digit, clear the
; award flag, seat SFX_OFF_TIMER=0xff, and cue the extra-ship sound (tail
; startSound 0x10)
awardExtraShip:
0935: CD 10 19        CALL    $1910               ; {code.activePlayerFlagPtr}
0938: 2B              DCX     H                   
0939: 2B              DCX     H                   
093A: 7E              MOV     A,M                 
093B: A7              ANA     A                   
093C: C8              RZ                          
093D: 06 15           MVI     B,$15               
093F: DB 02           IN      $02                 
0941: E6 08           ANI     $08                 
0943: CA 48 09        JZ      $0948               
0946: 06 10           MVI     B,$10               

loc_0948:
0948: CD CA 09        CALL    $09CA               ; {code.currentPlayerRecordPtr}
094B: 23              INX     H                   
094C: 7E              MOV     A,M                 
094D: B8              CMP     B                   
094E: D8              RC                          
094F: CD 2E 09        CALL    $092E               ; {code.readActivePlayerPageTopByte}
0952: 34              INR     M                   
0953: 7E              MOV     A,M                 
0954: F5              PUSH    PSW                 
0955: 21 01 25        LXI     H,$2501             

loc_0958:
0958: 24              INR     H                   
0959: 24              INR     H                   
095A: 3D              DCR     A                   
095B: C2 58 09        JNZ     $0958               
095E: 06 10           MVI     B,$10               
0960: 11 60 1C        LXI     D,$1C60             
0963: CD 39 14        CALL    $1439               ; {code.drawSpriteColumn}
0966: F1              POP     PSW                 
0967: 3C              INR     A                   
0968: CD 8B 1A        CALL    $1A8B               ; {code.drawLivesDigit}
096B: CD 10 19        CALL    $1910               ; {code.activePlayerFlagPtr}
096E: 2B              DCX     H                   
096F: 2B              DCX     H                   
0970: 36 00           MVI     M,$00               
0972: 3E FF           MVI     A,$FF               
0974: 32 99 20        STA     $2099               
0977: 06 10           MVI     B,$10               
0979: C3 FA 18        JMP     $18FA               

; HL = INVADER_SCORE_TABLE + clamp-index of A (offset 0 if A<2, 1 if
; 2<=A<4, 2 if A>=4)
invaderScoreEntryPtr:
097C: 21 A0 1D        LXI     H,$1DA0             
097F: FE 02           CPI     $02                 
0981: D8              RC                          
0982: 23              INX     H                   
0983: FE 04           CPI     $04                 
0985: D8              RC                          
0986: 23              INX     H                   
0987: C9              RET                         

; when SCORE_ADD_PENDING is set, clear it and BCD-add the two-byte
; SCORE_ADD_VALUE into the active player's record accumulator (base from
; currentPlayerRecordPtr, 8080 DAA decimal carry), then redraw the total
; as four BCD glyphs at the record's screen address (tail drawBcdWord); a
; clear flag is a no-op
applyPendingScoreAdd:
0988: CD CA 09        CALL    $09CA               ; {code.currentPlayerRecordPtr}
098B: 3A F1 20        LDA     $20F1               
098E: A7              ANA     A                   
098F: C8              RZ                          
0990: AF              XRA     A                   
0991: 32 F1 20        STA     $20F1               
0994: E5              PUSH    H                   
0995: 2A F2 20        LHLD    $20F2               
0998: EB              XCHG                        
0999: E1              POP     H                   
099A: 7E              MOV     A,M                 
099B: 83              ADD     E                   
099C: 27              DAA                         
099D: 77              MOV     M,A                 
099E: 5F              MOV     E,A                 
099F: 23              INX     H                   
09A0: 7E              MOV     A,M                 
09A1: 8A              ADC     D                   
09A2: 27              DAA                         
09A3: 77              MOV     M,A                 
09A4: 57              MOV     D,A                 
09A5: 23              INX     H                   
09A6: 7E              MOV     A,M                 
09A7: 23              INX     H                   
09A8: 66              MOV     H,M                 
09A9: 6F              MOV     L,A                 
09AA: C3 AD 09        JMP     $09AD               

; draw the 16-bit value in DE as four BCD digit glyphs -- high byte D then
; low byte E -- via drawBcdByte
drawBcdWord:
09AD: 7A              MOV     A,D                 
09AE: CD B2 09        CALL    $09B2               ; {code.drawBcdByte}
09B1: 7B              MOV     A,E                 

; draw the byte in A as two digit glyphs, high nibble then low, via
; drawDigit (BCD: each nibble is 0-9)
drawBcdByte:
09B2: D5              PUSH    D                   
09B3: F5              PUSH    PSW                 
09B4: 0F              RRC                         
09B5: 0F              RRC                         
09B6: 0F              RRC                         
09B7: 0F              RRC                         
09B8: E6 0F           ANI     $0F                 
09BA: CD C5 09        CALL    $09C5               ; {code.drawDigit}
09BD: F1              POP     PSW                 
09BE: E6 0F           ANI     $0F                 
09C0: CD C5 09        CALL    $09C5               ; {code.drawDigit}
09C3: D1              POP     D                   
09C4: C9              RET                         

; map a 0-9 value to its glyph id (A += 0x1a) and draw it via
; drawSprite8x8
drawDigit:
09C5: C6 1A           ADI     $1A                 
09C7: C3 FF 08        JMP     $08FF               

; HL = bit0 of ACTIVE_PLAYER_PAGE ? PLAYER1_OBJ_DESC : PLAYER2_OBJ_DESC
; (active player's data pointer)
currentPlayerRecordPtr:
09CA: 3A 67 20        LDA     $2067               
09CD: 0F              RRC                         
09CE: 21 F8 20        LXI     H,$20F8             
09D1: D8              RC                          
09D2: 21 FC 20        LXI     H,$20FC             
09D5: C9              RET                         

; clear the play-field framebuffer
clearPlayfield:
09D6: 21 02 24        LXI     H,$2402             

loc_09d9:
09D9: 36 00           MVI     M,$00               
09DB: 23              INX     H                   
09DC: 7D              MOV     A,L                 
09DD: E6 1F           ANI     $1F                 
09DF: FE 1C           CPI     $1C                 
09E1: DA E8 09        JC      $09E8               
09E4: 11 06 00        LXI     D,$0006             
09E7: 19              DAD     D                   

loc_09e8:
09E8: 7C              MOV     A,H                 
09E9: FE 40           CPI     $40                 
09EB: DA D9 09        JC      $09D9               
09EE: C9              RET                         

loc_09ef:
09EF: CD 3C 0A        CALL    $0A3C               ; {code.loc_0a3c}
09F2: AF              XRA     A                   
09F3: 32 E9 20        STA     $20E9               
09F6: CD D6 09        CALL    $09D6               ; {code.clearPlayfield}
09F9: 3A 67 20        LDA     $2067               
09FC: F5              PUSH    PSW                 
09FD: CD E4 01        CALL    $01E4               ; {code.seedWorkRamImage}
0A00: F1              POP     PSW                 
0A01: 32 67 20        STA     $2067               
0A04: 3A 67 20        LDA     $2067               
0A07: 67              MOV     H,A                 
0A08: E5              PUSH    H                   
0A09: 2E FE           MVI     L,$FE               
0A0B: 7E              MOV     A,M                 
0A0C: E6 07           ANI     $07                 
0A0E: 3C              INR     A                   
0A0F: 77              MOV     M,A                 
0A10: 21 A2 1D        LXI     H,$1DA2             

loc_0a13:
0A13: 23              INX     H                   
0A14: 3D              DCR     A                   
0A15: C2 13 0A        JNZ     $0A13               
0A18: 7E              MOV     A,M                 
0A19: E1              POP     H                   
0A1A: 2E FC           MVI     L,$FC               
0A1C: 77              MOV     M,A                 
0A1D: 23              INX     H                   
0A1E: 36 38           MVI     M,$38               
0A20: 7C              MOV     A,H                 
0A21: 0F              RRC                         
0A22: DA 33 0A        JC      $0A33               
0A25: 3E 21           MVI     A,$21               
0A27: 32 98 20        STA     $2098               
0A2A: CD F5 01        CALL    $01F5               ; {code.initPlayer2ShieldBuffers}
0A2D: CD 04 19        CALL    $1904               ; {code.markAllAliensAliveP2}
0A30: C3 04 08        JMP     $0804               

loc_0a33:
0A33: CD EF 01        CALL    $01EF               ; {code.initPlayer1ShieldBuffers}
0A36: CD C0 01        CALL    $01C0               ; {code.markAllAliensAliveP1}
0A39: C3 04 08        JMP     $0804               

loc_0a3c:
0A3C: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet}
0A3F: C2 52 0A        JNZ     $0A52               
0A42: 3E 30           MVI     A,$30               
0A44: 32 C0 20        STA     $20C0               

loc_0a47:
0A47: 3A C0 20        LDA     $20C0               
0A4A: A7              ANA     A                   
0A4B: C8              RZ                          
0A4C: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet}
0A4F: CA 47 0A        JZ      $0A47               

loc_0a52:
0A52: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet}
0A55: C2 52 0A        JNZ     $0A52               
0A58: C9              RET                         

; poll [$2015] against 0xff and report equality in the Z flag; reads no
; register, writes no memory
isArmTriggerSet:
0A59: 3A 15 20        LDA     $2015               
0A5C: FE FF           CPI     $FF                 
0A5E: C9              RET                         

; if [GAME_IN_PROGRESS]!=0: startSound(0x08), index the 3-entry table via
; invaderScoreEntryPtr(B), stamp SCORE_ADD_VALUE=table byte /
; SCORE_ADD_PENDING=0x01 /
queueInvaderKillScore:
0A5F: 3A EF 20        LDA     $20EF               
0A62: A7              ANA     A                   
0A63: CA 7C 0A        JZ      $0A7C               
0A66: 48              MOV     C,B                 
0A67: 06 08           MVI     B,$08               
0A69: CD FA 18        CALL    $18FA               ; {code.startSound}
0A6C: 41              MOV     B,C                 
0A6D: 78              MOV     A,B                 
0A6E: CD 7C 09        CALL    $097C               ; {code.invaderScoreEntryPtr}
0A71: 7E              MOV     A,M                 
0A72: 21 F3 20        LXI     H,$20F3             
0A75: 36 00           MVI     M,$00               
0A77: 2B              DCX     H                   
0A78: 77              MOV     M,A                 
0A79: 2B              DCX     H                   
0A7A: 36 01           MVI     M,$01               

loc_0a7c:
0A7C: 21 62 20        LXI     H,$2062             
0A7F: C9              RET                         

; arm ISR anim task (TASK_FLAGS 0x20c1=2) and wait until ANIM_DONE_FLAG
; 0x20cb is raised, then clear the task
runAttractAnimTask:
0A80: 3E 02           MVI     A,$02               
0A82: 32 C1 20        STA     $20C1               

loc_0a85:
0A85: D3 06           OUT     $06                 
0A87: 3A CB 20        LDA     $20CB               
0A8A: A7              ANA     A                   
0A8B: CA 85 0A        JZ      $0A85               
0A8E: AF              XRA     A                   
0A8F: 32 C1 20        STA     $20C1               
0A92: C9              RET                         

; type c sprite bytes from de onto hl, pacing 7 vblank frames per byte on
; FRAME_DELAY_TIMER
typePacedSpriteRun:
0A93: D5              PUSH    D                   
0A94: 1A              LDAX    D                   
0A95: CD FF 08        CALL    $08FF               ; {code.drawSprite8x8}
0A98: D1              POP     D                   
0A99: 3E 07           MVI     A,$07               
0A9B: 32 C0 20        STA     $20C0               

loc_0a9e:
0A9E: 3A C0 20        LDA     $20C0               
0AA1: 3D              DCR     A                   
0AA2: C2 9E 0A        JNZ     $0A9E               
0AA5: 13              INX     D                   
0AA6: 0D              DCR     C                   
0AA7: C2 93 0A        JNZ     $0A93               
0AAA: C9              RET                         

loc_0aab:
0AAB: 21 50 20        LXI     H,$2050             
0AAE: C3 4B 02        JMP     $024B               

; 0x40-frame attract delay -> waitFrames
waitShortDelay:
0AB1: 3E 40           MVI     A,$40               
0AB3: C3 D7 0A        JMP     $0AD7               

; 0x80-frame attract delay -> waitFrames
waitLongDelay:
0AB6: 3E 80           MVI     A,$80               
0AB8: C3 D7 0A        JMP     $0AD7               

loc_0abb:
0ABB: E1              POP     H                   
0ABC: C3 72 00        JMP     $0072               

loc_0abf:
0ABF: 3A C1 20        LDA     $20C1               
0AC2: 0F              RRC                         
0AC3: DA BB 0A        JC      $0ABB               
0AC6: 0F              RRC                         
0AC7: DA 68 18        JC      $1868               
0ACA: 0F              RRC                         
0ACB: DA AB 0A        JC      $0AAB               
0ACE: C9              RET                         

; type the 0x0f-byte block to ATTRACT_BODY_SCREEN_ADDR using the caller's
; source de -> typePacedSpriteRun
typeAttractBlock:
0ACF: 21 14 2B        LXI     H,$2B14             
0AD2: 0E 0F           MVI     C,$0F               
0AD4: C3 93 0A        JMP     $0A93               

; vblank busy-wait: seed FRAME_DELAY_TIMER 0x20c0 = a and wait until the
; vblank ISR drains it to 0
waitFrames:
0AD7: 32 C0 20        STA     $20C0               

loc_0ada:
0ADA: 3A C0 20        LDA     $20C0               
0ADD: A7              ANA     A                   
0ADE: C2 DA 0A        JNZ     $0ADA               
0AE1: C9              RET                         

; blockCopy the 12-byte draw/animation sequence from (DE) into
; ANIM_FRAME_COUNTER
loadDrawSequenceBlock:
0AE2: 21 C2 20        LXI     H,$20C2             
0AE5: 06 0C           MVI     B,$0C               
0AE7: C3 32 1A        JMP     $1A32               

; attract round setup + free-run demo loop: silence sound, ei, type the
; attract screens, seed the field, then per-frame advanceRoundState
; (advances ATTRACT_DEMO_PTR 0x20ed) until $2015 leaves 0xff; falls into
; finishAttractCycle
runAttractCycle:
0AEA: AF              XRA     A                   
0AEB: D3 03           OUT     $03                 
0AED: D3 05           OUT     $05                 
0AEF: CD 82 19        CALL    $1982               ; {code.storeTaskFlags}
0AF2: FB              EI                          
0AF3: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay}
0AF6: 3A EC 20        LDA     $20EC               
0AF9: A7              ANA     A                   
0AFA: 21 17 30        LXI     H,$3017             
0AFD: 0E 04           MVI     C,$04               
0AFF: C2 E8 0B        JNZ     $0BE8               
0B02: 11 FA 1C        LXI     D,$1CFA             
0B05: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun}
0B08: 11 AF 1D        LXI     D,$1DAF             

loc_0b0b:
0B0B: CD CF 0A        CALL    $0ACF               ; {code.typeAttractBlock}
0B0E: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay}
0B11: CD 15 18        CALL    $1815               ; {code.drawScoreAdvanceTable}
0B14: CD B6 0A        CALL    $0AB6               ; {code.waitLongDelay}
0B17: 3A EC 20        LDA     $20EC               
0B1A: A7              ANA     A                   
0B1B: C2 4A 0B        JNZ     $0B4A               
0B1E: 11 95 1A        LXI     D,$1A95             
0B21: CD E2 0A        CALL    $0AE2               ; {code.loadDrawSequenceBlock}
0B24: CD 80 0A        CALL    $0A80               ; {code.runAttractAnimTask}
0B27: 11 B0 1B        LXI     D,$1BB0             
0B2A: CD E2 0A        CALL    $0AE2               ; {code.loadDrawSequenceBlock}
0B2D: CD 80 0A        CALL    $0A80               ; {code.runAttractAnimTask}
0B30: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay}
0B33: 11 C9 1F        LXI     D,$1FC9             
0B36: CD E2 0A        CALL    $0AE2               ; {code.loadDrawSequenceBlock}
0B39: CD 80 0A        CALL    $0A80               ; {code.runAttractAnimTask}
0B3C: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay}
0B3F: 21 B7 33        LXI     H,$33B7             
0B42: 06 0A           MVI     B,$0A               
0B44: CD CB 14        CALL    $14CB               ; {code.clearScreenStrip}
0B47: CD B6 0A        CALL    $0AB6               ; {code.waitLongDelay}

loc_0b4a:
0B4A: CD D6 09        CALL    $09D6               ; {code.clearPlayfield}
0B4D: 3A FF 21        LDA     $21FF               
0B50: A7              ANA     A                   
0B51: C2 5D 0B        JNZ     $0B5D               
0B54: CD D1 08        CALL    $08D1               ; {code.readStartingShips}
0B57: 32 FF 21        STA     $21FF               
0B5A: CD 7F 1A        CALL    $1A7F               ; {code.decrementShipsAndDrawReadout}

loc_0b5d:
0B5D: CD E4 01        CALL    $01E4               ; {code.seedWorkRamImage}
0B60: CD C0 01        CALL    $01C0               ; {code.markAllAliensAliveP1}
0B63: CD EF 01        CALL    $01EF               ; {code.initPlayer1ShieldBuffers}
0B66: CD 1A 02        CALL    $021A               ; {code.restorePlayer1Shields}
0B69: 3E 01           MVI     A,$01               
0B6B: 32 C1 20        STA     $20C1               
0B6E: CD CF 01        CALL    $01CF               ; {code.drawBottomLine}

loc_0b71:
0B71: CD 18 16        CALL    $1618               ; {code.advanceRoundState}
0B74: CD F1 0B        CALL    $0BF1               ; {code.updateFleetAndDrawCopyright}
0B77: D3 06           OUT     $06                 
0B79: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet}
0B7C: CA 71 0B        JZ      $0B71               
0B7F: AF              XRA     A                   
0B80: 32 25 20        STA     $2025               

loc_0b83:
0B83: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet}
0B86: C2 83 0B        JNZ     $0B83               

; attract round teardown: credit/high-score panel + typed script + ISR-
; handshaked reveal (runHandshakedAttractAnim), flip SCREEN_MODE_TOGGLE
; 0x20ec, tail-jmp enterAttractCycle
finishAttractCycle:
0B89: AF              XRA     A                   
0B8A: 32 C1 20        STA     $20C1               
0B8D: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay}
0B90: CD 88 19        CALL    $1988               ; {code.loc_1988}
0B93: 0E 0C           MVI     C,$0C               
0B95: 21 11 2C        LXI     H,$2C11             
0B98: 11 90 1F        LXI     D,$1F90             
0B9B: CD F3 08        CALL    $08F3               ; {code.drawSpriteList}
0B9E: 3A EC 20        LDA     $20EC               
0BA1: FE 00           CPI     $00                 
0BA3: C2 AE 0B        JNZ     $0BAE               
0BA6: 21 11 33        LXI     H,$3311             
0BA9: 3E 02           MVI     A,$02               
0BAB: CD FF 08        CALL    $08FF               ; {code.drawSprite8x8}

loc_0bae:
0BAE: 01 9C 1F        LXI     B,$1F9C             
0BB1: CD 56 18        CALL    $1856               ; {code.fetchNextDrawRecord}
0BB4: CD 4C 18        CALL    $184C               ; {code.typeDrawScriptRecord}
0BB7: DB 02           IN      $02                 
0BB9: 07              RLC                         
0BBA: DA C3 0B        JC      $0BC3               
0BBD: 01 A0 1F        LXI     B,$1FA0             
0BC0: CD 3A 18        CALL    $183A               ; {code.typeDrawScript}

loc_0bc3:
0BC3: CD B6 0A        CALL    $0AB6               ; {code.waitLongDelay}
0BC6: 3A EC 20        LDA     $20EC               
0BC9: FE 00           CPI     $00                 
0BCB: C2 DA 0B        JNZ     $0BDA               
0BCE: 11 D5 1F        LXI     D,$1FD5             
0BD1: CD E2 0A        CALL    $0AE2               ; {code.loadDrawSequenceBlock}
0BD4: CD 80 0A        CALL    $0A80               ; {code.runAttractAnimTask}
0BD7: CD 9E 18        CALL    $189E               ; {code.runHandshakedAttractAnim}

loc_0bda:
0BDA: 21 EC 20        LXI     H,$20EC             
0BDD: 7E              MOV     A,M                 
0BDE: 3C              INR     A                   
0BDF: E6 01           ANI     $01                 
0BE1: 77              MOV     M,A                 
0BE2: CD D6 09        CALL    $09D6               ; {code.clearPlayfield}
0BE5: C3 DF 18        JMP     $18DF               

loc_0be8:
0BE8: 11 AB 1D        LXI     D,$1DAB             
0BEB: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun}
0BEE: C3 0B 0B        JMP     $0B0B               

; pre-round redraw trampoline: run resolveShotAndFleetEdge (fleet
; edge/direction update) then tail into drawTaitoCopyright
updateFleetAndDrawCopyright:
0BF1: CD 0A 19        CALL    $190A               ; {code.resolveShotAndFleetEdge}
0BF4: C3 9A 19        JMP     $199A               

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
1401: CD 74 14        CALL    $1474               ; {code.seatBlitPosition}
1404: 00              NOP                         

loc_1405:
1405: C5              PUSH    B                   
1406: E5              PUSH    H                   
1407: 1A              LDAX    D                   
1408: D3 04           OUT     $04                 
140A: DB 03           IN      $03                 
140C: B6              ORA     M                   
140D: 77              MOV     M,A                 
140E: 23              INX     H                   
140F: 13              INX     D                   
1410: AF              XRA     A                   
1411: D3 04           OUT     $04                 
1413: DB 03           IN      $03                 
1415: B6              ORA     M                   
1416: 77              MOV     M,A                 
1417: E1              POP     H                   
1418: 01 20 00        LXI     B,$0020             
141B: 09              DAD     B                   
141C: C1              POP     B                   
141D: 05              DCR     B                   
141E: C2 05 14        JNZ     $1405               
1421: C9              RET                         

; ---- $1422-$1423: data ----
1422: 00 00

; seat the shift offset, then zero the 2-byte-wide x B-row sprite
; footprint at HL
clearSpriteColumn:
1424: CD 74 14        CALL    $1474               ; {code.seatBlitPosition}

loc_1427:
1427: C5              PUSH    B                   
1428: E5              PUSH    H                   
1429: AF              XRA     A                   
142A: 77              MOV     M,A                 
142B: 23              INX     H                   
142C: 77              MOV     M,A                 
142D: 23              INX     H                   
142E: E1              POP     H                   
142F: 01 20 00        LXI     B,$0020             
1432: 09              DAD     B                   
1433: C1              POP     B                   
1434: 05              DCR     B                   
1435: C2 27 14        JNZ     $1427               
1438: C9              RET                         

; copy B bytes into B adjacent screen columns (stride 0x20 right per byte)
drawSpriteColumn:
1439: C5              PUSH    B                   
143A: 1A              LDAX    D                   
143B: 77              MOV     M,A                 
143C: 13              INX     D                   
143D: 01 20 00        LXI     B,$0020             
1440: 09              DAD     B                   
1441: C1              POP     B                   
1442: 05              DCR     B                   
1443: C2 39 14        JNZ     $1439               
1446: C9              RET                         

; ---- $1447-$1451: data ----
1447: 00 00 00 00 00 00 00 00 00 00 00

; erase a hardware-shifted sprite by AND-ing its complemented bits out of
; the screen over B rows
eraseShiftedSprite:
1452: CD 74 14        CALL    $1474               ; {code.seatBlitPosition}

loc_1455:
1455: C5              PUSH    B                   
1456: E5              PUSH    H                   
1457: 1A              LDAX    D                   
1458: D3 04           OUT     $04                 
145A: DB 03           IN      $03                 
145C: 2F              CMA                         
145D: A6              ANA     M                   
145E: 77              MOV     M,A                 
145F: 23              INX     H                   
1460: 13              INX     D                   
1461: AF              XRA     A                   
1462: D3 04           OUT     $04                 
1464: DB 03           IN      $03                 
1466: 2F              CMA                         
1467: A6              ANA     M                   
1468: 77              MOV     M,A                 
1469: E1              POP     H                   
146A: 01 20 00        LXI     B,$0020             
146D: 09              DAD     B                   
146E: C1              POP     B                   
146F: 05              DCR     B                   
1470: C2 55 14        JNZ     $1455               
1473: C9              RET                         

; OUT port 2 := L&7 (MB14241 shift offset), then HL :=
; coordToScreenAddr(HL) -- seat the next blit
seatBlitPosition:
1474: 7D              MOV     A,L                 
1475: E6 07           ANI     $07                 
1477: D3 02           OUT     $02                 
1479: C3 47 1A        JMP     $1A47               

; block-copy a B-column x C-byte screen rectangle into a byte stream
captureScreenRect:
147C: C5              PUSH    B                   
147D: E5              PUSH    H                   

loc_147e:
147E: 7E              MOV     A,M                 
147F: 12              STAX    D                   
1480: 13              INX     D                   
1481: 23              INX     H                   
1482: 0D              DCR     C                   
1483: C2 7E 14        JNZ     $147E               
1486: E1              POP     H                   
1487: 01 20 00        LXI     B,$0020             
148A: 09              DAD     B                   
148B: C1              POP     B                   
148C: 05              DCR     B                   
148D: C2 7C 14        JNZ     $147C               
1490: C9              RET                         

; OR-blit a hardware-shifted sprite while testing overlap, setting
; COLLISION_FLAG on any hit
drawSpriteWithCollision:
1491: CD 74 14        CALL    $1474               ; {code.seatBlitPosition}
1494: AF              XRA     A                   
1495: 32 61 20        STA     $2061               

loc_1498:
1498: C5              PUSH    B                   
1499: E5              PUSH    H                   
149A: 1A              LDAX    D                   
149B: D3 04           OUT     $04                 
149D: DB 03           IN      $03                 
149F: F5              PUSH    PSW                 
14A0: A6              ANA     M                   
14A1: CA A9 14        JZ      $14A9               
14A4: 3E 01           MVI     A,$01               
14A6: 32 61 20        STA     $2061               

loc_14a9:
14A9: F1              POP     PSW                 
14AA: B6              ORA     M                   
14AB: 77              MOV     M,A                 
14AC: 23              INX     H                   
14AD: 13              INX     D                   
14AE: AF              XRA     A                   
14AF: D3 04           OUT     $04                 
14B1: DB 03           IN      $03                 
14B3: F5              PUSH    PSW                 
14B4: A6              ANA     M                   
14B5: CA BD 14        JZ      $14BD               
14B8: 3E 01           MVI     A,$01               
14BA: 32 61 20        STA     $2061               

loc_14bd:
14BD: F1              POP     PSW                 
14BE: B6              ORA     M                   
14BF: 77              MOV     M,A                 
14C0: E1              POP     H                   
14C1: 01 20 00        LXI     B,$0020             
14C4: 09              DAD     B                   
14C5: C1              POP     B                   
14C6: 05              DCR     B                   
14C7: C2 98 14        JNZ     $1498               
14CA: C9              RET                         

; zero A then fillScreenRow(0) -- blank a run of B screen columns from HL
clearScreenStrip:
14CB: AF              XRA     A                   

; fill B columns with A stepping 0x20 right from HL (a horizontal band);
; leave HL one stride past
fillScreenRow:
14CC: C5              PUSH    B                   
14CD: 77              MOV     M,A                 
14CE: 01 20 00        LXI     B,$0020             
14D1: 09              DAD     B                   
14D2: C1              POP     B                   
14D3: 05              DCR     B                   
14D4: C2 CC 14        JNZ     $14CC               
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
14D8: 3A 25 20        LDA     $2025               
14DB: FE 05           CPI     $05                 
14DD: C8              RZ                          
14DE: FE 02           CPI     $02                 
14E0: C0              RNZ                         
14E1: 3A 29 20        LDA     $2029               
14E4: FE D8           CPI     $D8                 
14E6: 47              MOV     B,A                 
14E7: D2 30 15        JNC     $1530               
14EA: 3A 02 20        LDA     $2002               
14ED: A7              ANA     A                   
14EE: C8              RZ                          
14EF: 78              MOV     A,B                 
14F0: FE CE           CPI     $CE                 
14F2: D2 79 15        JNC     $1579               
14F5: C6 06           ADI     $06                 
14F7: 47              MOV     B,A                 
14F8: 3A 09 20        LDA     $2009               
14FB: FE 90           CPI     $90                 
14FD: D2 04 15        JNC     $1504               
1500: B8              CMP     B                   
1501: D2 30 15        JNC     $1530               

loc_1504:
1504: 68              MOV     L,B                 
1505: CD 62 15        CALL    $1562               ; {code.scaleXToBlock}
1508: 3A 2A 20        LDA     $202A               
150B: 67              MOV     H,A                 
150C: CD 6F 15        CALL    $156F               ; {code.scaleYToBlock}
150F: 22 64 20        SHLD    $2064               
1512: 3E 05           MVI     A,$05               
1514: 32 25 20        STA     $2025               
1517: CD 81 15        CALL    $1581               ; {code.alienGridCellPtr}
151A: 7E              MOV     A,M                 
151B: A7              ANA     A                   
151C: CA 30 15        JZ      $1530               
151F: 36 00           MVI     M,$00               
1521: CD 5F 0A        CALL    $0A5F               ; {code.queueInvaderKillScore}
1524: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor}
1527: CD D3 15        CALL    $15D3               ; {code.blitShiftedSprite}
152A: 3E 10           MVI     A,$10               
152C: 32 03 20        STA     $2003               
152F: C9              RET                         

loc_1530:
1530: 3E 03           MVI     A,$03               
1532: 32 25 20        STA     $2025               
1535: C3 4A 15        JMP     $154A               

; decrement the despawn countdown ALIEN_EXPLOSION_TIMER; while nonzero
; return; on expiry reload the sprite address from ALIEN_EXPLOSION_ADDR,
; clearSpriteColumn, then retirePlayerShot
tickAlienExplosionDespawn:
1538: 21 03 20        LXI     H,$2003             
153B: 35              DCR     M                   
153C: C0              RNZ                         
153D: 2A 64 20        LHLD    $2064               
1540: 06 10           MVI     B,$10               
1542: CD 24 14        CALL    $1424               ; {code.clearSpriteColumn}

; set PLAYER_SHOT_STATUS to 4 (retiring), then clearShotHitAndSilence
; (clear PLAYER_SHOT_HIT and silence its sound)
retirePlayerShot:
1545: 3E 04           MVI     A,$04               
1547: 32 25 20        STA     $2025               

; clear PLAYER_SHOT_HIT, then clearSoundPort3Bit(0xf7) masks bit 3 off
; SOUND_PORT3_SHADOW; value-out A
clearShotHitAndSilence:
154A: AF              XRA     A                   
154B: 32 02 20        STA     $2002               
154E: 06 F7           MVI     B,$F7               
1550: C3 DC 19        JMP     $19DC               

; ---- $1553-$1553: data ----
1553: 00

; count in C the 0x10 steps that lift A to/above threshold H (pre-
; normalizing a negative A via normalizeUpBySteps)
countStepsToThreshold:
1554: 0E 00           MVI     C,$00               
1556: BC              CMP     H                   
1557: D4 90 15        CNC     $1590               

loc_155a:
155A: BC              CMP     H                   
155B: D0              RNC                         
155C: C6 10           ADI     $10                 
155E: 0C              INR     C                   
155F: C3 5A 15        JMP     $155A               

; scale the X coordinate to a grid block index in B via
; countStepsToThreshold (threshold $2009), residual in L
scaleXToBlock:
1562: 3A 09 20        LDA     $2009               
1565: 65              MOV     H,L                 
1566: CD 54 15        CALL    $1554               ; {code.countStepsToThreshold}
1569: 41              MOV     B,C                 
156A: 05              DCR     B                   
156B: DE 10           SBI     $10                 
156D: 6F              MOV     L,A                 
156E: C9              RET                         

; scale the Y coordinate to a grid block index in C via
; countStepsToThreshold (threshold $200A), residual in H
scaleYToBlock:
156F: 3A 0A 20        LDA     $200A               
1572: CD 54 15        CALL    $1554               ; {code.countStepsToThreshold}
1575: DE 10           SBI     $10                 
1577: 67              MOV     H,A                 
1578: C9              RET                         

; flag SAUCER_HIT (the saucer enters its explosion/score sequence, read by
; updateSaucerSound + the saucer handler), then retirePlayerShot --
; reached from resolvePlayerShotHit when the shot collides in the saucer
; altitude band
markSaucerHitAndRetireShot:
1579: 3E 01           MVI     A,$01               
157B: 32 85 20        STA     $2085               
157E: C3 45 15        JMP     $1545               

; compute record pointer HL from index B, offset C, and the record-page
; cell
alienGridCellPtr:
1581: 78              MOV     A,B                 
1582: 07              RLC                         
1583: 07              RLC                         
1584: 07              RLC                         
1585: 80              ADD     B                   
1586: 80              ADD     B                   
1587: 80              ADD     B                   
1588: 81              ADD     C                   
1589: 3D              DCR     A                   
158A: 6F              MOV     L,A                 
158B: 3A 67 20        LDA     $2067               
158E: 67              MOV     H,A                 
158F: C9              RET                         

; normalize A up in 0x10 steps until non-negative, counting the steps in C
normalizeUpBySteps:
1590: 0C              INR     C                   
1591: C6 10           ADI     $10                 
1593: FA 90 15        JM      $1590               
1596: C9              RET                         

; fleet edge / direction reversal: scan the edge column selected by
; FLEET_MOVE_DIR (fleetReachedEdge); on a hit flip the direction and
; republish $2008 (step count, via fleetStepSize) and FLEET_STEP_DY
; (mirrored from FLEET_DROP_DELTA), else leave state unchanged; RAM-only
reverseFleetAtEdge:
1597: 3A 0D 20        LDA     $200D               
159A: A7              ANA     A                   
159B: C2 B7 15        JNZ     $15B7               
159E: 21 A4 3E        LXI     H,$3EA4             
15A1: CD C5 15        CALL    $15C5               ; {code.fleetReachedEdge}
15A4: D0              RNC                         
15A5: 06 FE           MVI     B,$FE               
15A7: 3E 01           MVI     A,$01               

loc_15a9:
15A9: 32 0D 20        STA     $200D               
15AC: 78              MOV     A,B                 
15AD: 32 08 20        STA     $2008               
15B0: 3A 0E 20        LDA     $200E               
15B3: 32 07 20        STA     $2007               
15B6: C9              RET                         

loc_15b7:
15B7: 21 24 25        LXI     H,$2524             
15BA: CD C5 15        CALL    $15C5               ; {code.fleetReachedEdge}
15BD: D0              RNC                         
15BE: CD F1 18        CALL    $18F1               ; {code.fleetStepSize}
15C1: AF              XRA     A                   
15C2: C3 A9 15        JMP     $15A9               

; scan 0x17 (23) bytes upward from HL for the first nonzero (fleet edge
; reached); carry
fleetReachedEdge:
15C5: 06 17           MVI     B,$17               

loc_15c7:
15C7: 7E              MOV     A,M                 
15C8: A7              ANA     A                   
15C9: C2 6B 16        JNZ     $166B               
15CC: 23              INX     H                   
15CD: 05              DCR     B                   
15CE: C2 C7 15        JNZ     $15C7               
15D1: C9              RET                         

; ---- $15D2-$15D2: data ----
15D2: 00

; seat the shift offset, then overwrite-blit a hardware-shifted B-row
; sprite into (HL)/(HL+1)
blitShiftedSprite:
15D3: CD 74 14        CALL    $1474               ; {code.seatBlitPosition}
15D6: E5              PUSH    H                   

loc_15d7:
15D7: C5              PUSH    B                   
15D8: E5              PUSH    H                   
15D9: 1A              LDAX    D                   
15DA: D3 04           OUT     $04                 
15DC: DB 03           IN      $03                 
15DE: 77              MOV     M,A                 
15DF: 23              INX     H                   
15E0: 13              INX     D                   
15E1: AF              XRA     A                   
15E2: D3 04           OUT     $04                 
15E4: DB 03           IN      $03                 
15E6: 77              MOV     M,A                 
15E7: E1              POP     H                   
15E8: 01 20 00        LXI     B,$0020             
15EB: 09              DAD     B                   
15EC: C1              POP     B                   
15ED: 05              DCR     B                   
15EE: C2 D7 15        JNZ     $15D7               
15F1: E1              POP     H                   
15F2: C9              RET                         

; count live cells across the active player's 0x37-byte alien field into
; ALIEN_COUNT; set LAST_ALIEN_FLAG at exactly one survivor
countLiveAliens:
15F3: CD 11 16        CALL    $1611               ; {code.activePlayerPageBase}
15F6: 01 00 37        LXI     B,$3700             

loc_15f9:
15F9: 7E              MOV     A,M                 
15FA: A7              ANA     A                   
15FB: CA FF 15        JZ      $15FF               
15FE: 0C              INR     C                   

loc_15ff:
15FF: 23              INX     H                   
1600: 05              DCR     B                   
1601: C2 F9 15        JNZ     $15F9               
1604: 79              MOV     A,C                 
1605: 32 82 20        STA     $2082               
1608: FE 01           CPI     $01                 
160A: C0              RNZ                         
160B: 21 6B 20        LXI     H,$206B             
160E: 36 01           MVI     M,$01               
1610: C9              RET                         

; HL := page byte (mem[ACTIVE_PLAYER_PAGE]) << 8
activePlayerPageBase:
1611: 2E 00           MVI     L,$00               
1613: 3A 67 20        LDA     $2067               
1616: 67              MOV     H,A                 
1617: C9              RET                         

; gated pre-round step: when armed ($2015==0xff) and the field is idle,
; advance ATTRACT_DEMO_PTR (attract) or arm the shot on a fresh fire edge
; (play, GAME_IN_PROGRESS set)
advanceRoundState:
1618: 3A 15 20        LDA     $2015               
161B: FE FF           CPI     $FF                 
161D: C0              RNZ                         
161E: 21 10 20        LXI     H,$2010             
1621: 7E              MOV     A,M                 
1622: 23              INX     H                   
1623: 46              MOV     B,M                 
1624: B0              ORA     B                   
1625: C0              RNZ                         
1626: 3A 25 20        LDA     $2025               
1629: A7              ANA     A                   
162A: C0              RNZ                         
162B: 3A EF 20        LDA     $20EF               
162E: A7              ANA     A                   
162F: CA 52 16        JZ      $1652               
1632: 3A 2D 20        LDA     $202D               
1635: A7              ANA     A                   
1636: C2 48 16        JNZ     $1648               
1639: CD C0 17        CALL    $17C0               ; {code.readActivePlayerInput}
163C: E6 10           ANI     $10                 
163E: C8              RZ                          
163F: 3E 01           MVI     A,$01               
1641: 32 25 20        STA     $2025               
1644: 32 2D 20        STA     $202D               
1647: C9              RET                         

loc_1648:
1648: CD C0 17        CALL    $17C0               ; {code.readActivePlayerInput}
164B: E6 10           ANI     $10                 
164D: C0              RNZ                         
164E: 32 2D 20        STA     $202D               
1651: C9              RET                         

loc_1652:
1652: 21 25 20        LXI     H,$2025             
1655: 36 01           MVI     M,$01               
1657: 2A ED 20        LHLD    $20ED               
165A: 23              INX     H                   
165B: 7D              MOV     A,L                 
165C: FE 7E           CPI     $7E                 
165E: DA 63 16        JC      $1663               
1661: 2E 74           MVI     L,$74               

loc_1663:
1663: 22 ED 20        SHLD    $20ED               
1666: 7E              MOV     A,M                 
1667: 32 1D 20        STA     $201D               
166A: C9              RET                         

loc_166b:
166B: 37              STC                         
166C: C9              RET                         

loc_166d:
166D: AF              XRA     A                   
166E: CD 8B 1A        CALL    $1A8B               ; {code.drawLivesDigit}

loc_1671:
1671: CD 10 19        CALL    $1910               ; {code.activePlayerFlagPtr}
1674: 36 00           MVI     M,$00               
1676: CD CA 09        CALL    $09CA               ; {code.currentPlayerRecordPtr}
1679: 23              INX     H                   
167A: 11 F5 20        LXI     D,$20F5             
167D: 1A              LDAX    D                   
167E: BE              CMP     M                   
167F: 1B              DCX     D                   
1680: 2B              DCX     H                   
1681: 1A              LDAX    D                   
1682: CA 8B 16        JZ      $168B               
1685: D2 98 16        JNC     $1698               
1688: C3 8F 16        JMP     $168F               

loc_168b:
168B: BE              CMP     M                   
168C: D2 98 16        JNC     $1698               

loc_168f:
168F: 7E              MOV     A,M                 
1690: 12              STAX    D                   
1691: 13              INX     D                   
1692: 23              INX     H                   
1693: 7E              MOV     A,M                 
1694: 12              STAX    D                   
1695: CD 50 19        CALL    $1950               ; {code.drawHighScore}

loc_1698:
1698: 3A CE 20        LDA     $20CE               
169B: A7              ANA     A                   
169C: CA C9 16        JZ      $16C9               
169F: 21 03 28        LXI     H,$2803             
16A2: 11 A6 1A        LXI     D,$1AA6             
16A5: 0E 14           MVI     C,$14               
16A7: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun}
16AA: 25              DCR     H                   
16AB: 25              DCR     H                   
16AC: 06 1B           MVI     B,$1B               
16AE: 3A 67 20        LDA     $2067               
16B1: 0F              RRC                         
16B2: DA B7 16        JC      $16B7               
16B5: 06 1C           MVI     B,$1C               

loc_16b7:
16B7: 78              MOV     A,B                 
16B8: CD FF 08        CALL    $08FF               ; {code.drawSprite8x8}
16BB: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay}
16BE: CD E7 18        CALL    $18E7               ; {code.otherPlayerFlagPtr}
16C1: 7E              MOV     A,M                 
16C2: A7              ANA     A                   
16C3: CA C9 16        JZ      $16C9               
16C6: C3 ED 02        JMP     $02ED               

loc_16c9:
16C9: 21 18 2D        LXI     H,$2D18             
16CC: 11 A6 1A        LXI     D,$1AA6             
16CF: 0E 0A           MVI     C,$0A               
16D1: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun}
16D4: CD B6 0A        CALL    $0AB6               ; {code.waitLongDelay}
16D7: CD D6 09        CALL    $09D6               ; {code.clearPlayfield}
16DA: AF              XRA     A                   
16DB: 32 EF 20        STA     $20EF               
16DE: D3 05           OUT     $05                 
16E0: CD D1 19        CALL    $19D1               ; {code.setGameActive}
16E3: C3 89 0B        JMP     $0B89               

loc_16e6:
16E6: 31 00 24        LXI     SP,$2400            
16E9: FB              EI                          
16EA: AF              XRA     A                   
16EB: 32 15 20        STA     $2015               

loc_16ee:
16EE: CD D8 14        CALL    $14D8               ; {code.resolvePlayerShotHit}
16F1: 06 04           MVI     B,$04               
16F3: CD FA 18        CALL    $18FA               ; {code.startSound}
16F6: CD 59 0A        CALL    $0A59               ; {code.isArmTriggerSet}
16F9: C2 EE 16        JNZ     $16EE               
16FC: CD D7 19        CALL    $19D7               ; {code.clearGameActive}
16FF: 21 01 27        LXI     H,$2701             
1702: CD FA 19        CALL    $19FA               ; {code.clearScreenRegion}
1705: AF              XRA     A                   
1706: CD 8B 1A        CALL    $1A8B               ; {code.drawLivesDigit}
1709: 06 FB           MVI     B,$FB               
170B: C3 6B 19        JMP     $196B               

; select the alien-shot rate: scan ALIEN_SHOT_RATE_THRESHOLDS for the
; first entry >= the active player's score key, store the parallel
; ALIEN_SHOT_RATE_TABLE byte to $20CF (read by the shot stepper
; stepAlienShot)
selectAlienShotRate:
170E: CD CA 09        CALL    $09CA               ; {code.currentPlayerRecordPtr}
1711: 23              INX     H                   
1712: 7E              MOV     A,M                 
1713: 11 B8 1C        LXI     D,$1CB8             
1716: 21 A1 1A        LXI     H,$1AA1             
1719: 0E 04           MVI     C,$04               
171B: 47              MOV     B,A                 

loc_171c:
171C: 1A              LDAX    D                   
171D: B8              CMP     B                   
171E: D2 27 17        JNC     $1727               
1721: 23              INX     H                   
1722: 13              INX     D                   
1723: 0D              DCR     C                   
1724: C2 1C 17        JNZ     $171C               

loc_1727:
1727: 7E              MOV     A,M                 
1728: 32 CF 20        STA     $20CF               
172B: C9              RET                         

; mode-gated sound step: PLAYER_SHOT_STATUS!=0 -> startSound(0x02), else
; clearSoundPort3Bit(0xfd)
updatePlayerShotSound:
172C: 3A 25 20        LDA     $2025               
172F: FE 00           CPI     $00                 
1731: C2 39 17        JNZ     $1739               
1734: 06 FD           MVI     B,$FD               
1736: C3 DC 19        JMP     $19DC               

loc_1739:
1739: 06 02           MVI     B,$02               
173B: C3 FA 18        JMP     $18FA               

; ---- $173E-$173F: data ----
173E: 00 00

; fleet-march sound beat: tick FLEET_SOUND_OFF_TIMER/FLEET_SOUND_TIMER, on
; beat emit SOUND_PORT5_SHADOW and re-arm, silencing at the edges; set
; FLEET_SOUND_STEP
stepFleetMarchSound:
1740: 21 9B 20        LXI     H,$209B             
1743: 35              DCR     M                   
1744: CC 6D 17        CZ      $176D               
1747: 3A 68 20        LDA     $2068               
174A: A7              ANA     A                   
174B: CA 6D 17        JZ      $176D               
174E: 21 96 20        LXI     H,$2096             
1751: 35              DCR     M                   
1752: C0              RNZ                         
1753: 21 98 20        LXI     H,$2098             
1756: 7E              MOV     A,M                 
1757: D3 05           OUT     $05                 
1759: 3A 82 20        LDA     $2082               
175C: A7              ANA     A                   
175D: CA 6D 17        JZ      $176D               
1760: 2B              DCX     H                   
1761: 7E              MOV     A,M                 
1762: 2B              DCX     H                   
1763: 77              MOV     M,A                 
1764: 2B              DCX     H                   
1765: 36 01           MVI     M,$01               
1767: 3E 04           MVI     A,$04               
1769: 32 9B 20        STA     $209B               
176C: C9              RET                         

; OUT 5 := mem[SOUND_PORT5_SHADOW] & 0x30 (sound-off helper)
silenceFleetMarchNote:
176D: 3A 98 20        LDA     $2098               

; mask A to the two sound-select bits, OUT sound port 5
latchSoundPort5:
1770: E6 30           ANI     $30                 
1772: D3 05           OUT     $05                 
1774: C9              RET                         

; on FLEET_SOUND_STEP, pick the fleet tempo for ALIEN_COUNT from
; FLEET_RATE_THRESHOLDS/FLEET_RATE_TABLE into FLEET_SOUND_PERIOD and
; rotate the port-5 fleet tone; tick SFX_OFF_TIMER
advanceFleetMarchSound:
1775: 3A 95 20        LDA     $2095               
1778: A7              ANA     A                   
1779: CA AA 17        JZ      $17AA               
177C: 21 11 1A        LXI     H,$1A11             
177F: 11 21 1A        LXI     D,$1A21             
1782: 3A 82 20        LDA     $2082               

loc_1785:
1785: BE              CMP     M                   
1786: D2 8E 17        JNC     $178E               
1789: 23              INX     H                   
178A: 13              INX     D                   
178B: C3 85 17        JMP     $1785               

loc_178e:
178E: 1A              LDAX    D                   
178F: 32 97 20        STA     $2097               
1792: 21 98 20        LXI     H,$2098             
1795: 7E              MOV     A,M                 
1796: E6 30           ANI     $30                 
1798: 47              MOV     B,A                 
1799: 7E              MOV     A,M                 
179A: E6 0F           ANI     $0F                 
179C: 07              RLC                         
179D: FE 10           CPI     $10                 
179F: C2 A4 17        JNZ     $17A4               
17A2: 3E 01           MVI     A,$01               

loc_17a4:
17A4: B0              ORA     B                   
17A5: 77              MOV     M,A                 
17A6: AF              XRA     A                   
17A7: 32 95 20        STA     $2095               

loc_17aa:
17AA: 21 99 20        LXI     H,$2099             
17AD: 35              DCR     M                   
17AE: C0              RNZ                         
17AF: 06 EF           MVI     B,$EF               
17B1: C3 DC 19        JMP     $19DC               

; ---- $17B4-$17BF: data ----
17B4: 06 EF 21 98 20 7E A0 77 D3 05 C9 00

; read the player-selected input port into A
readActivePlayerInput:
17C0: 3A 67 20        LDA     $2067               
17C3: 0F              RRC                         
17C4: D2 CA 17        JNC     $17CA               
17C7: DB 01           IN      $01                 
17C9: C9              RET                         

loc_17ca:
17CA: DB 02           IN      $02                 
17CC: C9              RET                         

loc_17cd:
17CD: DB 02           IN      $02                 
17CF: E6 04           ANI     $04                 
17D1: C8              RZ                          
17D2: 3A 9A 20        LDA     $209A               
17D5: A7              ANA     A                   
17D6: C0              RNZ                         
17D7: 31 00 24        LXI     SP,$2400            
17DA: 06 04           MVI     B,$04               

loc_17dc:
17DC: CD D6 09        CALL    $09D6               ; {code.clearPlayfield}
17DF: 05              DCR     B                   
17E0: C2 DC 17        JNZ     $17DC               
17E3: 3E 01           MVI     A,$01               
17E5: 32 9A 20        STA     $209A               
17E8: CD D7 19        CALL    $19D7               ; {code.clearGameActive}
17EB: FB              EI                          
17EC: 11 BC 1C        LXI     D,$1CBC             
17EF: 21 16 30        LXI     H,$3016             
17F2: 0E 04           MVI     C,$04               
17F4: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun}
17F7: CD B1 0A        CALL    $0AB1               ; {code.waitShortDelay}
17FA: AF              XRA     A                   
17FB: 32 9A 20        STA     $209A               
17FE: 32 93 20        STA     $2093               
1801: C3 C9 16        JMP     $16C9               

; per-frame saucer sound gate: SAUCER_ACTIVE==0 -> stopSaucerSound, else
; drive the UFO tone
updateSaucerSound:
1804: 21 84 20        LXI     H,$2084             
1807: 7E              MOV     A,M                 
1808: A7              ANA     A                   
1809: CA 07 07        JZ      $0707               
180C: 23              INX     H                   
180D: 7E              MOV     A,M                 
180E: A7              ANA     A                   
180F: C0              RNZ                         
1810: 06 01           MVI     B,$01               
1812: C3 FA 18        JMP     $18FA               

; draw the attract score-advance table: header string +
; SCORE_ADVANCE_DRAW_SCRIPT column script (no delay), then tail
; typeSecondDrawScript (typed $1DCF script)
drawScoreAdvanceTable:
1815: 21 10 28        LXI     H,$2810             
1818: 11 A3 1C        LXI     D,$1CA3             
181B: 0E 15           MVI     C,$15               
181D: CD F3 08        CALL    $08F3               ; {code.drawSpriteList}
1820: 3E 0A           MVI     A,$0A               
1822: 32 6C 20        STA     $206C               
1825: 01 BE 1D        LXI     B,$1DBE             

loc_1828:
1828: CD 56 18        CALL    $1856               ; {code.fetchNextDrawRecord}
182B: DA 37 18        JC      $1837               
182E: CD 44 18        CALL    $1844               ; {code.drawSpriteColumn16}
1831: C3 28 18        JMP     $1828               

; ---- $1834-$1836: data ----
1834: CD B1 0A

; point at the $1DCF script and fall into typeDrawScript
typeSecondDrawScript:
1837: 01 CF 1D        LXI     B,$1DCF             

; walk a draw script (fetchNextDrawRecord + typeDrawScriptRecord per
; record) until the 0xff terminator
typeDrawScript:
183A: CD 56 18        CALL    $1856               ; {code.fetchNextDrawRecord}
183D: D8              RC                          
183E: CD 4C 18        CALL    $184C               ; {code.typeDrawScriptRecord}
1841: C3 3A 18        JMP     $183A               

; draw a fixed 16-row sprite column (row count forced to 0x10) via
; drawSpriteColumn, preserving BC
drawSpriteColumn16:
1844: C5              PUSH    B                   
1845: 06 10           MVI     B,$10               
1847: CD 39 14        CALL    $1439               ; {code.drawSpriteColumn}
184A: C1              POP     B                   
184B: C9              RET                         

; type one script record: c = TYPE_PACE_COUNT 0x206c, de/hl from the
; fetched record -> typePacedSpriteRun
typeDrawScriptRecord:
184C: C5              PUSH    B                   
184D: 3A 6C 20        LDA     $206C               
1850: 4F              MOV     C,A                 
1851: CD 93 0A        CALL    $0A93               ; {code.typePacedSpriteRun}
1854: C1              POP     B                   
1855: C9              RET                         

; fetch the next 4-byte draw record addressed by BC (A=(BC), advance BC)
fetchNextDrawRecord:
1856: 0A              LDAX    B                   
1857: FE FF           CPI     $FF                 
1859: 37              STC                         
185A: C8              RZ                          
185B: 6F              MOV     L,A                 
185C: 03              INX     B                   
185D: 0A              LDAX    B                   
185E: 67              MOV     H,A                 
185F: 03              INX     B                   
1860: 0A              LDAX    B                   
1861: 5F              MOV     E,A                 
1862: 03              INX     B                   
1863: 0A              LDAX    B                   
1864: 57              MOV     D,A                 
1865: 03              INX     B                   
1866: A7              ANA     A                   
1867: C9              RET                         

; step one scripted-animation frame: bump the counter ANIM_FRAME_COUNTER,
; advanceRecordTotals over ANIM_COORD_STEP_LO and load the descriptor from
; ANIM_SPRITE_COORD, set ANIM_DONE_FLAG at ANIM_END_COORD, else compute
; ANIM_SPRITE_SRC from ANIM_BASE_SPRITE_SRC and blitShiftedSprite
stepAnimationFrame:
1868: 21 C2 20        LXI     H,$20C2             
186B: 34              INR     M                   
186C: 23              INX     H                   
186D: 4E              MOV     C,M                 
186E: CD D9 01        CALL    $01D9               ; {code.advanceRecordTotals}
1871: 47              MOV     B,A                 
1872: 3A CA 20        LDA     $20CA               
1875: B8              CMP     B                   
1876: CA 98 18        JZ      $1898               
1879: 3A C2 20        LDA     $20C2               
187C: E6 04           ANI     $04                 
187E: 2A CC 20        LHLD    $20CC               
1881: C2 88 18        JNZ     $1888               
1884: 11 30 00        LXI     D,$0030             
1887: 19              DAD     D                   

loc_1888:
1888: 22 C7 20        SHLD    $20C7               
188B: 21 C5 20        LXI     H,$20C5             
188E: CD 3B 1A        CALL    $1A3B               ; {code.loadSpriteDescriptor}
1891: EB              XCHG                        
1892: C3 D3 15        JMP     $15D3               

; ---- $1895-$1897: data ----
1895: 00 00 00

loc_1898:
1898: 3E 01           MVI     A,$01               
189A: 32 CB 20        STA     $20CB               
189D: C9              RET                         

; ISR-handshaked attract animation: arm TASK_FLAGS 0x20c1=4, spin
; ATTRACT_ANIM_ACK 0x2055 bit0 set-then-clear, draw, tail waitLongDelay
; (the ISR anim it arms drives object handler 0x050e)
runHandshakedAttractAnim:
189E: 21 50 20        LXI     H,$2050             
18A1: 11 C0 1B        LXI     D,$1BC0             
18A4: 06 10           MVI     B,$10               
18A6: CD 32 1A        CALL    $1A32               ; {code.blockCopy}
18A9: 3E 02           MVI     A,$02               
18AB: 32 80 20        STA     $2080               
18AE: 3E FF           MVI     A,$FF               
18B0: 32 7E 20        STA     $207E               
18B3: 3E 04           MVI     A,$04               
18B5: 32 C1 20        STA     $20C1               

loc_18b8:
18B8: 3A 55 20        LDA     $2055               
18BB: E6 01           ANI     $01                 
18BD: CA B8 18        JZ      $18B8               

loc_18c0:
18C0: 3A 55 20        LDA     $2055               
18C3: E6 01           ANI     $01                 
18C5: C2 C0 18        JNZ     $18C0               
18C8: 21 11 33        LXI     H,$3311             
18CB: 3E 26           MVI     A,$26               
18CD: 00              NOP                         
18CE: CD FF 08        CALL    $08FF               ; {code.drawSprite8x8}
18D1: C3 B6 0A        JMP     $0AB6               

; boot init: seed work RAM (initWorkRam) and the score panel
; (redrawScorePanel), then enter the attract loop at enterAttractCycle
bootInit:
18D4: 31 00 24        LXI     SP,$2400            
18D7: 06 00           MVI     B,$00               
18D9: CD E6 01        CALL    $01E6               ; {code.initWorkRam}
18DC: CD 56 19        CALL    $1956               ; {code.redrawScorePanel}

; attract-cycle join: set $20CF=8 then continue into runAttractCycle;
; reached from boot init and the finishAttractCycle loop-back
enterAttractCycle:
18DF: 3E 08           MVI     A,$08               
18E1: 32 CF 20        STA     $20CF               
18E4: C3 EA 0A        JMP     $0AEA               

; HL := 0x20e7 + bit0 of (0x2067)
otherPlayerFlagPtr:
18E7: 3A 67 20        LDA     $2067               
18EA: 21 E7 20        LXI     H,$20E7             
18ED: 0F              RRC                         
18EE: D0              RNC                         
18EF: 23              INX     H                   
18F0: C9              RET                         

; B := 2, or 3 when (0x2082) == 1
fleetStepSize:
18F1: 06 02           MVI     B,$02               
18F3: 3A 82 20        LDA     $2082               
18F6: 3D              DCR     A                   
18F7: C0              RNZ                         
18F8: 04              INR     B                   
18F9: C9              RET                         

; (0x2094) |= B, mirror to sound port, A := result
startSound:
18FA: 3A 94 20        LDA     $2094               
18FD: B0              ORA     B                   
18FE: 32 94 20        STA     $2094               
1901: D3 03           OUT     $03                 
1903: C9              RET                         

; seat the player-2 alien-status base ALIEN_FIELD_P2 then
; markAllAliensAlive (0x37-byte 0x01 fill)
markAllAliensAliveP2:
1904: 21 00 22        LXI     H,$2200             
1907: C3 C3 01        JMP     $01C3               

; run the state-2 handler resolvePlayerShotHit, then tail into the fleet
; edge/direction update reverseFleetAtEdge; RAM-only, callers ignore the
; result
resolveShotAndFleetEdge:
190A: CD D8 14        CALL    $14D8               ; {code.resolvePlayerShotHit}
190D: C3 97 15        JMP     $1597               

; HL := $20E7 + (bit0 of ACTIVE_PLAYER_PAGE clear ? 1 : 0)
activePlayerFlagPtr:
1910: 21 E7 20        LXI     H,$20E7             
1913: 3A 67 20        LDA     $2067               
1916: 0F              RRC                         
1917: D8              RC                          
1918: 23              INX     H                   
1919: C9              RET                         

; drawSpriteList the score-header line (SCORE_HEADER_TEXT) to
; SCORE_HEADER_SCREEN_ADDR
drawScoreHeader:
191A: 0E 1C           MVI     C,$1C               
191C: 21 1E 24        LXI     H,$241E             
191F: 11 E4 1A        LXI     D,$1AE4             
1922: C3 F3 08        JMP     $08F3               

; seat the player-1 score record pointer PLAYER1_OBJ_DESC, then
; drawScoreRecord (tail) -- draw the P1 BCD total as four glyphs at the
; record's screen address; RAM-only
drawPlayer1Score:
1925: 21 F8 20        LXI     H,$20F8             
1928: C3 31 19        JMP     $1931               

; seat the player-2 score record pointer PLAYER2_OBJ_DESC, then
; drawScoreRecord (tail) -- draw the P2 BCD total; RAM-only
drawPlayer2Score:
192B: 21 FC 20        LXI     H,$20FC             
192E: C3 31 19        JMP     $1931               

; shared score-record draw: unpack a four-byte record at HL (a BCD value
; word then its two-byte screen address) and draw the value as four BCD
; glyphs there (tail drawBcdWord); reached for P1 (0x20f8), P2 (0x20fc)
; and the high score (0x20f4)
drawScoreRecord:
1931: 5E              MOV     E,M                 
1932: 23              INX     H                   
1933: 56              MOV     D,M                 
1934: 23              INX     H                   
1935: 7E              MOV     A,M                 
1936: 23              INX     H                   
1937: 66              MOV     H,M                 
1938: 6F              MOV     L,A                 
1939: C3 AD 09        JMP     $09AD               

; drawSpriteList the 'CREDIT' label (CREDIT_LABEL_TEXT) to
; CREDIT_LABEL_SCREEN_ADDR
drawCreditLabel:
193C: 0E 07           MVI     C,$07               
193E: 21 01 35        LXI     H,$3501             
1941: 11 A9 1F        LXI     D,$1FA9             
1944: C3 F3 08        JMP     $08F3               

; draw the BCD credit tally CREDIT_COUNT as two decimal glyphs at
; CREDIT_COUNT_SCREEN_ADDR via drawBcdByte
drawCreditCount:
1947: 3A EB 20        LDA     $20EB               
194A: 21 01 3C        LXI     H,$3C01             
194D: C3 B2 09        JMP     $09B2               

; seat the high-score record pointer HIGH_SCORE_OBJ_DESC, then
; drawScoreRecord (tail) -- draw the high-score BCD total; also called by
; $1671 to repaint after a new high; RAM-only
drawHighScore:
1950: 21 F4 20        LXI     H,$20F4             
1953: C3 31 19        JMP     $1931               

; boot/attract score-panel repaint: clearScreen, then redraw the score
; header (drawScoreHeader), player-1/2 scores
; (drawPlayer1Score/drawPlayer2Score), the high score (drawHighScore), the
; CREDIT label (drawCreditLabel), and the credit tally (drawCreditCount);
; RAM-only
redrawScorePanel:
1956: CD 5C 1A        CALL    $1A5C               ; {code.clearScreen}
1959: CD 1A 19        CALL    $191A               ; {code.drawScoreHeader}
195C: CD 25 19        CALL    $1925               ; {code.drawPlayer1Score}
195F: CD 2B 19        CALL    $192B               ; {code.drawPlayer2Score}
1962: CD 50 19        CALL    $1950               ; {code.drawHighScore}
1965: CD 3C 19        CALL    $193C               ; {code.drawCreditLabel}
1968: C3 47 19        JMP     $1947               

loc_196b:
196B: CD DC 19        CALL    $19DC               ; {code.clearSoundPort3Bit}
196E: C3 71 16        JMP     $1671               

loc_1971:
1971: 3E 01           MVI     A,$01               
1973: 32 6D 20        STA     $206D               
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
1982: 32 C1 20        STA     $20C1               
1985: C9              RET                         

; ---- $1986-$1987: data ----
1986: 8B 19

loc_1988:
1988: C3 D6 09        JMP     $09D6               

; ---- $198B-$1999: data ----
198B: 21 03 28 11 BE 19 0E 13 C3 F3 08 00 00 00 00

; behind a two-step port-1 input code (INPUT_CODE_STAGE_FLAG),
; drawSpriteList the Taito copyright (TAITO_COPYRIGHT_TEXT) to
; TAITO_COPYRIGHT_SCREEN_ADDR
drawTaitoCopyright:
199A: 3A 1E 20        LDA     $201E               
199D: A7              ANA     A                   
199E: C2 AC 19        JNZ     $19AC               
19A1: DB 01           IN      $01                 
19A3: E6 76           ANI     $76                 
19A5: D6 72           SUI     $72                 
19A7: C0              RNZ                         
19A8: 3C              INR     A                   
19A9: 32 1E 20        STA     $201E               

loc_19ac:
19AC: DB 01           IN      $01                 
19AE: E6 76           ANI     $76                 
19B0: FE 34           CPI     $34                 
19B2: C0              RNZ                         
19B3: 21 1B 2E        LXI     H,$2E1B             
19B6: 11 F7 0B        LXI     D,$0BF7             
19B9: 0E 09           MVI     C,$09               
19BB: C3 F3 08        JMP     $08F3               

; ---- $19BE-$19D0: data ----
19BE: 28 13 00 08 13 0E 26 02 0E 11 0F 0E 11 00 13 08
19CE: 0E 0D 28

; store 1 -> GAME_ACTIVE (shared tail storeGameActive); mark the game
; active
setGameActive:
19D1: 3E 01           MVI     A,$01               

; store A -> GAME_ACTIVE (shared tail)
storeGameActive:
19D3: 32 E9 20        STA     $20E9               
19D6: C9              RET                         

; store 0 -> GAME_ACTIVE (shared tail storeGameActive); clear the game-
; active flag
clearGameActive:
19D7: AF              XRA     A                   
19D8: C3 D3 19        JMP     $19D3               

; ---- $19DB-$19DB: data ----
19DB: 00

; SOUND_PORT3_SHADOW &= B, mirror to sound port 3, A := result
clearSoundPort3Bit:
19DC: 3A 94 20        LDA     $2094               
19DF: A0              ANA     B                   
19E0: 32 94 20        STA     $2094               
19E3: D3 03           OUT     $03                 
19E5: C9              RET                         

; draw A reserve-ship icons (RESERVE_SHIP_SPRITE) at
; RESERVE_SHIP_ICONS_SCREEN_ADDR, blanking the remainder; skip drawing
; when the count is zero
drawReserveLifeIcons:
19E6: 21 01 27        LXI     H,$2701             
19E9: CA FA 19        JZ      $19FA               

loc_19ec:
19EC: 11 60 1C        LXI     D,$1C60             
19EF: 06 10           MVI     B,$10               
19F1: 4F              MOV     C,A                 
19F2: CD 39 14        CALL    $1439               ; {code.drawSpriteColumn}
19F5: 79              MOV     A,C                 
19F6: 3D              DCR     A                   
19F7: C2 EC 19        JNZ     $19EC               

; repeatedly clearScreenStrip to blank a wider screen region
clearScreenRegion:
19FA: 06 10           MVI     B,$10               
19FC: CD CB 14        CALL    $14CB               ; {code.clearScreenStrip}
19FF: 7C              MOV     A,H                 
1A00: FE 35           CPI     $35                 
1A02: C2 FA 19        JNZ     $19FA               
1A05: C9              RET                         

; raster draw-phase predicate: carry := (mem[DE] & 0x80) ===
; mem[DRAW_PHASE_FLAG] -- true when the object's phase bit (bit7 of its
; byte) matches the current raster half (DRAW_PHASE_FLAG is 0x80 in the
; vblank half, 0x00 in the mid-screen half); the three object dispatchers
; rnc-skip an object that does not belong to this half-frame
objectMatchesDrawPhase:
1A06: 21 72 20        LXI     H,$2072             
1A09: 46              MOV     B,M                 
1A0A: 1A              LDAX    D                   
1A0B: E6 80           ANI     $80                 
1A0D: A8              XRA     B                   
1A0E: C0              RNZ                         
1A0F: 37              STC                         
1A10: C9              RET                         

; ---- $1A11-$1A31: data ----
1A11: 32 2B 24 1C 16 11 0D 0A 08 07 06 05 04 03 02 01
1A21: 34 2E 27 22 1C 18 15 13 10 0E 0D 0C 0B 09 07 05
1A31: FF

; block-copy B bytes (DE)->(HL), both advancing
blockCopy:
1A32: 1A              LDAX    D                   
1A33: 77              MOV     M,A                 
1A34: 23              INX     H                   
1A35: 13              INX     D                   
1A36: 05              DCR     B                   
1A37: C2 32 1A        JNZ     $1A32               
1A3A: C9              RET                         

; read 5-byte descriptor at (HL) -> DE/A/C/B, then HL=C:A
loadSpriteDescriptor:
1A3B: 5E              MOV     E,M                 
1A3C: 23              INX     H                   
1A3D: 56              MOV     D,M                 
1A3E: 23              INX     H                   
1A3F: 7E              MOV     A,M                 
1A40: 23              INX     H                   
1A41: 4E              MOV     C,M                 
1A42: 23              INX     H                   
1A43: 46              MOV     B,M                 
1A44: 61              MOV     H,C                 
1A45: 6F              MOV     L,A                 
1A46: C9              RET                         

; HL := (HL >> 3) with H forced into the 0x2000-0x3fff video-RAM page
coordToScreenAddr:
1A47: C5              PUSH    B                   
1A48: 06 03           MVI     B,$03               

loc_1a4a:
1A4A: 7C              MOV     A,H                 
1A4B: 1F              RAR                         
1A4C: 67              MOV     H,A                 
1A4D: 7D              MOV     A,L                 
1A4E: 1F              RAR                         
1A4F: 6F              MOV     L,A                 
1A50: 05              DCR     B                   
1A51: C2 4A 1A        JNZ     $1A4A               
1A54: 7C              MOV     A,H                 
1A55: E6 3F           ANI     $3F                 
1A57: F6 20           ORI     $20                 
1A59: 67              MOV     H,A                 
1A5A: C1              POP     B                   
1A5B: C9              RET                         

; zero video RAM 0x2400..0x3fff
clearScreen:
1A5C: 21 00 24        LXI     H,$2400             

loc_1a5f:
1A5F: 36 00           MVI     M,$00               
1A61: 23              INX     H                   
1A62: 7C              MOV     A,H                 
1A63: FE 40           CPI     $40                 
1A65: C2 5F 1A        JNZ     $1A5F               
1A68: C9              RET                         

; OR-merge C source bytes down each of B columns (columns 0x20 apart);
; advance HL and DE
orBlitBitmap:
1A69: C5              PUSH    B                   
1A6A: E5              PUSH    H                   

loc_1a6b:
1A6B: 1A              LDAX    D                   
1A6C: B6              ORA     M                   
1A6D: 77              MOV     M,A                 
1A6E: 13              INX     D                   
1A6F: 23              INX     H                   
1A70: 0D              DCR     C                   
1A71: C2 6B 1A        JNZ     $1A6B               
1A74: E1              POP     H                   
1A75: 01 20 00        LXI     B,$0020             
1A78: 09              DAD     B                   
1A79: C1              POP     B                   
1A7A: 05              DCR     B                   
1A7B: C2 69 1A        JNZ     $1A69               
1A7E: C9              RET                         

; reserve-ships readout: readActivePlayerPageTopByte gives the count at
; the active page top; if zero bail; else store count-1 back (a ship
; enters play), drawReserveLifeIcons(count-1) the reserve row, then
; drawLivesDigit(count)
decrementShipsAndDrawReadout:
1A7F: CD 2E 09        CALL    $092E               ; {code.readActivePlayerPageTopByte}
1A82: A7              ANA     A                   
1A83: C8              RZ                          
1A84: F5              PUSH    PSW                 
1A85: 3D              DCR     A                   
1A86: 77              MOV     M,A                 
1A87: CD E6 19        CALL    $19E6               ; {code.drawReserveLifeIcons}
1A8A: F1              POP     PSW                 

; draw the low nibble of A as a digit glyph at LIVES_DIGIT_SCREEN_ADDR via
; drawDigit
drawLivesDigit:
1A8B: 21 01 25        LXI     H,$2501             
1A8E: E6 0F           ANI     $0F                 
1A90: C3 C5 09        JMP     $09C5               

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
