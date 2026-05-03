# Wiring Reference

ESP32 DevKit pin assignments. Every pin was checked against ESP32 boot strapping and input-only restrictions.

## Pin map

| ESP32 GPIO | Component                      | Direction   |
|-----------:|--------------------------------|-------------|
| GPIO 13    | PIR sensor `OUT`               | input       |
| GPIO 18    | Servo signal                   | PWM output  |
| GPIO 19    | Buzzer transistor base         | digital out |
| GPIO 22    | Red LED anode (locked)         | digital out |
| GPIO 23    | Green LED anode (unlocked)     | digital out |
| 3V3        | PIR `VCC`                      | 3.3 V power |
| VIN (5V)   | Servo V+, Buzzer V+            | 5 V power   |
| GND        | Common ground for everything   | —           |

## Component-by-component

### PIR (XYC-PIR203B-S0)

| PIR pin | Connect to       |
|---------|------------------|
| `VCC`   | ESP32 **3V3**    |
| `OUT`   | ESP32 **GPIO 13**|
| `GND`   | ESP32 **GND**    |

The PIR needs ~30 seconds of warm-up after power-on. The firmware
ignores motion during that window (`PIR_WARMUP_MS`).

### Servo (SG90)

| Servo wire    | Color         | Connect to        |
|---------------|---------------|-------------------|
| Power (+)     | Red           | ESP32 **VIN (5V)**|
| Signal        | Orange/Yellow | ESP32 **GPIO 18** |
| Ground        | Brown/Black   | ESP32 **GND**     |

The servo can pull a current spike when it moves. If the ESP32 resets
when the servo turns, add a 100 µF electrolytic capacitor between
**VIN** and **GND**.

Lock position is `0°`, unlock is `90°` (`SERVO_LOCKED_DEG` /
`SERVO_UNLOCKED_DEG` in the firmware).

### Buzzer (SFM-27 active buzzer through BC547 + 1 kΩ)

The buzzer is **not** connected directly to the ESP32 pin. The BC547
transistor switches the buzzer's ground.

BC547 pinout (flat side facing you, legs down): `C  B  E`
left → right (Collector, Base, Emitter).

| From                                      | To                                  |
|-------------------------------------------|-------------------------------------|
| ESP32 **GPIO 19**                         | one end of **1 kΩ resistor**        |
| other end of 1 kΩ resistor                | BC547 **Base** (middle pin)         |
| BC547 **Emitter** (right pin)             | ESP32 **GND**                       |
| BC547 **Collector** (left pin)            | Buzzer **(–)** (negative wire)      |
| Buzzer **(+)** (positive wire)            | ESP32 **VIN (5V)**                  |

`GPIO 19 = HIGH` ⇒ transistor closes ⇒ buzzer screams.
`GPIO 19 = LOW` ⇒ silent.

### Red LED (locked indicator)

| From                                 | To                       |
|--------------------------------------|--------------------------|
| ESP32 **GPIO 22**                    | LED anode (long leg)     |
| LED cathode (short leg)              | one end of **220 Ω**     |
| other end of 220 Ω                   | ESP32 **GND**            |

### Green LED (unlocked indicator)

| From                                 | To                       |
|--------------------------------------|--------------------------|
| ESP32 **GPIO 23**                    | LED anode (long leg)     |
| LED cathode (short leg)              | one end of **220 Ω**     |
| other end of 220 Ω                   | ESP32 **GND**            |

## Breadboard rails

| Rail               | Source             | Powers                   |
|--------------------|--------------------|--------------------------|
| Top RED (+)        | ESP32 **VIN**      | Servo, Buzzer            |
| Top BLUE (–)       | ESP32 **GND**      | Everything (common GND)  |
| Bottom RED (+)     | ESP32 **3V3**      | PIR sensor only          |
| Bottom BLUE (–)    | jumper from Top –  | Everything               |

A single common ground rail is critical — the ESP32, transistor
emitter, and LED cathode resistors all share it.

## Conflict checklist

- ✅ No GPIO used twice (13, 18, 19, 22, 23 are unique)
- ✅ No flash pins used (avoided 6–11)
- ✅ No strapping pins driven (avoided 0, 2, 5, 12, 15)
- ✅ PIR voltage compatible (3.3 V VCC, 3.3 V logic out)
- ✅ Servo gets 5 V from VIN
- ✅ Buzzer isolated by transistor (not on GPIO directly)
- ✅ LEDs current-limited by 220 Ω
- ✅ Common ground established
- ✅ Boot mode unaffected (no HIGH/LOW conflicts on 0/2/12)

## Cautions

1. Power the ESP32 via USB while testing. If the ESP32 resets on servo
   movement, add a 100 µF cap between VIN and GND.
2. LED polarity: long leg = anode (+) goes to GPIO. Backwards = no light.
3. BC547 orientation: flat side facing you, C-B-E left to right.
   Reversed = burnt transistor.
4. PIR has two trim pots on the board. Default is fine for this demo;
   one tunes sensitivity, the other tunes hold time.
