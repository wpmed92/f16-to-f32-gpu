# f16-gpu-decomp-js

Fast decompression of f16 data to f32 using WebGPU.

## Usage

```JavaScript
import { f16tof32GPU } from "f16-to-f32-gpu";

try {
    const decompressedF32 = await f16tof32GPU(new Uint16Array([0xC000]));
    console.log(decompressedF32[0]); // -2
} catch (error) {
    console.log(`Error: ${error.cause}, ${error.message}`)
}
```

## License

MIT
