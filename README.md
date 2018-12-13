# @tim-smart/mtc

A transform stream that consumes MIDI messages and outputs timecode objects.

## Usage

```typescript
import { MTCStream } from "@tim-smart/mtc";
import { Input } from "easymidi";

const input = new Input("Network MIDI device");
const mtc = new MTCStream();

input._input.on("message", (delta: number, msg: number[]) => {
  const msgBuffer = Buffer.from(msg);
  mtc.write(msgBuffer);
});

mtc.on("data", timecode => {
  console.log(timecode.toString());
});
```
