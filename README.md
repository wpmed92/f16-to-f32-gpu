# f16-to-f32-gpu
[![Unit Tests](https://github.com/wpmed92/f16-to-f32-gpu/actions/workflows/test.yml/badge.svg)](https://github.com/wpmed92/f16-to-f32-gpu/actions/workflows/test.yml)<br>
This project's goal is to allow fast decompression of large half-float arrays to `Float32Array` in JavaScript. Since half-precision floating point arrays are not natively supported in JavaScript, decoding float16 data, and doing it fast, is challenging. CPU-based solutions are slow, so we utilize WebGPU to process values in parallel on the GPU.

## Usage

The following input types are supported: `Uint8Array`, `Uint16Array`, `Uint32Array`
Passing any other type will result in a `ErrorReason.UNSUPPORTED_TYPE` error.
When passing in `Uint8Array`, the data has to be 2-byte aligned, otherwise an `ErrorReason.UNALIGNED_INPUT` will be raised.
Internally, we view the input data as `Uint32Array`, so we perform 4-byte alignment when needed. By doing this, we can decode two half-float values in a single kernel invocation. (the lower, and upper 16 bits of the input `u32` value are decoded to `f32`)

```JavaScript
import { f16tof32GPU } from "f16-to-f32-gpu";

try {
    const f32FromUint8  = await f16tof32GPU(new Uint8Array([0x00, 0xC0]));
    const f32FromUint16 = await f16tof32GPU(new Uint16Array([0xC000]));
    const f32FromUint32 = await f16tof32GPU(new Uint32Array([0xC0000000]));
    console.log(f32FromUint8[0]);  // -2
    console.log(f32FromUint16[0]); // -2
    console.log(f32FromUint32[0]); // -2
} catch (error) {
    console.log(`Error: ${error.cause}, ${error.message}`)
}
```


## Used by

- tinygrad [Stable Diffusion WebGPU port](https://github.com/tinygrad/tinygrad/tree/master/examples/webgpu/stable_diffusion): try it [here](https://softwiredtech.github.io/stable-diffusion-webgpu/). Since `f16` support is limited in browsers, the compute in Stable Diffusion WebGPU is in `f32`. However, the `f32` weights of the model used in the demo exceed 4 gigabytes, which is too much data to download and then cache in the browser. To optimize for weight download speed, the demo fetches the weights in `f16`, and all the >2 Gigabytes of data are decompressed client-side using `f16tof32GPU`. The decompressed `f32` buffer is then used by the inference WebGPU kernels.

## License

MIT
