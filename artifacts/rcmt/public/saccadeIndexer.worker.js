// ============================================================
// RCMT Saccade Indexer Worker
// Save as: public/saccadeIndexer.worker.js
// O(1) byte-offset seeks into binary .bin memory archives.
// Offloads timeline scrubbing from the 60Hz React render loop.
// ============================================================

// 8,000 nodes × 7 floats (x,y,z, certainty, r,g,b) × 4 bytes = 224,000 bytes/frame
const FRAME_SIZE_BYTES = 8000 * 7 * 4;

let fileHandle = null;

self.onmessage = async function (e) {
    const { command, payload } = e.data;

    try {
        if (command === "INITIALIZE_FILE") {
            fileHandle = payload.fileHandle;
            const totalFrames = Math.floor(fileHandle.size / FRAME_SIZE_BYTES);
            self.postMessage({ status: "FILE_READY", totalFrames, fileSizeBytes: fileHandle.size });
        }

        if (command === "SEEK_FRAME") {
            if (!fileHandle) throw new Error("SaccadeIndexer: File not initialized. Send INITIALIZE_FILE first.");

            const frameIndex = payload.frameIndex;
            const offset = frameIndex * FRAME_SIZE_BYTES;
            const slice = fileHandle.slice(offset, offset + FRAME_SIZE_BYTES);
            const arrayBuffer = await slice.arrayBuffer();
            const floatArray = new Float32Array(arrayBuffer);

            // Transfer the ArrayBuffer — zero-copy hand-off to main thread
            self.postMessage(
                { status: "FRAME_DATA", index: frameIndex, data: floatArray },
                [arrayBuffer]
            );
        }

        if (command === "PRELOAD_RANGE") {
            // Preload a range of frames (e.g. ±5 around current position)
            if (!fileHandle) throw new Error("SaccadeIndexer: File not initialized.");
            const { startFrame, endFrame } = payload;
            const frames = [];
            const transfers = [];
            for (let i = startFrame; i <= endFrame; i++) {
                const offset = i * FRAME_SIZE_BYTES;
                const slice = fileHandle.slice(offset, offset + FRAME_SIZE_BYTES);
                const ab = await slice.arrayBuffer();
                frames.push({ index: i, data: new Float32Array(ab) });
                transfers.push(ab);
            }
            self.postMessage({ status: "RANGE_DATA", frames }, transfers);
        }
    } catch (err) {
        self.postMessage({ status: "ERROR", error: err.message });
    }
};
