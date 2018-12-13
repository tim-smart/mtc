// tslint:disable no-bitwise no-reference
import {
  ITimecodeOptions,
  Timecode,
  ITimecodeObject
} from "@tim-smart/timecode";
import { Transform } from "stream";

export interface IMTCStreamOptions {
  autodetectFramerate?: boolean;
  framerate?: number;
}

export class MTCStream extends Transform implements ITimecodeObject {
  public hours = 0;
  public minutes = 0;
  public seconds = 0;
  public frames = 0;

  public type = 0;
  public songPosition = 0;

  public options: Required<IMTCStreamOptions>;

  constructor(opts: IMTCStreamOptions = {}) {
    super({ objectMode: true });

    this.options = {
      autodetectFramerate: true,
      framerate: 25,
      ...opts
    };
  }

  public _transform(bytes: Buffer, enc: string, done: () => void) {
    if (bytes[0] === 0xf1) {
      this.applyQuarterTime(bytes);
    } else if (
      bytes[0] === 0xf0 &&
      bytes[1] === 0x7f &&
      bytes[3] === 0x01 &&
      bytes[4] === 0x01
    ) {
      this.applyFullTime(bytes);
    } else if (bytes[0] === 0xf2) {
      this.applySongPosition(bytes);
    }

    done();
  }

  public get timecodeOptions(): ITimecodeOptions {
    return {
      framerate: this.options.framerate
    };
  }

  public getCurrentTimecode(): Timecode {
    return new Timecode(this, this.timecodeOptions);
  }

  private applySongPosition(message: Buffer) {
    const before = this.songPosition;

    this.songPosition = message[2];
    this.songPosition <<= 7;
    this.songPosition |= message[1];

    if (this.songPosition !== before) {
      this.willPushTimecode();
    }
  }

  private applyFullTime(message: Buffer) {
    const originalString = this.toString();

    this.type = (message[5] >> 5) & 0x3;

    this.hours = message[5] & 0x1f;
    this.minutes = message[6];
    this.seconds = message[7];
    this.frames = message[8];

    if (this.toString() !== originalString) {
      this.willPushTimecode();
    }
  }

  // Build the MTC timestamp of 8 subsequent quarter time commands
  // http://www.blitter.com/~russtopia/MIDI/~jglatt/tech/mtc.htm
  private applyQuarterTime(message: Buffer) {
    const quarterTime = message[1];
    const type = (quarterTime >> 4) & 0x7;
    let nibble = quarterTime & 0x0f;
    let operator: number;

    if (type % 2 === 0) {
      // Low nibble
      operator = 0xf0;
    } else {
      // High nibble
      nibble = nibble << 4;
      operator = 0x0f;
    }

    switch (type) {
      case 0:
      case 1:
        this.frames = (this.frames & operator) | nibble;
        break;
      case 2:
      case 3:
        this.seconds = (this.seconds & operator) | nibble;
        break;
      case 4:
      case 5:
        this.minutes = (this.minutes & operator) | nibble;
        break;
      case 6:
        this.hours = (this.hours & operator) | nibble;
        break;
      case 7:
        this.type = (nibble >> 5) & 0x3;
        nibble = nibble & 0x10;
        this.hours = (this.hours & operator) | nibble;

        this.willPushTimecode();
        break;
    }
  }

  private willPushTimecode() {
    // Auto-detect framerate?
    if (this.options.autodetectFramerate) {
      switch (this.type) {
        case 0:
          this.options.framerate = 24;
          break;
        case 1:
          this.options.framerate = 25;
          break;
        case 2:
          this.options.framerate = 29.97;
          break;
        case 3:
          this.options.framerate = 30;
          break;
      }
    }

    this.push(this.getCurrentTimecode());
  }
}
