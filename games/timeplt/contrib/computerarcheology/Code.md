![Time Pilot](timeplt.jpg)

# Time Pilot

>>> cpu Z80

>>> binary 0000:roms/tm1 + roms/tm2 + roms/tm3

>>> memoryTable hard

[Hardware Info](Hardware.md)

>>> memoryTable ram

[RAM Usage](RAMUse.md)

```code
; Time Pilot (Konami, 1982). A free-roaming aerial shooter: your fighter holds
; the centre of the screen and turns to face the way you steer, while the
; whole world scrolls and banks around it, and you gun down swarms of enemy
; craft and the boss mother-ship that anchors each wave. Clearing a wave
; carries you forward through five eras of flight, each faster and more
; crowded than the last; parachutists drifting down are worth extra points if
; you collect them. Run out of fighters to end the game.
;
; Architecture: on reset ($0000) the CPU jumps to
; seatTheStackAndSettleTheControlLatch ($07B1). What follows is a
; reachability-driven disassembly (66.05% of the ROM reached from the traced
; entry points): reachable code is shown as instructions, and spans never
; reached are shown as data (the "---- data ----" blocks).


loc_0000:
0000: C3 B1 07        JP      $07B1               ; {code.seatTheStackAndSettleTheControlLatch}

; ---- $0003-$0007: data ----
0003: FF FF FF 33 4B

; step a table pointer on by an index and return the byte it lands on,
; leaving the pointer at that entry
fetchTableByte:
0008: 85              ADD     A,L                 
0009: 6F              LD      L,A                 
000A: 30 01           JR      NC,$000D            ; {code.loc_000d}
000C: 24              INC     H                   

loc_000d:
000D: 7E              LD      A,(HL)              
000E: C9              RET                         

; ---- $000F-$000F: data ----
000F: 4F

; fetch the two-byte entry an index selects from a word table and hand
; back both the word and the address past it
fetchTableWord:
0010: 87              ADD     A,A                 
0011: DF              RST     $18                 
0012: 5E              LD      E,(HL)              
0013: 23              INC     HL                  
0014: 56              LD      D,(HL)              
0015: 23              INC     HL                  
0016: C9              RET                         

; ---- $0017-$0017: data ----
0017: 4E

; move a 16-bit address forward by an unsigned byte offset, echoing the
; low half of the result back
offsetAddress:
0018: 85              ADD     A,L                 
0019: 6F              LD      L,A                 
001A: D0              RET     NC                  
001B: 24              INC     H                   
001C: C9              RET                         

; ---- $001D-$001F: data ----
001D: FF FF 41

; step the character-cell cursor on to the next cell of the line being
; drawn
advanceCharCursor:
0020: 7B              LD      A,E                 
0021: D6 20           SUB     $20                 
0023: 5F              LD      E,A                 
0024: D0              RET     NC                  
0025: 15              DEC     D                   
0026: C9              RET                         

; ---- $0027-$0027: data ----
0027: 4D

; step the character-cell cursor one cell back along the line being drawn,
; the inverse of the advance vector
retreatCharCursor:
0028: 7B              LD      A,E                 
0029: C6 20           ADD     A,$20               
002B: 5F              LD      E,A                 
002C: D0              RET     NC                  
002D: 14              INC     D                   
002E: C9              RET                         

; ---- $002F-$002F: data ----
002F: 49

loc_0030:
0030: E1              POP     HL                  
0031: D7              RST     $10                 
0032: EB              EX      DE,HL               
0033: E9              JP      (HL)                

; ---- $0034-$0037: data ----
0034: FF FF FF FF

; queue a command byte and its argument in the command ring, dropping the
; pair when the cursor's cell is still occupied
postCommand:
0038: E5              PUSH    HL                  
0039: 26 AC           LD      H,$AC               
003B: 3A B2 A9        LD      A,($A9B2)           ; {hard.workRam+1B2}
003E: 6F              LD      L,A                 
003F: CB 7E           BIT     7,(HL)              
0041: 28 0A           JR      Z,$004D             ; {code.loc_004d}
0043: 72              LD      (HL),D              
0044: 2C              INC     L                   
0045: 73              LD      (HL),E              
0046: 2C              INC     L                   
0047: 7D              LD      A,L                 
0048: E6 3F           AND     $3F                 
004A: 32 B2 A9        LD      ($A9B2),A           ; {hard.workRam+1B2}

loc_004d:
004D: E1              POP     HL                  
004E: C9              RET                         

; ---- $004F-$0065: data ----
004F: 0F A7 11 ED 77 68 D7 34 F1 D7 A5 3B 7C FD 3B 7D
005F: F1 DC A5 8C 57 34 B9

; the per-frame (vblank) interrupt vector: hardware dispatches it once per
; interrupt and it transfers straight to the frame-service handler at
; 0x00d8, writing nothing of its own
enterVblankInterrupt:
0066: C3 D8 00        JP      $00D8               ; {code.loc_00d8}

; cold-start clear reached once at boot via 0x07B1: kicks the watchdog
; four times, zeroes the 0xB410 sprite-bank run and the whole 2 KB work
; RAM, sums the fixed 256-byte program run at 0x00D8 and runs the frame
; service out of band on a non-genuine total, then hands off to the
; screen-RAM clear and image verify
clearWorkRamAndSpriteBanksThenColdInit:
0069: 32 00 C2        LD      ($C200),A           
006C: 21 11 B4        LD      HL,$B411            
006F: 06 30           LD      B,$30               

loc_0071:
0071: 36 00           LD      (HL),$00            
0073: 23              INC     HL                  
0074: 10 FB           DJNZ    $0071               ; {code.loc_0071}
0076: 32 00 C2        LD      ($C200),A           
0079: 21 10 B4        LD      HL,$B410            
007C: 06 30           LD      B,$30               

loc_007e:
007E: 36 00           LD      (HL),$00            
0080: 23              INC     HL                  
0081: 10 FB           DJNZ    $007E               ; {code.loc_007e}
0083: 32 00 C2        LD      ($C200),A           
0086: 21 00 A8        LD      HL,$A800            
0089: 11 01 A8        LD      DE,$A801            
008C: 01 FF 07        LD      BC,$07FF            
008F: 36 00           LD      (HL),$00            
0091: ED B0           LDIR                        
0093: 32 00 C2        LD      ($C200),A           
0096: 06 00           LD      B,$00               
0098: 21 D8 00        LD      HL,$00D8            
009B: AF              XOR     A                   

loc_009c:
009C: 86              ADD     A,(HL)              
009D: 23              INC     HL                  
009E: 10 FC           DJNZ    $009C               ; {code.loc_009c}
00A0: D6 87           SUB     $87                 
00A2: C4 D8 00        CALL    NZ,$00D8            ; {code.loc_00d8}
00A5: C3 66 58        JP      $5866               ; {code.clearScreenRamAndVerifyImageThenColdInit}

; bring the machine up and never come back: set the interrupt-enable bit
; of the output latch from the low bit of the byte the caller carries, pet
; the watchdog, and fall into the foreground loop -- neither store reaches
; work RAM, and there is no return path
enableInterruptAndEnterForegroundLoop:
00A8: 32 00 C3        LD      ($C300),A           
00AB: 32 00 C2        LD      ($C200),A           
00AE: C3 93 0B        JP      $0B93               ; {code.runCommandRingDrainLoop}

; tile the character plane with a lattice of boxes -- fourteen bands of
; sixteen, each box two cells wide and two lines deep, every one of them
; laid down by stampGridBox -- walking a cursor that starts a full line
; above the first band it writes and skips a line before each band, so the
; lattice keeps clear of the top of the plane and its bands come out
; contiguous; every position is counted out here and nothing is read to
; decide where a box goes
tileCharPlaneWithBoxLattice:
00B1: 21 20 A4        LD      HL,$A420            
00B4: 0E 0E           LD      C,$0E               

loc_00b6:
00B6: 11 20 00        LD      DE,$0020            
00B9: 19              ADD     HL,DE               
00BA: 06 10           LD      B,$10               

loc_00bc:
00BC: CD C7 00        CALL    $00C7               ; {code.stampGridBox}
00BF: 23              INC     HL                  
00C0: 23              INC     HL                  
00C1: 10 F9           DJNZ    $00BC               ; {code.loc_00bc}
00C3: 0D              DEC     C                   
00C4: 20 F0           JR      NZ,$00B6            ; {code.loc_00b6}
00C6: C9              RET                         

; lay the four corner tiles of one hollow sixteen-by-sixteen box into the
; character plane at the cursor -- two cells across and two rows down --
; and give the cursor back unmoved
stampGridBox:
00C7: E5              PUSH    HL                  
00C8: 36 56           LD      (HL),$56            
00CA: 23              INC     HL                  
00CB: 36 83           LD      (HL),$83            
00CD: 11 1F 00        LD      DE,$001F            
00D0: 19              ADD     HL,DE               
00D1: 36 C7           LD      (HL),$C7            
00D3: 23              INC     HL                  
00D4: 36 EF           LD      (HL),$EF            
00D6: E1              POP     HL                  
00D7: C9              RET                         

loc_00d8:
00D8: F5              PUSH    AF                  

loc_00d9:
00D9: C5              PUSH    BC                  
00DA: D5              PUSH    DE                  
00DB: E5              PUSH    HL                  
00DC: 08              EX      AF,AF'              
00DD: D9              EXX                         
00DE: F5              PUSH    AF                  
00DF: C5              PUSH    BC                  
00E0: D5              PUSH    DE                  
00E1: E5              PUSH    HL                  
00E2: DD E5           PUSH    IX                  
00E4: FD E5           PUSH    IY                  
00E6: CD 65 03        CALL    $0365               ; {code.publishSpriteShadow}
00E9: CD 86 52        CALL    $5286               ; {code.drainBothDeferredCellLists}
00EC: AF              XOR     A                   
00ED: 32 00 C3        LD      ($C300),A           
00F0: 32 00 C2        LD      ($C200),A           
00F3: 3C              INC     A                   
00F4: 32 87 A9        LD      ($A987),A           ; {hard.workRam+187}
00F7: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
00FA: A7              AND     A                   
00FB: 28 09           JR      Z,$0106             ; {code.loc_0106}
00FD: 3A C2 A9        LD      A,($A9C2)           ; {hard.workRam+1C2}
0100: A7              AND     A                   
0101: 20 03           JR      NZ,$0106            ; {code.loc_0106}
0103: 32 87 A9        LD      ($A987),A           ; {hard.workRam+187}

loc_0106:
0106: 3A 87 A9        LD      A,($A987)           ; {hard.workRam+187}
0109: 32 02 C3        LD      ($C302),A           
010C: 3A 00 C2        LD      A,($C200)           
010F: 2F              CPL                         
0110: 32 AD A9        LD      ($A9AD),A           ; {hard.workRam+1AD}
0113: 3A 00 C3        LD      A,($C300)           
0116: 2F              CPL                         
0117: 32 AE A9        LD      ($A9AE),A           ; {hard.workRam+1AE}
011A: 3A 20 C3        LD      A,($C320)           
011D: 2F              CPL                         
011E: 32 AF A9        LD      ($A9AF),A           ; {hard.workRam+1AF}
0121: 3A 40 C3        LD      A,($C340)           
0124: 2F              CPL                         
0125: 32 B0 A9        LD      ($A9B0),A           ; {hard.workRam+1B0}
0128: 3A 60 C3        LD      A,($C360)           
012B: 2F              CPL                         
012C: 32 B1 A9        LD      ($A9B1),A           ; {hard.workRam+1B1}
012F: 21 80 A9        LD      HL,$A980            
0132: 34              INC     (HL)                
0133: 21 CE A9        LD      HL,$A9CE            
0136: 7E              LD      A,(HL)              
0137: 3C              INC     A                   
0138: 27              DAA                         
0139: 77              LD      (HL),A              
013A: 21 17 A8        LD      HL,$A817            
013D: 7E              LD      A,(HL)              
013E: A7              AND     A                   
013F: 28 01           JR      Z,$0142             ; {code.loc_0142}
0141: 35              DEC     (HL)                

loc_0142:
0142: 21 12 A8        LD      HL,$A812            
0145: 7E              LD      A,(HL)              
0146: A7              AND     A                   
0147: 28 01           JR      Z,$014A             ; {code.loc_014a}
0149: 35              DEC     (HL)                

loc_014a:
014A: 21 F4 A8        LD      HL,$A8F4            
014D: 7E              LD      A,(HL)              
014E: A7              AND     A                   
014F: 28 01           JR      Z,$0152             ; {code.loc_0152}
0151: 35              DEC     (HL)                

loc_0152:
0152: CD BE 48        CALL    $48BE               ; {code.serviceCoinInputs}
0155: 21 74 01        LD      HL,$0174            
0158: E5              PUSH    HL                  
0159: 3A AB A9        LD      A,($A9AB)           ; {hard.workRam+1AB}
015C: E6 03           AND     $03                 
015E: F7              RST     $30                 

; ---- $015F-$0166: jump table ----
015F: C2 15 51 16 FE 17 1F 0F

loc_0167:
0167: 6F              LD      L,A                 
0168: A6              AND     (HL)                
0169: 14              INC     D                   
016A: 88              ADC     A,B                 
016B: 57              LD      D,A                 
016C: A5              AND     L                   
016D: BF              CP      A                   
016E: 34              INC     (HL)                
016F: D7              RST     $10                 
0170: F1              POP     AF                  
0171: 96              SUB     (HL)                
0172: F1              POP     AF                  
0173: B9              CP      C                   

loc_0174:
0174: CD D4 55        CALL    $55D4               ; {code.sendOldestQueuedSoundCommand}
0177: FD E1           POP     IY                  
0179: DD E1           POP     IX                  
017B: E1              POP     HL                  
017C: D1              POP     DE                  
017D: C1              POP     BC                  
017E: F1              POP     AF                  
017F: D9              EXX                         
0180: 08              EX      AF,AF'              
0181: E1              POP     HL                  
0182: D1              POP     DE                  
0183: C1              POP     BC                  
0184: 3A 00 16        LD      A,($1600)           ; {hard.rom+1600}
0187: 32 00 C3        LD      ($C300),A           
018A: F1              POP     AF                  
018B: C9              RET                         

; fetch the word an index selects from a word table, with the index
; doubling carrying into the high byte so the table may run past the reach
; of its narrow sibling
fetchWideTableWord:
018C: 87              ADD     A,A                 
018D: 30 01           JR      NC,$0190            ; {code.loc_0190}
018F: 24              INC     H                   

loc_0190:
0190: 85              ADD     A,L                 
0191: 6F              LD      L,A                 
0192: 30 01           JR      NC,$0195            ; {code.loc_0195}
0194: 24              INC     H                   

loc_0195:
0195: 5E              LD      E,(HL)              
0196: 23              INC     HL                  
0197: 56              LD      D,(HL)              
0198: 23              INC     HL                  
0199: C9              RET                         

; seat the character-plane wipe on the plane's very first cell and put a
; whole plane's worth of lines against the counter beside it, so the next
; pass starts at the top with everything still to do; then fold a fixed
; 240-byte run of the program image into one eight-bit total and, on
; anything but the total a genuine image gives, transfer into bytes that
; carry no routine. ★ The wipe is armed EITHER WAY -- the fold gates
; nothing above it, and the run it folds lies elsewhere in the image and
; has nothing to do with the wipe -- so a reader who takes this for a
; guarded arm will be wrong on every dispatch
armWholePlaneWipeThenDerailOnATamperedImage:
019A: 21 00 A4        LD      HL,$A400            
019D: 22 89 A9        LD      ($A989),HL          ; {hard.workRam+189}
01A0: 3E 20           LD      A,$20               
01A2: 32 88 A9        LD      ($A988),A           ; {hard.workRam+188}
01A5: 06 F0           LD      B,$F0               
01A7: 21 A5 4B        LD      HL,$4BA5            
01AA: AF              XOR     A                   

loc_01ab:
01AB: 86              ADD     A,(HL)              
01AC: 23              INC     HL                  
01AD: 10 FC           DJNZ    $01AB               ; {code.loc_01ab}
01AF: D6 11           SUB     $11                 
01B1: C4 67 01        CALL    NZ,$0167            ; {code.loc_0167}
01B4: C9              RET                         

; arm the character-plane wipe to start at the plane's fifth cell and to
; run for a count taken from a fixed cell of the program image rather than
; carried as an immediate; neither armed cell is read here, and nothing a
; caller held survives into either
armLineWipeFromFifthLine:
01B5: 21 04 A4        LD      HL,$A404            
01B8: 22 89 A9        LD      ($A989),HL          ; {hard.workRam+189}
01BB: 3A CD 0C        LD      A,($0CCD)           ; {hard.rom+CCD}
01BE: 32 88 A9        LD      ($A988),A           ; {hard.workRam+188}
01C1: C9              RET                         

; blank one line of the character plane in both planes, step the wipe's
; cursor on to the next line, and count the lines still owed down by one;
; the zero test is left in the flags for the caller
blankNextLine:
01C2: 2A 89 A9        LD      HL,($A989)          ; {hard.workRam+189}
01C5: 06 20           LD      B,$20               
01C7: 11 20 00        LD      DE,$0020            

loc_01ca:
01CA: 36 F1           LD      (HL),$F1            
01CC: CB 94           RES     2,H                 
01CE: 36 10           LD      (HL),$10            
01D0: CB D4           SET     2,H                 
01D2: 19              ADD     HL,DE               
01D3: 10 F5           DJNZ    $01CA               ; {code.loc_01ca}
01D5: 2A 89 A9        LD      HL,($A989)          ; {hard.workRam+189}
01D8: 23              INC     HL                  
01D9: 22 89 A9        LD      ($A989),HL          ; {hard.workRam+189}
01DC: 21 88 A9        LD      HL,$A988            
01DF: 35              DEC     (HL)                
01E0: C9              RET                         

; put the cell-stamping pen back at the start of its route -- leg index to
; zero and both coordinates to the route's first point, each written a
; word at a time so the whole-cell part and the fraction below it land
; together, and each lifted out of a fixed pair of program bytes rather
; than carried as a literal -- then fold a fixed 256-byte run of the image
; into one eight-bit total and, on anything but the total a genuine image
; gives, transfer into the cold start, which clears the work RAM the stack
; sits on and never comes back here. The arming is unconditional: the fold
; gates nothing above it
armThePenRouteThenColdStartOnATamperedImage:
01E1: AF              XOR     A                   
01E2: 32 E2 A9        LD      ($A9E2),A           ; {hard.workRam+1E2}
01E5: 2A 45 0D        LD      HL,($0D45)          ; {hard.rom+D45}
01E8: 22 E3 A9        LD      ($A9E3),HL          ; {hard.workRam+1E3}
01EB: 2A 0C 28        LD      HL,($280C)          ; {hard.rom+280C}
01EE: 22 E5 A9        LD      ($A9E5),HL          ; {hard.workRam+1E5}
01F1: 06 00           LD      B,$00               
01F3: 21 33 0E        LD      HL,$0E33            
01F6: AF              XOR     A                   

loc_01f7:
01F7: 86              ADD     A,(HL)              
01F8: 23              INC     HL                  
01F9: 10 FC           DJNZ    $01F7               ; {code.loc_01f7}
01FB: D6 FD           SUB     $FD                 
01FD: C4 69 00        CALL    NZ,$0069            ; {code.clearWorkRamAndSpriteBanksThenColdInit}
0200: C9              RET                         

; draw one interpolated run of pen-glyph cells from the current row/column
; toward a target pair (signed per-step increment (target-current)>>4),
; stamping each cell until the stamped video cell hits the run's end cell,
; then advance the run index, load the next run's endpoint from the word
; table at 0x0290, reseat the pen, and leave Z set when the new row
; integer is 0 (callers ret nz on it)
drawInterpolatedPenRun:
0201: CD 6F 02        CALL    $026F               ; {code.plotPenCell}
0204: 2A F5 32        LD      HL,($32F5)          ; {hard.rom+32F5}
0207: ED 4B E3 A9     LD      BC,($A9E3)          ; {hard.workRam+1E3}
020B: A7              AND     A                   
020C: ED 42           SBC     HL,BC               
020E: 29              ADD     HL,HL               
020F: 29              ADD     HL,HL               
0210: 29              ADD     HL,HL               
0211: 29              ADD     HL,HL               
0212: 3E 00           LD      A,$00               
0214: DE 00           SBC     A,$00               
0216: 6C              LD      L,H                 
0217: 67              LD      H,A                 
0218: 22 E7 A9        LD      ($A9E7),HL          ; {hard.workRam+1E7}
021B: 2A 45 0B        LD      HL,($0B45)          ; {hard.rom+B45}
021E: ED 4B E5 A9     LD      BC,($A9E5)          ; {hard.workRam+1E5}
0222: A7              AND     A                   
0223: ED 42           SBC     HL,BC               
0225: 29              ADD     HL,HL               
0226: 29              ADD     HL,HL               
0227: 29              ADD     HL,HL               
0228: 29              ADD     HL,HL               
0229: 3E 00           LD      A,$00               
022B: DE 00           SBC     A,$00               
022D: 6C              LD      L,H                 
022E: 67              LD      H,A                 
022F: 22 E9 A9        LD      ($A9E9),HL          ; {hard.workRam+1E9}

loc_0232:
0232: 2A E3 A9        LD      HL,($A9E3)          ; {hard.workRam+1E3}
0235: ED 4B E7 A9     LD      BC,($A9E7)          ; {hard.workRam+1E7}
0239: 09              ADD     HL,BC               
023A: 22 E3 A9        LD      ($A9E3),HL          ; {hard.workRam+1E3}
023D: 2A E5 A9        LD      HL,($A9E5)          ; {hard.workRam+1E5}
0240: ED 4B E9 A9     LD      BC,($A9E9)          ; {hard.workRam+1E9}
0244: 09              ADD     HL,BC               
0245: 22 E5 A9        LD      ($A9E5),HL          ; {hard.workRam+1E5}
0248: CD 6F 02        CALL    $026F               ; {code.plotPenCell}
024B: ED 5B B2 14     LD      DE,($14B2)          ; {hard.rom+14B2}
024F: A7              AND     A                   
0250: ED 52           SBC     HL,DE               
0252: C2 32 02        JP      NZ,$0232            ; {code.loc_0232}
0255: 21 E2 A9        LD      HL,$A9E2            
0258: 34              INC     (HL)                
0259: 7E              LD      A,(HL)              
025A: 21 90 02        LD      HL,$0290            
025D: D7              RST     $10                 
025E: 21 E3 A9        LD      HL,$A9E3            
0261: 36 00           LD      (HL),$00            
0263: 23              INC     HL                  
0264: 73              LD      (HL),E              
0265: 21 E5 A9        LD      HL,$A9E5            
0268: 36 00           LD      (HL),$00            
026A: 23              INC     HL                  
026B: 72              LD      (HL),D              
026C: 7B              LD      A,E                 
026D: A7              AND     A                   
026E: C9              RET                         

; stamp the current pen glyph and pen colour into the one character cell a
; row cell and a column cell name, and hand back the video-plane address
; of that cell
plotPenCell:
026F: 3A E4 A9        LD      A,($A9E4)           ; {hard.workRam+1E4}
0272: 87              ADD     A,A                 
0273: 87              ADD     A,A                 
0274: 87              ADD     A,A                 
0275: 6F              LD      L,A                 
0276: 26 00           LD      H,$00               
0278: 29              ADD     HL,HL               
0279: 29              ADD     HL,HL               
027A: 3A E6 A9        LD      A,($A9E6)           ; {hard.workRam+1E6}
027D: 85              ADD     A,L                 
027E: 6F              LD      L,A                 
027F: 3E A4           LD      A,$A4               
0281: 84              ADD     A,H                 
0282: 67              LD      H,A                 
0283: 3A 0B AD        LD      A,($AD0B)           ; {hard.workRam+50B}
0286: 77              LD      (HL),A              
0287: CB 94           RES     2,H                 
0289: 3A 0C AD        LD      A,($AD0C)           ; {hard.workRam+50C}
028C: 77              LD      (HL),A              
028D: CB D4           SET     2,H                 
028F: C9              RET                         

; ---- $0290-$0364: data ----
0290: 10 04 11 04 12 04 13 04 14 04 15 04 16 04 17 04
02A0: 18 04 19 04 1A 04 1B 04 1C 04 1D 04 1D 05 1D 06
02B0: 1D 07 1D 08 1D 09 1D 0A 1D 0B 1D 0C 1D 0D 1D 0E
02C0: 1D 0F 1D 10 1D 11 1D 12 1D 13 1D 14 1D 15 1D 16
02D0: 1D 17 1D 18 1D 19 1D 1A 1D 1B 1D 1C 1D 1D 1D 1E
02E0: 1C 1E 1B 1E 1A 1E 19 1E 18 1E 17 1E 16 1E 15 1E
02F0: 14 1E 13 1E 12 1E 11 1E 10 1E 0F 1E 0E 1E 0D 1E
0300: 0C 1E 0B 1E 0A 1E 09 1E 08 1E 07 1E 06 1E 05 1E
0310: 04 1E 03 1E 02 1E 02 1D 02 1C 02 1B 02 1A 02 19
0320: 02 18 02 17 02 16 02 15 02 14 02 13 02 12 02 11
0330: 02 10 02 0F 02 0E 02 0D 02 0C 02 0B 02 0A 02 09
0340: 02 08 02 07 02 06 02 05 02 04 03 04 04 04 05 04
0350: 06 04 07 04 08 04 09 04 0A 04 0B 04 0C 04 0D 04
0360: 0E 04 0F 04 00

; gather the sprite shadow into the two hardware banks, three runs per
; bank in an order that is not their order in memory, transforming each
; byte by which half of its sprite it is and which way round the cabinet
; has the picture; then, inside one window of the sequence, ask for the
; eight scenery slots to be shown a second time half a screen away
publishSpriteShadow:
0365: 21 30 AA        LD      HL,$AA30            
0368: 11 10 B0        LD      DE,$B010            
036B: 3A 87 A9        LD      A,($A987)           ; {hard.workRam+187}
036E: A7              AND     A                   
036F: CA 56 05        JP      Z,$0556             ; {code.loc_0556}
0372: ED A0           LDI                         
0374: ED A0           LDI                         
0376: ED A0           LDI                         
0378: ED A0           LDI                         
037A: ED A0           LDI                         
037C: ED A0           LDI                         
037E: 21 10 AA        LD      HL,$AA10            
0381: ED A0           LDI                         
0383: ED A0           LDI                         
0385: ED A0           LDI                         
0387: ED A0           LDI                         
0389: ED A0           LDI                         
038B: ED A0           LDI                         
038D: ED A0           LDI                         
038F: ED A0           LDI                         
0391: ED A0           LDI                         
0393: ED A0           LDI                         
0395: ED A0           LDI                         
0397: ED A0           LDI                         
0399: ED A0           LDI                         
039B: ED A0           LDI                         
039D: ED A0           LDI                         
039F: ED A0           LDI                         
03A1: ED A0           LDI                         
03A3: ED A0           LDI                         
03A5: ED A0           LDI                         
03A7: ED A0           LDI                         
03A9: ED A0           LDI                         
03AB: ED A0           LDI                         
03AD: ED A0           LDI                         
03AF: ED A0           LDI                         
03B1: ED A0           LDI                         
03B3: ED A0           LDI                         
03B5: ED A0           LDI                         
03B7: ED A0           LDI                         
03B9: ED A0           LDI                         
03BB: ED A0           LDI                         
03BD: ED A0           LDI                         
03BF: ED A0           LDI                         
03C1: 21 36 AA        LD      HL,$AA36            
03C4: ED A0           LDI                         
03C6: ED A0           LDI                         
03C8: ED A0           LDI                         
03CA: ED A0           LDI                         
03CC: ED A0           LDI                         
03CE: ED A0           LDI                         
03D0: ED A0           LDI                         
03D2: ED A0           LDI                         
03D4: ED A0           LDI                         
03D6: ED A0           LDI                         
03D8: 21 60 AA        LD      HL,$AA60            
03DB: 11 10 B4        LD      DE,$B410            
03DE: ED A0           LDI                         
03E0: 7E              LD      A,(HL)              
03E1: C6 0E           ADD     A,$0E               
03E3: 2F              CPL                         
03E4: 12              LD      (DE),A              
03E5: 2C              INC     L                   
03E6: 1C              INC     E                   
03E7: ED A0           LDI                         
03E9: 7E              LD      A,(HL)              
03EA: C6 0E           ADD     A,$0E               
03EC: 2F              CPL                         
03ED: 12              LD      (DE),A              
03EE: 2C              INC     L                   
03EF: 1C              INC     E                   
03F0: ED A0           LDI                         
03F2: 7E              LD      A,(HL)              
03F3: C6 0E           ADD     A,$0E               
03F5: 2F              CPL                         
03F6: 12              LD      (DE),A              
03F7: 2C              INC     L                   
03F8: 1C              INC     E                   
03F9: 21 40 AA        LD      HL,$AA40            
03FC: ED A0           LDI                         
03FE: 7E              LD      A,(HL)              
03FF: C6 0E           ADD     A,$0E               
0401: 2F              CPL                         
0402: 12              LD      (DE),A              
0403: 2C              INC     L                   
0404: 1C              INC     E                   
0405: ED A0           LDI                         
0407: 7E              LD      A,(HL)              
0408: C6 0E           ADD     A,$0E               
040A: 2F              CPL                         
040B: 12              LD      (DE),A              
040C: 2C              INC     L                   
040D: 1C              INC     E                   
040E: ED A0           LDI                         
0410: 7E              LD      A,(HL)              
0411: C6 0E           ADD     A,$0E               
0413: 2F              CPL                         
0414: 12              LD      (DE),A              
0415: 2C              INC     L                   
0416: 1C              INC     E                   
0417: ED A0           LDI                         
0419: 7E              LD      A,(HL)              
041A: C6 0E           ADD     A,$0E               
041C: 2F              CPL                         
041D: 12              LD      (DE),A              
041E: 2C              INC     L                   
041F: 1C              INC     E                   
0420: ED A0           LDI                         
0422: 7E              LD      A,(HL)              
0423: C6 0E           ADD     A,$0E               
0425: 2F              CPL                         
0426: 12              LD      (DE),A              
0427: 2C              INC     L                   
0428: 1C              INC     E                   
0429: ED A0           LDI                         
042B: 7E              LD      A,(HL)              
042C: C6 0E           ADD     A,$0E               
042E: 2F              CPL                         
042F: 12              LD      (DE),A              
0430: 2C              INC     L                   
0431: 1C              INC     E                   
0432: ED A0           LDI                         
0434: 7E              LD      A,(HL)              
0435: C6 0E           ADD     A,$0E               
0437: 2F              CPL                         
0438: 12              LD      (DE),A              
0439: 2C              INC     L                   
043A: 1C              INC     E                   
043B: ED A0           LDI                         
043D: 7E              LD      A,(HL)              
043E: C6 0E           ADD     A,$0E               
0440: 2F              CPL                         
0441: 12              LD      (DE),A              
0442: 2C              INC     L                   
0443: 1C              INC     E                   
0444: ED A0           LDI                         
0446: 7E              LD      A,(HL)              
0447: C6 0E           ADD     A,$0E               
0449: 2F              CPL                         
044A: 12              LD      (DE),A              
044B: 2C              INC     L                   
044C: 1C              INC     E                   
044D: ED A0           LDI                         
044F: 7E              LD      A,(HL)              
0450: C6 0E           ADD     A,$0E               
0452: 2F              CPL                         
0453: 12              LD      (DE),A              
0454: 2C              INC     L                   
0455: 1C              INC     E                   
0456: ED A0           LDI                         
0458: 7E              LD      A,(HL)              
0459: C6 0E           ADD     A,$0E               
045B: 2F              CPL                         
045C: 12              LD      (DE),A              
045D: 2C              INC     L                   
045E: 1C              INC     E                   
045F: ED A0           LDI                         
0461: 7E              LD      A,(HL)              
0462: C6 0E           ADD     A,$0E               
0464: 2F              CPL                         
0465: 12              LD      (DE),A              
0466: 2C              INC     L                   
0467: 1C              INC     E                   
0468: ED A0           LDI                         
046A: 7E              LD      A,(HL)              
046B: C6 0E           ADD     A,$0E               
046D: 2F              CPL                         
046E: 12              LD      (DE),A              
046F: 2C              INC     L                   
0470: 1C              INC     E                   
0471: ED A0           LDI                         
0473: 7E              LD      A,(HL)              
0474: C6 0E           ADD     A,$0E               
0476: 2F              CPL                         
0477: 12              LD      (DE),A              
0478: 2C              INC     L                   
0479: 1C              INC     E                   
047A: ED A0           LDI                         
047C: 7E              LD      A,(HL)              
047D: C6 0E           ADD     A,$0E               
047F: 2F              CPL                         
0480: 12              LD      (DE),A              
0481: 2C              INC     L                   
0482: 1C              INC     E                   
0483: ED A0           LDI                         
0485: 7E              LD      A,(HL)              
0486: C6 0E           ADD     A,$0E               
0488: 2F              CPL                         
0489: 12              LD      (DE),A              
048A: 2C              INC     L                   
048B: 1C              INC     E                   
048C: 21 66 AA        LD      HL,$AA66            
048F: ED A0           LDI                         
0491: 7E              LD      A,(HL)              
0492: C6 0E           ADD     A,$0E               
0494: 2F              CPL                         
0495: 12              LD      (DE),A              
0496: 2C              INC     L                   
0497: 1C              INC     E                   
0498: ED A0           LDI                         
049A: 7E              LD      A,(HL)              
049B: C6 0E           ADD     A,$0E               
049D: 2F              CPL                         
049E: 12              LD      (DE),A              
049F: 2C              INC     L                   
04A0: 1C              INC     E                   
04A1: ED A0           LDI                         
04A3: 7E              LD      A,(HL)              
04A4: C6 0E           ADD     A,$0E               
04A6: 2F              CPL                         
04A7: 12              LD      (DE),A              
04A8: 2C              INC     L                   
04A9: 1C              INC     E                   
04AA: ED A0           LDI                         
04AC: 7E              LD      A,(HL)              
04AD: C6 0E           ADD     A,$0E               
04AF: 2F              CPL                         
04B0: 12              LD      (DE),A              
04B1: 2C              INC     L                   
04B2: 1C              INC     E                   
04B3: ED A0           LDI                         
04B5: 7E              LD      A,(HL)              
04B6: C6 0E           ADD     A,$0E               
04B8: 2F              CPL                         
04B9: 12              LD      (DE),A              
04BA: 2C              INC     L                   
04BB: 1C              INC     E                   

loc_04bc:
04BC: 3A AB A9        LD      A,($A9AB)           ; {hard.workRam+1AB}
04BF: FE 03           CP      $03                 
04C1: C0              RET     NZ                  
04C2: 3A AC A9        LD      A,($A9AC)           ; {hard.workRam+1AC}
04C5: 21 32 08        LD      HL,$0832            
04C8: BE              CP      (HL)                
04C9: D8              RET     C                   
04CA: FE 08           CP      $08                 
04CC: D0              RET     NC                  
04CD: 3A 11 B4        LD      A,($B411)           
04D0: C6 80           ADD     A,$80               
04D2: 38 0A           JR      C,$04DE             ; {code.loc_04de}
04D4: 32 11 B4        LD      ($B411),A           
04D7: 21 10 B0        LD      HL,$B010            
04DA: 7E              LD      A,(HL)              
04DB: C6 80           ADD     A,$80               
04DD: 77              LD      (HL),A              

loc_04de:
04DE: 3A 13 B4        LD      A,($B413)           
04E1: C6 80           ADD     A,$80               
04E3: 38 0A           JR      C,$04EF             ; {code.loc_04ef}
04E5: 32 13 B4        LD      ($B413),A           
04E8: 21 12 B0        LD      HL,$B012            
04EB: 7E              LD      A,(HL)              
04EC: C6 80           ADD     A,$80               
04EE: 77              LD      (HL),A              

loc_04ef:
04EF: 3A 15 B4        LD      A,($B415)           
04F2: C6 80           ADD     A,$80               
04F4: 38 0A           JR      C,$0500             ; {code.loc_0500}
04F6: 32 15 B4        LD      ($B415),A           
04F9: 21 14 B0        LD      HL,$B014            
04FC: 7E              LD      A,(HL)              
04FD: C6 80           ADD     A,$80               
04FF: 77              LD      (HL),A              

loc_0500:
0500: 3A 37 B4        LD      A,($B437)           
0503: C6 80           ADD     A,$80               
0505: 38 0A           JR      C,$0511             ; {code.loc_0511}
0507: 32 37 B4        LD      ($B437),A           
050A: 21 36 B0        LD      HL,$B036            
050D: 7E              LD      A,(HL)              
050E: C6 80           ADD     A,$80               
0510: 77              LD      (HL),A              

loc_0511:
0511: 3A 39 B4        LD      A,($B439)           
0514: C6 80           ADD     A,$80               
0516: 38 0A           JR      C,$0522             ; {code.loc_0522}
0518: 32 39 B4        LD      ($B439),A           
051B: 21 38 B0        LD      HL,$B038            
051E: 7E              LD      A,(HL)              
051F: C6 80           ADD     A,$80               
0521: 77              LD      (HL),A              

loc_0522:
0522: 3A 3B B4        LD      A,($B43B)           
0525: C6 80           ADD     A,$80               
0527: 38 0A           JR      C,$0533             ; {code.loc_0533}
0529: 32 3B B4        LD      ($B43B),A           
052C: 21 3A B0        LD      HL,$B03A            
052F: 7E              LD      A,(HL)              
0530: C6 80           ADD     A,$80               
0532: 77              LD      (HL),A              

loc_0533:
0533: 3A 3D B4        LD      A,($B43D)           
0536: C6 80           ADD     A,$80               
0538: 38 0A           JR      C,$0544             ; {code.loc_0544}
053A: 32 3D B4        LD      ($B43D),A           
053D: 21 3C B0        LD      HL,$B03C            
0540: 7E              LD      A,(HL)              
0541: C6 80           ADD     A,$80               
0543: 77              LD      (HL),A              

loc_0544:
0544: 3A 3F B4        LD      A,($B43F)           
0547: C6 80           ADD     A,$80               
0549: 38 0A           JR      C,$0555             ; {code.loc_0555}
054B: 32 3F B4        LD      ($B43F),A           
054E: 21 3E B0        LD      HL,$B03E            
0551: 7E              LD      A,(HL)              
0552: C6 80           ADD     A,$80               
0554: 77              LD      (HL),A              

loc_0555:
0555: C9              RET                         

loc_0556:
0556: 7E              LD      A,(HL)              
0557: C6 0F           ADD     A,$0F               
0559: 2F              CPL                         
055A: 12              LD      (DE),A              
055B: 2C              INC     L                   
055C: 1C              INC     E                   
055D: ED A0           LDI                         
055F: 7E              LD      A,(HL)              
0560: C6 0F           ADD     A,$0F               
0562: 2F              CPL                         
0563: 12              LD      (DE),A              
0564: 2C              INC     L                   
0565: 1C              INC     E                   
0566: ED A0           LDI                         
0568: 7E              LD      A,(HL)              
0569: C6 0F           ADD     A,$0F               
056B: 2F              CPL                         
056C: 12              LD      (DE),A              
056D: 2C              INC     L                   
056E: 1C              INC     E                   
056F: ED A0           LDI                         
0571: 21 10 AA        LD      HL,$AA10            
0574: 7E              LD      A,(HL)              
0575: C6 0F           ADD     A,$0F               
0577: 2F              CPL                         
0578: 12              LD      (DE),A              
0579: 2C              INC     L                   
057A: 1C              INC     E                   
057B: ED A0           LDI                         
057D: 7E              LD      A,(HL)              
057E: C6 0F           ADD     A,$0F               
0580: 2F              CPL                         
0581: 12              LD      (DE),A              
0582: 2C              INC     L                   
0583: 1C              INC     E                   
0584: ED A0           LDI                         
0586: 7E              LD      A,(HL)              
0587: C6 0F           ADD     A,$0F               
0589: 2F              CPL                         
058A: 12              LD      (DE),A              
058B: 2C              INC     L                   
058C: 1C              INC     E                   
058D: ED A0           LDI                         
058F: 7E              LD      A,(HL)              
0590: C6 0F           ADD     A,$0F               
0592: 2F              CPL                         
0593: 12              LD      (DE),A              
0594: 2C              INC     L                   
0595: 1C              INC     E                   
0596: ED A0           LDI                         
0598: 7E              LD      A,(HL)              
0599: C6 0F           ADD     A,$0F               
059B: 2F              CPL                         
059C: 12              LD      (DE),A              
059D: 2C              INC     L                   
059E: 1C              INC     E                   
059F: ED A0           LDI                         
05A1: 7E              LD      A,(HL)              
05A2: C6 0F           ADD     A,$0F               
05A4: 2F              CPL                         
05A5: 12              LD      (DE),A              
05A6: 2C              INC     L                   
05A7: 1C              INC     E                   
05A8: ED A0           LDI                         
05AA: 7E              LD      A,(HL)              
05AB: C6 0F           ADD     A,$0F               
05AD: 2F              CPL                         
05AE: 12              LD      (DE),A              
05AF: 2C              INC     L                   
05B0: 1C              INC     E                   
05B1: ED A0           LDI                         
05B3: 7E              LD      A,(HL)              
05B4: C6 0F           ADD     A,$0F               
05B6: 2F              CPL                         
05B7: 12              LD      (DE),A              
05B8: 2C              INC     L                   
05B9: 1C              INC     E                   
05BA: ED A0           LDI                         
05BC: 7E              LD      A,(HL)              
05BD: C6 0F           ADD     A,$0F               
05BF: 2F              CPL                         
05C0: 12              LD      (DE),A              
05C1: 2C              INC     L                   
05C2: 1C              INC     E                   
05C3: ED A0           LDI                         
05C5: 7E              LD      A,(HL)              
05C6: C6 0F           ADD     A,$0F               
05C8: 2F              CPL                         
05C9: 12              LD      (DE),A              
05CA: 2C              INC     L                   
05CB: 1C              INC     E                   
05CC: ED A0           LDI                         
05CE: 7E              LD      A,(HL)              
05CF: C6 0F           ADD     A,$0F               
05D1: 2F              CPL                         
05D2: 12              LD      (DE),A              
05D3: 2C              INC     L                   
05D4: 1C              INC     E                   
05D5: ED A0           LDI                         
05D7: 7E              LD      A,(HL)              
05D8: C6 0F           ADD     A,$0F               
05DA: 2F              CPL                         
05DB: 12              LD      (DE),A              
05DC: 2C              INC     L                   
05DD: 1C              INC     E                   
05DE: ED A0           LDI                         
05E0: 7E              LD      A,(HL)              
05E1: C6 0F           ADD     A,$0F               
05E3: 2F              CPL                         
05E4: 12              LD      (DE),A              
05E5: 2C              INC     L                   
05E6: 1C              INC     E                   
05E7: ED A0           LDI                         
05E9: 7E              LD      A,(HL)              
05EA: C6 0F           ADD     A,$0F               
05EC: 2F              CPL                         
05ED: 12              LD      (DE),A              
05EE: 2C              INC     L                   
05EF: 1C              INC     E                   
05F0: ED A0           LDI                         
05F2: 7E              LD      A,(HL)              
05F3: C6 0F           ADD     A,$0F               
05F5: 2F              CPL                         
05F6: 12              LD      (DE),A              
05F7: 2C              INC     L                   
05F8: 1C              INC     E                   
05F9: ED A0           LDI                         
05FB: 7E              LD      A,(HL)              
05FC: C6 0F           ADD     A,$0F               
05FE: 2F              CPL                         
05FF: 12              LD      (DE),A              
0600: 2C              INC     L                   
0601: 1C              INC     E                   
0602: ED A0           LDI                         
0604: 21 36 AA        LD      HL,$AA36            
0607: 7E              LD      A,(HL)              
0608: C6 0F           ADD     A,$0F               
060A: 2F              CPL                         
060B: 12              LD      (DE),A              
060C: 2C              INC     L                   
060D: 1C              INC     E                   
060E: ED A0           LDI                         
0610: 7E              LD      A,(HL)              
0611: C6 0F           ADD     A,$0F               
0613: 2F              CPL                         
0614: 12              LD      (DE),A              
0615: 2C              INC     L                   
0616: 1C              INC     E                   
0617: ED A0           LDI                         
0619: 7E              LD      A,(HL)              
061A: C6 0F           ADD     A,$0F               
061C: 2F              CPL                         
061D: 12              LD      (DE),A              
061E: 2C              INC     L                   
061F: 1C              INC     E                   
0620: ED A0           LDI                         
0622: 7E              LD      A,(HL)              
0623: C6 0F           ADD     A,$0F               
0625: 2F              CPL                         
0626: 12              LD      (DE),A              
0627: 2C              INC     L                   
0628: 1C              INC     E                   
0629: ED A0           LDI                         
062B: 7E              LD      A,(HL)              
062C: C6 0F           ADD     A,$0F               
062E: 2F              CPL                         
062F: 12              LD      (DE),A              
0630: 2C              INC     L                   
0631: 1C              INC     E                   
0632: ED A0           LDI                         
0634: 21 60 AA        LD      HL,$AA60            
0637: 11 10 B4        LD      DE,$B410            
063A: 7E              LD      A,(HL)              
063B: EE C0           XOR     $C0                 
063D: 12              LD      (DE),A              
063E: 2C              INC     L                   
063F: 1C              INC     E                   
0640: 7E              LD      A,(HL)              
0641: 3C              INC     A                   
0642: 12              LD      (DE),A              
0643: 2C              INC     L                   
0644: 1C              INC     E                   
0645: 7E              LD      A,(HL)              
0646: EE C0           XOR     $C0                 
0648: 12              LD      (DE),A              
0649: 2C              INC     L                   
064A: 1C              INC     E                   
064B: 7E              LD      A,(HL)              
064C: 3C              INC     A                   
064D: 12              LD      (DE),A              
064E: 2C              INC     L                   
064F: 1C              INC     E                   
0650: 7E              LD      A,(HL)              
0651: EE C0           XOR     $C0                 
0653: 12              LD      (DE),A              
0654: 2C              INC     L                   
0655: 1C              INC     E                   
0656: 7E              LD      A,(HL)              
0657: 3C              INC     A                   
0658: 12              LD      (DE),A              
0659: 2C              INC     L                   
065A: 1C              INC     E                   
065B: 21 40 AA        LD      HL,$AA40            
065E: 7E              LD      A,(HL)              
065F: EE C0           XOR     $C0                 
0661: 12              LD      (DE),A              
0662: 2C              INC     L                   
0663: 1C              INC     E                   
0664: 7E              LD      A,(HL)              
0665: 3C              INC     A                   
0666: 12              LD      (DE),A              
0667: 2C              INC     L                   
0668: 1C              INC     E                   
0669: 7E              LD      A,(HL)              
066A: EE C0           XOR     $C0                 
066C: 12              LD      (DE),A              
066D: 2C              INC     L                   
066E: 1C              INC     E                   
066F: 7E              LD      A,(HL)              
0670: 3C              INC     A                   
0671: 12              LD      (DE),A              
0672: 2C              INC     L                   
0673: 1C              INC     E                   
0674: 7E              LD      A,(HL)              
0675: EE C0           XOR     $C0                 
0677: 12              LD      (DE),A              
0678: 2C              INC     L                   
0679: 1C              INC     E                   
067A: 7E              LD      A,(HL)              
067B: 3C              INC     A                   
067C: 12              LD      (DE),A              
067D: 2C              INC     L                   
067E: 1C              INC     E                   
067F: 7E              LD      A,(HL)              
0680: EE C0           XOR     $C0                 
0682: 12              LD      (DE),A              
0683: 2C              INC     L                   
0684: 1C              INC     E                   
0685: 7E              LD      A,(HL)              
0686: 3C              INC     A                   
0687: 12              LD      (DE),A              
0688: 2C              INC     L                   
0689: 1C              INC     E                   
068A: 7E              LD      A,(HL)              
068B: EE C0           XOR     $C0                 
068D: 12              LD      (DE),A              
068E: 2C              INC     L                   
068F: 1C              INC     E                   
0690: 7E              LD      A,(HL)              
0691: 3C              INC     A                   
0692: 12              LD      (DE),A              
0693: 2C              INC     L                   
0694: 1C              INC     E                   
0695: 7E              LD      A,(HL)              
0696: EE C0           XOR     $C0                 
0698: 12              LD      (DE),A              
0699: 2C              INC     L                   
069A: 1C              INC     E                   
069B: 7E              LD      A,(HL)              
069C: 3C              INC     A                   
069D: 12              LD      (DE),A              
069E: 2C              INC     L                   
069F: 1C              INC     E                   
06A0: 7E              LD      A,(HL)              
06A1: EE C0           XOR     $C0                 
06A3: 12              LD      (DE),A              
06A4: 2C              INC     L                   
06A5: 1C              INC     E                   
06A6: 7E              LD      A,(HL)              
06A7: 3C              INC     A                   
06A8: 12              LD      (DE),A              
06A9: 2C              INC     L                   
06AA: 1C              INC     E                   
06AB: 7E              LD      A,(HL)              
06AC: EE C0           XOR     $C0                 
06AE: 12              LD      (DE),A              
06AF: 2C              INC     L                   
06B0: 1C              INC     E                   
06B1: 7E              LD      A,(HL)              
06B2: 3C              INC     A                   
06B3: 12              LD      (DE),A              
06B4: 2C              INC     L                   
06B5: 1C              INC     E                   
06B6: 7E              LD      A,(HL)              
06B7: EE C0           XOR     $C0                 
06B9: 12              LD      (DE),A              
06BA: 2C              INC     L                   
06BB: 1C              INC     E                   
06BC: 7E              LD      A,(HL)              
06BD: 3C              INC     A                   
06BE: 12              LD      (DE),A              
06BF: 2C              INC     L                   
06C0: 1C              INC     E                   
06C1: 7E              LD      A,(HL)              
06C2: EE C0           XOR     $C0                 
06C4: 12              LD      (DE),A              
06C5: 2C              INC     L                   
06C6: 1C              INC     E                   
06C7: 7E              LD      A,(HL)              
06C8: 3C              INC     A                   
06C9: 12              LD      (DE),A              
06CA: 2C              INC     L                   
06CB: 1C              INC     E                   
06CC: 7E              LD      A,(HL)              
06CD: EE C0           XOR     $C0                 
06CF: 12              LD      (DE),A              
06D0: 2C              INC     L                   
06D1: 1C              INC     E                   
06D2: 7E              LD      A,(HL)              
06D3: 3C              INC     A                   
06D4: 12              LD      (DE),A              
06D5: 2C              INC     L                   
06D6: 1C              INC     E                   
06D7: 7E              LD      A,(HL)              
06D8: EE C0           XOR     $C0                 
06DA: 12              LD      (DE),A              
06DB: 2C              INC     L                   
06DC: 1C              INC     E                   
06DD: 7E              LD      A,(HL)              
06DE: 3C              INC     A                   
06DF: 12              LD      (DE),A              
06E0: 2C              INC     L                   
06E1: 1C              INC     E                   
06E2: 7E              LD      A,(HL)              
06E3: EE C0           XOR     $C0                 
06E5: 12              LD      (DE),A              
06E6: 2C              INC     L                   
06E7: 1C              INC     E                   
06E8: 7E              LD      A,(HL)              
06E9: 3C              INC     A                   
06EA: 12              LD      (DE),A              
06EB: 2C              INC     L                   
06EC: 1C              INC     E                   
06ED: 7E              LD      A,(HL)              
06EE: EE C0           XOR     $C0                 
06F0: 12              LD      (DE),A              
06F1: 2C              INC     L                   
06F2: 1C              INC     E                   
06F3: 7E              LD      A,(HL)              
06F4: 3C              INC     A                   
06F5: 12              LD      (DE),A              
06F6: 2C              INC     L                   
06F7: 1C              INC     E                   
06F8: 7E              LD      A,(HL)              
06F9: EE C0           XOR     $C0                 
06FB: 12              LD      (DE),A              
06FC: 2C              INC     L                   
06FD: 1C              INC     E                   
06FE: 7E              LD      A,(HL)              
06FF: 3C              INC     A                   
0700: 12              LD      (DE),A              
0701: 2C              INC     L                   
0702: 1C              INC     E                   
0703: 7E              LD      A,(HL)              
0704: EE C0           XOR     $C0                 
0706: 12              LD      (DE),A              
0707: 2C              INC     L                   
0708: 1C              INC     E                   
0709: 7E              LD      A,(HL)              
070A: 3C              INC     A                   
070B: 12              LD      (DE),A              
070C: 2C              INC     L                   
070D: 1C              INC     E                   
070E: 21 66 AA        LD      HL,$AA66            
0711: 7E              LD      A,(HL)              
0712: EE C0           XOR     $C0                 
0714: 12              LD      (DE),A              
0715: 2C              INC     L                   
0716: 1C              INC     E                   
0717: 7E              LD      A,(HL)              
0718: 3C              INC     A                   
0719: 12              LD      (DE),A              
071A: 2C              INC     L                   
071B: 1C              INC     E                   
071C: 7E              LD      A,(HL)              
071D: EE C0           XOR     $C0                 
071F: 12              LD      (DE),A              
0720: 2C              INC     L                   
0721: 1C              INC     E                   
0722: 7E              LD      A,(HL)              
0723: 3C              INC     A                   
0724: 12              LD      (DE),A              
0725: 2C              INC     L                   
0726: 1C              INC     E                   
0727: 7E              LD      A,(HL)              
0728: EE C0           XOR     $C0                 
072A: 12              LD      (DE),A              
072B: 2C              INC     L                   
072C: 1C              INC     E                   
072D: 7E              LD      A,(HL)              
072E: 3C              INC     A                   
072F: 12              LD      (DE),A              
0730: 2C              INC     L                   
0731: 1C              INC     E                   
0732: 7E              LD      A,(HL)              
0733: EE C0           XOR     $C0                 
0735: 12              LD      (DE),A              
0736: 2C              INC     L                   
0737: 1C              INC     E                   
0738: 7E              LD      A,(HL)              
0739: 3C              INC     A                   
073A: 12              LD      (DE),A              
073B: 2C              INC     L                   
073C: 1C              INC     E                   
073D: 7E              LD      A,(HL)              
073E: EE C0           XOR     $C0                 
0740: 12              LD      (DE),A              
0741: 2C              INC     L                   
0742: 1C              INC     E                   
0743: 7E              LD      A,(HL)              
0744: 3C              INC     A                   
0745: 12              LD      (DE),A              
0746: 2C              INC     L                   
0747: 1C              INC     E                   
0748: C3 BC 04        JP      $04BC               ; {code.loc_04bc}

; attract-sequence arm (phase 1, sub-step 0, reached by rst-30 computed
; dispatch from dispatchSequencePhase1SubStepArm): fold the fixed 256-byte
; run at 0x4AA0 into an eight-bit total and derail into the checksum-
; failure landing 0x08FA on any total but 0xB8; otherwise set the pen
; colour 0xAD0C to 5 and the stamp glyph 0xAD0B to the blanking glyph 0xF1
; (so the pen erases), re-arm the pen route via 0x01E1, then step the
; sequence sub-step 0x0F1A -- twice when the pen colour already held 5
erasePenRouteThenAdvanceStep:
074B: 06 00           LD      B,$00               
074D: 21 A0 4A        LD      HL,$4AA0            
0750: AF              XOR     A                   

loc_0751:
0751: 86              ADD     A,(HL)              
0752: 23              INC     HL                  
0753: 10 FC           DJNZ    $0751               ; {code.loc_0751}
0755: D6 B8           SUB     $B8                 
0757: C2 FA 08        JP      NZ,$08FA            ; {code.loc_08fa}
075A: 3A 0C AD        LD      A,($AD0C)           ; {hard.workRam+50C}
075D: FE 05           CP      $05                 
075F: F5              PUSH    AF                  
0760: 3E 05           LD      A,$05               
0762: 32 0C AD        LD      ($AD0C),A           ; {hard.workRam+50C}
0765: 3E F1           LD      A,$F1               
0767: 32 0B AD        LD      ($AD0B),A           ; {hard.workRam+50B}
076A: CD E1 01        CALL    $01E1               ; {code.armThePenRouteThenColdStartOnATamperedImage}
076D: F1              POP     AF                  
076E: CC 1A 0F        CALL    Z,$0F1A             ; {code.advanceSequenceSubStep}
0771: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

loc_0774:
0774: 06 00           LD      B,$00               
0776: 21 99 4C        LD      HL,$4C99            
0779: 97              SUB     A                   

loc_077a:
077A: AE              XOR     (HL)                
077B: 23              INC     HL                  
077C: 10 FC           DJNZ    $077A               ; {code.loc_077a}
077E: C6 95           ADD     A,$95               
0780: C4 11 0F        CALL    NZ,$0F11            ; {code.advanceSequencePhase}
0783: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
0786: A7              AND     A                   
0787: 28 17           JR      Z,$07A0             ; {code.loc_07a0}
0789: ED 5B 5B 12     LD      DE,($125B)          ; {hard.rom+125B}
078D: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
0790: A7              AND     A                   
0791: 28 01           JR      Z,$0794             ; {code.loc_0794}
0793: 1C              INC     E                   

loc_0794:
0794: FF              RST     $38                 
0795: 3A 0E AD        LD      A,($AD0E)           ; {hard.workRam+50E}
0798: A7              AND     A                   
0799: 28 05           JR      Z,$07A0             ; {code.loc_07a0}
079B: 16 07           LD      D,$07               
079D: FF              RST     $38                 
079E: 18 04           JR      $07A4               ; {code.loc_07a4}

loc_07a0:
07A0: 11 02 02        LD      DE,$0202            
07A3: FF              RST     $38                 

loc_07a4:
07A4: CD 09 08        CALL    $0809               ; {code.drawKillMeter}
07A7: CD F0 19        CALL    $19F0               ; {code.resetPlayfieldAndArmNewRound}
07AA: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; park the eight-bit total the image fold arrives with into B, where the
; helper the verdict arm calls hands it back to A after its own address
; arithmetic has clobbered A; then hand on by jump, so the verdict's own
; exits carry this entry too. Nothing is read or written and no flag moves
parkTheImageTotalForTheTamperVerdict:
07AD: 47              LD      B,A                 
07AE: C3 03 53        JP      $5303               ; {code.advanceSequenceUnlessImageTampered}

; power-on: probe the expansion socket and give the machine away to it if
; a board answers there, otherwise seat the stack at the top of work RAM,
; kick the watchdog, drive the four control lines the latch's first eight
; addresses carry low, raise the video-enable line from a byte of the
; program image, and hand on to the cold start. No work memory is touched
; -- the whole effect is the seated stack and the latched lines. ★ Latch
; bits 5, 6 and 7 are NEVER WRITTEN here: the walk stops at 0xC307 and the
; only other store is to 0xC308, so 'settle the control latch' is five of
; its eight lines and not all eight
seatTheStackAndSettleTheControlLatch:
07B1: 3A 00 60        LD      A,($6000)           
07B4: FE 55           CP      $55                 
07B6: CA 00 60        JP      Z,$6000             
07B9: 31 00 B0        LD      SP,$B000            
07BC: 32 00 C2        LD      ($C200),A           
07BF: 21 00 C3        LD      HL,$C300            
07C2: 06 08           LD      B,$08               

loc_07c4:
07C4: 36 00           LD      (HL),$00            
07C6: 23              INC     HL                  
07C7: 10 FB           DJNZ    $07C4               ; {code.loc_07c4}
07C9: 3A 4B 2D        LD      A,($2D4B)           ; {hard.rom+2D4B}
07CC: 32 08 C3        LD      ($C308),A           
07CF: C3 69 00        JP      $0069               ; {code.clearWorkRamAndSpriteBanksThenColdInit}

; blank a fixed run of fourteen character cells, walking back one native
; row at a time from a fixed cell, and give every one of them the same
; colour
blankFourteenCharCells:
07D2: 21 9F A7        LD      HL,$A79F            
07D5: 11 E0 FF        LD      DE,$FFE0            
07D8: 06 0E           LD      B,$0E               

loc_07da:
07DA: 36 F1           LD      (HL),$F1            
07DC: CB 94           RES     2,H                 
07DE: 36 16           LD      (HL),$16            
07E0: CB D4           SET     2,H                 
07E2: 19              ADD     HL,DE               
07E3: 10 F5           DJNZ    $07DA               ; {code.loc_07da}
07E5: C9              RET                         

; copyright / insert-coin attract sequence arm (table-dispatched): re-
; stamp the copyright strip, re-request the flashing copyright line,
; sample one character cell (0xA61C) into a two-byte record (0xABFE), then
; read the IN0 mirror -- hand off to the one-player game start when
; 1-player start (bit 3) is held, return when the credit count at 0xA986
; is one, otherwise queue ring command 1/argument 25 and step the sequence
; sub-step
stepCopyrightScreenAwaitingStart:
07E6: CD 06 0B        CALL    $0B06               ; {code.stampCopyrightStrip}
07E9: CD 39 0B        CALL    $0B39               ; {code.flashCopyrightLine}
07EC: 21 1C A6        LD      HL,$A61C            
07EF: 11 FE AB        LD      DE,$ABFE            
07F2: CD FC 1A        CALL    $1AFC               ; {code.sampleCellGlyphAndColour}
07F5: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
07F8: CB 5F           BIT     3,A                 
07FA: C2 15 32        JP      NZ,$3215            ; {code.startOnePlayerGame}
07FD: 3A 86 A9        LD      A,($A986)           ; {hard.workRam+186}
0800: 3D              DEC     A                   
0801: C8              RET     Z                   
0802: 11 19 01        LD      DE,$0119            
0805: FF              RST     $38                 
0806: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; repaint the meter that shows how many kills are still owed: a bar of
; era-selected glyphs one cell long per four kills, an end glyph carrying
; the remainder, and one blanking cell past it
drawKillMeter:
0809: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
080C: 87              ADD     A,A                 
080D: 47              LD      B,A                 
080E: 87              ADD     A,A                 
080F: 87              ADD     A,A                 
0810: 80              ADD     A,B                 
0811: 21 7C 08        LD      HL,$087C            
0814: DF              RST     $18                 
0815: 46              LD      B,(HL)              
0816: 23              INC     HL                  
0817: 4E              LD      C,(HL)              
0818: 23              INC     HL                  
0819: 3A 02 AD        LD      A,($AD02)           ; {hard.workRam+502}
081C: 5F              LD      E,A                 
081D: E6 07           AND     $07                 
081F: CF              RST     $08                 
0820: 08              EX      AF,AF'              
0821: 7B              LD      A,E                 
0822: 21 9F A7        LD      HL,$A79F            
0825: 11 E0 FF        LD      DE,$FFE0            
0828: 0F              RRCA                        
0829: 0F              RRCA                        
082A: E6 1F           AND     $1F                 
082C: 28 0A           JR      Z,$0838             ; {code.loc_0838}

loc_082e:
082E: 70              LD      (HL),B              
082F: 19              ADD     HL,DE               
0830: 3D              DEC     A                   
0831: 28 05           JR      Z,$0838             ; {code.loc_0838}
0833: 71              LD      (HL),C              
0834: 19              ADD     HL,DE               
0835: 3D              DEC     A                   
0836: 20 F6           JR      NZ,$082E            ; {code.loc_082e}

loc_0838:
0838: 08              EX      AF,AF'              
0839: 77              LD      (HL),A              
083A: 19              ADD     HL,DE               
083B: 36 F1           LD      (HL),$F1            
083D: C9              RET                         

; title/attract copyright-screen layout arm (table-dispatched, no static
; call site): request the flashing copyright line, stamp the copyright
; caption strip, post caption commands (command 1, arguments
; 0,1,3..7,20,21) to the command ring, then XOR-fold the 24-byte program
; block at 0x176A and step the sequence sub-step when the fold matches
; 0xC9, else transfer to the checksum-failure landing
buildCopyrightScreenThenVerifyImage:
083E: CD 39 0B        CALL    $0B39               ; {code.flashCopyrightLine}
0841: CD 06 0B        CALL    $0B06               ; {code.stampCopyrightStrip}
0844: 11 00 01        LD      DE,$0100            
0847: 06 02           LD      B,$02               

loc_0849:
0849: FF              RST     $38                 
084A: 1C              INC     E                   
084B: 10 FC           DJNZ    $0849               ; {code.loc_0849}
084D: 1C              INC     E                   
084E: 06 05           LD      B,$05               

loc_0850:
0850: FF              RST     $38                 
0851: 1C              INC     E                   
0852: 10 FC           DJNZ    $0850               ; {code.loc_0850}
0854: 1E 14           LD      E,$14               
0856: FF              RST     $38                 
0857: 1C              INC     E                   
0858: FF              RST     $38                 
0859: 21 6A 17        LD      HL,$176A            
085C: 06 18           LD      B,$18               
085E: AF              XOR     A                   

loc_085f:
085F: AE              XOR     (HL)                
0860: 2C              INC     L                   
0861: 10 FC           DJNZ    $085F               ; {code.loc_085f}
0863: D6 C9           SUB     $C9                 
0865: C2 FA 08        JP      NZ,$08FA            ; {code.loc_08fa}
0868: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; ---- $086B-$08AD: data ----
086B: BC A6 10 30 F1 7C 68 3B A5 38 FD F1 96 5D 17 9B
087B: B9 4C 4F F1 41 72 A6 F1 8D E2 FB 37 A7 F1 AB 31
088B: 07 F1 5A 75 85 D9 1B F1 C1 E1 FA F1 B3 A0 47 7B
089B: 78 F1 04 05 C2 F1 DE F9 BB 93 AC F1 36 06 4B F1
08AB: EE D3 D4

; hand back where a fixed block of the program image starts and how many
; bytes of it to take; nothing is read and nothing is written
selectFoldBlock:
08AE: 21 5E 33        LD      HL,$335E            
08B1: 06 1E           LD      B,$1E               
08B3: C9              RET                         

loc_08b4:
08B4: CD 01 02        CALL    $0201               ; {code.drawInterpolatedPenRun}
08B7: C0              RET     NZ                  
08B8: 06 00           LD      B,$00               
08BA: 21 80 48        LD      HL,$4880            
08BD: 97              SUB     A                   

loc_08be:
08BE: AE              XOR     (HL)                
08BF: 23              INC     HL                  
08C0: 10 FC           DJNZ    $08BE               ; {code.loc_08be}
08C2: C6 D0           ADD     A,$D0               
08C4: C2 D9 00        JP      NZ,$00D9            ; {code.loc_00d9}
08C7: 11 13 01        LD      DE,$0113            
08CA: FF              RST     $38                 
08CB: 1E 00           LD      E,$00               
08CD: FF              RST     $38                 
08CE: 1E 14           LD      E,$14               
08D0: FF              RST     $38                 
08D1: 1C              INC     E                   
08D2: FF              RST     $38                 
08D3: 1E 0C           LD      E,$0C               
08D5: FF              RST     $38                 
08D6: CD DC 4B        CALL    $4BDC               ; {code.paintFiveLabelledNumericReadouts}
08D9: 21 95 A9        LD      HL,$A995            
08DC: AF              XOR     A                   
08DD: 06 05           LD      B,$05               

loc_08df:
08DF: 77              LD      (HL),A              
08E0: 23              INC     HL                  
08E1: 10 FC           DJNZ    $08DF               ; {code.loc_08df}
08E3: 36 03           LD      (HL),$03            
08E5: ED 5B 93 A9     LD      DE,($A993)          ; {hard.workRam+193}
08E9: 3A 99 A9        LD      A,($A999)           ; {hard.workRam+199}
08EC: 21 C7 12        LD      HL,$12C7            
08EF: CF              RST     $08                 
08F0: 12              LD      (DE),A              
08F1: CB 92           RES     2,D                 
08F3: 1A              LD      A,(DE)              
08F4: 32 90 A9        LD      ($A990),A           ; {hard.workRam+190}
08F7: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

loc_08fa:
08FA: 4B              LD      C,E                 
08FB: 01 4A 01        LD      BC,$014A            
08FE: 49              LD      C,C                 
08FF: 01 48 01        LD      BC,$0148            
0902: 47              LD      B,A                 
0903: 01 46 01        LD      BC,$0146            
0906: 45              LD      B,L                 
0907: 01 40 01        LD      BC,$0140            
090A: 3E 01           LD      A,$01               
090C: 3C              INC     A                   
090D: 01 3A 01        LD      BC,$013A            
0910: 38 01           JR      C,$0913             
0912: 32 01 2F        LD      ($2F01),A           ; {hard.rom+2F01}
0915: 01 2D 01        LD      BC,$012D            
0918: 27              DAA                         
0919: 01 24 01        LD      BC,$0124            
091C: 21 01 1E        LD      HL,$1E01            
091F: 01 18 01        LD      BC,$0118            
0922: 15              DEC     D                   

loc_0923:
0923: 01 12 01        LD      BC,$0112            
0926: 0C              INC     C                   
0927: 01 09 01        LD      BC,$0109            
092A: 06 01           LD      B,$01               
092C: 00              NOP                         
092D: 01 FD 00        LD      BC,$00FD            
0930: FA 00 F7        JP      M,$F700             
0933: 00              NOP                         
0934: F1              POP     AF                  
0935: 00              NOP                         
0936: EE 00           XOR     $00                 
0938: EB              EX      DE,HL               
0939: 00              NOP                         
093A: E5              PUSH    HL                  
093B: 00              NOP                         
093C: E2 00 DE        JP      PO,$DE00            
093F: 00              NOP                         
0940: D8              RET     C                   
0941: 00              NOP                         
0942: D5              PUSH    DE                  
0943: 00              NOP                         
0944: D1              POP     DE                  
0945: 00              NOP                         
0946: CA 00 C6        JP      Z,$C600             
0949: 00              NOP                         
094A: C3 00 BC        JP      $BC00               

; ---- $094D-$0B05: data ----
094D: 00 B6 00 AE 00 A9 00 9F 00 9C 00 93 00 8A 00 84
095D: 00 7B 00 71 00 6B 00 61 00 57 00 50 00 45 00 3B
096D: 00 34 00 29 00 1E 00 13 00 08 00 00 00 00 00 F8
097D: FF ED FF 00 00 D7 FF CC FF C5 FF BB FF B0 FF A9
098D: FF 9F FF 95 FF 8F FF 85 FF 7C FF 76 FF 6D FF 64
099D: FF 61 FF 64 FF 52 FF 4A FF 44 FF 3D FF 3A FF 36
09AD: FF 2F FF 2B FF 28 FF 22 FF 1E FF 1B FF 15 FF 12
09BD: FF 0F FF 0F FF 06 FF 03 FF 00 FF FA FE F7 FE F4
09CD: FE EE FE EB FE E8 FE E2 FE DF FE DC FE D9 FE D3
09DD: FE D1 FE CE FE C8 FE C6 FE C4 FE C2 FE C0 FE BB
09ED: FE BA FE B9 FE B8 FE B7 FE B6 FE B5 FE B5 FE B6
09FD: FE B7 FE B8 FE B9 FE BA FE BB FE C0 FE C2 FE C4
0A0D: FE C6 FE C8 FE CE FE D1 FE D3 FE D9 FE DC FE DF
0A1D: FE E2 FE E8 FE EB FE EE FE F4 FE F7 FE FA FE 00
0A2D: FF 03 FF 06 FF 09 FF 0F FF 12 FF 15 FF 1B FF 1E
0A3D: FF 22 FF 28 FF 2B FF 2F FF 36 FF 3A FF 3D FF 44
0A4D: FF 4A FF 52 FF 57 FF 61 FF 64 FF 6D FF 76 FF 7C
0A5D: FF 85 FF 8F FF 95 FF 9F FF A9 FF B0 FF BB FF C5
0A6D: FF CC FF D7 FF E2 FF ED FF F8 FF 00 00 00 00 08
0A7D: 00 13 00 1E 00 29 00 34 00 3B 00 45 00 50 00 57
0A8D: 00 61 00 6B 00 71 00 7B 00 84 00 8A 00 93 00 9C
0A9D: 00 9F 00 9F 00 AE 00 B6 00 BC 00 C3 00 C6 00 CA
0AAD: 00 D1 00 D5 00 D8 00 DE 00 E2 00 E5 00 EB 00 EE
0ABD: 00 F1 00 EE 00 FA 00 FD 00 00 01 06 01 09 01 0C
0ACD: 01 12 01 15 01 18 01 1E 01 21 01 24 01 27 01 2D
0ADD: 01 2F 01 27 01 38 01 3A 01 3C 01 3E 01 40 01 45
0AED: 01 46 01 47 01 48 01 49 01 4A 01 4B 01 77 A6 13
0AFD: ED DC A5 7D 34 F1 F1 F1 B9

; stamp the four fixed pieces of the copyright caption into the display-
; list shadow; it reads nothing, so re-stamping changes nothing
stampCopyrightStrip:
0B06: FD 21 10 AA     LD      IY,$AA10            
0B0A: 06 04           LD      B,$04               
0B0C: 0E 04           LD      C,$04               
0B0E: 16 A0           LD      D,$A0               
0B10: 1E D8           LD      E,$D8               

loc_0b12:
0B12: FD 72 31        LD      (IY+$31),D          
0B15: FD 73 00        LD      (IY+$00),E          
0B18: FD 71 01        LD      (IY+$01),C          
0B1B: FD 36 30 6C     LD      (IY+$30),$6C        
0B1F: FD 23           INC     IY                  
0B21: FD 23           INC     IY                  
0B23: 0C              INC     C                   
0B24: 7A              LD      A,D                 
0B25: D6 10           SUB     $10                 
0B27: 57              LD      D,A                 
0B28: 10 E8           DJNZ    $0B12               ; {code.loc_0b12}
0B2A: C9              RET                         

; park the four sprites of the copyright caption above the first visible
; line by zeroing the vertical byte of each, leaving the rest of their
; slots standing
hideCaptionSprites:
0B2B: 21 41 AA        LD      HL,$AA41            
0B2E: 11 02 00        LD      DE,$0002            
0B31: 06 04           LD      B,$04               
0B33: AF              XOR     A                   

loc_0b34:
0B34: 77              LD      (HL),A              
0B35: 19              ADD     HL,DE               
0B36: 10 FC           DJNZ    $0B34               ; {code.loc_0b34}
0B38: C9              RET                         

; make the copyright line change colour every frame: ask for the same
; glyph run at the same place in one of two colours, choosing between them
; on the low bit of the frame counter, which it only reads. The request
; goes on the command ring and is dropped when the slot the write cursor
; names has not been consumed, so a frame can silently miss its turn
flashCopyrightLine:
0B39: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
0B3C: CB 47           BIT     0,A                 
0B3E: 28 06           JR      Z,$0B46             ; {code.enqueueFixedCommandOnRing}
0B40: 11 00 01        LD      DE,$0100            
0B43: C3 38 00        JP      $0038               ; {code.postCommand}

; queue one fixed command, with its one fixed argument, in the command
; ring -- both bytes are chosen here and whatever the caller held is
; discarded; the pair is dropped when the slot the write cursor names has
; not been consumed, and this entry never learns that
enqueueFixedCommandOnRing:
0B46: 11 1F 01        LD      DE,$011F            
0B49: C3 38 00        JP      $0038               ; {code.postCommand}

; add a run of bytes together and answer whether the total is the byte the
; caller named; the length means a full 256 when it is zero, the total
; wraps at eight bits, nothing is written, and the answer is left for the
; caller rather than acted on here
sumByteRunAndCompareToExpected:
0B4C: AF              XOR     A                   

loc_0b4d:
0B4D: 86              ADD     A,(HL)              
0B4E: 23              INC     HL                  
0B4F: 10 FC           DJNZ    $0B4D               ; {code.loc_0b4d}
0B51: B9              CP      C                   
0B52: C8              RET     Z                   
0B53: C9              RET                         

; ---- $0B54-$0B8F: data ----
0B54: AF AE 23 10 FC B9 C8 C3 00 00 AF 86 23 0D 28 02
0B64: 18 F9 CB 47 C8 C3 00 00 21 06 0B 06 24 0E 00 7E
0B74: 91 23 10 FB EB BE C9 0F A7 13 88 0D ED C4 F1 ED
0B84: DC A5 D7 DC F1 8C 0D DC DC 68 3B B9

; tail transfer into the foreground command-ring loop: a jp that hands
; control to the drain and never comes back; touches no memory or
; register, so its whole product is the drain's continuation handed
; straight back
enterCommandRingDrain:
0B90: C3 93 0B        JP      $0B93               ; {code.runCommandRingDrainLoop}

; the foreground loop: take commands off the ring one at a time and run
; each, for ever. A read cursor names a cell; while its high bit is set
; the cell holds nothing and the loop looks again, which is the only wait
; for the vblank among the foreground loops a coin-and-play tape reaches
; -- the ring is refilled from outside the loop. An occupied cell gives up
; a command byte and an argument byte, both cells are freed BEFORE the
; command runs so a command may reuse the pair it arrived in, and the low
; nibble of the command indexes a sixteen-way table. Where the handler
; lands is the exit test: it is handed one fixed place to come back to,
; and anything else means it has taken the machine somewhere this loop no
; longer owns
runCommandRingDrainLoop:
0B93: 26 AC           LD      H,$AC               
0B95: 3A B3 A9        LD      A,($A9B3)           ; {hard.workRam+1B3}
0B98: 6F              LD      L,A                 
0B99: 7E              LD      A,(HL)              
0B9A: 07              RLCA                        
0B9B: DA 90 0B        JP      C,$0B90             ; {code.enterCommandRingDrain}
0B9E: 4E              LD      C,(HL)              
0B9F: 36 FF           LD      (HL),$FF            
0BA1: 23              INC     HL                  
0BA2: 46              LD      B,(HL)              
0BA3: 36 FF           LD      (HL),$FF            
0BA5: 23              INC     HL                  
0BA6: 7D              LD      A,L                 
0BA7: E6 3F           AND     $3F                 
0BA9: 32 B3 A9        LD      ($A9B3),A           ; {hard.workRam+1B3}
0BAC: 79              LD      A,C                 
0BAD: E6 0F           AND     $0F                 
0BAF: 21 BC 0B        LD      HL,$0BBC            
0BB2: CD 8C 01        CALL    $018C               ; {code.fetchWideTableWord}
0BB5: 78              LD      A,B                 
0BB6: 21 90 0B        LD      HL,$0B90            
0BB9: E5              PUSH    HL                  
0BBA: EB              EX      DE,HL               
0BBB: E9              JP      (HL)                

; ---- $0BBC-$0BF1: data ----
0BBC: DD 0B F2 0B 0F 0C 39 0C 90 0C 72 4D D7 0D AC 0E
0BCC: DC 0B DC 0B 21 34 23 0C DC 0B DC 0B DC 0B DC 0B
0BDC: C9 21 50 0C CD 8C 01 EB 5E 23 56 23 23 7E FE B9
0BEC: C8 12 23 E7 18 F7

; paint the caption an index selects: the index picks a record from one
; word table, and the record supplies the destination cell, the colour and
; the glyph run that drawTextRun then paints
drawTextRunByIndex:
0BF2: 21 50 0C        LD      HL,$0C50            
0BF5: CD 8C 01        CALL    $018C               ; {code.fetchWideTableWord}
0BF8: EB              EX      DE,HL               
0BF9: 5E              LD      E,(HL)              
0BFA: 23              INC     HL                  
0BFB: 56              LD      D,(HL)              
0BFC: 23              INC     HL                  
0BFD: 4E              LD      C,(HL)              
0BFE: 23              INC     HL                  

; paint one caption into the character plane and give every cell of it one
; colour, taking glyphs in order from a run that ends at a fixed
; terminating code
drawTextRun:
0BFF: 7E              LD      A,(HL)              
0C00: FE B9           CP      $B9                 
0C02: C8              RET     Z                   
0C03: 12              LD      (DE),A              
0C04: CB 92           RES     2,D                 
0C06: 79              LD      A,C                 
0C07: 12              LD      (DE),A              
0C08: CB D2           SET     2,D                 
0C0A: 23              INC     HL                  
0C0B: E7              RST     $20                 
0C0C: C3 FF 0B        JP      $0BFF               ; {code.drawTextRun}

; ---- $0C0F-$0D6A: data ----
0C0F: 21 50 0C CD 8C 01 EB 5E 23 56 23 23 3A 0C AD E6
0C1F: 0F 4F 18 DC 21 50 0C CD 8C 01 EB 5E 23 56 23 23
0C2F: 3A 0C AD C6 0A E6 0F 4F 18 C6 21 50 0C CD 8C 01
0C3F: EB 5E 23 56 23 23 7E FE B9 C8 3E F1 12 23 E7 18
0C4F: F5 6B 08 73 16 7F 30 1D 58 FA 49 D6 15 4C 58 09
0C5F: 25 CA 15 67 01 42 4E 10 18 CE 48 A4 1B FA 0A 31
0C6F: 24 3B 12 9B 45 A4 2C 4F 00 9E 31 6E 29 7B 0B 5C
0C7F: 34 D2 3E 48 33 49 0F 14 4C 54 59 ED 55 D8 23 00
0C8F: 49 4F 06 00 3A 30 AD A7 CA E8 0C 79 A7 CA E9 0C
0C9F: 21 27 0D 09 09 09 11 33 AD 3A 32 AD A7 28 03 11
0CAF: 36 AD 1A 86 27 12 13 23 1A 8E 27 12 13 23 1A 8E
0CBF: 27 12 21 8D A9 01 03 00 1A BE 38 0F 20 07 1B 2B
0CCF: 0D 20 F5 18 06 EB ED B8 CD 6B 0D 3A 32 AD A7 20
0CDF: 05 CD 57 0D 18 03 CD 61 0D C9 3A 31 AD A7 20 1B
0CEF: 3A 31 0B CD F2 0B CD 57 0D 3A C6 15 CD 39 0C 11
0CFF: 01 A5 06 06 3E F1 12 E7 10 FA C9 3E 06 CD F2 0B
0D0F: CD 57 0D 3E 07 CD F2 0B CD 61 0D C9 3C A2 C7 AC
0D1F: 7C A2 43 AB FC A1 BE AC 00 00 00 00 01 00 00 02
0D2F: 00 00 03 00 00 04 00 00 05 00 00 06 00 00 07 00
0D3F: 00 08 00 00 09 00 00 10 00 00 15 00 00 20 00 00
0D4F: 30 00 00 40 00 00 50 00 11 81 A7 21 35 AD 0E 10
0D5F: 18 12 11 01 A5 21 38 AD 0E 10 18 08

; enter the shared packed-decimal digit routine at 0x0D73 with a third
; fixed triple -- first cell 0xA641, the field whose high end is 0xA98D,
; and a fixed colour; the routine walks the field downward, so the high
; end is where it starts
paintHighScoreReadout:
0D6B: 11 41 A6        LD      DE,$A641            
0D6E: 21 8D A9        LD      HL,$A98D            
0D71: 0E 10           LD      C,$10               

; paint a six-digit field: two packed bytes through the suppressing
; painter, sharing one suppression flag this entry clears, then a third
; through the plain painter so the last two digits always show, walking
; the source pointer backwards as it goes
paintSixDigitFieldSuppressingLeadingZeros:
0D73: 06 00           LD      B,$00               
0D75: CD A0 0D        CALL    $0DA0               ; {code.paintTwoSuppressedDigitsFromByte}
0D78: 2B              DEC     HL                  
0D79: CD A0 0D        CALL    $0DA0               ; {code.paintTwoSuppressedDigitsFromByte}
0D7C: 2B              DEC     HL                  
0D7D: CD 81 0D        CALL    $0D81               ; {code.paintTwoUnsuppressedDigitsFromByte}
0D80: C9              RET                         

; paint the two decimal digits packed into one byte, the high one first,
; stepping the cursor one cell on after each; the byte is read twice from
; the pointer the caller is walking, shifted down for the high digit and
; taken whole for the low, and the colour and cursor arrive as the caller
; left them
paintTwoUnsuppressedDigitsFromByte:
0D81: 7E              LD      A,(HL)              
0D82: 0F              RRCA                        
0D83: 0F              RRCA                        
0D84: 0F              RRCA                        
0D85: 0F              RRCA                        
0D86: CD 90 0D        CALL    $0D90               ; {code.paintUnsuppressedDigit}
0D89: E7              RST     $20                 
0D8A: 7E              LD      A,(HL)              
0D8B: CD 90 0D        CALL    $0D90               ; {code.paintUnsuppressedDigit}
0D8E: E7              RST     $20                 
0D8F: C9              RET                         

; paint one decimal digit and the caller's colour into the cell a cursor
; names, taking the glyph from the table at 0x0DCC by the value's low four
; bits -- a zero always paints the digit `0`, where the suppressing twin
; paints the blank instead while no significant digit has been seen yet --
; and leaving the cursor on the glyph side and the caller's run pointer
; where it was
paintUnsuppressedDigit:
0D90: E6 0F           AND     $0F                 
0D92: E5              PUSH    HL                  
0D93: 21 CC 0D        LD      HL,$0DCC            
0D96: CF              RST     $08                 
0D97: E1              POP     HL                  
0D98: 12              LD      (DE),A              
0D99: CB 92           RES     2,D                 
0D9B: 79              LD      A,C                 
0D9C: 12              LD      (DE),A              
0D9D: CB D2           SET     2,D                 
0D9F: C9              RET                         

; paint the two decimal digits packed into one byte with a leading zero
; suppressed, the high one first, stepping the cursor one cell on after
; each; the caller's suppression flag arrives, carries across both digits
; and goes back out, so a longer run of digits suppresses as one field
paintTwoSuppressedDigitsFromByte:
0DA0: 7E              LD      A,(HL)              
0DA1: 0F              RRCA                        
0DA2: 0F              RRCA                        
0DA3: 0F              RRCA                        
0DA4: 0F              RRCA                        
0DA5: CD AF 0D        CALL    $0DAF               ; {code.paintSuppressedDigit}
0DA8: E7              RST     $20                 
0DA9: 7E              LD      A,(HL)              
0DAA: CD AF 0D        CALL    $0DAF               ; {code.paintSuppressedDigit}
0DAD: E7              RST     $20                 
0DAE: C9              RET                         

; paint one four-bit digit into the cell the cursor names with the
; caller's colour a plane below, using the blank glyph instead when the
; digit is zero and no significant digit has been seen yet, and stepping
; the caller's flag on at the first that is
paintSuppressedDigit:
0DAF: E6 0F           AND     $0F                 
0DB1: 28 03           JR      Z,$0DB6             ; {code.loc_0db6}
0DB3: 04              INC     B                   
0DB4: 18 08           JR      $0DBE               ; {code.loc_0dbe}

loc_0db6:
0DB6: 3A 46 32        LD      A,($3246)           ; {hard.rom+3246}
0DB9: 04              INC     B                   
0DBA: 05              DEC     B                   
0DBB: 28 01           JR      Z,$0DBE             ; {code.loc_0dbe}
0DBD: AF              XOR     A                   

loc_0dbe:
0DBE: E5              PUSH    HL                  
0DBF: 21 CC 0D        LD      HL,$0DCC            
0DC2: CF              RST     $08                 
0DC3: E1              POP     HL                  
0DC4: 12              LD      (DE),A              
0DC5: CB 92           RES     2,D                 
0DC7: 79              LD      A,C                 
0DC8: 12              LD      (DE),A              
0DC9: CB D2           SET     2,D                 
0DCB: C9              RET                         

; ---- $0DCC-$0DD6: data ----
0DCC: 13 96 9B CD F3 7F 65 02 17 5D F1

; draw a clamped 0..99 value as a right-to-left row of denomination tiles
; (thirties, tens, fives, ones) from display cell 0xa463, pad the rest of
; the row to 0xa623 with the blank glyph, then verify a fixed three-word
; checksum (0x009d/0x00a0/0x00a3) and hard-reset via 0x0000 on mismatch
drawCountAsPictogramStrip:
0DD7: 11 63 A4        LD      DE,$A463            
0DDA: FE 64           CP      $64                 
0DDC: 38 02           JR      C,$0DE0             ; {code.loc_0de0}
0DDE: 3E 63           LD      A,$63               

loc_0de0:
0DE0: D9              EXX                         
0DE1: 06 00           LD      B,$00               

loc_0de3:
0DE3: D6 1E           SUB     $1E                 
0DE5: 38 03           JR      C,$0DEA             ; {code.loc_0dea}
0DE7: 04              INC     B                   
0DE8: 18 F9           JR      $0DE3               ; {code.loc_0de3}

loc_0dea:
0DEA: C6 1E           ADD     A,$1E               
0DEC: 0E 00           LD      C,$00               

loc_0dee:
0DEE: D6 0A           SUB     $0A                 
0DF0: 38 03           JR      C,$0DF5             ; {code.loc_0df5}
0DF2: 0C              INC     C                   
0DF3: 18 F9           JR      $0DEE               ; {code.loc_0dee}

loc_0df5:
0DF5: C6 0A           ADD     A,$0A               
0DF7: 16 00           LD      D,$00               

loc_0df9:
0DF9: D6 05           SUB     $05                 
0DFB: 38 03           JR      C,$0E00             ; {code.loc_0e00}
0DFD: 14              INC     D                   
0DFE: 18 F9           JR      $0DF9               ; {code.loc_0df9}

loc_0e00:
0E00: C6 05           ADD     A,$05               
0E02: 5F              LD      E,A                 
0E03: D9              EXX                         
0E04: D9              EXX                         
0E05: 7B              LD      A,E                 
0E06: D9              EXX                         
0E07: A7              AND     A                   
0E08: 28 0C           JR      Z,$0E16             ; {code.loc_0e16}
0E0A: 06 01           LD      B,$01               
0E0C: 0E 13           LD      C,$13               

loc_0e0e:
0E0E: 08              EX      AF,AF'              
0E0F: CD 8D 0E        CALL    $0E8D               ; {code.drawSlotWithOneGlyph}
0E12: 08              EX      AF,AF'              
0E13: 3D              DEC     A                   
0E14: 20 F8           JR      NZ,$0E0E            ; {code.loc_0e0e}

loc_0e16:
0E16: D9              EXX                         
0E17: 7A              LD      A,D                 
0E18: D9              EXX                         
0E19: A7              AND     A                   
0E1A: 28 0C           JR      Z,$0E28             ; {code.loc_0e28}
0E1C: 06 32           LD      B,$32               
0E1E: 0E 11           LD      C,$11               

loc_0e20:
0E20: 08              EX      AF,AF'              
0E21: CD 9C 0E        CALL    $0E9C               ; {code.paintDoubleTile}
0E24: 08              EX      AF,AF'              
0E25: 3D              DEC     A                   
0E26: 20 F8           JR      NZ,$0E20            ; {code.loc_0e20}

loc_0e28:
0E28: D9              EXX                         
0E29: 79              LD      A,C                 
0E2A: D9              EXX                         
0E2B: A7              AND     A                   
0E2C: 28 0C           JR      Z,$0E3A             ; {code.loc_0e3a}
0E2E: 06 CE           LD      B,$CE               
0E30: 0E 16           LD      C,$16               

loc_0e32:
0E32: 08              EX      AF,AF'              
0E33: CD 70 0E        CALL    $0E70               ; {code.paintQuadTile}
0E36: 08              EX      AF,AF'              
0E37: 3D              DEC     A                   
0E38: 20 F8           JR      NZ,$0E32            ; {code.loc_0e32}

loc_0e3a:
0E3A: D9              EXX                         
0E3B: 78              LD      A,B                 
0E3C: D9              EXX                         
0E3D: A7              AND     A                   
0E3E: 28 0C           JR      Z,$0E4C             ; {code.loc_0e4c}
0E40: 06 23           LD      B,$23               
0E42: 0E 11           LD      C,$11               

loc_0e44:
0E44: 08              EX      AF,AF'              
0E45: CD 70 0E        CALL    $0E70               ; {code.paintQuadTile}
0E48: 08              EX      AF,AF'              
0E49: 3D              DEC     A                   
0E4A: 20 F8           JR      NZ,$0E44            ; {code.loc_0e44}

loc_0e4c:
0E4C: 01 10 F1        LD      BC,$F110            

loc_0e4f:
0E4F: 21 DD 59        LD      HL,$59DD            
0E52: 19              ADD     HL,DE               
0E53: 38 05           JR      C,$0E5A             ; {code.loc_0e5a}
0E55: CD 8D 0E        CALL    $0E8D               ; {code.drawSlotWithOneGlyph}
0E58: 18 F5           JR      $0E4F               ; {code.loc_0e4f}

loc_0e5a:
0E5A: AF              XOR     A                   
0E5B: 2A A0 00        LD      HL,($00A0)          ; {hard.rom+A0}
0E5E: ED 5B A3 00     LD      DE,($00A3)          ; {hard.rom+A3}

loc_0e62:
0E62: ED 4B 9D 00     LD      BC,($009D)          ; {hard.rom+9D}

loc_0e66:
0E66: 19              ADD     HL,DE               
0E67: 09              ADD     HL,BC               
0E68: 85              ADD     A,L                 
0E69: 84              ADD     A,H                 
0E6A: D6 69           SUB     $69                 
0E6C: C2 00 00        JP      NZ,$0000            ; {code.loc_0000}
0E6F: C9              RET                         

; lay one four-tile block into the character plane from a base code the
; caller fixes, give all four the caller's colour a plane below, and leave
; the cursor clear of the block for the next one
paintQuadTile:
0E70: 78              LD      A,B                 
0E71: 3C              INC     A                   
0E72: 12              LD      (DE),A              
0E73: 3D              DEC     A                   
0E74: 1B              DEC     DE                  
0E75: 12              LD      (DE),A              
0E76: EF              RST     $28                 
0E77: 78              LD      A,B                 
0E78: C6 02           ADD     A,$02               
0E7A: 12              LD      (DE),A              
0E7B: 3C              INC     A                   
0E7C: 13              INC     DE                  
0E7D: 12              LD      (DE),A              
0E7E: 21 00 FC        LD      HL,$FC00            
0E81: 19              ADD     HL,DE               
0E82: EF              RST     $28                 
0E83: 71              LD      (HL),C              
0E84: 2B              DEC     HL                  
0E85: 71              LD      (HL),C              
0E86: EB              EX      DE,HL               
0E87: E7              RST     $20                 
0E88: EB              EX      DE,HL               
0E89: 71              LD      (HL),C              
0E8A: 23              INC     HL                  
0E8B: 71              LD      (HL),C              
0E8C: C9              RET                         

; paint a two-cell character slot with a single glyph, blanking the other
; cell of the slot, give both the caller's colour, and step the cursor on
; to the next slot
drawSlotWithOneGlyph:
0E8D: EB              EX      DE,HL               
0E8E: 70              LD      (HL),B              
0E8F: 2B              DEC     HL                  
0E90: 36 F1           LD      (HL),$F1            
0E92: CB 94           RES     2,H                 
0E94: 71              LD      (HL),C              
0E95: 23              INC     HL                  
0E96: 71              LD      (HL),C              
0E97: CB D4           SET     2,H                 
0E99: EB              EX      DE,HL               
0E9A: EF              RST     $28                 
0E9B: C9              RET                         

; lay one two-tile block into the character plane from a base code the
; caller fixes -- the base below the cursor and the base plus one at it --
; colour both cells a plane below, and step the cursor clear of the block
paintDoubleTile:
0E9C: EB              EX      DE,HL               
0E9D: 04              INC     B                   
0E9E: 70              LD      (HL),B              
0E9F: 05              DEC     B                   
0EA0: 2B              DEC     HL                  
0EA1: 70              LD      (HL),B              
0EA2: CB 94           RES     2,H                 
0EA4: 71              LD      (HL),C              
0EA5: 23              INC     HL                  
0EA6: 71              LD      (HL),C              
0EA7: CB D4           SET     2,H                 
0EA9: EB              EX      DE,HL               
0EAA: EF              RST     $28                 
0EAB: C9              RET                         

; ---- $0EAC-$0F10: data ----
0EAC: 3A 01 AD FE 64 D0 3E 0E CD 0F 0C EF EF 21 01 AD
0EBC: 06 01 3A 0C AD 4F C5 0E 00 7E D6 0A 38 03 0C 18
0ECC: F9 C6 0A 08 79 C1 CD EB 0E E7 08 CD EB 0E E7 11
0EDC: 48 17 01 8C 10 1A 81 4F 13 10 FA C2 09 25 C9 E6
0EEC: 0F 28 10 06 00 E5 21 06 0F CF E1 12 CB 92 79 12
0EFC: CB D2 C9 78 A7 28 EE 05 EF C9 E3 49 A8 64 27 AE
0F0C: 42 B0 D5 86 F1

; advance the outer sequence phase and restart its inner step index at
; zero
advanceSequencePhase:
0F11: 21 AB A9        LD      HL,$A9AB            
0F14: 34              INC     (HL)                
0F15: AF              XOR     A                   
0F16: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
0F19: C9              RET                         

; step the jump-table sequence index on by one; reached as a tail jump so
; the caller's own return carries it
advanceSequenceSubStep:
0F1A: 21 AC A9        LD      HL,$A9AC            
0F1D: 34              INC     (HL)                
0F1E: C9              RET                         

; the inner level of the two-level sequence machine for one outer mode:
; run the arm the LOW NIBBLE of the inner index selects out of a sixteen-
; word table laid inline just after this entry, then one fixed block; the
; arm returns through a slot this entry parks for it
dispatchSequenceSubStepArm:
0F1F: 21 54 0F        LD      HL,$0F54            
0F22: E5              PUSH    HL                  
0F23: 3A AC A9        LD      A,($A9AC)           ; {hard.workRam+1AC}
0F26: E6 0F           AND     $0F                 
0F28: F7              RST     $30                 

; ---- $0F29-$0F48: jump table ----
0F29: B1 27 5E 33 D7 5B 75 4C 74 07 AF 16 94 56 99 11
0F39: 0B 33 B4 08 C3 18 E2 12 FB 12 0F 4A 23 13 B5 15

; ---- $0F49-$0F53: data ----
0F49: 73 A6 14 7E 29 F8 96 5D 96 13 B9

; guarded tail of the phase-3 image-service step, reached as
; dispatchSequenceSubStepArm's pushed continuation: returns while the
; play-active flag (0xAD30) is set; on a nonzero credit count (0xA986) it
; zeroes the sequence sub-step (0xA9AC) and reloads the phase (0xA9AB)
; from the ROM constant at 0x1736; otherwise, only when the free-play flag
; (0xA9C0) is set and one of two input bits (0xA9AE & 0x18) is held, it
; zero-fills the work table 0x15b6 clears and tail-calls loc_1690
advanceAttractTowardGameStart:
0F54: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
0F57: A7              AND     A                   
0F58: C0              RET     NZ                  
0F59: 3A 86 A9        LD      A,($A986)           ; {hard.workRam+186}
0F5C: A7              AND     A                   
0F5D: 20 11           JR      NZ,$0F70            ; {code.loc_0f70}
0F5F: 3A C0 A9        LD      A,($A9C0)           ; {hard.workRam+1C0}
0F62: A7              AND     A                   
0F63: C8              RET     Z                   
0F64: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
0F67: E6 18           AND     $18                 
0F69: C8              RET     Z                   
0F6A: CD B6 15        CALL    $15B6               ; {code.hideAllSprites}
0F6D: C3 90 16        JP      $1690               ; {code.startGameOnFreePlay}

loc_0f70:
0F70: AF              XOR     A                   
0F71: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
0F74: 3A 36 17        LD      A,($1736)           ; {hard.rom+1736}
0F77: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
0F7A: C9              RET                         

; copy the four-byte record an index selects out of a fixed table and into
; the four cells that hold the difficulty settings in force; scaling the
; index by the record width is done as a BYTE, so an index of sixty-four
; or more selects a record a wider multiply would not
loadDifficultyRecord:
0F7B: 87              ADD     A,A                 
0F7C: 87              ADD     A,A                 
0F7D: 21 6A 18        LD      HL,$186A            
0F80: 11 D3 A9        LD      DE,$A9D3            
0F83: DF              RST     $18                 
0F84: ED A0           LDI                         
0F86: ED A0           LDI                         
0F88: ED A0           LDI                         
0F8A: ED A0           LDI                         
0F8C: C9              RET                         

loc_0f8d:
0F8D: F1              POP     AF                  
0F8E: 01 F1 02        LD      BC,$02F1            
0F91: F1              POP     AF                  
0F92: 03              INC     BC                  
0F93: F1              POP     AF                  
0F94: 04              INC     B                   
0F95: F1              POP     AF                  
0F96: 05              DEC     B                   

; scanline-gated sprite position fixup over 8 slots: for each slot whose Y
; byte (sprite bank 1) has bit 7 set and whose Y + scanline counter
; carries, clears bit 7 of that Y byte and toggles bit 7 of the paired X
; byte (sprite bank 0)
multiplexSpriteSlotsSkipping:
0F97: 3A 11 B4        LD      A,($B411)           
0F9A: CB 7F           BIT     7,A                 
0F9C: 28 19           JR      Z,$0FB7             ; {code.loc_0fb7}
0F9E: 4F              LD      C,A                 
0F9F: 3A 00 C0        LD      A,($C000)           
0FA2: 81              ADD     A,C                 
0FA3: 30 12           JR      NC,$0FB7            ; {code.loc_0fb7}
0FA5: 23              INC     HL                  
0FA6: 23              INC     HL                  
0FA7: 2B              DEC     HL                  
0FA8: 2B              DEC     HL                  
0FA9: 79              LD      A,C                 
0FAA: E6 7F           AND     $7F                 
0FAC: 32 11 B4        LD      ($B411),A           
0FAF: 3A 10 B0        LD      A,($B010)           
0FB2: C6 80           ADD     A,$80               
0FB4: 32 10 B0        LD      ($B010),A           

loc_0fb7:
0FB7: 3A 13 B4        LD      A,($B413)           
0FBA: CB 7F           BIT     7,A                 
0FBC: 28 19           JR      Z,$0FD7             ; {code.loc_0fd7}
0FBE: 4F              LD      C,A                 
0FBF: 3A 00 C0        LD      A,($C000)           
0FC2: 81              ADD     A,C                 
0FC3: 30 12           JR      NC,$0FD7            ; {code.loc_0fd7}
0FC5: 23              INC     HL                  
0FC6: 23              INC     HL                  
0FC7: 2B              DEC     HL                  
0FC8: 2B              DEC     HL                  
0FC9: 79              LD      A,C                 
0FCA: E6 7F           AND     $7F                 
0FCC: 32 13 B4        LD      ($B413),A           
0FCF: 3A 12 B0        LD      A,($B012)           
0FD2: C6 80           ADD     A,$80               
0FD4: 32 12 B0        LD      ($B012),A           

loc_0fd7:
0FD7: 3A 15 B4        LD      A,($B415)           
0FDA: CB 7F           BIT     7,A                 
0FDC: 28 19           JR      Z,$0FF7             ; {code.loc_0ff7}
0FDE: 4F              LD      C,A                 
0FDF: 3A 00 C0        LD      A,($C000)           
0FE2: 81              ADD     A,C                 
0FE3: 30 12           JR      NC,$0FF7            ; {code.loc_0ff7}
0FE5: 23              INC     HL                  
0FE6: 23              INC     HL                  
0FE7: 2B              DEC     HL                  
0FE8: 2B              DEC     HL                  
0FE9: 79              LD      A,C                 
0FEA: E6 7F           AND     $7F                 
0FEC: 32 15 B4        LD      ($B415),A           
0FEF: 3A 14 B0        LD      A,($B014)           
0FF2: C6 80           ADD     A,$80               
0FF4: 32 14 B0        LD      ($B014),A           

loc_0ff7:
0FF7: 3A 37 B4        LD      A,($B437)           
0FFA: CB 7F           BIT     7,A                 
0FFC: 28 19           JR      Z,$1017             ; {code.loc_1017}
0FFE: 4F              LD      C,A                 
0FFF: 3A 00 C0        LD      A,($C000)           
1002: 81              ADD     A,C                 
1003: 30 12           JR      NC,$1017            ; {code.loc_1017}
1005: 23              INC     HL                  
1006: 23              INC     HL                  
1007: 2B              DEC     HL                  
1008: 2B              DEC     HL                  
1009: 79              LD      A,C                 
100A: E6 7F           AND     $7F                 
100C: 32 37 B4        LD      ($B437),A           
100F: 3A 36 B0        LD      A,($B036)           
1012: C6 80           ADD     A,$80               
1014: 32 36 B0        LD      ($B036),A           

loc_1017:
1017: 3A 39 B4        LD      A,($B439)           
101A: CB 7F           BIT     7,A                 
101C: 28 19           JR      Z,$1037             ; {code.loc_1037}
101E: 4F              LD      C,A                 
101F: 3A 00 C0        LD      A,($C000)           
1022: 81              ADD     A,C                 
1023: 30 12           JR      NC,$1037            ; {code.loc_1037}
1025: 23              INC     HL                  
1026: 23              INC     HL                  
1027: 2B              DEC     HL                  
1028: 2B              DEC     HL                  
1029: 79              LD      A,C                 
102A: E6 7F           AND     $7F                 
102C: 32 39 B4        LD      ($B439),A           
102F: 3A 38 B0        LD      A,($B038)           
1032: C6 80           ADD     A,$80               
1034: 32 38 B0        LD      ($B038),A           

loc_1037:
1037: 3A 3B B4        LD      A,($B43B)           
103A: CB 7F           BIT     7,A                 
103C: 28 19           JR      Z,$1057             ; {code.loc_1057}
103E: 4F              LD      C,A                 
103F: 3A 00 C0        LD      A,($C000)           
1042: 81              ADD     A,C                 
1043: 30 12           JR      NC,$1057            ; {code.loc_1057}
1045: 23              INC     HL                  
1046: 23              INC     HL                  
1047: 2B              DEC     HL                  
1048: 2B              DEC     HL                  
1049: 79              LD      A,C                 
104A: E6 7F           AND     $7F                 
104C: 32 3B B4        LD      ($B43B),A           
104F: 3A 3A B0        LD      A,($B03A)           
1052: C6 80           ADD     A,$80               
1054: 32 3A B0        LD      ($B03A),A           

loc_1057:
1057: 3A 3D B4        LD      A,($B43D)           
105A: CB 7F           BIT     7,A                 
105C: 28 19           JR      Z,$1077             ; {code.loc_1077}
105E: 4F              LD      C,A                 
105F: 3A 00 C0        LD      A,($C000)           
1062: 81              ADD     A,C                 
1063: 30 12           JR      NC,$1077            ; {code.loc_1077}
1065: 23              INC     HL                  
1066: 23              INC     HL                  
1067: 2B              DEC     HL                  
1068: 2B              DEC     HL                  
1069: 79              LD      A,C                 
106A: E6 7F           AND     $7F                 
106C: 32 3D B4        LD      ($B43D),A           
106F: 3A 3C B0        LD      A,($B03C)           
1072: C6 80           ADD     A,$80               
1074: 32 3C B0        LD      ($B03C),A           

loc_1077:
1077: 3A 3F B4        LD      A,($B43F)           
107A: CB 7F           BIT     7,A                 
107C: 28 19           JR      Z,$1097             ; {code.loc_1097}
107E: 4F              LD      C,A                 
107F: 3A 00 C0        LD      A,($C000)           
1082: 81              ADD     A,C                 
1083: 30 12           JR      NC,$1097            ; {code.loc_1097}
1085: 23              INC     HL                  
1086: 23              INC     HL                  
1087: 2B              DEC     HL                  
1088: 2B              DEC     HL                  
1089: 79              LD      A,C                 
108A: E6 7F           AND     $7F                 
108C: 32 3F B4        LD      ($B43F),A           
108F: 3A 3E B0        LD      A,($B03E)           
1092: C6 80           ADD     A,$80               
1094: 32 3E B0        LD      ($B03E),A           

loc_1097:
1097: C9              RET                         

; wait until the raster has passed each of eight scenery slots, then move
; that slot half a screen in both axes so the same sprite shows twice in
; one frame; a slot whose request bit is clear is left alone
multiplexSpriteSlots:
1098: 3A 11 B4        LD      A,($B411)           
109B: CB 7F           BIT     7,A                 
109D: 28 19           JR      Z,$10B8             ; {code.loc_10b8}
109F: 4F              LD      C,A                 
10A0: 3A 00 C0        LD      A,($C000)           
10A3: 81              ADD     A,C                 
10A4: 30 F2           JR      NC,$1098            ; {code.multiplexSpriteSlots}
10A6: 23              INC     HL                  
10A7: 23              INC     HL                  
10A8: 2B              DEC     HL                  
10A9: 2B              DEC     HL                  
10AA: 79              LD      A,C                 
10AB: E6 7F           AND     $7F                 
10AD: 32 11 B4        LD      ($B411),A           
10B0: 3A 10 B0        LD      A,($B010)           
10B3: C6 80           ADD     A,$80               
10B5: 32 10 B0        LD      ($B010),A           

loc_10b8:
10B8: 3A 13 B4        LD      A,($B413)           
10BB: CB 7F           BIT     7,A                 
10BD: 28 19           JR      Z,$10D8             ; {code.loc_10d8}
10BF: 4F              LD      C,A                 
10C0: 3A 00 C0        LD      A,($C000)           
10C3: 81              ADD     A,C                 
10C4: 30 F2           JR      NC,$10B8            ; {code.loc_10b8}
10C6: 23              INC     HL                  
10C7: 23              INC     HL                  
10C8: 2B              DEC     HL                  
10C9: 2B              DEC     HL                  
10CA: 79              LD      A,C                 
10CB: E6 7F           AND     $7F                 
10CD: 32 13 B4        LD      ($B413),A           
10D0: 3A 12 B0        LD      A,($B012)           
10D3: C6 80           ADD     A,$80               
10D5: 32 12 B0        LD      ($B012),A           

loc_10d8:
10D8: 3A 15 B4        LD      A,($B415)           
10DB: CB 7F           BIT     7,A                 
10DD: 28 19           JR      Z,$10F8             ; {code.loc_10f8}
10DF: 4F              LD      C,A                 
10E0: 3A 00 C0        LD      A,($C000)           
10E3: 81              ADD     A,C                 
10E4: 30 F2           JR      NC,$10D8            ; {code.loc_10d8}
10E6: 23              INC     HL                  
10E7: 23              INC     HL                  
10E8: 2B              DEC     HL                  
10E9: 2B              DEC     HL                  
10EA: 79              LD      A,C                 
10EB: E6 7F           AND     $7F                 
10ED: 32 15 B4        LD      ($B415),A           
10F0: 3A 14 B0        LD      A,($B014)           
10F3: C6 80           ADD     A,$80               
10F5: 32 14 B0        LD      ($B014),A           

loc_10f8:
10F8: 3A 37 B4        LD      A,($B437)           
10FB: CB 7F           BIT     7,A                 

; reused subroutine entry into the five-slot display-list split pass,
; joined inside the first slot: trades the first slot from the caller's
; held byte (or, below the raster line, restarts the whole pass and re-
; reads every slot from memory), then trades slots 2-5 wherever their top
; bit is set; live-out memory only
spinRemainingSpriteMultiplexSlots:
10FD: 28 19           JR      Z,$1118             ; {code.loc_1118}
10FF: 4F              LD      C,A                 
1100: 3A 00 C0        LD      A,($C000)           
1103: 81              ADD     A,C                 
1104: 30 F2           JR      NC,$10F8            ; {code.loc_10f8}
1106: 23              INC     HL                  
1107: 23              INC     HL                  
1108: 2B              DEC     HL                  
1109: 2B              DEC     HL                  
110A: 79              LD      A,C                 
110B: E6 7F           AND     $7F                 
110D: 32 37 B4        LD      ($B437),A           
1110: 3A 36 B0        LD      A,($B036)           
1113: C6 80           ADD     A,$80               
1115: 32 36 B0        LD      ($B036),A           

loc_1118:
1118: 3A 39 B4        LD      A,($B439)           
111B: CB 7F           BIT     7,A                 
111D: 28 19           JR      Z,$1138             ; {code.loc_1138}
111F: 4F              LD      C,A                 
1120: 3A 00 C0        LD      A,($C000)           
1123: 81              ADD     A,C                 
1124: 30 F2           JR      NC,$1118            ; {code.loc_1118}
1126: 23              INC     HL                  
1127: 23              INC     HL                  
1128: 2B              DEC     HL                  
1129: 2B              DEC     HL                  
112A: 79              LD      A,C                 
112B: E6 7F           AND     $7F                 
112D: 32 39 B4        LD      ($B439),A           
1130: 3A 38 B0        LD      A,($B038)           
1133: C6 80           ADD     A,$80               
1135: 32 38 B0        LD      ($B038),A           

loc_1138:
1138: 3A 3B B4        LD      A,($B43B)           
113B: CB 7F           BIT     7,A                 
113D: 28 19           JR      Z,$1158             ; {code.loc_1158}
113F: 4F              LD      C,A                 
1140: 3A 00 C0        LD      A,($C000)           
1143: 81              ADD     A,C                 
1144: 30 F2           JR      NC,$1138            ; {code.loc_1138}
1146: 23              INC     HL                  
1147: 23              INC     HL                  
1148: 2B              DEC     HL                  
1149: 2B              DEC     HL                  
114A: 79              LD      A,C                 
114B: E6 7F           AND     $7F                 
114D: 32 3B B4        LD      ($B43B),A           
1150: 3A 3A B0        LD      A,($B03A)           
1153: C6 80           ADD     A,$80               
1155: 32 3A B0        LD      ($B03A),A           

loc_1158:
1158: 3A 3D B4        LD      A,($B43D)           
115B: CB 7F           BIT     7,A                 
115D: 28 19           JR      Z,$1178             ; {code.loc_1178}
115F: 4F              LD      C,A                 
1160: 3A 00 C0        LD      A,($C000)           
1163: 81              ADD     A,C                 
1164: 30 F2           JR      NC,$1158            ; {code.loc_1158}
1166: 23              INC     HL                  
1167: 23              INC     HL                  
1168: 2B              DEC     HL                  
1169: 2B              DEC     HL                  
116A: 79              LD      A,C                 
116B: E6 7F           AND     $7F                 
116D: 32 3D B4        LD      ($B43D),A           
1170: 3A 3C B0        LD      A,($B03C)           
1173: C6 80           ADD     A,$80               
1175: 32 3C B0        LD      ($B03C),A           

loc_1178:
1178: 3A 3F B4        LD      A,($B43F)           
117B: CB 7F           BIT     7,A                 
117D: 28 19           JR      Z,$1198             ; {code.loc_1198}
117F: 4F              LD      C,A                 
1180: 3A 00 C0        LD      A,($C000)           
1183: 81              ADD     A,C                 
1184: 30 F2           JR      NC,$1178            ; {code.loc_1178}
1186: 23              INC     HL                  
1187: 23              INC     HL                  
1188: 2B              DEC     HL                  
1189: 2B              DEC     HL                  
118A: 79              LD      A,C                 
118B: E6 7F           AND     $7F                 
118D: 32 3F B4        LD      ($B43F),A           
1190: 3A 3E B0        LD      A,($B03E)           
1193: C6 80           ADD     A,$80               
1195: 32 3E B0        LD      ($B03E),A           

loc_1198:
1198: C9              RET                         

; the round engine's service list (substep 7 of the phase-3 dispatch at
; 0x0f29; runs per dispatch, short of the frame count): run each subsystem
; service in fixed order, then read the player-state byte at 0xa800 and
; advance the round when it is 0xff (alive), hand a life over when it is 0
; (dead), else return
serviceRoundThenResolvePlayerState:
1199: CD B4 31        CALL    $31B4               ; {code.reaimAndAnimateEnemyCraftOnPhaseTick}
119C: CD DF 1E        CALL    $1EDF               ; {code.dispatchPlayerFrameByState}
119F: CD E3 23        CALL    $23E3               ; {code.fireAndSweepPlayerShots}
11A2: CD AF 36        CALL    $36AF               ; {code.driveEnemyWaveForLifePhase}
11A5: CD 97 0F        CALL    $0F97               ; {code.multiplexSpriteSlotsSkipping}
11A8: CD B3 47        CALL    $47B3               ; {code.runParachutistSlot}
11AB: CD B7 43        CALL    $43B7               ; {code.armMotherShipOrStep}
11AE: CD A1 28        CALL    $28A1               ; {code.stepSevenCraftSlots}
11B1: CD 97 0F        CALL    $0F97               ; {code.multiplexSpriteSlotsSkipping}
11B4: CD BC 2C        CALL    $2CBC               ; {code.runSceneryForEra}
11B7: CD D6 40        CALL    $40D6               ; {code.sweepEra2PlusObjectBank}
11BA: CD 97 0F        CALL    $0F97               ; {code.multiplexSpriteSlotsSkipping}
11BD: CD 5F 3B        CALL    $3B5F               ; {code.serviceEra1BomberObject}
11C0: CD DA 3D        CALL    $3DDA               ; {code.serviceFixedSlotInEra1}
11C3: CD 36 3E        CALL    $3E36               ; {code.stepFourActorSlots}
11C6: CD 97 0F        CALL    $0F97               ; {code.multiplexSpriteSlotsSkipping}
11C9: CD EA 3F        CALL    $3FEA               ; {code.serviceEra0BallisticObjectBank}
11CC: CD 4F 4E        CALL    $4E4F               ; {code.dispatchCollisionPassByEra}
11CF: CD B8 40        CALL    $40B8               ; {code.askForSoundWhileTheGroupIsClear}
11D2: CD 97 0F        CALL    $0F97               ; {code.multiplexSpriteSlotsSkipping}
11D5: CD DE 4D        CALL    $4DDE               ; {code.awardBonusLifeAtScoreMark}
11D8: CD 05 52        CALL    $5205               ; {code.expireHitChain}
11DB: CD 3A 4D        CALL    $4D3A               ; {code.escalateDifficultyRungOnCounterWrap}
11DE: CD 09 08        CALL    $0809               ; {code.drawKillMeter}
11E1: CD 98 10        CALL    $1098               ; {code.multiplexSpriteSlots}
11E4: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
11E7: 3C              INC     A                   
11E8: CA 71 12        JP      Z,$1271             ; {code.advanceRoundWhenFieldCleared}
11EB: 3D              DEC     A                   
11EC: C0              RET     NZ                  

; process a player's death: hide the sprite band, apply a pending round-
; advance when its flag is set, and queue the frame's fixed sound
; requests; then decrement LIVES_REMAINING at the head of the live 16-byte
; context block and checkpoint that block into the active player's save
; slot — on lives reaching zero it tail-calls the game-over banner,
; otherwise, when the other player's saved block still shows lives, it
; flips the active-player index, arms a delay and re-steps the sequence
; for the next life
loseLifeAndHandOver:
11ED: CD B6 15        CALL    $15B6               ; {code.hideAllSprites}
11F0: 3A C6 AC        LD      A,($ACC6)           ; {hard.workRam+4C6}
11F3: A7              AND     A                   
11F4: C4 B8 2D        CALL    NZ,$2DB8            ; {code.startNextRound}
11F7: CD 34 56        CALL    $5634               ; {code.loc_5634}
11FA: 21 00 AD        LD      HL,$AD00            
11FD: 35              DEC     (HL)                
11FE: F5              PUSH    AF                  
11FF: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
1202: A7              AND     A                   
1203: 11 10 AD        LD      DE,$AD10            
1206: 28 03           JR      Z,$120B             ; {code.loc_120b}
1208: 11 20 AD        LD      DE,$AD20            

loc_120b:
120B: 21 00 AD        LD      HL,$AD00            
120E: 01 10 00        LD      BC,$0010            
1211: ED B0           LDIR                        
1213: F1              POP     AF                  
1214: 28 3D           JR      Z,$1253             ; {code.postGameOverBanner}
1216: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
1219: A7              AND     A                   
121A: 21 20 AD        LD      HL,$AD20            
121D: 28 03           JR      Z,$1222             ; {code.loc_1222}
121F: 21 10 AD        LD      HL,$AD10            

loc_1222:
1222: 7E              LD      A,(HL)              
1223: A7              AND     A                   
1224: 28 09           JR      Z,$122F             ; {code.loc_122f}

; give the turn to the other player: flip the one-bit active-player index,
; re-arm the shared sequence delay with a fixed span, and reseat the inner
; sequence index from a byte of the program image; nothing is copied here,
; and the flip is the only effect the skipped arm does not also have
handPlayOverToOtherPlayer:
1226: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
1229: 3C              INC     A                   
122A: E6 01           AND     $01                 
122C: 32 32 AD        LD      ($AD32),A           ; {hard.workRam+532}

loc_122f:
122F: 3E 5A           LD      A,$5A               
1231: 32 EB A9        LD      ($A9EB),A           ; {hard.workRam+1EB}
1234: 3A 52 4B        LD      A,($4B52)           ; {hard.rom+4B52}
1237: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
123A: C9              RET                         

; ---- $123B-$1252: data ----
123B: 18 A7 13 A5 3B 87 F1 34 0E 34 D7 BF F1 7F 13 13
124B: 13 13 F1 88 DC ED 11 B9

; the last life is gone: queue the PLAYER-n caption and the GAME OVER
; caption, hold them for three seconds and step the sequence on; when no
; game is running it branches instead into the shared teardown
; restartAttractSequence, which hands the machine back to attract
postGameOverBanner:
1253: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
1256: A7              AND     A                   
1257: CA FB 12        JP      Z,$12FB             ; {code.restartAttractSequence}
125A: 11 09 02        LD      DE,$0209            
125D: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
1260: A7              AND     A                   
1261: 28 01           JR      Z,$1264             ; {code.loc_1264}
1263: 1C              INC     E                   

loc_1264:
1264: FF              RST     $38                 
1265: 11 0B 0A        LD      DE,$0A0B            
1268: FF              RST     $38                 
1269: 3E B4           LD      A,$B4               
126B: 32 EB A9        LD      ($A9EB),A           ; {hard.workRam+1EB}
126E: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; gated two-arm state transition: fires only when 0xad02=0, 0xacc6!=0 and
; all 15 slots at 0xa810 are empty, then queues the fixed sound set and
; runs one of two arms on 0xad30 — disarm+reset a cell cluster, or clear a
; strided run and copy a 16-byte record into 0xad10/0xad20
advanceRoundWhenFieldCleared:
1271: 3A 02 AD        LD      A,($AD02)           ; {hard.workRam+502}
1274: A7              AND     A                   
1275: C0              RET     NZ                  
1276: 3A C6 AC        LD      A,($ACC6)           ; {hard.workRam+4C6}
1279: A7              AND     A                   
127A: C8              RET     Z                   
127B: 21 10 A8        LD      HL,$A810            
127E: 11 10 00        LD      DE,$0010            
1281: 06 0F           LD      B,$0F               

loc_1283:
1283: 7E              LD      A,(HL)              
1284: A7              AND     A                   
1285: C0              RET     NZ                  
1286: 19              ADD     HL,DE               
1287: 10 FA           DJNZ    $1283               ; {code.loc_1283}
1289: CD 34 56        CALL    $5634               ; {code.loc_5634}
128C: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
128F: A7              AND     A                   
1290: 28 29           JR      Z,$12BB             ; {code.loc_12bb}
1292: 21 43 AA        LD      HL,$AA43            
1295: 06 17           LD      B,$17               
1297: AF              XOR     A                   

loc_1298:
1298: 77              LD      (HL),A              
1299: 2C              INC     L                   
129A: 2C              INC     L                   
129B: 10 FB           DJNZ    $1298               ; {code.loc_1298}
129D: CD B8 2D        CALL    $2DB8               ; {code.startNextRound}
12A0: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
12A3: A7              AND     A                   
12A4: 11 10 AD        LD      DE,$AD10            
12A7: 28 03           JR      Z,$12AC             ; {code.loc_12ac}
12A9: 11 20 AD        LD      DE,$AD20            

loc_12ac:
12AC: 21 00 AD        LD      HL,$AD00            
12AF: 01 10 00        LD      BC,$0010            
12B2: ED B0           LDIR                        
12B4: 3A 35 4A        LD      A,($4A35)           ; {hard.rom+4A35}
12B7: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
12BA: C9              RET                         

loc_12bb:
12BB: 3A D1 07        LD      A,($07D1)           ; {hard.rom+7D1}
12BE: 32 C6 AC        LD      ($ACC6),A           ; {hard.workRam+4C6}
12C1: CD B6 15        CALL    $15B6               ; {code.hideAllSprites}
12C4: C3 FB 12        JP      $12FB               ; {code.restartAttractSequence}

; ---- $12C7-$12E1: data ----
12C7: 74 B1 CC EC 5C 16 39 50 67 21 7A C5 F7 BE 54 80
12D7: 2F 5F 9F 6D 44 B8 E7 BD 89 59 1A

loc_12e2:
12E2: 21 EB A9        LD      HL,$A9EB            
12E5: 35              DEC     (HL)                
12E6: C0              RET     NZ                  

; hand the turn over to the other player when that player's saved lives
; count is non-zero, and otherwise step the inner sequence index; both
; exits are tails, so this entry chooses between two continuations rather
; than returning to anything
passTurnToOtherPlayerIfLivesElseStepSequence:
12E7: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
12EA: A7              AND     A                   
12EB: 21 20 AD        LD      HL,$AD20            
12EE: 28 03           JR      Z,$12F3             ; {code.loc_12f3}
12F0: 21 10 AD        LD      HL,$AD10            

loc_12f3:
12F3: 7E              LD      A,(HL)              
12F4: A7              AND     A                   
12F5: C2 26 12        JP      NZ,$1226            ; {code.handPlayOverToOtherPlayer}
12F8: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; put the machine back at the top of the attract sequence: clear the play
; flag, the active-player index and the inner sequence step, then set the
; outer phase from a byte of the program image, and write the inner step a
; SECOND time through a fold over three more image bytes -- on an
; unaltered image that fold comes to zero and agrees with the first write,
; on an altered one it does not and the sequence restarts at some other
; step
restartAttractSequence:
12FB: AF              XOR     A                   
12FC: 32 30 AD        LD      ($AD30),A           ; {hard.workRam+530}
12FF: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
1302: 32 32 AD        LD      ($AD32),A           ; {hard.workRam+532}
1305: 3A D3 16        LD      A,($16D3)           ; {hard.rom+16D3}
1308: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
130B: 3A 01 49        LD      A,($4901)           ; {hard.rom+4901}
130E: 2A 02 49        LD      HL,($4902)          ; {hard.rom+4902}
1311: DF              RST     $18                 
1312: AC              XOR     H                   
1313: D6 9B           SUB     $9B                 
1315: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
1318: C9              RET                         

; fill a fixed-length run of character cells with one byte, stepping a
; cell at a time along the line
fillCellRun:
1319: 11 E0 FF        LD      DE,$FFE0            
131C: 06 0D           LD      B,$0D               

loc_131e:
131E: 77              LD      (HL),A              
131F: 19              ADD     HL,DE               
1320: 10 FC           DJNZ    $131E               ; {code.loc_131e}
1322: C9              RET                         

; phase-14 arm of the sequence dispatchSequenceSubStepArm dispatches off
; the 0x0F29 table (keyed on SEQUENCE_SUBSTEP & 0x0F): only on alternate
; frames (bit 1 of FRAME_TICK clear), dispatch on the animation sub-step
; at 0xA9F0 -- steps 0/1 flash the player ship and advance a scripted
; char-plane animation, steps 2/3 tick a two-colour animation and run a
; title-plane pass, step 4 floods the colour plane; the final step sets
; SEQUENCE_DELAY, hides every sprite, sets up the active player's turn
; (loadActivePlayerContextAndPostRoundHud) and reloads SEQUENCE_SUBSTEP
; from ROM byte 0x2750 (=3) to wind the outer sequence on
stepRoundStartIntroAnimation:
1323: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
1326: E6 02           AND     $02                 
1328: C0              RET     NZ                  
1329: 3A F0 A9        LD      A,($A9F0)           ; {hard.workRam+1F0}
132C: A7              AND     A                   
132D: 20 04           JR      NZ,$1333            ; {code.loc_1333}
132F: CD 67 13        CALL    $1367               ; {code.flashPlayerWhiteEveryOtherFrame}
1332: C9              RET                         

loc_1333:
1333: 3D              DEC     A                   
1334: 20 07           JR      NZ,$133D            ; {code.loc_133d}
1336: CD 67 13        CALL    $1367               ; {code.flashPlayerWhiteEveryOtherFrame}
1339: CD 2A 14        CALL    $142A               ; {code.advanceScriptedCharPlaneBandTo2}
133C: C9              RET                         

loc_133d:
133D: 3D              DEC     A                   
133E: 20 07           JR      NZ,$1347            ; {code.loc_1347}
1340: CD 93 13        CALL    $1393               ; {code.cyclePlayerSpriteColourThenAdvanceStepAtZero}
1343: CD C5 14        CALL    $14C5               ; {code.advanceScriptedCharPlaneBandTo4}
1346: C9              RET                         

loc_1347:
1347: 3D              DEC     A                   
1348: 20 04           JR      NZ,$134E            ; {code.loc_134e}
134A: CD C5 14        CALL    $14C5               ; {code.advanceScriptedCharPlaneBandTo4}
134D: C9              RET                         

loc_134e:
134E: 3D              DEC     A                   
134F: 20 04           JR      NZ,$1355            ; {code.loc_1355}
1351: CD CC 13        CALL    $13CC               ; {code.floodColourPlaneWithSavedPlayerColour}
1354: C9              RET                         

loc_1355:
1355: 3E 5A           LD      A,$5A               
1357: 32 EB A9        LD      ($A9EB),A           ; {hard.workRam+1EB}
135A: CD B6 15        CALL    $15B6               ; {code.hideAllSprites}
135D: CD 75 4C        CALL    $4C75               ; {code.loadActivePlayerContextAndPostRoundHud}
1360: 3A 50 27        LD      A,($2750)           ; {hard.rom+2750}
1363: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
1366: C9              RET                         

; one frame of the flash that runs the player's ship white and back: the
; two flip bits of the player's sprite control byte are kept and the
; colour under them is driven from the low bit of the animation's own
; tick, alternating between the all-white palette entry and the colour the
; ship normally wears; the tick is stepped last and wraps at eight bits,
; and on the single tick where it reads the threshold the routine also
; hands the animation on to its next step and asks for one sound
flashPlayerWhiteEveryOtherFrame:
1367: 3A F1 A9        LD      A,($A9F1)           ; {hard.workRam+1F1}
136A: FE 08           CP      $08                 
136C: 20 08           JR      NZ,$1376            ; {code.loc_1376}
136E: 3E 01           LD      A,$01               
1370: 32 F0 A9        LD      ($A9F0),A           ; {hard.workRam+1F0}
1373: CD 11 58        CALL    $5811               ; {code.requestPlayerSpawnFlashSound}

loc_1376:
1376: 3A F1 A9        LD      A,($A9F1)           ; {hard.workRam+1F1}
1379: E6 01           AND     $01                 
137B: 3E 3E           LD      A,$3E               
137D: 28 02           JR      Z,$1381             ; {code.loc_1381}
137F: 3E 00           LD      A,$00               

loc_1381:
1381: 47              LD      B,A                 
1382: 3A 40 AA        LD      A,($AA40)           ; {hard.workRam+240}
1385: E6 C0           AND     $C0                 
1387: 80              ADD     A,B                 
1388: 32 40 AA        LD      ($AA40),A           ; {hard.workRam+240}
138B: 3A F1 A9        LD      A,($A9F1)           ; {hard.workRam+1F1}
138E: 3C              INC     A                   
138F: 32 F1 A9        LD      ($A9F1),A           ; {hard.workRam+1F1}
1392: C9              RET                         

; one tick of a two-colour animation inside the round engine's step-14
; sub-sequence: step a count down by one and, from a single bit of that
; count, drive the colour field of the shadow byte that the sprite
; publisher copies into the player ship's sprite attribute, so a colour
; holds for four consecutive ticks; the top two bits of that byte, which
; carry the sprite's mirroring, are left alone. The tick that finds the
; count already at zero also moves the sub-sequence's step cell on to 3,
; and the count still steps on that tick, wrapping below zero. Its one
; call site is that sub-sequence's step 2, which follows it with one other
; routine
cyclePlayerSpriteColourThenAdvanceStepAtZero:
1393: 3A F3 A9        LD      A,($A9F3)           ; {hard.workRam+1F3}
1396: A7              AND     A                   
1397: 20 09           JR      NZ,$13A2            ; {code.loc_13a2}
1399: 3E 03           LD      A,$03               
139B: 32 F0 A9        LD      ($A9F0),A           ; {hard.workRam+1F0}
139E: 3E 3F           LD      A,$3F               
13A0: 18 18           JR      $13BA               ; {code.loc_13ba}

loc_13a2:
13A2: E6 04           AND     $04                 
13A4: 20 04           JR      NZ,$13AA            ; {code.loc_13aa}
13A6: 3E 3F           LD      A,$3F               
13A8: 18 10           JR      $13BA               ; {code.loc_13ba}

loc_13aa:
13AA: 3D              DEC     A                   
13AB: 20 04           JR      NZ,$13B1            ; {code.loc_13b1}
13AD: 3E 36           LD      A,$36               
13AF: 18 09           JR      $13BA               ; {code.loc_13ba}

loc_13b1:
13B1: 3D              DEC     A                   
13B2: 20 04           JR      NZ,$13B8            ; {code.loc_13b8}
13B4: 3E 3E           LD      A,$3E               
13B6: 18 02           JR      $13BA               ; {code.loc_13ba}

loc_13b8:
13B8: 3E 37           LD      A,$37               

loc_13ba:
13BA: 47              LD      B,A                 
13BB: 3A 40 AA        LD      A,($AA40)           ; {hard.workRam+240}
13BE: E6 C0           AND     $C0                 
13C0: 80              ADD     A,B                 
13C1: 32 40 AA        LD      ($AA40),A           ; {hard.workRam+240}
13C4: 3A F3 A9        LD      A,($A9F3)           ; {hard.workRam+1F3}
13C7: 3D              DEC     A                   
13C8: 32 F3 A9        LD      ($A9F3),A           ; {hard.workRam+1F3}
13CB: C9              RET                         

; the step-4 arm of the round engine's step-14 sub-sequence: flood a fixed
; block of the colour plane with one byte, and hand the sub-sequence the
; step whose arm winds it up. The byte comes from one of two parallel
; cells — the same offset in each of the two per-player save blocks —
; chosen by the active-player index, so it is a saved value rather than
; the live one. The block is twenty-eight rows of twenty-seven cells:
; every row the driver leaves visible, and all but five of the plane's
; thirty-two columns. When the picture is turned round the painting runs
; from the far corner backwards, which changes the ORDER the cells are
; touched in and not WHICH, so the two directions leave the plane
; identical. A separate count is stepped down by one on the way out
floodColourPlaneWithSavedPlayerColour:
13CC: 3E 05           LD      A,$05               
13CE: 32 F0 A9        LD      ($A9F0),A           ; {hard.workRam+1F0}
13D1: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
13D4: A7              AND     A                   
13D5: 3A 1C AD        LD      A,($AD1C)           ; {hard.workRam+51C}
13D8: 47              LD      B,A                 
13D9: 28 04           JR      Z,$13DF             ; {code.loc_13df}
13DB: 3A 2C AD        LD      A,($AD2C)           ; {hard.workRam+52C}
13DE: 47              LD      B,A                 

loc_13df:
13DF: 3A 87 A9        LD      A,($A987)           ; {hard.workRam+187}
13E2: A7              AND     A                   
13E3: 78              LD      A,B                 
13E4: 28 22           JR      Z,$1408             ; {code.loc_1408}
13E6: 21 44 A0        LD      HL,$A044            
13E9: 11 45 A0        LD      DE,$A045            
13EC: D9              EXX                         
13ED: 06 1C           LD      B,$1C               

loc_13ef:
13EF: D9              EXX                         
13F0: 01 1A 00        LD      BC,$001A            
13F3: 77              LD      (HL),A              
13F4: ED B0           LDIR                        
13F6: 11 06 00        LD      DE,$0006            
13F9: 19              ADD     HL,DE               
13FA: 54              LD      D,H                 
13FB: 5D              LD      E,L                 
13FC: 13              INC     DE                  
13FD: D9              EXX                         
13FE: 10 EF           DJNZ    $13EF               ; {code.loc_13ef}
1400: 3A F6 A9        LD      A,($A9F6)           ; {hard.workRam+1F6}
1403: 3D              DEC     A                   
1404: 32 F6 A9        LD      ($A9F6),A           ; {hard.workRam+1F6}
1407: C9              RET                         

loc_1408:
1408: 21 BE A3        LD      HL,$A3BE            
140B: 11 BD A3        LD      DE,$A3BD            
140E: D9              EXX                         
140F: 06 1C           LD      B,$1C               

loc_1411:
1411: D9              EXX                         
1412: 01 1A 00        LD      BC,$001A            
1415: 77              LD      (HL),A              
1416: ED B8           LDDR                        
1418: 11 FA FF        LD      DE,$FFFA            
141B: 19              ADD     HL,DE               
141C: 54              LD      D,H                 
141D: 5D              LD      E,L                 
141E: 1B              DEC     DE                  
141F: D9              EXX                         
1420: 10 EF           DJNZ    $1411               ; {code.loc_1411}
1422: 3A F6 A9        LD      A,($A9F6)           ; {hard.workRam+1F6}
1425: 3D              DEC     A                   
1426: 32 F6 A9        LD      ($A9F6),A           ; {hard.workRam+1F6}
1429: C9              RET                         

; advance one frame of a script-driven character-plane animation: bit 0 of
; a countdown cell alternates a blanking pass (fill two thirteen-cell
; columns and six lead cells with one tile code) with a drawing pass
; (restore the working column from its saved run, nudge four counters by
; the low bit of the next two script bytes, step the band up then back
; down, and gather the column back); a terminator byte instead clears the
; countdown, arms the next sequence step and rewinds the script pointer
; one, ending early, and every non-terminating call then decrements the
; countdown
advanceScriptedCharPlaneBandTo2:
142A: 3A F2 A9        LD      A,($A9F2)           ; {hard.workRam+1F2}
142D: CB 47           BIT     0,A                 
142F: 28 6C           JR      Z,$149D             ; {code.loc_149d}
1431: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
1434: 7E              LD      A,(HL)              
1435: FE FF           CP      $FF                 
1437: 20 12           JR      NZ,$144B            ; {code.loc_144b}
1439: 3E 00           LD      A,$00               
143B: 32 F2 A9        LD      ($A9F2),A           ; {hard.workRam+1F2}
143E: 3E 02           LD      A,$02               
1440: 32 F0 A9        LD      ($A9F0),A           ; {hard.workRam+1F0}
1443: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
1446: 2B              DEC     HL                  
1447: 22 F7 A9        LD      ($A9F7),HL          ; {hard.workRam+1F7}
144A: C9              RET                         

loc_144b:
144B: CD 63 15        CALL    $1563               ; {code.restoreColumnFromSavedRun}
144E: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
1451: 7E              LD      A,(HL)              
1452: E6 01           AND     $01                 
1454: 23              INC     HL                  
1455: 22 F7 A9        LD      ($A9F7),HL          ; {hard.workRam+1F7}
1458: 28 0F           JR      Z,$1469             ; {code.loc_1469}
145A: 11 20 00        LD      DE,$0020            
145D: 21 F0 A5        LD      HL,$A5F0            
1460: 34              INC     (HL)                
1461: 19              ADD     HL,DE               
1462: 34              INC     (HL)                
1463: 21 F2 A5        LD      HL,$A5F2            
1466: 34              INC     (HL)                
1467: 19              ADD     HL,DE               
1468: 34              INC     (HL)                

loc_1469:
1469: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
146C: 7E              LD      A,(HL)              
146D: E6 01           AND     $01                 
146F: 23              INC     HL                  
1470: 22 F7 A9        LD      ($A9F7),HL          ; {hard.workRam+1F7}
1473: 28 09           JR      Z,$147E             ; {code.loc_147e}
1475: 11 20 00        LD      DE,$0020            
1478: 21 F1 A5        LD      HL,$A5F1            
147B: 34              INC     (HL)                
147C: 19              ADD     HL,DE               
147D: 34              INC     (HL)                

loc_147e:
147E: 0E 02           LD      C,$02               
1480: 11 D1 A5        LD      DE,$A5D1            
1483: CD 9D 4A        CALL    $4A9D               ; {code.stepThirteenScriptedGlyphCells}
1486: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
1489: 11 F3 FF        LD      DE,$FFF3            
148C: 19              ADD     HL,DE               
148D: 22 F7 A9        LD      ($A9F7),HL          ; {hard.workRam+1F7}
1490: 0E 00           LD      C,$00               
1492: 11 31 A6        LD      DE,$A631            
1495: CD 9D 4A        CALL    $4A9D               ; {code.stepThirteenScriptedGlyphCells}
1498: CD 8C 15        CALL    $158C               ; {code.gatherCharColumnIntoBackingRun}
149B: 18 20           JR      $14BD               ; {code.loc_14bd}

loc_149d:
149D: 3E F1           LD      A,$F1               
149F: 21 B1 A7        LD      HL,$A7B1            
14A2: CD 19 13        CALL    $1319               ; {code.fillCellRun}
14A5: 21 D1 A5        LD      HL,$A5D1            
14A8: CD 19 13        CALL    $1319               ; {code.fillCellRun}
14AB: 21 10 A6        LD      HL,$A610            
14AE: 77              LD      (HL),A              
14AF: 19              ADD     HL,DE               
14B0: 77              LD      (HL),A              
14B1: 21 11 A6        LD      HL,$A611            
14B4: 77              LD      (HL),A              
14B5: 19              ADD     HL,DE               
14B6: 77              LD      (HL),A              
14B7: 21 12 A6        LD      HL,$A612            
14BA: 77              LD      (HL),A              
14BB: 19              ADD     HL,DE               
14BC: 77              LD      (HL),A              

loc_14bd:
14BD: 3A F2 A9        LD      A,($A9F2)           ; {hard.workRam+1F2}
14C0: 3D              DEC     A                   
14C1: 32 F2 A9        LD      ($A9F2),A           ; {hard.workRam+1F2}
14C4: C9              RET                         

; one pass of a cursor-scripted character-plane animation that runs during
; the inter-round / player-change transition — NOT the title (the title
; logo is a caption strip, and this arm is dispatched only from the life-
; loss / round-advance path and is reach-0 across attract): erases two
; columns + six loose cells on even passes, refills/steps them from the
; script on odd passes, ends the script by clearing the counter, advancing
; the stage to 4 and requesting sounds; decrements the pass counter
; otherwise
advanceScriptedCharPlaneBandTo4:
14C5: 3A F4 A9        LD      A,($A9F4)           ; {hard.workRam+1F4}
14C8: CB 47           BIT     0,A                 
14CA: 28 6F           JR      Z,$153B             ; {code.loc_153b}
14CC: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
14CF: 7E              LD      A,(HL)              
14D0: E6 FE           AND     $FE                 
14D2: 28 15           JR      Z,$14E9             ; {code.loc_14e9}
14D4: 3E 00           LD      A,$00               
14D6: 32 F4 A9        LD      ($A9F4),A           ; {hard.workRam+1F4}
14D9: 3E 04           LD      A,$04               
14DB: 32 F0 A9        LD      ($A9F0),A           ; {hard.workRam+1F0}
14DE: CD E4 56        CALL    $56E4               ; {code.requestInterRoundSoundPair}
14E1: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
14E4: 23              INC     HL                  
14E5: 22 F7 A9        LD      ($A9F7),HL          ; {hard.workRam+1F7}
14E8: C9              RET                         

loc_14e9:
14E9: CD 63 15        CALL    $1563               ; {code.restoreColumnFromSavedRun}
14EC: 0E 01           LD      C,$01               
14EE: 11 51 A4        LD      DE,$A451            
14F1: CD 9D 4A        CALL    $4A9D               ; {code.stepThirteenScriptedGlyphCells}
14F4: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
14F7: 11 0D 00        LD      DE,$000D            
14FA: 19              ADD     HL,DE               
14FB: 22 F7 A9        LD      ($A9F7),HL          ; {hard.workRam+1F7}
14FE: 0E 03           LD      C,$03               
1500: 11 B1 A7        LD      DE,$A7B1            
1503: CD 9D 4A        CALL    $4A9D               ; {code.stepThirteenScriptedGlyphCells}
1506: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
1509: 7E              LD      A,(HL)              
150A: E6 01           AND     $01                 
150C: 2B              DEC     HL                  
150D: 22 F7 A9        LD      ($A9F7),HL          ; {hard.workRam+1F7}
1510: 28 09           JR      Z,$151B             ; {code.loc_151b}
1512: 11 20 00        LD      DE,$0020            
1515: 21 F1 A5        LD      HL,$A5F1            
1518: 35              DEC     (HL)                
1519: 19              ADD     HL,DE               
151A: 35              DEC     (HL)                

loc_151b:
151B: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
151E: 7E              LD      A,(HL)              
151F: E6 01           AND     $01                 
1521: 2B              DEC     HL                  
1522: 22 F7 A9        LD      ($A9F7),HL          ; {hard.workRam+1F7}
1525: 28 0F           JR      Z,$1536             ; {code.loc_1536}
1527: 11 20 00        LD      DE,$0020            
152A: 21 F0 A5        LD      HL,$A5F0            
152D: 35              DEC     (HL)                
152E: 19              ADD     HL,DE               
152F: 35              DEC     (HL)                
1530: 21 F2 A5        LD      HL,$A5F2            
1533: 35              DEC     (HL)                
1534: 19              ADD     HL,DE               
1535: 35              DEC     (HL)                

loc_1536:
1536: CD 8C 15        CALL    $158C               ; {code.gatherCharColumnIntoBackingRun}
1539: 18 20           JR      $155B               ; {code.loc_155b}

loc_153b:
153B: 3E F1           LD      A,$F1               
153D: 21 B1 A7        LD      HL,$A7B1            
1540: CD 19 13        CALL    $1319               ; {code.fillCellRun}
1543: 21 D1 A5        LD      HL,$A5D1            
1546: CD 19 13        CALL    $1319               ; {code.fillCellRun}
1549: 21 10 A6        LD      HL,$A610            
154C: 77              LD      (HL),A              
154D: 19              ADD     HL,DE               
154E: 77              LD      (HL),A              
154F: 21 11 A6        LD      HL,$A611            
1552: 77              LD      (HL),A              
1553: 19              ADD     HL,DE               
1554: 77              LD      (HL),A              
1555: 21 12 A6        LD      HL,$A612            
1558: 77              LD      (HL),A              
1559: 19              ADD     HL,DE               
155A: 77              LD      (HL),A              

loc_155b:
155B: 3A F4 A9        LD      A,($A9F4)           ; {hard.workRam+1F4}
155E: 3D              DEC     A                   
155F: 32 F4 A9        LD      ($A9F4),A           ; {hard.workRam+1F4}
1562: C9              RET                         

; put a saved thirty-two cell picture back onto the character plane:
; twenty-eight bytes down one column of cells a row apart, then four into
; two two-cell columns beside it. Every address is fixed here -- the run
; it reads, the column it lays and the two stubs are all this entry's
; choice, not a caller's -- and it overwrites the cells whole rather than
; merging into them
restoreColumnFromSavedRun:
1563: 11 00 A4        LD      DE,$A400            
1566: 21 51 A4        LD      HL,$A451            
1569: 01 20 00        LD      BC,$0020            
156C: D9              EXX                         
156D: 06 1C           LD      B,$1C               

loc_156f:
156F: D9              EXX                         
1570: 1A              LD      A,(DE)              
1571: 77              LD      (HL),A              
1572: 13              INC     DE                  
1573: 09              ADD     HL,BC               
1574: D9              EXX                         
1575: 10 F8           DJNZ    $156F               ; {code.loc_156f}
1577: D9              EXX                         
1578: 21 F0 A5        LD      HL,$A5F0            
157B: 1A              LD      A,(DE)              
157C: 77              LD      (HL),A              
157D: 09              ADD     HL,BC               
157E: 13              INC     DE                  
157F: 1A              LD      A,(DE)              
1580: 77              LD      (HL),A              
1581: 13              INC     DE                  
1582: 21 F2 A5        LD      HL,$A5F2            
1585: 1A              LD      A,(DE)              
1586: 77              LD      (HL),A              
1587: 09              ADD     HL,BC               
1588: 13              INC     DE                  
1589: 1A              LD      A,(DE)              
158A: 77              LD      (HL),A              
158B: C9              RET                         

; gather one column of the character plane into a thirty-two byte run --
; the column's twenty-eight cells a row apart, then the two two-cell
; columns beside it -- overwriting the run whole rather than merging into
; it; it is the exact inverse of 0x1563 over the same cells in the same
; order
gatherCharColumnIntoBackingRun:
158C: 11 00 A4        LD      DE,$A400            
158F: 21 51 A4        LD      HL,$A451            
1592: 01 20 00        LD      BC,$0020            
1595: D9              EXX                         
1596: 06 1C           LD      B,$1C               

loc_1598:
1598: D9              EXX                         
1599: 7E              LD      A,(HL)              
159A: 12              LD      (DE),A              
159B: 13              INC     DE                  
159C: 09              ADD     HL,BC               
159D: D9              EXX                         
159E: 10 F8           DJNZ    $1598               ; {code.loc_1598}
15A0: D9              EXX                         
15A1: 21 F0 A5        LD      HL,$A5F0            
15A4: 7E              LD      A,(HL)              
15A5: 12              LD      (DE),A              
15A6: 09              ADD     HL,BC               
15A7: 13              INC     DE                  
15A8: 7E              LD      A,(HL)              
15A9: 12              LD      (DE),A              
15AA: 13              INC     DE                  
15AB: 21 F2 A5        LD      HL,$A5F2            
15AE: 7E              LD      A,(HL)              
15AF: 12              LD      (DE),A              
15B0: 09              ADD     HL,BC               
15B1: 13              INC     DE                  
15B2: 7E              LD      A,(HL)              
15B3: 12              LD      (DE),A              
15B4: C9              RET                         

loc_15b5:
15B5: C9              RET                         

; zero every slot of the vertical sprite shadow band, which parks all of
; them above the first visible line, hiding them without retiring any
hideAllSprites:
15B6: 21 41 AA        LD      HL,$AA41            
15B9: 06 18           LD      B,$18               
15BB: AF              XOR     A                   

loc_15bc:
15BC: 77              LD      (HL),A              
15BD: 2C              INC     L                   
15BE: 2C              INC     L                   
15BF: 10 FB           DJNZ    $15BC               ; {code.loc_15bc}
15C1: C9              RET                         

; run the arm the LOW THREE BITS of the inner sequence step select out of
; a word table laid down inline just behind this entry; the arm is entered
; as a transfer with no place parked for it to come back to, so it returns
; past this entry and nothing here runs after it, and all eight indices
; are carried out through the machine's own arithmetic rather than assumed
; away
dispatchSequencePhase0SubStepArm:
15C2: 3A AC A9        LD      A,($A9AC)           ; {hard.workRam+1AC}
15C5: E6 07           AND     $07                 
15C7: F7              RST     $30                 

; ---- $15C8-$15C9: jump table ----
15C8: E2 15

loc_15ca:
15CA: 5F              LD      E,A                 
15CB: A5              AND     L                   
15CC: 13              INC     DE                  
15CD: 77              LD      (HL),A              
15CE: D7              RST     $10                 
15CF: 34              INC     (HL)                
15D0: 87              ADD     A,A                 
15D1: FD DC B9 FE     CALL    C,$FEB9             
15D5: 15              DEC     D                   
15D6: 60              LD      H,B                 
15D7: A6              AND     (HL)                
15D8: 14              INC     D                   
15D9: C4 FD 10        CALL    NZ,$10FD            ; {code.spinRemainingSpriteMultiplexSlots}
15DC: ED 77           NOP                         
15DE: 68              LD      L,B                 
15DF: D7              RST     $10                 
15E0: 34              INC     (HL)                
15E1: B9              CP      C                   

; the first arm of the sequence machine's outer phase zero: arm the whole-
; plane wipe, then hand the inner index the step that actually runs that
; wipe, then subtract a 256-byte block of the program image from the outer
; phase and exclusive-or a fixed key into the difference. Neither number
; lands as an immediate -- the inner index is read out of a program byte
; that is the low half of an address inside an instruction, and the phase
; is never assigned, only folded -- so it is a tamper test that CORRUPTS
; the sequence rather than refusing to run. ★ The dispatch that reaches it
; masks with `and 0x03`, so arrival proves only that the phase is
; congruent to zero modulo four, which is less than it looks like: 0x04,
; 0x08 and 0x0C are not fixed points of the fold. That the phase is left
; standing rests on SEQUENCE_PHASE's own registered range of four values
; and not on anything this arrival establishes
startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase:
15E2: CD 9A 01        CALL    $019A               ; {code.armWholePlaneWipeThenDerailOnATamperedImage}
15E5: 3A 49 17        LD      A,($1749)           ; {hard.rom+1749}
15E8: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
15EB: 0E 00           LD      C,$00               
15ED: 21 48 56        LD      HL,$5648            
15F0: 3A AB A9        LD      A,($A9AB)           ; {hard.workRam+1AB}

loc_15f3:
15F3: 96              SUB     (HL)                
15F4: 23              INC     HL                  
15F5: 0D              DEC     C                   
15F6: 20 FB           JR      NZ,$15F3            ; {code.loc_15f3}
15F8: EE 4E           XOR     $4E                 
15FA: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
15FD: C9              RET                         

; once a per-frame countdown lapses, arm a fresh screen: enqueue four
; fixed ring commands, seed a marker byte into two cells, patch six cells
; from a following table (value + 0x05 marker), print the six-digit
; readout, set two sub-states, and enqueue a fifth command when the gate
; cell is set
armAttractScreenShowingHighScore:
15FE: CD C2 01        CALL    $01C2               ; {code.blankNextLine}
1601: C0              RET     NZ                  
1602: 11 05 01        LD      DE,$0105            
1605: FF              RST     $38                 
1606: 1C              INC     E                   
1607: FF              RST     $38                 
1608: 1C              INC     E                   
1609: FF              RST     $38                 
160A: 11 01 06        LD      DE,$0601            
160D: FF              RST     $38                 
160E: 3E 13           LD      A,$13               
1610: 32 01 A7        LD      ($A701),A           
1613: 32 E1 A6        LD      ($A6E1),A           
1616: 21 3F 16        LD      HL,$163F            
1619: 06 06           LD      B,$06               

loc_161b:
161B: 5E              LD      E,(HL)              
161C: 23              INC     HL                  
161D: 56              LD      D,(HL)              
161E: 23              INC     HL                  
161F: 7E              LD      A,(HL)              
1620: 12              LD      (DE),A              
1621: 13              INC     DE                  
1622: EB              EX      DE,HL               
1623: 36 05           LD      (HL),$05            
1625: EB              EX      DE,HL               
1626: 23              INC     HL                  
1627: 10 F2           DJNZ    $161B               ; {code.loc_161b}
1629: CD 6B 0D        CALL    $0D6B               ; {code.paintHighScoreReadout}
162C: 3E 01           LD      A,$01               
162E: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
1631: 3C              INC     A                   
1632: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
1635: 3A C0 A9        LD      A,($A9C0)           ; {hard.workRam+1C0}
1638: A7              AND     A                   
1639: C8              RET     Z                   
163A: 11 0D 01        LD      DE,$010D            
163D: FF              RST     $38                 
163E: C9              RET                         

; ---- $163F-$1650: data ----
163F: FB AD FD 39 AD 68 43 AB 7C FE AB A5 BE AC 38 C7
164F: AC 3B

; the inner level of the two-level sequence machine for one outer mode:
; run the arm the RAW inner index selects out of a word table laid inline
; just after this entry, then this mode's shared tail at 0x167B; the
; doubling that turns the index into an offset wraps at eight bits, so a
; large index folds back onto the head of the table
dispatchSequencePhase1SubStepArm:
1651: 21 7B 16        LD      HL,$167B            
1654: E5              PUSH    HL                  
1655: 3A AC A9        LD      A,($A9AC)           ; {hard.workRam+1AC}
1658: F7              RST     $30                 

; ---- $1659-$1672: jump table ----
1659: 4B 07 34 17 3F 2D 3E 08 48 17 6A 17 8C 17 B9 17
1669: 52 32 E2 17 19 4B FB 17 30 27

; ---- $1673-$167A: data ----
1673: 26 A6 13 88 57 A5 BF B9

; a shared tail of the two-level sequence machine: when the packed-decimal
; credit count (0xA986) is nonzero, step the outer sequence phase and
; return; otherwise, only when the free-play flag (0xA9C0) is set and a
; start-button bit (0xA9AE & 0x18) is held, hide every sprite and start a
; game charging no credit
advanceSequenceElseStartFreePlayGame:
167B: 3A 86 A9        LD      A,($A986)           ; {hard.workRam+186}
167E: A7              AND     A                   
167F: C2 11 0F        JP      NZ,$0F11            ; {code.advanceSequencePhase}
1682: 3A C0 A9        LD      A,($A9C0)           ; {hard.workRam+1C0}
1685: A7              AND     A                   
1686: C8              RET     Z                   
1687: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
168A: E6 18           AND     $18                 
168C: C8              RET     Z                   
168D: CD B6 15        CALL    $15B6               ; {code.hideAllSprites}

; start a game for whichever start button the input mirror shows held --
; two players if the two-player bit is set, one if only the one-player bit
; is -- stocking each started player's block with the lives setting, and
; charging no credit
startGameOnFreePlay:
1690: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
1693: CB 67           BIT     4,A                 
1695: 20 05           JR      NZ,$169C            ; {code.loc_169c}
1697: CB 5F           BIT     3,A                 
1699: 20 7E           JR      NZ,$1719            ; {code.loc_1719}
169B: C9              RET                         

loc_169c:
169C: 3E FF           LD      A,$FF               
169E: 32 30 AD        LD      ($AD30),A           ; {hard.workRam+530}
16A1: 32 31 AD        LD      ($AD31),A           ; {hard.workRam+531}
16A4: 3A C1 A9        LD      A,($A9C1)           ; {hard.workRam+1C1}
16A7: 32 10 AD        LD      ($AD10),A           ; {hard.workRam+510}
16AA: 32 20 AD        LD      ($AD20),A           ; {hard.workRam+520}
16AD: 18 7B           JR      $172A               ; {code.seatSequencePhase3AndResetSubStep}

loc_16af:
16AF: 06 00           LD      B,$00               
16B1: 21 9F 4D        LD      HL,$4D9F            
16B4: 3A AB A9        LD      A,($A9AB)           ; {hard.workRam+1AB}

loc_16b7:
16B7: 96              SUB     (HL)                
16B8: 23              INC     HL                  
16B9: 10 FC           DJNZ    $16B7               ; {code.loc_16b7}
16BB: EE A2           XOR     $A2                 
16BD: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
16C0: CD 97 0F        CALL    $0F97               ; {code.multiplexSpriteSlotsSkipping}
16C3: CD DF 1E        CALL    $1EDF               ; {code.dispatchPlayerFrameByState}
16C6: CD 97 0F        CALL    $0F97               ; {code.multiplexSpriteSlotsSkipping}
16C9: CD BC 2C        CALL    $2CBC               ; {code.runSceneryForEra}
16CC: CD 98 10        CALL    $1098               ; {code.multiplexSpriteSlots}
16CF: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
16D2: E6 01           AND     $01                 
16D4: 28 1C           JR      Z,$16F2             ; {code.loc_16f2}
16D6: 21 EB A9        LD      HL,$A9EB            
16D9: 35              DEC     (HL)                
16DA: 20 16           JR      NZ,$16F2            ; {code.loc_16f2}
16DC: 11 09 03        LD      DE,$0309            
16DF: FF              RST     $38                 
16E0: 1E 0E           LD      E,$0E               
16E2: FF              RST     $38                 
16E3: 1E 1A           LD      E,$1A               
16E5: FF              RST     $38                 
16E6: AF              XOR     A                   
16E7: 32 0E AD        LD      ($AD0E),A           ; {hard.workRam+50E}
16EA: 3E 2A           LD      A,$2A               
16EC: 32 EB A9        LD      ($A9EB),A           ; {hard.workRam+1EB}
16EF: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

loc_16f2:
16F2: 3A 0E AD        LD      A,($AD0E)           ; {hard.workRam+50E}
16F5: A7              AND     A                   
16F6: C8              RET     Z                   
16F7: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
16FA: E6 0F           AND     $0F                 
16FC: 28 09           JR      Z,$1707             ; {code.loc_1707}
16FE: FE 05           CP      $05                 
1700: 28 09           JR      Z,$170B             ; {code.loc_170b}
1702: FE 0A           CP      $0A                 
1704: 28 09           JR      Z,$170F             ; {code.loc_170f}
1706: C9              RET                         

loc_1707:
1707: 16 02           LD      D,$02               
1709: 18 06           JR      $1711               ; {code.loc_1711}

loc_170b:
170B: 16 0A           LD      D,$0A               
170D: 18 02           JR      $1711               ; {code.loc_1711}

loc_170f:
170F: 16 0B           LD      D,$0B               

loc_1711:
1711: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
1714: C6 1A           ADD     A,$1A               
1716: 5F              LD      E,A                 
1717: FF              RST     $38                 
1718: C9              RET                         

loc_1719:
1719: AF              XOR     A                   
171A: 32 31 AD        LD      ($AD31),A           ; {hard.workRam+531}
171D: 32 20 AD        LD      ($AD20),A           ; {hard.workRam+520}
1720: 3D              DEC     A                   
1721: 32 30 AD        LD      ($AD30),A           ; {hard.workRam+530}
1724: 3A C1 A9        LD      A,($A9C1)           ; {hard.workRam+1C1}
1727: 32 10 AD        LD      ($AD10),A           ; {hard.workRam+510}

; jump the sequence machine to its last outer phase and restart the inner
; index at zero; both stores are constants and neither cell is read first,
; so this is an unconditional jump to a fixed place rather than a step
seatSequencePhase3AndResetSubStep:
172A: 3E 03           LD      A,$03               
172C: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
172F: AF              XOR     A                   
1730: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
1733: C9              RET                         

; one interpolated-run sequence step: call drawInterpolatedPenRun to
; draw/advance one pen run and ret nz unless it reseated to a zero row
; integer, then store the two's-complement checksum of the 34-byte code
; block at 0x1748 into 0xA817 (0x00 on a clean image) and tail-jump to
; 0x0F1A (advanceSequenceSubStep) to step the sequence sub-index
advancePenRunAnimationStep:
1734: CD 01 02        CALL    $0201               ; {code.drawInterpolatedPenRun}
1737: C0              RET     NZ                  
1738: 21 48 17        LD      HL,$1748            
173B: 06 22           LD      B,$22               
173D: AF              XOR     A                   

loc_173e:
173E: 96              SUB     (HL)                
173F: 23              INC     HL                  
1740: 10 FC           DJNZ    $173E               ; {code.loc_173e}
1742: 32 17 A8        LD      ($A817),A           ; {hard.workRam+17}
1745: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; hold one sequence step for as long as its delay cell counts, restamping
; the copyright strip and flashing its line on every frame of the wait,
; and on the frame the delay expires queue two erase requests -- caption
; records 3 and 4, whose glyph runs read PLEASE DEPOSIT COIN and AND TRY
; THIS GAME -- then step the sequence on. A cell holding zero on arrival
; wraps to 255 and waits the long way round rather than leaving at once. ★
; The expiry frame also does the load-bearing thing the name drops: it
; copies the glyph showing at 0xA63C and the colour of the same cell into
; the pair at 0xACC7, and that pair is a COPYRIGHT TAMPER WITNESS rather
; than a screen save. 0xA63C is the fifth cell of the `(c) KONAMI 1982`
; caption -- the N, glyph 0x3B -- and the arm at 0x30E3 reads the pair
; back, tests the glyph against 0x3B and the colour against 0x05 or 0x10,
; and derails to 0x315B on anything else
holdCopyrightThenEraseTheCoinInvitation:
1748: CD 06 0B        CALL    $0B06               ; {code.stampCopyrightStrip}
174B: CD 39 0B        CALL    $0B39               ; {code.flashCopyrightLine}
174E: 21 EB A9        LD      HL,$A9EB            
1751: 35              DEC     (HL)                
1752: C0              RET     NZ                  
1753: 21 3C A6        LD      HL,$A63C            
1756: 11 C7 AC        LD      DE,$ACC7            
1759: 7E              LD      A,(HL)              
175A: 12              LD      (DE),A              
175B: 13              INC     DE                  
175C: CB 94           RES     2,H                 
175E: 7E              LD      A,(HL)              
175F: 12              LD      (DE),A              
1760: 11 03 03        LD      DE,$0303            
1763: FF              RST     $38                 
1764: 1C              INC     E                   
1765: FF              RST     $38                 
1766: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; ---- $1769-$1769: data ----
1769: 31

loc_176a:
176A: CD DA 19        CALL    $19DA               ; {code.checkTheCopyrightLineColoursOrDerail}
176D: 3A 7C A6        LD      A,($A67C)           
1770: FE 7C           CP      $7C                 
1772: C2 9B 45        JP      NZ,$459B            ; {code.stepMotherShipWarpFlashFrame}
1775: 11 13 01        LD      DE,$0113            
1778: FF              RST     $38                 
1779: CD DC 4B        CALL    $4BDC               ; {code.paintFiveLabelledNumericReadouts}
177C: 21 DC A5        LD      HL,$A5DC            
177F: 11 FB AD        LD      DE,$ADFB            
1782: 7E              LD      A,(HL)              
1783: 12              LD      (DE),A              
1784: 13              INC     DE                  
1785: CB 94           RES     2,H                 
1787: 7E              LD      A,(HL)              
1788: 12              LD      (DE),A              
1789: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

loc_178c:
178C: CD 06 0B        CALL    $0B06               ; {code.stampCopyrightStrip}
178F: CD 39 0B        CALL    $0B39               ; {code.flashCopyrightLine}
1792: 21 EB A9        LD      HL,$A9EB            
1795: 35              DEC     (HL)                
1796: C0              RET     NZ                  
1797: CD DA 19        CALL    $19DA               ; {code.checkTheCopyrightLineColoursOrDerail}
179A: 3A B3 47        LD      A,($47B3)           ; {hard.rom+47B3}
179D: C6 02           ADD     A,$02               
179F: 6F              LD      L,A                 
17A0: C6 6A           ADD     A,$6A               
17A2: 67              LD      H,A                 
17A3: 7E              LD      A,(HL)              
17A4: FE 3B           CP      $3B                 
17A6: C2 CA 15        JP      NZ,$15CA            ; {code.loc_15ca}
17A9: 21 7C A6        LD      HL,$A67C            
17AC: 11 43 AB        LD      DE,$AB43            
17AF: 7E              LD      A,(HL)              
17B0: 12              LD      (DE),A              
17B1: 13              INC     DE                  
17B2: CB 94           RES     2,H                 
17B4: 7E              LD      A,(HL)              
17B5: 12              LD      (DE),A              
17B6: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; fold a block of the program image and let the sequence step on only if
; it still adds up; otherwise switch the display off and copy one
; character cell into TAMPER_WITNESS
guardBlockOrBlankDisplay:
17B9: 3A 0D 59        LD      A,($590D)           ; {hard.rom+590D}
17BC: 4F              LD      C,A                 
17BD: 3A 40 4A        LD      A,($4A40)           ; {hard.rom+4A40}
17C0: 21 06 0B        LD      HL,$0B06            
17C3: 06 33           LD      B,$33               

loc_17c5:
17C5: 86              ADD     A,(HL)              
17C6: 23              INC     HL                  
17C7: 10 FC           DJNZ    $17C5               ; {code.loc_17c5}
17C9: FE EF           CP      $EF                 
17CB: CA 1A 0F        JP      Z,$0F1A             ; {code.advanceSequenceSubStep}
17CE: 3A 89 4C        LD      A,($4C89)           ; {hard.rom+4C89}
17D1: 32 08 C3        LD      ($C308),A           
17D4: 21 5C A6        LD      HL,$A65C            
17D7: 11 39 AD        LD      DE,$AD39            
17DA: 7E              LD      A,(HL)              
17DB: 12              LD      (DE),A              
17DC: 13              INC     DE                  
17DD: CB 94           RES     2,H                 
17DF: 7E              LD      A,(HL)              
17E0: 12              LD      (DE),A              
17E1: C9              RET                         

; raise one flag cell to all bits, fold a fixed block of the program image
; into a running total seeded from an image byte and bank the result, then
; step the inner sequence index -- one step of the tamper-check sequence
foldImageBlockIntoSignatureThenAdvanceSequence:
17E2: 3E FF           LD      A,$FF               
17E4: 32 3F AA        LD      ($AA3F),A           ; {hard.workRam+23F}
17E7: 11 B9 17        LD      DE,$17B9            
17EA: 0E 08           LD      C,$08               
17EC: CD D9 4B        CALL    $4BD9               ; {code.loc_4bd9}
17EF: 3A C0 27        LD      A,($27C0)           ; {hard.rom+27C0}
17F2: CD 1E 29        CALL    $291E               ; {code.foldBlockIntoTotal}
17F5: 32 6F AA        LD      ($AA6F),A           ; {hard.workRam+26F}
17F8: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

loc_17fb:
17FB: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; the inner level of the two-level sequence machine for one outer mode:
; run the arm the RAW inner index selects out of a word table laid inline
; just after this entry; this mode's tail does nothing at all, which is
; why every arm here simply ends
dispatchSequencePhase2SubStepArm:
17FE: 21 1D 18        LD      HL,$181D            
1801: E5              PUSH    HL                  
1802: 3A AC A9        LD      A,($A9AC)           ; {hard.workRam+1AC}
1805: F7              RST     $30                 

; ---- $1806-$180F: jump table ----
1806: 1E 18 DB 2C 30 18 E6 07 8A 18

; ---- $1810-$181C: data ----
1810: 72 A6 14 7D A5 38 34 F1 68 0E 34 D7 B9

loc_181d:
181D: C9              RET                         

; one step of a screen-clearing sequence: park every sprite out of sight,
; copy the glyph and colour showing at one fixed character cell into one
; fixed two-byte record, arm the line wipe to run from the plane's fifth
; line, and step the sequence's inner index on last; both the cell and the
; record are fixed here, so nothing a caller was holding chooses either
parkSpritesAndArmLineWipeThenAdvanceSequence:
181E: CD B6 15        CALL    $15B6               ; {code.hideAllSprites}
1821: 21 FC A5        LD      HL,$A5FC            
1824: 11 BE AC        LD      DE,$ACBE            
1827: CD FC 1A        CALL    $1AFC               ; {code.sampleCellGlyphAndColour}
182A: CD B5 01        CALL    $01B5               ; {code.armLineWipeFromFifthLine}
182D: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; one arm of the two-level sequence machine (inner index 2 of
; dispatchSequencePhase2SubStepArm): after two setup calls it posts a
; fixed run of display codes to the writer at 0x0038 as (D=1,code) pairs
; -- 0x01,0x14,0x15, a code that flips 0x0F/0x11 on cell 0xA9C3 and its
; successor, 0x16, 0x00, and a tail 0x19/0x17 chosen by 0xA986 --
; advancing the sequence counter 0xA9AC through 0x0F1A twice on the
; 0xA986>=2 branch and once below
postAttractInfoCaptions:
1830: CD 06 0B        CALL    $0B06               ; {code.stampCopyrightStrip}
1833: CD 39 0B        CALL    $0B39               ; {code.flashCopyrightLine}
1836: 11 01 01        LD      DE,$0101            
1839: FF              RST     $38                 
183A: 1E 14           LD      E,$14               
183C: FF              RST     $38                 
183D: 1C              INC     E                   
183E: FF              RST     $38                 
183F: 1E 0F           LD      E,$0F               
1841: 3A C3 A9        LD      A,($A9C3)           ; {hard.workRam+1C3}
1844: A7              AND     A                   
1845: 28 02           JR      Z,$1849             ; {code.loc_1849}
1847: 1C              INC     E                   
1848: 1C              INC     E                   

loc_1849:
1849: FF              RST     $38                 
184A: 1C              INC     E                   
184B: FF              RST     $38                 
184C: 1E 16           LD      E,$16               
184E: FF              RST     $38                 
184F: 1E 00           LD      E,$00               
1851: FF              RST     $38                 
1852: 3A 86 A9        LD      A,($A986)           ; {hard.workRam+186}
1855: FE 02           CP      $02                 
1857: 30 07           JR      NC,$1860            ; {code.loc_1860}
1859: 11 17 01        LD      DE,$0117            
185C: FF              RST     $38                 
185D: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

loc_1860:
1860: 11 19 01        LD      DE,$0119            
1863: FF              RST     $38                 
1864: CD 1A 0F        CALL    $0F1A               ; {code.advanceSequenceSubStep}
1867: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; ---- $186A-$1889: data ----
186A: 00 02 06 0D 00 03 07 0C 00 04 08 0B 02 06 0A 0A
187A: 04 08 0C 09 07 0A 0D 07 0B 0D 0E 05 0F 0F 0F 05

; the two-credit copyright screen's await-start step: stamp the fixed
; copyright caption strip and flash its line, then dispatch on the two
; start-button bits of IN0_MIRROR (0xA9AE) -- bit 4 tail-calls the two-
; player start, bit 3 the one-player start (bit 4 wins when both are
; held), and with neither held it returns so the screen shows again
stepTwoCreditCopyrightScreenAwaitingStart:
188A: CD 06 0B        CALL    $0B06               ; {code.stampCopyrightStrip}
188D: CD 39 0B        CALL    $0B39               ; {code.flashCopyrightLine}
1890: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
1893: CB 67           BIT     4,A                 
1895: C2 9E 18        JP      NZ,$189E            ; {code.startTwoPlayerGame}
1898: CB 5F           BIT     3,A                 
189A: C2 15 32        JP      NZ,$3215            ; {code.startOnePlayerGame}
189D: C9              RET                         

; start a two-player game: park the caption sprites, raise PLAY_ACTIVE and
; the flag beside it, load both players' lives from the starting-count
; settings cell, run the two-player-start arm, deduct two credits in
; packed BCD from 0xA986 and repaint the panel field, then send the
; sequence machine to its last phase
startTwoPlayerGame:
189E: CD 2B 0B        CALL    $0B2B               ; {code.hideCaptionSprites}
18A1: 3E FF           LD      A,$FF               
18A3: 32 30 AD        LD      ($AD30),A           ; {hard.workRam+530}
18A6: 32 31 AD        LD      ($AD31),A           ; {hard.workRam+531}
18A9: 3A C1 A9        LD      A,($A9C1)           ; {hard.workRam+1C1}
18AC: 32 10 AD        LD      ($AD10),A           ; {hard.workRam+510}
18AF: 32 20 AD        LD      ($AD20),A           ; {hard.workRam+520}
18B2: CD 0E 46        CALL    $460E               ; {code.setUpTwoPlayerStartObjectOnce}
18B5: 21 86 A9        LD      HL,$A986            
18B8: 7E              LD      A,(HL)              
18B9: D6 02           SUB     $02                 
18BB: 27              DAA                         
18BC: 77              LD      (HL),A              
18BD: CD FB 4A        CALL    $4AFB               ; {code.paintCreditCountPanel}
18C0: C3 2A 17        JP      $172A               ; {code.seatSequencePhase3AndResetSubStep}

loc_18c3:
18C3: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
18C6: E6 01           AND     $01                 
18C8: C2 84 19        JP      NZ,$1984            ; {code.loc_1984}
18CB: CD D1 1E        CALL    $1ED1               ; {code.readPlayerControls}
18CE: 21 95 A9        LD      HL,$A995            
18D1: 0F              RRCA                        
18D2: CB 16           RL      (HL)                
18D4: 23              INC     HL                  
18D5: 0F              RRCA                        
18D6: CB 16           RL      (HL)                
18D8: 23              INC     HL                  
18D9: 0F              RRCA                        
18DA: 0F              RRCA                        
18DB: 0F              RRCA                        
18DC: CB 16           RL      (HL)                
18DE: 23              INC     HL                  
18DF: 0F              RRCA                        
18E0: CB 16           RL      (HL)                
18E2: 7E              LD      A,(HL)              
18E3: E6 07           AND     $07                 
18E5: 3D              DEC     A                   
18E6: 28 3B           JR      Z,$1923             ; {code.loc_1923}
18E8: 2B              DEC     HL                  
18E9: 7E              LD      A,(HL)              
18EA: E6 07           AND     $07                 
18EC: 3D              DEC     A                   
18ED: 28 34           JR      Z,$1923             ; {code.loc_1923}
18EF: 2B              DEC     HL                  
18F0: 7E              LD      A,(HL)              
18F1: FE FF           CP      $FF                 
18F3: CC 80 19        CALL    Z,$1980             ; {code.rearmHeldControlRepeat}
18F6: E6 07           AND     $07                 
18F8: 3D              DEC     A                   
18F9: 28 1B           JR      Z,$1916             ; {code.loc_1916}
18FB: 2B              DEC     HL                  
18FC: 7E              LD      A,(HL)              
18FD: FE 7F           CP      $7F                 
18FF: CC 80 19        CALL    Z,$1980             ; {code.rearmHeldControlRepeat}
1902: E6 07           AND     $07                 
1904: 3D              DEC     A                   
1905: 28 02           JR      Z,$1909             ; {code.loc_1909}
1907: 18 5A           JR      $1963               ; {code.loc_1963}

loc_1909:
1909: 21 99 A9        LD      HL,$A999            
190C: 35              DEC     (HL)                
190D: 7E              LD      A,(HL)              
190E: FE 80           CP      $80                 
1910: 38 3C           JR      C,$194E             ; {code.loc_194e}
1912: 36 1A           LD      (HL),$1A            
1914: 18 38           JR      $194E               ; {code.loc_194e}

loc_1916:
1916: 21 99 A9        LD      HL,$A999            
1919: 34              INC     (HL)                
191A: 7E              LD      A,(HL)              
191B: FE 1B           CP      $1B                 
191D: 38 2F           JR      C,$194E             ; {code.loc_194e}
191F: 36 00           LD      (HL),$00            
1921: 18 2B           JR      $194E               ; {code.loc_194e}

loc_1923:
1923: 3A 99 A9        LD      A,($A999)           ; {hard.workRam+199}
1926: 21 C7 12        LD      HL,$12C7            
1929: CF              RST     $08                 
192A: 2A 91 A9        LD      HL,($A991)          ; {hard.workRam+191}
192D: ED 5B 93 A9     LD      DE,($A993)          ; {hard.workRam+193}
1931: 12              LD      (DE),A              
1932: 77              LD      (HL),A              
1933: 3A 90 A9        LD      A,($A990)           ; {hard.workRam+190}
1936: CB 92           RES     2,D                 
1938: 12              LD      (DE),A              
1939: CB D2           SET     2,D                 
193B: E7              RST     $20                 
193C: 23              INC     HL                  
193D: 22 91 A9        LD      ($A991),HL          ; {hard.workRam+191}
1940: ED 53 93 A9     LD      ($A993),DE          ; {hard.workRam+193}
1944: 21 9A A9        LD      HL,$A99A            
1947: 35              DEC     (HL)                
1948: 28 2B           JR      Z,$1975             ; {code.loc_1975}
194A: AF              XOR     A                   
194B: 32 99 A9        LD      ($A999),A           ; {hard.workRam+199}

loc_194e:
194E: ED 5B 93 A9     LD      DE,($A993)          ; {hard.workRam+193}
1952: 3A 99 A9        LD      A,($A999)           ; {hard.workRam+199}
1955: 21 C7 12        LD      HL,$12C7            
1958: CF              RST     $08                 
1959: 12              LD      (DE),A              
195A: CB 92           RES     2,D                 
195C: 3E 10           LD      A,$10               
195E: 12              LD      (DE),A              
195F: AF              XOR     A                   
1960: 32 9C A9        LD      ($A99C),A           ; {hard.workRam+19C}

loc_1963:
1963: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
1966: E6 07           AND     $07                 
1968: 20 30           JR      NZ,$199A            ; {code.loc_199a}
196A: 21 EB A9        LD      HL,$A9EB            
196D: 35              DEC     (HL)                
196E: 20 2A           JR      NZ,$199A            ; {code.loc_199a}
1970: 2A 93 A9        LD      HL,($A993)          ; {hard.workRam+193}
1973: 36 F1           LD      (HL),$F1            

loc_1975:
1975: 3E 3C           LD      A,$3C               
1977: 32 EB A9        LD      ($A9EB),A           ; {hard.workRam+1EB}
197A: CD 34 56        CALL    $5634               ; {code.loc_5634}
197D: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; clear the one-bit press history a caller points at, and hand back a
; zero. A history is a byte a control's bit is rolled into every other
; frame, and its owner acts on the frame the low three bits read 001;
; while a control stays held the byte fills and that pattern cannot recur,
; so clearing it is what lets the same press act again
rearmHeldControlRepeat:
1980: 36 00           LD      (HL),$00            
1982: AF              XOR     A                   
1983: C9              RET                         

loc_1984:
1984: 21 9C A9        LD      HL,$A99C            
1987: 34              INC     (HL)                
1988: 2A 93 A9        LD      HL,($A993)          ; {hard.workRam+193}
198B: CB 94           RES     2,H                 
198D: 3A 9C A9        LD      A,($A99C)           ; {hard.workRam+19C}
1990: CB 67           BIT     4,A                 
1992: 28 04           JR      Z,$1998             ; {code.loc_1998}
1994: 36 14           LD      (HL),$14            
1996: 18 02           JR      $199A               ; {code.loc_199a}

loc_1998:
1998: 36 10           LD      (HL),$10            

loc_199a:
199A: 21 20 AD        LD      HL,$AD20            
199D: 3A 10 AD        LD      A,($AD10)           ; {hard.workRam+510}
19A0: B6              OR      (HL)                
19A1: C0              RET     NZ                  
19A2: 3A C0 A9        LD      A,($A9C0)           ; {hard.workRam+1C0}
19A5: A7              AND     A                   
19A6: 20 26           JR      NZ,$19CE            ; {code.loc_19ce}
19A8: 3A 86 A9        LD      A,($A986)           ; {hard.workRam+186}
19AB: FE 01           CP      $01                 
19AD: D8              RET     C                   
19AE: 28 10           JR      Z,$19C0             ; {code.loc_19c0}
19B0: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
19B3: E6 18           AND     $18                 
19B5: C8              RET     Z                   
19B6: FE 08           CP      $08                 
19B8: 28 0E           JR      Z,$19C8             ; {code.loc_19c8}
19BA: CD B6 15        CALL    $15B6               ; {code.hideAllSprites}
19BD: C3 9E 18        JP      $189E               ; {code.startTwoPlayerGame}

loc_19c0:
19C0: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
19C3: E6 18           AND     $18                 
19C5: FE 08           CP      $08                 
19C7: C0              RET     NZ                  

loc_19c8:
19C8: CD B6 15        CALL    $15B6               ; {code.hideAllSprites}
19CB: C3 15 32        JP      $3215               ; {code.startOnePlayerGame}

loc_19ce:
19CE: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
19D1: E6 18           AND     $18                 
19D3: C8              RET     Z                   
19D4: CD B6 15        CALL    $15B6               ; {code.hideAllSprites}
19D7: C3 90 16        JP      $1690               ; {code.startGameOnFreePlay}

; walk the thirteen colour cells under the copyright line and derail on
; the first one that has been changed: starting at 0xA2BC and stepping
; back 32 a cell, every cell must hold one of exactly two colours, and the
; first that holds anything else transfers into bytes that carry no
; routine and never come back. ★ The two accepted colours are the COLOUR
; BYTES OF THE LINE'S TWO RECORDS, which differ in nothing else -- 0x10 in
; the record at 0x086B and 0x05 in the record at 0x4900, both carrying
; destination 0xA6BC and the same thirteen glyphs -- so the pair is what
; the line's own flashing writes, and not a wipe colour beside a pen
; colour. Thirteen good cells return having done nothing
checkTheCopyrightLineColoursOrDerail:
19DA: 21 BC A2        LD      HL,$A2BC            
19DD: 06 0D           LD      B,$0D               

loc_19df:
19DF: 7E              LD      A,(HL)              
19E0: FE 10           CP      $10                 
19E2: 28 05           JR      Z,$19E9             ; {code.loc_19e9}
19E4: FE 05           CP      $05                 
19E6: C2 FA 49        JP      NZ,$49FA            ; {code.loc_49fa}

loc_19e9:
19E9: 11 E0 FF        LD      DE,$FFE0            
19EC: 19              ADD     HL,DE               
19ED: 10 F0           DJNZ    $19DF               ; {code.loc_19df}
19EF: C9              RET                         

; reset the whole playfield for a new round: clear scroll/control cells,
; seat the ship sprite + shot slots, retire every object slot
; (hold/shared-cooldown/cooldown/sub-pixel variants), clear four sprite
; entries, seat the era scenery band via
; seatEraSceneryRowThenClearAndRunScenery, then scatter one era-selected
; 10-byte record from the 0x1B04 word table into the cells that arm the
; round
resetPlayfieldAndArmNewRound:
19F0: 21 00 00        LD      HL,$0000            
19F3: 22 08 A8        LD      ($A808),HL          ; {hard.workRam+8}
19F6: 22 0A A8        LD      ($A80A),HL          ; {hard.workRam+A}
19F9: 22 06 AD        LD      ($AD06),HL          ; {hard.workRam+506}
19FC: AF              XOR     A                   
19FD: 32 0D AD        LD      ($AD0D),A           ; {hard.workRam+50D}
1A00: 32 F7 A8        LD      ($A8F7),A           ; {hard.workRam+F7}
1A03: 32 05 AD        LD      ($AD05),A           ; {hard.workRam+505}
1A06: 3A D6 A9        LD      A,($A9D6)           ; {hard.workRam+1D6}
1A09: 32 D7 A9        LD      ($A9D7),A           ; {hard.workRam+1D7}
1A0C: 3A 0A AD        LD      A,($AD0A)           ; {hard.workRam+50A}
1A0F: 32 C0 AC        LD      ($ACC0),A           ; {hard.workRam+4C0}
1A12: AF              XOR     A                   
1A13: 32 81 AA        LD      ($AA81),A           ; {hard.workRam+281}
1A16: 32 C6 AC        LD      ($ACC6),A           ; {hard.workRam+4C6}
1A19: 3E 80           LD      A,$80               
1A1B: 32 02 A8        LD      ($A802),A           ; {hard.workRam+2}
1A1E: AF              XOR     A                   
1A1F: 32 01 A8        LD      ($A801),A           ; {hard.workRam+1}
1A22: 3E FF           LD      A,$FF               
1A24: 32 00 A8        LD      ($A800),A           ; {hard.workRam}
1A27: 3E 78           LD      A,$78               
1A29: 32 41 AA        LD      ($AA41),A           ; {hard.workRam+241}
1A2C: 3E 84           LD      A,$84               
1A2E: 32 10 AA        LD      ($AA10),A           ; {hard.workRam+210}
1A31: CD AF 20        CALL    $20AF               ; {code.dressPlayerSpriteForHeading}
1A34: CD 55 27        CALL    $2755               ; {code.freeAllShotSlots}
1A37: DD 21 C0 A8     LD      IX,$A8C0            
1A3B: FD 21 28 AA     LD      IY,$AA28            
1A3F: CD 0D 3C        CALL    $3C0D               ; {code.retireObjectAndHold}
1A42: 06 07           LD      B,$07               
1A44: DD 21 50 A8     LD      IX,$A850            
1A48: FD 21 1A AA     LD      IY,$AA1A            
1A4C: DD 21 E0 A8     LD      IX,$A8E0            
1A50: FD 21 2C AA     LD      IY,$AA2C            
1A54: CD FB 3D        CALL    $3DFB               ; {code.retireSlotIntoSharedCooldown}
1A57: DD 21 F0 A8     LD      IX,$A8F0            
1A5B: FD 21 2E AA     LD      IY,$AA2E            
1A5F: CD AD 48        CALL    $48AD               ; {code.retireSlotIntoCooldown}

loc_1a62:
1A62: CD DE 2B        CALL    $2BDE               ; {code.retireSlotAndSubPixel}
1A65: 11 10 00        LD      DE,$0010            
1A68: DD 19           ADD     IX,DE               
1A6A: FD 23           INC     IY                  
1A6C: FD 23           INC     IY                  
1A6E: 10 F2           DJNZ    $1A62               ; {code.loc_1a62}
1A70: CD E4 1A        CALL    $1AE4               ; {code.freeAndNumberEveryObjectSlot}
1A73: FD 21 28 AA     LD      IY,$AA28            
1A77: FD 36 00 00     LD      (IY+$00),$00        
1A7B: FD 36 02 00     LD      (IY+$02),$00        
1A7F: FD 36 04 00     LD      (IY+$04),$00        
1A83: FD 36 06 00     LD      (IY+$06),$00        
1A87: FD 36 31 00     LD      (IY+$31),$00        
1A8B: FD 36 33 00     LD      (IY+$33),$00        
1A8F: FD 36 35 00     LD      (IY+$35),$00        
1A93: FD 36 37 00     LD      (IY+$37),$00        
1A97: CD A5 30        CALL    $30A5               ; {code.seatEraSceneryRowThenClearAndRunScenery}

; apply the tuning row that the era and its escalation rung together
; select, scattering the row's ten bytes over twelve cells -- two spawner
; caps, two aim windows, two cooldown periods and their live countdowns,
; and two thresholds
applyEraRungSettings:
1A9A: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
1A9D: 07              RLCA                        
1A9E: 07              RLCA                        
1A9F: 07              RLCA                        
1AA0: 07              RLCA                        
1AA1: E6 F0           AND     $F0                 
1AA3: 47              LD      B,A                 
1AA4: 3A C0 AC        LD      A,($ACC0)           ; {hard.workRam+4C0}
1AA7: 80              ADD     A,B                 
1AA8: 21 04 1B        LD      HL,$1B04            
1AAB: D7              RST     $10                 
1AAC: 1A              LD      A,(DE)              
1AAD: 32 44 A8        LD      ($A844),A           ; {hard.workRam+44}
1AB0: 13              INC     DE                  
1AB1: 1A              LD      A,(DE)              
1AB2: 32 37 A8        LD      ($A837),A           ; {hard.workRam+37}
1AB5: 13              INC     DE                  
1AB6: 1A              LD      A,(DE)              
1AB7: 32 27 A8        LD      ($A827),A           ; {hard.workRam+27}
1ABA: 13              INC     DE                  
1ABB: 1A              LD      A,(DE)              
1ABC: 32 17 A8        LD      ($A817),A           ; {hard.workRam+17}
1ABF: 32 14 A8        LD      ($A814),A           ; {hard.workRam+14}
1AC2: 13              INC     DE                  
1AC3: 1A              LD      A,(DE)              
1AC4: 32 C1 AC        LD      ($ACC1),A           ; {hard.workRam+4C1}
1AC7: 13              INC     DE                  
1AC8: 1A              LD      A,(DE)              
1AC9: 32 C4 AC        LD      ($ACC4),A           ; {hard.workRam+4C4}
1ACC: 13              INC     DE                  
1ACD: 1A              LD      A,(DE)              
1ACE: 32 C6 A8        LD      ($A8C6),A           ; {hard.workRam+C6}
1AD1: 13              INC     DE                  
1AD2: 1A              LD      A,(DE)              
1AD3: 32 D6 A8        LD      ($A8D6),A           ; {hard.workRam+D6}
1AD6: 13              INC     DE                  
1AD7: 1A              LD      A,(DE)              
1AD8: 32 E6 A8        LD      ($A8E6),A           ; {hard.workRam+E6}
1ADB: 13              INC     DE                  
1ADC: 1A              LD      A,(DE)              
1ADD: 32 F4 A8        LD      ($A8F4),A           ; {hard.workRam+F4}
1AE0: 32 F6 A8        LD      ($A8F6),A           ; {hard.workRam+F6}
1AE3: C9              RET                         

; lay out the object array's twenty-three records, sixteen bytes apart
; from a fixed start: clear each record's occupancy byte and stamp its
; sixteenth byte with that record's position in the run, counting from
; one. Nothing is read, so the run comes out the same however it went in
freeAndNumberEveryObjectSlot:
1AE4: DD 21 10 A8     LD      IX,$A810            
1AE8: 3E 01           LD      A,$01               
1AEA: 06 17           LD      B,$17               
1AEC: 11 10 00        LD      DE,$0010            

loc_1aef:
1AEF: DD 36 00 00     LD      (IX+$00),$00        
1AF3: DD 77 0F        LD      (IX+$0F),A          
1AF6: 3C              INC     A                   
1AF7: DD 19           ADD     IX,DE               
1AF9: 10 F4           DJNZ    $1AEF               ; {code.loc_1aef}
1AFB: C9              RET                         

; take what is currently showing at one character cell -- its glyph byte
; and the colour byte of the same cell -- and lay the two down side by
; side as a two-byte record. One pointer reaches both planes because they
; hold the same grid at the same offset and are told apart by a single
; address bit. The cell itself is not touched, so what the caller gets is
; a reading and not a reservation
sampleCellGlyphAndColour:
1AFC: 7E              LD      A,(HL)              
1AFD: 12              LD      (DE),A              
1AFE: 13              INC     DE                  
1AFF: CB 94           RES     2,H                 
1B01: 7E              LD      A,(HL)              
1B02: 12              LD      (DE),A              
1B03: C9              RET                         

; ---- $1B04-$1ED0: data ----
1B04: B1 1B BB 1B C5 1B CF 1B D9 1B E3 1B ED 1B F7 1B
1B14: 01 1C 0B 1C 15 1C 1F 1C 29 1C 33 1C 3D 1C 47 1C
1B24: 51 1C 5B 1C 65 1C 6F 1C 79 1C 83 1C 8D 1C 97 1C
1B34: A1 1C AB 1C B5 1C BF 1C C9 1C D3 1C DD 1C E7 1C
1B44: F1 1C FB 1C 05 1D 0F 1D 19 1D 23 1D 2D 1D 37 1D
1B54: 41 1D 4B 1D 55 1D 5F 1D 69 1D 73 1D 7D 1D 87 1D
1B64: 91 1D 9B 1D A5 1D AF 1D B9 1D C3 1D CD 1D D7 1D
1B74: E1 1D EB 1D F5 1D FF 1D 09 1E 13 1E 1D 1E 27 1E
1B84: 31 1E 3B 1E 45 1E 4F 1E 59 1E 63 1E 6D 1E 77 1E
1B94: 81 1E 8B 1E 95 1E 9F 1E A9 1E B3 1E BD 1E C7 1E
1BA4: 5F A5 13 00 D7 34 34 F1 88 57 A5 BF B9 00 20 50
1BB4: 3C 04 50 00 50 18 5A 01 20 4E 3C 04 50 00 4E 18
1BC4: 54 01 28 4C 32 05 60 01 4C 1C 4E 02 28 48 28 05
1BD4: 60 01 48 1C 48 02 30 46 1E 06 70 01 46 1C 42 03
1BE4: 30 44 1E 06 70 02 44 20 3C 03 38 42 1E 06 80 02
1BF4: 42 20 36 03 38 40 1E 06 80 02 40 20 30 04 40 3F
1C04: 1E 07 90 03 3F 24 2A 04 40 3E 1E 07 90 03 3E 24
1C14: 24 04 40 3D 1E 07 A0 03 3D 24 1E 04 40 3C 1E 07
1C24: B0 03 3C 28 1E 04 48 3B 1E 07 C0 03 3B 28 1E 04
1C34: 48 3A 1E 07 D0 03 3A 2C 1E 04 48 39 1E 07 E0 03
1C44: 39 30 1E 04 48 38 19 07 F0 03 38 30 19 01 28 48
1C54: 32 05 50 01 5C 00 1E 01 28 48 28 05 50 01 5A 00
1C64: 1E 02 30 48 1E 05 60 01 58 00 1E 02 30 48 1E 06
1C74: 60 01 56 00 1E 02 30 48 1E 06 70 02 54 00 1E 03
1C84: 38 40 1E 06 70 02 52 00 1E 03 38 40 1E 06 80 02
1C94: 50 00 1E 03 38 40 1E 06 80 02 4C 00 1E 04 40 40
1CA4: 1E 07 90 02 4C 00 1E 04 40 40 1E 07 90 02 48 00
1CB4: 1E 04 48 38 1E 07 A0 02 48 00 1E 04 48 38 1E 07
1CC4: B0 02 48 00 1E 04 48 38 1E 07 C0 02 48 00 1E 04
1CD4: 48 38 1E 07 D0 02 48 00 1E 04 50 38 1E 07 E0 02
1CE4: 48 00 1E 04 58 30 19 07 F0 02 48 00 19 01 20 50
1CF4: 32 03 50 01 50 08 1E 01 20 50 28 04 50 01 50 08
1D04: 1E 01 20 50 1E 04 60 01 50 0C 1E 01 28 50 1E 04
1D14: 60 02 50 0C 1E 01 28 48 1E 05 70 02 48 10 1E 01
1D24: 28 48 1E 05 80 02 48 10 1E 01 30 48 1E 05 90 03
1D34: 48 14 1E 01 30 48 1E 06 A0 03 48 14 1E 02 30 40
1D44: 1E 06 B0 03 40 18 1E 02 38 40 1E 06 C0 03 40 18
1D54: 1E 02 38 40 1E 06 D0 03 40 18 1E 02 38 40 1E 06
1D64: D0 03 40 18 1E 02 40 38 1E 06 E0 03 38 18 1E 02
1D74: 48 38 1E 06 E0 03 38 18 1E 02 50 38 1E 06 F0 03
1D84: 38 18 1E 03 58 30 19 07 F0 03 30 18 19 01 20 50
1D94: 1E 04 60 01 50 00 1E 01 20 50 1E 04 70 01 50 00
1DA4: 1E 01 28 50 1E 04 80 01 50 00 1E 01 28 50 1E 05
1DB4: 90 02 50 00 1E 01 30 48 1E 05 A0 02 48 00 1E 01
1DC4: 30 48 1E 05 B0 02 48 00 1E 01 38 48 1E 05 C0 03
1DD4: 48 00 1E 01 38 48 1E 06 D0 03 48 00 1E 01 40 40
1DE4: 1E 06 E0 03 40 00 1E 01 40 40 1E 06 F0 03 40 00
1DF4: 1E 01 48 40 1E 06 F0 03 40 00 1E 01 48 40 1E 06
1E04: F0 03 40 00 1E 01 50 38 1E 06 F0 03 38 00 1E 01
1E14: 50 38 1E 06 F0 03 38 00 1E 01 58 38 1E 06 F0 03
1E24: 38 00 1E 01 58 30 19 06 F0 03 30 00 19 01 20 50
1E34: 5A 03 00 01 58 3C 64 01 20 50 5A 03 10 01 54 46
1E44: 5A 01 28 50 50 04 20 01 52 50 50 01 28 50 46 04
1E54: 30 02 50 5A 46 01 30 48 46 04 40 02 4E 64 46 01
1E64: 30 48 3C 05 50 02 4B 6E 3C 01 38 48 3C 05 60 03
1E74: 48 78 3C 01 38 40 32 05 70 03 46 82 3C 01 40 40
1E84: 32 05 80 03 44 8C 32 01 40 40 28 05 90 03 44 96
1E94: 32 01 48 40 28 05 A0 03 42 A0 32 01 48 3C 1E 05
1EA4: B0 03 42 AA 28 01 50 3C 1E 05 C0 03 40 B4 28 01
1EB4: 50 3C 1E 05 D0 03 3C BE 28 01 58 38 1E 05 E0 03
1EC4: 38 C8 1E 01 58 30 19 05 F0 03 34 D2 19

; hand back the control word of whichever cabinet panel currently faces
; the picture
readPlayerControls:
1ED1: 3A 87 A9        LD      A,($A987)           ; {hard.workRam+187}
1ED4: A7              AND     A                   
1ED5: 21 AF A9        LD      HL,$A9AF            
1ED8: 20 03           JR      NZ,$1EDD            ; {code.loc_1edd}
1EDA: 21 B0 A9        LD      HL,$A9B0            

loc_1edd:
1EDD: 7E              LD      A,(HL)              
1EDE: C9              RET                         

; seat the player record (ix=0xa800) and its paired sprite entry
; (iy=0xaa10), then branch on the player-state byte 0xa800: return while
; it is 0, run the tile-animation step (0x2010) while it is any other
; non-0xff value, and once it is 0xff either fly the attract demo pilot
; (0x214b when PLAY_ACTIVE 0xad30 is 0), turn the ship toward the read
; control stick (0x1f01 when the low control nibble is nonzero), or just
; scroll the world (0x1f42) when the stick is centred
dispatchPlayerFrameByState:
1EDF: DD 21 00 A8     LD      IX,$A800            
1EE3: FD 21 10 AA     LD      IY,$AA10            
1EE7: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
1EEA: A7              AND     A                   
1EEB: C8              RET     Z                   
1EEC: 3C              INC     A                   
1EED: C2 10 20        JP      NZ,$2010            ; {code.advancePlayerAnimationStrip}
1EF0: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
1EF3: A7              AND     A                   
1EF4: CA 4B 21        JP      Z,$214B             ; {code.flyDemoShipByScript}
1EF7: CD D1 1E        CALL    $1ED1               ; {code.readPlayerControls}
1EFA: E6 0F           AND     $0F                 
1EFC: 20 03           JR      NZ,$1F01            ; {code.turnShipTowardTargetHeading}
1EFE: C3 42 1F        JP      $1F42               ; {code.scrollWorldAtTheEraPace}

; steer the ship one notch toward the wanted heading a table selects
; (leave it when already there, snap on when within one notch, else step
; the short way round the compass by three notches — four once the era's
; low digit reaches three), then fall into the shared world-scroll tail
turnShipTowardTargetHeading:
1F01: 21 2E 1F        LD      HL,$1F2E            
1F04: CF              RST     $08                 
1F05: 47              LD      B,A                 
1F06: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
1F09: 90              SUB     B                   
1F0A: CA 42 1F        JP      Z,$1F42             ; {code.scrollWorldAtTheEraPace}
1F0D: 4F              LD      C,A                 
1F0E: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
1F11: E6 0F           AND     $0F                 
1F13: FE 03           CP      $03                 
1F15: 30 04           JR      NC,$1F1B            ; {code.loc_1f1b}
1F17: 16 03           LD      D,$03               
1F19: 18 02           JR      $1F1D               ; {code.loc_1f1d}

loc_1f1b:
1F1B: 16 04           LD      D,$04               

loc_1f1d:
1F1D: 79              LD      A,C                 
1F1E: C6 01           ADD     A,$01               
1F20: FE 03           CP      $03                 
1F22: DA 3E 1F        JP      C,$1F3E             ; {code.snapHeadingOntoTheTurnTarget}
1F25: 79              LD      A,C                 
1F26: FE 80           CP      $80                 
1F28: D2 6F 1F        JP      NC,$1F6F            ; {code.loc_1f6f}
1F2B: C3 68 1F        JP      $1F68               ; {code.loc_1f68}

loc_1f2e:
1F2E: 00              NOP                         
1F2F: 00              NOP                         
1F30: 80              ADD     A,B                 
1F31: 00              NOP                         
1F32: C0              RET     NZ                  
1F33: E0              RET     PO                  
1F34: A0              AND     B                   
1F35: 00              NOP                         
1F36: 40              LD      B,B                 
1F37: 20 60           JR      NZ,$1F99            ; {code.loc_1f99}
1F39: 00              NOP                         
1F3A: 00              NOP                         
1F3B: 00              NOP                         
1F3C: 00              NOP                         
1F3D: 00              NOP                         

; end a turn by writing the heading the turn was steering toward straight
; into the player's heading cell, then fall into the world scroll every
; arm of the turn reaches; the target arrives in a register and nothing is
; read, so the whole of the entry is that one store
snapHeadingOntoTheTurnTarget:
1F3E: 78              LD      A,B                 
1F3F: 32 02 A8        LD      ($A802),A           ; {hard.workRam+2}

; move the world past the ship at the pace the era sets, READING the
; heading rather than deciding it -- some paths in write it first, others
; arrive with whatever is already there: one of three fixed sample tables
; is picked from ERA_INDEX alone -- the opening era its own, the next two
; sharing a second, everything from the third era up sharing a third --
; and the pair that table gives for the ship's heading is handed on to be
; negated into the world scroll cells. Choosing the table is the whole of
; what this entry decides
scrollWorldAtTheEraPace:
1F42: 21 55 1F        LD      HL,$1F55            
1F45: E5              PUSH    HL                  
1F46: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
1F49: A7              AND     A                   
1F4A: CA 4E 59        JP      Z,$594E             ; {code.loc_594e}
1F4D: FE 03           CP      $03                 
1F4F: DA 65 59        JP      C,$5965             ; {code.loc_5965}
1F52: C3 6B 59        JP      $596B               ; {code.loc_596b}

; ---- $1F55-$1F67: data ----
1F55: AF 67 6F ED 52 22 08 A8 AF 67 6F ED 42 22 0A A8
1F65: C3 AF 20

loc_1f68:
1F68: 92              SUB     D                   
1F69: 80              ADD     A,B                 
1F6A: 32 02 A8        LD      ($A802),A           ; {hard.workRam+2}
1F6D: 18 D3           JR      $1F42               ; {code.scrollWorldAtTheEraPace}

loc_1f6f:
1F6F: 82              ADD     A,D                 
1F70: 80              ADD     A,B                 
1F71: 32 02 A8        LD      ($A802),A           ; {hard.workRam+2}
1F74: 18 CC           JR      $1F42               ; {code.scrollWorldAtTheEraPace}

; ---- $1F76-$1F98: data ----
1F76: F1 F1 F1 F1 F1 F1 F1 DD F1 F1 F1 F1 F0 F1 F1 F1
1F86: F1 C3 F1 F1 F1 F1 EA F1 F1 F1 F1 F1 F1 F1 F1 F1
1F96: B7 F1 F1

loc_1f99:
1F99: F1              POP     AF                  
1F9A: F1              POP     AF                  
1F9B: 4D              LD      C,L                 
1F9C: F1              POP     AF                  
1F9D: F1              POP     AF                  
1F9E: F1              POP     AF                  
1F9F: E5              PUSH    HL                  
1FA0: 2D              DEC     L                   
1FA1: 6E              LD      L,(HL)              
1FA2: F1              POP     AF                  
1FA3: F1              POP     AF                  
1FA4: 5E              LD      E,(HL)              
1FA5: 61              LD      H,C                 
1FA6: E6 F1           AND     $F1                 
1FA8: F1              POP     AF                  
1FA9: F1              POP     AF                  
1FAA: B2              OR      D                   
1FAB: F1              POP     AF                  

; ---- $1FAC-$200B: data ----
1FAC: F1 F1 F1 53 F1 F1 F1 F1 95 F1 F1 F1 45 CA F1 F1
1FBC: F1 C6 2C 97 F1 F1 81 69 1E F1 F1 BC A1 60 F1 F1
1FCC: F4 EB F1 F1 F1 F1 48 F1 F1 F1 E0 63 35 F1 F1 AA
1FDC: B4 8A F1 F1 51 E9 F6 F1 F1 82 92 98 F1 F1 F1 46
1FEC: F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1
1FFC: F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1 F1

; put the byte the caller has been carrying where a result is read from,
; so the verdict of an image check can be taken; on the way it walks an
; address forward twice, by a wide step and then by that same byte, and
; the address it lands on is never dereferenced by anything downstream. It
; reads and writes no memory, so the walk is arithmetic and not a fetch
presentChecksumForTamperTest:
200C: 19              ADD     HL,DE               
200D: DF              RST     $18                 
200E: 78              LD      A,B                 
200F: C9              RET                         

; advance a phase-byte-driven tile animation: on the first frame
; (phase>=0xb4) clamp the phase, flag the paired entry, and cue sounds
; (56d2 always, 5679 past level 2) unless two game-state cells divert to
; loc_1f2e; else step the phase down and, on one of seven keyframe values,
; blit a 5x6 shape strip into video+colour RAM
advancePlayerAnimationStrip:
2010: DD 7E 00        LD      A,(IX+$00)          
2013: FE B4           CP      $B4                 
2015: 38 29           JR      C,$2040             ; {code.loc_2040}
2017: DD 36 00 B4     LD      (IX+$00),$B4        
201B: FD 36 01 FF     LD      (IY+$01),$FF        
201F: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
2022: FE 02           CP      $02                 
2024: D4 79 56        CALL    NC,$5679            ; {code.requestLateEraProgressSound}
2027: CD D2 56        CALL    $56D2               ; {code.requestRoundIntroSoundBurst}
202A: 3A FE AB        LD      A,($ABFE)           ; {hard.workRam+3FE}
202D: FE A5           CP      $A5                 
202F: C2 63 20        JP      NZ,$2063            ; {code.loc_2063}
2032: 11 FF AB        LD      DE,$ABFF            
2035: 1A              LD      A,(DE)              
2036: FE 05           CP      $05                 
2038: CA 40 20        JP      Z,$2040             ; {code.loc_2040}
203B: FE 10           CP      $10                 
203D: C2 63 20        JP      NZ,$2063            ; {code.loc_2063}

loc_2040:
2040: DD 35 00        DEC     (IX+$00)            
2043: DD 7E 00        LD      A,(IX+$00)          
2046: FE B3           CP      $B3                 
2048: 28 1C           JR      Z,$2066             ; {code.loc_2066}
204A: FE AB           CP      $AB                 
204C: 28 1D           JR      Z,$206B             ; {code.loc_206b}
204E: FE A3           CP      $A3                 
2050: 28 1E           JR      Z,$2070             ; {code.loc_2070}
2052: FE 9B           CP      $9B                 
2054: 28 1F           JR      Z,$2075             ; {code.loc_2075}
2056: FE 93           CP      $93                 
2058: 28 20           JR      Z,$207A             ; {code.loc_207a}
205A: FE 8B           CP      $8B                 
205C: 28 21           JR      Z,$207F             ; {code.loc_207f}
205E: FE 83           CP      $83                 
2060: 28 22           JR      Z,$2084             ; {code.loc_2084}
2062: C9              RET                         

loc_2063:
2063: C3 2E 1F        JP      $1F2E               ; {code.loc_1f2e}

loc_2066:
2066: 11 76 1F        LD      DE,$1F76            
2069: 18 1E           JR      $2089               ; {code.loc_2089}

loc_206b:
206B: 11 94 1F        LD      DE,$1F94            
206E: 18 19           JR      $2089               ; {code.loc_2089}

loc_2070:
2070: 11 B2 1F        LD      DE,$1FB2            
2073: 18 14           JR      $2089               ; {code.loc_2089}

loc_2075:
2075: 11 D0 1F        LD      DE,$1FD0            
2078: 18 0F           JR      $2089               ; {code.loc_2089}

loc_207a:
207A: 11 D0 1F        LD      DE,$1FD0            
207D: 18 0A           JR      $2089               ; {code.loc_2089}

loc_207f:
207F: 11 B2 1F        LD      DE,$1FB2            
2082: 18 05           JR      $2089               ; {code.loc_2089}

loc_2084:
2084: 11 EE 1F        LD      DE,$1FEE            
2087: 18 00           JR      $2089               ; {code.loc_2089}

loc_2089:
2089: 21 AF A5        LD      HL,$A5AF            
208C: 06 C1           LD      B,$C1               
208E: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
2091: 80              ADD     A,B                 
2092: 4F              LD      C,A                 
2093: D9              EXX                         
2094: 3A 7A 33        LD      A,($337A)           ; {hard.rom+337A}
2097: 47              LD      B,A                 

loc_2098:
2098: D9              EXX                         
2099: 3A 02 49        LD      A,($4902)           ; {hard.rom+4902}
209C: 47              LD      B,A                 

loc_209d:
209D: 1A              LD      A,(DE)              
209E: 77              LD      (HL),A              
209F: CB 94           RES     2,H                 
20A1: 71              LD      (HL),C              
20A2: CB D4           SET     2,H                 
20A4: 23              INC     HL                  
20A5: 13              INC     DE                  
20A6: 10 F5           DJNZ    $209D               ; {code.loc_209d}
20A8: 3E 1B           LD      A,$1B               
20AA: DF              RST     $18                 
20AB: D9              EXX                         
20AC: 10 EA           DJNZ    $2098               ; {code.loc_2098}
20AE: C9              RET                         

; dress the player's own sprite entry to face the way the ship is heading:
; round the heading byte to the nearest of thirty-two equal sectors and
; write the shape and the byte beside it straight into the entry, from two
; parallel thirty-two-entry tables in the program image. The entry and
; both tables are fixed here, so nothing about which object this is comes
; from the caller
dressPlayerSpriteForHeading:
20AF: DD 21 00 A8     LD      IX,$A800            
20B3: 11 20 00        LD      DE,$0020            
20B6: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
20B9: C6 04           ADD     A,$04               
20BB: 0F              RRCA                        
20BC: 0F              RRCA                        
20BD: 0F              RRCA                        
20BE: E6 1F           AND     $1F                 
20C0: 21 CE 20        LD      HL,$20CE            
20C3: DF              RST     $18                 
20C4: 7E              LD      A,(HL)              
20C5: 32 11 AA        LD      ($AA11),A           ; {hard.workRam+211}
20C8: 19              ADD     HL,DE               
20C9: 7E              LD      A,(HL)              
20CA: 32 40 AA        LD      ($AA40),A           ; {hard.workRam+240}
20CD: C9              RET                         

; ---- $20CE-$210D: data ----
20CE: F0 F1 F2 F3 F4 F5 F6 F7 E8 F7 F6 F5 F4 F3 F2 F1
20DE: F0 EF EE ED EC EB EA E9 E8 E9 EA EB EC ED EE EF
20EE: 40 40 40 40 40 40 40 40 80 C0 C0 C0 C0 C0 C0 C0
20FE: C0 C0 C0 C0 C0 C0 C0 C0 40 40 40 40 40 40 40 40

; seeds the attract-demo autopilot: picks a heading-command script by the
; demo selector (0xad14), writes its dwell counter to 0xadf2 and little-
; endian pointer to 0xadf3/4, then on a failed tile-image tamper readback
; (0xadfb/0xadfc) tail-jumps into the trap
seedDemoAutopilotScript:
210E: 21 F3 AD        LD      HL,$ADF3            
2111: EB              EX      DE,HL               
2112: 3A 14 AD        LD      A,($AD14)           ; {hard.workRam+514}
2115: A7              AND     A                   
2116: 28 28           JR      Z,$2140             ; {code.loc_2140}
2118: FE 03           CP      $03                 
211A: 28 24           JR      Z,$2140             ; {code.loc_2140}
211C: FE 01           CP      $01                 
211E: 28 25           JR      Z,$2145             ; {code.loc_2145}
2120: 21 FA 22        LD      HL,$22FA            

loc_2123:
2123: 7E              LD      A,(HL)              
2124: 3C              INC     A                   
2125: 32 F2 AD        LD      ($ADF2),A           ; {hard.workRam+5F2}
2128: EB              EX      DE,HL               
2129: 73              LD      (HL),E              
212A: 2C              INC     L                   
212B: 72              LD      (HL),D              
212C: 21 FB AD        LD      HL,$ADFB            
212F: 7E              LD      A,(HL)              
2130: FE FD           CP      $FD                 
2132: C2 3D 21        JP      NZ,$213D            ; {code.loc_213d}
2135: 23              INC     HL                  
2136: 7E              LD      A,(HL)              
2137: FE 10           CP      $10                 
2139: C8              RET     Z                   
213A: FE 05           CP      $05                 
213C: C8              RET     Z                   

loc_213d:
213D: C3 51 22        JP      $2251               ; {code.loc_2251}

loc_2140:
2140: 21 8C 21        LD      HL,$218C            
2143: 18 DE           JR      $2123               ; {code.loc_2123}

loc_2145:
2145: 21 51 22        LD      HL,$2251            
2148: 18 D9           JR      $2123               ; {code.loc_2123}

; ---- $214A-$214A: data ----
214A: C9

; attract demo auto-pilot step: ticks the packed dwell/turn countdown at
; 0xadf2, steps the heading-command script at 0xadf3/4 when the dwell
; expires, turns PLAYER_HEADING (0xa802) by the 2-bit command, then tail-
; jumps to the mover at 0x1f42
flyDemoShipByScript:
214B: 21 F2 AD        LD      HL,$ADF2            
214E: 7E              LD      A,(HL)              
214F: 47              LD      B,A                 
2150: E6 3F           AND     $3F                 
2152: 28 07           JR      Z,$215B             ; {code.loc_215b}
2154: 3D              DEC     A                   
2155: 28 04           JR      Z,$215B             ; {code.loc_215b}
2157: 05              DEC     B                   
2158: 70              LD      (HL),B              
2159: 18 0F           JR      $216A               ; {code.loc_216a}

loc_215b:
215B: 23              INC     HL                  
215C: 5E              LD      E,(HL)              
215D: 23              INC     HL                  
215E: 56              LD      D,(HL)              
215F: 13              INC     DE                  
2160: 72              LD      (HL),D              
2161: 2B              DEC     HL                  
2162: 73              LD      (HL),E              
2163: EB              EX      DE,HL               
2164: 7E              LD      A,(HL)              
2165: 1B              DEC     DE                  
2166: 3C              INC     A                   
2167: 12              LD      (DE),A              
2168: 18 E1           JR      $214B               ; {code.flyDemoShipByScript}

loc_216a:
216A: 78              LD      A,B                 
216B: D9              EXX                         
216C: 07              RLCA                        
216D: 07              RLCA                        
216E: E6 03           AND     $03                 
2170: CA 42 1F        JP      Z,$1F42             ; {code.scrollWorldAtTheEraPace}
2173: 3D              DEC     A                   
2174: 28 0B           JR      Z,$2181             ; {code.loc_2181}
2176: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
2179: C6 03           ADD     A,$03               
217B: 32 02 A8        LD      ($A802),A           ; {hard.workRam+2}
217E: C3 42 1F        JP      $1F42               ; {code.scrollWorldAtTheEraPace}

loc_2181:
2181: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
2184: D6 03           SUB     $03                 
2186: 32 02 A8        LD      ($A802),A           ; {hard.workRam+2}
2189: C3 42 1F        JP      $1F42               ; {code.scrollWorldAtTheEraPace}

; ---- $218C-$2249: data ----
218C: 3C 3C 3C 3C 0B 95 03 66 95 7C 59 8D 4B 8E 4A 02
219C: 8B 1A 55 0E 8A 7C 4E 05 8A 0B 86 46 03 4A 0D 7C
21AC: 5A 36 AB 08 55 08 56 01 4A 05 56 03 7C 4D BC 83
21BC: 0A 4B 07 BC 81 72 02 56 02 6A 01 95 3B 88 53 03
21CC: BC 95 46 0B 95 04 A0 0C 4A 02 56 03 55 01 95 03
21DC: 4A 04 8A 02 4A 02 8A 29 8B 06 4B 16 4A 01 95 0D
21EC: 88 53 01 6A 0F 8A 08 8B 0D 4B 08 8B 07 55 02 69
21FC: 89 03 4B 01 7C 6F 05 8B 4B 0D 8B 01 4E 83 01 8B
220C: 0F 55 05 A2 42 10 60 26 4B 02 8B 08 4B 05 8F 4F
221C: 01 95 17 4A 0E 8A 04 A0 1B 8B 11 4B 0A 52 97 4D
222C: 8F 47 06 8B 02 55 03 9D 67 8A 0A 56 05 8B 02 48
223C: 88 03 55 09 60 03 76 13 8B 24 4B 2F 8B 05

loc_224a:
224A: 8B              ADC     A,E                 
224B: 08              EX      AF,AF'              
224C: 8A              ADC     A,D                 
224D: 15              DEC     D                   
224E: 96              SUB     (HL)                
224F: 3C              INC     A                   
2250: 3C              INC     A                   

loc_2251:
2251: 3C              INC     A                   
2252: 3C              INC     A                   
2253: 3C              INC     A                   
2254: 3C              INC     A                   
2255: 0A              LD      A,(BC)              
2256: 95              SUB     L                   
2257: 60              LD      H,B                 
2258: 04              INC     B                   
2259: 9E              SBC     A,(HL)              
225A: 53              LD      D,E                 
225B: 0D              DEC     C                   
225C: 8B              ADC     A,E                 
225D: 02              LD      (BC),A              
225E: 4B              LD      C,E                 
225F: 0F              RRCA                        
2260: 93              SUB     E                   
2261: 53              LD      D,E                 
2262: 07              RLCA                        
2263: A9              XOR     C                   
2264: 54              LD      D,H                 
2265: 0A              LD      A,(BC)              
2266: 96              SUB     (HL)                
2267: 03              INC     BC                  
2268: 60              LD      H,B                 
2269: 0F              RRCA                        
226A: 8A              ADC     A,D                 
226B: 23              INC     HL                  
226C: 48              LD      C,B                 
226D: B9              CP      C                   
226E: 02              LD      (BC),A              
226F: 82              ADD     A,D                 
2270: 59              LD      E,C                 
2271: 9F              SBC     A,A                 
2272: 59              LD      E,C                 
2273: 01 8B 22        LD      BC,$228B            
2276: AB              XOR     E                   
2277: 02              LD      (BC),A              
2278: 4B              LD      C,E                 
2279: 02              LD      (BC),A              
227A: 8B              ADC     A,E                 
227B: 07              RLCA                        
227C: 55              LD      D,L                 
227D: AC              XOR     H                   
227E: 42              LD      B,D                 
227F: 01 50 90        LD      BC,$9050            
2282: 02              LD      (BC),A              
2283: 55              LD      D,L                 
2284: 35              DEC     (HL)                
2285: 90              SUB     B                   
2286: 50              LD      D,B                 
2287: 04              INC     B                   
2288: 92              SUB     D                   
2289: 5B              LD      E,E                 
228A: 89              ADC     A,C                 
228B: 1F              RRA                         
228C: 48              LD      C,B                 
228D: 88              ADC     A,B                 
228E: 05              DEC     B                   
228F: 8C              ADC     A,H                 
2290: 42              LD      B,D                 
2291: 05              DEC     B                   
2292: 4A              LD      C,D                 
2293: 3C              INC     A                   
2294: 0C              INC     C                   
2295: 46              LD      B,(HL)              
2296: 86              ADD     A,(HL)              
2297: 3C              INC     A                   
2298: 04              INC     B                   
2299: 93              SUB     E                   
229A: 5E              LD      E,(HL)              
229B: 06 4B           LD      B,$4B               
229D: 09              ADD     HL,BC               
229E: 4A              LD      C,D                 
229F: 0A              LD      A,(BC)              
22A0: 7C              LD      A,H                 
22A1: 7C              LD      A,H                 
22A2: 6F              LD      L,A                 
22A3: BC              CP      H                   
22A4: 01 8B 07        LD      BC,$078B            
22A7: 92              SUB     D                   
22A8: 48              LD      C,B                 
22A9: 07              RLCA                        
22AA: 88              ADC     A,B                 
22AB: 7C              LD      A,H                 
22AC: 7C              LD      A,H                 
22AD: 45              LD      B,L                 
22AE: 11 90 50        LD      DE,$5090            
22B1: 01 8B 07        LD      BC,$078B            
22B4: 4B              LD      C,E                 
22B5: 0C              INC     C                   
22B6: 8B              ADC     A,E                 
22B7: 0A              LD      A,(BC)              
22B8: 76              HALT                        
22B9: AB              XOR     E                   
22BA: 12              LD      (DE),A              
22BB: 87              ADD     A,A                 
22BC: 47              LD      B,A                 
22BD: 18 8B           JR      $224A               ; {code.loc_224a}

; ---- $22BF-$23E2: data ----
22BF: 03 8A 02 96 08 4B 02 8B 07 95 3C 3C 17 55 3C 05
22CF: 56 20 7C 44 06 67 BC 4D 8E 0C 56 02 4A 1A 4B 39
22DF: 55 25 56 20 55 0B 4B 03 60 06 4A 03 41 01 BC 9F
22EF: 50 04 96 0F 4B 07 8B 3C 3C 3C 3C 3C 3C 3C 3C 02
22FF: 90 45 02 4B 02 48 88 07 8A 55 01 4A 01 58 82 03
230F: 8A 5F 01 60 07 B2 52 03 46 86 1E 49 89 08 4B 01
231F: 94 49 05 8A 4A 3C 3C 0A BC 84 11 53 88 01 4A 0B
232F: 6B 06 4B 24 4A 11 56 08 4A 0E 4B 07 55 07 4B 07
233F: 7C 72 8E 01 AF 44 02 56 8B 04 5A 85 02 8A 02 90
234F: 45 09 8B 01 48 89 41 02 4B 05 B5 10 4D 83 03 B5
235F: 4B 03 A0 07 72 88 08 4B 01 50 85 03 8B 02 55 05
236F: 95 06 60 06 55 01 4B 09 48 8F 47 03 4B 01 96 07
237F: 8A 05 6A 18 4B 0A 8B 06 8A 02 44 84 06 8B 08 8B
238F: 14 BC 84 03 59 83 02 8B 03 60 08 8B 05 7C 5A 01
239F: B6 0A 48 95 4D 01 8A 09 51 BC 85 65 2D 6B 01 95
23AF: 4D 83 02 8A 4A 01 8B 02 72 85 53 01 95 02 8B 06
23BF: 95 03 8B 01 8A 01 4A 07 95 01 6B 03 97 41 05 4B
23CF: 0B 48 88 05 60 3C 3C 3C 3C 73 A6 14 7E 29 F8 9B
23DF: 13 13 96 B9

; fire and sweep the player's shots: on a fire-button rising edge arm and
; seed one shot into a free slot of the six-slot shot bank at 0xaa80 aimed
; along PLAYER_HEADING; then advance every live shot by the world scroll,
; queue its character-cell tiles, and cull any that leaves the field or
; holds a stale head
fireAndSweepPlayerShots:
23E3: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
23E6: 3C              INC     A                   
23E7: C2 96 24        JP      NZ,$2496            ; {code.loc_2496}
23EA: 3A C6 AC        LD      A,($ACC6)           ; {hard.workRam+4C6}
23ED: A7              AND     A                   
23EE: C2 96 24        JP      NZ,$2496            ; {code.loc_2496}
23F1: CD D1 1E        CALL    $1ED1               ; {code.readPlayerControls}
23F4: 07              RLCA                        
23F5: 07              RLCA                        
23F6: 07              RLCA                        
23F7: 07              RLCA                        
23F8: 21 8E A9        LD      HL,$A98E            
23FB: CB 16           RL      (HL)                
23FD: 7E              LD      A,(HL)              
23FE: E6 03           AND     $03                 
2400: FE 01           CP      $01                 
2402: 21 81 AA        LD      HL,$AA81            
2405: 20 02           JR      NZ,$2409            ; {code.loc_2409}
2407: 36 03           LD      (HL),$03            

loc_2409:
2409: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
240C: A7              AND     A                   
240D: 28 05           JR      Z,$2414             ; {code.loc_2414}
240F: 7E              LD      A,(HL)              
2410: A7              AND     A                   
2411: CA 96 24        JP      Z,$2496             ; {code.loc_2496}

loc_2414:
2414: 23              INC     HL                  
2415: 7E              LD      A,(HL)              
2416: A7              AND     A                   
2417: C2 96 24        JP      NZ,$2496            ; {code.loc_2496}
241A: DD 21 80 AA     LD      IX,$AA80            
241E: 06 06           LD      B,$06               

loc_2420:
2420: DD 7E 00        LD      A,(IX+$00)          
2423: A7              AND     A                   
2424: 28 23           JR      Z,$2449             ; {code.loc_2449}
2426: ED 5B 46 0D     LD      DE,($0D46)          ; {hard.rom+D46}
242A: DD 19           ADD     IX,DE               
242C: 10 F2           DJNZ    $2420               ; {code.loc_2420}
242E: C3 96 24        JP      $2496               ; {code.loc_2496}

; ---- $2431-$2448: data ----
2431: 16 A7 13 96 ED DC F1 8C 68 3B 0D ED F1 96 13 13
2441: 13 13 F1 88 DC ED 11 B9

loc_2449:
2449: CD 7E 56        CALL    $567E               ; {code.requestPlayerShotSound}
244C: AF              XOR     A                   
244D: 67              LD      H,A                 
244E: 6F              LD      L,A                 
244F: ED 4B 08 A8     LD      BC,($A808)          ; {hard.workRam+8}
2453: ED 42           SBC     HL,BC               
2455: 29              ADD     HL,HL               
2456: 29              ADD     HL,HL               
2457: DD 75 0A        LD      (IX+$0A),L          
245A: DD 74 0B        LD      (IX+$0B),H          
245D: AF              XOR     A                   
245E: 67              LD      H,A                 
245F: 6F              LD      L,A                 
2460: ED 4B 0A A8     LD      BC,($A80A)          ; {hard.workRam+A}
2464: ED 42           SBC     HL,BC               
2466: 29              ADD     HL,HL               
2467: 29              ADD     HL,HL               
2468: DD 75 0C        LD      (IX+$0C),L          
246B: DD 74 0D        LD      (IX+$0D),H          
246E: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
2471: C6 04           ADD     A,$04               
2473: 0F              RRCA                        
2474: 0F              RRCA                        
2475: 0F              RRCA                        
2476: E6 1F           AND     $1F                 
2478: 21 71 27        LD      HL,$2771            
247B: CD 8C 01        CALL    $018C               ; {code.fetchWideTableWord}
247E: DD 35 00        DEC     (IX+$00)            
2481: DD 36 03 00     LD      (IX+$03),$00        
2485: DD 73 04        LD      (IX+$04),E          
2488: DD 36 05 00     LD      (IX+$05),$00        
248C: DD 72 06        LD      (IX+$06),D          
248F: 21 81 AA        LD      HL,$AA81            
2492: 35              DEC     (HL)                
2493: 23              INC     HL                  
2494: 36 06           LD      (HL),$06            

loc_2496:
2496: 3A 82 AA        LD      A,($AA82)           ; {hard.workRam+282}
2499: A7              AND     A                   
249A: 28 04           JR      Z,$24A0             ; {code.loc_24a0}
249C: 3D              DEC     A                   
249D: 32 82 AA        LD      ($AA82),A           ; {hard.workRam+282}

loc_24a0:
24A0: DD 21 80 AA     LD      IX,$AA80            
24A4: 06 06           LD      B,$06               

loc_24a6:
24A6: D9              EXX                         
24A7: DD 7E 00        LD      A,(IX+$00)          
24AA: A7              AND     A                   
24AB: 28 46           JR      Z,$24F3             ; {code.loc_24f3}
24AD: 3C              INC     A                   
24AE: 20 4C           JR      NZ,$24FC            ; {code.loc_24fc}
24B0: DD 6E 0A        LD      L,(IX+$0A)          
24B3: DD 66 0B        LD      H,(IX+$0B)          
24B6: ED 5B 08 A8     LD      DE,($A808)          ; {hard.workRam+8}
24BA: 19              ADD     HL,DE               
24BB: DD 56 04        LD      D,(IX+$04)          
24BE: DD 5E 03        LD      E,(IX+$03)          
24C1: 19              ADD     HL,DE               
24C2: 7C              LD      A,H                 
24C3: C6 10           ADD     A,$10               
24C5: FE 10           CP      $10                 
24C7: DA FC 24        JP      C,$24FC             ; {code.loc_24fc}
24CA: DD 74 04        LD      (IX+$04),H          
24CD: DD 75 03        LD      (IX+$03),L          
24D0: DD 6E 0C        LD      L,(IX+$0C)          
24D3: DD 66 0D        LD      H,(IX+$0D)          
24D6: ED 5B 0A A8     LD      DE,($A80A)          ; {hard.workRam+A}
24DA: 19              ADD     HL,DE               
24DB: DD 56 06        LD      D,(IX+$06)          
24DE: DD 5E 05        LD      E,(IX+$05)          
24E1: 19              ADD     HL,DE               
24E2: 7C              LD      A,H                 
24E3: C6 08           ADD     A,$08               
24E5: FE 18           CP      $18                 
24E7: DA FC 24        JP      C,$24FC             ; {code.loc_24fc}
24EA: DD 74 06        LD      (IX+$06),H          
24ED: DD 75 05        LD      (IX+$05),L          
24F0: CD 37 53        CALL    $5337               ; {code.queueTileStampForObject}

loc_24f3:
24F3: 11 10 00        LD      DE,$0010            
24F6: DD 19           ADD     IX,DE               
24F8: D9              EXX                         
24F9: 10 AB           DJNZ    $24A6               ; {code.loc_24a6}
24FB: C9              RET                         

loc_24fc:
24FC: AF              XOR     A                   
24FD: DD 77 00        LD      (IX+$00),A          
2500: DD 77 04        LD      (IX+$04),A          
2503: DD 77 06        LD      (IX+$06),A          
2506: C3 F3 24        JP      $24F3               ; {code.loc_24f3}

; ---- $2509-$2510: data ----
2509: E0 A4 14 9B 10 0D 88 B9

; cold-boot init: paints a 64-byte work-RAM block all-ones, seeds RNG /
; loads default high scores / empties the deferred lists (watchdog-kicking
; after each), then tail-jumps into the settings + cold-start chain
initColdStartRamThenSeedConfig:
2511: 21 00 AC        LD      HL,$AC00            
2514: 06 40           LD      B,$40               

loc_2516:
2516: 36 FF           LD      (HL),$FF            
2518: 23              INC     HL                  
2519: 10 FB           DJNZ    $2516               ; {code.loc_2516}
251B: CD 67 4B        CALL    $4B67               ; {code.seedRandomRegister}
251E: 32 00 C2        LD      ($C200),A           
2521: CD A5 4B        CALL    $4BA5               ; {code.loadDefaultHighScores}
2524: 32 00 C2        LD      ($C200),A           
2527: CD 6A 52        CALL    $526A               ; {code.emptyBothDeferredCellLists}
252A: 32 00 C2        LD      ($C200),A           
252D: C3 AA 52        JP      $52AA               ; {code.seedGameConfigFromDipSwitches}

loc_2530:
2530: 19              ADD     HL,DE               
2531: 01 18 01        LD      BC,$0118            
2534: 17              RLA                         
2535: 01 16 01        LD      BC,$0116            
2538: 15              DEC     D                   
2539: 01 14 01        LD      BC,$0114            
253C: 13              INC     DE                  
253D: 01 10 01        LD      BC,$0110            
2540: 0E 01           LD      C,$01               
2542: 0C              INC     C                   
2543: 01 0A 01        LD      BC,$010A            
2546: 08              EX      AF,AF'              
2547: 01 04 01        LD      BC,$0104            
254A: 01 01 FF        LD      BC,$FF01            
254D: 00              NOP                         
254E: FB              EI                          
254F: 00              NOP                         
2550: F8              RET     M                   
2551: 00              NOP                         
2552: F5              PUSH    AF                  
2553: 00              NOP                         
2554: F2 00 EE        JP      P,$EE00             
2557: 00              NOP                         
2558: EB              EX      DE,HL               
2559: 00              NOP                         
255A: E8              RET     PE                  
255B: 00              NOP                         
255C: E4 00 E1        CALL    PO,$E100            
255F: 00              NOP                         
2560: DE 00           SBC     A,$00               
2562: DA 00 D7        JP      C,$D700             
2565: 00              NOP                         
2566: D4 00 D1        CALL    NC,$D100            
2569: 00              NOP                         
256A: CD 00 CA        CALL    $CA00               
256D: 00              NOP                         
256E: C7              RST     $00                 
256F: 00              NOP                         
2570: C3 00 C0        JP      $C000               

; ---- $2573-$272F: data ----
2573: 00 BC 00 B8 00 B5 00 B1 00 AC 00 A8 00 A5 00 A0
2583: 00 9A 00 94 00 8F 00 87 00 84 00 7D 00 76 00 70
2593: 00 69 00 61 00 5B 00 53 00 4B 00 44 00 3B 00 33
25A3: 00 2C 00 23 00 1A 00 11 00 08 00 00 00 00 00 F8
25B3: FF EF FF 00 00 DD FF D4 FF CD FF C5 FF BC FF B5
25C3: FF AD FF A5 FF 9F FF 97 FF 90 FF 8A FF 83 FF 7C
25D3: FF 79 FF 7C FF 6C FF 66 FF 60 FF 5B FF 58 FF 54
25E3: FF 4F FF 4B FF 48 FF 44 FF 40 FF 3D FF 39 FF 36
25F3: FF 33 FF 33 FF 2C FF 29 FF 26 FF 22 FF 1F FF 1C
2603: FF 18 FF 15 FF 12 FF 0E FF 0B FF 08 FF 05 FF 01
2613: FF FF FE FC FE F8 FE F6 FE F4 FE F2 FE F0 FE ED
2623: FE EC FE EB FE EA FE E9 FE E8 FE E7 FE E7 FE E8
2633: FE E9 FE EA FE EB FE EC FE ED FE F0 FE F2 FE F4
2643: FE F6 FE F8 FE FC FE FF FE 01 FF 05 FF 08 FF 0B
2653: FF 0E FF 12 FF 15 FF 18 FF 1C FF 1F FF 22 FF 26
2663: FF 29 FF 2C FF 2F FF 33 FF 36 FF 39 FF 3D FF 40
2673: FF 44 FF 48 FF 4B FF 4F FF 54 FF 58 FF 5B FF 60
2683: FF 66 FF 6C FF 71 FF 79 FF 7C FF 83 FF 8A FF 90
2693: FF 97 FF 9F FF A5 FF AD FF B5 FF BC FF C5 FF CD
26A3: FF D4 FF DD FF E6 FF EF FF F8 FF 00 00 00 00 08
26B3: 00 11 00 1A 00 23 00 2C 00 33 00 3B 00 44 00 4B
26C3: 00 53 00 5B 00 61 00 69 00 70 00 76 00 7D 00 84
26D3: 00 87 00 87 00 94 00 9A 00 A0 00 A5 00 A8 00 AC
26E3: 00 B1 00 B5 00 B8 00 BC 00 C0 00 C3 00 C7 00 CA
26F3: 00 CD 00 CA 00 D4 00 D7 00 DA 00 DE 00 E1 00 E4
2703: 00 E8 00 EB 00 EE 00 F2 00 F5 00 F8 00 FB 00 FF
2713: 00 01 01 FB 00 08 01 0A 01 0C 01 0E 01 10 01 13
2723: 01 14 01 15 01 16 01 17 01 18 01 19 01

loc_2730:
2730: 3A 6F AA        LD      A,($AA6F)           ; {hard.workRam+26F}
2733: FE 76           CP      $76                 
2735: C2 30 25        JP      NZ,$2530            ; {code.loc_2530}
2738: CD 2B 0B        CALL    $0B2B               ; {code.hideCaptionSprites}
273B: CD 0E 21        CALL    $210E               ; {code.seedDemoAutopilotScript}
273E: AF              XOR     A                   
273F: 32 31 AD        LD      ($AD31),A           ; {hard.workRam+531}
2742: 32 20 AD        LD      ($AD20),A           ; {hard.workRam+520}
2745: 32 30 AD        LD      ($AD30),A           ; {hard.workRam+530}
2748: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
274B: 3C              INC     A                   
274C: 32 10 AD        LD      ($AD10),A           ; {hard.workRam+510}
274F: 3E 03           LD      A,$03               
2751: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
2754: C9              RET                         

; free all six of the player's shot slots, zeroing each record's occupancy
; byte and its second-axis coordinate but not its first; the fill byte and
; the record stride are both fetched from program space rather than
; written as immediates
freeAllShotSlots:
2755: DD 21 80 AA     LD      IX,$AA80            
2759: 21 6E 27        LD      HL,$276E            
275C: 3A 61 08        LD      A,($0861)           ; {hard.rom+861}
275F: 5F              LD      E,A                 
2760: 3A 01 5C        LD      A,($5C01)           ; {hard.rom+5C01}
2763: 57              LD      D,A                 
2764: 06 06           LD      B,$06               

loc_2766:
2766: DD 77 00        LD      (IX+$00),A          
2769: DD 77 04        LD      (IX+$04),A          
276C: DD 19           ADD     IX,DE               
276E: 10 F6           DJNZ    $2766               ; {code.loc_2766}
2770: C9              RET                         

; ---- $2771-$27B0: data ----
2771: 7E 84 7E 85 7E 86 7D 87 7C 88 7B 89 7A 8A 79 8A
2781: 78 8A 77 8A 76 8A 75 89 74 88 73 87 72 86 72 85
2791: 72 84 72 83 72 82 73 81 74 80 75 7F 76 7E 77 7E
27A1: 78 7E 79 7E 7A 7E 7B 7F 7C 80 7D 81 7E 82 7E 83

; round-start sequence arm: seat two player-object records (0xAD0C-0xAD2E)
; and position seeds (0xAC64=0x78,0xAC65=0x84), request a sound and load
; the difficulty record, then split on PLAY_ACTIVE(0xAD30) -- mid-game it
; queues command de=0x0400 and folds a +1 XOR checksum of 256 program
; bytes at 0x1550 into control latch 0xC308 (0xA9EB=0x96); on a fresh
; round it cycles the 1..3 stage counter at 0xA9D0, reseeds the random
; register, clears 0xAA80-0xAADF and 0xA800-0xA97F, SUB-checksums 256
; bytes at 0x3310 into 0xA9AB (xor 0x90) and paints star field
; 0xAC74-0xAC83 with 0x80 (0xA9EB=0x5A); both arms tail-advance the
; sequence sub-step
armRoundStartThenStepSequence:
27B1: CD 34 58        CALL    $5834               ; {code.requestRoundStartSound}
27B4: 3E 78           LD      A,$78               
27B6: 32 64 AC        LD      ($AC64),A           ; {hard.workRam+464}
27B9: 3E 84           LD      A,$84               
27BB: 32 65 AC        LD      ($AC65),A           ; {hard.workRam+465}
27BE: 21 00 00        LD      HL,$0000            
27C1: 22 16 AD        LD      ($AD16),HL          ; {hard.workRam+516}
27C4: 22 26 AD        LD      ($AD26),HL          ; {hard.workRam+526}
27C7: 3A CD A9        LD      A,($A9CD)           ; {hard.workRam+1CD}
27CA: 32 12 AD        LD      ($AD12),A           ; {hard.workRam+512}
27CD: 32 22 AD        LD      ($AD22),A           ; {hard.workRam+522}
27D0: AF              XOR     A                   
27D1: 32 14 AD        LD      ($AD14),A           ; {hard.workRam+514}
27D4: 32 24 AD        LD      ($AD24),A           ; {hard.workRam+524}
27D7: 32 32 AD        LD      ($AD32),A           ; {hard.workRam+532}
27DA: 32 13 AD        LD      ($AD13),A           ; {hard.workRam+513}
27DD: 32 23 AD        LD      ($AD23),A           ; {hard.workRam+523}
27E0: 32 1D AD        LD      ($AD1D),A           ; {hard.workRam+51D}
27E3: 32 2D AD        LD      ($AD2D),A           ; {hard.workRam+52D}
27E6: 32 0C AD        LD      ($AD0C),A           ; {hard.workRam+50C}
27E9: 3C              INC     A                   
27EA: 32 11 AD        LD      ($AD11),A           ; {hard.workRam+511}
27ED: 32 21 AD        LD      ($AD21),A           ; {hard.workRam+521}
27F0: 32 1E AD        LD      ($AD1E),A           ; {hard.workRam+51E}
27F3: 32 2E AD        LD      ($AD2E),A           ; {hard.workRam+52E}
27F6: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
27F9: A7              AND     A                   
27FA: 28 39           JR      Z,$2835             ; {code.loc_2835}
27FC: AF              XOR     A                   
27FD: 67              LD      H,A                 
27FE: 6F              LD      L,A                 
27FF: 32 33 AD        LD      ($AD33),A           ; {hard.workRam+533}
2802: 22 34 AD        LD      ($AD34),HL          ; {hard.workRam+534}
2805: 32 36 AD        LD      ($AD36),A           ; {hard.workRam+536}
2808: 22 37 AD        LD      ($AD37),HL          ; {hard.workRam+537}
280B: 11 00 04        LD      DE,$0400            
280E: FF              RST     $38                 
280F: 3A C4 A9        LD      A,($A9C4)           ; {hard.workRam+1C4}
2812: CD 7B 0F        CALL    $0F7B               ; {code.loadDifficultyRecord}
2815: 06 00           LD      B,$00               
2817: 21 50 15        LD      HL,$1550            
281A: 97              SUB     A                   

loc_281b:
281B: AE              XOR     (HL)                
281C: 23              INC     HL                  
281D: 10 FC           DJNZ    $281B               ; {code.loc_281b}
281F: C6 01           ADD     A,$01               
2821: 32 08 C3        LD      ($C308),A           
2824: 3A D3 A9        LD      A,($A9D3)           ; {hard.workRam+1D3}
2827: 32 1A AD        LD      ($AD1A),A           ; {hard.workRam+51A}
282A: 32 2A AD        LD      ($AD2A),A           ; {hard.workRam+52A}
282D: 3E 96           LD      A,$96               
282F: 32 EB A9        LD      ($A9EB),A           ; {hard.workRam+1EB}
2832: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

loc_2835:
2835: 21 D0 A9        LD      HL,$A9D0            
2838: 7E              LD      A,(HL)              
2839: 3C              INC     A                   
283A: FE 04           CP      $04                 
283C: 38 02           JR      C,$2840             ; {code.loc_2840}
283E: 3E 01           LD      A,$01               

loc_2840:
2840: 77              LD      (HL),A              
2841: 32 14 AD        LD      ($AD14),A           ; {hard.workRam+514}
2844: 3C              INC     A                   
2845: 32 11 AD        LD      ($AD11),A           ; {hard.workRam+511}
2848: AF              XOR     A                   
2849: 32 80 A9        LD      ($A980),A           ; {hard.workRam+180}
284C: 32 CE A9        LD      ($A9CE),A           ; {hard.workRam+1CE}
284F: 32 CF A9        LD      ($A9CF),A           ; {hard.workRam+1CF}
2852: CD 67 4B        CALL    $4B67               ; {code.seedRandomRegister}
2855: 21 80 AA        LD      HL,$AA80            
2858: 11 81 AA        LD      DE,$AA81            
285B: 36 00           LD      (HL),$00            
285D: 01 5F 00        LD      BC,$005F            
2860: ED B0           LDIR                        
2862: 21 00 A8        LD      HL,$A800            
2865: 11 01 A8        LD      DE,$A801            
2868: 36 00           LD      (HL),$00            
286A: 01 7F 01        LD      BC,$017F            
286D: ED B0           LDIR                        
286F: 3E 02           LD      A,$02               
2871: CD 7B 0F        CALL    $0F7B               ; {code.loadDifficultyRecord}
2874: 3A D3 A9        LD      A,($A9D3)           ; {hard.workRam+1D3}
2877: 32 1A AD        LD      ($AD1A),A           ; {hard.workRam+51A}
287A: 32 2A AD        LD      ($AD2A),A           ; {hard.workRam+52A}
287D: 0E 00           LD      C,$00               
287F: 21 10 33        LD      HL,$3310            
2882: 3A AB A9        LD      A,($A9AB)           ; {hard.workRam+1AB}

loc_2885:
2885: 96              SUB     (HL)                
2886: 23              INC     HL                  
2887: 0D              DEC     C                   
2888: 20 FB           JR      NZ,$2885            ; {code.loc_2885}
288A: EE 90           XOR     $90                 
288C: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
288F: 21 74 AC        LD      HL,$AC74            
2892: 06 10           LD      B,$10               

loc_2894:
2894: 36 80           LD      (HL),$80            
2896: 23              INC     HL                  
2897: 10 FB           DJNZ    $2894               ; {code.loc_2894}
2899: 3E 5A           LD      A,$5A               
289B: 32 EB A9        LD      ($A9EB),A           ; {hard.workRam+1EB}
289E: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; work seven fixed object slots in one fixed order, each through the entry
; that seats its own pair of cursors; the order is the whole of what this
; entry decides, and nothing here reads or writes a slot itself. ★ Seven
; is the SET's size and not the per-frame count: the last two slots stand
; down while MOTHER_SHIP_ARMED is set, so on that arm only FIVE slots
; step. A resume value is laid down for each slot that will reach an arm,
; and not for the two that stand down, which reach none
stepSevenCraftSlots:
28A1: CD B7 28        CALL    $28B7               ; {code.seatCraftSlot0ThenDispatchByEra}
28A4: CD C2 28        CALL    $28C2               ; {code.seatCraftSlot1ThenDispatchByEra}
28A7: CD CD 28        CALL    $28CD               ; {code.seatCraftSlot2ThenDispatchByEra}
28AA: CD D8 28        CALL    $28D8               ; {code.seatCraftSlot3ThenDispatchByEra}
28AD: CD E3 28        CALL    $28E3               ; {code.seatCraftSlot4ThenDispatchByEra}
28B0: CD EE 28        CALL    $28EE               ; {code.seatMotherShipSlotThenDispatchByEraUnlessArmed}
28B3: CD FE 28        CALL    $28FE               ; {code.seatCraftSlot6ThenDispatchByEraUnlessArmed}
28B6: C9              RET                         

; seat the record cursor and the sprite-entry cursor on one fixed object
; slot, then run the era-keyed dispatch over it; the pair of immediates is
; the whole of what distinguishes this entry from the four siblings that
; share its shape -- the two gated ones later in the chain differ by more
seatCraftSlot0ThenDispatchByEra:
28B7: DD 21 50 A8     LD      IX,$A850            
28BB: FD 21 1A AA     LD      IY,$AA1A            
28BF: C3 0E 29        JP      $290E               ; {code.dispatchSeatedSlotByEraIndex}

; seat the record cursor and the sprite-entry cursor on one fixed object
; slot, then run the era-keyed dispatch over it; the pair of immediates is
; the whole of what distinguishes this entry from the four siblings that
; share its shape -- the two gated ones later in the chain differ by more
seatCraftSlot1ThenDispatchByEra:
28C2: DD 21 60 A8     LD      IX,$A860            
28C6: FD 21 1C AA     LD      IY,$AA1C            
28CA: C3 0E 29        JP      $290E               ; {code.dispatchSeatedSlotByEraIndex}

; seat the record cursor and the sprite-entry cursor on one fixed object
; slot, then run the era-keyed dispatch over it; the pair of immediates is
; the whole of what distinguishes this entry from the four siblings that
; share its shape -- the two gated ones later in the chain differ by more
seatCraftSlot2ThenDispatchByEra:
28CD: DD 21 70 A8     LD      IX,$A870            
28D1: FD 21 1E AA     LD      IY,$AA1E            
28D5: C3 0E 29        JP      $290E               ; {code.dispatchSeatedSlotByEraIndex}

; seat the record cursor and the sprite-entry cursor on one fixed object
; slot, then run the era-keyed dispatch over it; the pair of immediates is
; the whole of what distinguishes this entry from the four siblings that
; share its shape -- the two gated ones later in the chain differ by more
seatCraftSlot3ThenDispatchByEra:
28D8: DD 21 80 A8     LD      IX,$A880            
28DC: FD 21 20 AA     LD      IY,$AA20            
28E0: C3 0E 29        JP      $290E               ; {code.dispatchSeatedSlotByEraIndex}

; seat the record cursor and the sprite-entry cursor on one fixed object
; slot, then run the era-keyed dispatch over it, with no gate in front of
; it
seatCraftSlot4ThenDispatchByEra:
28E3: DD 21 90 A8     LD      IX,$A890            
28E7: FD 21 22 AA     LD      IY,$AA22            
28EB: C3 0E 29        JP      $290E               ; {code.dispatchSeatedSlotByEraIndex}

; run the era-keyed dispatch over the mother ship's slot, but only while
; the armed cell is clear -- a set cell returns at once, leaving the slot
; unserviced for the frame
seatMotherShipSlotThenDispatchByEraUnlessArmed:
28EE: 3A 0D AD        LD      A,($AD0D)           ; {hard.workRam+50D}
28F1: A7              AND     A                   
28F2: C0              RET     NZ                  
28F3: DD 21 A0 A8     LD      IX,$A8A0            
28F7: FD 21 24 AA     LD      IY,$AA24            
28FB: C3 0E 29        JP      $290E               ; {code.dispatchSeatedSlotByEraIndex}

; run the era-keyed dispatch over one fixed object slot, but only while
; the mother ship's armed cell is clear -- a set cell returns at once,
; leaving the slot unserviced for the frame
seatCraftSlot6ThenDispatchByEraUnlessArmed:
28FE: 3A 0D AD        LD      A,($AD0D)           ; {hard.workRam+50D}
2901: A7              AND     A                   
2902: C0              RET     NZ                  
2903: DD 21 B0 A8     LD      IX,$A8B0            
2907: FD 21 26 AA     LD      IY,$AA26            
290B: C3 0E 29        JP      $290E               ; {code.dispatchSeatedSlotByEraIndex}

; run the arm the LOW THREE BITS of the ERA INDEX select out of a word
; table laid down inline just behind this entry; the arm is entered as a
; transfer with no place parked for it to come back to, so it returns past
; this entry and nothing here runs after it
dispatchSeatedSlotByEraIndex:
290E: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
2911: E6 07           AND     $07                 
2913: F7              RST     $30                 

; ---- $2914-$291D: jump table ----
2914: 27 29 4C 29 84 29 B0 29 D5 29

; fold a run of image bytes into a total the caller has already seeded,
; walking a SECOND pointer alongside it in lockstep. The second walk adds
; nothing: each step overwrites the same byte-wide holder, so only the
; last byte it passes survives, and on a genuine image its leftover went
; unread by every RAM signature the pass sampled. A count of zero means a
; full 256 bytes, the total wraps at eight bits, and no memory is written
foldBlockIntoTotal:
291E: 86              ADD     A,(HL)              
291F: EB              EX      DE,HL               
2920: 4E              LD      C,(HL)              
2921: EB              EX      DE,HL               
2922: 23              INC     HL                  
2923: 13              INC     DE                  
2924: 10 F8           DJNZ    $291E               ; {code.foldBlockIntoTotal}
2926: C9              RET                         

; era-0 per-object update dispatched by index 0 of the rst-0x30 era table
; at 0x2914: on the object status byte at (ix+0) it leaves an empty slot
; (0), releases a held object (0xFE), steps a dying one (any other value),
; or steers/flies/refreshes an active craft (0xFF) and lets it spawn,
; retiring it the frame it reaches the line
serviceEra0EnemyCraftSlot:
2927: DD 7E 00        LD      A,(IX+$00)          
292A: A7              AND     A                   
292B: C8              RET     Z                   
292C: 3C              INC     A                   
292D: 28 07           JR      Z,$2936             ; {code.loc_2936}
292F: 3C              INC     A                   
2930: CA 52 2B        JP      Z,$2B52             ; {code.releaseHeldObject}
2933: C3 93 2B        JP      $2B93               ; {code.stepDyingObjectState}

loc_2936:
2936: CD EF 2B        CALL    $2BEF               ; {code.steerTowardAimHeading}
2939: CD 40 58        CALL    $5840               ; {code.flyAtSlowestSpeed}
293C: CD 83 2B        CALL    $2B83               ; {code.hasReachedRetireLine}
293F: DA DE 2B        JP      C,$2BDE             ; {code.retireSlotAndSubPixel}
2942: CD D6 3E        CALL    $3ED6               ; {code.launchBankEnemyWhenAimedNearPlayer}
2945: CD 3C 2A        CALL    $2A3C               ; {code.refreshSpriteFromHeading}
2948: CD 43 42        CALL    $4243               ; {code.launchAttackerIntoFreeSlot}
294B: C9              RET                         

loc_294c:
294C: DD 7E 00        LD      A,(IX+$00)          
294F: A7              AND     A                   
2950: C8              RET     Z                   
2951: 3C              INC     A                   
2952: 28 07           JR      Z,$295B             ; {code.loc_295b}
2954: 3C              INC     A                   
2955: CA 52 2B        JP      Z,$2B52             ; {code.releaseHeldObject}
2958: C3 93 2B        JP      $2B93               ; {code.stepDyingObjectState}

loc_295b:
295B: CD EF 2B        CALL    $2BEF               ; {code.steerTowardAimHeading}
295E: CD 54 58        CALL    $5854               ; {code.loc_5854}
2961: CD 83 2B        CALL    $2B83               ; {code.hasReachedRetireLine}
2964: DA DE 2B        JP      C,$2BDE             ; {code.retireSlotAndSubPixel}
2967: CD D6 3E        CALL    $3ED6               ; {code.launchBankEnemyWhenAimedNearPlayer}
296A: CD 47 2A        CALL    $2A47               ; {code.refreshSecondEraSpriteFromHeading}
296D: C9              RET                         

; ---- $296E-$2983: data ----
296E: 09 A7 32 82 6E 58 B5 77 E4 E8 EC 9D CB 4F 55 FE
297E: A3 31 81 5B 9A B9

; era-2 per-slot object handler (index 2 of the 0x2914 rst-0x30 era table,
; ERA_INDEX 0xad04 low three bits == 2), dispatched on the slot's state
; byte (ix+0): 0x00 idle returns; 0xFF active steers toward its aim 3
; frames in 4, flies at the slowest speed, retires the slot once it
; reaches a retire line, else dresses its sprite and runs two gated enemy-
; launch attempts; 0xFE releases the held object; any other value steps
; the dying-object state
serviceEra2EnemyCraftSlot:
2984: DD 7E 00        LD      A,(IX+$00)          
2987: A7              AND     A                   
2988: C8              RET     Z                   
2989: 3C              INC     A                   
298A: 28 07           JR      Z,$2993             ; {code.loc_2993}
298C: 3C              INC     A                   
298D: CA 52 2B        JP      Z,$2B52             ; {code.releaseHeldObject}
2990: C3 93 2B        JP      $2B93               ; {code.stepDyingObjectState}

loc_2993:
2993: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
2996: E6 03           AND     $03                 
2998: FE 03           CP      $03                 
299A: DC EF 2B        CALL    C,$2BEF             ; {code.steerTowardAimHeading}
299D: CD 40 58        CALL    $5840               ; {code.flyAtSlowestSpeed}
29A0: CD 83 2B        CALL    $2B83               ; {code.hasReachedRetireLine}
29A3: DA DE 2B        JP      C,$2BDE             ; {code.retireSlotAndSubPixel}
29A6: CD D6 3E        CALL    $3ED6               ; {code.launchBankEnemyWhenAimedNearPlayer}
29A9: CD 97 2A        CALL    $2A97               ; {code.dressSpriteForFineHeading}
29AC: CD 43 42        CALL    $4243               ; {code.launchAttackerIntoFreeSlot}
29AF: C9              RET                         

; era-3 per-object-slot step, dispatched on the slot's lifecycle byte at
; ix+0: idle does nothing; a live slot (0xff) is steered, dressed, then
; retired at the line or flown on and given a spawn attempt; 0xfe releases
; a held slot; a lower value is a death-countdown step
serviceEra3EnemyCraftSlot:
29B0: DD 7E 00        LD      A,(IX+$00)          
29B3: A7              AND     A                   
29B4: C8              RET     Z                   
29B5: 3C              INC     A                   
29B6: 28 07           JR      Z,$29BF             ; {code.loc_29bf}
29B8: 3C              INC     A                   
29B9: CA 52 2B        JP      Z,$2B52             ; {code.releaseHeldObject}
29BC: C3 93 2B        JP      $2B93               ; {code.stepDyingObjectState}

loc_29bf:
29BF: CD EF 2B        CALL    $2BEF               ; {code.steerTowardAimHeading}
29C2: CD A4 58        CALL    $58A4               ; {code.loc_58a4}
29C5: CD 83 2B        CALL    $2B83               ; {code.hasReachedRetireLine}
29C8: DA DE 2B        JP      C,$2BDE             ; {code.retireSlotAndSubPixel}
29CB: CD D6 3E        CALL    $3ED6               ; {code.launchBankEnemyWhenAimedNearPlayer}
29CE: CD FC 2A        CALL    $2AFC               ; {code.dressSpriteForCoarseHeading}
29D1: CD 43 42        CALL    $4243               ; {code.launchAttackerIntoFreeSlot}
29D4: C9              RET                         

; era-4 (ERA_INDEX 0xad04=4) per-object slot service, index 4 of the
; 0x2914 rst-0x30 table: on the slot's lifecycle byte at (ix+0) it returns
; when free (0), releases when held (0xfe), steps the dying animation for
; any other value, and when live (0xff) steers the slot toward the ship
; then either retires it once it reaches a retire line or animates its
; shape, runs the gated launch attempt, and launches an attacker into a
; free slot
serviceEra4EnemyCraftSlot:
29D5: DD 7E 00        LD      A,(IX+$00)          
29D8: A7              AND     A                   
29D9: C8              RET     Z                   
29DA: 3C              INC     A                   
29DB: 28 07           JR      Z,$29E4             ; {code.loc_29e4}
29DD: 3C              INC     A                   
29DE: CA 52 2B        JP      Z,$2B52             ; {code.releaseHeldObject}
29E1: C3 93 2B        JP      $2B93               ; {code.stepDyingObjectState}

loc_29e4:
29E4: CD F7 29        CALL    $29F7               ; {code.steerEnemyTowardShip}
29E7: CD 83 2B        CALL    $2B83               ; {code.hasReachedRetireLine}
29EA: DA DE 2B        JP      C,$2BDE             ; {code.retireSlotAndSubPixel}
29ED: CD 38 2B        CALL    $2B38               ; {code.animateSelectedShapeCycle}
29F0: CD D6 3E        CALL    $3ED6               ; {code.launchBankEnemyWhenAimedNearPlayer}
29F3: CD 43 42        CALL    $4243               ; {code.launchAttackerIntoFreeSlot}
29F6: C9              RET                         

; steer one live slot toward its aim heading then fly it a step; when the
; slot's probe cell (iy+0x31) lies within a fixed window of either
; reference point the turn runs with the shared turn-rate index forced to
; zero then reseated to four, else at the standing index, and the step
; alternates a double- and a single-velocity mover on bit 1 of the frame
; tick
steerEnemyTowardShip:
29F7: 3E 78           LD      A,$78               
29F9: FD 96 31        SUB     (IY+$31)            
29FC: C6 48           ADD     A,$48               
29FE: FE 90           CP      $90                 
2A00: 38 1A           JR      C,$2A1C             ; {code.loc_2a1c}
2A02: 3E 84           LD      A,$84               
2A04: FD 96 31        SUB     (IY+$31)            
2A07: C6 48           ADD     A,$48               
2A09: FE 90           CP      $90                 
2A0B: 38 0F           JR      C,$2A1C             ; {code.loc_2a1c}
2A0D: CD EF 2B        CALL    $2BEF               ; {code.steerTowardAimHeading}

loc_2a10:
2A10: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
2A13: 0F              RRCA                        
2A14: E6 01           AND     $01                 
2A16: CA AA 58        JP      Z,$58AA             ; {code.loc_58aa}
2A19: C3 60 58        JP      $5860               ; {code.loc_5860}

loc_2a1c:
2A1C: AF              XOR     A                   
2A1D: 32 04 AD        LD      ($AD04),A           ; {hard.workRam+504}
2A20: CD EF 2B        CALL    $2BEF               ; {code.steerTowardAimHeading}
2A23: 3E 04           LD      A,$04               
2A25: 32 04 AD        LD      ($AD04),A           ; {hard.workRam+504}
2A28: 18 E6           JR      $2A10               ; {code.loc_2a10}

; ---- $2A2A-$2A3B: data ----
2A2A: DD 7E 04 3D CA 93 2B DD 77 04 DD 36 00 FF CD BA
2A3A: 2B C9

; store the shape byte and the attribute byte that show an object pointing
; the way it is heading into that object's own sprite entry
refreshSpriteFromHeading:
2A3C: CD 57 2A        CALL    $2A57               ; {code.spriteForHeading}
2A3F: FD 71 30        LD      (IY+$30),C          
2A42: 78              LD      A,B                 
2A43: FD 77 01        LD      (IY+$01),A          
2A46: C9              RET                         

; show one of the second era's enemy craft pointing the way it is heading:
; the shared heading lookup picks a shape and the byte beside it, and each
; is stored into the object's own sprite entry shifted by a fixed bias --
; sixteen on the shape, fifty-three on the attribute -- so this era's
; craft is drawn from its own block of the sprite ROM in its own colour.
; The attribute's two flip bits survive the addition because every entry
; of the lookup's attribute table carries the same low colour field, so
; the bias moves the colour and leaves the facing alone
refreshSecondEraSpriteFromHeading:
2A47: CD 57 2A        CALL    $2A57               ; {code.spriteForHeading}
2A4A: 79              LD      A,C                 
2A4B: C6 35           ADD     A,$35               
2A4D: FD 77 30        LD      (IY+$30),A          
2A50: 78              LD      A,B                 
2A51: C6 10           ADD     A,$10               
2A53: FD 77 01        LD      (IY+$01),A          
2A56: C9              RET                         

; pick the sprite shape, and the byte beside it, that show an object
; pointing the way it is heading, alternating between two shape banks as a
; frame counter's bit turns over
spriteForHeading:
2A57: 11 10 00        LD      DE,$0010            
2A5A: DD 7E 02        LD      A,(IX+$02)          
2A5D: C6 08           ADD     A,$08               
2A5F: 0F              RRCA                        
2A60: 0F              RRCA                        
2A61: 0F              RRCA                        
2A62: 0F              RRCA                        
2A63: E6 0F           AND     $0F                 
2A65: 21 77 2A        LD      HL,$2A77            
2A68: DF              RST     $18                 
2A69: 46              LD      B,(HL)              
2A6A: 19              ADD     HL,DE               
2A6B: 4E              LD      C,(HL)              
2A6C: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
2A6F: CB 4F           BIT     1,A                 
2A71: C8              RET     Z                   
2A72: 78              LD      A,B                 
2A73: C6 08           ADD     A,$08               
2A75: 47              LD      B,A                 
2A76: C9              RET                         

; ---- $2A77-$2A96: data ----
2A77: 0C 0D 0E 0F 08 0F 0E 0D 0C 0B 0A 09 08 09 0A 0B
2A87: 41 41 41 41 81 C1 C1 C1 C1 C1 C1 C1 41 41 41 41

; dress one sprite entry to face the way its object is heading, resolving
; the heading to thirty-two sectors and writing the shape code and the
; attribute beside it directly into the entry, alternating between two
; shape banks as a frame counter's bit turns over
dressSpriteForFineHeading:
2A97: DD 7E 02        LD      A,(IX+$02)          
2A9A: C6 04           ADD     A,$04               
2A9C: E6 F8           AND     $F8                 
2A9E: 0F              RRCA                        
2A9F: 0F              RRCA                        
2AA0: E6 3F           AND     $3F                 
2AA2: 21 BC 2A        LD      HL,$2ABC            
2AA5: DF              RST     $18                 
2AA6: 46              LD      B,(HL)              
2AA7: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
2AAA: E6 02           AND     $02                 
2AAC: 20 0A           JR      NZ,$2AB8            ; {code.loc_2ab8}

loc_2aae:
2AAE: 80              ADD     A,B                 
2AAF: FD 77 01        LD      (IY+$01),A          
2AB2: 23              INC     HL                  
2AB3: 7E              LD      A,(HL)              
2AB4: FD 77 30        LD      (IY+$30),A          
2AB7: C9              RET                         

loc_2ab8:
2AB8: 3E 08           LD      A,$08               
2ABA: 18 F2           JR      $2AAE               ; {code.loc_2aae}

; ---- $2ABC-$2AFB: data ----
2ABC: 80 DC 80 DC 80 DC 80 DC 81 DC 81 DC 82 DC 83 DC
2ACC: 84 5C 84 5C 83 5C 82 5C 81 5C 81 5C 80 5C 80 5C
2ADC: 80 5C 80 5C 80 5C 80 5C 81 5C 81 5C 82 5C 83 5C
2AEC: 84 DC 84 DC 83 DC 82 DC 81 DC 81 DC 80 DC 80 DC

; point an object's sprite the way it is heading, by rounding its heading
; byte to the nearest of sixteen sectors and taking a shape pair from two
; parallel tables
dressSpriteForCoarseHeading:
2AFC: 11 10 00        LD      DE,$0010            
2AFF: DD 7E 02        LD      A,(IX+$02)          
2B02: C6 08           ADD     A,$08               
2B04: 0F              RRCA                        
2B05: 0F              RRCA                        
2B06: 0F              RRCA                        
2B07: 0F              RRCA                        
2B08: E6 0F           AND     $0F                 
2B0A: 21 18 2B        LD      HL,$2B18            
2B0D: DF              RST     $18                 
2B0E: 7E              LD      A,(HL)              
2B0F: FD 77 01        LD      (IY+$01),A          
2B12: 19              ADD     HL,DE               
2B13: 7E              LD      A,(HL)              
2B14: FD 77 30        LD      (IY+$30),A          
2B17: C9              RET                         

; ---- $2B18-$2B37: data ----
2B18: 2C 2D 2E 2F 28 2F 2E 2D 2C 2B 2A 29 28 29 2A 2B
2B28: 5B 5B 5B 5B 9B DB DB DB DB DB DB DB 5B 5B 5B 5B

; give one sprite entry the current frame of a four-frame shape cycle,
; from the block a record byte selects, and one fixed attribute beside it
animateSelectedShapeCycle:
2B38: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
2B3B: 0F              RRCA                        
2B3C: 0F              RRCA                        
2B3D: E6 03           AND     $03                 
2B3F: C6 D8           ADD     A,$D8               
2B41: 47              LD      B,A                 
2B42: DD 7E 04        LD      A,(IX+$04)          
2B45: D6 01           SUB     $01                 
2B47: 87              ADD     A,A                 
2B48: 87              ADD     A,A                 
2B49: 80              ADD     A,B                 
2B4A: FD 77 01        LD      (IY+$01),A          
2B4D: FD 36 30 61     LD      (IY+$30),$61        
2B51: C9              RET                         

; count a held object's release delay down and, when it expires, step its
; state code to the live one and re-arm the delay
releaseHeldObject:
2B52: DD 35 0E        DEC     (IX+$0E)            
2B55: 28 01           JR      Z,$2B58             ; {code.loc_2b58}
2B57: C9              RET                         

loc_2b58:
2B58: DD 34 00        INC     (IX+$00)            
2B5B: DD 36 0E 80     LD      (IX+$0E),$80        
2B5F: C9              RET                         

; add the frame's world-scroll displacement to one object's two split
; 16-bit coordinates
driftWithWorldScroll:
2B60: FD 66 31        LD      H,(IY+$31)          
2B63: DD 6E 03        LD      L,(IX+$03)          
2B66: ED 5B 08 A8     LD      DE,($A808)          ; {hard.workRam+8}
2B6A: 19              ADD     HL,DE               
2B6B: FD 74 31        LD      (IY+$31),H          
2B6E: DD 75 03        LD      (IX+$03),L          
2B71: FD 66 00        LD      H,(IY+$00)          
2B74: DD 6E 05        LD      L,(IX+$05)          
2B77: ED 5B 0A A8     LD      DE,($A80A)          ; {hard.workRam+A}
2B7B: 19              ADD     HL,DE               
2B7C: FD 74 00        LD      (IY+$00),H          
2B7F: DD 75 05        LD      (IX+$05),L          
2B82: C9              RET                         

; answer whether an actor has drifted onto either of two fixed retire
; lines, within a narrow wrapped window, which is what makes its caller
; free the slot
hasReachedRetireLine:
2B83: FD 7E 31        LD      A,(IY+$31)          
2B86: C6 09           ADD     A,$09               
2B88: FE 03           CP      $03                 
2B8A: D8              RET     C                   
2B8B: FD 7E 00        LD      A,(IY+$00)          
2B8E: D6 03           SUB     $03                 
2B90: FE 03           CP      $03                 
2B92: C9              RET                         

; per-object state-machine step: dispatch on the object's state byte —
; 0xf0 re-arms it to 0x3b and begins its death, 0x3c begins the death then
; flies it on, above 0x3c flies it on, below 0x3c counts the byte down,
; retiring the slot at zero else moving the object for the frame
stepDyingObjectState:
2B93: DD 7E 00        LD      A,(IX+$00)          
2B96: FE F0           CP      $F0                 
2B98: CA AC 2B        JP      Z,$2BAC             ; {code.loc_2bac}
2B9B: FE 3C           CP      $3C                 
2B9D: CC BA 2B        CALL    Z,$2BBA             ; {code.countTheKillAndGrantTheSharedToken}
2BA0: D2 B4 2B        JP      NC,$2BB4            ; {code.decrementObjectStateThenFlyAtSlowestSpeed}
2BA3: DD 35 00        DEC     (IX+$00)            
2BA6: 28 36           JR      Z,$2BDE             ; {code.retireSlotAndSubPixel}
2BA8: CD 22 2C        CALL    $2C22               ; {code.moveObjectByStateByteThenRunAppearance}

; ---- $2BAB-$2BAB: data ----
2BAB: C9

loc_2bac:
2BAC: DD 36 00 3B     LD      (IX+$00),$3B        
2BB0: CD BA 2B        CALL    $2BBA               ; {code.countTheKillAndGrantTheSharedToken}
2BB3: C9              RET                         

; count an object's state byte down by one and let it fly on at the
; slowest of the velocity-table speeds; the countdown wraps at a byte and
; nothing here tests it, so reaching zero is the caller's business. Both
; entries into it are on the path a slot takes once its state byte is
; neither free, live nor held
decrementObjectStateThenFlyAtSlowestSpeed:
2BB4: DD 35 00        DEC     (IX+$00)            
2BB7: C3 40 58        JP      $5840               ; {code.flyAtSlowestSpeed}

; the tick a hit object's death begins: ask for the pair of death sounds
; and take one off the round's kill quota -- both UNCONDITIONAL -- and
; then, only past three guards, grant this record the single-holder token
; at 0xA821, its own slot ordinal marked with a top bit. The guards are
; the record's cooldown byte carrying its top bit, the shared arming cell
; being set, and the shared countdown beside it reaching zero on this
; step; the countdown is spent whenever the first two pass, so every
; claimant spends a tick and not only the one that wins. The quota is
; floored rather than wrapped -- a count already at zero is left alone
countTheKillAndGrantTheSharedToken:
2BBA: CD 83 56        CALL    $5683               ; {code.requestTwoSounds}
2BBD: 21 02 AD        LD      HL,$AD02            
2BC0: 7E              LD      A,(HL)              
2BC1: A7              AND     A                   
2BC2: 28 01           JR      Z,$2BC5             ; {code.loc_2bc5}
2BC4: 35              DEC     (HL)                

loc_2bc5:
2BC5: DD 7E 0E        LD      A,(IX+$0E)          
2BC8: CB 7F           BIT     7,A                 
2BCA: C8              RET     Z                   
2BCB: 3A 12 A8        LD      A,($A812)           ; {hard.workRam+12}
2BCE: A7              AND     A                   
2BCF: C8              RET     Z                   
2BD0: 21 11 A8        LD      HL,$A811            
2BD3: 35              DEC     (HL)                
2BD4: C0              RET     NZ                  
2BD5: DD 7E 0F        LD      A,(IX+$0F)          
2BD8: C6 80           ADD     A,$80               
2BDA: 32 21 A8        LD      ($A821),A           ; {hard.workRam+21}
2BDD: C9              RET                         

; take an object out of play, zeroing each coordinate WHOLE — occupancy
; byte, both sub-pixel remainders, and both sprite-entry coordinates
retireSlotAndSubPixel:
2BDE: AF              XOR     A                   
2BDF: DD 77 00        LD      (IX+$00),A          
2BE2: DD 77 03        LD      (IX+$03),A          
2BE5: DD 77 05        LD      (IX+$05),A          
2BE8: FD 77 00        LD      (IY+$00),A          
2BEB: FD 77 31        LD      (IY+$31),A          
2BEE: C9              RET                         

; turn an object's heading one step toward the heading it aims at, the
; short way round, at a rate a small table supplies for the current mode
; cell
steerTowardAimHeading:
2BEF: DD 7E 01        LD      A,(IX+$01)          
2BF2: DD 96 02        SUB     (IX+$02)            
2BF5: 4F              LD      C,A                 
2BF6: C6 02           ADD     A,$02               
2BF8: FE 04           CP      $04                 
2BFA: D8              RET     C                   
2BFB: DD 46 02        LD      B,(IX+$02)          
2BFE: 79              LD      A,C                 
2BFF: FE 80           CP      $80                 
2C01: 30 0C           JR      NC,$2C0F            ; {code.loc_2c0f}
2C03: 21 1D 2C        LD      HL,$2C1D            
2C06: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
2C09: CF              RST     $08                 
2C0A: 80              ADD     A,B                 
2C0B: DD 77 02        LD      (IX+$02),A          
2C0E: C9              RET                         

loc_2c0f:
2C0F: 21 1D 2C        LD      HL,$2C1D            
2C12: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
2C15: CF              RST     $08                 
2C16: 90              SUB     B                   
2C17: ED 44           NEG                         
2C19: DD 77 02        LD      (IX+$02),A          
2C1C: C9              RET                         

; ---- $2C1D-$2C21: data ----
2C1D: 01 01 02 02 05

; move one object for the frame according to its state byte, then run the
; shared appearance step over that same object: from thirty-two up it
; counts the state byte down and flies on at the slowest table speed,
; below thirty-two it only drifts with the world and the state byte is
; left alone; the appearance step runs on both paths
moveObjectByStateByteThenRunAppearance:
2C22: 21 31 2C        LD      HL,$2C31            
2C25: E5              PUSH    HL                  
2C26: DD 7E 00        LD      A,(IX+$00)          
2C29: FE 20           CP      $20                 
2C2B: D2 B4 2B        JP      NC,$2BB4            ; {code.decrementObjectStateThenFlyAtSlowestSpeed}
2C2E: C3 60 2B        JP      $2B60               ; {code.driftWithWorldScroll}

; ---- $2C31-$2CBB: data ----
2C31: DD 7E 00 FE 2A D2 71 2C FE 0A 30 45 3A 21 A8 CB
2C41: 7F CA DE 2B 3A 21 A8 CB BF DD BE 0F C2 DE 2B 3A
2C51: 80 A9 E6 07 28 03 DD 34 00 FD 36 01 FC FD 36 30
2C61: 6C DD 7E 00 FE 01 C0 11 0C 04 FF AF 32 21 A8 C9
2C71: FD 7E 30 4F E6 C0 47 3A 80 A9 E6 0F 80 FD 77 30
2C81: C9 D6 0A 0F E6 0F 47 21 94 2C CF FD 77 01 FD 36
2C91: 30 3C C9 FF FF 7D 7D 7E 7E 7D 7D 5B 5B 5A 5A 59
2CA1: 59 58 58 18 A7 13 A5 3B 87 F1 34 0E 34 D7 BF F1
2CB1: 65 13 13 13 13 F1 88 DC ED 11 B9

; seat the record cursor and the sprite-entry cursor on the first scenery
; slot, then run one of three fixed lists of parallax wrappers, chosen by
; the era index
runSceneryForEra:
2CBC: DD 21 00 A9     LD      IX,$A900            
2CC0: FD 21 30 AA     LD      IY,$AA30            
2CC4: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
2CC7: A7              AND     A                   
2CC8: 28 2B           JR      Z,$2CF5             ; {code.loc_2cf5}
2CCA: FE 04           CP      $04                 
2CCC: 28 34           JR      Z,$2D02             ; {code.loc_2d02}
2CCE: CD 21 2D        CALL    $2D21               ; {code.driftNearestSceneryTriTile}
2CD1: CD 36 2D        CALL    $2D36               ; {code.driftTwoTileSceneryAtThreeQuarters}
2CD4: CD 36 2D        CALL    $2D36               ; {code.driftTwoTileSceneryAtThreeQuarters}
2CD7: CD 68 2D        CALL    $2D68               ; {code.driftOneTileSceneryAtHalf}
2CDA: C9              RET                         

; one turn of the line wipe, and on the turn that finishes it, one tamper
; test: a single line is blanked per turn and the turn ends there while
; lines are still owed; the turn that clears the last one folds a fixed
; 1024-byte span of the program image together with exclusive-or into an
; eight-bit total and compares it against the total an untampered image
; gives. Matching steps the sequence's INNER index, so the sequence
; carries on; not matching steps the OUTER phase instead, restarting the
; inner index somewhere else entirely -- derailing the sequence rather
; than halting it
blankOneLineThenGuardBlockOrDerailSequence:
2CDB: CD C2 01        CALL    $01C2               ; {code.blankNextLine}
2CDE: C0              RET     NZ                  
2CDF: 01 04 00        LD      BC,$0004            
2CE2: 21 80 49        LD      HL,$4980            
2CE5: 97              SUB     A                   

loc_2ce6:
2CE6: AE              XOR     (HL)                
2CE7: 23              INC     HL                  
2CE8: 10 FC           DJNZ    $2CE6               ; {code.loc_2ce6}
2CEA: 0D              DEC     C                   
2CEB: 20 F9           JR      NZ,$2CE6            ; {code.loc_2ce6}
2CED: C6 BD           ADD     A,$BD               
2CEF: C2 11 0F        JP      NZ,$0F11            ; {code.advanceSequencePhase}
2CF2: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

loc_2cf5:
2CF5: CD 15 2D        CALL    $2D15               ; {code.driftThreeTileSceneryAtFiveQuarters}
2CF8: CD 36 2D        CALL    $2D36               ; {code.driftTwoTileSceneryAtThreeQuarters}
2CFB: CD 36 2D        CALL    $2D36               ; {code.driftTwoTileSceneryAtThreeQuarters}
2CFE: CD 68 2D        CALL    $2D68               ; {code.driftOneTileSceneryAtHalf}
2D01: C9              RET                         

loc_2d02:
2D02: CD 2D 2D        CALL    $2D2D               ; {code.stepTwoTileSceneryAtFiveQuarters}
2D05: CD 2D 2D        CALL    $2D2D               ; {code.stepTwoTileSceneryAtFiveQuarters}
2D08: CD 62 2D        CALL    $2D62               ; {code.driftOneTileSceneryAtThreeQuarters}
2D0B: CD 62 2D        CALL    $2D62               ; {code.driftOneTileSceneryAtThreeQuarters}
2D0E: CD 68 2D        CALL    $2D68               ; {code.driftOneTileSceneryAtHalf}
2D11: CD 68 2D        CALL    $2D68               ; {code.driftOneTileSceneryAtHalf}
2D14: C9              RET                         

; drift one scenery object at five quarters of the frame's world scroll,
; lay two further tiles flush against it in a straight strip, and step
; both cursors past the object so the caller lands on the next slot
driftThreeTileSceneryAtFiveQuarters:
2D15: CD 6E 2D        CALL    $2D6E               ; {code.driftAtFiveQuartersWorldScroll}
2D18: CD 58 30        CALL    $3058               ; {code.placeAbuttingTile}
2D1B: CD 58 30        CALL    $3058               ; {code.placeAbuttingTile}
2D1E: C3 9B 30        JP      $309B               ; {code.advanceToNextSlot}

; drift one scenery object with the world scroll over-travelled by a
; quarter, then lay the tile abutting it and the one cornering it
; diagonally (three corners of a square) and step both cursors one slot
; past
driftNearestSceneryTriTile:
2D21: CD 6E 2D        CALL    $2D6E               ; {code.driftAtFiveQuartersWorldScroll}
2D24: CD 58 30        CALL    $3058               ; {code.placeAbuttingTile}
2D27: CD 8A 30        CALL    $308A               ; {code.placeDiagonallyAbuttingTile}
2D2A: C3 9B 30        JP      $309B               ; {code.advanceToNextSlot}

; advance one two-tile scenery object: drift it at five quarters of the
; world scroll, lay its second tile flush against the first, and step both
; cursors past the pair
stepTwoTileSceneryAtFiveQuarters:
2D2D: CD 6E 2D        CALL    $2D6E               ; {code.driftAtFiveQuartersWorldScroll}
2D30: CD 58 30        CALL    $3058               ; {code.placeAbuttingTile}
2D33: C3 9B 30        JP      $309B               ; {code.advanceToNextSlot}

; drift one scenery object at three quarters of the frame's world scroll,
; place a second tile flush against it, and step both cursors past the
; object so the caller lands on the next slot
driftTwoTileSceneryAtThreeQuarters:
2D36: CD 93 2D        CALL    $2D93               ; {code.driftAtThreeQuartersWorldScroll}
2D39: CD 58 30        CALL    $3058               ; {code.placeAbuttingTile}
2D3C: C3 9B 30        JP      $309B               ; {code.advanceToNextSlot}

; one sequence step that puts the credit line up: while FREE_PLAY is set
; it does nothing but move the sequence's inner index on; otherwise it
; repaints the panel field from the packed-decimal credit count at 0xA986,
; queues caption record 8 -- whose glyph run reads CREDIT -- and then
; reads a guard byte that decides everything after. Anything but zero
; transfers to 0x2E3E, which carries no routine, so that transfer RAISES
; rather than running; zero stamps the copyright strip into the display
; list, asks for its line in this frame's colour, and folds the twenty-
; byte run at 0x086B into a total for the chain that judges it. What
; writes the guard byte is not established here
showCreditLine:
2D3F: 3A C0 A9        LD      A,($A9C0)           ; {hard.workRam+1C0}
2D42: A7              AND     A                   
2D43: C2 1A 0F        JP      NZ,$0F1A            ; {code.advanceSequenceSubStep}
2D46: CD FB 4A        CALL    $4AFB               ; {code.paintCreditCountPanel}
2D49: 11 08 01        LD      DE,$0108            
2D4C: FF              RST     $38                 
2D4D: 3A 17 A8        LD      A,($A817)           ; {hard.workRam+17}
2D50: A7              AND     A                   
2D51: C2 3E 2E        JP      NZ,$2E3E            ; {code.loc_2e3e}
2D54: CD 06 0B        CALL    $0B06               ; {code.stampCopyrightStrip}
2D57: CD 39 0B        CALL    $0B39               ; {code.flashCopyrightLine}
2D5A: 21 6B 08        LD      HL,$086B            
2D5D: 06 14           LD      B,$14               
2D5F: C3 E8 43        JP      $43E8               ; {code.sumImageBlockForTheTamperCheck}

; drift one scenery object at three quarters of the frame's world scroll,
; lay no further tile, and step both cursors onto the next slot
driftOneTileSceneryAtThreeQuarters:
2D62: CD 93 2D        CALL    $2D93               ; {code.driftAtThreeQuartersWorldScroll}
2D65: C3 9B 30        JP      $309B               ; {code.advanceToNextSlot}

; drift one scenery object at half the frame's world-scroll displacement,
; lay no further tile, and step both cursors onto the next slot -- the
; one-tile member of the parallax family, and the slowest rung, so what it
; moves reads as the farthest layer
driftOneTileSceneryAtHalf:
2D68: CD F4 2D        CALL    $2DF4               ; {code.driftAtHalfWorldScroll}
2D6B: C3 9B 30        JP      $309B               ; {code.advanceToNextSlot}

; move one object by the frame's world-scroll displacement and a further
; quarter of it, so it over-travels the world; applied to both of its
; split coordinates, whole part in the sprite entry and fraction in the
; object record
driftAtFiveQuartersWorldScroll:
2D6E: FD 56 31        LD      D,(IY+$31)          
2D71: DD 5E 03        LD      E,(IX+$03)          
2D74: 2A 08 A8        LD      HL,($A808)          ; {hard.workRam+8}
2D77: CD 31 2E        CALL    $2E31               ; {code.displaceByFiveQuarters}
2D7A: FD 74 31        LD      (IY+$31),H          
2D7D: DD 75 03        LD      (IX+$03),L          
2D80: FD 56 00        LD      D,(IY+$00)          
2D83: DD 5E 05        LD      E,(IX+$05)          
2D86: 2A 0A A8        LD      HL,($A80A)          ; {hard.workRam+A}
2D89: CD 31 2E        CALL    $2E31               ; {code.displaceByFiveQuarters}
2D8C: FD 74 00        LD      (IY+$00),H          
2D8F: DD 75 05        LD      (IX+$05),L          
2D92: C9              RET                         

; move one object by three quarters of the frame's world-scroll
; displacement, applied to both of its split coordinates, whole part in
; the sprite entry and fraction in the object record
driftAtThreeQuartersWorldScroll:
2D93: FD 56 31        LD      D,(IY+$31)          
2D96: DD 5E 03        LD      E,(IX+$03)          
2D99: 2A 08 A8        LD      HL,($A808)          ; {hard.workRam+8}
2D9C: CD 3E 30        CALL    $303E               ; {code.displaceByThreeQuarters}
2D9F: FD 74 31        LD      (IY+$31),H          
2DA2: DD 75 03        LD      (IX+$03),L          
2DA5: FD 56 00        LD      D,(IY+$00)          
2DA8: DD 5E 05        LD      E,(IX+$05)          
2DAB: 2A 0A A8        LD      HL,($A80A)          ; {hard.workRam+A}
2DAE: CD 3E 30        CALL    $303E               ; {code.displaceByThreeQuarters}
2DB1: FD 74 00        LD      (IY+$00),H          
2DB4: DD 75 05        LD      (IX+$05),L          
2DB7: C9              RET                         

; start the next round: step the round number, roll the era on and wrap it
; after the fifth, set the round's difficulty byte from one of three
; sources by round bracket, refill the kill quota, and clear two flags
; while arming a third
startNextRound:
2DB8: 21 01 AD        LD      HL,$AD01            
2DBB: 34              INC     (HL)                
2DBC: 21 04 AD        LD      HL,$AD04            
2DBF: 7E              LD      A,(HL)              
2DC0: 3C              INC     A                   
2DC1: FE 05           CP      $05                 
2DC3: 38 01           JR      C,$2DC6             ; {code.loc_2dc6}
2DC5: AF              XOR     A                   

loc_2dc6:
2DC6: 77              LD      (HL),A              
2DC7: 3A 01 AD        LD      A,($AD01)           ; {hard.workRam+501}
2DCA: FE 06           CP      $06                 
2DCC: 38 09           JR      C,$2DD7             ; {code.loc_2dd7}
2DCE: FE 0B           CP      $0B                 
2DD0: 38 0A           JR      C,$2DDC             ; {code.loc_2ddc}
2DD2: 3A D5 A9        LD      A,($A9D5)           ; {hard.workRam+1D5}
2DD5: 18 08           JR      $2DDF               ; {code.loc_2ddf}

loc_2dd7:
2DD7: 3A D3 A9        LD      A,($A9D3)           ; {hard.workRam+1D3}
2DDA: 18 03           JR      $2DDF               ; {code.loc_2ddf}

loc_2ddc:
2DDC: 3A D4 A9        LD      A,($A9D4)           ; {hard.workRam+1D4}

loc_2ddf:
2DDF: 32 0A AD        LD      ($AD0A),A           ; {hard.workRam+50A}
2DE2: 3A CD A9        LD      A,($A9CD)           ; {hard.workRam+1CD}
2DE5: 32 02 AD        LD      ($AD02),A           ; {hard.workRam+502}
2DE8: AF              XOR     A                   
2DE9: 32 0D AD        LD      ($AD0D),A           ; {hard.workRam+50D}
2DEC: 32 C6 AC        LD      ($ACC6),A           ; {hard.workRam+4C6}
2DEF: 3D              DEC     A                   
2DF0: 32 0E AD        LD      ($AD0E),A           ; {hard.workRam+50E}
2DF3: C9              RET                         

; move one object by half the frame's world-scroll displacement, applied
; to both of its split coordinates, whole part in the sprite entry and
; fraction in the object record
driftAtHalfWorldScroll:
2DF4: FD 56 31        LD      D,(IY+$31)          
2DF7: DD 5E 03        LD      E,(IX+$03)          
2DFA: 2A 08 A8        LD      HL,($A808)          ; {hard.workRam+8}
2DFD: CD 4D 30        CALL    $304D               ; {code.displaceByHalf}
2E00: FD 74 31        LD      (IY+$31),H          
2E03: DD 75 03        LD      (IX+$03),L          
2E06: FD 56 00        LD      D,(IY+$00)          
2E09: DD 5E 05        LD      E,(IX+$05)          
2E0C: 2A 0A A8        LD      HL,($A80A)          ; {hard.workRam+A}
2E0F: CD 4D 30        CALL    $304D               ; {code.displaceByHalf}
2E12: FD 74 00        LD      (IY+$00),H          
2E15: DD 75 05        LD      (IX+$05),L          
2E18: C9              RET                         

; open the settings block: store, whole, the byte the caller has already
; worked out from the switch port's low two bits, then peel the next two
; switch bits into a cell each, one bit per cell and nothing else in it,
; and hand the byte on rotated so the last bit spent sits lowest -- twice
; over, in both registers that carry it -- to the continuation that peels
; the rest. Nothing is read from memory and control never comes back. ★
; 'Switch settings' is established at the CALLER and at the three cells'
; readers, not inside a routine that reads no memory at all: the caller at
; 0x52C0-0x52CF is `ld a,(0xc200) / cpl / ld c,a / and 0x03 / add a,0x03 /
; cp 0x06 / jr nz,+2 / ld a,0xff / jp 0x2e19`, so C arrives as the
; complemented DSW port and A as 3, 4, 5 or the folded 0xFF
unpackTheFirstThreeSwitchSettings:
2E19: 32 C1 A9        LD      ($A9C1),A           ; {hard.workRam+1C1}
2E1C: 79              LD      A,C                 
2E1D: 0F              RRCA                        
2E1E: 0F              RRCA                        
2E1F: 4F              LD      C,A                 
2E20: E6 01           AND     $01                 
2E22: 32 C2 A9        LD      ($A9C2),A           ; {hard.workRam+1C2}
2E25: 79              LD      A,C                 
2E26: 0F              RRCA                        
2E27: 4F              LD      C,A                 
2E28: E6 01           AND     $01                 
2E2A: 32 C3 A9        LD      ($A9C3),A           ; {hard.workRam+1C3}
2E2D: 79              LD      A,C                 
2E2E: C3 A8 49        JP      $49A8               ; {code.finishBootSelfTestAndColdStart}

; move a coordinate by a displacement and a further quarter of it, so what
; it carries leads what moves by the whole of it; the quarter rounds down
; rather than toward zero
displaceByFiveQuarters:
2E31: 44              LD      B,H                 
2E32: 4D              LD      C,L                 
2E33: CB 28           SRA     B                   
2E35: CB 19           RR      C                   
2E37: CB 28           SRA     B                   
2E39: CB 19           RR      C                   
2E3B: 09              ADD     HL,BC               
2E3C: 19              ADD     HL,DE               
2E3D: C9              RET                         

loc_2e3e:
2E3E: 32 01 31        LD      ($3101),A           ; {hard.rom+3101}
2E41: 01 30 01        LD      BC,$0130            
2E44: 2F              CPL                         
2E45: 01 2E 01        LD      BC,$012E            
2E48: 2D              DEC     L                   
2E49: 01 2C 01        LD      BC,$012C            
2E4C: 28 01           JR      Z,$2E4F             
2E4E: 26 01           LD      H,$01               
2E50: 24              INC     H                   
2E51: 01 22 01        LD      BC,$0122            
2E54: 20 01           JR      NZ,$2E57            ; {code.loc_2e57}
2E56: 1B              DEC     DE                  

loc_2e57:
2E57: 01 18 01        LD      BC,$0118            
2E5A: 16 01           LD      D,$01               
2E5C: 11 01 0E        LD      DE,$0E01            
2E5F: 01 0B 01        LD      BC,$010B            
2E62: 08              EX      AF,AF'              
2E63: 01 03 01        LD      BC,$0103            
2E66: 00              NOP                         
2E67: 01 FD 00        LD      BC,$00FD            
2E6A: F8              RET     M                   
2E6B: 00              NOP                         
2E6C: F5              PUSH    AF                  
2E6D: 00              NOP                         
2E6E: F2 00 ED        JP      P,$ED00             
2E71: 00              NOP                         
2E72: EA 00 E7        JP      PE,$E700            
2E75: 00              NOP                         
2E76: E4 00 DF        CALL    PO,$DF00            
2E79: 00              NOP                         
2E7A: DC 00 D9        CALL    C,$D900             
2E7D: 00              NOP                         
2E7E: D4 00 D1        CALL    NC,$D100            
2E81: 00              NOP                         
2E82: CD 00 C8        CALL    $C800               
2E85: 00              NOP                         
2E86: C5              PUSH    BC                  
2E87: 00              NOP                         
2E88: C1              POP     BC                  
2E89: 00              NOP                         
2E8A: BB              CP      E                   
2E8B: 00              NOP                         
2E8C: B7              OR      A                   
2E8D: 00              NOP                         
2E8E: B4              OR      H                   
2E8F: 00              NOP                         
2E90: AE              XOR     (HL)                
2E91: 00              NOP                         
2E92: A8              XOR     B                   
2E93: 00              NOP                         
2E94: A1              AND     C                   
2E95: 00              NOP                         
2E96: 9C              SBC     A,H                 
2E97: 00              NOP                         
2E98: 93              SUB     E                   
2E99: 00              NOP                         
2E9A: 90              SUB     B                   
2E9B: 00              NOP                         
2E9C: 88              ADC     A,B                 
2E9D: 00              NOP                         
2E9E: 80              ADD     A,B                 
2E9F: 00              NOP                         
2EA0: 7A              LD      A,D                 
2EA1: 00              NOP                         
2EA2: 72              LD      (HL),D              
2EA3: 00              NOP                         
2EA4: 69              LD      L,C                 
2EA5: 00              NOP                         
2EA6: 63              LD      H,E                 
2EA7: 00              NOP                         
2EA8: 5A              LD      E,D                 
2EA9: 00              NOP                         
2EAA: 51              LD      D,C                 
2EAB: 00              NOP                         
2EAC: 4A              LD      C,D                 
2EAD: 00              NOP                         
2EAE: 40              LD      B,B                 
2EAF: 00              NOP                         
2EB0: 37              SCF                         
2EB1: 00              NOP                         
2EB2: 30 00           JR      NC,$2EB4            ; {code.loc_2eb4}

loc_2eb4:
2EB4: 26 00           LD      H,$00               
2EB6: 1C              INC     E                   
2EB7: 00              NOP                         
2EB8: 12              LD      (DE),A              
2EB9: 00              NOP                         
2EBA: 08              EX      AF,AF'              
2EBB: 00              NOP                         
2EBC: 00              NOP                         
2EBD: 00              NOP                         
2EBE: 00              NOP                         
2EBF: 00              NOP                         
2EC0: F8              RET     M                   
2EC1: FF              RST     $38                 
2EC2: EE FF           XOR     $FF                 
2EC4: 00              NOP                         
2EC5: 00              NOP                         
2EC6: DA FF D0        JP      C,$D0FF             
2EC9: FF              RST     $38                 
2ECA: C9              RET                         

; ---- $2ECB-$303D: data ----
2ECB: FF C0 FF B6 FF AF FF A6 FF 9D FF 97 FF 8E FF 86
2EDB: FF 80 FF 78 FF 70 FF 6D FF 70 FF 5F FF 58 FF 52
2EEB: FF 4C FF 49 FF 45 FF 3F FF 3B FF 38 FF 33 FF 2F
2EFB: FF 2C FF 27 FF 24 FF 21 FF 21 FF 19 FF 16 FF 13
2F0B: FF 0E FF 0B FF 08 FF 03 FF 00 FF FD FE F8 FE F5
2F1B: FE F2 FE EF FE EA FE E8 FE E5 FE E0 FE DE FE DC
2F2B: FE DA FE D8 FE D4 FE D3 FE D2 FE D1 FE D0 FE CF
2F3B: FE CE FE CE FE CF FE D0 FE D1 FE D2 FE D3 FE D4
2F4B: FE D8 FE DA FE DC FE DE FE E0 FE E5 FE E8 FE EA
2F5B: FE EF FE F2 FE F5 FE F8 FE FD FE 00 FF 03 FF 08
2F6B: FF 0B FF 0E FF 13 FF 16 FF 19 FF 1C FF 21 FF 24
2F7B: FF 27 FF 2C FF 2F FF 33 FF 38 FF 3B FF 3F FF 45
2F8B: FF 49 FF 4C FF 52 FF 58 FF 5F FF 64 FF 6D FF 70
2F9B: FF 78 FF 80 FF 86 FF 8E FF 97 FF 9D FF A6 FF AF
2FAB: FF B6 FF C0 FF C9 FF D0 FF DA FF E4 FF EE FF F8
2FBB: FF 00 00 00 00 08 00 12 00 1C 00 26 00 30 00 37
2FCB: 00 40 00 4A 00 51 00 5A 00 63 00 69 00 72 00 7A
2FDB: 00 80 00 88 00 90 00 93 00 93 00 A1 00 A8 00 AE
2FEB: 00 B4 00 B7 00 BB 00 C1 00 C5 00 C8 00 CD 00 D1
2FFB: 00 D4 00 D9 00 DC 00 DF 00 DC 00 E7 00 EA 00 ED
300B: 00 F2 00 F5 00 F8 00 FD 00 00 01 03 01 08 01 0B
301B: 01 0E 01 11 01 16 01 18 01 11 01 20 01 22 01 24
302B: 01 26 01 28 01 2C 01 2D 01 2E 01 2F 01 30 01 31
303B: 01 32 01

; move a coordinate by three quarters of a displacement, so what it
; carries trails what moves by the whole of it
displaceByThreeQuarters:
303E: 44              LD      B,H                 
303F: 4D              LD      C,L                 
3040: CB 28           SRA     B                   
3042: CB 19           RR      C                   
3044: CB 28           SRA     B                   
3046: CB 19           RR      C                   
3048: A7              AND     A                   
3049: ED 42           SBC     HL,BC               
304B: 19              ADD     HL,DE               
304C: C9              RET                         

; move a coordinate by half a displacement, so what it carries keeps half
; the pace of what moves by the whole of it
displaceByHalf:
304D: 44              LD      B,H                 
304E: 4D              LD      C,L                 
304F: CB 28           SRA     B                   
3051: CB 19           RR      C                   
3053: A7              AND     A                   
3054: ED 42           SBC     HL,BC               
3056: 19              ADD     HL,DE               
3057: C9              RET                         

; place an object's next sprite tile flush against the current one and
; step both cursors onto it
placeAbuttingTile:
3058: FD 46 31        LD      B,(IY+$31)          
305B: FD 4E 00        LD      C,(IY+$00)          
305E: 3E 10           LD      A,$10               
3060: 80              ADD     A,B                 
3061: FD 77 33        LD      (IY+$33),A          
3064: FD 71 02        LD      (IY+$02),C          
3067: C3 9B 30        JP      $309B               ; {code.advanceToNextSlot}

; ---- $306A-$3073: data ----
306A: FD 46 31 FD 4E 00 26 08 2E 6E

loc_3074:
3074: 7E              LD      A,(HL)              
3075: 81              ADD     A,C                 
3076: FD 70 33        LD      (IY+$33),B          
3079: FD 77 02        LD      (IY+$02),A          
307C: C3 9B 30        JP      $309B               ; {code.advanceToNextSlot}

loc_307f:
307F: 73              LD      (HL),E              
3080: A6              AND     (HL)                
3081: 10 F1           DJNZ    $3074               ; {code.loc_3074}
3083: D7              RST     $10                 
3084: 34              INC     (HL)                
3085: A5              AND     L                   
3086: 87              ADD     A,A                 
3087: BF              CP      A                   
3088: F1              POP     AF                  
3089: B9              CP      C                   

; carry an object diagonally onto one more sprite entry, cornering off the
; one it already occupies: a pitch back along the high axis and a pitch on
; along the low one, in one 16-bit add so the low axis's wrap borrows
placeDiagonallyAbuttingTile:
308A: FD 46 31        LD      B,(IY+$31)          
308D: FD 4E 00        LD      C,(IY+$00)          
3090: 26 F0           LD      H,$F0               
3092: 2E 10           LD      L,$10               
3094: 09              ADD     HL,BC               
3095: FD 74 33        LD      (IY+$33),H          
3098: FD 75 02        LD      (IY+$02),L          

; step the record cursor and the parallel sprite-entry cursor on to the
; next object slot
advanceToNextSlot:
309B: 11 10 00        LD      DE,$0010            
309E: DD 19           ADD     IX,DE               
30A0: FD 23           INC     IY                  
30A2: FD 23           INC     IY                  
30A4: C9              RET                         

; sum a fixed 16-byte run against a constant as a discarded tamper
; tripwire, copy eight bytes of the ERA_INDEX-keyed row from the 0x3176
; table into the stride-two run at 0xAA31, then tail into the scenery
; clear+run carrying the era in C and the fill byte 0x28 at era four else
; 0xCC
seatEraSceneryRowThenClearAndRunScenery:
30A5: 21 6B 08        LD      HL,$086B            
30A8: 0E 22           LD      C,$22               
30AA: 06 10           LD      B,$10               
30AC: CD 4C 0B        CALL    $0B4C               ; {code.sumByteRunAndCompareToExpected}
30AF: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
30B2: 87              ADD     A,A                 
30B3: 87              ADD     A,A                 
30B4: 87              ADD     A,A                 
30B5: 4F              LD      C,A                 
30B6: 21 76 31        LD      HL,$3176            
30B9: DF              RST     $18                 
30BA: 11 31 AA        LD      DE,$AA31            
30BD: 06 08           LD      B,$08               

loc_30bf:
30BF: 7E              LD      A,(HL)              
30C0: 12              LD      (DE),A              
30C1: 23              INC     HL                  
30C2: 13              INC     DE                  
30C3: 13              INC     DE                  
30C4: 10 F9           DJNZ    $30BF               ; {code.loc_30bf}
30C6: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
30C9: FE 04           CP      $04                 
30CB: 4F              LD      C,A                 
30CC: CA 56 31        JP      Z,$3156             ; {code.seatSceneryFillByte0x28ThenClearEraScenery}
30CF: 3E CC           LD      A,$CC               

; clear a stride-two run of eight object cells to the fill byte carried in
; A, then branch on the era in C: below four, seat and run the frame's
; scenery through the four-object seat path; at four and up, when two
; work-RAM guards read their expected values seat eight entries from a
; packed table before running the scenery, and on a wrong guard transfer
; into a data table and fault
clearSceneryEntriesThenRunEraScenery:
30D1: 21 60 AA        LD      HL,$AA60            
30D4: 11 02 00        LD      DE,$0002            
30D7: 06 08           LD      B,$08               

loc_30d9:
30D9: 77              LD      (HL),A              
30DA: 19              ADD     HL,DE               
30DB: 10 FC           DJNZ    $30D9               ; {code.loc_30d9}
30DD: 79              LD      A,C                 
30DE: FE 04           CP      $04                 
30E0: DA 17 31        JP      C,$3117             ; {code.seedSceneryEntriesThenRunScenery}
30E3: 21 C7 AC        LD      HL,$ACC7            
30E6: 7E              LD      A,(HL)              
30E7: FE 3B           CP      $3B                 
30E9: C2 5B 31        JP      NZ,$315B            ; {code.loc_315b}
30EC: 23              INC     HL                  
30ED: 7E              LD      A,(HL)              
30EE: FE 05           CP      $05                 
30F0: CA F8 30        JP      Z,$30F8             ; {code.loc_30f8}
30F3: FE 10           CP      $10                 
30F5: C2 5B 31        JP      NZ,$315B            ; {code.loc_315b}

loc_30f8:
30F8: 06 08           LD      B,$08               
30FA: FD 21 30 AA     LD      IY,$AA30            
30FE: 21 5E 31        LD      HL,$315E            

loc_3101:
3101: 7E              LD      A,(HL)              
3102: FD 77 31        LD      (IY+$31),A          
3105: 23              INC     HL                  
3106: 7E              LD      A,(HL)              
3107: FD 77 00        LD      (IY+$00),A          
310A: 23              INC     HL                  
310B: FD 23           INC     IY                  
310D: FD 23           INC     IY                  
310F: 10 F0           DJNZ    $3101               ; {code.loc_3101}
3111: C3 BC 2C        JP      $2CBC               ; {code.runSceneryForEra}

loc_3114:
3114: C3 7F 30        JP      $307F               ; {code.loc_307f}

; when a sentinel pair reads 0x68 then 0x10-or-0x05, seat four objects
; from a packed table into the sprite cell and shadow of the first four
; entry-bank slots and hand on to the frame's scenery run; otherwise
; transfer to the caption path
seedSceneryEntriesThenRunScenery:
3117: 21 39 AD        LD      HL,$AD39            
311A: 7E              LD      A,(HL)              
311B: FE 68           CP      $68                 
311D: C2 14 31        JP      NZ,$3114            ; {code.loc_3114}
3120: 23              INC     HL                  
3121: 7E              LD      A,(HL)              
3122: FE 10           CP      $10                 
3124: CA 2C 31        JP      Z,$312C             ; {code.loc_312c}
3127: FE 05           CP      $05                 
3129: C2 14 31        JP      NZ,$3114            ; {code.loc_3114}

loc_312c:
312C: 21 6E 31        LD      HL,$316E            
312F: 06 04           LD      B,$04               
3131: FD 21 30 AA     LD      IY,$AA30            

loc_3135:
3135: 7E              LD      A,(HL)              
3136: FD 77 31        LD      (IY+$31),A          
3139: C6 10           ADD     A,$10               
313B: FD 77 33        LD      (IY+$33),A          
313E: 23              INC     HL                  
313F: 7E              LD      A,(HL)              
3140: FD 77 00        LD      (IY+$00),A          
3143: FD 77 02        LD      (IY+$02),A          
3146: 23              INC     HL                  
3147: 11 10 00        LD      DE,$0010            
314A: DD 19           ADD     IX,DE               
314C: 11 04 00        LD      DE,$0004            
314F: FD 19           ADD     IY,DE               
3151: 10 E2           DJNZ    $3135               ; {code.loc_3135}
3153: C3 BC 2C        JP      $2CBC               ; {code.runSceneryForEra}

; fix the fill byte and transfer to 0x30D1 without returning; choosing
; that one constant is the entire content of the entry, so whatever the
; caller carried in its place is discarded
seatSceneryFillByte0x28ThenClearEraScenery:
3156: 3E 28           LD      A,$28               
3158: C3 D1 30        JP      $30D1               ; {code.clearSceneryEntriesThenRunEraScenery}

loc_315b:
315B: C3 76 31        JP      $3176               ; {code.loc_3176}

; ---- $315E-$3175: data ----
315E: 40 68 38 62 60 70 68 D8 88 58 99 B0 37 43 CF 78
316E: 20 D0 50 60 A0 A0 D0 60

loc_3176:
3176: 60              LD      H,B                 
3177: 68              LD      L,B                 
3178: 61              LD      H,C                 
3179: 60              LD      H,B                 
317A: 61              LD      H,C                 
317B: 62              LD      H,D                 
317C: 63              LD      H,E                 
317D: 5C              LD      E,H                 
317E: 74              LD      (HL),H              
317F: 75              LD      (HL),L              
3180: 76              HALT                        
3181: 60              LD      H,B                 
3182: 61              LD      H,C                 
3183: 64              LD      H,H                 
3184: 65              LD      H,L                 
3185: 5D              LD      E,L                 
3186: 77              LD      (HL),A              
3187: 78              LD      A,B                 
3188: 79              LD      A,C                 
3189: 66              LD      H,(HL)              
318A: 67              LD      H,A                 
318B: 64              LD      H,H                 
318C: 65              LD      H,L                 
318D: 5E              LD      E,(HL)              
318E: 7A              LD      A,D                 
318F: 7B              LD      A,E                 
3190: 7C              LD      A,H                 
3191: 60              LD      H,B                 
3192: 61              LD      H,C                 
3193: 62              LD      H,D                 
3194: 63              LD      H,E                 
3195: 5F              LD      E,A                 
3196: 31 30 33        LD      SP,$3330            
3199: 32 85 86        LD      ($8685),A           
319C: 87              ADD     A,A                 
319D: 85              ADD     A,L                 
319E: 08              EX      AF,AF'              
319F: A7              AND     A                   
31A0: 32 CA 7E        LD      ($7ECA),A           
31A3: C8              RET     Z                   
31A4: FF              RST     $38                 
31A5: 5F              LD      E,A                 
31A6: 93              SUB     E                   
31A7: FB              EI                          
31A8: C4 AF D8        CALL    NZ,$D8AF            
31AB: 2A 6C E1        LD      HL,($E16C)          
31AE: 7A              LD      A,D                 
31AF: 42              LD      B,D                 
31B0: BD              CP      L                   
31B1: B0              OR      B                   
31B2: 5A              LD      E,D                 
31B3: B9              CP      C                   

; on the 00s and 30s tenths of the packed-decimal life counter 0xad05,
; service enemy-craft slot (units digit, only slots 0-6 whose record head
; at 0xa850 reads 0xff): advance that record's shape animation, then
; unless the state byte at ix+8 is 0x10 re-aim its heading toward a point
; the state byte indexes out of the aim table at 0xac65 -- state 0x11 aims
; at the table base, stores heading+0x80 into ix+1 and resets the record
; to state 0x10, every other state stores the heading straight into ix+1;
; on every other tenth hand off to layOutEnemyAimPointsFromScrollAngle
reaimAndAnimateEnemyCraftOnPhaseTick:
31B4: 3A 05 AD        LD      A,($AD05)           ; {hard.workRam+505}
31B7: 4F              LD      C,A                 
31B8: E6 F0           AND     $F0                 
31BA: 28 0D           JR      Z,$31C9             ; {code.loc_31c9}
31BC: FE 30           CP      $30                 
31BE: C2 6C 32        JP      NZ,$326C            ; {code.layOutEnemyAimPointsFromScrollAngle}
31C1: 3A 03 49        LD      A,($4903)           ; {hard.rom+4903}
31C4: FE 30           CP      $30                 
31C6: C2 C9 31        JP      NZ,$31C9            ; {code.loc_31c9}

loc_31c9:
31C9: 79              LD      A,C                 
31CA: E6 0F           AND     $0F                 
31CC: FE 07           CP      $07                 
31CE: D0              RET     NC                  
31CF: DD 21 50 A8     LD      IX,$A850            
31D3: FD 21 1A AA     LD      IY,$AA1A            
31D7: 87              ADD     A,A                 
31D8: 4F              LD      C,A                 
31D9: 06 00           LD      B,$00               
31DB: FD 09           ADD     IY,BC               
31DD: 87              ADD     A,A                 
31DE: 87              ADD     A,A                 
31DF: 87              ADD     A,A                 
31E0: 4F              LD      C,A                 
31E1: DD 09           ADD     IX,BC               
31E3: DD 7E 00        LD      A,(IX+$00)          
31E6: 3C              INC     A                   
31E7: C0              RET     NZ                  
31E8: CD 3A 32        CALL    $323A               ; {code.stepShapeAnimation}
31EB: DD 7E 08        LD      A,(IX+$08)          
31EE: FE 10           CP      $10                 
31F0: C8              RET     Z                   
31F1: FE 11           CP      $11                 
31F3: 28 0C           JR      Z,$3201             ; {code.loc_3201}
31F5: 87              ADD     A,A                 
31F6: 21 65 AC        LD      HL,$AC65            
31F9: DF              RST     $18                 
31FA: CD B8 33        CALL    $33B8               ; {code.headingToward}
31FD: DD 77 01        LD      (IX+$01),A          
3200: C9              RET                         

loc_3201:
3201: 21 65 AC        LD      HL,$AC65            
3204: CD B8 33        CALL    $33B8               ; {code.headingToward}
3207: C6 80           ADD     A,$80               
3209: DD 77 01        LD      (IX+$01),A          
320C: DD 36 08 10     LD      (IX+$08),$10        
3210: DD 36 09 00     LD      (IX+$09),$00        
3214: C9              RET                         

; stock the machine for a game with only the FIRST player's context filled
; in: park the caption sprites, raise PLAY_ACTIVE, clear PLAYER_TWO_LIVES
; and the flag beside PLAY_ACTIVE, load PLAYER_ONE_LIVES from the settings
; cell carrying the starting count, TAKE ONE CREDIT off the packed-decimal
; count at 0xA986 and repaint the panel field from it, copy a fixed set of
; tilemap cells into their keeps, and send the sequence machine to its
; last phase. The subtract is decimal-corrected the way the hardware does
; it, so a byte that was never valid packed decimal still lands where the
; hardware would put it
startOnePlayerGame:
3215: CD 2B 0B        CALL    $0B2B               ; {code.hideCaptionSprites}
3218: AF              XOR     A                   
3219: 32 31 AD        LD      ($AD31),A           ; {hard.workRam+531}
321C: 32 20 AD        LD      ($AD20),A           ; {hard.workRam+520}
321F: 3D              DEC     A                   
3220: 32 30 AD        LD      ($AD30),A           ; {hard.workRam+530}
3223: 3A C1 A9        LD      A,($A9C1)           ; {hard.workRam+1C1}
3226: 32 10 AD        LD      ($AD10),A           ; {hard.workRam+510}
3229: 21 86 A9        LD      HL,$A986            
322C: 7E              LD      A,(HL)              
322D: D6 01           SUB     $01                 
322F: 27              DAA                         
3230: 77              LD      (HL),A              
3231: CD FB 4A        CALL    $4AFB               ; {code.paintCreditCountPanel}
3234: CD 30 4B        CALL    $4B30               ; {code.copyThreeTilemapCellsFromBothPlanes}
3237: C3 2A 17        JP      $172A               ; {code.seatSequencePhase3AndResetSubStep}

; count one record's step timer down and refresh that record's shape byte
; from the entry the NEW count selects, in the run its own selector byte
; points at; a timer already at zero is left alone
stepShapeAnimation:
323A: DD 7E 09        LD      A,(IX+$09)          
323D: A7              AND     A                   
323E: C8              RET     Z                   
323F: 3D              DEC     A                   
3240: DD 77 09        LD      (IX+$09),A          
3243: 4F              LD      C,A                 
3244: DD 7E 0A        LD      A,(IX+$0A)          
3247: 21 38 34        LD      HL,$3438            
324A: D7              RST     $10                 
324B: EB              EX      DE,HL               
324C: 79              LD      A,C                 
324D: CF              RST     $08                 
324E: DD 77 08        LD      (IX+$08),A          
3251: C9              RET                         

; fold a fixed span of the program image and let the sequence's inner step
; go on if it still adds up; a span that does not fold to the expected
; value throws the sequence a whole phase forward instead, which derails
; it rather than halting it
guardBlockOrDerailSequence:
3252: 01 00 03        LD      BC,$0300            
3255: 21 08 00        LD      HL,$0008            
3258: 1E 00           LD      E,$00               

loc_325a:
325A: 7B              LD      A,E                 
325B: AE              XOR     (HL)                
325C: 23              INC     HL                  
325D: 0B              DEC     BC                  
325E: 5F              LD      E,A                 
325F: 79              LD      A,C                 
3260: B0              OR      B                   
3261: 20 F7           JR      NZ,$325A            ; {code.loc_325a}
3263: 3E 52           LD      A,$52               
3265: 83              ADD     A,E                 
3266: C2 11 0F        JP      NZ,$0F11            ; {code.advanceSequencePhase}
3269: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; when the mode byte in C selects sub-mode 7 (low nibble == 7), fill
; sprite object 0xac64's twelve coordinate fields (0x10-0x1b) with six XY
; pairs around centre (0x78 across, 0x84 down): the scroll angle +0x40 and
; the scroll angle itself, each drawn through the velocity table (via
; 0x59d1) at x8 and x16 radii, the +0x40 direction also mirrored to its
; negatives; other sub-modes return without writing
layOutEnemyAimPointsFromScrollAngle:
326C: 79              LD      A,C                 
326D: E6 0F           AND     $0F                 
326F: FE 07           CP      $07                 
3271: C0              RET     NZ                  
3272: DD 21 64 AC     LD      IX,$AC64            
3276: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
3279: C6 40           ADD     A,$40               
327B: CD D1 59        CALL    $59D1               ; {code.loc_59d1}
327E: EB              EX      DE,HL               
327F: 29              ADD     HL,HL               
3280: 29              ADD     HL,HL               
3281: 29              ADD     HL,HL               
3282: 7C              LD      A,H                 
3283: C6 78           ADD     A,$78               
3285: DD 77 10        LD      (IX+$10),A          
3288: 7C              LD      A,H                 
3289: ED 44           NEG                         
328B: C6 78           ADD     A,$78               
328D: DD 77 14        LD      (IX+$14),A          
3290: 29              ADD     HL,HL               
3291: 7C              LD      A,H                 
3292: C6 78           ADD     A,$78               
3294: DD 77 12        LD      (IX+$12),A          
3297: 7C              LD      A,H                 
3298: ED 44           NEG                         
329A: C6 78           ADD     A,$78               
329C: DD 77 16        LD      (IX+$16),A          
329F: 60              LD      H,B                 
32A0: 69              LD      L,C                 
32A1: 29              ADD     HL,HL               
32A2: 29              ADD     HL,HL               
32A3: 29              ADD     HL,HL               
32A4: 7C              LD      A,H                 
32A5: C6 84           ADD     A,$84               
32A7: DD 77 11        LD      (IX+$11),A          
32AA: 7C              LD      A,H                 
32AB: ED 44           NEG                         
32AD: C6 84           ADD     A,$84               
32AF: DD 77 15        LD      (IX+$15),A          
32B2: 29              ADD     HL,HL               
32B3: 7C              LD      A,H                 
32B4: C6 84           ADD     A,$84               
32B6: DD 77 13        LD      (IX+$13),A          
32B9: 7C              LD      A,H                 
32BA: ED 44           NEG                         
32BC: C6 84           ADD     A,$84               
32BE: DD 77 17        LD      (IX+$17),A          
32C1: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
32C4: CD D1 59        CALL    $59D1               ; {code.loc_59d1}
32C7: EB              EX      DE,HL               
32C8: 29              ADD     HL,HL               
32C9: 29              ADD     HL,HL               
32CA: 29              ADD     HL,HL               
32CB: 7C              LD      A,H                 
32CC: C6 78           ADD     A,$78               
32CE: DD 77 18        LD      (IX+$18),A          
32D1: 29              ADD     HL,HL               
32D2: 7C              LD      A,H                 
32D3: C6 78           ADD     A,$78               
32D5: DD 77 1A        LD      (IX+$1A),A          
32D8: 60              LD      H,B                 
32D9: 69              LD      L,C                 
32DA: 29              ADD     HL,HL               
32DB: 29              ADD     HL,HL               
32DC: 29              ADD     HL,HL               
32DD: 7C              LD      A,H                 
32DE: C6 84           ADD     A,$84               
32E0: DD 77 19        LD      (IX+$19),A          
32E3: 29              ADD     HL,HL               
32E4: 7C              LD      A,H                 
32E5: C6 84           ADD     A,$84               
32E7: DD 77 1B        LD      (IX+$1B),A          
32EA: C9              RET                         

; hold the machine still at power-on and then hand it over: count twelve
; passes down in a work-RAM cell, petting the watchdog 256 times inside
; each so the board is never reset while nothing happens, leave the cell
; and the two counting registers at zero and the pointer on the cell, tell
; the audio processor to go quiet, pick up the byte that decides the
; interrupt-enable bit, and fall into the routine that starts the machine
petWatchdogThroughStartupDelayThenStartMachine:
32EB: 32 00 C2        LD      ($C200),A           
32EE: 21 EB A9        LD      HL,$A9EB            
32F1: 36 0C           LD      (HL),$0C            

loc_32f3:
32F3: 01 00 00        LD      BC,$0000            

loc_32f6:
32F6: 10 FE           DJNZ    $32F6               ; {code.loc_32f6}
32F8: 32 00 C2        LD      ($C200),A           
32FB: 0D              DEC     C                   
32FC: 20 F8           JR      NZ,$32F6            ; {code.loc_32f6}
32FE: 35              DEC     (HL)                
32FF: 20 F2           JR      NZ,$32F3            ; {code.loc_32f3}
3301: AF              XOR     A                   
3302: CD F8 55        CALL    $55F8               ; {code.sendSoundCommand}
3305: 3A 87 4C        LD      A,($4C87)           ; {hard.rom+4C87}
3308: C3 A8 00        JP      $00A8               ; {code.enableInterruptAndEnterForegroundLoop}

loc_330b:
330B: 21 EB A9        LD      HL,$A9EB            
330E: 35              DEC     (HL)                
330F: C0              RET     NZ                  
3310: CD C3 4C        CALL    $4CC3               ; {code.fileScoreIntoHighScoreTable}
3313: D2 26 33        JP      NC,$3326            ; {code.loc_3326}
3316: 11 09 03        LD      DE,$0309            
3319: FF              RST     $38                 
331A: 1E 0B           LD      E,$0B               
331C: FF              RST     $38                 
331D: 3A 43 08        LD      A,($0843)           ; {hard.rom+843}
3320: 32 AC A9        LD      ($A9AC),A           ; {hard.workRam+1AC}
3323: C3 E7 12        JP      $12E7               ; {code.passTurnToOtherPlayerIfLivesElseStepSequence}

loc_3326:
3326: CD 3A 58        CALL    $583A               ; {code.loc_583a}
3329: 3E 00           LD      A,$00               
332B: 32 0C AD        LD      ($AD0C),A           ; {hard.workRam+50C}
332E: 3E F1           LD      A,$F1               
3330: 32 0B AD        LD      ($AD0B),A           ; {hard.workRam+50B}
3333: CD E1 01        CALL    $01E1               ; {code.armThePenRouteThenColdStartOnATamperedImage}
3336: 06 00           LD      B,$00               
3338: 21 F1 01        LD      HL,$01F1            
333B: AF              XOR     A                   

loc_333c:
333C: 86              ADD     A,(HL)              
333D: 23              INC     HL                  
333E: 10 FC           DJNZ    $333C               ; {code.loc_333c}
3340: D6 19           SUB     $19                 
3342: C4 11 0F        CALL    NZ,$0F11            ; {code.advanceSequencePhase}
3345: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; ---- $3348-$335D: data ----
3348: 11 A7 13 68 3B 34 F1 68 D7 F1 DC 0F 68 F1 88 57
3358: A5 BF 34 D7 ED B9

; sequence-machine arm: fold a fixed image run into the sequence-phase
; cell as a tamper tripwire (net-zero on a genuine image), then seat the
; caption pen (glyph 0xAD0B / colour 0xAD0C, and the active player's save
; block) from a two-byte glyph/colour record indexed by that player's era;
; steps the sub-step an extra time if the pen colour was unchanged, re-
; arms the pen route, then steps the sub-step again as a tail
seatCaptionPenFromEraFoldingTamperIntoPhase:
335E: 3A AB A9        LD      A,($A9AB)           ; {hard.workRam+1AB}
3361: 21 8C 17        LD      HL,$178C            
3364: 06 1E           LD      B,$1E               

loc_3366:
3366: 86              ADD     A,(HL)              
3367: 23              INC     HL                  
3368: 10 FC           DJNZ    $3366               ; {code.loc_3366}
336A: C6 2C           ADD     A,$2C               
336C: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
336F: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
3372: A7              AND     A                   
3373: 11 1B AD        LD      DE,$AD1B            
3376: 3A 14 AD        LD      A,($AD14)           ; {hard.workRam+514}
3379: 28 06           JR      Z,$3381             ; {code.loc_3381}
337B: 11 2B AD        LD      DE,$AD2B            
337E: 3A 24 AD        LD      A,($AD24)           ; {hard.workRam+524}

loc_3381:
3381: 87              ADD     A,A                 
3382: 21 8D 0F        LD      HL,$0F8D            
3385: CF              RST     $08                 
3386: 12              LD      (DE),A              
3387: 32 0B AD        LD      ($AD0B),A           ; {hard.workRam+50B}
338A: 23              INC     HL                  
338B: 13              INC     DE                  
338C: 7E              LD      A,(HL)              
338D: 12              LD      (DE),A              
338E: 21 0C AD        LD      HL,$AD0C            
3391: BE              CP      (HL)                
3392: 77              LD      (HL),A              
3393: CC 1A 0F        CALL    Z,$0F1A             ; {code.advanceSequenceSubStep}
3396: CD E1 01        CALL    $01E1               ; {code.armThePenRouteThenColdStartOnATamperedImage}
3399: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; seed the pen the active player's SAVED context block will hand back —
; the glyph and the colour a caption is stamped in — from the era recorded
; in that same block, both halves coming as one two-byte record out of an
; inline table the era indexes; the live pen is left alone, where the
; nearer arm at 0x335E sets it too, sums a run of image bytes into a
; tamper cell before doing any of it, and can repaint
setSavedPenFromEra:
339C: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
339F: A7              AND     A                   
33A0: 11 1B AD        LD      DE,$AD1B            
33A3: 3A 14 AD        LD      A,($AD14)           ; {hard.workRam+514}
33A6: 28 06           JR      Z,$33AE             ; {code.loc_33ae}
33A8: 11 2B AD        LD      DE,$AD2B            
33AB: 3A 24 AD        LD      A,($AD24)           ; {hard.workRam+524}

loc_33ae:
33AE: 87              ADD     A,A                 
33AF: 21 8D 0F        LD      HL,$0F8D            
33B2: DF              RST     $18                 
33B3: ED A0           LDI                         
33B5: ED A0           LDI                         
33B7: C9              RET                         

; return the heading from an object to a point as a byte of a 256-step
; circle: the signs and relative sizes of the two axis differences pick
; one of eight octants, and the shorter leg over the longer places the
; answer at one of thirty-two rungs inside it
headingToward:
33B8: 0E 00           LD      C,$00               
33BA: FD 46 31        LD      B,(IY+$31)          
33BD: 5E              LD      E,(HL)              
33BE: 2D              DEC     L                   
33BF: 7E              LD      A,(HL)              
33C0: 90              SUB     B                   
33C1: 30 04           JR      NC,$33C7            ; {code.loc_33c7}
33C3: ED 44           NEG                         
33C5: CB C1           SET     0,C                 

loc_33c7:
33C7: 57              LD      D,A                 
33C8: FD 46 00        LD      B,(IY+$00)          
33CB: 7B              LD      A,E                 
33CC: 90              SUB     B                   
33CD: 30 04           JR      NC,$33D3            ; {code.loc_33d3}
33CF: ED 44           NEG                         
33D1: CB C9           SET     1,C                 

loc_33d3:
33D3: 5F              LD      E,A                 
33D4: 08              EX      AF,AF'              
33D5: 7B              LD      A,E                 
33D6: 08              EX      AF,AF'              
33D7: 92              SUB     D                   
33D8: 28 35           JR      Z,$340F             ; {code.loc_340f}
33DA: 30 02           JR      NC,$33DE            ; {code.loc_33de}
33DC: CB D1           SET     2,C                 

loc_33de:
33DE: 2E 00           LD      L,$00               
33E0: CB 51           BIT     2,C                 
33E2: 20 03           JR      NZ,$33E7            ; {code.loc_33e7}
33E4: 62              LD      H,D                 
33E5: 18 02           JR      $33E9               ; {code.loc_33e9}

loc_33e7:
33E7: 63              LD      H,E                 
33E8: 5A              LD      E,D                 

loc_33e9:
33E9: 06 08           LD      B,$08               
33EB: AF              XOR     A                   

loc_33ec:
33EC: ED 6A           ADC     HL,HL               
33EE: 7C              LD      A,H                 
33EF: 38 03           JR      C,$33F4             ; {code.loc_33f4}
33F1: BB              CP      E                   
33F2: 38 03           JR      C,$33F7             ; {code.loc_33f7}

loc_33f4:
33F4: 93              SUB     E                   
33F5: 67              LD      H,A                 
33F6: AF              XOR     A                   

loc_33f7:
33F7: 3F              CCF                         
33F8: 10 F2           DJNZ    $33EC               ; {code.loc_33ec}
33FA: 45              LD      B,L                 
33FB: 79              LD      A,C                 
33FC: 21 15 34        LD      HL,$3415            
33FF: DF              RST     $18                 
3400: 78              LD      A,B                 
3401: 0F              RRCA                        
3402: 0F              RRCA                        
3403: E6 1F           AND     $1F                 
3405: CB 6E           BIT     5,(HL)              
3407: 28 04           JR      Z,$340D             ; {code.loc_340d}
3409: 47              LD      B,A                 
340A: 3E 1F           LD      A,$1F               
340C: 90              SUB     B                   

loc_340d:
340D: 86              ADD     A,(HL)              
340E: C9              RET                         

loc_340f:
340F: 21 1D 34        LD      HL,$341D            
3412: 79              LD      A,C                 
3413: CF              RST     $08                 
3414: C9              RET                         

; ---- $3415-$36AE: data ----
3415: 20 40 C0 A0 00 60 E0 80 20 60 E0 A0 21 50 0C CD
3425: 8C 01 EB 5E 23 56 23 23 3A 0C AD C6 05 E6 0F 4F
3435: C3 FF 0B 6F 34 8F 34 AF 34 CF 34 EF 34 0F 35 2F
3445: 35 4F 35 6F 35 8F 35 AF 35 CF 35 EF 35 0F 36 2F
3455: 36 4F 36 6F 36 8F 36 11 A7 13 68 3B 34 F1 88 57
3465: A5 BF 34 D7 F1 68 3B 57 BF B9 11 09 09 09 09 09
3475: 09 09 09 09 09 09 09 09 09 09 09 09 09 09 09 09
3485: 09 09 09 09 09 09 09 09 09 09 11 08 08 08 08 08
3495: 08 08 08 08 08 08 08 08 08 08 09 08 08 08 08 08
34A5: 08 08 08 08 08 08 08 08 08 08 11 00 00 00 00 00
34B5: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
34C5: 00 00 00 00 00 00 00 00 00 00 11 0A 0A 0A 0A 0A
34D5: 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A
34E5: 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 11 0B 0B 0B 0B 0B
34F5: 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B
3505: 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 11 10 10 10 10 10
3515: 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
3525: 10 10 10 10 10 10 10 10 10 10 11 10 10 10 10 10
3535: 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
3545: 10 10 10 10 10 10 10 10 10 0D 11 10 10 10 10 10
3555: 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
3565: 10 10 10 10 10 10 10 10 0C 0D 11 10 10 10 10 10
3575: 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
3585: 10 10 10 10 10 10 10 0C 0D 0D 11 09 09 09 09 09
3595: 09 09 09 09 09 09 09 09 09 09 09 09 09 09 09 09
35A5: 09 09 09 09 09 09 09 10 10 10 11 08 08 08 08 08
35B5: 08 08 08 08 08 08 08 08 08 08 08 08 08 08 08 08
35C5: 08 08 08 08 08 08 08 10 10 10 11 00 00 00 00 00
35D5: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
35E5: 00 00 00 00 00 00 00 10 10 10 11 0A 0A 0A 0A 0A
35F5: 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A 0A
3605: 0A 0A 0A 0A 0A 0A 0A 10 10 10 11 0B 0B 0B 0B 0B
3615: 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B 0B
3625: 0B 0B 0B 0B 0B 0B 0B 10 10 10 11 10 10 10 10 10
3635: 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
3645: 10 10 10 10 10 10 10 10 10 10 11 10 10 10 10 10
3655: 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
3665: 10 10 10 10 10 10 0D 10 10 10 11 10 10 10 10 10
3675: 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
3685: 10 10 10 10 10 10 10 10 10 10 11 10 10 10 10 10
3695: 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
36A5: 10 10 10 10 10 10 0D 10 10 10

; enemy-wave substep: while the wave-hold cell 0xacc6 is clear, dispatch
; by era and life-phase -- era 4 to spawnEnemyWaveIntoFreeSlots, phase 7
; to stopFiveSlotAnimations, phase below 7 to
; gateTheFreeSlotSearchAndPickItsRun, phase 8 to
; spawnEnemyCraftWhenBandUnderTwo; at phase 9+ with the low life-tick
; 0xad05 spent, spawn a fresh wave inline across the 0xa850/0xaa1a craft
; band from a heading-biased shape run, then request a sound once enough
; of the five slots filled
driveEnemyWaveForLifePhase:
36AF: 3A C6 AC        LD      A,($ACC6)           ; {hard.workRam+4C6}
36B2: A7              AND     A                   
36B3: C0              RET     NZ                  
36B4: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
36B7: FE 04           CP      $04                 
36B9: CA 6E 38        JP      Z,$386E             ; {code.spawnEnemyWaveIntoFreeSlots}
36BC: 21 05 AD        LD      HL,$AD05            
36BF: 3A 06 AD        LD      A,($AD06)           ; {hard.workRam+506}
36C2: E6 0F           AND     $0F                 
36C4: FE 07           CP      $07                 
36C6: CA 55 38        JP      Z,$3855             ; {code.stopFiveSlotAnimations}
36C9: DA BD 37        JP      C,$37BD             ; {code.gateTheFreeSlotSearchAndPickItsRun}
36CC: FE 09           CP      $09                 
36CE: DA 9F 37        JP      C,$379F             ; {code.spawnEnemyCraftWhenBandUnderTwo}
36D1: 7E              LD      A,(HL)              
36D2: A7              AND     A                   
36D3: C0              RET     NZ                  
36D4: CD 4B 4B        CALL    $4B4B               ; {code.drawRandomByte}
36D7: 0F              RRCA                        
36D8: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
36DB: 8F              ADC     A,A                 
36DC: 21 C2 AC        LD      HL,$ACC2            
36DF: 36 FF           LD      (HL),$FF            
36E1: 23              INC     HL                  
36E2: 77              LD      (HL),A              
36E3: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
36E6: C6 08           ADD     A,$08               
36E8: 0F              RRCA                        
36E9: 0F              RRCA                        
36EA: 0F              RRCA                        
36EB: 0F              RRCA                        
36EC: E6 0F           AND     $0F                 
36EE: 21 D9 38        LD      HL,$38D9            
36F1: DF              RST     $18                 
36F2: 4E              LD      C,(HL)              
36F3: 3A C3 AC        LD      A,($ACC3)           ; {hard.workRam+4C3}
36F6: 87              ADD     A,A                 
36F7: 87              ADD     A,A                 
36F8: 87              ADD     A,A                 
36F9: 87              ADD     A,A                 
36FA: 21 7B 39        LD      HL,$397B            
36FD: DF              RST     $18                 
36FE: EB              EX      DE,HL               
36FF: 3A C1 AC        LD      A,($ACC1)           ; {hard.workRam+4C1}
3702: 47              LD      B,A                 
3703: 3A 02 AD        LD      A,($AD02)           ; {hard.workRam+502}
3706: A7              AND     A                   
3707: 20 02           JR      NZ,$370B            ; {code.loc_370b}
3709: 06 05           LD      B,$05               

loc_370b:
370B: AF              XOR     A                   
370C: 32 11 A8        LD      ($A811),A           ; {hard.workRam+11}
370F: DD 21 50 A8     LD      IX,$A850            
3713: FD 21 1A AA     LD      IY,$AA1A            

loc_3717:
3717: DD 7E 00        LD      A,(IX+$00)          
371A: A7              AND     A                   
371B: C2 68 37        JP      NZ,$3768            ; {code.loc_3768}
371E: 1A              LD      A,(DE)              
371F: 81              ADD     A,C                 
3720: 87              ADD     A,A                 
3721: 21 E9 38        LD      HL,$38E9            
3724: CF              RST     $08                 
3725: FD 77 31        LD      (IY+$31),A          
3728: 23              INC     HL                  
3729: 7E              LD      A,(HL)              
372A: FD 77 00        LD      (IY+$00),A          
372D: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
3730: C6 80           ADD     A,$80               
3732: DD 77 01        LD      (IX+$01),A          
3735: DD 77 02        LD      (IX+$02),A          
3738: CD 2D 38        CALL    $382D               ; {code.pickScriptAtRandomOrInTurn}
373B: C6 09           ADD     A,$09               
373D: DD 77 0A        LD      (IX+$0A),A          
3740: 13              INC     DE                  
3741: 1A              LD      A,(DE)              
3742: DD 77 0E        LD      (IX+$0E),A          
3745: 13              INC     DE                  
3746: DD 36 03 00     LD      (IX+$03),$00        
374A: DD 36 05 00     LD      (IX+$05),$00        
374E: DD 36 09 20     LD      (IX+$09),$20        
3752: D9              EXX                         
3753: CD 3A 32        CALL    $323A               ; {code.stepShapeAnimation}
3756: D9              EXX                         
3757: DD 36 00 FE     LD      (IX+$00),$FE        
375B: DD 7E 0E        LD      A,(IX+$0E)          
375E: A7              AND     A                   
375F: 20 03           JR      NZ,$3764            ; {code.loc_3764}
3761: DD 34 00        INC     (IX+$00)            

loc_3764:
3764: 21 11 A8        LD      HL,$A811            
3767: 34              INC     (HL)                

loc_3768:
3768: EB              EX      DE,HL               
3769: 11 10 00        LD      DE,$0010            
376C: DD 19           ADD     IX,DE               
376E: FD 23           INC     IY                  
3770: FD 23           INC     IY                  
3772: EB              EX      DE,HL               
3773: 10 A2           DJNZ    $3717               ; {code.loc_3717}
3775: AF              XOR     A                   
3776: 32 C2 AC        LD      ($ACC2),A           ; {hard.workRam+4C2}
3779: 3E E4           LD      A,$E4               
377B: 32 12 A8        LD      ($A812),A           ; {hard.workRam+12}
377E: 21 11 A8        LD      HL,$A811            
3781: 7E              LD      A,(HL)              
3782: FE 05           CP      $05                 
3784: D2 17 58        JP      NC,$5817            ; {code.requestEnemyWaveSound}
3787: 21 C1 AC        LD      HL,$ACC1            
378A: BE              CP      (HL)                
378B: 7E              LD      A,(HL)              
378C: 32 11 A8        LD      ($A811),A           ; {hard.workRam+11}
378F: D2 17 58        JP      NC,$5817            ; {code.requestEnemyWaveSound}
3792: C9              RET                         

loc_3793:
3793: 06 05           LD      B,$05               
3795: DD 21 90 A8     LD      IX,$A890            
3799: FD 21 22 AA     LD      IY,$AA22            
379D: 18 37           JR      $37D6               ; {code.spawnEnemyIntoFreeSlotElseStepSearch}

; gate a spawn tick on the packed-decimal phase byte the caller points at
; (return unless it is 0x00 or 0x30), count the busy heads across the
; seven-record enemy-craft band at 0xa850, and while fewer than two are
; busy run the free-slot search -- the cleared run via loc_3793 when the
; owed-kills cell 0xad02 is zero, else the owed run (b from the round's
; craft count 0xacc1, seated at 0xa8b0/0xaa26) via
; spawnEnemyIntoFreeSlotElseStepSearch; stages nothing when the gate is
; shut or two heads are busy
spawnEnemyCraftWhenBandUnderTwo:
379F: 7E              LD      A,(HL)              
37A0: A7              AND     A                   
37A1: 28 03           JR      Z,$37A6             ; {code.loc_37a6}
37A3: FE 30           CP      $30                 
37A5: C0              RET     NZ                  

loc_37a6:
37A6: 21 50 A8        LD      HL,$A850            
37A9: 11 10 00        LD      DE,$0010            
37AC: 01 00 07        LD      BC,$0700            

loc_37af:
37AF: 7E              LD      A,(HL)              
37B0: A7              AND     A                   
37B1: 28 01           JR      Z,$37B4             ; {code.loc_37b4}
37B3: 0C              INC     C                   

loc_37b4:
37B4: 19              ADD     HL,DE               
37B5: 10 F8           DJNZ    $37AF               ; {code.loc_37af}
37B7: 79              LD      A,C                 
37B8: FE 02           CP      $02                 
37BA: D0              RET     NC                  
37BB: 18 07           JR      $37C4               ; {code.loc_37c4}

; decide whether this is a spawning tick and, if it is, choose which run
; of object slots the free-slot search walks: the caller points at a
; counter cell and only two of its values open the gate, every other value
; ending the entry with nothing staged; past the gate the count of kills
; still owed picks between two runs of the one slot file -- while any are
; owed the run starts two records higher and is as long as the round's
; craft count asks, and once none are owed a fixed run of five starts
; lower -- and control leaves for the search without coming back. The role
; names no address for the gate byte on purpose: it is read through a
; pointer, so the routine itself cannot know what it is
gateTheFreeSlotSearchAndPickItsRun:
37BD: 7E              LD      A,(HL)              
37BE: A7              AND     A                   
37BF: 28 03           JR      Z,$37C4             ; {code.loc_37c4}
37C1: FE 30           CP      $30                 
37C3: C0              RET     NZ                  

loc_37c4:
37C4: 3A 02 AD        LD      A,($AD02)           ; {hard.workRam+502}
37C7: A7              AND     A                   
37C8: 28 C9           JR      Z,$3793             ; {code.loc_3793}
37CA: 3A C1 AC        LD      A,($ACC1)           ; {hard.workRam+4C1}
37CD: 47              LD      B,A                 
37CE: DD 21 B0 A8     LD      IX,$A8B0            
37D2: FD 21 26 AA     LD      IY,$AA26            

; work one slot in a downward free-slot search: a busy slot passes the
; turn to the search tail, a free slot is claimed and stocked with a
; random heading-derived velocity, facing, script and fresh animation (at
; most one slot filled per turn); grounded in MAME: this fills the green
; enemy-craft band (0xA850) one slot at a time
spawnEnemyIntoFreeSlotElseStepSearch:
37D6: DD 7E 00        LD      A,(IX+$00)          
37D9: A7              AND     A                   
37DA: C2 47 38        JP      NZ,$3847            ; {code.closeOneTurnOfTheFreeSlotSearch}
37DD: DD 35 00        DEC     (IX+$00)            
37E0: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
37E3: 0F              RRCA                        
37E4: 0F              RRCA                        
37E5: E6 3F           AND     $3F                 
37E7: 4F              LD      C,A                 
37E8: CD 4B 4B        CALL    $4B4B               ; {code.drawRandomByte}
37EB: E6 0F           AND     $0F                 
37ED: D6 08           SUB     $08                 
37EF: 81              ADD     A,C                 
37F0: E6 3F           AND     $3F                 
37F2: 21 FB 39        LD      HL,$39FB            
37F5: CF              RST     $08                 
37F6: 87              ADD     A,A                 
37F7: 87              ADD     A,A                 
37F8: 21 3B 3A        LD      HL,$3A3B            
37FB: CF              RST     $08                 
37FC: FD 77 31        LD      (IY+$31),A          
37FF: 23              INC     HL                  
3800: 7E              LD      A,(HL)              
3801: FD 77 00        LD      (IY+$00),A          
3804: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
3807: C6 80           ADD     A,$80               
3809: DD 77 01        LD      (IX+$01),A          
380C: DD 77 02        LD      (IX+$02),A          
380F: CD 2D 38        CALL    $382D               ; {code.pickScriptAtRandomOrInTurn}
3812: DD 77 0A        LD      (IX+$0A),A          
3815: AF              XOR     A                   
3816: 32 C5 AC        LD      ($ACC5),A           ; {hard.workRam+4C5}
3819: DD 36 03 00     LD      (IX+$03),$00        
381D: DD 36 05 00     LD      (IX+$05),$00        
3821: DD 36 09 20     LD      (IX+$09),$20        
3825: CD 3A 32        CALL    $323A               ; {code.stepShapeAnimation}
3828: DD 36 0E 00     LD      (IX+$0E),$00        
382C: C9              RET                         

; draw a byte and let one comparison against a threshold cell decide which
; of two entirely different answers the caller gets: a draw at or above
; the threshold is folded down to one of four values and handed straight
; back, writing nothing; a draw below it ignores the drawn byte completely
; and instead steps a five-long cycle counter on, wrapping it to zero once
; it would leave the cycle, stores it and hands THAT back. ★ The two arms
; draw from DISJOINT halves rather than sampling one pool two ways: the
; random arm can only answer 5 through 8, the rotation only 0 through 4,
; so which arm ran is recoverable from the answer alone
pickScriptAtRandomOrInTurn:
382D: CD 4B 4B        CALL    $4B4B               ; {code.drawRandomByte}
3830: 21 C4 AC        LD      HL,$ACC4            
3833: BE              CP      (HL)                
3834: 30 0C           JR      NC,$3842            ; {code.loc_3842}
3836: 21 CF A9        LD      HL,$A9CF            
3839: 7E              LD      A,(HL)              
383A: 3C              INC     A                   
383B: FE 05           CP      $05                 
383D: 38 01           JR      C,$3840             ; {code.loc_3840}
383F: AF              XOR     A                   

loc_3840:
3840: 77              LD      (HL),A              
3841: C9              RET                         

loc_3842:
3842: E6 03           AND     $03                 
3844: C6 05           ADD     A,$05               
3846: C9              RET                         

; close one turn of the search for a free object slot and decide whether
; there is another: step the record cursor back one whole sixteen-byte
; record and the sprite-entry cursor back one two-byte entry, so the
; search walks its bank downward, strike one off the turn count, and while
; any remain transfer back to the body that tries one slot; when the last
; is struck off the search ends having filled nothing and this entry
; simply returns. The wide scratch pair the backward step is built from is
; left standing on the way out
closeOneTurnOfTheFreeSlotSearch:
3847: 11 F0 FF        LD      DE,$FFF0            
384A: DD 19           ADD     IX,DE               
384C: FD 2B           DEC     IY                  
384E: FD 2B           DEC     IY                  
3850: 05              DEC     B                   
3851: C2 D6 37        JP      NZ,$37D6            ; {code.spawnEnemyIntoFreeSlotElseStepSearch}
3854: C9              RET                         

; leave five consecutive object records standing on the shape a finished
; animation ends on, with their step bytes cleared so nothing walks them
; again — but only while the byte the caller points at still reads zero,
; so it is a guarded settling and not a step
stopFiveSlotAnimations:
3855: 7E              LD      A,(HL)              
3856: A7              AND     A                   
3857: C0              RET     NZ                  
3858: DD 21 50 A8     LD      IX,$A850            
385C: 11 10 00        LD      DE,$0010            
385F: 06 05           LD      B,$05               

loc_3861:
3861: DD 36 08 11     LD      (IX+$08),$11        
3865: DD 36 09 00     LD      (IX+$09),$00        
3869: DD 19           ADD     IX,DE               
386B: 10 F4           DJNZ    $3861               ; {code.loc_3861}
386D: C9              RET                         

; spawn a wave across a fixed bank of object slots: fill each free slot
; from a randomly-drawn shape record (shape index + two fields), prime its
; step counter, step its animation once, mark it live; store a fixed
; status byte when the pass ends
spawnEnemyWaveIntoFreeSlots:
386E: DD 21 50 A8     LD      IX,$A850            
3872: FD 21 1A AA     LD      IY,$AA1A            
3876: 3A C1 AC        LD      A,($ACC1)           ; {hard.workRam+4C1}
3879: 47              LD      B,A                 
387A: 3A 0D AD        LD      A,($AD0D)           ; {hard.workRam+50D}
387D: A7              AND     A                   
387E: 28 02           JR      Z,$3882             ; {code.loc_3882}
3880: 06 05           LD      B,$05               

loc_3882:
3882: C5              PUSH    BC                  
3883: DD 7E 00        LD      A,(IX+$00)          
3886: A7              AND     A                   
3887: C2 C0 38        JP      NZ,$38C0            ; {code.loc_38c0}
388A: CD 4B 4B        CALL    $4B4B               ; {code.drawRandomByte}
388D: E6 FC           AND     $FC                 
388F: 21 3B 3A        LD      HL,$3A3B            
3892: CF              RST     $08                 
3893: FD 77 31        LD      (IY+$31),A          
3896: 23              INC     HL                  
3897: 7E              LD      A,(HL)              
3898: FD 77 00        LD      (IY+$00),A          
389B: 23              INC     HL                  
389C: 7E              LD      A,(HL)              
389D: DD 77 01        LD      (IX+$01),A          
38A0: DD 77 02        LD      (IX+$02),A          
38A3: 3A C1 AC        LD      A,($ACC1)           ; {hard.workRam+4C1}
38A6: 90              SUB     B                   
38A7: 21 D2 38        LD      HL,$38D2            
38AA: CF              RST     $08                 
38AB: DD 77 0A        LD      (IX+$0A),A          
38AE: DD 36 09 20     LD      (IX+$09),$20        
38B2: CD 3A 32        CALL    $323A               ; {code.stepShapeAnimation}
38B5: DD 36 04 01     LD      (IX+$04),$01        
38B9: DD 36 0E 00     LD      (IX+$0E),$00        
38BD: DD 35 00        DEC     (IX+$00)            

loc_38c0:
38C0: 11 10 00        LD      DE,$0010            
38C3: DD 19           ADD     IX,DE               
38C5: FD 23           INC     IY                  
38C7: FD 23           INC     IY                  
38C9: C1              POP     BC                  
38CA: 10 B6           DJNZ    $3882               ; {code.loc_3882}
38CC: 3E E4           LD      A,$E4               
38CE: 32 12 A8        LD      ($A812),A           ; {hard.workRam+12}
38D1: C9              RET                         

; ---- $38D2-$3B5E: data ----
38D2: 0A 0B 0D 0E 0F 09 0C 08 0C 0F 13 16 1A 1D 21 24
38E2: 28 2B 2F 33 37 3A 3D F0 10 F0 20 F0 30 F0 40 F0
38F2: 50 F0 60 F0 70 F0 80 F0 90 F0 A0 F0 B0 F0 C0 F0
3902: D0 F0 E0 F0 F0 E0 F8 D0 F8 C0 F8 B0 F8 A0 F8 90
3912: F8 80 F8 70 F8 60 F8 50 F8 40 F8 30 F8 20 F8 10
3922: F8 00 F0 00 E0 00 D0 00 C0 00 B0 00 A0 00 90 00
3932: 80 00 70 00 60 00 50 00 40 00 30 00 20 00 10 10
3942: 10 20 10 30 10 40 10 50 10 60 10 70 10 80 10 90
3952: 10 A0 10 B0 10 C0 10 D0 10 E0 10 F0 10 F0 20 F0
3962: 30 F0 40 F0 50 F0 60 F0 70 F0 80 F0 90 F0 A0 F0
3972: B0 F0 C0 F0 D0 F0 E0 F0 F0 00 01 01 11 FF 11 02
3982: 21 FE 21 03 31 FD 31 00 00 00 11 01 01 FF 01 02
3992: 11 FE 11 03 21 FD 21 00 00 00 01 02 11 FE 11 03
39A2: 21 FD 21 04 31 FC 31 00 00 00 31 03 01 FD 01 04
39B2: 11 FC 11 03 11 FD 11 00 00 00 01 03 01 FD 01 04
39C2: 11 FC 11 05 21 FB 21 00 00 00 01 03 11 FD 11 00
39D2: 21 03 21 FD 21 00 31 00 00 03 01 FD 01 03 11 FD
39E2: 11 05 11 FB 11 00 29 00 00 00 01 03 11 FD 11 05
39F2: 21 FB 21 03 31 FD 31 00 00 08 09 0A 0B 0C 0D 0D
3A02: 0E 0F 10 11 12 13 14 14 15 16 17 18 19 1A 1B 1B
3A12: 1C 1D 1E 1F 20 21 22 22 23 24 25 26 27 28 29 29
3A22: 2A 2B 2C 2D 2E 2F 30 31 32 33 34 35 36 37 38 38
3A32: 39 00 01 02 03 04 05 06 07 F0 10 60 00 F0 20 80
3A42: 00 F0 30 80 00 F0 40 80 00 F0 50 80 00 F0 60 80
3A52: 00 F0 70 80 00 F0 80 80 00 F0 90 80 00 F0 A0 80
3A62: 00 F0 B0 80 00 F0 C0 80 00 F0 D0 80 00 F0 E0 80
3A72: 00 F0 F0 A0 00 E0 F8 C0 00 D0 F8 C0 00 C0 F8 C0
3A82: 00 B0 F8 C0 00 A0 F8 C0 00 90 F8 C0 00 80 F8 C0
3A92: 00 70 F8 C0 00 60 F8 C0 00 50 F8 C0 00 40 F8 C0
3AA2: 00 30 F8 C0 00 20 F8 C0 00 10 F8 C0 00 00 F0 E0
3AB2: 00 00 E0 00 00 00 D0 00 00 00 C0 00 00 00 B0 00
3AC2: 00 00 A0 00 00 00 90 00 00 00 80 00 00 00 70 00
3AD2: 00 00 60 00 00 00 50 00 00 00 40 00 00 00 30 00
3AE2: 00 00 20 00 00 00 10 20 00 10 10 40 00 20 10 40
3AF2: 00 30 10 40 00 40 10 40 00 50 10 40 00 60 10 40
3B02: 00 70 10 40 00 80 10 40 00 90 10 40 00 A0 10 40
3B12: 00 B0 10 40 00 C0 10 40 00 D0 10 40 00 E0 10 40
3B22: 00 F0 10 60 00 F0 20 80 00 F0 30 80 00 F0 40 80
3B32: 00 F0 50 80 00 F0 60 80 00 F0 70 80 00 F0 80 80
3B42: 00 F0 90 80 00 F0 A0 80 00 F0 B0 80 00 F0 C0 80
3B52: 00 F0 D0 80 00 F0 E0 80 00 F0 F0 A0 00

; era-1 only: dispatch the single object at record 0xa8c0 by its head byte
; -- 0 arms its fire timer (armBomberSlotWhenTimerFires), 0xff runs the
; two-tile move (advanceTwoTileObjectThenTryAimedSpawn), any other value
; advances a hit-soaking object toward death
; (advanceHitSoakingObjectThenAnimateDeath); returns untouched outside era
; 1
serviceEra1BomberObject:
3B5F: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
3B62: 3D              DEC     A                   
3B63: C0              RET     NZ                  
3B64: DD 21 C0 A8     LD      IX,$A8C0            
3B68: FD 21 28 AA     LD      IY,$AA28            
3B6C: DD 7E 00        LD      A,(IX+$00)          
3B6F: A7              AND     A                   
3B70: CA 25 3C        JP      Z,$3C25             ; {code.armBomberSlotWhenTimerFires}
3B73: 3C              INC     A                   
3B74: C2 94 3B        JP      NZ,$3B94            ; {code.advanceHitSoakingObjectThenAnimateDeath}

; advance a two-tile object one frame: fly it along its stored velocity,
; then seat its second tile directly under the first (same X, Y+0x10); if
; hasReachedBoundaryBandSelectedByHeading answers it has reached a
; boundary retire it, otherwise dress the pair by heading and run the
; aimed-spawn attempt
advanceTwoTileObjectThenTryAimedSpawn:
3B77: CD 05 3E        CALL    $3E05               ; {code.flyAlongStoredVelocity}
3B7A: FD 7E 31        LD      A,(IY+$31)          
3B7D: C6 10           ADD     A,$10               
3B7F: FD 77 33        LD      (IY+$33),A          
3B82: FD 7E 00        LD      A,(IY+$00)          
3B85: FD 77 02        LD      (IY+$02),A          
3B88: CD C4 3C        CALL    $3CC4               ; {code.hasReachedBoundaryBandSelectedByHeading}
3B8B: DA 0D 3C        JP      C,$3C0D             ; {code.retireObjectAndHold}
3B8E: CD E9 3C        CALL    $3CE9               ; {code.mirrorTwoTileObjectByHeading}
3B91: C3 25 3D        JP      $3D25               ; {code.spawnAimedEnemyIntoEraBankWhenInWindow}

; advance one hit-soaking object: while HITS_REMAINING (0xa8dc) is left,
; spend one, force the record head live (0xff) and re-request its sound
; pair before the ordinary two-tile move; once no hits remain, run the
; record head down (capped at 0x61) toward a retire-and-hold at 0, drift
; it with the world scroll, and at head 0x40 post a command / on 8-step
; boundaries above 0x40 reseat the sprite shape from the 0x3c09 table
advanceHitSoakingObjectThenAnimateDeath:
3B94: 3D              DEC     A                   
3B95: 4F              LD      C,A                 
3B96: 21 DC A8        LD      HL,$A8DC            
3B99: 7E              LD      A,(HL)              
3B9A: A7              AND     A                   
3B9B: CA A9 3B        JP      Z,$3BA9             ; {code.loc_3ba9}
3B9E: 35              DEC     (HL)                
3B9F: DD 36 00 FF     LD      (IX+$00),$FF        
3BA3: CD 83 56        CALL    $5683               ; {code.requestTwoSounds}
3BA6: C3 77 3B        JP      $3B77               ; {code.advanceTwoTileObjectThenTryAimedSpawn}

loc_3ba9:
3BA9: 79              LD      A,C                 
3BAA: FE 61           CP      $61                 
3BAC: 38 0F           JR      C,$3BBD             ; {code.loc_3bbd}
3BAE: DD 36 00 61     LD      (IX+$00),$61        
3BB2: CD 83 56        CALL    $5683               ; {code.requestTwoSounds}
3BB5: FD 36 30 3D     LD      (IY+$30),$3D        
3BB9: FD 36 32 3D     LD      (IY+$32),$3D        

loc_3bbd:
3BBD: DD 35 00        DEC     (IX+$00)            
3BC0: 28 4B           JR      Z,$3C0D             ; {code.retireObjectAndHold}
3BC2: CD 60 2B        CALL    $2B60               ; {code.driftWithWorldScroll}
3BC5: FD 7E 31        LD      A,(IY+$31)          
3BC8: C6 10           ADD     A,$10               
3BCA: FD 77 33        LD      (IY+$33),A          
3BCD: FD 7E 00        LD      A,(IY+$00)          
3BD0: FD 77 02        LD      (IY+$02),A          
3BD3: DD 7E 00        LD      A,(IX+$00)          
3BD6: D6 40           SUB     $40                 
3BD8: CA F1 3B        JP      Z,$3BF1             ; {code.loc_3bf1}
3BDB: D8              RET     C                   
3BDC: 4F              LD      C,A                 
3BDD: E6 07           AND     $07                 
3BDF: C0              RET     NZ                  
3BE0: 79              LD      A,C                 
3BE1: 0F              RRCA                        
3BE2: 0F              RRCA                        
3BE3: 0F              RRCA                        
3BE4: 3D              DEC     A                   
3BE5: 21 09 3C        LD      HL,$3C09            
3BE8: CF              RST     $08                 
3BE9: FD 77 03        LD      (IY+$03),A          
3BEC: 3C              INC     A                   
3BED: FD 77 01        LD      (IY+$01),A          
3BF0: C9              RET                         

loc_3bf1:
3BF1: 11 0B 04        LD      DE,$040B            
3BF4: FF              RST     $38                 
3BF5: FD 36 03 FA     LD      (IY+$03),$FA        
3BF9: FD 36 01 FB     LD      (IY+$01),$FB        
3BFD: FD 36 30 6C     LD      (IY+$30),$6C        
3C01: FD 36 32 6C     LD      (IY+$32),$6C        
3C05: DD 35 00        DEC     (IX+$00)            
3C08: C9              RET                         

; ---- $3C09-$3C0C: data ----
3C09: 96 94 92 90

; take an object and the slot one stride on out of play -- both record
; heads, both coordinates of the caller's sprite entry and of one fixed
; entry -- then set a further byte of the caller's record to a non-zero
; constant instead of clearing it
retireObjectAndHold:
3C0D: AF              XOR     A                   
3C0E: DD 77 00        LD      (IX+$00),A          
3C11: DD 77 10        LD      (IX+$10),A          
3C14: FD 77 00        LD      (IY+$00),A          
3C17: FD 77 31        LD      (IY+$31),A          
3C1A: 32 5B AA        LD      ($AA5B),A           ; {hard.workRam+25B}
3C1D: 32 2A AA        LD      ($AA2A),A           ; {hard.workRam+22A}
3C20: DD 36 0E 80     LD      (IX+$0E),$80        
3C24: C9              RET                         

; on even frames tick a slot's arming countdown at ix+0x0e; when it fires
; and MOTHER_SHIP_ARMED (0xad0d) is clear, arm the slot -- pick a shape
; record from PLAYER_HEADING (0xa802) via the table at 0x3c84, snap the
; heading to a facing bit, look up the velocity pair, write
; shape/facing/velocity into the record, set HITS_REMAINING (0xa8dc)=3,
; and mark the slot live (ix+0=0xff); grounded in MAME as the era-1 large
; multi-hit craft (removed by a negative control). mechanisms.md §6
; identifies this counter-3 era-1 craft as the 1940 bomber (absorbs three,
; dies on the fourth hit) -- NOT the counter-7 Mother-Ship; the
; MOTHER_SHIP_ARMED gate names the 0xAD0D boss class, and 3c25's sole
; caller serviceEra1BomberObject dispatches it only in era 1
armBomberSlotWhenTimerFires:
3C25: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
3C28: E6 01           AND     $01                 
3C2A: C0              RET     NZ                  
3C2B: DD 35 0E        DEC     (IX+$0E)            
3C2E: CA 32 3C        JP      Z,$3C32             ; {code.loc_3c32}
3C31: C9              RET                         

loc_3c32:
3C32: 3A 0D AD        LD      A,($AD0D)           ; {hard.workRam+50D}
3C35: A7              AND     A                   
3C36: C0              RET     NZ                  
3C37: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
3C3A: 47              LD      B,A                 
3C3B: C6 08           ADD     A,$08               
3C3D: E6 7F           AND     $7F                 
3C3F: FE 10           CP      $10                 
3C41: 38 32           JR      C,$3C75             ; {code.loc_3c75}
3C43: 78              LD      A,B                 

loc_3c44:
3C44: 0F              RRCA                        
3C45: 0F              RRCA                        
3C46: E6 3E           AND     $3E                 
3C48: 21 84 3C        LD      HL,$3C84            
3C4B: CF              RST     $08                 
3C4C: FD 77 31        LD      (IY+$31),A          
3C4F: 23              INC     HL                  
3C50: 7E              LD      A,(HL)              
3C51: FD 77 00        LD      (IY+$00),A          
3C54: 78              LD      A,B                 
3C55: C6 C0           ADD     A,$C0               
3C57: E6 80           AND     $80                 
3C59: DD 77 02        LD      (IX+$02),A          
3C5C: CD 42 59        CALL    $5942               ; {code.loc_5942}
3C5F: DD 73 0A        LD      (IX+$0A),E          
3C62: DD 72 0B        LD      (IX+$0B),D          
3C65: DD 71 0C        LD      (IX+$0C),C          
3C68: DD 70 0D        LD      (IX+$0D),B          
3C6B: 3E 03           LD      A,$03               
3C6D: 32 DC A8        LD      ($A8DC),A           ; {hard.workRam+DC}
3C70: DD 36 00 FF     LD      (IX+$00),$FF        
3C74: C9              RET                         

loc_3c75:
3C75: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
3C78: 4F              LD      C,A                 
3C79: 3E 10           LD      A,$10               
3C7B: CB 59           BIT     3,C                 
3C7D: 20 02           JR      NZ,$3C81            ; {code.loc_3c81}
3C7F: ED 44           NEG                         

loc_3c81:
3C81: 80              ADD     A,B                 
3C82: 18 C0           JR      $3C44               ; {code.loc_3c44}

; ---- $3C84-$3CC3: data ----
3C84: EC 80 EC 88 EC 90 EC A0 EC B0 EC C0 EC D0 EC E0
3C94: F0 EC F0 EC F0 E0 F0 D0 F0 C0 F0 B0 F0 A0 F0 90
3CA4: F0 80 F0 78 F0 70 F0 60 F0 50 F0 40 F0 30 F0 28
3CB4: F0 20 EC 20 EC 30 EC 40 EC 50 EC 60 EC 70 EC 78

; answer, in the carry flag, whether an object has reached a boundary, the
; heading choosing which of two adjacent and disjoint three-wide bands is
; the one tested
hasReachedBoundaryBandSelectedByHeading:
3CC4: DD 7E 02        LD      A,(IX+$02)          
3CC7: C6 40           ADD     A,$40               
3CC9: CB 7F           BIT     7,A                 
3CCB: C2 D9 3C        JP      NZ,$3CD9            ; {code.hasDriftedOffTheField}
3CCE: FD 7E 31        LD      A,(IY+$31)          
3CD1: C6 13           ADD     A,$13               
3CD3: FE 03           CP      $03                 
3CD5: D8              RET     C                   
3CD6: C3 E1 3C        JP      $3CE1               ; {code.hasReachedHorizontalEdgeWindow}

; answer whether an object has drifted onto the boundary its caller frees
; the slot at: the vertical window this arm owns is tested here, and when
; it is not met the same question is handed on to the horizontal one, so
; the answer is an OR of two windows on two axes and only the first is
; decided here
hasDriftedOffTheField:
3CD9: FD 7E 31        LD      A,(IY+$31)          
3CDC: C6 10           ADD     A,$10               
3CDE: FE 03           CP      $03                 
3CE0: D8              RET     C                   

; answer whether the byte at the head of a sprite entry has reached its
; wrap point, testing a four-wide window that straddles zero -- so it
; measures a wrapped distance rather than bounding a range, which is what
; lets a byte stepping several units at a time land inside the window
; instead of over it
hasReachedHorizontalEdgeWindow:
3CE1: FD 7E 00        LD      A,(IY+$00)          
3CE4: C6 02           ADD     A,$02               
3CE6: FE 04           CP      $04                 
3CE8: C9              RET                         

; dress two adjacent sprite entries with a consecutive pair of shape codes
; from the block HITS_REMAINING selects, so the object wears its damage,
; and mirror the pair -- swapping which entry takes the lower code, and
; flipping both -- on whichever half of the heading circle it is in
mirrorTwoTileObjectByHeading:
3CE9: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
3CEC: E6 02           AND     $02                 
3CEE: 47              LD      B,A                 
3CEF: 3A DC A8        LD      A,($A8DC)           ; {hard.workRam+DC}
3CF2: 4F              LD      C,A                 
3CF3: 3E 03           LD      A,$03               
3CF5: 91              SUB     C                   
3CF6: 87              ADD     A,A                 
3CF7: 87              ADD     A,A                 
3CF8: C6 A0           ADD     A,$A0               
3CFA: 80              ADD     A,B                 
3CFB: 4F              LD      C,A                 
3CFC: DD 7E 02        LD      A,(IX+$02)          
3CFF: C6 40           ADD     A,$40               
3D01: FE 80           CP      $80                 
3D03: 38 10           JR      C,$3D15             ; {code.loc_3d15}
3D05: FD 71 01        LD      (IY+$01),C          
3D08: 0C              INC     C                   
3D09: FD 71 03        LD      (IY+$03),C          
3D0C: FD 36 30 ED     LD      (IY+$30),$ED        
3D10: FD 36 32 ED     LD      (IY+$32),$ED        
3D14: C9              RET                         

loc_3d15:
3D15: FD 71 03        LD      (IY+$03),C          
3D18: 0C              INC     C                   
3D19: FD 71 01        LD      (IY+$01),C          
3D1C: FD 36 30 6D     LD      (IY+$30),$6D        
3D20: FD 36 32 6D     LD      (IY+$32),$6D        
3D24: C9              RET                         

; spawn one aimed enemy when the spawn slot is free, the cooldown at
; 0xa8f4 is clear, the era count at 0xa8c6 is live, and an object in the
; caller's two-slot bank sits inside a doubled window: seat the found
; slot's coords, the doubled velocity pair aimed toward the player at
; 0xac7f (aim side alternated each spawn via 0xa8d4), a script and a shape
; into the era's fixed record+sprite bank (0xa840/0xaa18 or
; 0xa8e0/0xaa2c), decrement the new record head, and reload the cooldown
; from 0xa8f6
spawnAimedEnemyIntoEraBankWhenInWindow:
3D25: DD 7E 00        LD      A,(IX+$00)          
3D28: 3C              INC     A                   
3D29: C0              RET     NZ                  
3D2A: 3A F4 A8        LD      A,($A8F4)           ; {hard.workRam+F4}
3D2D: A7              AND     A                   
3D2E: C0              RET     NZ                  
3D2F: 3A C6 A8        LD      A,($A8C6)           ; {hard.workRam+C6}
3D32: A7              AND     A                   
3D33: C8              RET     Z                   
3D34: FE 01           CP      $01                 
3D36: CA 40 3D        JP      Z,$3D40             ; {code.loc_3d40}
3D39: 3A E0 A8        LD      A,($A8E0)           ; {hard.workRam+E0}
3D3C: A7              AND     A                   
3D3D: CA 45 3D        JP      Z,$3D45             ; {code.loc_3d45}

loc_3d40:
3D40: 3A 40 A8        LD      A,($A840)           ; {hard.workRam+40}
3D43: A7              AND     A                   
3D44: C0              RET     NZ                  

loc_3d45:
3D45: 06 02           LD      B,$02               
3D47: 3A D6 A8        LD      A,($A8D6)           ; {hard.workRam+D6}
3D4A: 57              LD      D,A                 
3D4B: 87              ADD     A,A                 
3D4C: 5F              LD      E,A                 

loc_3d4d:
3D4D: 3E 84           LD      A,$84               
3D4F: FD 96 00        SUB     (IY+$00)            
3D52: 82              ADD     A,D                 
3D53: BB              CP      E                   
3D54: D2 6F 3D        JP      NC,$3D6F            ; {code.loc_3d6f}
3D57: 3E 78           LD      A,$78               
3D59: FD 96 31        SUB     (IY+$31)            
3D5C: 82              ADD     A,D                 
3D5D: BB              CP      E                   
3D5E: D2 6F 3D        JP      NC,$3D6F            ; {code.loc_3d6f}
3D61: D9              EXX                         
3D62: 11 10 00        LD      DE,$0010            
3D65: DD 19           ADD     IX,DE               
3D67: FD 23           INC     IY                  
3D69: FD 23           INC     IY                  
3D6B: D9              EXX                         
3D6C: 10 DF           DJNZ    $3D4D               ; {code.loc_3d4d}
3D6E: C9              RET                         

loc_3d6f:
3D6F: CD 5F 56        CALL    $565F               ; {code.requestEnemyLaunchSound}
3D72: 21 7F AC        LD      HL,$AC7F            
3D75: CD B8 33        CALL    $33B8               ; {code.headingToward}
3D78: 67              LD      H,A                 
3D79: 3E 18           LD      A,$18               
3D7B: EB              EX      DE,HL               
3D7C: 21 D4 A8        LD      HL,$A8D4            
3D7F: 34              INC     (HL)                
3D80: 46              LD      B,(HL)              
3D81: CB 40           BIT     0,B                 
3D83: 20 02           JR      NZ,$3D87            ; {code.loc_3d87}
3D85: ED 44           NEG                         

loc_3d87:
3D87: EB              EX      DE,HL               
3D88: 84              ADD     A,H                 
3D89: 08              EX      AF,AF'              
3D8A: FD 46 31        LD      B,(IY+$31)          
3D8D: FD 4E 00        LD      C,(IY+$00)          
3D90: 3A C6 A8        LD      A,($A8C6)           ; {hard.workRam+C6}
3D93: FE 01           CP      $01                 
3D95: CA 9F 3D        JP      Z,$3D9F             ; {code.loc_3d9f}
3D98: 3A E0 A8        LD      A,($A8E0)           ; {hard.workRam+E0}
3D9B: A7              AND     A                   
3D9C: CA CF 3D        JP      Z,$3DCF             ; {code.loc_3dcf}

loc_3d9f:
3D9F: DD 21 40 A8     LD      IX,$A840            
3DA3: FD 21 18 AA     LD      IY,$AA18            

loc_3da7:
3DA7: FD 70 31        LD      (IY+$31),B          
3DAA: FD 71 00        LD      (IY+$00),C          
3DAD: 08              EX      AF,AF'              
3DAE: CD C5 59        CALL    $59C5               ; {code.loc_59c5}
3DB1: DD 73 0A        LD      (IX+$0A),E          
3DB4: DD 72 0B        LD      (IX+$0B),D          
3DB7: DD 71 0C        LD      (IX+$0C),C          
3DBA: DD 70 0D        LD      (IX+$0D),B          
3DBD: FD 36 01 4D     LD      (IY+$01),$4D        
3DC1: FD 36 30 62     LD      (IY+$30),$62        
3DC5: DD 35 00        DEC     (IX+$00)            
3DC8: 3A F6 A8        LD      A,($A8F6)           ; {hard.workRam+F6}
3DCB: 32 F4 A8        LD      ($A8F4),A           ; {hard.workRam+F4}
3DCE: C9              RET                         

loc_3dcf:
3DCF: DD 21 E0 A8     LD      IX,$A8E0            
3DD3: FD 21 2C AA     LD      IY,$AA2C            
3DD7: C3 A7 3D        JP      $3DA7               ; {code.loc_3da7}

; guard on the era index and, when it passes, hand two fixed bases to the
; shared slot servicer; the guard is the whole of the decision, and the
; bases are constants rather than anything a caller chose
serviceFixedSlotInEra1:
3DDA: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
3DDD: 3D              DEC     A                   
3DDE: C0              RET     NZ                  
3DDF: DD 21 E0 A8     LD      IX,$A8E0            
3DE3: FD 21 2C AA     LD      IY,$AA2C            
3DE7: CD EB 3D        CALL    $3DEB               ; {code.serviceSlotByHeadByte}
3DEA: C9              RET                         

; service one slot, splitting three ways on the head byte of its record:
; zero does nothing at all, all-ones flies the object one step along the
; velocity it carries and retires it into the shared cooldown only once
; that step has put it on a retire line, and any OTHER value retires it on
; the spot without moving it first
serviceSlotByHeadByte:
3DEB: DD 7E 00        LD      A,(IX+$00)          
3DEE: A7              AND     A                   
3DEF: C8              RET     Z                   
3DF0: 3C              INC     A                   
3DF1: C2 FB 3D        JP      NZ,$3DFB            ; {code.retireSlotIntoSharedCooldown}
3DF4: CD 05 3E        CALL    $3E05               ; {code.flyAlongStoredVelocity}
3DF7: CD 83 2B        CALL    $2B83               ; {code.hasReachedRetireLine}
3DFA: D0              RET     NC                  

; retire a slot the way retireSlot does and then arm its delay byte from
; one shared address instead of leaving it clear, so every slot retired
; here goes out holding the same value
retireSlotIntoSharedCooldown:
3DFB: CD AB 40        CALL    $40AB               ; {code.retireSlot}
3DFE: 3A F6 A8        LD      A,($A8F6)           ; {hard.workRam+F6}
3E01: DD 77 0E        LD      (IX+$0E),A          
3E04: C9              RET                         

; fly one object a single step along the velocity held in its own record,
; and in the same add carry it with the world; each coordinate gains its
; stored word plus the shared per-frame scroll
flyAlongStoredVelocity:
3E05: DD 66 0B        LD      H,(IX+$0B)          
3E08: DD 6E 0A        LD      L,(IX+$0A)          
3E0B: ED 5B 08 A8     LD      DE,($A808)          ; {hard.workRam+8}
3E0F: 19              ADD     HL,DE               
3E10: FD 56 31        LD      D,(IY+$31)          
3E13: DD 5E 03        LD      E,(IX+$03)          
3E16: 19              ADD     HL,DE               
3E17: FD 74 31        LD      (IY+$31),H          
3E1A: DD 75 03        LD      (IX+$03),L          
3E1D: DD 66 0D        LD      H,(IX+$0D)          
3E20: DD 6E 0C        LD      L,(IX+$0C)          
3E23: ED 5B 0A A8     LD      DE,($A80A)          ; {hard.workRam+A}
3E27: 19              ADD     HL,DE               
3E28: FD 56 00        LD      D,(IY+$00)          
3E2B: DD 5E 05        LD      E,(IX+$05)          
3E2E: 19              ADD     HL,DE               
3E2F: FD 74 00        LD      (IY+$00),H          
3E32: DD 75 05        LD      (IX+$05),L          
3E35: C9              RET                         

; put four named actor slots through the shared per-slot step, in a fixed
; order, one after another, without asking first whether any of them holds
; anything — so the four are serviced as a group and the group's
; membership is fixed here rather than by the caller
stepFourActorSlots:
3E36: DD 21 10 A8     LD      IX,$A810            
3E3A: FD 21 12 AA     LD      IY,$AA12            
3E3E: CD 63 3E        CALL    $3E63               ; {code.dispatchObjectSlotByHeadByte}
3E41: DD 21 20 A8     LD      IX,$A820            
3E45: FD 21 14 AA     LD      IY,$AA14            
3E49: CD 63 3E        CALL    $3E63               ; {code.dispatchObjectSlotByHeadByte}
3E4C: DD 21 30 A8     LD      IX,$A830            
3E50: FD 21 16 AA     LD      IY,$AA16            
3E54: CD 63 3E        CALL    $3E63               ; {code.dispatchObjectSlotByHeadByte}
3E57: DD 21 40 A8     LD      IX,$A840            
3E5B: FD 21 18 AA     LD      IY,$AA18            
3E5F: CD 63 3E        CALL    $3E63               ; {code.dispatchObjectSlotByHeadByte}
3E62: C9              RET                         

; split three ways on the head byte of the record an index register points
; at: zero returns with nothing done, all-ones hands over to one
; continuation and every other value to another. One byte read, nothing
; written, and neither continuation is given anything this entry computed
dispatchObjectSlotByHeadByte:
3E63: DD 7E 00        LD      A,(IX+$00)          
3E66: A7              AND     A                   
3E67: C8              RET     Z                   
3E68: 3C              INC     A                   
3E69: C2 8E 3E        JP      NZ,$3E8E            ; {code.runSlotCountdownDriftAndAnimateElseRetire}

; fly one object a step along the velocity it carries and retire its slot
; once that step has put it on a retire line; in one era of the game, and
; only that one, the object is also given the next frame of a fixed shape
; cycle before it moves, and the retire is last so a shape written this
; tick may go out in the same breath
flyAndRetireSlotCyclingShapeInEra4:
3E6C: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
3E6F: FE 04           CP      $04                 
3E71: CC 7E 3E        CALL    Z,$3E7E             ; {code.animateFixedShapeCycle}
3E74: CD 05 3E        CALL    $3E05               ; {code.flyAlongStoredVelocity}
3E77: CD 83 2B        CALL    $2B83               ; {code.hasReachedRetireLine}
3E7A: D0              RET     NC                  
3E7B: C3 AB 40        JP      $40AB               ; {code.retireSlot}

; give a sprite entry the next frame of an eight-frame cycle from a fixed
; shape base, and one fixed control byte beside it; nothing of the object
; is read, so two entries written in one tick get the same shape
animateFixedShapeCycle:
3E7E: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
3E81: 0F              RRCA                        
3E82: E6 07           AND     $07                 
3E84: C6 40           ADD     A,$40               
3E86: FD 77 01        LD      (IY+$01),A          
3E89: FD 36 30 44     LD      (IY+$30),$44        
3E8D: C9              RET                         

; run one slot's counter down for a frame and take the slot out of play as
; soon as it has nothing left to run; the era cell not standing at the
; last era, or the counter already sitting one above the floor, ends it
; outright, and otherwise the counter drops by one and the slot drifts
; with the world
runSlotCountdownDriftAndAnimateElseRetire:
3E8E: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
3E91: FE 04           CP      $04                 
3E93: 28 03           JR      Z,$3E98             ; {code.loc_3e98}
3E95: C3 AB 40        JP      $40AB               ; {code.retireSlot}

loc_3e98:
3E98: DD 7E 00        LD      A,(IX+$00)          
3E9B: FE 01           CP      $01                 
3E9D: CA AB 40        JP      Z,$40AB             ; {code.retireSlot}
3EA0: DD 35 00        DEC     (IX+$00)            
3EA3: FE 3C           CP      $3C                 
3EA5: D4 CB 3E        CALL    NC,$3ECB            ; {code.stampObjectStateByte3bThenRequestTwoSounds}
3EA8: CD 60 2B        CALL    $2B60               ; {code.driftWithWorldScroll}
3EAB: DD 7E 00        LD      A,(IX+$00)          
3EAE: FE 1C           CP      $1C                 
3EB0: D8              RET     C                   
3EB1: D6 1C           SUB     $1C                 
3EB3: 0F              RRCA                        
3EB4: 0F              RRCA                        
3EB5: E6 07           AND     $07                 
3EB7: 21 C3 3E        LD      HL,$3EC3            
3EBA: CF              RST     $08                 
3EBB: FD 77 01        LD      (IY+$01),A          
3EBE: FD 36 30 03     LD      (IY+$30),$03        
3EC2: C9              RET                         

; ---- $3EC3-$3ECA: data ----
3EC3: FF E6 E7 E7 E6 E6 E5 E4

; force the head byte of the record the index register points at to one
; fixed value and hand over; what that byte held is discarded unread, so
; this is a clamp and not a step
stampObjectStateByte3bThenRequestTwoSounds:
3ECB: DD 36 00 3B     LD      (IX+$00),$3B        
3ECF: C3 83 56        JP      $5683               ; {code.requestTwoSounds}

; ---- $3ED2-$3ED5: data ----
3ED2: 92 A6 14 B9

; one gated attempt to launch an enemy into the object bank: past a phase-
; key match, an arm flag, a non-empty flight count, and a strided scan for
; a free record, three margin windows must place the aim point near the
; player entry and the scroll; only then does it request the launch sound,
; copy the entry's two coordinates into the found record's paired entry,
; look up a doubled velocity pair from the heading via one of two tables
; chosen by a select cell, stock the record with that velocity, stamp two
; entry constants, re-arm the flag from its source, and count the record
; head down one
launchBankEnemyWhenAimedNearPlayer:
3ED6: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
3ED9: E6 07           AND     $07                 
3EDB: C6 05           ADD     A,$05               
3EDD: DD BE 0F        CP      (IX+$0F)            
3EE0: C0              RET     NZ                  
3EE1: 3A 17 A8        LD      A,($A817)           ; {hard.workRam+17}
3EE4: A7              AND     A                   
3EE5: C0              RET     NZ                  
3EE6: 21 10 A8        LD      HL,$A810            
3EE9: 11 12 AA        LD      DE,$AA12            
3EEC: 3A 44 A8        LD      A,($A844)           ; {hard.workRam+44}
3EEF: A7              AND     A                   
3EF0: C8              RET     Z                   
3EF1: 47              LD      B,A                 

loc_3ef2:
3EF2: 7E              LD      A,(HL)              
3EF3: A7              AND     A                   
3EF4: 28 09           JR      Z,$3EFF             ; {code.loc_3eff}
3EF6: 7D              LD      A,L                 
3EF7: C6 10           ADD     A,$10               
3EF9: 6F              LD      L,A                 
3EFA: 1C              INC     E                   
3EFB: 1C              INC     E                   
3EFC: 10 F4           DJNZ    $3EF2               ; {code.loc_3ef2}
3EFE: C9              RET                         

loc_3eff:
3EFF: 22 91 A9        LD      ($A991),HL          ; {hard.workRam+191}
3F02: ED 53 93 A9     LD      ($A993),DE          ; {hard.workRam+193}
3F06: 3A 27 A8        LD      A,($A827)           ; {hard.workRam+27}
3F09: 47              LD      B,A                 
3F0A: 87              ADD     A,A                 
3F0B: 4F              LD      C,A                 
3F0C: 3E 78           LD      A,$78               
3F0E: FD 96 31        SUB     (IY+$31)            
3F11: 80              ADD     A,B                 
3F12: B9              CP      C                   
3F13: 30 08           JR      NC,$3F1D            ; {code.loc_3f1d}
3F15: 3E 84           LD      A,$84               
3F17: FD 96 00        SUB     (IY+$00)            
3F1A: 80              ADD     A,B                 
3F1B: B9              CP      C                   
3F1C: D8              RET     C                   

loc_3f1d:
3F1D: 3A 37 A8        LD      A,($A837)           ; {hard.workRam+37}
3F20: 47              LD      B,A                 
3F21: 87              ADD     A,A                 
3F22: 4F              LD      C,A                 
3F23: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
3F26: DD 96 02        SUB     (IX+$02)            
3F29: 80              ADD     A,B                 
3F2A: B9              CP      C                   
3F2B: D0              RET     NC                  
3F2C: 7A              LD      A,D                 
3F2D: FE 02           CP      $02                 
3F2F: CA 9E 3F        JP      Z,$3F9E             ; {code.loc_3f9e}

loc_3f32:
3F32: 21 7F AC        LD      HL,$AC7F            
3F35: CD B8 33        CALL    $33B8               ; {code.headingToward}
3F38: 4F              LD      C,A                 
3F39: DD 96 02        SUB     (IX+$02)            
3F3C: C6 10           ADD     A,$10               
3F3E: FE 20           CP      $20                 
3F40: D0              RET     NC                  
3F41: CD 93 3F        CALL    $3F93               ; {code.requestEraKeyedLaunchSound}
3F44: DD E5           PUSH    IX                  
3F46: FD E5           PUSH    IY                  
3F48: FD 56 31        LD      D,(IY+$31)          
3F4B: FD 5E 00        LD      E,(IY+$00)          
3F4E: DD 2A 91 A9     LD      IX,($A991)          ; {hard.workRam+191}
3F52: FD 2A 93 A9     LD      IY,($A993)          ; {hard.workRam+193}
3F56: FD 72 31        LD      (IY+$31),D          
3F59: FD 73 00        LD      (IY+$00),E          
3F5C: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
3F5F: A7              AND     A                   
3F60: 79              LD      A,C                 
3F61: 20 05           JR      NZ,$3F68            ; {code.loc_3f68}
3F63: CD CB 59        CALL    $59CB               ; {code.loc_59cb}
3F66: 18 03           JR      $3F6B               ; {code.loc_3f6b}

loc_3f68:
3F68: CD D1 59        CALL    $59D1               ; {code.loc_59d1}

loc_3f6b:
3F6B: DD 73 0A        LD      (IX+$0A),E          
3F6E: DD 72 0B        LD      (IX+$0B),D          
3F71: DD 71 0C        LD      (IX+$0C),C          
3F74: DD 70 0D        LD      (IX+$0D),B          
3F77: FD 7E 31        LD      A,(IY+$31)          
3F7A: FD 7E 00        LD      A,(IY+$00)          
3F7D: FD 36 01 4D     LD      (IY+$01),$4D        
3F81: FD 36 30 62     LD      (IY+$30),$62        
3F85: 3A 14 A8        LD      A,($A814)           ; {hard.workRam+14}
3F88: 32 17 A8        LD      ($A817),A           ; {hard.workRam+17}
3F8B: DD 35 00        DEC     (IX+$00)            
3F8E: FD E1           POP     IY                  
3F90: DD E1           POP     IX                  
3F92: C9              RET                         

; request the sound of a craft launching, taking the code from one of two
; program bytes according to whether the era has reached the fourth; both
; go through the play-gated door, so the attract demo stays silent
requestEraKeyedLaunchSound:
3F93: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
3F96: FE 03           CP      $03                 
3F98: DA 5F 56        JP      C,$565F             ; {code.requestEnemyLaunchSound}
3F9B: C3 69 56        JP      $5669               ; {code.requestEnemyLaunchSoundLateEra}

loc_3f9e:
3F9E: 3A E6 A8        LD      A,($A8E6)           ; {hard.workRam+E6}
3FA1: 47              LD      B,A                 
3FA2: 87              ADD     A,A                 
3FA3: 4F              LD      C,A                 
3FA4: 3E 84           LD      A,$84               
3FA6: FD 96 00        SUB     (IY+$00)            
3FA9: 80              ADD     A,B                 
3FAA: B9              CP      C                   
3FAB: D0              RET     NC                  
3FAC: C3 32 3F        JP      $3F32               ; {code.loc_3f32}

; point an object's sprite the way it is heading, from a different pair of
; sector tables to the sibling that does the same rounding
dressSpriteShapeAndAttributeForHeadingSector:
3FAF: DD 7E 02        LD      A,(IX+$02)          
3FB2: C6 08           ADD     A,$08               
3FB4: 0F              RRCA                        
3FB5: 0F              RRCA                        
3FB6: 0F              RRCA                        
3FB7: 0F              RRCA                        
3FB8: E6 0F           AND     $0F                 
3FBA: 21 CA 3F        LD      HL,$3FCA            
3FBD: CF              RST     $08                 
3FBE: FD 77 01        LD      (IY+$01),A          
3FC1: 11 10 00        LD      DE,$0010            
3FC4: 19              ADD     HL,DE               
3FC5: 7E              LD      A,(HL)              
3FC6: FD 77 30        LD      (IY+$30),A          
3FC9: C9              RET                         

; ---- $3FCA-$3FE9: data ----
3FCA: 48 49 4A 4B 4C 4B 4A 49 48 49 4A 4B 4C 4B 4A 49
3FDA: F4 B4 B4 B4 B4 34 34 34 34 74 74 74 74 F4 F4 F4

; era-zero-gated top-of-frame entry to the three-slot ballistic-object
; bank (dispatched as serviceRoundThenResolvePlayerState's substep 7):
; returns at once unless ERA_INDEX 0xad04 is 0, else seats the cursors
; (record ix=0xa8c0, sprite iy=0xaa28, count b=3) and routes the first
; slot by its marker byte -- step an empty slot via
; advanceSlotThenSweepObjectBankByHead, fly a ballistic (0xFF) slot then
; step it, else hand any other marker to
; sweepObjectSlotBankServicingFirstSlot
serviceEra0BallisticObjectBank:
3FEA: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
3FED: A7              AND     A                   
3FEE: C0              RET     NZ                  
3FEF: DD 21 C0 A8     LD      IX,$A8C0            
3FF3: FD 21 28 AA     LD      IY,$AA28            
3FF7: 06 03           LD      B,$03               

; sweep a fixed bank of object slots for a frame, servicing each by its
; head byte -- fly a ballistic slot (0xFF) a frame along its arc, run the
; shape-cycle countdown service on any other nonzero, skip an empty (0) --
; striding one 0x10 record and two sprite-entry bytes per slot for the
; caller's count
sweepObjectSlotBankByHead:
3FF9: DD 7E 00        LD      A,(IX+$00)          
3FFC: A7              AND     A                   
3FFD: CA 0B 40        JP      Z,$400B             ; {code.advanceSlotThenSweepObjectBankByHead}
4000: 3C              INC     A                   
4001: 20 05           JR      NZ,$4008            ; {code.sweepObjectSlotBankServicingFirstSlot}
4003: CD 17 40        CALL    $4017               ; {code.flyAlongBallisticArc}
4006: 18 03           JR      $400B               ; {code.advanceSlotThenSweepObjectBankByHead}

; sweep the fixed three-slot object bank for one frame from the seated
; cursors (record cursor +0x10, sprite cursor +2 per slot, count bounding
; the pass): service the first slot's shape-cycle unconditionally, then
; route each following slot by its marker byte -- skip an empty (0x00)
; slot, fly a ballistic (0xFF) slot a step, and service any other marker's
; shape-cycle
sweepObjectSlotBankServicingFirstSlot:
4008: CD 6C 40        CALL    $406C               ; {code.runOneShotAnimatedObjectSlot}

; advance-step entry of the object-bank sweep: stride one slot forward
; (record +0x10, sprite entry +2) and return when the count runs out; step
; over an empty slot, fly a ballistic (0xFF) slot a frame and step over
; it, and hand the first slot bearing any other marker to the servicing
; sweep for the rest of the bank
advanceSlotThenSweepObjectBankByHead:
400B: 11 10 00        LD      DE,$0010            
400E: DD 19           ADD     IX,DE               
4010: FD 23           INC     IY                  
4012: FD 23           INC     IY                  
4014: 10 E3           DJNZ    $3FF9               ; {code.sweepObjectSlotBankByHead}
4016: C9              RET                         

; fly one object a frame along a ballistic arc -- a constant sideways step
; whose sign the record's own flag fixes, and a stored velocity on the
; other axis that gains a fixed amount every frame -- carrying it with the
; world scroll in both axes, and retiring the slot outright once it leaves
; the field on either
flyAlongBallisticArc:
4017: FD 56 31        LD      D,(IY+$31)          
401A: DD 5E 03        LD      E,(IX+$03)          
401D: DD 7E 01        LD      A,(IX+$01)          
4020: A7              AND     A                   
4021: 28 05           JR      Z,$4028             ; {code.loc_4028}
4023: 21 80 FE        LD      HL,$FE80            
4026: 18 03           JR      $402B               ; {code.loc_402b}

loc_4028:
4028: 21 80 01        LD      HL,$0180            

loc_402b:
402B: 19              ADD     HL,DE               
402C: ED 5B 08 A8     LD      DE,($A808)          ; {hard.workRam+8}
4030: 19              ADD     HL,DE               
4031: FD 74 31        LD      (IY+$31),H          
4034: DD 75 03        LD      (IX+$03),L          
4037: DD 6E 07        LD      L,(IX+$07)          
403A: DD 66 08        LD      H,(IX+$08)          
403D: 11 09 00        LD      DE,$0009            
4040: 19              ADD     HL,DE               
4041: DD 75 07        LD      (IX+$07),L          
4044: DD 74 08        LD      (IX+$08),H          
4047: FD 56 00        LD      D,(IY+$00)          
404A: DD 5E 05        LD      E,(IX+$05)          
404D: 19              ADD     HL,DE               
404E: ED 5B 0A A8     LD      DE,($A80A)          ; {hard.workRam+A}
4052: 19              ADD     HL,DE               
4053: FD 74 00        LD      (IY+$00),H          
4056: DD 75 05        LD      (IX+$05),L          
4059: FD 7E 31        LD      A,(IY+$31)          
405C: C6 10           ADD     A,$10               
405E: FE 20           CP      $20                 
4060: DA AB 40        JP      C,$40AB             ; {code.retireSlot}
4063: FD 7E 00        LD      A,(IY+$00)          
4066: FE F8           CP      $F8                 
4068: D2 AB 40        JP      NC,$40AB            ; {code.retireSlot}
406B: C9              RET                         

; service one animated slot for a frame: rearm it (stamp the countdown to
; 59 and request the paired sound) when the countdown at (ix+0) is >=0x3c,
; count the countdown down, retire the sprite (zero iy+0 and iy+0x31) when
; it reaches zero, otherwise drift the object with the world scroll and,
; once the countdown is >=0x1c, drive the sprite shape (iy+1) from the
; 9-byte table at 0x4094 indexed by (countdown-0x1c)>>2 and set its
; attribute (iy+0x30) to 0x0e
runOneShotAnimatedObjectSlot:
406C: DD 7E 00        LD      A,(IX+$00)          
406F: FE 3C           CP      $3C                 
4071: D4 9D 40        CALL    NC,$409D            ; {code.stampObjectStateByte3bThenRequestSound}
4074: DD 35 00        DEC     (IX+$00)            
4077: 28 32           JR      Z,$40AB             ; {code.retireSlot}
4079: CD 60 2B        CALL    $2B60               ; {code.driftWithWorldScroll}
407C: DD 7E 00        LD      A,(IX+$00)          
407F: FE 1C           CP      $1C                 
4081: D8              RET     C                   
4082: D6 1C           SUB     $1C                 
4084: 0F              RRCA                        
4085: 0F              RRCA                        
4086: E6 0F           AND     $0F                 
4088: 21 94 40        LD      HL,$4094            
408B: CF              RST     $08                 
408C: FD 77 01        LD      (IY+$01),A          
408F: FD 36 30 0E     LD      (IY+$30),$0E        
4093: C9              RET                         

; ---- $4094-$409C: data ----
4094: FF 9A 99 98 98 99 99 9A 9B

; stamp one object's state byte to fifty-nine and ask for the sound that
; goes with it; the stamp is unconditional -- nothing here reads the byte
; first, and the ROM's test at this entry sends both of its answers to the
; same address
stampObjectStateByte3bThenRequestSound:
409D: DD 36 00 3B     LD      (IX+$00),$3B        
40A1: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
40A4: A7              AND     A                   
40A5: CA 8E 56        JP      Z,$568E             ; {code.loc_568e}
40A8: C3 8E 56        JP      $568E               ; {code.loc_568e}

; retire an object, zeroing only the INTEGER halves — occupancy byte and
; both sprite-entry coordinates — leaving the sub-pixel remainders
; standing
retireSlot:
40AB: DD 36 00 00     LD      (IX+$00),$00        
40AF: FD 36 00 00     LD      (IY+$00),$00        
40B3: FD 36 31 00     LD      (IY+$31),$00        
40B7: C9              RET                         

; ask for one sound on every thirty-second frame from the third era on,
; and only while none of the three records at 0xA8C0, 0xA8D0 and 0xA8E0 is
; live; any one of those four tests failing ends the entry having done
; nothing at all
askForSoundWhileTheGroupIsClear:
40B8: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
40BB: FE 02           CP      $02                 
40BD: D8              RET     C                   
40BE: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
40C1: E6 1F           AND     $1F                 
40C3: C0              RET     NZ                  
40C4: 3A C0 A8        LD      A,($A8C0)           ; {hard.workRam+C0}
40C7: 3C              INC     A                   
40C8: C8              RET     Z                   
40C9: 3A D0 A8        LD      A,($A8D0)           ; {hard.workRam+D0}
40CC: 3C              INC     A                   
40CD: C8              RET     Z                   
40CE: 3A E0 A8        LD      A,($A8E0)           ; {hard.workRam+E0}
40D1: 3C              INC     A                   
40D2: C8              RET     Z                   
40D3: C3 79 56        JP      $5679               ; {code.requestLateEraProgressSound}

; entry to the per-slot sweep over an object bank: return early below era
; 2 (ERA_INDEX 0xad04) or when the bank's slot count (0xa8c6) is zero,
; else seat the record cursor (0xa8c0), the sprite-entry cursor (0xaa28)
; and the turn count, and run the sweep body at 0x40ea
sweepEra2PlusObjectBank:
40D6: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
40D9: FE 02           CP      $02                 
40DB: D8              RET     C                   
40DC: DD 21 C0 A8     LD      IX,$A8C0            
40E0: FD 21 28 AA     LD      IY,$AA28            
40E4: 3A C6 A8        LD      A,($A8C6)           ; {hard.workRam+C6}
40E7: A7              AND     A                   
40E8: C8              RET     Z                   
40E9: 47              LD      B,A                 

loc_40ea:
40EA: DD 7E 00        LD      A,(IX+$00)          
40ED: A7              AND     A                   
40EE: CA 0B 41        JP      Z,$410B             ; {code.closeOneTurnOfTheSlotSweep}
40F1: 3C              INC     A                   
40F2: 20 14           JR      NZ,$4108            ; {code.loc_4108}
40F4: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
40F7: FE 04           CP      $04                 
40F9: CA 94 41        JP      Z,$4194             ; {code.stepSlotApproachThenBreakawayRetire}
40FC: DD 7E 0E        LD      A,(IX+$0E)          
40FF: A7              AND     A                   
4100: C2 8B 41        JP      NZ,$418B            ; {code.flyLiveSlotAndTickCountdown}
4103: CD 17 41        CALL    $4117               ; {code.chaseOneAimPointAndRetireAtTheLine}
4106: 18 03           JR      $410B               ; {code.closeOneTurnOfTheSlotSweep}

loc_4108:
4108: CD 3C 41        CALL    $413C               ; {code.stepDriftingCountdownObjectByEraFrames}

; close one turn of the per-slot sweep over an object bank: step the
; record cursor on one whole sixteen-byte record and the sprite-entry
; cursor on one two-byte entry, strike one off the turn count and go round
; again while any remain, ending the sweep when the count runs out;
; several arms of the sweep's body converge here rather than one, and the
; record stride is left standing in the wide scratch pair on the way out
closeOneTurnOfTheSlotSweep:
410B: 11 10 00        LD      DE,$0010            
410E: DD 19           ADD     IX,DE               
4110: FD 23           INC     IY                  
4112: FD 23           INC     IY                  
4114: 10 D4           DJNZ    $40EA               ; {code.loc_40ea}
4116: C9              RET                         

; run one object through a whole frame of chasing: re-aim it, turn it,
; move it, dress its sprite, and retire it once it has drifted onto a
; retire line. Re-aiming is RATIONED rather than done every frame -- the
; object carries a phase byte and the aim is recomputed only on the frames
; whose low four bits match it, which spreads a crowd across sixteen
; frames and leaves each object a stale aim in between; a phase byte above
; 15 can never match FRAME_TICK's low four bits at all, so such an object
; is never re-aimed. ★ The point is neither the only one nor a constant:
; it is one of SIX two-byte points packed at 0xAC74-0xAC7F, and those
; twelve bytes are rewritten as a block. The turn, the move and the
; dressing run every frame regardless, and the counter pair the caller
; holds is put back before the retire test
chaseOneAimPointAndRetireAtTheLine:
4117: C5              PUSH    BC                  
4118: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
411B: E6 0F           AND     $0F                 
411D: DD BE 0F        CP      (IX+$0F)            
4120: 20 09           JR      NZ,$412B            ; {code.loc_412b}
4122: 21 7F AC        LD      HL,$AC7F            
4125: CD B8 33        CALL    $33B8               ; {code.headingToward}
4128: DD 77 01        LD      (IX+$01),A          

loc_412b:
412B: CD 01 42        CALL    $4201               ; {code.steerTowardAimOneUnitAFrame}
412E: CD AA 58        CALL    $58AA               ; {code.loc_58aa}
4131: CD AF 3F        CALL    $3FAF               ; {code.dressSpriteShapeAndAttributeForHeadingSector}
4134: C1              POP     BC                  
4135: CD 83 2B        CALL    $2B83               ; {code.hasReachedRetireLine}
4138: D0              RET     NC                  
4139: C3 AB 40        JP      $40AB               ; {code.retireSlot}

; advance one countdown-driven object per frame: re-stamp+sound at the
; reset cap, drift with world scroll, decrement, retire the slot at zero,
; else animate the sprite from an era-selected frame table above the
; window floor
stepDriftingCountdownObjectByEraFrames:
413C: DD 7E 00        LD      A,(IX+$00)          
413F: FE 3C           CP      $3C                 
4141: D4 9D 40        CALL    NC,$409D            ; {code.stampObjectStateByte3bThenRequestSound}
4144: CD 60 2B        CALL    $2B60               ; {code.driftWithWorldScroll}
4147: DD 35 00        DEC     (IX+$00)            
414A: CA AB 40        JP      Z,$40AB             ; {code.retireSlot}
414D: DD 7E 00        LD      A,(IX+$00)          
4150: FE 1C           CP      $1C                 
4152: D8              RET     C                   
4153: D6 1C           SUB     $1C                 
4155: 0F              RRCA                        
4156: 0F              RRCA                        
4157: E6 07           AND     $07                 
4159: 57              LD      D,A                 
415A: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
415D: FE 04           CP      $04                 
415F: 30 15           JR      NC,$4176            ; {code.loc_4176}
4161: 21 6E 41        LD      HL,$416E            
4164: 7A              LD      A,D                 
4165: CF              RST     $08                 
4166: FD 77 01        LD      (IY+$01),A          
4169: FD 36 30 0D     LD      (IY+$30),$0D        
416D: C9              RET                         

; ---- $416E-$4175: data ----
416E: FF 9E 9F 9F 9E 9E 9D 9C

loc_4176:
4176: 21 83 41        LD      HL,$4183            
4179: 7A              LD      A,D                 
417A: CF              RST     $08                 
417B: FD 77 01        LD      (IY+$01),A          
417E: FD 36 30 02     LD      (IY+$30),$02        
4182: C9              RET                         

; ---- $4183-$418A: data ----
4183: FF E2 E3 E3 E2 E2 E1 E0

; service one live slot of the per-slot object sweep: fly the slot's
; object a step along its stored velocity (retiring it once it crosses a
; retire line), tick down the slot's own countdown at record offset 0x0e,
; then close the turn of the sweep; reached only for a slot whose marker
; byte reads 0xFF with a nonzero countdown, outside the fourth era
flyLiveSlotAndTickCountdown:
418B: CD 6C 3E        CALL    $3E6C               ; {code.flyAndRetireSlotCyclingShapeInEra4}
418E: DD 35 0E        DEC     (IX+$0E)            
4191: C3 0B 41        JP      $410B               ; {code.closeOneTurnOfTheSlotSweep}

; one slot's per-frame handler in an object sweep: while the record's
; approach countdown at +4 runs, decrement it and drive the object through
; its chased-object frame; the tick it hits zero, fly the object at double
; velocity, animate its shape cycle, and retire the slot only if it has
; reached a retire line, then step the sweep onto the next slot
stepSlotApproachThenBreakawayRetire:
4194: DD 7E 04        LD      A,(IX+$04)          
4197: A7              AND     A                   
4198: CA A4 41        JP      Z,$41A4             ; {code.loc_41a4}
419B: DD 35 04        DEC     (IX+$04)            
419E: CD B8 41        CALL    $41B8               ; {code.flyTowardShipStandoffThenEndApproach}
41A1: C3 0B 41        JP      $410B               ; {code.closeOneTurnOfTheSlotSweep}

loc_41a4:
41A4: C5              PUSH    BC                  
41A5: CD B6 58        CALL    $58B6               ; {code.loc_58b6}
41A8: CD F1 41        CALL    $41F1               ; {code.animateFixedShapeCycleAtHalfRate}
41AB: CD 83 2B        CALL    $2B83               ; {code.hasReachedRetireLine}
41AE: C1              POP     BC                  
41AF: D2 0B 41        JP      NC,$410B            ; {code.closeOneTurnOfTheSlotSweep}
41B2: CD AB 40        CALL    $40AB               ; {code.retireSlot}
41B5: C3 0B 41        JP      $410B               ; {code.closeOneTurnOfTheSlotSweep}

; run one chased object through a frame: every sixteenth frame re-aim it
; at one of two fixed points a record bit selects, cut its approach
; countdown to zero once both axis gaps to that point fall under sixteen,
; then turn, move and dress it every frame; the carry answers whether it
; reached a retire line
flyTowardShipStandoffThenEndApproach:
41B8: C5              PUSH    BC                  
41B9: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
41BC: E6 0F           AND     $0F                 
41BE: 20 1F           JR      NZ,$41DF            ; {code.loc_41df}
41C0: 21 75 AC        LD      HL,$AC75            
41C3: DD CB 0F 46     BIT     0,(IX+$0F)          
41C7: 20 03           JR      NZ,$41CC            ; {code.loc_41cc}
41C9: 21 79 AC        LD      HL,$AC79            

loc_41cc:
41CC: CD B8 33        CALL    $33B8               ; {code.headingToward}
41CF: 47              LD      B,A                 
41D0: 7A              LD      A,D                 
41D1: FE 10           CP      $10                 
41D3: 30 07           JR      NC,$41DC            ; {code.loc_41dc}
41D5: 08              EX      AF,AF'              
41D6: FE 10           CP      $10                 
41D8: DC EC 41        CALL    C,$41EC             ; {code.endApproachNow}
41DB: 08              EX      AF,AF'              

loc_41dc:
41DC: DD 70 01        LD      (IX+$01),B          

loc_41df:
41DF: CD 1F 42        CALL    $421F               ; {code.steerTowardAimAtFixedRate}
41E2: CD B6 58        CALL    $58B6               ; {code.loc_58b6}
41E5: CD F1 41        CALL    $41F1               ; {code.animateFixedShapeCycleAtHalfRate}
41E8: C1              POP     BC                  
41E9: C3 83 2B        JP      $2B83               ; {code.hasReachedRetireLine}

; make the countdown at +0x04 of the record a caller points at read zero,
; so that record's handler takes its expired arm on the next frame instead
; of counting the rest of the delay down; one store and nothing else
endApproachNow:
41EC: DD 36 04 00     LD      (IX+$04),$00        
41F0: C9              RET                         

; give one sprite entry the current frame of an eight-frame shape cycle
; from a fixed base, and one fixed byte beside it; the frame is picked
; from bits one to three of the free-running counter, so the cycle turns
; over once every sixteen counts. Nothing about the object is read, so two
; entries written in one tick get the same shape
animateFixedShapeCycleAtHalfRate:
41F1: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
41F4: 0F              RRCA                        
41F5: E6 07           AND     $07                 
41F7: C6 50           ADD     A,$50               
41F9: FD 77 01        LD      (IY+$01),A          
41FC: FD 36 30 0A     LD      (IY+$30),$0A        
4200: C9              RET                         

; turn an object's heading one unit toward the heading it aims at, on
; every dispatch, standing still once the heading sits on the aim or one
; unit past it; the direction test is taken on the gap PLUS ONE, so a gap
; of exactly 127 turns the LONG way round and the standing band is off
; centre
steerTowardAimOneUnitAFrame:
4201: DD 7E 01        LD      A,(IX+$01)          
4204: DD 96 02        SUB     (IX+$02)            
4207: C6 01           ADD     A,$01               
4209: FE 02           CP      $02                 
420B: D8              RET     C                   
420C: FE 80           CP      $80                 
420E: DD 7E 02        LD      A,(IX+$02)          
4211: 30 06           JR      NC,$4219            ; {code.loc_4219}
4213: C6 01           ADD     A,$01               
4215: DD 77 02        LD      (IX+$02),A          
4218: C9              RET                         

loc_4219:
4219: D6 01           SUB     $01                 
421B: DD 77 02        LD      (IX+$02),A          
421E: C9              RET                         

; turn an object's heading two units toward the heading it aims at, on the
; three frames in four when the frame counter's low two bits are not both
; clear; a fixed step, where its sibling steerTowardAimHeading takes its
; rate from a table
steerTowardAimAtFixedRate:
421F: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
4222: E6 03           AND     $03                 
4224: C8              RET     Z                   
4225: DD 7E 01        LD      A,(IX+$01)          
4228: DD 96 02        SUB     (IX+$02)            
422B: C6 01           ADD     A,$01               
422D: FE 02           CP      $02                 
422F: D8              RET     C                   
4230: FE 80           CP      $80                 
4232: DD 7E 02        LD      A,(IX+$02)          
4235: 30 06           JR      NC,$423D            ; {code.loc_423d}
4237: C6 02           ADD     A,$02               
4239: DD 77 02        LD      (IX+$02),A          
423C: C9              RET                         

loc_423d:
423D: D6 02           SUB     $02                 
423F: DD 77 02        LD      (IX+$02),A          
4242: C9              RET                         

; on this object's turn of the eight-frame round, once the shared spawn
; cooldown (0xA8F4) has expired, walk the object-record bank for a free
; slot, stash its record/entry pointers at 0xA991/0xA993, and if the new
; object clears the two fixed lines hand the caller's facing (C=IX+0x02)
; to the era-0 aim launcher (0x429C) or the heading-follows launcher
; (0x42B7); otherwise tick the cooldown down or leave everything untouched
launchAttackerIntoFreeSlot:
4243: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
4246: E6 07           AND     $07                 
4248: C6 05           ADD     A,$05               
424A: DD BE 0F        CP      (IX+$0F)            
424D: C0              RET     NZ                  
424E: 21 F4 A8        LD      HL,$A8F4            
4251: 7E              LD      A,(HL)              
4252: A7              AND     A                   
4253: 28 02           JR      Z,$4257             ; {code.loc_4257}
4255: 35              DEC     (HL)                
4256: C9              RET                         

loc_4257:
4257: 21 C0 A8        LD      HL,$A8C0            
425A: 11 28 AA        LD      DE,$AA28            
425D: 3A C6 A8        LD      A,($A8C6)           ; {hard.workRam+C6}
4260: A7              AND     A                   
4261: C8              RET     Z                   
4262: 47              LD      B,A                 

loc_4263:
4263: 7E              LD      A,(HL)              
4264: A7              AND     A                   
4265: CA 71 42        JP      Z,$4271             ; {code.loc_4271}
4268: 7D              LD      A,L                 
4269: C6 10           ADD     A,$10               
426B: 6F              LD      L,A                 
426C: 13              INC     DE                  
426D: 13              INC     DE                  
426E: 10 F3           DJNZ    $4263               ; {code.loc_4263}
4270: C9              RET                         

loc_4271:
4271: 22 91 A9        LD      ($A991),HL          ; {hard.workRam+191}
4274: ED 53 93 A9     LD      ($A993),DE          ; {hard.workRam+193}
4278: 3A D6 A8        LD      A,($A8D6)           ; {hard.workRam+D6}
427B: 57              LD      D,A                 
427C: 87              ADD     A,A                 
427D: 4F              LD      C,A                 
427E: 3E 78           LD      A,$78               
4280: FD 96 31        SUB     (IY+$31)            
4283: 82              ADD     A,D                 
4284: B9              CP      C                   
4285: 30 08           JR      NC,$428F            ; {code.loc_428f}
4287: 3E 84           LD      A,$84               
4289: FD 96 00        SUB     (IY+$00)            
428C: 82              ADD     A,D                 
428D: B9              CP      C                   
428E: D8              RET     C                   

loc_428f:
428F: DD 4E 02        LD      C,(IX+$02)          
4292: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
4295: A7              AND     A                   
4296: CA 9C 42        JP      Z,$429C             ; {code.setTheLaunchFacingInsideOneAimWindow}
4299: C3 B7 42        JP      $42B7               ; {code.commissionStagedAttackerByEra}

; the last gate in front of a launch, and the one thing the launcher is
; told: on one of the two coordinates the sprite entry carries, the firing
; object must lie inside a window centred on a fixed line whose half-width
; is READ FROM 0xA8E6 rather than baked in, and outside it this entry ends
; and nothing is launched; inside it the OTHER coordinate is compared
; against a second fixed line, and which side it falls on is handed to the
; launcher at 0x42B7 in the narrow scratch byte as a plain zero or one,
; which that routine turns into a mirroring of the NEW object's sprite
; rather than of the firing one's. ★ 0xA8E6 is one of the two aim windows
; applyEraRungSettings scatters, which is why the name says 'one' and not
; 'the'; the cell also has a NON-WINDOW reader at 0x43AE (`ld a,(0xa8e6) /
; ld (ix+0x04),a`, seeding a record countdown), and mechanisms.md marks
; what each of those twelve scattered cells governs as not fully settled
setTheLaunchFacingInsideOneAimWindow:
429C: 3A E6 A8        LD      A,($A8E6)           ; {hard.workRam+E6}
429F: 57              LD      D,A                 
42A0: 87              ADD     A,A                 
42A1: 4F              LD      C,A                 
42A2: 3E 84           LD      A,$84               
42A4: FD 96 00        SUB     (IY+$00)            
42A7: 82              ADD     A,D                 
42A8: B9              CP      C                   
42A9: D0              RET     NC                  
42AA: 3E 78           LD      A,$78               
42AC: FD 96 31        SUB     (IY+$31)            
42AF: 38 04           JR      C,$42B5             ; {code.loc_42b5}
42B1: 0E 00           LD      C,$00               
42B3: 18 02           JR      $42B7               ; {code.commissionStagedAttackerByEra}

loc_42b5:
42B5: 0E 01           LD      C,$01               

; commission the object the free-slot finder staged, whose record/entry
; pointers wait at 0xA991/0xA993: copy the spawner's two coordinate pairs
; and the caller's facing (C) into the new slot, then fit it out one of
; four ways chosen by the era cell 0xAD04 -- era 0 an unaimed drift with a
; mirror flag (IY+0x01=0x4F) and slow-fall marker; eras 1-2 a heading
; toward the fixed point 0xAC7F skewed by a stored half-turn from
; (IX+0x0F); era 3 a doubled velocity vector for a heading offset +/-0x1A
; from the facing; era 4 a straight aim at 0xAC7F plus a seeded (IX+0x04);
; each way winds the new slot's active count (IX+0x00) down, re-arms the
; spawn cooldown (0xA8F4 from 0xA8F6), restores the spawner's own IX/IY,
; and hands off to one era-specific sound request
commissionStagedAttackerByEra:
42B7: FD 56 31        LD      D,(IY+$31)          
42BA: DD 5E 03        LD      E,(IX+$03)          
42BD: FD 66 00        LD      H,(IY+$00)          
42C0: DD 6E 05        LD      L,(IX+$05)          
42C3: D9              EXX                         
42C4: DD E5           PUSH    IX                  
42C6: FD E5           PUSH    IY                  
42C8: DD 2A 91 A9     LD      IX,($A991)          ; {hard.workRam+191}
42CC: FD 2A 93 A9     LD      IY,($A993)          ; {hard.workRam+193}
42D0: D9              EXX                         
42D1: DD 73 03        LD      (IX+$03),E          
42D4: FD 72 31        LD      (IY+$31),D          
42D7: DD 75 05        LD      (IX+$05),L          
42DA: FD 74 00        LD      (IY+$00),H          
42DD: DD 71 01        LD      (IX+$01),C          
42E0: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
42E3: FE 04           CP      $04                 
42E5: CA AE 43        JP      Z,$43AE             ; {code.loc_43ae}
42E8: A7              AND     A                   
42E9: C2 13 43        JP      NZ,$4313            ; {code.loc_4313}
42EC: FD 36 01 4F     LD      (IY+$01),$4F        
42F0: 79              LD      A,C                 
42F1: 0F              RRCA                        
42F2: CB 2F           SRA     A                   
42F4: E6 C0           AND     $C0                 
42F6: C6 0B           ADD     A,$0B               
42F8: FD 77 30        LD      (IY+$30),A          
42FB: DD 36 07 00     LD      (IX+$07),$00        
42FF: DD 36 08 FF     LD      (IX+$08),$FF        
4303: DD 35 00        DEC     (IX+$00)            
4306: 3A F6 A8        LD      A,($A8F6)           ; {hard.workRam+F6}
4309: 32 F4 A8        LD      ($A8F4),A           ; {hard.workRam+F4}
430C: FD E1           POP     IY                  
430E: DD E1           POP     IX                  
4310: C3 64 56        JP      $5664               ; {code.requestAttackerSpawnSoundEra0}

loc_4313:
4313: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
4316: FE 03           CP      $03                 
4318: CA 6F 43        JP      Z,$436F             ; {code.loc_436f}
431B: D2 4C 43        JP      NC,$434C            ; {code.loc_434c}
431E: 21 7F AC        LD      HL,$AC7F            
4321: CD B8 33        CALL    $33B8               ; {code.headingToward}
4324: DD 77 01        LD      (IX+$01),A          
4327: DD 7E 0F        LD      A,(IX+$0F)          
432A: 0F              RRCA                        
432B: E6 80           AND     $80                 
432D: C6 40           ADD     A,$40               
432F: DD 86 01        ADD     A,(IX+$01)          
4332: DD 77 02        LD      (IX+$02),A          
4335: CD AF 3F        CALL    $3FAF               ; {code.dressSpriteShapeAndAttributeForHeadingSector}
4338: DD 35 00        DEC     (IX+$00)            
433B: 3A F6 A8        LD      A,($A8F6)           ; {hard.workRam+F6}
433E: 32 F4 A8        LD      ($A8F4),A           ; {hard.workRam+F4}
4341: DD 36 0E 00     LD      (IX+$0E),$00        
4345: FD E1           POP     IY                  
4347: DD E1           POP     IX                  
4349: C3 6E 56        JP      $566E               ; {code.requestTwoSoundsWhilePlaying}

loc_434c:
434C: 21 7F AC        LD      HL,$AC7F            
434F: CD B8 33        CALL    $33B8               ; {code.headingToward}
4352: DD 77 01        LD      (IX+$01),A          
4355: DD 77 02        LD      (IX+$02),A          
4358: CD AF 3F        CALL    $3FAF               ; {code.dressSpriteShapeAndAttributeForHeadingSector}
435B: DD 35 00        DEC     (IX+$00)            
435E: 3A F6 A8        LD      A,($A8F6)           ; {hard.workRam+F6}
4361: 32 F4 A8        LD      ($A8F4),A           ; {hard.workRam+F4}
4364: DD 36 0E 00     LD      (IX+$0E),$00        
4368: FD E1           POP     IY                  
436A: DD E1           POP     IX                  
436C: C3 74 56        JP      $5674               ; {code.requestAttackerSpawnSoundLateEra}

loc_436f:
436F: C5              PUSH    BC                  
4370: 79              LD      A,C                 
4371: C6 40           ADD     A,$40               
4373: E6 80           AND     $80                 
4375: 79              LD      A,C                 
4376: 20 07           JR      NZ,$437F            ; {code.loc_437f}
4378: C6 1A           ADD     A,$1A               
437A: DD 77 02        LD      (IX+$02),A          
437D: 18 05           JR      $4384               ; {code.loc_4384}

loc_437f:
437F: D6 1A           SUB     $1A                 
4381: DD 77 02        LD      (IX+$02),A          

loc_4384:
4384: CD 8E 59        CALL    $598E               ; {code.loc_598e}
4387: DD 73 0A        LD      (IX+$0A),E          
438A: DD 72 0B        LD      (IX+$0B),D          
438D: DD 71 0C        LD      (IX+$0C),C          
4390: DD 70 0D        LD      (IX+$0D),B          
4393: C1              POP     BC                  
4394: DD 71 02        LD      (IX+$02),C          
4397: CD AF 3F        CALL    $3FAF               ; {code.dressSpriteShapeAndAttributeForHeadingSector}
439A: DD 36 0E 20     LD      (IX+$0E),$20        
439E: DD 35 00        DEC     (IX+$00)            
43A1: 3A F6 A8        LD      A,($A8F6)           ; {hard.workRam+F6}
43A4: 32 F4 A8        LD      ($A8F4),A           ; {hard.workRam+F4}
43A7: FD E1           POP     IY                  
43A9: DD E1           POP     IX                  
43AB: C3 6E 56        JP      $566E               ; {code.requestTwoSoundsWhilePlaying}

loc_43ae:
43AE: 3A E6 A8        LD      A,($A8E6)           ; {hard.workRam+E6}
43B1: DD 77 04        LD      (IX+$04),A          
43B4: C3 13 43        JP      $4313               ; {code.loc_4313}

; once-in-eight-frames gate for the Mother-Ship: while the wave-hold flag
; 0xacc6 is clear, defer to the deep-state stepper (stepMotherShip) if it
; is already live (MOTHER_SHIP_ARMED 0xad0d != 0), else -- only when the
; kill quota (KILLS_REMAINING 0xad02) is spent and both records of its
; two-slot bank (0xa8a0/0xa8b0) read empty -- arm it (0xad0d=0xff), seed
; the lead record's seven-hit counter (ix+0x04=0x07), and retire the
; matching entry pair into cooldown to spawn it
armMotherShipOrStep:
43B7: 3A C6 AC        LD      A,($ACC6)           ; {hard.workRam+4C6}
43BA: 3C              INC     A                   
43BB: C8              RET     Z                   
43BC: 3A 0D AD        LD      A,($AD0D)           ; {hard.workRam+50D}
43BF: A7              AND     A                   
43C0: 20 2E           JR      NZ,$43F0            ; {code.loc_43f0}
43C2: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
43C5: E6 07           AND     $07                 
43C7: FE 05           CP      $05                 
43C9: C0              RET     NZ                  
43CA: DD 21 A0 A8     LD      IX,$A8A0            
43CE: FD 21 24 AA     LD      IY,$AA24            
43D2: 3A 02 AD        LD      A,($AD02)           ; {hard.workRam+502}
43D5: DD B6 00        OR      (IX+$00)            
43D8: DD B6 10        OR      (IX+$10)            
43DB: C0              RET     NZ                  
43DC: 3E FF           LD      A,$FF               
43DE: 32 0D AD        LD      ($AD0D),A           ; {hard.workRam+50D}
43E1: DD 36 04 07     LD      (IX+$04),$07        
43E5: C3 DB 46        JP      $46DB               ; {code.retireEntryPairIntoCooldown}

; add a run of program-image bytes into one eight-bit total and hand it
; down the tail chain that compares it against the value a genuine image
; gives, so the machine leaves either on the ordinary path or into the
; trap; a length of zero means a full 256 bytes and the total wraps
sumImageBlockForTheTamperCheck:
43E8: AF              XOR     A                   

loc_43e9:
43E9: 86              ADD     A,(HL)              
43EA: 23              INC     HL                  
43EB: 10 FC           DJNZ    $43E9               ; {code.loc_43e9}
43ED: C3 AD 07        JP      $07AD               ; {code.parkTheImageTotalForTheTamperVerdict}

loc_43f0:
43F0: DD 21 A0 A8     LD      IX,$A8A0            
43F4: FD 21 24 AA     LD      IY,$AA24            
43F8: DD 7E 00        LD      A,(IX+$00)          
43FB: A7              AND     A                   
43FC: CA 35 45        JP      Z,$4535             ; {code.loc_4535}
43FF: 3C              INC     A                   
4400: C2 40 45        JP      NZ,$4540            ; {code.loc_4540}

loc_4403:
4403: DD 66 0C        LD      H,(IX+$0C)          
4406: DD 6E 0D        LD      L,(IX+$0D)          
4409: ED 5B 08 A8     LD      DE,($A808)          ; {hard.workRam+8}
440D: 19              ADD     HL,DE               
440E: FD 56 31        LD      D,(IY+$31)          
4411: DD 5E 03        LD      E,(IX+$03)          
4414: 19              ADD     HL,DE               
4415: FD 74 31        LD      (IY+$31),H          
4418: DD 75 03        LD      (IX+$03),L          
441B: DD 66 1C        LD      H,(IX+$1C)          
441E: DD 6E 1D        LD      L,(IX+$1D)          
4421: ED 5B 0A A8     LD      DE,($A80A)          ; {hard.workRam+A}
4425: 19              ADD     HL,DE               
4426: FD 56 00        LD      D,(IY+$00)          
4429: DD 5E 05        LD      E,(IX+$05)          
442C: 19              ADD     HL,DE               
442D: FD 74 00        LD      (IY+$00),H          
4430: DD 75 05        LD      (IX+$05),L          
4433: FD 7E 31        LD      A,(IY+$31)          
4436: C6 10           ADD     A,$10               
4438: FD 77 33        LD      (IY+$33),A          
443B: FD 7E 00        LD      A,(IY+$00)          
443E: FD 77 02        LD      (IY+$02),A          
4441: CD 47 44        CALL    $4447               ; {code.dressSpriteForHeadingOrRetireAtEdge}
4444: C3 F0 46        JP      $46F0               ; {code.loc_46f0}

; dress an object's sprite entry to face its heading (heading-quadrant
; picks a shape pair, era picks a colour, one heading half swaps the pair
; and the other biases the colour by half a page), unless the object has
; reached the field edge, in which case retire the entry pair; on the
; flutter era instead give a two-frame flutter and step/cap/close-out the
; wind-down counter
dressSpriteForHeadingOrRetireAtEdge:
4447: CD C4 3C        CALL    $3CC4               ; {code.hasReachedBoundaryBandSelectedByHeading}
444A: DA DB 46        JP      C,$46DB             ; {code.retireEntryPairIntoCooldown}
444D: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
4450: 57              LD      D,A                 
4451: FE 04           CP      $04                 
4453: CA A2 44        JP      Z,$44A2             ; {code.loc_44a2}
4456: 7A              LD      A,D                 
4457: 87              ADD     A,A                 
4458: 87              ADD     A,A                 
4459: 87              ADD     A,A                 
445A: 87              ADD     A,A                 
445B: 47              LD      B,A                 
445C: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
445F: E6 02           AND     $02                 
4461: 80              ADD     A,B                 
4462: 47              LD      B,A                 
4463: 3E 07           LD      A,$07               
4465: DD 96 04        SUB     (IX+$04)            
4468: 0F              RRCA                        
4469: E6 03           AND     $03                 
446B: 5F              LD      E,A                 
446C: 87              ADD     A,A                 
446D: 87              ADD     A,A                 
446E: 80              ADD     A,B                 
446F: 21 F1 44        LD      HL,$44F1            
4472: DF              RST     $18                 
4473: 46              LD      B,(HL)              
4474: 23              INC     HL                  
4475: 4E              LD      C,(HL)              
4476: 21 31 45        LD      HL,$4531            
4479: 7A              LD      A,D                 
447A: DF              RST     $18                 
447B: 56              LD      D,(HL)              
447C: DD 7E 02        LD      A,(IX+$02)          
447F: C6 40           ADD     A,$40               
4481: FE 80           CP      $80                 
4483: 38 10           JR      C,$4495             ; {code.loc_4495}
4485: FD 70 01        LD      (IY+$01),B          
4488: FD 71 03        LD      (IY+$03),C          
448B: 7A              LD      A,D                 
448C: C6 80           ADD     A,$80               
448E: FD 77 30        LD      (IY+$30),A          
4491: FD 77 32        LD      (IY+$32),A          
4494: C9              RET                         

loc_4495:
4495: FD 71 01        LD      (IY+$01),C          
4498: FD 70 03        LD      (IY+$03),B          
449B: FD 72 30        LD      (IY+$30),D          
449E: FD 72 32        LD      (IY+$32),D          
44A1: C9              RET                         

loc_44a2:
44A2: DD 7E 04        LD      A,(IX+$04)          
44A5: 5F              LD      E,A                 
44A6: FE 07           CP      $07                 
44A8: CA BF 44        JP      Z,$44BF             ; {code.loc_44bf}
44AB: DD 34 06        INC     (IX+$06)            
44AE: DD 4E 06        LD      C,(IX+$06)          
44B1: CB 79           BIT     7,C                 
44B3: 20 14           JR      NZ,$44C9            ; {code.restartAnimationCounterThenDressFlutterSprite}
44B5: 7B              LD      A,E                 
44B6: C6 02           ADD     A,$02               
44B8: B9              CP      C                   
44B9: 30 04           JR      NC,$44BF            ; {code.loc_44bf}
44BB: DD 36 06 80     LD      (IX+$06),$80        

loc_44bf:
44BF: FD 36 30 70     LD      (IY+$30),$70        
44C3: FD 36 32 70     LD      (IY+$32),$70        
44C7: 18 13           JR      $44DC               ; {code.dressSpriteFlutterShapesByFrameTickBit}

; close out one object's animation and dress its sprite entry: the counter
; the caller carries is read without the top bit that selected this path,
; and once what is left has reached three the counter cell in the object's
; record is put back to zero -- below three it is left alone. Either way
; both attribute slots of the sprite entry take the one code fixed here,
; and the two shape codes are then chosen by the flutter this entry hands
; on to
restartAnimationCounterThenDressFlutterSprite:
44C9: 79              LD      A,C                 
44CA: E6 7F           AND     $7F                 
44CC: FE 03           CP      $03                 
44CE: 38 04           JR      C,$44D4             ; {code.loc_44d4}
44D0: DD 36 06 00     LD      (IX+$06),$00        

loc_44d4:
44D4: FD 36 30 51     LD      (IY+$30),$51        
44D8: FD 36 32 51     LD      (IY+$32),$51        

; give an object the two shapes of a two-frame flutter, the pair picked by
; one bit of a counter cell and nothing the object holds
dressSpriteFlutterShapesByFrameTickBit:
44DC: 11 02 02        LD      DE,$0202            
44DF: 21 D5 D4        LD      HL,$D4D5            
44E2: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
44E5: CB 57           BIT     2,A                 
44E7: 20 01           JR      NZ,$44EA            ; {code.loc_44ea}
44E9: 19              ADD     HL,DE               

loc_44ea:
44EA: FD 75 01        LD      (IY+$01),L          
44ED: FD 74 03        LD      (IY+$03),H          
44F0: C9              RET                         

; ---- $44F1-$4534: data ----
44F1: 39 38 39 38 3B 3A 3D 3C 3B 3A 3D 3C 3D 3C 3F 3E
4501: B0 B1 B2 B3 B4 B5 B6 B7 B8 B9 BA BB BC BD BE BF
4511: C0 C1 C2 C3 C4 C5 C6 C7 C6 C7 C8 C9 C8 C9 CA CB
4521: CC CD CC CD CE CF D0 D1 CE CF D0 D1 D0 D1 D2 D3
4531: E9 58 6F 6E

loc_4535:
4535: DD 7E 0E        LD      A,(IX+$0E)          
4538: A7              AND     A                   
4539: CA 63 46        JP      Z,$4663             ; {code.loc_4663}
453C: DD 35 0E        DEC     (IX+$0E)            
453F: C9              RET                         

loc_4540:
4540: 4F              LD      C,A                 
4541: DD 7E 04        LD      A,(IX+$04)          
4544: A7              AND     A                   
4545: 28 0D           JR      Z,$4554             ; {code.loc_4554}
4547: DD 35 04        DEC     (IX+$04)            
454A: DD 36 00 FF     LD      (IX+$00),$FF        
454E: CD 83 56        CALL    $5683               ; {code.requestTwoSounds}
4551: C3 03 44        JP      $4403               ; {code.loc_4403}

loc_4554:
4554: 79              LD      A,C                 
4555: FE F0           CP      $F0                 
4557: C2 B3 45        JP      NZ,$45B3            ; {code.loc_45b3}
455A: AF              XOR     A                   
455B: 32 DC A8        LD      ($A8DC),A           ; {hard.workRam+DC}
455E: CD 34 56        CALL    $5634               ; {code.loc_5634}
4561: CD D2 56        CALL    $56D2               ; {code.requestRoundIntroSoundBurst}
4564: 21 10 A8        LD      HL,$A810            
4567: 11 10 00        LD      DE,$0010            
456A: 06 0F           LD      B,$0F               
456C: 0E 14           LD      C,$14               

loc_456e:
456E: 7E              LD      A,(HL)              
456F: 3C              INC     A                   
4570: 20 22           JR      NZ,$4594            ; {code.loc_4594}
4572: 71              LD      (HL),C              
4573: D9              EXX                         
4574: 11 02 04        LD      DE,$0402            
4577: FF              RST     $38                 
4578: D9              EXX                         

loc_4579:
4579: 19              ADD     HL,DE               
457A: 79              LD      A,C                 
457B: C6 0A           ADD     A,$0A               
457D: 4F              LD      C,A                 
457E: 10 EE           DJNZ    $456E               ; {code.loc_456e}
4580: 0E 3C           LD      C,$3C               
4582: 3E FE           LD      A,$FE               
4584: 32 C6 AC        LD      ($ACC6),A           ; {hard.workRam+4C6}
4587: DD 36 00 E4     LD      (IX+$00),$E4        
458B: FD 36 30 3D     LD      (IY+$30),$3D        
458F: FD 36 32 3D     LD      (IY+$32),$3D        
4593: C9              RET                         

loc_4594:
4594: 3C              INC     A                   
4595: 20 E2           JR      NZ,$4579            ; {code.loc_4579}
4597: 36 00           LD      (HL),$00            
4599: 18 DE           JR      $4579               ; {code.loc_4579}

; step one object's timed warp/flash sequence: drift it with the world,
; seed the sprite's heading and shape from angle/Y-gated tables, then
; count a state byte down — the 0xB4 frame flags the sprite, bumps the
; 0xA800 sentinel and posts sound de=0x040D, above-trigger frames step an
; eight-shape ROM cycle, and a spent counter resets to idle then loops or
; returns on two program-image gates; reached through a misaligned
; prologue (two POP AF, DEC SP) whose stray carry can fold in a life-loss
stepMotherShipWarpFlashFrame:
459B: 16 A7           LD      D,$A7               
459D: 13              INC     DE                  
459E: 96              SUB     (HL)                
459F: ED DC           DEFB    $ED,$DC             
45A1: F1              POP     AF                  
45A2: 8C              ADC     A,H                 
45A3: 68              LD      L,B                 
45A4: 3B              DEC     SP                  
45A5: 0D              DEC     C                   
45A6: ED F1           DEFB    $ED,$F1             
45A8: 9B              SBC     A,E                 
45A9: 13              INC     DE                  
45AA: 13              INC     DE                  
45AB: 13              INC     DE                  
45AC: 13              INC     DE                  
45AD: F1              POP     AF                  
45AE: 88              ADC     A,B                 
45AF: DC ED 11        CALL    C,$11ED             ; {code.loseLifeAndHandOver}
45B2: B9              CP      C                   

loc_45b3:
45B3: CD 60 2B        CALL    $2B60               ; {code.driftWithWorldScroll}
45B6: FD 7E 31        LD      A,(IY+$31)          
45B9: 47              LD      B,A                 
45BA: C6 13           ADD     A,$13               
45BC: FE 03           CP      $03                 
45BE: 38 15           JR      C,$45D5             ; {code.loc_45d5}
45C0: 78              LD      A,B                 
45C1: C6 10           ADD     A,$10               
45C3: FD 77 33        LD      (IY+$33),A          
45C6: FD 7E 00        LD      A,(IY+$00)          
45C9: 47              LD      B,A                 
45CA: C6 08           ADD     A,$08               
45CC: FE 28           CP      $28                 
45CE: 38 05           JR      C,$45D5             ; {code.loc_45d5}
45D0: FD 70 02        LD      (IY+$02),B          
45D3: 18 08           JR      $45DD               ; {code.loc_45dd}

loc_45d5:
45D5: FD 36 01 FF     LD      (IY+$01),$FF        
45D9: FD 36 03 FF     LD      (IY+$03),$FF        

loc_45dd:
45DD: DD 7E 00        LD      A,(IX+$00)          
45E0: FE B4           CP      $B4                 
45E2: 28 3F           JR      Z,$4623             ; {code.loc_4623}
45E4: 38 13           JR      C,$45F9             ; {code.loc_45f9}
45E6: D6 B4           SUB     $B4                 
45E8: 0F              RRCA                        
45E9: 0F              RRCA                        
45EA: 0F              RRCA                        
45EB: 3D              DEC     A                   
45EC: E6 07           AND     $07                 
45EE: 21 1B 46        LD      HL,$461B            
45F1: CF              RST     $08                 
45F2: FD 77 03        LD      (IY+$03),A          
45F5: 3C              INC     A                   
45F6: FD 77 01        LD      (IY+$01),A          

loc_45f9:
45F9: DD 35 00        DEC     (IX+$00)            
45FC: CA 46 46        JP      Z,$4646             ; {code.loc_4646}
45FF: DD 7E 00        LD      A,(IX+$00)          
4602: FE 5A           CP      $5A                 
4604: C0              RET     NZ                  
4605: FD 36 01 FF     LD      (IY+$01),$FF        
4609: FD 36 03 FF     LD      (IY+$03),$FF        
460D: C9              RET                         

; two-player-start setup arm (called from 0x189E): when the video cell
; 0xA67C and work cell 0xAB43 disagree, decrement the counter at (IX+0),
; seat 0xFE/0xFD and 0x6C/0x6C into the object slot at
; (IY+1/+3/+0x30/+0x32), request sound 0x580B when 0xA800 is 0xFF, and
; queue ring command 0x04/0x0D; a no-op when the two cells agree
setUpTwoPlayerStartObjectOnce:
460E: 21 7C A6        LD      HL,$A67C            
4611: 7E              LD      A,(HL)              
4612: 4F              LD      C,A                 
4613: 3A 43 AB        LD      A,($AB43)           ; {hard.workRam+343}
4616: 91              SUB     C                   
4617: C2 43 46        JP      NZ,$4643            ; {code.loc_4643}
461A: C9              RET                         

loc_461b:
461B: 94              SUB     H                   
461C: 96              SUB     (HL)                
461D: 96              SUB     (HL)                
461E: 94              SUB     H                   
461F: 92              SUB     D                   
4620: 90              SUB     B                   
4621: 90              SUB     B                   
4622: 94              SUB     H                   

loc_4623:
4623: DD 35 00        DEC     (IX+$00)            
4626: FD 36 01 FE     LD      (IY+$01),$FE        
462A: FD 36 03 FD     LD      (IY+$03),$FD        
462E: FD 36 30 6C     LD      (IY+$30),$6C        
4632: FD 36 32 6C     LD      (IY+$32),$6C        
4636: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
4639: 3C              INC     A                   
463A: CC 0B 58        CALL    Z,$580B             ; {code.requestMotherShipWarpSound}
463D: 11 0D 04        LD      DE,$040D            
4640: C3 38 00        JP      $0038               ; {code.postCommand}

loc_4643:
4643: C3 1B 46        JP      $461B               ; {code.loc_461b}

loc_4646:
4646: 3E FF           LD      A,$FF               
4648: 32 C6 AC        LD      ($ACC6),A           ; {hard.workRam+4C6}
464B: DD 36 00 00     LD      (IX+$00),$00        
464F: 21 43 AB        LD      HL,$AB43            
4652: 7E              LD      A,(HL)              
4653: FE 7C           CP      $7C                 
4655: C2 60 46        JP      NZ,$4660            ; {code.loc_4660}
4658: 23              INC     HL                  
4659: 7E              LD      A,(HL)              
465A: FE 10           CP      $10                 
465C: C8              RET     Z                   
465D: FE 05           CP      $05                 
465F: C8              RET     Z                   

loc_4660:
4660: C3 9B 45        JP      $459B               ; {code.stepMotherShipWarpFlashFrame}

loc_4663:
4663: 3A C6 AC        LD      A,($ACC6)           ; {hard.workRam+4C6}
4666: A7              AND     A                   
4667: C0              RET     NZ                  
4668: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
466B: 47              LD      B,A                 
466C: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
466F: 4F              LD      C,A                 
4670: 3E 10           LD      A,$10               
4672: CB 59           BIT     3,C                 
4674: 20 02           JR      NZ,$4678            ; {code.loc_4678}
4676: ED 44           NEG                         

loc_4678:
4678: 80              ADD     A,B                 
4679: 0F              RRCA                        
467A: 0F              RRCA                        
467B: E6 3E           AND     $3E                 
467D: 21 84 3C        LD      HL,$3C84            
4680: CF              RST     $08                 
4681: FD 77 31        LD      (IY+$31),A          
4684: 23              INC     HL                  
4685: 7E              LD      A,(HL)              
4686: FD 77 00        LD      (IY+$00),A          
4689: 78              LD      A,B                 
468A: C6 C0           ADD     A,$C0               
468C: E6 80           AND     $80                 
468E: DD 77 02        LD      (IX+$02),A          
4691: CD BA 46        CALL    $46BA               ; {code.setMotherShipVelocityFromHeading}
4694: DD 7E 04        LD      A,(IX+$04)          
4697: FE 06           CP      $06                 
4699: 30 04           JR      NC,$469F            ; {code.loc_469f}
469B: DD 36 04 05     LD      (IX+$04),$05        

loc_469f:
469F: DD 36 00 FF     LD      (IX+$00),$FF        
46A3: C3 F7 57        JP      $57F7               ; {code.requestCurrentEraSound}

; ---- $46A6-$46B9: data ----
46A6: 3A 80 A9 4F E6 1C CB 41 20 02 ED 44 80 0F 0F E6
46B6: 3E C3 7D 46

; give the Mother-Ship the two velocity words its current heading picks
; out of the velocity table the era selects -- the word at the heading and
; the word a quarter turn behind it -- and park them at +0x0C and +0x1C of
; the record pair, which is where its motion reads them
setMotherShipVelocityFromHeading:
46BA: 21 CE 46        LD      HL,$46CE            
46BD: E5              PUSH    HL                  
46BE: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
46C1: E6 07           AND     $07                 
46C3: F7              RST     $30                 

; ---- $46C4-$46CD: jump table ----
46C4: 42 59 4E 59 4E 59 65 59 6B 59

; file two register pairs into an object's record as four bytes, each pair
; high byte first and so stored the opposite way round from a word
fileTwoPairsIntoObjectRecordHighByteFirst:
46CE: DD 72 0C        LD      (IX+$0C),D          
46D1: DD 73 0D        LD      (IX+$0D),E          
46D4: DD 70 1C        LD      (IX+$1C),B          
46D7: DD 71 1D        LD      (IX+$1D),C          
46DA: C9              RET                         

; clear a record's occupancy byte and both coordinates of TWO neighbouring
; sprite entries, then arm the record's delay byte with a fixed value
; rather than leaving it clear
retireEntryPairIntoCooldown:
46DB: AF              XOR     A                   
46DC: DD 77 00        LD      (IX+$00),A          
46DF: FD 77 00        LD      (IY+$00),A          
46E2: FD 77 02        LD      (IY+$02),A          
46E5: FD 77 31        LD      (IY+$31),A          
46E8: FD 77 33        LD      (IY+$33),A          
46EB: DD 36 0E 5F     LD      (IX+$0E),$5F        
46EF: C9              RET                         

loc_46f0:
46F0: DD 7E 00        LD      A,(IX+$00)          
46F3: 3C              INC     A                   
46F4: C0              RET     NZ                  
46F5: 3A 17 A8        LD      A,($A817)           ; {hard.workRam+17}
46F8: A7              AND     A                   
46F9: C0              RET     NZ                  
46FA: 06 02           LD      B,$02               
46FC: 3A 27 A8        LD      A,($A827)           ; {hard.workRam+27}
46FF: 57              LD      D,A                 
4700: 87              ADD     A,A                 
4701: 5F              LD      E,A                 

loc_4702:
4702: FD 7E 00        LD      A,(IY+$00)          
4705: C6 08           ADD     A,$08               
4707: FE 28           CP      $28                 
4709: 38 1B           JR      C,$4726             ; {code.loc_4726}
470B: FD 7E 31        LD      A,(IY+$31)          
470E: C6 10           ADD     A,$10               
4710: FE 20           CP      $20                 
4712: 38 12           JR      C,$4726             ; {code.loc_4726}
4714: 3E 84           LD      A,$84               
4716: FD 96 00        SUB     (IY+$00)            
4719: 82              ADD     A,D                 
471A: BB              CP      E                   
471B: 30 17           JR      NC,$4734            ; {code.loc_4734}
471D: 3E 78           LD      A,$78               
471F: FD 96 31        SUB     (IY+$31)            
4722: 82              ADD     A,D                 
4723: BB              CP      E                   
4724: 30 0E           JR      NC,$4734            ; {code.loc_4734}

loc_4726:
4726: D9              EXX                         
4727: 11 10 00        LD      DE,$0010            
472A: DD 19           ADD     IX,DE               
472C: FD 23           INC     IY                  
472E: FD 23           INC     IY                  
4730: D9              EXX                         
4731: 10 CF           DJNZ    $4702               ; {code.loc_4702}
4733: C9              RET                         

loc_4734:
4734: 21 30 A8        LD      HL,$A830            
4737: D9              EXX                         
4738: 21 16 AA        LD      HL,$AA16            
473B: 06 02           LD      B,$02               

loc_473d:
473D: D9              EXX                         
473E: 7E              LD      A,(HL)              
473F: A7              AND     A                   
4740: 28 0A           JR      Z,$474C             ; {code.loc_474c}
4742: 11 10 00        LD      DE,$0010            
4745: 19              ADD     HL,DE               
4746: D9              EXX                         
4747: 23              INC     HL                  
4748: 23              INC     HL                  
4749: 10 F2           DJNZ    $473D               ; {code.loc_473d}
474B: C9              RET                         

loc_474c:
474C: 22 91 A9        LD      ($A991),HL          ; {hard.workRam+191}
474F: D9              EXX                         
4750: 22 93 A9        LD      ($A993),HL          ; {hard.workRam+193}
4753: CD 5F 56        CALL    $565F               ; {code.requestEnemyLaunchSound}
4756: 21 7F AC        LD      HL,$AC7F            
4759: CD B8 33        CALL    $33B8               ; {code.headingToward}
475C: 67              LD      H,A                 
475D: EB              EX      DE,HL               
475E: 21 B4 A8        LD      HL,$A8B4            
4761: 34              INC     (HL)                
4762: 3E 18           LD      A,$18               
4764: CB 46           BIT     0,(HL)              
4766: 20 02           JR      NZ,$476A            ; {code.loc_476a}
4768: ED 44           NEG                         

loc_476a:
476A: EB              EX      DE,HL               
476B: 84              ADD     A,H                 
476C: FD 46 31        LD      B,(IY+$31)          
476F: FD 4E 00        LD      C,(IY+$00)          
4772: DD 2A 91 A9     LD      IX,($A991)          ; {hard.workRam+191}
4776: FD 2A 93 A9     LD      IY,($A993)          ; {hard.workRam+193}
477A: DD 77 02        LD      (IX+$02),A          
477D: FD 70 31        LD      (IY+$31),B          
4780: FD 71 00        LD      (IY+$00),C          
4783: 21 95 47        LD      HL,$4795            
4786: E5              PUSH    HL                  
4787: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
478A: F7              RST     $30                 

; ---- $478B-$4794: jump table ----
478B: 8E 59 8E 59 94 59 94 59 94 59

loc_4795:
4795: DD 73 0A        LD      (IX+$0A),E          
4798: DD 72 0B        LD      (IX+$0B),D          
479B: DD 71 0C        LD      (IX+$0C),C          
479E: DD 70 0D        LD      (IX+$0D),B          
47A1: FD 36 01 4D     LD      (IY+$01),$4D        
47A5: FD 36 30 62     LD      (IY+$30),$62        
47A9: DD 35 00        DEC     (IX+$00)            
47AC: 3A 14 A8        LD      A,($A814)           ; {hard.workRam+14}
47AF: 32 17 A8        LD      ($A817),A           ; {hard.workRam+17}
47B2: C9              RET                         

; per-frame manager of the single parachutist slot (record 0xa8f0, sprite
; 0xaa2e): idle in era 4, else branch on the slot's state byte — free
; spawns it at the edge ahead, in-flight (0xff) flies it and retires it
; once it reaches a retire line else steps its shape from the frame tick,
; 0x10 posts its bonus, >=0x3c shows its award, and any lower value drifts
; it with the world then counts down and retires it at zero; grounded in
; MAME as the parachutist rescue object (canopy + 1000 bonus), removed by
; a negative control
runParachutistSlot:
47B3: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
47B6: FE 04           CP      $04                 
47B8: C8              RET     Z                   
47B9: DD 21 F0 A8     LD      IX,$A8F0            
47BD: FD 21 2E AA     LD      IY,$AA2E            
47C1: DD 7E 00        LD      A,(IX+$00)          
47C4: A7              AND     A                   
47C5: CA 53 48        JP      Z,$4853             ; {code.spawnAtEdgeAhead}
47C8: 3C              INC     A                   
47C9: C2 F2 47        JP      NZ,$47F2            ; {code.loc_47f2}
47CC: CD 05 3E        CALL    $3E05               ; {code.flyAlongStoredVelocity}
47CF: CD 83 2B        CALL    $2B83               ; {code.hasReachedRetireLine}
47D2: DA AD 48        JP      C,$48AD             ; {code.retireSlotIntoCooldown}
47D5: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
47D8: 0F              RRCA                        
47D9: 0F              RRCA                        
47DA: 0F              RRCA                        
47DB: 0F              RRCA                        
47DC: E6 07           AND     $07                 
47DE: 21 EA 47        LD      HL,$47EA            
47E1: CF              RST     $08                 
47E2: FD 77 01        LD      (IY+$01),A          
47E5: FD 36 30 75     LD      (IY+$30),$75        
47E9: C9              RET                         

; ---- $47EA-$47F1: data ----
47EA: 00 01 02 03 03 02 01 00

loc_47f2:
47F2: CD 60 2B        CALL    $2B60               ; {code.driftWithWorldScroll}
47F5: DD 7E 00        LD      A,(IX+$00)          
47F8: FE 10           CP      $10                 
47FA: CA 31 48        JP      Z,$4831             ; {code.postNextParachutistBonus}
47FD: FE 3C           CP      $3C                 
47FF: D2 09 48        JP      NC,$4809            ; {code.showParachutistAward}
4802: DD 35 00        DEC     (IX+$00)            
4805: C0              RET     NZ                  
4806: C3 AD 48        JP      $48AD               ; {code.retireSlotIntoCooldown}

; start the parachutist slot's exit: put its state byte at the top of the
; dying countdown, ask for the sound that goes with collecting it, and
; swap its sprite tile to the glyph for the award the slot's own rung byte
; selects -- with one fixed glyph once the rung passes the four the table
; holds, so the lookup never reads on past the table
showParachutistAward:
4809: DD 36 00 3B     LD      (IX+$00),$3B        
480D: CD FF 57        CALL    $57FF               ; {code.requestParachutistAwardSound}
4810: DD 7E 07        LD      A,(IX+$07)          
4813: FE 04           CP      $04                 
4815: D2 24 48        JP      NC,$4824            ; {code.loc_4824}
4818: 21 2D 48        LD      HL,$482D            
481B: CF              RST     $08                 
481C: FD 77 01        LD      (IY+$01),A          
481F: FD 36 30 6C     LD      (IY+$30),$6C        
4823: C9              RET                         

loc_4824:
4824: FD 36 01 8F     LD      (IY+$01),$8F        
4828: FD 36 30 6C     LD      (IY+$30),$6C        
482C: C9              RET                         

; ---- $482D-$4830: data ----
482D: F9 FC 8D 8E

; post the next rung of the rescue award to the command ring and step the
; per-life rung count on; the first four rungs each take their own value
; from a four-entry table and every rung after them takes the same top
; value, so the ladder rises and then caps
postNextParachutistBonus:
4831: DD 35 00        DEC     (IX+$00)            
4834: DD 7E 07        LD      A,(IX+$07)          
4837: DD 34 07        INC     (IX+$07)            
483A: FE 04           CP      $04                 
483C: D2 49 48        JP      NC,$4849            ; {code.loc_4849}
483F: 21 4F 48        LD      HL,$484F            
4842: DF              RST     $18                 
4843: 5E              LD      E,(HL)              
4844: 16 04           LD      D,$04               
4846: C3 38 00        JP      $0038               ; {code.postCommand}

loc_4849:
4849: 11 0F 04        LD      DE,$040F            
484C: C3 38 00        JP      $0038               ; {code.postCommand}

; ---- $484F-$4852: data ----
484F: 0A 0C 0D 0E

; on a cooldown, and only on alternate frames, place a free slot at the
; field-edge position the player's current heading selects, clear its sub-
; pixel remainders and mark it live
spawnAtEdgeAhead:
4853: 3A 0D AD        LD      A,($AD0D)           ; {hard.workRam+50D}
4856: A7              AND     A                   
4857: C0              RET     NZ                  
4858: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
485B: E6 01           AND     $01                 
485D: C8              RET     Z                   
485E: DD 35 0E        DEC     (IX+$0E)            
4861: C0              RET     NZ                  
4862: 3A 02 A8        LD      A,($A802)           ; {hard.workRam+2}
4865: C6 08           ADD     A,$08               
4867: 0F              RRCA                        
4868: 0F              RRCA                        
4869: 0F              RRCA                        
486A: E6 1E           AND     $1E                 
486C: 21 8D 48        LD      HL,$488D            
486F: CF              RST     $08                 
4870: FD 77 31        LD      (IY+$31),A          
4873: 23              INC     HL                  
4874: 7E              LD      A,(HL)              
4875: FD 77 00        LD      (IY+$00),A          
4878: DD 36 0A 00     LD      (IX+$0A),$00        
487C: DD 36 0B 00     LD      (IX+$0B),$00        
4880: DD 36 0C 40     LD      (IX+$0C),$40        
4884: DD 36 0D 00     LD      (IX+$0D),$00        
4888: DD 36 00 FF     LD      (IX+$00),$FF        
488C: C9              RET                         

; ---- $488D-$48AC: data ----
488D: F0 40 F0 80 F0 F8 60 F8 80 F8 A0 F8 10 F8 00 80
489D: 00 90 10 10 30 10 60 10 80 10 A0 10 C0 10 F0 28

; take an object out of play -- occupancy byte and both of its sprite
; entry's coordinates -- and then arm the record's delay byte instead of
; leaving it clear, so the slot is held rather than freed
retireSlotIntoCooldown:
48AD: DD 36 00 00     LD      (IX+$00),$00        
48B1: FD 36 00 00     LD      (IY+$00),$00        
48B5: FD 36 31 00     LD      (IY+$31),$00        
48B9: DD 36 0E F0     LD      (IX+$0E),$F0        
48BD: C9              RET                         

; one frame of coin-input service: run the two coin-slot debounce/accept
; handlers and the phase-gated credit drip in turn, then pulse each
; mechanical coin counter once per coin still owed; dead unless an input
; edge or a pending debt is present
serviceCoinInputs:
48BE: CD E7 48        CALL    $48E7               ; {code.awardOneCreditOnDebouncedInputEdge}
48C1: CD 41 49        CALL    $4941               ; {code.tallyCoinSlot1AndAwardCredit}
48C4: CD 11 49        CALL    $4911               ; {code.meterCoinageTowardCreditOnEdge}
48C7: CD 84 49        CALL    $4984               ; {code.pulseSlot1CoinCounter}
48CA: CD D6 49        CALL    $49D6               ; {code.pulseSlot2CoinCounter}
48CD: C9              RET                         

; ---- $48CE-$48E6: data ----
48CE: 2C A7 13 FD 3B 88 0D DC F1 BF 68 0D D7 F1 FD 3B
48DE: FD DC FD A5 57 ED F1 52 B9

; per-frame debounce of IN0 bit 2 (port mirror 0xA9AE): rotate that bit
; into the bottom of the rolling history at 0xA983 (rl (hl)), fire only on
; a clean leading edge — the low three history bits reading 001 (idle,
; idle, pressed) — else return; on the edge request a sound (0x57F1) and
; award exactly one credit outright (C=1 into
; awardCoinCreditThenPulseCoinCounter, which folds it into the BCD credit
; count at 0xA986 and pulses the coin counter), a flat-credit path
; distinct from the coinage-metered coin-1 handler at 0x4941
awardOneCreditOnDebouncedInputEdge:
48E7: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
48EA: 0F              RRCA                        
48EB: 0F              RRCA                        
48EC: 0F              RRCA                        
48ED: 21 83 A9        LD      HL,$A983            
48F0: CB 16           RL      (HL)                
48F2: 7E              LD      A,(HL)              
48F3: E6 07           AND     $07                 
48F5: FE 01           CP      $01                 
48F7: C0              RET     NZ                  
48F8: CD F1 57        CALL    $57F1               ; {code.requestCoinSound}
48FB: 0E 01           LD      C,$01               
48FD: C3 6E 49        JP      $496E               ; {code.awardCoinCreditThenPulseCoinCounter}

; ---- $4900-$4910: data ----
4900: BC A6 05 30 F1 7C 68 3B A5 38 FD F1 96 5D 17 9B
4910: B9

; phase-gated credit drip: rotate a selector bit (from 0xA9AE) into the
; phase cell 0xA9CA and act only when its low 3 bits read 1 -- request a
; sound, bump the counter at 0xA982, step the low byte at 0xA9CB up by
; 0x10; once the high byte at 0xA9CC still trails the raised low byte,
; pull the low byte back by (high&0xF0)+0x10 and tail into
; awardCoinCreditThenPulseCoinCounter with C = the high byte
meterCoinageTowardCreditOnEdge:
4911: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
4914: 21 CA A9        LD      HL,$A9CA            
4917: 0F              RRCA                        
4918: 0F              RRCA                        
4919: CB 16           RL      (HL)                
491B: 7E              LD      A,(HL)              
491C: E6 07           AND     $07                 
491E: FE 01           CP      $01                 
4920: C0              RET     NZ                  
4921: EB              EX      DE,HL               
4922: CD F1 57        CALL    $57F1               ; {code.requestCoinSound}
4925: 21 82 A9        LD      HL,$A982            
4928: 34              INC     (HL)                
4929: EB              EX      DE,HL               
492A: 23              INC     HL                  
492B: 7E              LD      A,(HL)              
492C: C6 10           ADD     A,$10               
492E: 77              LD      (HL),A              
492F: 47              LD      B,A                 
4930: 23              INC     HL                  
4931: 7E              LD      A,(HL)              
4932: 90              SUB     B                   
4933: D0              RET     NC                  
4934: 7E              LD      A,(HL)              
4935: 4F              LD      C,A                 
4936: E6 F0           AND     $F0                 
4938: C6 10           ADD     A,$10               
493A: 2B              DEC     HL                  
493B: ED 44           NEG                         
493D: 86              ADD     A,(HL)              
493E: 77              LD      (HL),A              
493F: 18 2D           JR      $496E               ; {code.awardCoinCreditThenPulseCoinCounter}

; one frame of coin slot 1 accounting: clock the raw coin line into a
; debounce shift register and, on a clean rising edge, count the coin --
; blip the coin sound, bump the tally, add a unit to the coins-inserted
; accumulator; once it passes the coinage threshold (coins-per-credit high
; nibble, credits awarded low) carry the overshoot forward and, unless the
; no-credit flag is set, add the low nibble to the packed-decimal credit
; count (saturated at 99) and repaint its panel; either overshoot path
; then pulses the mechanical coin counter
tallyCoinSlot1AndAwardCredit:
4941: 3A AE A9        LD      A,($A9AE)           ; {hard.workRam+1AE}
4944: 21 C7 A9        LD      HL,$A9C7            
4947: 0F              RRCA                        
4948: CB 16           RL      (HL)                
494A: 7E              LD      A,(HL)              
494B: E6 07           AND     $07                 
494D: FE 01           CP      $01                 
494F: C0              RET     NZ                  
4950: EB              EX      DE,HL               
4951: CD F1 57        CALL    $57F1               ; {code.requestCoinSound}
4954: 21 81 A9        LD      HL,$A981            
4957: 34              INC     (HL)                
4958: EB              EX      DE,HL               
4959: 23              INC     HL                  
495A: 7E              LD      A,(HL)              
495B: C6 10           ADD     A,$10               
495D: 77              LD      (HL),A              
495E: 47              LD      B,A                 
495F: 23              INC     HL                  
4960: 7E              LD      A,(HL)              
4961: 90              SUB     B                   
4962: D0              RET     NC                  
4963: 7E              LD      A,(HL)              
4964: 4F              LD      C,A                 
4965: E6 F0           AND     $F0                 
4967: C6 10           ADD     A,$10               
4969: 2B              DEC     HL                  
496A: ED 44           NEG                         
496C: 86              ADD     A,(HL)              
496D: 77              LD      (HL),A              

; outside free play, fold C's low decimal digit into the packed-decimal
; credit count at 0xa986 (decimal add, clamp to 99) and repaint that
; field, then run the coin-counter pulse
awardCoinCreditThenPulseCoinCounter:
496E: 3A C0 A9        LD      A,($A9C0)           ; {hard.workRam+1C0}
4971: A7              AND     A                   
4972: 20 10           JR      NZ,$4984            ; {code.pulseSlot1CoinCounter}
4974: 79              LD      A,C                 
4975: E6 0F           AND     $0F                 
4977: 21 86 A9        LD      HL,$A986            
497A: 86              ADD     A,(HL)              
497B: 27              DAA                         
497C: 77              LD      (HL),A              
497D: 30 02           JR      NC,$4981            ; {code.loc_4981}
497F: 36 99           LD      (HL),$99            

loc_4981:
4981: CD FB 4A        CALL    $4AFB               ; {code.paintCreditCountPanel}

; drive coin slot 1's mechanical counter through one pulse for each coin
; the machine still owes it -- energise the line, release it at the half-
; way count, and take one off the debt as the pulse ends -- so a debt of
; two comes out as two separate pulses; with nothing owed it does nothing
pulseSlot1CoinCounter:
4984: 3A 81 A9        LD      A,($A981)           ; {hard.workRam+181}
4987: A7              AND     A                   
4988: C8              RET     Z                   
4989: 21 84 A9        LD      HL,$A984            
498C: 7E              LD      A,(HL)              
498D: A7              AND     A                   
498E: 20 07           JR      NZ,$4997            ; {code.loc_4997}
4990: 36 30           LD      (HL),$30            
4992: 3C              INC     A                   
4993: 32 0A C3        LD      ($C30A),A           
4996: C9              RET                         

loc_4997:
4997: 35              DEC     (HL)                
4998: 28 09           JR      Z,$49A3             ; {code.loc_49a3}
499A: 7E              LD      A,(HL)              
499B: FE 18           CP      $18                 
499D: C0              RET     NZ                  
499E: AF              XOR     A                   
499F: 32 0A C3        LD      ($C30A),A           
49A2: C9              RET                         

loc_49a3:
49A3: 21 81 A9        LD      HL,$A981            
49A6: 35              DEC     (HL)                
49A7: C9              RET                         

; tail of power-on config decode + self-test: slices two bits of the
; rolled config byte into work-RAM 0xa9c4/0xa9c6, kicks the watchdog,
; drives LS259 line 1 from ROM byte 0x0c3e, tiles the character plane,
; sums the 256-byte ROM block at 0x27de and derails a tampered image into
; the frame handler, else cold-starts
finishBootSelfTestAndColdStart:
49A8: 0F              RRCA                        
49A9: 4F              LD      C,A                 
49AA: E6 07           AND     $07                 
49AC: 32 C4 A9        LD      ($A9C4),A           ; {hard.workRam+1C4}
49AF: 79              LD      A,C                 
49B0: 0F              RRCA                        
49B1: 0F              RRCA                        
49B2: 0F              RRCA                        
49B3: E6 01           AND     $01                 
49B5: 32 C6 A9        LD      ($A9C6),A           ; {hard.workRam+1C6}
49B8: 32 00 C2        LD      ($C200),A           
49BB: 3A 3E 0C        LD      A,($0C3E)           ; {hard.rom+C3E}
49BE: 32 02 C3        LD      ($C302),A           
49C1: CD B1 00        CALL    $00B1               ; {code.tileCharPlaneWithBoxLattice}
49C4: 06 00           LD      B,$00               
49C6: 21 DE 27        LD      HL,$27DE            
49C9: AF              XOR     A                   

loc_49ca:
49CA: 86              ADD     A,(HL)              
49CB: 23              INC     HL                  
49CC: 10 FC           DJNZ    $49CA               ; {code.loc_49ca}
49CE: D6 C5           SUB     $C5                 
49D0: C4 D8 00        CALL    NZ,$00D8            ; {code.loc_00d8}
49D3: C3 EB 32        JP      $32EB               ; {code.petWatchdogThroughStartupDelayThenStartMachine}

; drive one hardware output line as a train of square pulses, one pulse
; per unit of a pending count
pulseSlot2CoinCounter:
49D6: 3A 82 A9        LD      A,($A982)           ; {hard.workRam+182}
49D9: A7              AND     A                   
49DA: C8              RET     Z                   
49DB: 21 85 A9        LD      HL,$A985            
49DE: 7E              LD      A,(HL)              
49DF: A7              AND     A                   
49E0: 20 07           JR      NZ,$49E9            ; {code.loc_49e9}
49E2: 36 30           LD      (HL),$30            
49E4: 3C              INC     A                   
49E5: 32 0C C3        LD      ($C30C),A           
49E8: C9              RET                         

loc_49e9:
49E9: 35              DEC     (HL)                
49EA: 28 09           JR      Z,$49F5             ; {code.loc_49f5}
49EC: 7E              LD      A,(HL)              
49ED: FE 18           CP      $18                 
49EF: C0              RET     NZ                  
49F0: AF              XOR     A                   
49F1: 32 0C C3        LD      ($C30C),A           
49F4: C9              RET                         

loc_49f5:
49F5: 21 82 A9        LD      HL,$A982            
49F8: 35              DEC     (HL)                
49F9: C9              RET                         

loc_49fa:
49FA: EE A6           XOR     $A6                 
49FC: 14              INC     D                   
49FD: A5              AND     L                   
49FE: 3B              DEC     SP                  
49FF: 87              ADD     A,A                 
4A00: F1              POP     AF                  
4A01: DC D7 BF        CALL    C,$BFD7             
4A04: F1              POP     AF                  
4A05: DC C4 FD        CALL    C,$FDC4             
4A08: ED F1           DEFB    $ED,$F1             
4A0A: 7D              LD      A,L                 
4A0B: A5              AND     L                   
4A0C: 38 34           JR      C,$4A42             ; {code.paintCaptionColourBandAndStepSequence}
4A0E: B9              CP      C                   

; lay out one phase of the sequenced intro/self-test screen: stock an
; 8-byte control block at 0xA9F0 (ROM shape byte 0x3213, fixed fields,
; parked ROM pointer 0x56F1), write a fixed attribute run at 0xA400,
; colour three colour-plane rows and a small block by adding the base
; colour at 0xAD0C to fixed offsets, seed the active player's saved pen
; from its era, then tail-step the sequence sub-step; unreached by either
; tape
paintSelfTestScreenPhaseThenStepSequence:
4A0F: 3A 13 32        LD      A,($3213)           ; {hard.rom+3213}
4A12: 32 F0 A9        LD      ($A9F0),A           ; {hard.workRam+1F0}
4A15: 3E 00           LD      A,$00               
4A17: 32 F1 A9        LD      ($A9F1),A           ; {hard.workRam+1F1}
4A1A: 3E FF           LD      A,$FF               
4A1C: 32 F2 A9        LD      ($A9F2),A           ; {hard.workRam+1F2}
4A1F: 3E 04           LD      A,$04               
4A21: 32 F3 A9        LD      ($A9F3),A           ; {hard.workRam+1F3}
4A24: 3E FF           LD      A,$FF               
4A26: 32 F4 A9        LD      ($A9F4),A           ; {hard.workRam+1F4}
4A29: 3E 08           LD      A,$08               
4A2B: 32 F6 A9        LD      ($A9F6),A           ; {hard.workRam+1F6}
4A2E: 21 F1 56        LD      HL,$56F1            
4A31: 22 F7 A9        LD      ($A9F7),HL          ; {hard.workRam+1F7}
4A34: 06 0D           LD      B,$0D               
4A36: 21 00 A4        LD      HL,$A400            
4A39: 0E 14           LD      C,$14               

loc_4a3b:
4A3B: 71              LD      (HL),C              
4A3C: 23              INC     HL                  
4A3D: 10 FC           DJNZ    $4A3B               ; {code.loc_4a3b}
4A3F: 3E 00           LD      A,$00               
4A41: 77              LD      (HL),A              

; continue a caption's colour band from the caller's HL cursor: lay the
; caller's A over one cell, a 13-cell run of the caller's C and a 4-cell
; tail (0x0e), then fill two colour-RAM rows and six scattered colour
; cells from the base colour at 0xAD0C (each value base+offset), then seed
; the saved pen from the era and step the sequence sub-step; A/C/HL/DE
; left scratch
paintCaptionColourBandAndStepSequence:
4A42: 23              INC     HL                  
4A43: 77              LD      (HL),A              
4A44: 23              INC     HL                  
4A45: 06 0D           LD      B,$0D               

loc_4a47:
4A47: 71              LD      (HL),C              
4A48: 23              INC     HL                  
4A49: 10 FC           DJNZ    $4A47               ; {code.loc_4a47}
4A4B: 3E 0E           LD      A,$0E               
4A4D: 06 04           LD      B,$04               

loc_4a4f:
4A4F: 77              LD      (HL),A              
4A50: 23              INC     HL                  
4A51: 10 FC           DJNZ    $4A4F               ; {code.loc_4a4f}
4A53: 21 B1 A7        LD      HL,$A7B1            
4A56: CB 94           RES     2,H                 
4A58: 3A 0C AD        LD      A,($AD0C)           ; {hard.workRam+50C}
4A5B: 4F              LD      C,A                 
4A5C: 3E A0           LD      A,$A0               
4A5E: 81              ADD     A,C                 
4A5F: CD 19 13        CALL    $1319               ; {code.fillCellRun}
4A62: 21 D1 A5        LD      HL,$A5D1            
4A65: CB 94           RES     2,H                 
4A67: 3E 20           LD      A,$20               
4A69: 81              ADD     A,C                 
4A6A: CD 19 13        CALL    $1319               ; {code.fillCellRun}
4A6D: 21 10 A6        LD      HL,$A610            
4A70: CB 94           RES     2,H                 
4A72: 3E A0           LD      A,$A0               
4A74: 81              ADD     A,C                 
4A75: 77              LD      (HL),A              
4A76: 19              ADD     HL,DE               
4A77: 3E 20           LD      A,$20               
4A79: 81              ADD     A,C                 
4A7A: 77              LD      (HL),A              
4A7B: 21 12 A6        LD      HL,$A612            
4A7E: CB 94           RES     2,H                 
4A80: 3E E0           LD      A,$E0               
4A82: 81              ADD     A,C                 
4A83: 77              LD      (HL),A              
4A84: 19              ADD     HL,DE               
4A85: 3E 60           LD      A,$60               
4A87: 81              ADD     A,C                 
4A88: 77              LD      (HL),A              
4A89: 21 11 A6        LD      HL,$A611            
4A8C: CB 94           RES     2,H                 
4A8E: 3E A0           LD      A,$A0               
4A90: 81              ADD     A,C                 
4A91: 77              LD      (HL),A              
4A92: 19              ADD     HL,DE               
4A93: 3E 20           LD      A,$20               
4A95: 81              ADD     A,C                 
4A96: 77              LD      (HL),A              
4A97: CD 9C 33        CALL    $339C               ; {code.setSavedPenFromEra}
4A9A: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; step thirteen cells of the character plane on by one shape each, but
; only where a script says so, walking that script through one shared
; cursor cell that is left wherever the walk ended; two bits of one
; incoming byte set the directions independently -- the low bit reads the
; script backwards and steps the shape DOWN, the next bit takes the cells
; a row up instead of a row down
stepThirteenScriptedGlyphCells:
4A9D: 06 0D           LD      B,$0D               
4A9F: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}

loc_4aa2:
4AA2: 7E              LD      A,(HL)              
4AA3: A7              AND     A                   
4AA4: EB              EX      DE,HL               
4AA5: 28 09           JR      Z,$4AB0             ; {code.loc_4ab0}
4AA7: 7E              LD      A,(HL)              
4AA8: 3C              INC     A                   
4AA9: CB 41           BIT     0,C                 
4AAB: 28 02           JR      Z,$4AAF             ; {code.loc_4aaf}
4AAD: 3D              DEC     A                   
4AAE: 3D              DEC     A                   

loc_4aaf:
4AAF: 77              LD      (HL),A              

loc_4ab0:
4AB0: CB 49           BIT     1,C                 
4AB2: 11 20 00        LD      DE,$0020            
4AB5: 28 03           JR      Z,$4ABA             ; {code.loc_4aba}
4AB7: 11 E0 FF        LD      DE,$FFE0            

loc_4aba:
4ABA: 19              ADD     HL,DE               
4ABB: EB              EX      DE,HL               
4ABC: 2A F7 A9        LD      HL,($A9F7)          ; {hard.workRam+1F7}
4ABF: 23              INC     HL                  
4AC0: CB 41           BIT     0,C                 
4AC2: 28 02           JR      Z,$4AC6             ; {code.loc_4ac6}
4AC4: 2B              DEC     HL                  
4AC5: 2B              DEC     HL                  

loc_4ac6:
4AC6: 22 F7 A9        LD      ($A9F7),HL          ; {hard.workRam+1F7}
4AC9: 10 D7           DJNZ    $4AA2               ; {code.loc_4aa2}
4ACB: C9              RET                         

; turn the two four-bit coinage settings into the byte each coin slot's
; accept arm works from, and raise the free-play flag when either of them
; reads free play
unpackCoinage:
4ACC: 3A B1 A9        LD      A,($A9B1)           ; {hard.workRam+1B1}
4ACF: E6 0F           AND     $0F                 
4AD1: FE 0F           CP      $0F                 
4AD3: 20 05           JR      NZ,$4ADA            ; {code.loc_4ada}
4AD5: 21 C0 A9        LD      HL,$A9C0            
4AD8: 36 FF           LD      (HL),$FF            

loc_4ada:
4ADA: 21 95 4B        LD      HL,$4B95            
4ADD: CF              RST     $08                 
4ADE: 32 C9 A9        LD      ($A9C9),A           ; {hard.workRam+1C9}
4AE1: 3A B1 A9        LD      A,($A9B1)           ; {hard.workRam+1B1}
4AE4: 0F              RRCA                        
4AE5: 0F              RRCA                        
4AE6: 0F              RRCA                        
4AE7: 0F              RRCA                        
4AE8: E6 0F           AND     $0F                 
4AEA: FE 0F           CP      $0F                 
4AEC: 20 05           JR      NZ,$4AF3            ; {code.loc_4af3}
4AEE: 21 C0 A9        LD      HL,$A9C0            
4AF1: 36 FF           LD      (HL),$FF            

loc_4af3:
4AF3: 21 95 4B        LD      HL,$4B95            
4AF6: CF              RST     $08                 
4AF7: 32 CC A9        LD      ($A9CC),A           ; {hard.workRam+1CC}
4AFA: C9              RET                         

; set the pen colour, the destination cell and the source byte, then paint
; them through the packed-digit painter; every one of the three is fixed
; here, so a caller chooses none of them
paintCreditCountPanel:
4AFB: 0E 10           LD      C,$10               
4AFD: 11 7F A4        LD      DE,$A47F            
4B00: 21 86 A9        LD      HL,$A986            
4B03: CD 81 0D        CALL    $0D81               ; {code.paintTwoUnsuppressedDigitsFromByte}
4B06: C9              RET                         

; ---- $4B07-$4B18: data ----
4B07: 2A 41 AB 7D AC 2F 87 87 ED 6A 22 41 AB ED 5F 85
4B17: AC C9

; step the sequence's inner sub-step on, folding a block of the program
; image on the way; a total that does not match advances the outer phase
; instead, which derails the sequence rather than halting it
stepSequenceUnderChecksum:
4B19: 11 CC 0B        LD      DE,$0BCC            
4B1C: 01 89 00        LD      BC,$0089            
4B1F: 3A 50 1A        LD      A,($1A50)           ; {hard.rom+1A50}
4B22: 67              LD      H,A                 

loc_4b23:
4B23: 1A              LD      A,(DE)              
4B24: 81              ADD     A,C                 
4B25: 4F              LD      C,A                 
4B26: 13              INC     DE                  
4B27: 10 FA           DJNZ    $4B23               ; {code.loc_4b23}
4B29: 94              SUB     H                   
4B2A: C4 11 0F        CALL    NZ,$0F11            ; {code.advanceSequencePhase}
4B2D: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; copy three tilemap cells into three two-byte keeps, reading each cell
; twice because its two planes sit a fixed distance apart
copyThreeTilemapCellsFromBothPlanes:
4B30: 21 1B 0D        LD      HL,$0D1B            
4B33: 06 03           LD      B,$03               

loc_4b35:
4B35: 5E              LD      E,(HL)              
4B36: 23              INC     HL                  
4B37: 56              LD      D,(HL)              
4B38: 23              INC     HL                  
4B39: 1A              LD      A,(DE)              
4B3A: 08              EX      AF,AF'              
4B3B: 3E 04           LD      A,$04               
4B3D: 82              ADD     A,D                 
4B3E: 57              LD      D,A                 
4B3F: 1A              LD      A,(DE)              
4B40: 5E              LD      E,(HL)              
4B41: 23              INC     HL                  
4B42: 56              LD      D,(HL)              
4B43: 23              INC     HL                  
4B44: 12              LD      (DE),A              
4B45: 1C              INC     E                   
4B46: 08              EX      AF,AF'              
4B47: 12              LD      (DE),A              
4B48: 10 EB           DJNZ    $4B35               ; {code.loc_4b35}
4B4A: C9              RET                         

; draw the next pseudo-random byte: advance the seventeen-byte shift
; register one place, fill the vacated head with the exclusive-or of two
; taps, and hand back that feedback plus the frame counter, so two draws
; at different moments differ even where the register has not moved
drawRandomByte:
4B4B: D9              EXX                         
4B4C: 21 3F AB        LD      HL,$AB3F            
4B4F: 11 40 AB        LD      DE,$AB40            
4B52: 01 10 00        LD      BC,$0010            
4B55: ED B8           LDDR                        
4B57: 21 40 AB        LD      HL,$AB40            
4B5A: 3A 37 AB        LD      A,($AB37)           ; {hard.workRam+337}
4B5D: AE              XOR     (HL)                
4B5E: 32 30 AB        LD      ($AB30),A           ; {hard.workRam+330}
4B61: 21 80 A9        LD      HL,$A980            
4B64: 86              ADD     A,(HL)              
4B65: D9              EXX                         
4B66: C9              RET                         

; copy a fixed seventeen-byte run of program space at 0x4B84 into the
; random register block, then check the image that run came out of: three
; bytes taken from two fixed words of program space are added to one
; constant, and any total but zero means the program space being read is
; not the one the constant was picked for -- on that outcome control
; transfers to 0x6000, outside the image, so it raises rather than
; running. ★ The copy is unconditional and COMPLETE before the check runs,
; so nothing this entry wrote is gated by it
seedRandomRegister:
4B67: 21 84 4B        LD      HL,$4B84            
4B6A: 11 30 AB        LD      DE,$AB30            
4B6D: 01 11 00        LD      BC,$0011            
4B70: ED B0           LDIR                        
4B72: DD 2A 6D 08     LD      IX,($086D)          ; {hard.rom+86D}
4B76: 2A 70 08        LD      HL,($0870)          ; {hard.rom+870}
4B79: DD 7D           LD      A,IXL               
4B7B: DD 84           ADD     A,IXH               
4B7D: 85              ADD     A,L                 
4B7E: C6 44           ADD     A,$44               
4B80: C2 00 60        JP      NZ,$6000            
4B83: C9              RET                         

; ---- $4B84-$4BA4: data ----
4B84: FF 05 F6 80 32 17 9C C9 DD 21 74 98 FD BF 24 AE
4B94: 46 01 02 03 04 05 06 07 11 13 15 21 22 24 31 33
4BA4: 01

; copy forty bytes of program space into the five-entry high-score table,
; which is the only way that table is ever initialised
loadDefaultHighScores:
4BA5: 21 B1 4B        LD      HL,$4BB1            
4BA8: 11 08 AB        LD      DE,$AB08            
4BAB: 01 28 00        LD      BC,$0028            
4BAE: ED B0           LDIR                        
4BB0: C9              RET                         

; ---- $4BB1-$4BD8: data ----
4BB1: 00 00 00 01 7C 11 68 F1 01 00 88 00 3B 11 A5 F1
4BC1: 02 60 84 00 38 11 FD F1 03 20 65 00 68 11 68 F1
4BD1: 04 00 43 00 BF 11 A5 F1

loc_4bd9:
4BD9: C3 AE 08        JP      $08AE               ; {code.selectFoldBlock}

; paint five labelled numeric readouts up the tile plane: seat each of
; five source records (0xab08, stride 8), its tile-plane cursor cell
; (0xa711, stride 2) and its pen colour, then hand to the column painter
; paintLabelledNumericReadoutColumn; writes tile/colour cells
; 0xa0f1-0xa719
paintFiveLabelledNumericReadouts:
4BDC: 21 08 AB        LD      HL,$AB08            
4BDF: 11 11 A7        LD      DE,$A711            
4BE2: 0E 14           LD      C,$14               
4BE4: CD 1F 4C        CALL    $4C1F               ; {code.paintLabelledNumericReadoutColumn}
4BE7: 21 10 AB        LD      HL,$AB10            
4BEA: 11 13 A7        LD      DE,$A713            
4BED: 0E 16           LD      C,$16               
4BEF: CD 1F 4C        CALL    $4C1F               ; {code.paintLabelledNumericReadoutColumn}
4BF2: 21 18 AB        LD      HL,$AB18            
4BF5: 11 15 A7        LD      DE,$A715            
4BF8: 0E 12           LD      C,$12               
4BFA: CD 1F 4C        CALL    $4C1F               ; {code.paintLabelledNumericReadoutColumn}
4BFD: 21 20 AB        LD      HL,$AB20            
4C00: 11 17 A7        LD      DE,$A717            
4C03: 0E 15           LD      C,$15               
4C05: CD 1F 4C        CALL    $4C1F               ; {code.paintLabelledNumericReadoutColumn}
4C08: 21 28 AB        LD      HL,$AB28            
4C0B: 11 19 A7        LD      DE,$A719            
4C0E: 0E 13           LD      C,$13               
4C10: CD 1F 4C        CALL    $4C1F               ; {code.paintLabelledNumericReadoutColumn}
4C13: C9              RET                         

; ---- $4C14-$4C1E: data ----
4C14: 73 A6 14 7E 29 F8 96 5D F3 13 B9

; paint a labelled numeric readout as one upward tile-plane column: a
; table-indexed three-tile pictogram (source lead byte x3 into 0x4cb4), a
; six-digit field, then a three-tile suffix, each cell paired into the
; colour plane with the caller's pen colour
paintLabelledNumericReadoutColumn:
4C1F: E5              PUSH    HL                  
4C20: 7E              LD      A,(HL)              
4C21: 87              ADD     A,A                 
4C22: 86              ADD     A,(HL)              
4C23: 21 B4 4C        LD      HL,$4CB4            
4C26: CF              RST     $08                 
4C27: 12              LD      (DE),A              
4C28: CB 92           RES     2,D                 
4C2A: 79              LD      A,C                 
4C2B: 12              LD      (DE),A              
4C2C: CB D2           SET     2,D                 
4C2E: 23              INC     HL                  
4C2F: E7              RST     $20                 
4C30: 7E              LD      A,(HL)              
4C31: 12              LD      (DE),A              
4C32: CB 92           RES     2,D                 
4C34: 79              LD      A,C                 
4C35: 12              LD      (DE),A              
4C36: CB D2           SET     2,D                 
4C38: 23              INC     HL                  
4C39: E7              RST     $20                 
4C3A: 7E              LD      A,(HL)              
4C3B: 12              LD      (DE),A              
4C3C: CB 92           RES     2,D                 
4C3E: 79              LD      A,C                 
4C3F: 12              LD      (DE),A              
4C40: CB D2           SET     2,D                 
4C42: 21 80 FF        LD      HL,$FF80            
4C45: 19              ADD     HL,DE               
4C46: EB              EX      DE,HL               
4C47: E1              POP     HL                  
4C48: 23              INC     HL                  
4C49: 23              INC     HL                  
4C4A: 23              INC     HL                  
4C4B: CD 73 0D        CALL    $0D73               ; {code.paintSixDigitFieldSuppressingLeadingZeros}
4C4E: E5              PUSH    HL                  
4C4F: 21 A0 FF        LD      HL,$FFA0            
4C52: 19              ADD     HL,DE               
4C53: EB              EX      DE,HL               
4C54: E1              POP     HL                  
4C55: 23              INC     HL                  
4C56: 23              INC     HL                  
4C57: 23              INC     HL                  
4C58: 7E              LD      A,(HL)              
4C59: 12              LD      (DE),A              
4C5A: CB 92           RES     2,D                 
4C5C: 79              LD      A,C                 
4C5D: 12              LD      (DE),A              
4C5E: CB D2           SET     2,D                 
4C60: 23              INC     HL                  
4C61: E7              RST     $20                 
4C62: 7E              LD      A,(HL)              
4C63: 12              LD      (DE),A              
4C64: CB 92           RES     2,D                 
4C66: 79              LD      A,C                 
4C67: 12              LD      (DE),A              
4C68: CB D2           SET     2,D                 
4C6A: 23              INC     HL                  
4C6B: E7              RST     $20                 
4C6C: 7E              LD      A,(HL)              
4C6D: 12              LD      (DE),A              
4C6E: CB 92           RES     2,D                 
4C70: 79              LD      A,C                 
4C71: 12              LD      (DE),A              
4C72: CB D2           SET     2,D                 
4C74: C9              RET                         

; sequence arm (computed-dispatch entry 3 of the table at 0x0F29): blank a
; fixed character-cell run, copy the active player's saved 16-byte context
; block into the live block at 0xAD00, step the sequence sub-index; when
; play is active it also posts the round number (cmd 6) and lives-less-one
; (cmd 5) to the command ring and folds a fixed program span (0x5B50, 256
; bytes) into an XOR whose low bit less one drives the picture-enable
; latch 0xC308 -- a tamper guard
loadActivePlayerContextAndPostRoundHud:
4C75: CD D2 07        CALL    $07D2               ; {code.blankFourteenCharCells}
4C78: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
4C7B: A7              AND     A                   
4C7C: 21 10 AD        LD      HL,$AD10            
4C7F: 28 03           JR      Z,$4C84             ; {code.loc_4c84}
4C81: 21 20 AD        LD      HL,$AD20            

loc_4c84:
4C84: 11 00 AD        LD      DE,$AD00            
4C87: 01 10 00        LD      BC,$0010            
4C8A: ED B0           LDIR                        
4C8C: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
4C8F: A7              AND     A                   
4C90: CA 1A 0F        JP      Z,$0F1A             ; {code.advanceSequenceSubStep}
4C93: 3A 01 AD        LD      A,($AD01)           ; {hard.workRam+501}
4C96: 16 06           LD      D,$06               
4C98: 5F              LD      E,A                 
4C99: FF              RST     $38                 
4C9A: 3A 00 AD        LD      A,($AD00)           ; {hard.workRam+500}
4C9D: 3D              DEC     A                   
4C9E: 16 05           LD      D,$05               
4CA0: 5F              LD      E,A                 
4CA1: FF              RST     $38                 
4CA2: 06 00           LD      B,$00               
4CA4: 21 50 5B        LD      HL,$5B50            
4CA7: 97              SUB     A                   

loc_4ca8:
4CA8: AE              XOR     (HL)                
4CA9: 23              INC     HL                  
4CAA: 10 FC           DJNZ    $4CA8               ; {code.loc_4ca8}
4CAC: C6 FF           ADD     A,$FF               
4CAE: 32 08 C3        LD      ($C308),A           
4CB1: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; ---- $4CB4-$4CC2: data ----
4CB4: 96 ED DC 9B 3B 87 CD D7 87 F3 DC C4 7F DC C4

; file the active player's finished score into the five-record high-score
; board: walk the standing scores top-down comparing each (isScoreBelow)
; to find the first the new score is not below, slide the records beneath
; down one slot (lddr), write the new score with blank 0xf1 name-cell
; sentinels, look up its initial-glyph row pointer, and renumber the rank
; column 0..4; carry returns clear when filed, set when the score beat
; none
fileScoreIntoHighScoreTable:
4CC3: 21 0B AB        LD      HL,$AB0B            
4CC6: 06 05           LD      B,$05               
4CC8: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
4CCB: A7              AND     A                   
4CCC: 11 35 AD        LD      DE,$AD35            
4CCF: 28 03           JR      Z,$4CD4             ; {code.loc_4cd4}
4CD1: 11 38 AD        LD      DE,$AD38            

loc_4cd4:
4CD4: E5              PUSH    HL                  
4CD5: D5              PUSH    DE                  
4CD6: CD 2B 4D        CALL    $4D2B               ; {code.isScoreBelow}
4CD9: 30 09           JR      NC,$4CE4            ; {code.loc_4ce4}
4CDB: D1              POP     DE                  
4CDC: E1              POP     HL                  
4CDD: 3E 08           LD      A,$08               
4CDF: CF              RST     $08                 
4CE0: 10 F2           DJNZ    $4CD4               ; {code.loc_4cd4}
4CE2: 37              SCF                         
4CE3: C9              RET                         

loc_4ce4:
4CE4: 05              DEC     B                   
4CE5: 28 3F           JR      Z,$4D26             ; {code.loc_4d26}
4CE7: 21 27 AB        LD      HL,$AB27            
4CEA: 11 2F AB        LD      DE,$AB2F            
4CED: 78              LD      A,B                 
4CEE: 87              ADD     A,A                 
4CEF: 87              ADD     A,A                 
4CF0: 87              ADD     A,A                 
4CF1: 4F              LD      C,A                 
4CF2: 06 00           LD      B,$00               
4CF4: ED B8           LDDR                        
4CF6: EB              EX      DE,HL               

loc_4cf7:
4CF7: 2B              DEC     HL                  
4CF8: 36 F1           LD      (HL),$F1            
4CFA: 2B              DEC     HL                  
4CFB: 36 F1           LD      (HL),$F1            
4CFD: 2B              DEC     HL                  
4CFE: 36 F1           LD      (HL),$F1            
4D00: 22 91 A9        LD      ($A991),HL          ; {hard.workRam+191}
4D03: 2B              DEC     HL                  
4D04: D1              POP     DE                  
4D05: 01 03 00        LD      BC,$0003            
4D08: EB              EX      DE,HL               
4D09: ED B8           LDDR                        
4D0B: 1A              LD      A,(DE)              
4D0C: E1              POP     HL                  
4D0D: 21 31 A5        LD      HL,$A531            
4D10: 87              ADD     A,A                 
4D11: CF              RST     $08                 
4D12: 22 93 A9        LD      ($A993),HL          ; {hard.workRam+193}
4D15: 21 08 AB        LD      HL,$AB08            
4D18: 11 08 00        LD      DE,$0008            
4D1B: 06 05           LD      B,$05               
4D1D: AF              XOR     A                   

loc_4d1e:
4D1E: 77              LD      (HL),A              
4D1F: 19              ADD     HL,DE               
4D20: 3C              INC     A                   
4D21: 10 FB           DJNZ    $4D1E               ; {code.loc_4d1e}
4D23: 37              SCF                         
4D24: 3F              CCF                         
4D25: C9              RET                         

loc_4d26:
4D26: 21 2F AB        LD      HL,$AB2F            
4D29: 18 CC           JR      $4CF7               ; {code.loc_4cf7}

; answer whether one three-byte score is below another, both read most
; significant byte first from the two addresses given and DOWNWARD, all
; three equal counting as not below; nothing is written -- the answer,
; mirrored into carry for the caller to branch on, is the whole product
isScoreBelow:
4D2B: 0E 03           LD      C,$03               

loc_4d2d:
4D2D: 1A              LD      A,(DE)              
4D2E: BE              CP      (HL)                
4D2F: D8              RET     C                   
4D30: 20 05           JR      NZ,$4D37            ; {code.loc_4d37}
4D32: 1B              DEC     DE                  
4D33: 2B              DEC     HL                  
4D34: 0D              DEC     C                   
4D35: 20 F6           JR      NZ,$4D2D            ; {code.loc_4d2d}

loc_4d37:
4D37: 37              SCF                         
4D38: 3F              CCF                         
4D39: C9              RET                         

; step a three-place base-sixty tick counter at 0xAD05, carrying into the
; next place only while a place rolls over; only on a full roll-over count
; down the reload timer at 0xA9D7, and each time it fires rearm it from
; 0xA9D6, climb the escalation rung at 0xACC0 one step (held at 15), and
; apply that rung's tuning row
escalateDifficultyRungOnCounterWrap:
4D3A: 21 05 AD        LD      HL,$AD05            
4D3D: CD 67 4D        CALL    $4D67               ; {code.advanceSexagesimalDigit}
4D40: D8              RET     C                   
4D41: 2C              INC     L                   
4D42: CD 67 4D        CALL    $4D67               ; {code.advanceSexagesimalDigit}
4D45: 38 04           JR      C,$4D4B             ; {code.loc_4d4b}
4D47: 2C              INC     L                   
4D48: CD 67 4D        CALL    $4D67               ; {code.advanceSexagesimalDigit}

loc_4d4b:
4D4B: 21 D7 A9        LD      HL,$A9D7            
4D4E: 7E              LD      A,(HL)              
4D4F: A7              AND     A                   
4D50: C8              RET     Z                   
4D51: 35              DEC     (HL)                
4D52: C0              RET     NZ                  
4D53: 3A D6 A9        LD      A,($A9D6)           ; {hard.workRam+1D6}
4D56: 77              LD      (HL),A              
4D57: 3A C0 AC        LD      A,($ACC0)           ; {hard.workRam+4C0}
4D5A: 3C              INC     A                   
4D5B: FE 10           CP      $10                 
4D5D: 38 02           JR      C,$4D61             ; {code.loc_4d61}
4D5F: 3E 0F           LD      A,$0F               

loc_4d61:
4D61: 32 C0 AC        LD      ($ACC0),A           ; {hard.workRam+4C0}
4D64: C3 9A 1A        JP      $1A9A               ; {code.applyEraRungSettings}

; advance one two-digit packed-decimal place of a base-sixty counter,
; storing the stepped value before testing it and replacing it with zero
; once it reaches sixty; the answer comes back in the carry, inverted, so
; a set carry means it did NOT wrap
advanceSexagesimalDigit:
4D67: 7E              LD      A,(HL)              
4D68: C6 01           ADD     A,$01               
4D6A: 27              DAA                         
4D6B: 77              LD      (HL),A              
4D6C: FE 60           CP      $60                 
4D6E: D8              RET     C                   
4D6F: 36 00           LD      (HL),$00            
4D71: C9              RET                         

; ---- $4D72-$4DDD: data ----
4D72: 4F 3A 30 AD A7 C8 11 83 A7 79 FE 07 38 02 3E 06
4D82: A7 28 0C 06 09 0E 18 08 CD AF 4D 08 3D 20 F8 01
4D92: 10 F1 21 DD 59 19 30 05 CD CF 4D 18 F5 06 00 21
4DA2: 11 07 97 AE 23 10 FC C6 19 C2 B1 4B C9 78 C6 03
4DB2: 12 3D 1B 12 E7 78 12 3C 13 12 21 00 FC 19 E7 71
4DC2: 2B 71 7D C6 20 6F 30 01 24 71 23 71 C9 EB 70 2B
4DD2: 36 F1 CB 94 71 23 71 CB D4 EB E7 C9

; award an extra life when the active player's score reaches one of the
; bonus marks, once per mark. It returns immediately unless PLAY_ACTIVE is
; set; picks one of the two mark tables at ROM 0x4E1B and 0x4E30 on bit 0
; of the settings byte at 0xA9C3; and searches the chosen table with cpir
; for an EXACT match on the top byte of the active player's six-digit
; packed-decimal score -- 0xAD35 or 0xAD38, selected on ACTIVE_PLAYER --
; so only a score standing on a mark matches, never one compared against
; it. Bit 0 of 0xAD03 makes the award one-shot: a match while that bit is
; already set does nothing, and the first call that does not match clears
; it again. On a fresh match it sets the bit, increments LIVES_REMAINING,
; posts ring command 5 with the count from BEFORE the increment, and tail-
; jumps into requestBonusLifeSound for the sound, so
; requestBonusLifeSound's ret returns to this routine's caller. Its one
; call site in the image is serviceRoundThenResolvePlayerState, the round
; engine's straight-line block of calls, which reaches it once per
; dispatch of that block
awardBonusLifeAtScoreMark:
4DDE: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
4DE1: A7              AND     A                   
4DE2: C8              RET     Z                   
4DE3: 3A C3 A9        LD      A,($A9C3)           ; {hard.workRam+1C3}
4DE6: E6 01           AND     $01                 
4DE8: 21 1B 4E        LD      HL,$4E1B            
4DEB: 28 03           JR      Z,$4DF0             ; {code.loc_4df0}
4DED: 21 30 4E        LD      HL,$4E30            

loc_4df0:
4DF0: 4E              LD      C,(HL)              
4DF1: 06 00           LD      B,$00               
4DF3: 23              INC     HL                  
4DF4: 3A 32 AD        LD      A,($AD32)           ; {hard.workRam+532}
4DF7: A7              AND     A                   
4DF8: 3A 35 AD        LD      A,($AD35)           ; {hard.workRam+535}
4DFB: 28 03           JR      Z,$4E00             ; {code.loc_4e00}
4DFD: 3A 38 AD        LD      A,($AD38)           ; {hard.workRam+538}

loc_4e00:
4E00: ED B1           CPIR                        
4E02: 21 03 AD        LD      HL,$AD03            
4E05: 20 11           JR      NZ,$4E18            ; {code.loc_4e18}
4E07: CB 46           BIT     0,(HL)              
4E09: C0              RET     NZ                  
4E0A: CB C6           SET     0,(HL)              
4E0C: 21 00 AD        LD      HL,$AD00            
4E0F: 7E              LD      A,(HL)              
4E10: 34              INC     (HL)                
4E11: 16 05           LD      D,$05               
4E13: 5F              LD      E,A                 
4E14: FF              RST     $38                 
4E15: C3 05 58        JP      $5805               ; {code.requestBonusLifeSound}

loc_4e18:
4E18: CB 86           RES     0,(HL)              
4E1A: C9              RET                         

; ---- $4E1B-$4E4E: data ----
4E1B: 14 01 06 11 16 21 26 31 36 41 46 51 56 61 66 71
4E2B: 76 81 86 91 96 11 02 08 14 20 26 32 38 44 50 56
4E3B: 62 68 74 80 86 92 98 6F A6 14 88 57 A5 BF 34 D7
4E4B: F1 9B F1 B9

; dispatch one round's per-frame collision pass by ERA_INDEX (0xad04): era
; 4 to dispatchEra4CollisionByFrameParity, era 1 to
; splitCollisionWorkByFrameParity, every other era split on FRAME_TICK's
; (0xa980) low bit to dispatchShotSweepByMotherShipArmed (odd) else
; runAllCollisionSweepsThisFrame (even); reached from the substep-7
; dispatcher 0x1199
dispatchCollisionPassByEra:
4E4F: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
4E52: FE 04           CP      $04                 
4E54: CA 2A 4F        JP      Z,$4F2A             ; {code.dispatchEra4CollisionByFrameParity}
4E57: 3D              DEC     A                   
4E58: CA BC 4E        JP      Z,$4EBC             ; {code.splitCollisionWorkByFrameParity}
4E5B: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
4E5E: E6 01           AND     $01                 
4E60: C2 35 4F        JP      NZ,$4F35            ; {code.dispatchShotSweepByMotherShipArmed}

; run one round's collision-and-destruction pass: sweep the player's shots
; against targets, then the player against a run of objects, then --
; picked by whether the mother-ship is armed -- either the player-vs-slots
; contact sweep plus the mother-ship mutual-kill box, or a wider player-
; vs-slots sweep; then a three-target attacker sweep and a final mark of
; objects touching the player. The object/slot cursor pair threads through
; DE/IY across the chain, each stage continuing where the last left off
runAllCollisionSweepsThisFrame:
4E63: CD 5D 4F        CALL    $4F5D               ; {code.stagePlayerShotSweepAgainstTargetsAndRun}
4E66: 06 04           LD      B,$04               
4E68: 11 10 A8        LD      DE,$A810            
4E6B: FD 21 12 AA     LD      IY,$AA12            
4E6F: 2E 05           LD      L,$05               
4E71: 26 0B           LD      H,$0B               
4E73: CD 85 51        CALL    $5185               ; {code.destroyPlayerAndObjectsTouchingIt}
4E76: 3A 0D AD        LD      A,($AD0D)           ; {hard.workRam+50D}
4E79: A7              AND     A                   
4E7A: 20 1B           JR      NZ,$4E97            ; {code.loc_4e97}
4E7C: 06 07           LD      B,$07               
4E7E: 2E 07           LD      L,$07               
4E80: 26 0F           LD      H,$0F               
4E82: CD 52 51        CALL    $5152               ; {code.destroySlotsAndPlayerOnContact}
4E85: 06 03           LD      B,$03               
4E87: 2E 06           LD      L,$06               
4E89: 26 0D           LD      H,$0D               
4E8B: CD 21 51        CALL    $5121               ; {code.destroyTargetsReachedByFixedAttacker}
4E8E: 06 01           LD      B,$01               
4E90: 2E 08           LD      L,$08               
4E92: 26 11           LD      H,$11               
4E94: C3 B3 51        JP      $51B3               ; {code.markObjectsTouchingPlayer}

loc_4e97:
4E97: 06 05           LD      B,$05               
4E99: 2E 07           LD      L,$07               
4E9B: 26 0F           LD      H,$0F               
4E9D: CD 52 51        CALL    $5152               ; {code.destroySlotsAndPlayerOnContact}
4EA0: CD B1 50        CALL    $50B1               ; {code.ramTestPlayerVsMotherShip}
4EA3: 06 03           LD      B,$03               
4EA5: 11 C0 A8        LD      DE,$A8C0            
4EA8: FD 21 28 AA     LD      IY,$AA28            
4EAC: 2E 06           LD      L,$06               
4EAE: 26 0D           LD      H,$0D               
4EB0: CD 21 51        CALL    $5121               ; {code.destroyTargetsReachedByFixedAttacker}
4EB3: 06 01           LD      B,$01               
4EB5: 2E 08           LD      L,$08               
4EB7: 26 11           LD      H,$11               
4EB9: C3 B3 51        JP      $51B3               ; {code.markObjectsTouchingPlayer}

; split the per-frame collision work by frame parity: on odd frames run
; the shot-vs-target sweeps (dispatchShotSweepByMotherShipArmed); on even
; frames run the player-vs-object collision chain, adding the mother-ship
; mutual-kill check (ramTestPlayerVsMotherShip) only while the mother ship
; is armed
splitCollisionWorkByFrameParity:
4EBC: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
4EBF: E6 01           AND     $01                 
4EC1: C2 35 4F        JP      NZ,$4F35            ; {code.dispatchShotSweepByMotherShipArmed}
4EC4: CD 7E 4F        CALL    $4F7E               ; {code.destroyFixedTargetHitByShots}
4EC7: 06 04           LD      B,$04               
4EC9: 11 10 A8        LD      DE,$A810            
4ECC: FD 21 12 AA     LD      IY,$AA12            
4ED0: 2E 05           LD      L,$05               
4ED2: 26 0B           LD      H,$0B               
4ED4: CD 85 51        CALL    $5185               ; {code.destroyPlayerAndObjectsTouchingIt}
4ED7: 3A 0D AD        LD      A,($AD0D)           ; {hard.workRam+50D}
4EDA: A7              AND     A                   
4EDB: 20 25           JR      NZ,$4F02            ; {code.loc_4f02}
4EDD: 06 07           LD      B,$07               
4EDF: 2E 07           LD      L,$07               
4EE1: 26 0F           LD      H,$0F               
4EE3: CD 52 51        CALL    $5152               ; {code.destroySlotsAndPlayerOnContact}
4EE6: CD 7E 50        CALL    $507E               ; {code.destroyFixedTargetReachedByPlayer}
4EE9: 06 01           LD      B,$01               
4EEB: 11 E0 A8        LD      DE,$A8E0            
4EEE: FD 21 2C AA     LD      IY,$AA2C            
4EF2: 2E 05           LD      L,$05               
4EF4: 26 0B           LD      H,$0B               
4EF6: CD 85 51        CALL    $5185               ; {code.destroyPlayerAndObjectsTouchingIt}
4EF9: 06 01           LD      B,$01               
4EFB: 2E 08           LD      L,$08               
4EFD: 26 11           LD      H,$11               
4EFF: C3 B3 51        JP      $51B3               ; {code.markObjectsTouchingPlayer}

loc_4f02:
4F02: 06 05           LD      B,$05               
4F04: 2E 07           LD      L,$07               
4F06: 26 0F           LD      H,$0F               
4F08: CD 52 51        CALL    $5152               ; {code.destroySlotsAndPlayerOnContact}
4F0B: CD B1 50        CALL    $50B1               ; {code.ramTestPlayerVsMotherShip}
4F0E: CD 7E 50        CALL    $507E               ; {code.destroyFixedTargetReachedByPlayer}
4F11: 06 01           LD      B,$01               
4F13: 11 E0 A8        LD      DE,$A8E0            
4F16: FD 21 2C AA     LD      IY,$AA2C            
4F1A: 2E 05           LD      L,$05               
4F1C: 26 0B           LD      H,$0B               
4F1E: CD 85 51        CALL    $5185               ; {code.destroyPlayerAndObjectsTouchingIt}
4F21: 06 01           LD      B,$01               
4F23: 2E 08           LD      L,$08               
4F25: 26 11           LD      H,$11               
4F27: C3 B3 51        JP      $51B3               ; {code.markObjectsTouchingPlayer}

; era-4 (ERA_INDEX 0xad04=4) per-frame collision dispatch split by frame
; parity (FRAME_TICK 0xa980), reached only as dispatchCollisionPassByEra's
; era-4 tail: even frames run the whole player-vs-object collision-and-
; destruction pass; odd frames stage one shot-vs-target sweep over the
; object-slot run at 0xa810/0xaa12 (six shots, box l=7/h=0x0f), restaging
; the shared body's two reload cursors 0xa991/0xa993 first -- while
; MOTHER_SHIP_ARMED (0xad0d) is set the run is nine long and a mother-ship
; mutual-kill pass (0x4fe0) follows, while clear the run is eleven long
; and none does
dispatchEra4CollisionByFrameParity:
4F2A: 3A 80 A9        LD      A,($A980)           ; {hard.workRam+180}
4F2D: E6 01           AND     $01                 
4F2F: CA 63 4E        JP      Z,$4E63             ; {code.runAllCollisionSweepsThisFrame}
4F32: C3 32 50        JP      $5032               ; {code.loc_5032}

; choose between the round's two shot sweeps and, on one of the two arms
; only, stage the full seven-target run: while MOTHER_SHIP_ARMED is set
; the sweep that also covers the standing object runs instead, and that
; sweep stages its own runs, so this entry gives it nothing but the
; branch; while the cell is clear the two cursor cells the shared sweep
; reloads between passes are staged here first, so every pass restarts on
; the run chosen here, and the shared sweep then runs six shots against
; seven targets inside one box. Both counts handed over are seven, so the
; first pass is no shorter than the rest
dispatchShotSweepByMotherShipArmed:
4F35: 3A 0D AD        LD      A,($AD0D)           ; {hard.workRam+50D}
4F38: A7              AND     A                   
4F39: C2 BF 4F        JP      NZ,$4FBF            ; {code.destroyCraftAndMotherShipHitByShots}
4F3C: 11 50 A8        LD      DE,$A850            
4F3F: FD 21 1A AA     LD      IY,$AA1A            
4F43: DD 21 80 AA     LD      IX,$AA80            
4F47: 08              EX      AF,AF'              
4F48: 3E 07           LD      A,$07               
4F4A: 47              LD      B,A                 
4F4B: 08              EX      AF,AF'              
4F4C: 0E 06           LD      C,$06               
4F4E: ED 53 93 A9     LD      ($A993),DE          ; {hard.workRam+193}
4F52: FD 22 91 A9     LD      ($A991),IY          ; {hard.workRam+191}
4F56: 2E 07           LD      L,$07               
4F58: 26 0F           LD      H,$0F               
4F5A: C3 11 52        JP      $5211               ; {code.destroyTargetsHitByShots}

; stage the two cursor cells and the eight fixed arguments -- the six-slot
; player shot run, a three-slot target run at a sixteen-byte stride, and a
; box seven by fifteen -- then tail-jump into destroyTargetsHitByShots,
; which does the destroying; choosing the runs is the whole of what this
; entry contributes
stagePlayerShotSweepAgainstTargetsAndRun:
4F5D: 11 C0 A8        LD      DE,$A8C0            
4F60: FD 21 28 AA     LD      IY,$AA28            
4F64: DD 21 80 AA     LD      IX,$AA80            
4F68: 08              EX      AF,AF'              
4F69: 3E 03           LD      A,$03               
4F6B: 47              LD      B,A                 
4F6C: 08              EX      AF,AF'              
4F6D: 0E 06           LD      C,$06               
4F6F: ED 53 93 A9     LD      ($A993),DE          ; {hard.workRam+193}
4F73: FD 22 91 A9     LD      ($A991),IY          ; {hard.workRam+191}
4F77: 2E 07           LD      L,$07               
4F79: 26 0F           LD      H,$0F               
4F7B: C3 11 52        JP      $5211               ; {code.destroyTargetsHitByShots}

; destroy the one fixed target the player's shots have reached, spending
; each shot that reached it and posting the score for each; the target's
; liveness is tested ONCE, ahead of the sweep, so several shots can be
; spent on it in a single pass
destroyFixedTargetHitByShots:
4F7E: 2E 06           LD      L,$06               
4F80: 26 0D           LD      H,$0D               
4F82: 1E 17           LD      E,$17               
4F84: 16 1F           LD      D,$1F               
4F86: FD 21 80 AA     LD      IY,$AA80            
4F8A: 06 06           LD      B,$06               
4F8C: 3A C0 A8        LD      A,($A8C0)           ; {hard.workRam+C0}
4F8F: 3C              INC     A                   
4F90: C0              RET     NZ                  

loc_4f91:
4F91: FD 7E 00        LD      A,(IY+$00)          
4F94: 3C              INC     A                   
4F95: 20 1F           JR      NZ,$4FB6            ; {code.loc_4fb6}
4F97: 3A 28 AA        LD      A,($AA28)           ; {hard.workRam+228}
4F9A: FD 96 06        SUB     (IY+$06)            
4F9D: 85              ADD     A,L                 
4F9E: BC              CP      H                   
4F9F: 30 15           JR      NC,$4FB6            ; {code.loc_4fb6}
4FA1: 3A 59 AA        LD      A,($AA59)           ; {hard.workRam+259}
4FA4: FD 96 04        SUB     (IY+$04)            
4FA7: 83              ADD     A,E                 
4FA8: BA              CP      D                   
4FA9: 30 0B           JR      NC,$4FB6            ; {code.loc_4fb6}
4FAB: 3E F0           LD      A,$F0               
4FAD: 32 C0 A8        LD      ($A8C0),A           ; {hard.workRam+C0}
4FB0: FD 77 00        LD      (IY+$00),A          
4FB3: CD DE 51        CALL    $51DE               ; {code.postChainedHitScore}

loc_4fb6:
4FB6: FD 7D           LD      A,IYL               
4FB8: C6 10           ADD     A,$10               
4FBA: FD 6F           LD      IYL,A               
4FBC: 10 D3           DJNZ    $4F91               ; {code.loc_4f91}
4FBE: C9              RET                         

; run the shot sweeps for the stretch of a round in which the Mother-Ship
; is on the field: stage the two cursor cells, sweep the six player shots
; against FIVE ordinary craft rather than the usual seven, then fall
; through into the sweep that runs the same six shots against the Mother-
; Ship's own state byte and screen position. Choosing the shorter craft
; run is the whole of what this entry adds
destroyCraftAndMotherShipHitByShots:
4FBF: 11 50 A8        LD      DE,$A850            
4FC2: FD 21 1A AA     LD      IY,$AA1A            
4FC6: DD 21 80 AA     LD      IX,$AA80            
4FCA: 08              EX      AF,AF'              
4FCB: 3E 05           LD      A,$05               
4FCD: 47              LD      B,A                 
4FCE: 08              EX      AF,AF'              
4FCF: 0E 06           LD      C,$06               
4FD1: ED 53 93 A9     LD      ($A993),DE          ; {hard.workRam+193}
4FD5: FD 22 91 A9     LD      ($A991),IY          ; {hard.workRam+191}
4FD9: 2E 07           LD      L,$07               
4FDB: 26 0F           LD      H,$0F               
4FDD: CD 11 52        CALL    $5211               ; {code.destroyTargetsHitByShots}

; sweep the six player-shot slots for one that has reached the single
; fixed two-slot target, mark both destroyed and post the score for each;
; the first-axis window is widened for two of the era values, by a data
; swap rather than a second body
destroyMotherShipAndShotOnMutualHit:
4FE0: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
4FE3: A7              AND     A                   
4FE4: 28 45           JR      Z,$502B             ; {code.loc_502b}
4FE6: FE 04           CP      $04                 
4FE8: 28 41           JR      Z,$502B             ; {code.loc_502b}
4FEA: 2E 06           LD      L,$06               
4FEC: 26 0D           LD      H,$0D               

loc_4fee:
4FEE: 1E 17           LD      E,$17               
4FF0: 16 1F           LD      D,$1F               
4FF2: FD 21 80 AA     LD      IY,$AA80            
4FF6: 06 06           LD      B,$06               
4FF8: 3A A0 A8        LD      A,($A8A0)           ; {hard.workRam+A0}
4FFB: 3C              INC     A                   
4FFC: C0              RET     NZ                  

loc_4ffd:
4FFD: FD 7E 00        LD      A,(IY+$00)          
5000: 3C              INC     A                   
5001: 20 1F           JR      NZ,$5022            ; {code.loc_5022}
5003: 3A 24 AA        LD      A,($AA24)           ; {hard.workRam+224}
5006: FD 96 06        SUB     (IY+$06)            
5009: 85              ADD     A,L                 
500A: BC              CP      H                   
500B: 30 15           JR      NC,$5022            ; {code.loc_5022}
500D: 3A 55 AA        LD      A,($AA55)           ; {hard.workRam+255}
5010: FD 96 04        SUB     (IY+$04)            
5013: 83              ADD     A,E                 
5014: BA              CP      D                   
5015: 30 0B           JR      NC,$5022            ; {code.loc_5022}
5017: 3E F0           LD      A,$F0               
5019: 32 A0 A8        LD      ($A8A0),A           ; {hard.workRam+A0}
501C: FD 77 00        LD      (IY+$00),A          
501F: CD DE 51        CALL    $51DE               ; {code.postChainedHitScore}

loc_5022:
5022: FD 7D           LD      A,IYL               
5024: C6 10           ADD     A,$10               
5026: FD 6F           LD      IYL,A               
5028: 10 D3           DJNZ    $4FFD               ; {code.loc_4ffd}
502A: C9              RET                         

loc_502b:
502B: 2E 08           LD      L,$08               
502D: 26 11           LD      H,$11               
502F: C3 EE 4F        JP      $4FEE               ; {code.loc_4fee}

loc_5032:
5032: 3A 0D AD        LD      A,($AD0D)           ; {hard.workRam+50D}
5035: A7              AND     A                   
5036: C2 5A 50        JP      NZ,$505A            ; {code.loc_505a}
5039: 11 10 A8        LD      DE,$A810            
503C: FD 21 12 AA     LD      IY,$AA12            
5040: DD 21 80 AA     LD      IX,$AA80            
5044: 08              EX      AF,AF'              
5045: 3E 0B           LD      A,$0B               
5047: 47              LD      B,A                 
5048: 08              EX      AF,AF'              
5049: 0E 06           LD      C,$06               
504B: ED 53 93 A9     LD      ($A993),DE          ; {hard.workRam+193}
504F: FD 22 91 A9     LD      ($A991),IY          ; {hard.workRam+191}
5053: 2E 07           LD      L,$07               
5055: 26 0F           LD      H,$0F               
5057: C3 11 52        JP      $5211               ; {code.destroyTargetsHitByShots}

loc_505a:
505A: 11 10 A8        LD      DE,$A810            
505D: FD 21 12 AA     LD      IY,$AA12            
5061: DD 21 80 AA     LD      IX,$AA80            
5065: 08              EX      AF,AF'              
5066: 3E 09           LD      A,$09               
5068: 47              LD      B,A                 
5069: 08              EX      AF,AF'              
506A: 0E 06           LD      C,$06               
506C: ED 53 93 A9     LD      ($A993),DE          ; {hard.workRam+193}
5070: FD 22 91 A9     LD      ($A991),IY          ; {hard.workRam+191}
5074: 2E 07           LD      L,$07               
5076: 26 0F           LD      H,$0F               
5078: CD 11 52        CALL    $5211               ; {code.destroyTargetsHitByShots}
507B: C3 E0 4F        JP      $4FE0               ; {code.destroyMotherShipAndShotOnMutualHit}

; destroy one fixed target and the player with it when the two touch, zero
; the target's HITS_REMAINING so the contact kills it outright rather than
; costing it a hit, and tail-transfer to the scoring routine; four tests
; must all pass, so nothing at all is written unless every one of them
; does
destroyFixedTargetReachedByPlayer:
507E: DD 21 10 AA     LD      IX,$AA10            
5082: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
5085: 3C              INC     A                   
5086: C0              RET     NZ                  
5087: 3A C0 A8        LD      A,($A8C0)           ; {hard.workRam+C0}
508A: 3C              INC     A                   
508B: C0              RET     NZ                  
508C: 3A 28 AA        LD      A,($AA28)           ; {hard.workRam+228}
508F: DD 96 00        SUB     (IX+$00)            
5092: C6 06           ADD     A,$06               
5094: FE 0D           CP      $0D                 
5096: D0              RET     NC                  
5097: 3A 59 AA        LD      A,($AA59)           ; {hard.workRam+259}
509A: DD 96 31        SUB     (IX+$31)            
509D: C6 18           ADD     A,$18               
509F: FE 21           CP      $21                 
50A1: D0              RET     NC                  
50A2: 3E F0           LD      A,$F0               
50A4: 32 00 A8        LD      ($A800),A           ; {hard.workRam}
50A7: 32 C0 A8        LD      ($A8C0),A           ; {hard.workRam+C0}
50AA: AF              XOR     A                   
50AB: 32 DC A8        LD      ($A8DC),A           ; {hard.workRam+DC}
50AE: C3 DE 51        JP      $51DE               ; {code.postChainedHitScore}

; select the collision box for the mutual kill of the player and one fixed
; two-slot target by ERA_INDEX: eras 0 and 4 transfer to the wider first-
; axis check (destroyPlayerAndMotherShipOnContact), the rest run the same
; destruction inline with a narrower first-axis window; when both are live
; and their coordinates fall in the box, mark both destroyed, clear the
; cell beside them, and tail-post the chained hit score
ramTestPlayerVsMotherShip:
50B1: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
50B4: A7              AND     A                   
50B5: 28 37           JR      Z,$50EE             ; {code.destroyPlayerAndMotherShipOnContact}
50B7: FE 04           CP      $04                 
50B9: 28 33           JR      Z,$50EE             ; {code.destroyPlayerAndMotherShipOnContact}
50BB: DD 21 10 AA     LD      IX,$AA10            
50BF: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
50C2: 3C              INC     A                   
50C3: C0              RET     NZ                  
50C4: 3A A0 A8        LD      A,($A8A0)           ; {hard.workRam+A0}
50C7: 3C              INC     A                   
50C8: C0              RET     NZ                  
50C9: 3A 24 AA        LD      A,($AA24)           ; {hard.workRam+224}
50CC: DD 96 00        SUB     (IX+$00)            
50CF: C6 06           ADD     A,$06               
50D1: FE 0D           CP      $0D                 
50D3: D0              RET     NC                  
50D4: 3A 55 AA        LD      A,($AA55)           ; {hard.workRam+255}
50D7: DD 96 31        SUB     (IX+$31)            
50DA: C6 19           ADD     A,$19               
50DC: FE 23           CP      $23                 
50DE: D0              RET     NC                  
50DF: 3E F0           LD      A,$F0               
50E1: 32 00 A8        LD      ($A800),A           ; {hard.workRam}
50E4: 32 A0 A8        LD      ($A8A0),A           ; {hard.workRam+A0}
50E7: AF              XOR     A                   
50E8: 32 A4 A8        LD      ($A8A4),A           ; {hard.workRam+A4}
50EB: C3 DE 51        JP      $51DE               ; {code.postChainedHitScore}

; ★ destroy the player and one fixed two-slot target together when they
; touch, zero that target's hit counter so the contact kills it outright
; instead of costing it one hit, and tail-transfer to the chained hit
; score; this is the wider of two first-axis windows, and the arm its
; caller selects for two of the era values
destroyPlayerAndMotherShipOnContact:
50EE: DD 21 10 AA     LD      IX,$AA10            
50F2: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
50F5: 3C              INC     A                   
50F6: C0              RET     NZ                  
50F7: 3A A0 A8        LD      A,($A8A0)           ; {hard.workRam+A0}
50FA: 3C              INC     A                   
50FB: C0              RET     NZ                  
50FC: 3A 24 AA        LD      A,($AA24)           ; {hard.workRam+224}
50FF: DD 96 00        SUB     (IX+$00)            
5102: C6 08           ADD     A,$08               
5104: FE 11           CP      $11                 
5106: D0              RET     NC                  
5107: 3A 55 AA        LD      A,($AA55)           ; {hard.workRam+255}
510A: DD 96 31        SUB     (IX+$31)            
510D: C6 19           ADD     A,$19               
510F: FE 23           CP      $23                 
5111: D0              RET     NC                  
5112: 3E F0           LD      A,$F0               
5114: 32 00 A8        LD      ($A800),A           ; {hard.workRam}
5117: 32 A0 A8        LD      ($A8A0),A           ; {hard.workRam+A0}
511A: AF              XOR     A                   
511B: 32 A4 A8        LD      ($A8A4),A           ; {hard.workRam+A4}
511E: C3 DE 51        JP      $51DE               ; {code.postChainedHitScore}

; destroy every target of a caller's run that one fixed attacker -- the
; player's own ship -- has reached, marking both destroyed and posting the
; chained score for each; the attacker's state is tested once, so one pass
; can take several
destroyTargetsReachedByFixedAttacker:
5121: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
5124: 3C              INC     A                   
5125: C0              RET     NZ                  

loc_5126:
5126: 1A              LD      A,(DE)              
5127: 3C              INC     A                   
5128: 20 1D           JR      NZ,$5147            ; {code.loc_5147}
512A: 3A 10 AA        LD      A,($AA10)           ; {hard.workRam+210}
512D: FD 96 00        SUB     (IY+$00)            
5130: 85              ADD     A,L                 
5131: BC              CP      H                   
5132: 30 13           JR      NC,$5147            ; {code.loc_5147}
5134: 3A 41 AA        LD      A,($AA41)           ; {hard.workRam+241}
5137: FD 96 31        SUB     (IY+$31)            
513A: 85              ADD     A,L                 
513B: BC              CP      H                   
513C: 30 09           JR      NC,$5147            ; {code.loc_5147}
513E: 3E F0           LD      A,$F0               
5140: 32 00 A8        LD      ($A800),A           ; {hard.workRam}
5143: 12              LD      (DE),A              
5144: CD DE 51        CALL    $51DE               ; {code.postChainedHitScore}

loc_5147:
5147: 7B              LD      A,E                 
5148: C6 10           ADD     A,$10               
514A: 5F              LD      E,A                 
514B: FD 23           INC     IY                  
514D: FD 23           INC     IY                  
514F: 10 D5           DJNZ    $5126               ; {code.loc_5126}
5151: C9              RET                         

; sweep a run of slots against the player's own sprite entry and, for
; every overlap, write the destroyed marker into both the slot and the
; player and post the score; the sweep does not stop at the first
destroySlotsAndPlayerOnContact:
5152: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
5155: 3C              INC     A                   
5156: C0              RET     NZ                  

loc_5157:
5157: 1A              LD      A,(DE)              
5158: 3C              INC     A                   
5159: 20 1F           JR      NZ,$517A            ; {code.loc_517a}
515B: 3A 10 AA        LD      A,($AA10)           ; {hard.workRam+210}
515E: FD 96 00        SUB     (IY+$00)            
5161: 85              ADD     A,L                 
5162: BC              CP      H                   
5163: 30 15           JR      NC,$517A            ; {code.loc_517a}
5165: 3A 41 AA        LD      A,($AA41)           ; {hard.workRam+241}
5168: FD 96 31        SUB     (IY+$31)            
516B: C6 08           ADD     A,$08               
516D: FE 11           CP      $11                 
516F: 30 09           JR      NC,$517A            ; {code.loc_517a}
5171: 3E F0           LD      A,$F0               
5173: 32 00 A8        LD      ($A800),A           ; {hard.workRam}
5176: 12              LD      (DE),A              
5177: CD DE 51        CALL    $51DE               ; {code.postChainedHitScore}

loc_517a:
517A: 7B              LD      A,E                 
517B: C6 10           ADD     A,$10               
517D: 5F              LD      E,A                 
517E: FD 23           INC     IY                  
5180: FD 23           INC     IY                  
5182: 10 D3           DJNZ    $5157               ; {code.loc_5157}
5184: C9              RET                         

; destroy the player and every object of a caller's run that lies inside a
; wrapped box around the player's sprite entry, while the player is alive;
; one window width serves both axes, nothing is scored, and the sweep runs
; on past the first
destroyPlayerAndObjectsTouchingIt:
5185: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
5188: 3C              INC     A                   
5189: C0              RET     NZ                  

loc_518a:
518A: 1A              LD      A,(DE)              
518B: 3C              INC     A                   
518C: 20 1A           JR      NZ,$51A8            ; {code.loc_51a8}
518E: 3A 10 AA        LD      A,($AA10)           ; {hard.workRam+210}
5191: FD 96 00        SUB     (IY+$00)            
5194: 85              ADD     A,L                 
5195: BC              CP      H                   
5196: 30 10           JR      NC,$51A8            ; {code.loc_51a8}
5198: 3A 41 AA        LD      A,($AA41)           ; {hard.workRam+241}
519B: FD 96 31        SUB     (IY+$31)            
519E: 85              ADD     A,L                 
519F: BC              CP      H                   
51A0: 30 06           JR      NC,$51A8            ; {code.loc_51a8}
51A2: 3E F0           LD      A,$F0               
51A4: 32 00 A8        LD      ($A800),A           ; {hard.workRam}
51A7: 12              LD      (DE),A              

loc_51a8:
51A8: 7B              LD      A,E                 
51A9: C6 10           ADD     A,$10               
51AB: 5F              LD      E,A                 
51AC: FD 23           INC     IY                  
51AE: FD 23           INC     IY                  
51B0: 10 D8           DJNZ    $518A               ; {code.loc_518a}
51B2: C9              RET                         

; replace the state byte of every object in a caller's run that lies
; inside a wrapped box around the player's sprite entry, while the player
; is alive; the box is the caller's, the player's own state is untouched
; and nothing is scored
markObjectsTouchingPlayer:
51B3: 3A 00 A8        LD      A,($A800)           ; {hard.workRam}
51B6: 3C              INC     A                   
51B7: C0              RET     NZ                  

loc_51b8:
51B8: 1A              LD      A,(DE)              
51B9: 3C              INC     A                   
51BA: 20 17           JR      NZ,$51D3            ; {code.loc_51d3}
51BC: 3A 10 AA        LD      A,($AA10)           ; {hard.workRam+210}
51BF: FD 96 00        SUB     (IY+$00)            
51C2: 85              ADD     A,L                 
51C3: BC              CP      H                   
51C4: 30 0D           JR      NC,$51D3            ; {code.loc_51d3}
51C6: 3A 41 AA        LD      A,($AA41)           ; {hard.workRam+241}
51C9: FD 96 31        SUB     (IY+$31)            
51CC: 85              ADD     A,L                 
51CD: BC              CP      H                   
51CE: 30 03           JR      NC,$51D3            ; {code.loc_51d3}
51D0: 3E F0           LD      A,$F0               
51D2: 12              LD      (DE),A              

loc_51d3:
51D3: 7B              LD      A,E                 
51D4: C6 10           ADD     A,$10               
51D6: 5F              LD      E,A                 
51D7: FD 23           INC     IY                  
51D9: FD 23           INC     IY                  
51DB: 10 DB           DJNZ    $51B8               ; {code.loc_51b8}
51DD: C9              RET                         

; post a scoring command to the ring, stepping the award up while
; consecutive hits keep landing inside the chain window and wrapping back
; round after the eighth
postChainedHitScore:
51DE: D5              PUSH    DE                  
51DF: 3A 9D A9        LD      A,($A99D)           ; {hard.workRam+19D}
51E2: A7              AND     A                   
51E3: 28 15           JR      Z,$51FA             ; {code.loc_51fa}
51E5: 3A 9E A9        LD      A,($A99E)           ; {hard.workRam+19E}
51E8: 3C              INC     A                   
51E9: 32 9E A9        LD      ($A99E),A           ; {hard.workRam+19E}
51EC: E6 07           AND     $07                 
51EE: 3C              INC     A                   
51EF: 5F              LD      E,A                 
51F0: 16 04           LD      D,$04               
51F2: FF              RST     $38                 
51F3: D1              POP     DE                  
51F4: 3E 1E           LD      A,$1E               
51F6: 32 9D A9        LD      ($A99D),A           ; {hard.workRam+19D}
51F9: C9              RET                         

loc_51fa:
51FA: 11 01 04        LD      DE,$0401            
51FD: FF              RST     $38                 
51FE: D1              POP     DE                  
51FF: 3E 1E           LD      A,$1E               
5201: 32 9D A9        LD      ($A99D),A           ; {hard.workRam+19D}
5204: C9              RET                         

; run the chained-hit window down by one and, on every frame after it has
; reached zero, clear the chain step so the next hit starts the award
; ladder from the bottom again
expireHitChain:
5205: 21 9D A9        LD      HL,$A99D            
5208: 7E              LD      A,(HL)              
5209: A7              AND     A                   
520A: 28 02           JR      Z,$520E             ; {code.loc_520e}
520C: 35              DEC     (HL)                
520D: C9              RET                         

loc_520e:
520E: 2C              INC     L                   
520F: 77              LD      (HL),A              
5210: C9              RET                         

; destroy every target a live shot has reached, spending the shot with
; them, and post the score for each; the sweep does not stop at the first,
; so one shot can take several in a pass
destroyTargetsHitByShots:
5211: DD 7E 00        LD      A,(IX+$00)          
5214: 3C              INC     A                   
5215: 20 3D           JR      NZ,$5254            ; {code.loc_5254}

loc_5217:
5217: 1A              LD      A,(DE)              
5218: 3C              INC     A                   
5219: 20 2F           JR      NZ,$524A            ; {code.loc_524a}
521B: FD 7E 00        LD      A,(IY+$00)          
521E: C6 08           ADD     A,$08               
5220: FE 19           CP      $19                 
5222: 38 26           JR      C,$524A             ; {code.loc_524a}
5224: FD 7E 31        LD      A,(IY+$31)          
5227: C6 10           ADD     A,$10               
5229: FE 11           CP      $11                 
522B: 38 1D           JR      C,$524A             ; {code.loc_524a}
522D: DD 7E 06        LD      A,(IX+$06)          
5230: FD 96 00        SUB     (IY+$00)            
5233: 85              ADD     A,L                 
5234: BC              CP      H                   
5235: 30 13           JR      NC,$524A            ; {code.loc_524a}
5237: DD 7E 04        LD      A,(IX+$04)          
523A: FD 96 31        SUB     (IY+$31)            
523D: 85              ADD     A,L                 
523E: BC              CP      H                   
523F: 30 09           JR      NC,$524A            ; {code.loc_524a}
5241: 3E F0           LD      A,$F0               
5243: DD 77 00        LD      (IX+$00),A          
5246: 12              LD      (DE),A              
5247: CD DE 51        CALL    $51DE               ; {code.postChainedHitScore}

loc_524a:
524A: 7B              LD      A,E                 
524B: C6 10           ADD     A,$10               
524D: 5F              LD      E,A                 
524E: FD 23           INC     IY                  
5250: FD 23           INC     IY                  
5252: 10 C3           DJNZ    $5217               ; {code.loc_5217}

loc_5254:
5254: FD 2A 91 A9     LD      IY,($A991)          ; {hard.workRam+191}
5258: ED 5B 93 A9     LD      DE,($A993)          ; {hard.workRam+193}
525C: 08              EX      AF,AF'              
525D: 47              LD      B,A                 
525E: 08              EX      AF,AF'              
525F: DD 7D           LD      A,IXL               
5261: C6 10           ADD     A,$10               
5263: DD 6F           LD      IXL,A               
5265: 0D              DEC     C                   
5266: C2 11 52        JP      NZ,$5211            ; {code.destroyTargetsHitByShots}
5269: C9              RET                         

; put both deferred character-cell lists back to empty, parking each
; cursor four bytes past its own head
emptyBothDeferredCellLists:
526A: 21 84 AE        LD      HL,$AE84            
526D: 22 80 AE        LD      ($AE80),HL          ; {hard.workRam+680}
5270: 21 04 AE        LD      HL,$AE04            
5273: 22 00 AE        LD      ($AE00),HL          ; {hard.workRam+600}
5276: C9              RET                         

; ---- $5277-$5285: data ----
5277: 06 00 21 DE 27 AF 86 23 10 FC D6 C5 C4 D4 53

; one pass of the deferred cell machinery: blank the cells the erase list
; names, paint the cells the pending list names, then copy the pending
; list wholesale onto the erase list and park the pending cursor back on
; its own first entry. The copy length is the pending cursor's own byte,
; cursor included, so it lands the pending count on top of the erase
; cursor and the line after replaces that with the same count plus a mark
; in the top bit; where nothing is pending both cursors are parked instead
; and no copy happens; and a cursor of ZERO is not nothing pending -- the
; count is a block-copy length, and a length of zero means the whole
; address space. ★ NOT a double buffer: the copy runs one way, 0xAE00 onto
; 0xAE80, on every pass, and the two lists hold different jobs rather than
; alternating ones
drainBothDeferredCellLists:
5286: CD 0E 53        CALL    $530E               ; {code.blankCellsPaintedLastPass}
5289: CD D2 52        CALL    $52D2               ; {code.paintDeferredCells}
528C: 3A 00 AE        LD      A,($AE00)           ; {hard.workRam+600}
528F: FE 04           CP      $04                 
5291: 28 D7           JR      Z,$526A             ; {code.emptyBothDeferredCellLists}
5293: 4F              LD      C,A                 
5294: 06 00           LD      B,$00               
5296: 21 00 AE        LD      HL,$AE00            
5299: 11 80 AE        LD      DE,$AE80            
529C: ED B0           LDIR                        
529E: C6 80           ADD     A,$80               
52A0: 32 80 AE        LD      ($AE80),A           ; {hard.workRam+680}
52A3: 21 04 AE        LD      HL,$AE04            
52A6: 22 00 AE        LD      ($AE00),HL          ; {hard.workRam+600}
52A9: C9              RET                         

; boot-time DIP seed: copy two ROM defaults into their cells
; (0x08c9->0xa98d, 0x0874->KILL_QUOTA), store DSW0 complemented as
; COINAGE_SETTINGS and unpack the coin ratios, then turn DSW1's low two
; bits into a lives count (3/4/5, or 0xff when they fold to none) and
; tail-jump with it plus the whole complemented bank into the switch-
; settings peeler; never returns
seedGameConfigFromDipSwitches:
52AA: 3A C9 08        LD      A,($08C9)           ; {hard.rom+8C9}
52AD: 32 8D A9        LD      ($A98D),A           ; {hard.workRam+18D}
52B0: 3A 74 08        LD      A,($0874)           ; {hard.rom+874}
52B3: 32 CD A9        LD      ($A9CD),A           ; {hard.workRam+1CD}
52B6: 3A 60 C3        LD      A,($C360)           
52B9: 2F              CPL                         
52BA: 32 B1 A9        LD      ($A9B1),A           ; {hard.workRam+1B1}
52BD: CD CC 4A        CALL    $4ACC               ; {code.unpackCoinage}
52C0: 3A 00 C2        LD      A,($C200)           
52C3: 2F              CPL                         
52C4: 4F              LD      C,A                 
52C5: E6 03           AND     $03                 
52C7: C6 03           ADD     A,$03               
52C9: FE 06           CP      $06                 
52CB: 20 02           JR      NZ,$52CF            ; {code.loc_52cf}
52CD: 3E FF           LD      A,$FF               

loc_52cf:
52CF: C3 19 2E        JP      $2E19               ; {code.unpackTheFirstThreeSwitchSettings}

; paint the deferred cell list into the character plane and its colour
; plane: each four-byte entry gives a colour-plane address, the shape to
; put a plane above it and the colour to put at it, with one shared bias
; added to every colour. How many are pending comes off the low half of
; the list's own write cursor, so the whole list lives inside one page; an
; entry whose colour cell already has the high-priority bit set is passed
; over untouched, and a cursor that scales to a count of zero is not empty
; -- the loop runs 256 times
paintDeferredCells:
52D2: 3A 0C AD        LD      A,($AD0C)           ; {hard.workRam+50C}
52D5: E6 0F           AND     $0F                 
52D7: 4F              LD      C,A                 
52D8: 2A 00 AE        LD      HL,($AE00)          ; {hard.workRam+600}
52DB: 7D              LD      A,L                 
52DC: D6 04           SUB     $04                 
52DE: C8              RET     Z                   
52DF: 0F              RRCA                        
52E0: 0F              RRCA                        
52E1: E6 1F           AND     $1F                 
52E3: 47              LD      B,A                 
52E4: 21 04 AE        LD      HL,$AE04            

loc_52e7:
52E7: 5E              LD      E,(HL)              
52E8: 2C              INC     L                   
52E9: 56              LD      D,(HL)              
52EA: 2C              INC     L                   
52EB: 1A              LD      A,(DE)              
52EC: E6 10           AND     $10                 
52EE: 20 0E           JR      NZ,$52FE            ; {code.loc_52fe}
52F0: 7E              LD      A,(HL)              
52F1: CB D2           SET     2,D                 
52F3: 12              LD      (DE),A              
52F4: CB 92           RES     2,D                 
52F6: 2C              INC     L                   
52F7: 7E              LD      A,(HL)              
52F8: 2C              INC     L                   
52F9: 81              ADD     A,C                 
52FA: 12              LD      (DE),A              
52FB: 10 EA           DJNZ    $52E7               ; {code.loc_52e7}
52FD: C9              RET                         

loc_52fe:
52FE: 2C              INC     L                   
52FF: 2C              INC     L                   
5300: 10 E5           DJNZ    $52E7               ; {code.loc_52e7}
5302: C9              RET                         

; run the image-checksum tamper test and relay by its verdict: present the
; carried checksum, step the attract sequence on the one genuine value,
; else spring the tamper trap
advanceSequenceUnlessImageTampered:
5303: CD 0C 20        CALL    $200C               ; {code.presentChecksumForTamperTest}
5306: FE 67           CP      $67                 
5308: C2 8D 0F        JP      NZ,$0F8D            ; {code.loc_0f8d}
530B: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; blank the character-plane cells the previous pass painted: walk the
; second deferred cell list, which the shared caller filled by copying the
; paint list wholesale after draining it, and write the blank shape a
; plane above each entry's address, leaving the colour byte exactly as it
; was. The pending count comes off the masked low half of that list's own
; cursor -- the mask drops the top bit the caller sets when it copies --
; and an entry whose colour cell already has the high-priority bit set is
; passed over
blankCellsPaintedLastPass:
530E: 2A 80 AE        LD      HL,($AE80)          ; {hard.workRam+680}
5311: 7D              LD      A,L                 
5312: E6 7F           AND     $7F                 
5314: D6 04           SUB     $04                 
5316: C8              RET     Z                   
5317: 0F              RRCA                        
5318: 0F              RRCA                        
5319: E6 1F           AND     $1F                 
531B: 47              LD      B,A                 
531C: 21 84 AE        LD      HL,$AE84            

loc_531f:
531F: 5E              LD      E,(HL)              
5320: 2C              INC     L                   
5321: 56              LD      D,(HL)              
5322: 2C              INC     L                   
5323: 1A              LD      A,(DE)              
5324: E6 10           AND     $10                 
5326: 20 0A           JR      NZ,$5332            ; {code.loc_5332}
5328: 2C              INC     L                   
5329: 2C              INC     L                   
532A: CB D2           SET     2,D                 
532C: 3E 20           LD      A,$20               
532E: 12              LD      (DE),A              
532F: 10 EE           DJNZ    $531F               ; {code.loc_531f}
5331: C9              RET                         

loc_5332:
5332: 2C              INC     L                   
5333: 2C              INC     L                   
5334: 10 E9           DJNZ    $531F               ; {code.loc_531f}
5336: C9              RET                         

; queue a two-by-two block of character cells for an object's position
; onto the deferred write list, one four-byte entry per cell, skipping a
; pair whose glyph is zero
queueTileStampForObject:
5337: DD 7E 04        LD      A,(IX+$04)          
533A: C6 07           ADD     A,$07               
533C: 47              LD      B,A                 
533D: 16 28           LD      D,$28               
533F: 07              RLCA                        
5340: CB 12           RL      D                   
5342: 07              RLCA                        
5343: CB 12           RL      D                   
5345: E6 E0           AND     $E0                 
5347: 5F              LD      E,A                 
5348: DD 7E 06        LD      A,(IX+$06)          
534B: C6 07           ADD     A,$07               
534D: 4F              LD      C,A                 
534E: 0F              RRCA                        
534F: 0F              RRCA                        
5350: 0F              RRCA                        
5351: E6 1F           AND     $1F                 
5353: 83              ADD     A,E                 
5354: 5F              LD      E,A                 
5355: 79              LD      A,C                 
5356: 07              RLCA                        
5357: 07              RLCA                        
5358: 07              RLCA                        
5359: E6 38           AND     $38                 
535B: 4F              LD      C,A                 
535C: 78              LD      A,B                 
535D: 06 00           LD      B,$00               
535F: CB 57           BIT     2,A                 
5361: 28 01           JR      Z,$5364             ; {code.loc_5364}
5363: 04              INC     B                   

loc_5364:
5364: 0F              RRCA                        
5365: 0F              RRCA                        
5366: E6 C0           AND     $C0                 
5368: 81              ADD     A,C                 
5369: 4F              LD      C,A                 
536A: 21 D4 53        LD      HL,$53D4            
536D: 09              ADD     HL,BC               
536E: 7E              LD      A,(HL)              
536F: 23              INC     HL                  
5370: 46              LD      B,(HL)              
5371: 23              INC     HL                  
5372: A7              AND     A                   
5373: 28 10           JR      Z,$5385             ; {code.loc_5385}
5375: E5              PUSH    HL                  
5376: 2A 00 AE        LD      HL,($AE00)          ; {hard.workRam+600}
5379: 73              LD      (HL),E              
537A: 2C              INC     L                   
537B: 72              LD      (HL),D              
537C: 2C              INC     L                   
537D: 77              LD      (HL),A              
537E: 2C              INC     L                   
537F: 70              LD      (HL),B              
5380: 2C              INC     L                   
5381: 22 00 AE        LD      ($AE00),HL          ; {hard.workRam+600}
5384: E1              POP     HL                  

loc_5385:
5385: 13              INC     DE                  
5386: 7E              LD      A,(HL)              
5387: 23              INC     HL                  
5388: 46              LD      B,(HL)              
5389: 23              INC     HL                  
538A: A7              AND     A                   
538B: 28 10           JR      Z,$539D             ; {code.loc_539d}
538D: E5              PUSH    HL                  
538E: 2A 00 AE        LD      HL,($AE00)          ; {hard.workRam+600}
5391: 73              LD      (HL),E              
5392: 2C              INC     L                   
5393: 72              LD      (HL),D              
5394: 2C              INC     L                   
5395: 77              LD      (HL),A              
5396: 2C              INC     L                   
5397: 70              LD      (HL),B              
5398: 2C              INC     L                   
5399: 22 00 AE        LD      ($AE00),HL          ; {hard.workRam+600}
539C: E1              POP     HL                  

loc_539d:
539D: 7B              LD      A,E                 
539E: C6 1F           ADD     A,$1F               
53A0: 5F              LD      E,A                 
53A1: 30 01           JR      NC,$53A4            ; {code.loc_53a4}
53A3: 14              INC     D                   

loc_53a4:
53A4: 7E              LD      A,(HL)              
53A5: 23              INC     HL                  
53A6: 46              LD      B,(HL)              
53A7: 23              INC     HL                  
53A8: A7              AND     A                   
53A9: 28 10           JR      Z,$53BB             ; {code.loc_53bb}
53AB: E5              PUSH    HL                  
53AC: 2A 00 AE        LD      HL,($AE00)          ; {hard.workRam+600}
53AF: 73              LD      (HL),E              
53B0: 2C              INC     L                   
53B1: 72              LD      (HL),D              
53B2: 2C              INC     L                   
53B3: 77              LD      (HL),A              
53B4: 2C              INC     L                   
53B5: 70              LD      (HL),B              
53B6: 2C              INC     L                   
53B7: 22 00 AE        LD      ($AE00),HL          ; {hard.workRam+600}
53BA: E1              POP     HL                  

loc_53bb:
53BB: 13              INC     DE                  
53BC: 7E              LD      A,(HL)              
53BD: 23              INC     HL                  
53BE: 46              LD      B,(HL)              
53BF: 23              INC     HL                  
53C0: A7              AND     A                   
53C1: 28 10           JR      Z,$53D3             ; {code.loc_53d3}
53C3: E5              PUSH    HL                  
53C4: 2A 00 AE        LD      HL,($AE00)          ; {hard.workRam+600}
53C7: 73              LD      (HL),E              
53C8: 2C              INC     L                   
53C9: 72              LD      (HL),D              
53CA: 2C              INC     L                   
53CB: 77              LD      (HL),A              
53CC: 2C              INC     L                   
53CD: 70              LD      (HL),B              
53CE: 2C              INC     L                   
53CF: 22 00 AE        LD      ($AE00),HL          ; {hard.workRam+600}
53D2: E1              POP     HL                  

loc_53d3:
53D3: C9              RET                         

; ---- $53D4-$55D3: data ----
53D4: 24 20 00 00 00 00 00 00 DD 20 00 00 00 00 00 00
53E4: 61 20 00 00 00 00 00 00 3C 20 00 00 00 00 00 00
53F4: 61 60 00 00 00 00 00 00 DD 60 00 00 00 00 00 00
5404: 24 60 00 00 00 00 00 00 39 20 39 60 00 00 00 00
5414: 30 20 00 00 00 00 00 00 A1 20 00 00 00 00 00 00
5424: B7 20 00 00 00 00 00 00 D0 20 00 00 00 00 00 00
5434: B7 60 00 00 00 00 00 00 A1 60 00 00 00 00 00 00
5444: 30 60 00 00 00 00 00 00 6D 20 6D 60 00 00 00 00
5454: 40 20 00 00 00 00 00 00 34 20 00 00 00 00 00 00
5464: 2B 20 00 00 00 00 00 00 B1 20 00 00 00 00 00 00
5474: 2B 60 00 00 00 00 00 00 34 60 00 00 00 00 00 00
5484: 40 60 00 00 00 00 00 00 8E 20 8E 60 00 00 00 00
5494: 74 20 00 00 00 00 00 00 54 20 00 00 00 00 00 00
54A4: 4C 20 00 00 00 00 00 00 2D 20 00 00 00 00 00 00
54B4: 4C 60 00 00 00 00 00 00 54 60 00 00 00 00 00 00
54C4: 74 60 00 00 00 00 00 00 D5 20 D5 60 00 00 00 00
54D4: 40 A0 00 00 00 00 00 00 34 A0 00 00 00 00 00 00
54E4: 2B A0 00 00 00 00 00 00 B1 A0 00 00 00 00 00 00
54F4: 2B E0 00 00 00 00 00 00 34 E0 00 00 00 00 00 00
5504: 40 E0 00 00 00 00 00 00 8E A0 8E E0 00 00 00 00
5514: 30 A0 00 00 00 00 00 00 A1 A0 00 00 00 00 00 00
5524: B7 A0 00 00 00 00 00 00 D0 A0 00 00 00 00 00 00
5534: B7 E0 00 00 00 00 00 00 A1 E0 00 00 00 00 00 00
5544: 30 E0 00 00 00 00 00 00 6D A0 6D E0 00 00 00 00
5554: 24 A0 00 00 00 00 00 00 DD A0 00 00 00 00 00 00
5564: 61 A0 00 00 00 00 00 00 3C A0 00 00 00 00 00 00
5574: 61 E0 00 00 00 00 00 00 DD E0 00 00 00 00 00 00
5584: 24 E0 00 00 00 00 00 00 39 A0 39 E0 00 00 00 00
5594: 3A 20 00 00 3A A0 00 00 8F 20 00 00 8F A0 00 00
55A4: 70 20 00 00 70 A0 00 00 66 20 00 00 66 A0 00 00
55B4: 70 60 00 00 70 E0 00 00 8F 60 00 00 8F E0 00 00
55C4: 3A 60 00 00 3A E0 00 00 C7 20 C7 60 C7 A0 C7 E0

; send the byte at the head of the pending-sound queue, then close the gap
; it left: a count cell at 0xAC43 says how many bytes are waiting and the
; bytes follow it from 0xAC44, and a count of zero is left untouched with
; nothing going out. Otherwise the count comes down by one, the head byte
; goes out, and every byte still waiting slides one place down so the head
; slot always holds the next one. The send happens whether or not anything
; is left to slide, so emptying the queue costs no slide; and nothing
; bounds the count, so a large one slides bytes in from past the queue's
; own cells
sendOldestQueuedSoundCommand:
55D4: 21 43 AC        LD      HL,$AC43            
55D7: 7E              LD      A,(HL)              
55D8: A7              AND     A                   
55D9: C8              RET     Z                   
55DA: 35              DEC     (HL)                
55DB: F5              PUSH    AF                  
55DC: 23              INC     HL                  
55DD: 7E              LD      A,(HL)              
55DE: CD F8 55        CALL    $55F8               ; {code.sendSoundCommand}
55E1: F1              POP     AF                  
55E2: C8              RET     Z                   
55E3: 3D              DEC     A                   
55E4: 06 00           LD      B,$00               
55E6: 4F              LD      C,A                 
55E7: 5D              LD      E,L                 
55E8: 54              LD      D,H                 
55E9: 23              INC     HL                  
55EA: ED B0           LDIR                        
55EC: C9              RET                         

; ---- $55ED-$55F7: data ----
55ED: 73 A6 14 7E 29 F8 96 5D 17 9B B9

; hand one byte to the audio processor: write it into the one-byte latch
; that processor reads, then drive its attention line high and back low,
; the edge that makes it look
sendSoundCommand:
55F8: 32 00 C0        LD      ($C000),A           
55FB: 3E 01           LD      A,$01               
55FD: 32 04 C3        LD      ($C304),A           
5600: 00              NOP                         
5601: 00              NOP                         
5602: 00              NOP                         
5603: 00              NOP                         
5604: 00              NOP                         
5605: 00              NOP                         
5606: 3E 00           LD      A,$00               
5608: 32 04 C3        LD      ($C304),A           
560B: C9              RET                         

; queue a sound code, but only while a game is being played; with the play
; flag clear the request is dropped and nothing is left behind for a later
; frame
enqueueSoundIfGameInProgress:
560C: E5              PUSH    HL                  
560D: F5              PUSH    AF                  
560E: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
5611: A7              AND     A                   
5612: 20 16           JR      NZ,$562A            ; {code.loc_562a}
5614: F1              POP     AF                  
5615: E1              POP     HL                  
5616: C9              RET                         

; queue a sound code when either the play flag or the cell at 0xA9C6 is
; set; only with both clear is the request dropped
enqueueSoundIfGameOrAttract:
5617: E5              PUSH    HL                  
5618: F5              PUSH    AF                  
5619: 3A 30 AD        LD      A,($AD30)           ; {hard.workRam+530}
561C: A7              AND     A                   
561D: 20 0B           JR      NZ,$562A            ; {code.loc_562a}
561F: 3A C6 A9        LD      A,($A9C6)           ; {hard.workRam+1C6}
5622: A7              AND     A                   
5623: 20 05           JR      NZ,$562A            ; {code.loc_562a}
5625: F1              POP     AF                  
5626: E1              POP     HL                  
5627: C9              RET                         

; queue a sound code with no permission test, so it is queued whether or
; not a game is being played
enqueueSoundUnconditional:
5628: E5              PUSH    HL                  
5629: F5              PUSH    AF                  

loc_562a:
562A: 21 43 AC        LD      HL,$AC43            
562D: 34              INC     (HL)                
562E: 7E              LD      A,(HL)              
562F: CF              RST     $08                 
5630: F1              POP     AF                  
5631: 77              LD      (HL),A              
5632: E1              POP     HL                  
5633: C9              RET                         

loc_5634:
5634: 3A 7C 16        LD      A,($167C)           ; {hard.rom+167C}
5637: CD 28 56        CALL    $5628               ; {code.enqueueSoundUnconditional}
563A: 3A 9C 0A        LD      A,($0A9C)           ; {hard.rom+A9C}
563D: CD 28 56        CALL    $5628               ; {code.enqueueSoundUnconditional}
5640: 3A 84 14        LD      A,($1484)           ; {hard.rom+1484}
5643: CD 28 56        CALL    $5628               ; {code.enqueueSoundUnconditional}
5646: 3A 78 0C        LD      A,($0C78)           ; {hard.rom+C78}
5649: CD 28 56        CALL    $5628               ; {code.enqueueSoundUnconditional}
564C: 3A D3 07        LD      A,($07D3)           ; {hard.rom+7D3}
564F: CD 28 56        CALL    $5628               ; {code.enqueueSoundUnconditional}
5652: 3A B4 33        LD      A,($33B4)           ; {hard.rom+33B4}
5655: CD 28 56        CALL    $5628               ; {code.enqueueSoundUnconditional}
5658: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
565B: C6 8C           ADD     A,$8C               
565D: 18 C9           JR      $5628               ; {code.enqueueSoundUnconditional}

; read the byte at 0x07A2 and request it as a sound code, only while a
; game is being played
requestEnemyLaunchSound:
565F: 3A A2 07        LD      A,($07A2)           ; {hard.rom+7A2}
5662: 18 A8           JR      $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x16DE and request it as a sound code, only while a
; game is being played
requestAttackerSpawnSoundEra0:
5664: 3A DE 16        LD      A,($16DE)           ; {hard.rom+16DE}
5667: 18 A3           JR      $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x4C9F and request it as a sound code, only while a
; game is being played
requestEnemyLaunchSoundLateEra:
5669: 3A 9F 4C        LD      A,($4C9F)           ; {hard.rom+4C9F}
566C: 18 9E           JR      $560C               ; {code.enqueueSoundIfGameInProgress}

; ask for two sounds in a row, each code fetched from its own byte of the
; program image, both admitted only while a game is being played
requestTwoSoundsWhilePlaying:
566E: 3A D8 07        LD      A,($07D8)           ; {hard.rom+7D8}
5671: CD 0C 56        CALL    $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x276B and request it as a sound code, only while a
; game is being played
requestAttackerSpawnSoundLateEra:
5674: 3A 6B 27        LD      A,($276B)           ; {hard.rom+276B}
5677: 18 93           JR      $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x07FE and request it as a sound code, only while a
; game is being played
requestLateEraProgressSound:
5679: 3A FE 07        LD      A,($07FE)           ; {hard.rom+7FE}
567C: 18 8E           JR      $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x3270 and request it as a sound code, admitted while a
; game is being played or the cell at 0xA9C6 is set
requestPlayerShotSound:
567E: 3A 70 32        LD      A,($3270)           ; {hard.rom+3270}
5681: 18 94           JR      $5617               ; {code.enqueueSoundIfGameOrAttract}

; request two sounds in a row, each code fetched from its own byte of the
; program image, both admitted by the shared play-or-demo permission
requestTwoSounds:
5683: 3A A6 07        LD      A,($07A6)           ; {hard.rom+7A6}
5686: CD 17 56        CALL    $5617               ; {code.enqueueSoundIfGameOrAttract}
5689: 3A DA 4C        LD      A,($4CDA)           ; {hard.rom+4CDA}
568C: 18 89           JR      $5617               ; {code.enqueueSoundIfGameOrAttract}

loc_568e:
568E: 3A 87 2D        LD      A,($2D87)           ; {hard.rom+2D87}
5691: C3 0C 56        JP      $560C               ; {code.enqueueSoundIfGameInProgress}

loc_5694:
5694: 0E 00           LD      C,$00               
5696: 21 31 08        LD      HL,$0831            
5699: 3A AB A9        LD      A,($A9AB)           ; {hard.workRam+1AB}

loc_569c:
569C: 96              SUB     (HL)                
569D: 23              INC     HL                  
569E: 0D              DEC     C                   
569F: 20 FB           JR      NZ,$569C            ; {code.loc_569c}
56A1: EE C2           XOR     $C2                 
56A3: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
56A6: CD 97 0F        CALL    $0F97               ; {code.multiplexSpriteSlotsSkipping}
56A9: CD DF 1E        CALL    $1EDF               ; {code.dispatchPlayerFrameByState}
56AC: CD 97 0F        CALL    $0F97               ; {code.multiplexSpriteSlotsSkipping}
56AF: CD BC 2C        CALL    $2CBC               ; {code.runSceneryForEra}
56B2: CD E3 23        CALL    $23E3               ; {code.fireAndSweepPlayerShots}
56B5: CD 98 10        CALL    $1098               ; {code.multiplexSpriteSlots}
56B8: 21 EB A9        LD      HL,$A9EB            
56BB: 35              DEC     (HL)                
56BC: C0              RET     NZ                  
56BD: 0E 00           LD      C,$00               
56BF: 21 A7 12        LD      HL,$12A7            
56C2: 3A AB A9        LD      A,($A9AB)           ; {hard.workRam+1AB}

loc_56c5:
56C5: 96              SUB     (HL)                
56C6: 23              INC     HL                  
56C7: 0D              DEC     C                   
56C8: 20 FB           JR      NZ,$56C5            ; {code.loc_56c5}
56CA: EE 59           XOR     $59                 
56CC: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
56CF: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; ask for three sounds whose codes come from bytes of the program image,
; all three refused unless a game is being played, then leave through the
; two-request tail whose permission is looser -- so a state that drops the
; three can still admit the pair
requestRoundIntroSoundBurst:
56D2: 3A 5B 0C        LD      A,($0C5B)           ; {hard.rom+C5B}
56D5: CD 0C 56        CALL    $560C               ; {code.enqueueSoundIfGameInProgress}
56D8: 3A 55 08        LD      A,($0855)           ; {hard.rom+855}
56DB: CD 0C 56        CALL    $560C               ; {code.enqueueSoundIfGameInProgress}
56DE: 3A 75 16        LD      A,($1675)           ; {hard.rom+1675}
56E1: CD 0C 56        CALL    $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x27CB and request it as a sound code, then do the same
; with the byte at 0x33A0; each request goes through the door at 0x5617,
; which admits it while a game is being played or while the cell at 0xA9C6
; is set. It is reached two ways -- as a call from
; advanceScriptedCharPlaneBandTo4, in the arm that steps that routine's
; script pointer on, and by falling out of the bottom of
; requestRoundIntroSoundBurst, which has just asked for three other codes
; through the play-only door at 0x560C -- and it is the same two-load,
; two-request shape as requestTwoSounds at 0x5683 with a different pair of
; program bytes
requestInterRoundSoundPair:
56E4: 3A CB 27        LD      A,($27CB)           ; {hard.rom+27CB}
56E7: CD 17 56        CALL    $5617               ; {code.enqueueSoundIfGameOrAttract}
56EA: 3A A0 33        LD      A,($33A0)           ; {hard.rom+33A0}
56ED: C3 17 56        JP      $5617               ; {code.enqueueSoundIfGameOrAttract}

; ---- $56F0-$57F0: data ----
56F0: FF 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00
5700: 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00
5710: 01 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00
5720: 00 01 00 00 00 00 00 00 00 00 00 00 00 00 01 00
5730: 00 01 01 00 00 00 00 00 00 00 00 00 00 00 00 00
5740: 00 00 01 01 00 00 00 00 00 00 00 00 01 00 00 00
5750: 00 00 00 01 01 01 00 00 00 00 00 00 00 00 00 00
5760: 00 00 00 00 00 01 01 01 01 00 01 00 00 00 00 00
5770: 00 00 00 00 00 00 00 00 00 01 01 00 00 00 00 00
5780: 00 00 00 00 00 00 00 00 01 00 01 00 00 00 00 00
5790: 00 00 00 00 00 00 00 01 00 00 01 01 00 00 00 00
57A0: 00 00 00 00 00 00 01 01 00 00 00 01 01 01 00 00
57B0: 00 00 00 00 01 01 00 01 01 00 00 00 00 01 01 00
57C0: 00 00 00 01 01 01 00 00 01 01 01 00 00 00 00 00
57D0: 00 00 01 01 00 01 01 00 00 00 00 00 00 00 00 00
57E0: 00 01 00 01 00 00 00 00 00 00 00 00 00 00 00 00
57F0: FF

; read the byte at 0x322E and request it as a sound code, with no
; permission test
requestCoinSound:
57F1: 3A 2E 32        LD      A,($322E)           ; {hard.rom+322E}
57F4: C3 28 56        JP      $5628               ; {code.enqueueSoundUnconditional}

; request the sound code that the era index selects out of a run beginning
; twelve codes up, only while a game is being played; the sum is not
; clamped
requestCurrentEraSound:
57F7: 3A 04 AD        LD      A,($AD04)           ; {hard.workRam+504}
57FA: C6 0C           ADD     A,$0C               
57FC: C3 0C 56        JP      $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x079B and request it as a sound code, only while a
; game is being played
requestParachutistAwardSound:
57FF: 3A 9B 07        LD      A,($079B)           ; {hard.rom+79B}
5802: C3 0C 56        JP      $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x2D4E and request it as a sound code, only while a
; game is being played
requestBonusLifeSound:
5805: 3A 4E 2D        LD      A,($2D4E)           ; {hard.rom+2D4E}
5808: C3 0C 56        JP      $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x49EE and request it as a sound code, only while a
; game is being played
requestMotherShipWarpSound:
580B: 3A EE 49        LD      A,($49EE)           ; {hard.rom+49EE}
580E: C3 0C 56        JP      $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x07A9 and request it as a sound code, only while a
; game is being played
requestPlayerSpawnFlashSound:
5811: 3A A9 07        LD      A,($07A9)           ; {hard.rom+7A9}
5814: C3 0C 56        JP      $560C               ; {code.enqueueSoundIfGameInProgress}

; read the byte at 0x273A and request it as a sound code, only while a
; game is being played
requestEnemyWaveSound:
5817: 3A 3A 27        LD      A,($273A)           ; {hard.rom+273A}
581A: C3 0C 56        JP      $560C               ; {code.enqueueSoundIfGameInProgress}

; ---- $581D-$5833: data ----
581D: 0C A7 13 88 57 34 A5 ED 34 F1 87 34 88 68 ED FD
582D: DC F1 77 68 FD 3B B9

; read the byte at 0x1767 and request it as a sound code, only while a
; game is being played
requestRoundStartSound:
5834: 3A 67 17        LD      A,($1767)           ; {hard.rom+1767}
5837: C3 0C 56        JP      $560C               ; {code.enqueueSoundIfGameInProgress}

loc_583a:
583A: 3A FA 18        LD      A,($18FA)           ; {hard.rom+18FA}
583D: C3 0C 56        JP      $560C               ; {code.enqueueSoundIfGameInProgress}

; fly one object a single step at the slowest of the velocity-table
; speeds, choosing that table for the flier and deciding nothing else;
; reached as a call from two per-slot actor handlers and as a tail jump
; from a third
flyAtSlowestSpeed:
5840: 21 D7 59        LD      HL,$59D7            
5843: C3 BC 58        JP      $58BC               ; {code.flyAlongHeading}

; ---- $5846-$5853: data ----
5846: 21 00 5C C3 BC 58 60 A7 14 96 10 0D 88 B9

loc_5854:
5854: 21 00 5E        LD      HL,$5E00            
5857: C3 BC 58        JP      $58BC               ; {code.flyAlongHeading}

; ---- $585A-$585F: data ----
585A: 21 30 25 C3 BC 58

loc_5860:
5860: 21 3E 2E        LD      HL,$2E3E            
5863: C3 BC 58        JP      $58BC               ; {code.flyAlongHeading}

; cold-start clear then ROM tamper check: fill colour RAM 0xA000-0xA3FF
; with 0x10 and video RAM 0xA400-0xA7FF with 0xf1 (bases from ROM pointers
; at 0x2581/0x4A37), sum the whole program ROM 0x0000-0x5FFF and test the
; total against 0xAF, kicking the watchdog after the first fill and once
; per summed byte; a genuine image tail-calls cold-start init, a tampered
; one derails into data at 0x59D7
clearScreenRamAndVerifyImageThenColdInit:
5866: 2A 81 25        LD      HL,($2581)          ; {hard.rom+2581}
5869: 01 00 04        LD      BC,$0400            
586C: 16 10           LD      D,$10               

loc_586e:
586E: 72              LD      (HL),D              
586F: 23              INC     HL                  
5870: 0B              DEC     BC                  
5871: 79              LD      A,C                 
5872: B0              OR      B                   
5873: 20 F9           JR      NZ,$586E            ; {code.loc_586e}
5875: 32 00 C2        LD      ($C200),A           
5878: 2A 37 4A        LD      HL,($4A37)          ; {hard.rom+4A37}
587B: 01 00 04        LD      BC,$0400            
587E: 16 F1           LD      D,$F1               

loc_5880:
5880: 72              LD      (HL),D              
5881: 23              INC     HL                  
5882: 0B              DEC     BC                  
5883: 79              LD      A,C                 
5884: B0              OR      B                   
5885: 20 F9           JR      NZ,$5880            ; {code.loc_5880}
5887: 21 00 00        LD      HL,$0000            
588A: 3A 00 00        LD      A,($0000)           ; {hard.rom}

loc_588d:
588D: 86              ADD     A,(HL)              
588E: 23              INC     HL                  
588F: 08              EX      AF,AF'              
5890: 7C              LD      A,H                 
5891: FE 60           CP      $60                 
5893: 30 06           JR      NC,$589B            ; {code.loc_589b}
5895: 08              EX      AF,AF'              
5896: 32 00 C2        LD      ($C200),A           
5899: 18 F2           JR      $588D               ; {code.loc_588d}

loc_589b:
589B: 08              EX      AF,AF'              
589C: D6 AF           SUB     $AF                 
589E: C2 D7 59        JP      NZ,$59D7            ; {code.loc_59d7}
58A1: C3 11 25        JP      $2511               ; {code.initColdStartRamThenSeedConfig}

loc_58a4:
58A4: 21 FA 08        LD      HL,$08FA            
58A7: C3 BC 58        JP      $58BC               ; {code.flyAlongHeading}

loc_58aa:
58AA: 21 D7 59        LD      HL,$59D7            
58AD: C3 FE 58        JP      $58FE               ; {code.flyAlongHeadingAtDoubleVelocity}

; ---- $58B0-$58B5: data ----
58B0: 21 00 5C C3 FE 58

loc_58b6:
58B6: 21 00 5E        LD      HL,$5E00            
58B9: C3 FE 58        JP      $58FE               ; {code.flyAlongHeadingAtDoubleVelocity}

; fly one object a single step along the heading it holds, and in the same
; add carry it with the world: each coordinate gains its own velocity
; component PLUS the shared per-frame scroll pair, so nothing else may
; drift this object
flyAlongHeading:
58BC: DD 7E 02        LD      A,(IX+$02)          
58BF: 4F              LD      C,A                 
58C0: 87              ADD     A,A                 
58C1: 30 01           JR      NC,$58C4            ; {code.loc_58c4}
58C3: 24              INC     H                   

loc_58c4:
58C4: 85              ADD     A,L                 
58C5: 6F              LD      L,A                 
58C6: 30 01           JR      NC,$58C9            ; {code.loc_58c9}
58C8: 24              INC     H                   

loc_58c9:
58C9: 5E              LD      E,(HL)              
58CA: 23              INC     HL                  
58CB: 56              LD      D,(HL)              
58CC: 79              LD      A,C                 
58CD: C6 C0           ADD     A,$C0               
58CF: 01 80 01        LD      BC,$0180            
58D2: 30 03           JR      NC,$58D7            ; {code.loc_58d7}
58D4: 01 80 FF        LD      BC,$FF80            

loc_58d7:
58D7: 09              ADD     HL,BC               
58D8: 46              LD      B,(HL)              
58D9: 2B              DEC     HL                  
58DA: 4E              LD      C,(HL)              
58DB: 2A 08 A8        LD      HL,($A808)          ; {hard.workRam+8}
58DE: 19              ADD     HL,DE               
58DF: DD 5E 03        LD      E,(IX+$03)          
58E2: FD 56 31        LD      D,(IY+$31)          
58E5: 19              ADD     HL,DE               
58E6: DD 75 03        LD      (IX+$03),L          
58E9: FD 74 31        LD      (IY+$31),H          
58EC: 2A 0A A8        LD      HL,($A80A)          ; {hard.workRam+A}
58EF: 09              ADD     HL,BC               
58F0: DD 5E 05        LD      E,(IX+$05)          
58F3: FD 56 00        LD      D,(IY+$00)          
58F6: 19              ADD     HL,DE               
58F7: DD 75 05        LD      (IX+$05),L          
58FA: FD 74 00        LD      (IY+$00),H          
58FD: C9              RET                         

; fly one object a single step along the heading it holds, with TWICE its
; own velocity component and the shared world scroll added once, so
; nothing else may drift this object
flyAlongHeadingAtDoubleVelocity:
58FE: DD 7E 02        LD      A,(IX+$02)          
5901: 4F              LD      C,A                 
5902: 87              ADD     A,A                 
5903: 30 01           JR      NC,$5906            ; {code.loc_5906}
5905: 24              INC     H                   

loc_5906:
5906: 85              ADD     A,L                 
5907: 6F              LD      L,A                 
5908: 30 01           JR      NC,$590B            ; {code.loc_590b}
590A: 24              INC     H                   

loc_590b:
590B: 5E              LD      E,(HL)              
590C: 23              INC     HL                  
590D: 56              LD      D,(HL)              
590E: 79              LD      A,C                 
590F: C6 C0           ADD     A,$C0               
5911: 01 80 01        LD      BC,$0180            
5914: 30 03           JR      NC,$5919            ; {code.loc_5919}
5916: 01 80 FF        LD      BC,$FF80            

loc_5919:
5919: 09              ADD     HL,BC               
591A: 46              LD      B,(HL)              
591B: 2B              DEC     HL                  
591C: 4E              LD      C,(HL)              
591D: 2A 08 A8        LD      HL,($A808)          ; {hard.workRam+8}
5920: 19              ADD     HL,DE               
5921: 19              ADD     HL,DE               
5922: DD 5E 03        LD      E,(IX+$03)          
5925: FD 56 31        LD      D,(IY+$31)          
5928: 19              ADD     HL,DE               
5929: DD 75 03        LD      (IX+$03),L          
592C: FD 74 31        LD      (IY+$31),H          
592F: 2A 0A A8        LD      HL,($A80A)          ; {hard.workRam+A}
5932: 09              ADD     HL,BC               
5933: 09              ADD     HL,BC               
5934: DD 5E 05        LD      E,(IX+$05)          
5937: FD 56 00        LD      D,(IY+$00)          
593A: 19              ADD     HL,DE               
593B: DD 75 05        LD      (IX+$05),L          
593E: FD 74 00        LD      (IY+$00),H          
5941: C9              RET                         

loc_5942:
5942: 21 D7 59        LD      HL,$59D7            
5945: C3 6E 59        JP      $596E               ; {code.velocityForHeading}

; ---- $5948-$594D: data ----
5948: 21 00 5C C3 6E 59

loc_594e:
594E: 21 00 5E        LD      HL,$5E00            
5951: C3 6E 59        JP      $596E               ; {code.velocityForHeading}

; ---- $5954-$5964: data ----
5954: 73 A6 14 7E 29 F8 96 5D 02 13 B9 21 30 25 C3 6E
5964: 59

loc_5965:
5965: 21 3E 2E        LD      HL,$2E3E            
5968: C3 6E 59        JP      $596E               ; {code.velocityForHeading}

loc_596b:
596B: 21 FA 08        LD      HL,$08FA            

; look up the velocity vector for a heading: two perpendicular components
; a quarter turn apart, read from the table the caller supplies
velocityForHeading:
596E: DD 7E 02        LD      A,(IX+$02)          
5971: 4F              LD      C,A                 
5972: 87              ADD     A,A                 
5973: 30 01           JR      NC,$5976            ; {code.loc_5976}
5975: 24              INC     H                   

loc_5976:
5976: 85              ADD     A,L                 
5977: 6F              LD      L,A                 
5978: 30 01           JR      NC,$597B            ; {code.loc_597b}
597A: 24              INC     H                   

loc_597b:
597B: 5E              LD      E,(HL)              
597C: 23              INC     HL                  
597D: 56              LD      D,(HL)              
597E: 79              LD      A,C                 
597F: C6 C0           ADD     A,$C0               
5981: 01 80 01        LD      BC,$0180            
5984: 30 03           JR      NC,$5989            ; {code.loc_5989}
5986: 01 80 FF        LD      BC,$FF80            

loc_5989:
5989: 09              ADD     HL,BC               
598A: 46              LD      B,(HL)              
598B: 2B              DEC     HL                  
598C: 4E              LD      C,(HL)              
598D: C9              RET                         

loc_598e:
598E: 21 D7 59        LD      HL,$59D7            
5991: C3 9D 59        JP      $599D               ; {code.loc_599d}

loc_5994:
5994: 21 00 5C        LD      HL,$5C00            
5997: C3 9D 59        JP      $599D               ; {code.loc_599d}

; ---- $599A-$599C: data ----
599A: 21 00 5E

loc_599d:
599D: DD 7E 02        LD      A,(IX+$02)          

; turn a heading handed straight in into the velocity pair the caller's
; table gives for it, doubled; the doubling wraps at sixteen bits and
; nothing is written
doubledVelocityForHeading:
59A0: 4F              LD      C,A                 
59A1: 87              ADD     A,A                 
59A2: 30 01           JR      NC,$59A5            ; {code.loc_59a5}
59A4: 24              INC     H                   

loc_59a5:
59A5: 85              ADD     A,L                 
59A6: 6F              LD      L,A                 
59A7: 30 01           JR      NC,$59AA            ; {code.loc_59aa}
59A9: 24              INC     H                   

loc_59aa:
59AA: 5E              LD      E,(HL)              
59AB: 23              INC     HL                  
59AC: 56              LD      D,(HL)              
59AD: CB 23           SLA     E                   
59AF: CB 12           RL      D                   
59B1: 79              LD      A,C                 
59B2: C6 C0           ADD     A,$C0               
59B4: 01 80 01        LD      BC,$0180            
59B7: 30 03           JR      NC,$59BC            ; {code.loc_59bc}
59B9: 01 80 FF        LD      BC,$FF80            

loc_59bc:
59BC: 09              ADD     HL,BC               
59BD: 46              LD      B,(HL)              
59BE: 2B              DEC     HL                  
59BF: 4E              LD      C,(HL)              
59C0: CB 21           SLA     C                   
59C2: CB 10           RL      B                   
59C4: C9              RET                         

loc_59c5:
59C5: 21 D7 59        LD      HL,$59D7            
59C8: C3 A0 59        JP      $59A0               ; {code.doubledVelocityForHeading}

loc_59cb:
59CB: 21 00 5C        LD      HL,$5C00            
59CE: C3 A0 59        JP      $59A0               ; {code.doubledVelocityForHeading}

loc_59d1:
59D1: 21 00 5E        LD      HL,$5E00            
59D4: C3 A0 59        JP      $59A0               ; {code.doubledVelocityForHeading}

loc_59d7:
59D7: CE 00           ADC     A,$00               
59D9: CD 00 CC        CALL    $CC00               
59DC: 00              NOP                         
59DD: CB 00           RLC     B                   
59DF: CA 00 C9        JP      Z,$C900             
59E2: 00              NOP                         
59E3: C8              RET     Z                   
59E4: 00              NOP                         
59E5: C8              RET     Z                   
59E6: 00              NOP                         
59E7: C6 00           ADD     A,$00               
59E9: C4 00 C2        CALL    NZ,$C200            
59EC: 00              NOP                         
59ED: C0              RET     NZ                  
59EE: 00              NOP                         
59EF: BF              CP      A                   
59F0: 00              NOP                         
59F1: BC              CP      H                   
59F2: 00              NOP                         
59F3: BA              CP      D                   
59F4: 00              NOP                         
59F5: B9              CP      C                   
59F6: 00              NOP                         
59F7: B6              OR      (HL)                
59F8: 00              NOP                         
59F9: B3              OR      E                   
59FA: 00              NOP                         
59FB: B0              OR      B                   
59FC: 00              NOP                         
59FD: AF              XOR     A                   
59FE: 00              NOP                         
59FF: AC              XOR     H                   
5A00: 00              NOP                         
5A01: A9              XOR     C                   
5A02: 00              NOP                         
5A03: A8              XOR     B                   
5A04: 00              NOP                         
5A05: A5              AND     L                   
5A06: 00              NOP                         
5A07: A2              AND     D                   
5A08: 00              NOP                         
5A09: A1              AND     C                   
5A0A: 00              NOP                         
5A0B: 9E              SBC     A,(HL)              
5A0C: 00              NOP                         
5A0D: 9B              SBC     A,E                 
5A0E: 00              NOP                         
5A0F: 98              SBC     A,B                 
5A10: 00              NOP                         
5A11: 97              SUB     A                   
5A12: 00              NOP                         
5A13: 94              SUB     H                   
5A14: 00              NOP                         
5A15: 91              SUB     C                   
5A16: 00              NOP                         
5A17: 90              SUB     B                   
5A18: 00              NOP                         
5A19: 8D              ADC     A,L                 
5A1A: 00              NOP                         
5A1B: 89              ADC     A,C                 
5A1C: 00              NOP                         
5A1D: 88              ADC     A,B                 
5A1E: 00              NOP                         
5A1F: 85              ADD     A,L                 
5A20: 00              NOP                         
5A21: 81              ADD     A,C                 
5A22: 00              NOP                         
5A23: 7F              LD      A,A                 
5A24: 00              NOP                         
5A25: 7B              LD      A,E                 
5A26: 00              NOP                         
5A27: 78              LD      A,B                 
5A28: 00              NOP                         
5A29: 76              HALT                        
5A2A: 00              NOP                         
5A2B: 70              LD      (HL),B              
5A2C: 00              NOP                         
5A2D: 6D              LD      L,L                 
5A2E: 00              NOP                         
5A2F: 68              LD      L,B                 
5A30: 00              NOP                         
5A31: 63              LD      H,E                 
5A32: 00              NOP                         
5A33: 60              LD      H,B                 
5A34: 00              NOP                         
5A35: 5C              LD      E,H                 
5A36: 00              NOP                         
5A37: 58              LD      E,B                 
5A38: 00              NOP                         
5A39: 52              LD      D,D                 
5A3A: 00              NOP                         
5A3B: 4E              LD      C,(HL)              
5A3C: 00              NOP                         
5A3D: 49              LD      C,C                 
5A3E: 00              NOP                         
5A3F: 43              LD      B,E                 
5A40: 00              NOP                         
5A41: 3E 00           LD      A,$00               
5A43: 39              ADD     HL,SP               
5A44: 00              NOP                         
5A45: 32 00 2C        LD      ($2C00),A           ; {hard.rom+2C00}
5A48: 00              NOP                         
5A49: 27              DAA                         
5A4A: 00              NOP                         
5A4B: 20 00           JR      NZ,$5A4D            ; {code.loc_5a4d}

loc_5a4d:
5A4D: 1A              LD      A,(DE)              
5A4E: 00              NOP                         
5A4F: 14              INC     D                   
5A50: 00              NOP                         
5A51: 0E 00           LD      C,$00               
5A53: 08              EX      AF,AF'              
5A54: 00              NOP                         
5A55: 00              NOP                         
5A56: 00              NOP                         
5A57: 00              NOP                         
5A58: 00              NOP                         
5A59: F8              RET     M                   
5A5A: FF              RST     $38                 
5A5B: F2 FF 00        JP      P,$00FF             
5A5E: 00              NOP                         
5A5F: E6 FF           AND     $FF                 
5A61: E0              RET     PO                  
5A62: FF              RST     $38                 
5A63: D9              EXX                         
5A64: FF              RST     $38                 
5A65: D4 FF CE        CALL    NC,$CEFF            
5A68: FF              RST     $38                 
5A69: C7              RST     $00                 
5A6A: FF              RST     $38                 
5A6B: C2 FF BD        JP      NZ,$BDFF            
5A6E: FF              RST     $38                 
5A6F: B7              OR      A                   
5A70: FF              RST     $38                 
5A71: B2              OR      D                   
5A72: FF              RST     $38                 
5A73: AE              XOR     (HL)                
5A74: FF              RST     $38                 
5A75: A8              XOR     B                   
5A76: FF              RST     $38                 
5A77: A4              AND     H                   
5A78: FF              RST     $38                 
5A79: A0              AND     B                   
5A7A: FF              RST     $38                 
5A7B: 9D              SBC     A,L                 
5A7C: FF              RST     $38                 
5A7D: A0              AND     B                   
5A7E: FF              RST     $38                 
5A7F: 93              SUB     E                   
5A80: FF              RST     $38                 
5A81: 90              SUB     B                   
5A82: FF              RST     $38                 
5A83: 8A              ADC     A,D                 
5A84: FF              RST     $38                 
5A85: 88              ADC     A,B                 
5A86: FF              RST     $38                 
5A87: 85              ADD     A,L                 
5A88: FF              RST     $38                 
5A89: 81              ADD     A,C                 
5A8A: FF              RST     $38                 
5A8B: 7F              LD      A,A                 
5A8C: FF              RST     $38                 
5A8D: 7B              LD      A,E                 
5A8E: FF              RST     $38                 
5A8F: 78              LD      A,B                 
5A90: FF              RST     $38                 
5A91: 77              LD      (HL),A              
5A92: FF              RST     $38                 
5A93: 73              LD      (HL),E              
5A94: FF              RST     $38                 
5A95: 70              LD      (HL),B              
5A96: FF              RST     $38                 
5A97: 6F              LD      L,A                 
5A98: FF              RST     $38                 
5A99: 6C              LD      L,H                 
5A9A: FF              RST     $38                 
5A9B: 69              LD      L,C                 
5A9C: FF              RST     $38                 
5A9D: 69              LD      L,C                 
5A9E: FF              RST     $38                 
5A9F: 65              LD      H,L                 
5AA0: FF              RST     $38                 
5AA1: 62              LD      H,D                 
5AA2: FF              RST     $38                 
5AA3: 5F              LD      E,A                 
5AA4: FF              RST     $38                 
5AA5: 5E              LD      E,(HL)              
5AA6: FF              RST     $38                 
5AA7: 5B              LD      E,E                 
5AA8: FF              RST     $38                 
5AA9: 58              LD      E,B                 
5AAA: FF              RST     $38                 
5AAB: 57              LD      D,A                 
5AAC: FF              RST     $38                 
5AAD: 54              LD      D,H                 
5AAE: FF              RST     $38                 
5AAF: 51              LD      D,C                 
5AB0: FF              RST     $38                 
5AB1: 50              LD      D,B                 
5AB2: FF              RST     $38                 
5AB3: 4D              LD      C,L                 
5AB4: FF              RST     $38                 
5AB5: 4A              LD      C,D                 
5AB6: FF              RST     $38                 
5AB7: 47              LD      B,A                 
5AB8: FF              RST     $38                 
5AB9: 46              LD      B,(HL)              
5ABA: FF              RST     $38                 
5ABB: 44              LD      B,H                 
5ABC: FF              RST     $38                 
5ABD: 41              LD      B,C                 
5ABE: FF              RST     $38                 
5ABF: 40              LD      B,B                 
5AC0: FF              RST     $38                 
5AC1: 3E FF           LD      A,$FF               
5AC3: 3C              INC     A                   
5AC4: FF              RST     $38                 
5AC5: 3A FF 38        LD      A,($38FF)           ; {hard.rom+38FF}
5AC8: FF              RST     $38                 
5AC9: 38 FF           JR      C,$5ACA             
5ACB: 37              SCF                         
5ACC: FF              RST     $38                 
5ACD: 36 FF           LD      (HL),$FF            
5ACF: 35              DEC     (HL)                
5AD0: FF              RST     $38                 
5AD1: 34              INC     (HL)                
5AD2: FF              RST     $38                 
5AD3: 33              INC     SP                  
5AD4: FF              RST     $38                 
5AD5: 32 FF 32        LD      ($32FF),A           ; {hard.rom+32FF}
5AD8: FF              RST     $38                 
5AD9: 33              INC     SP                  
5ADA: FF              RST     $38                 
5ADB: 34              INC     (HL)                
5ADC: FF              RST     $38                 
5ADD: 35              DEC     (HL)                
5ADE: FF              RST     $38                 
5ADF: 36 FF           LD      (HL),$FF            
5AE1: 37              SCF                         
5AE2: FF              RST     $38                 
5AE3: 38 FF           JR      C,$5AE4             
5AE5: 38 FF           JR      C,$5AE6             
5AE7: 3A FF 3C        LD      A,($3CFF)           ; {hard.rom+3CFF}
5AEA: FF              RST     $38                 
5AEB: 3E FF           LD      A,$FF               
5AED: 40              LD      B,B                 
5AEE: FF              RST     $38                 
5AEF: 41              LD      B,C                 
5AF0: FF              RST     $38                 
5AF1: 44              LD      B,H                 
5AF2: FF              RST     $38                 
5AF3: 46              LD      B,(HL)              
5AF4: FF              RST     $38                 
5AF5: 47              LD      B,A                 
5AF6: FF              RST     $38                 
5AF7: 4A              LD      C,D                 
5AF8: FF              RST     $38                 
5AF9: 4D              LD      C,L                 
5AFA: FF              RST     $38                 
5AFB: 50              LD      D,B                 
5AFC: FF              RST     $38                 
5AFD: 51              LD      D,C                 
5AFE: FF              RST     $38                 
5AFF: 54              LD      D,H                 
5B00: FF              RST     $38                 
5B01: 57              LD      D,A                 
5B02: FF              RST     $38                 
5B03: 58              LD      E,B                 
5B04: FF              RST     $38                 
5B05: 5B              LD      E,E                 
5B06: FF              RST     $38                 
5B07: 5E              LD      E,(HL)              
5B08: FF              RST     $38                 
5B09: 5F              LD      E,A                 
5B0A: FF              RST     $38                 
5B0B: 62              LD      H,D                 
5B0C: FF              RST     $38                 
5B0D: 65              LD      H,L                 
5B0E: FF              RST     $38                 
5B0F: 68              LD      L,B                 
5B10: FF              RST     $38                 
5B11: 69              LD      L,C                 
5B12: FF              RST     $38                 
5B13: 6C              LD      L,H                 
5B14: FF              RST     $38                 
5B15: 6F              LD      L,A                 
5B16: FF              RST     $38                 
5B17: 70              LD      (HL),B              
5B18: FF              RST     $38                 
5B19: 73              LD      (HL),E              
5B1A: FF              RST     $38                 
5B1B: 77              LD      (HL),A              
5B1C: FF              RST     $38                 
5B1D: 78              LD      A,B                 
5B1E: FF              RST     $38                 
5B1F: 7B              LD      A,E                 
5B20: FF              RST     $38                 
5B21: 7F              LD      A,A                 
5B22: FF              RST     $38                 
5B23: 81              ADD     A,C                 
5B24: FF              RST     $38                 
5B25: 85              ADD     A,L                 
5B26: FF              RST     $38                 
5B27: 88              ADC     A,B                 
5B28: FF              RST     $38                 
5B29: 8A              ADC     A,D                 
5B2A: FF              RST     $38                 
5B2B: 90              SUB     B                   
5B2C: FF              RST     $38                 
5B2D: 93              SUB     E                   
5B2E: FF              RST     $38                 
5B2F: 98              SBC     A,B                 
5B30: FF              RST     $38                 
5B31: 9D              SBC     A,L                 
5B32: FF              RST     $38                 
5B33: A0              AND     B                   
5B34: FF              RST     $38                 
5B35: A4              AND     H                   
5B36: FF              RST     $38                 
5B37: A8              XOR     B                   
5B38: FF              RST     $38                 
5B39: AE              XOR     (HL)                
5B3A: FF              RST     $38                 
5B3B: B2              OR      D                   
5B3C: FF              RST     $38                 
5B3D: B7              OR      A                   
5B3E: FF              RST     $38                 
5B3F: BD              CP      L                   
5B40: FF              RST     $38                 
5B41: C2 FF C7        JP      NZ,$C7FF            
5B44: FF              RST     $38                 
5B45: CE FF           ADC     A,$FF               
5B47: D4 FF D9        CALL    NC,$D9FF            
5B4A: FF              RST     $38                 
5B4B: E0              RET     PO                  
5B4C: FF              RST     $38                 
5B4D: E6 FF           AND     $FF                 
5B4F: EC FF F2        CALL    PE,$F2FF            
5B52: FF              RST     $38                 
5B53: F8              RET     M                   
5B54: FF              RST     $38                 
5B55: 00              NOP                         
5B56: 00              NOP                         
5B57: 00              NOP                         
5B58: 00              NOP                         
5B59: 08              EX      AF,AF'              
5B5A: 00              NOP                         
5B5B: 0E 00           LD      C,$00               
5B5D: 14              INC     D                   
5B5E: 00              NOP                         
5B5F: 1A              LD      A,(DE)              
5B60: 00              NOP                         
5B61: 20 00           JR      NZ,$5B63            ; {code.loc_5b63}

loc_5b63:
5B63: 27              DAA                         
5B64: 00              NOP                         
5B65: 2C              INC     L                   
5B66: 00              NOP                         
5B67: 32 00 39        LD      ($3900),A           ; {hard.rom+3900}
5B6A: 00              NOP                         
5B6B: 3E 00           LD      A,$00               
5B6D: 43              LD      B,E                 
5B6E: 00              NOP                         
5B6F: 49              LD      C,C                 
5B70: 00              NOP                         
5B71: 4E              LD      C,(HL)              
5B72: 00              NOP                         
5B73: 52              LD      D,D                 
5B74: 00              NOP                         
5B75: 58              LD      E,B                 
5B76: 00              NOP                         
5B77: 5C              LD      E,H                 
5B78: 00              NOP                         
5B79: 60              LD      H,B                 
5B7A: 00              NOP                         
5B7B: 63              LD      H,E                 
5B7C: 00              NOP                         
5B7D: 63              LD      H,E                 
5B7E: 00              NOP                         
5B7F: 6D              LD      L,L                 
5B80: 00              NOP                         
5B81: 70              LD      (HL),B              
5B82: 00              NOP                         
5B83: 76              HALT                        
5B84: 00              NOP                         
5B85: 78              LD      A,B                 
5B86: 00              NOP                         
5B87: 7B              LD      A,E                 
5B88: 00              NOP                         
5B89: 7F              LD      A,A                 
5B8A: 00              NOP                         
5B8B: 81              ADD     A,C                 
5B8C: 00              NOP                         
5B8D: 85              ADD     A,L                 
5B8E: 00              NOP                         
5B8F: 88              ADC     A,B                 
5B90: 00              NOP                         
5B91: 89              ADC     A,C                 
5B92: 00              NOP                         
5B93: 8D              ADC     A,L                 
5B94: 00              NOP                         
5B95: 90              SUB     B                   
5B96: 00              NOP                         
5B97: 91              SUB     C                   
5B98: 00              NOP                         
5B99: 94              SUB     H                   
5B9A: 00              NOP                         
5B9B: 97              SUB     A                   
5B9C: 00              NOP                         
5B9D: 94              SUB     H                   
5B9E: 00              NOP                         
5B9F: 9B              SBC     A,E                 
5BA0: 00              NOP                         
5BA1: 9E              SBC     A,(HL)              
5BA2: 00              NOP                         
5BA3: A1              AND     C                   
5BA4: 00              NOP                         
5BA5: A2              AND     D                   
5BA6: 00              NOP                         
5BA7: A5              AND     L                   
5BA8: 00              NOP                         
5BA9: A8              XOR     B                   
5BAA: 00              NOP                         
5BAB: A9              XOR     C                   
5BAC: 00              NOP                         
5BAD: AC              XOR     H                   
5BAE: 00              NOP                         
5BAF: AF              XOR     A                   
5BB0: 00              NOP                         
5BB1: B0              OR      B                   
5BB2: 00              NOP                         
5BB3: B3              OR      E                   
5BB4: 00              NOP                         
5BB5: B6              OR      (HL)                
5BB6: 00              NOP                         
5BB7: B9              CP      C                   
5BB8: 00              NOP                         
5BB9: BA              CP      D                   
5BBA: 00              NOP                         
5BBB: BC              CP      H                   
5BBC: 00              NOP                         
5BBD: B9              CP      C                   
5BBE: 00              NOP                         
5BBF: C0              RET     NZ                  
5BC0: 00              NOP                         
5BC1: C2 00 C4        JP      NZ,$C400            
5BC4: 00              NOP                         
5BC5: C6 00           ADD     A,$00               
5BC7: C8              RET     Z                   
5BC8: 00              NOP                         
5BC9: C8              RET     Z                   
5BCA: 00              NOP                         
5BCB: C9              RET                         

; ---- $5BCC-$5BD6: data ----
5BCC: 00 CA 00 CB 00 CC 00 CD 00 CE 00

; inner sequence-dispatch arm (table 0x0f29 index 2): blank a fixed
; character run, advance the interpolated pen run, and bail unless it
; reseated to a zero row integer; on the full path fold two guarded code
; blocks (an anti-tamper XOR check that raises the sequence phase on
; mismatch, and a self-cancelling add-checksum over a work cell) then step
; the sequence sub-index
blankCaptionThenAdvancePenRunStep:
5BD7: CD D2 07        CALL    $07D2               ; {code.blankFourteenCharCells}
5BDA: CD 01 02        CALL    $0201               ; {code.drawInterpolatedPenRun}
5BDD: C0              RET     NZ                  
5BDE: 21 DD 0B        LD      HL,$0BDD            
5BE1: 97              SUB     A                   
5BE2: 47              LD      B,A                 

loc_5be3:
5BE3: AE              XOR     (HL)                
5BE4: 23              INC     HL                  
5BE5: 10 FC           DJNZ    $5BE3               ; {code.loc_5be3}
5BE7: C6 E4           ADD     A,$E4               
5BE9: C4 11 0F        CALL    NZ,$0F11            ; {code.advanceSequencePhase}
5BEC: 3A AB A9        LD      A,($A9AB)           ; {hard.workRam+1AB}
5BEF: 21 34 17        LD      HL,$1734            
5BF2: 06 14           LD      B,$14               

loc_5bf4:
5BF4: 86              ADD     A,(HL)              
5BF5: 23              INC     HL                  
5BF6: 10 FC           DJNZ    $5BF4               ; {code.loc_5bf4}
5BF8: C6 77           ADD     A,$77               
5BFA: 32 AB A9        LD      ($A9AB),A           ; {hard.workRam+1AB}
5BFD: C3 1A 0F        JP      $0F1A               ; {code.advanceSequenceSubStep}

; ---- $5C00-$5FFF: data ----
5C00: E7 00 E6 00 E5 00 E4 00 E3 00 E2 00 E1 00 E0 00
5C10: DE 00 DC 00 DA 00 D8 00 D6 00 D3 00 D1 00 CF 00
5C20: CC 00 C9 00 C6 00 C4 00 C1 00 BE 00 BC 00 B9 00
5C30: B6 00 B4 00 B1 00 AE 00 AB 00 A9 00 A6 00 A3 00
5C40: A1 00 9E 00 9A 00 98 00 95 00 91 00 8E 00 8A 00
5C50: 87 00 84 00 7E 00 7A 00 75 00 6F 00 6C 00 67 00
5C60: 62 00 5C 00 57 00 51 00 4B 00 45 00 3F 00 38 00
5C70: 31 00 2B 00 24 00 1D 00 16 00 0F 00 08 00 00 00
5C80: 00 00 F8 FF F1 FF 00 00 E3 FF DC FF D5 FF CF FF
5C90: C8 FF C1 FF BB FF B5 FF AF FF A9 FF A4 FF 9E FF
5CA0: 99 FF 94 FF 91 FF 94 FF 86 FF 82 FF 7C FF 79 FF
5CB0: 76 FF 72 FF 6F FF 6B FF 68 FF 66 FF 62 FF 5F FF
5CC0: 5D FF 5A FF 57 FF 57 FF 52 FF 4F FF 4C FF 4A FF
5CD0: 47 FF 44 FF 42 FF 3F FF 3C FF 3A FF 37 FF 34 FF
5CE0: 31 FF 2F FF 2D FF 2A FF 28 FF 26 FF 24 FF 22 FF
5CF0: 20 FF 1F FF 1E FF 1D FF 1C FF 1B FF 1A FF 19 FF
5D00: 19 FF 1A FF 1B FF 1C FF 1D FF 1E FF 1F FF 20 FF
5D10: 22 FF 24 FF 26 FF 28 FF 2A FF 2D FF 2F FF 31 FF
5D20: 34 FF 37 FF 3A FF 3C FF 3F FF 42 FF 44 FF 47 FF
5D30: 4A FF 4C FF 4F FF 52 FF 55 FF 57 FF 5A FF 5D FF
5D40: 5F FF 62 FF 66 FF 68 FF 6B FF 6F FF 72 FF 76 FF
5D50: 79 FF 7C FF 82 FF 86 FF 8B FF 91 FF 94 FF 99 FF
5D60: 9E FF A4 FF A9 FF AF FF B5 FF BB FF C1 FF C8 FF
5D70: CF FF D5 FF DC FF E3 FF EA FF F1 FF F8 FF 00 00
5D80: 00 00 08 00 0F 00 16 00 1D 00 24 00 2B 00 31 00
5D90: 38 00 3F 00 45 00 4B 00 51 00 57 00 5C 00 62 00
5DA0: 67 00 6C 00 6F 00 6F 00 7A 00 7E 00 84 00 87 00
5DB0: 8A 00 8E 00 91 00 95 00 98 00 9A 00 9E 00 A1 00
5DC0: A3 00 A6 00 A9 00 A6 00 AE 00 B1 00 B4 00 B6 00
5DD0: B9 00 BC 00 BE 00 C1 00 C4 00 C6 00 C9 00 CC 00
5DE0: CF 00 D1 00 D3 00 CF 00 D8 00 DA 00 DC 00 DE 00
5DF0: E0 00 E1 00 E2 00 E3 00 E4 00 E5 00 E6 00 E7 00
5E00: 00 01 FF 00 FE 00 FD 00 FC 00 FB 00 FA 00 F8 00
5E10: F6 00 F4 00 F2 00 F0 00 ED 00 EA 00 E8 00 E5 00
5E20: E2 00 DF 00 DC 00 D9 00 D6 00 D3 00 D0 00 CD 00
5E30: CA 00 C7 00 C4 00 C1 00 BE 00 BB 00 B8 00 B5 00
5E40: B2 00 AF 00 AB 00 A8 00 A5 00 A1 00 9D 00 99 00
5E50: 96 00 92 00 8C 00 87 00 82 00 7B 00 78 00 72 00
5E60: 6C 00 66 00 60 00 59 00 53 00 4C 00 45 00 3E 00
5E70: 36 00 2F 00 28 00 20 00 18 00 10 00 08 00 00 00
5E80: 00 00 F8 FF F0 FF 00 00 E0 FF D8 FF D1 FF CA FF
5E90: C2 FF BB FF B4 FF AD FF A7 FF A0 FF 9A FF 94 FF
5EA0: 8E FF 88 FF 85 FF 88 FF 79 FF 74 FF 6E FF 6A FF
5EB0: 67 FF 63 FF 5F FF 5B FF 58 FF 55 FF 51 FF 4E FF
5EC0: 4B FF 48 FF 45 FF 45 FF 3F FF 3C FF 39 FF 36 FF
5ED0: 33 FF 30 FF 2D FF 2A FF 27 FF 24 FF 21 FF 1E FF
5EE0: 1B FF 18 FF 16 FF 13 FF 10 FF 0E FF 0C FF 0A FF
5EF0: 08 FF 06 FF 05 FF 04 FF 03 FF 02 FF 01 FF 00 FF
5F00: 00 FF 01 FF 02 FF 03 FF 04 FF 05 FF 06 FF 08 FF
5F10: 0A FF 0C FF 0E FF 10 FF 13 FF 16 FF 18 FF 1B FF
5F20: 1E FF 21 FF 24 FF 27 FF 2A FF 2D FF 30 FF 33 FF
5F30: 36 FF 39 FF 3C FF 3F FF 42 FF 45 FF 48 FF 4B FF
5F40: 4E FF 51 FF 55 FF 58 FF 5B FF 5F FF 63 FF 67 FF
5F50: 6A FF 6E FF 74 FF 79 FF 7E FF 85 FF 88 FF 8E FF
5F60: 94 FF 9A FF A0 FF A7 FF AD FF B4 FF BB FF C2 FF
5F70: CA FF D1 FF D8 FF E0 FF E8 FF F0 FF F8 FF 00 00
5F80: 00 00 08 00 10 00 18 00 20 00 28 00 2F 00 36 00
5F90: 3E 00 45 00 4C 00 53 00 59 00 60 00 66 00 6C 00
5FA0: 72 00 78 00 7B 00 7B 00 87 00 8C 00 92 00 96 00
5FB0: 99 00 9D 00 A1 00 A5 00 A8 00 AB 00 AF 00 B2 00
5FC0: B5 00 B8 00 BB 00 B8 00 C1 00 C4 00 C7 00 CA 00
5FD0: CD 00 D0 00 D3 00 D6 00 D9 00 DC 00 DF 00 E2 00
5FE0: E5 00 E8 00 EA 00 E5 00 F0 00 F2 00 F4 00 F6 00
5FF0: F8 00 FA 00 FB 00 FC 00 FD 00 FE 00 FF 00 00 01
```
