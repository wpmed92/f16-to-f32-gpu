const f16tof32 = `
fn u16_to_f16(x: u32) -> f32 {
    let sign = f32((x >> 15) & 0x1);
    let exponent = f32((x >> 10) & 0x1F);
    let fraction = f32(x & 0x3FF);

    let sign_multiplier = select(1.0, -1.0, sign == 1.0);
    if (exponent == 0.0) {
        return sign_multiplier * 6.103515625e-5 * (fraction / 1024.0);
    } else {
        return sign_multiplier * exp2(exponent - 15.0) * (1.0 + fraction / 1024.0);
    }
}

@group(0) @binding(0) var<storage,read_write> data0: array<u32>;
@group(0) @binding(1) var<storage,read_write> data1: array<f32>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let gidx = gid.x;
    let outgidx = gidx*2;

    if (gidx >= arrayLength(&data0)) {
        return;
    }

    let oo = data0[gidx];
    let oo1 = (oo >> 16);
    let oo2 = oo & 0xFFFFu;

    let f1 = u16_to_f16(oo2);
    let f2 = u16_to_f16(oo1);
    
    data1[outgidx] = f1;
    data1[outgidx + 1] = f2;
}`;

const addComputePass = (device, commandEncoder, pipeline, bufs, workgroup) => {
    const bindGroup = device.createBindGroup({layout: pipeline.getBindGroupLayout(0), entries: bufs.map((buffer, index) => ({ binding: index, resource: { buffer } }))});
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(...workgroup);
    passEncoder.end();
};

const ErrorReason = {
    NO_WEBGPU: "no-webgpu",
    UNSUPPORTED_TYPE: "unsupported-type",
    UNALIGNED_INPUT: "unaligned-input"
};

const align4 = function(data) {
    const DataType = data.constructor;
    const padTo = (DataType == Uint8Array) ? 4 : 2;
    const remainder = data.length % padTo;

    if (remainder == 0) {
        return data;
    }

    const padded = new DataType(data.length + remainder);
    padded.set(data);
    padded.set(Array(remainder).fill(0), data.length);
    return padded;
}


const f16tof32GPU = async(data) => {
    if (!navigator || !navigator.gpu) {
        throw new Error("WebGPU is not supported in the current environment.", { cause: ErrorReason.NO_WEBGPU });
    }

    if (!data || !(data instanceof Uint8Array || data instanceof Uint16Array || data instanceof Uint32Array)) {
        throw new Error("Invalid input type: the input array must be of type Uint8Array or Uint16Array.", { cause: ErrorReason.UNSUPPORTED_TYPE });
    }

    if (data instanceof Uint8Array && (data.length % 2) != 0) {
        throw new Error("Input data must be 2-byte aligned", { cause: ErrorReason.UNALIGNED_INPUT });
    }

    let inputUint32View;
    let alignmentNeeded = false;

    // Already 4-byte aligned
    if (data instanceof Uint32Array) {
        inputUint32View = data;
    } else {
        alignmentNeeded = true;
        const alignedData = align4(data);
        inputUint32View = new Uint32Array(alignedData.buffer, alignedData.byteOffset, (alignedData instanceof Uint8Array) ? (alignedData.length / 4) : (alignedData.length / 2));
    }

    const device = await (await navigator.gpu.requestAdapter()).requestDevice();
    const input = device.createBuffer({size: inputUint32View.length*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    const output = device.createBuffer({size: inputUint32View.length*4*2, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    const gpuWriteBuffer = device.createBuffer({size: input.size, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE });
    const gpuReadBuffer = device.createBuffer({ size: output.size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const commandEncoder = device.createCommandEncoder();

    await gpuWriteBuffer.mapAsync(GPUMapMode.WRITE);
    new Uint32Array(gpuWriteBuffer.getMappedRange()).set(inputUint32View);

    gpuWriteBuffer.unmap();
    commandEncoder.copyBufferToBuffer(gpuWriteBuffer, 0, input, 0, gpuWriteBuffer.size);
    const pipeline = await device.createComputePipelineAsync({layout: "auto", compute: { module: device.createShaderModule({ code: f16tof32 }), entryPoint: "main" }});

    addComputePass(device, commandEncoder, pipeline, [input, output], [Math.ceil(inputUint32View.length/256), 1, 1]);

    commandEncoder.copyBufferToBuffer(output, 0, gpuReadBuffer, 0, output.size);
    const gpuCommands = commandEncoder.finish();
    device.queue.submit([gpuCommands]);

    await gpuReadBuffer.mapAsync(GPUMapMode.READ);
    const resultBuffer = new Float32Array(gpuReadBuffer.size/4);
    resultBuffer.set(new Float32Array(gpuReadBuffer.getMappedRange()));
    gpuReadBuffer.unmap();

    return (alignmentNeeded) ? resultBuffer.subarray(0, resultBuffer.length-1) : resultBuffer;
}

export { f16tof32GPU, ErrorReason };
