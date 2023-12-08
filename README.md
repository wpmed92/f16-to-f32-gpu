# f16-gpu-decomp-js

Fast decompression of f16 data to f32 using WebGPU.

## Usage

```JavaScript
import { decompressF16 } from "f16-gpu-decomp";

const decompressedF32 = await decompressF16(new Uint16Array([0xC000, 0]));
console.log(f32[0]); // Will output -2
```

## License

MIT
