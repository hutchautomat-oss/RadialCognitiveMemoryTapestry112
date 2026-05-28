// ============================================================
// RCMT ONNX Inference Worker
// Save as: public/onnxInference.worker.js
// Runs off-main-thread via Web Worker (no Vite bundling).
// WebGPU → WASM fallback execution providers.
// ============================================================

importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js');

let inferenceSession = null;
const MODEL_URL = './models/intent_classifier_quantized.onnx';

self.onmessage = async function (e) {
    const { command, payload } = e.data;

    try {
        if (command === "INITIALIZE_AND_WARM") {
            self.postMessage({ status: "LOADING", message: "Configuring parallel multi-provider hardware execution engines..." });

            ort.env.wasm.numThreads = 4;
            ort.env.wasm.proxy = false;

            inferenceSession = await ort.InferenceSession.create(MODEL_URL, {
                executionProviders: ['webgpu', 'wasm'],
                graphOptimizationLevel: 'all'
            });

            self.postMessage({ status: "COMPILING", message: "Pre-warming execution path..." });

            const dummyInputIds      = new BigInt64Array(128).fill(0n);
            const dummyAttentionMask = new BigInt64Array(128).fill(1n);
            const dummyTokenTypeIds  = new BigInt64Array(128).fill(0n);

            const inputTensors = {
                input_ids:       new ort.Tensor('int64', dummyInputIds,      [1, 128]),
                attention_mask:  new ort.Tensor('int64', dummyAttentionMask, [1, 128]),
                token_type_ids:  new ort.Tensor('int64', dummyTokenTypeIds,  [1, 128])
            };

            const preWarmStartTime = performance.now();
            await inferenceSession.run(inputTensors);
            const preWarmDuration = performance.now() - preWarmStartTime;

            self.postMessage({
                status: "READY",
                message: `System engine pre-warmed successfully in ${preWarmDuration.toFixed(2)}ms.`
            });
        }

        if (command === "RUN_INFERENCE") {
            if (!inferenceSession) throw new Error("Inference Exception: Pipeline request executed before engine initialization.");

            const { inputIds, attentionMask, tokenTypeIds } = payload;

            const inputTensors = {
                input_ids:      new ort.Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)),      [1, inputIds.length]),
                attention_mask: new ort.Tensor('int64', BigInt64Array.from(attentionMask.map(BigInt)), [1, attentionMask.length]),
                token_type_ids: new ort.Tensor('int64', BigInt64Array.from(tokenTypeIds.map(BigInt)),  [1, tokenTypeIds.length])
            };

            const inferenceStartTime = performance.now();
            const outputMaps = await inferenceSession.run(inputTensors);
            const totalLatency = performance.now() - inferenceStartTime;

            // Dynamic output key extraction — prevents key-matrix crashes
            const outputKey = inferenceSession.outputNames[0];
            const logits = outputMaps[outputKey].data;

            self.postMessage({
                status: "INFERENCE_COMPLETE",
                logits: Array.from(logits),
                latencyMs: totalLatency
            });
        }
    } catch (err) {
        self.postMessage({ status: "ERROR", error: err.message });
    }
};
