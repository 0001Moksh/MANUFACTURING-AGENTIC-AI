class VoiceStreamingWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Int16Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0]; // mono
      
      // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
      for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        this.buffer[this.offset] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        this.offset++;
        
        if (this.offset >= this.bufferSize) {
          // Send back to main thread
          this.port.postMessage(this.buffer.slice(0).buffer);
          this.offset = 0;
        }
      }
    }
    return true; // Keep alive
  }
}

registerProcessor('voice-streaming-worklet', VoiceStreamingWorklet);
