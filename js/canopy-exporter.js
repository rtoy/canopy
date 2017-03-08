/**
 * @license Copyright (c) 2016 Hongchan Choi. MIT License.
 * @fileOverview Canopy PCM wave file exporter.
 */
(function (Canopy) {

  'use strict';

  var Exporter = {};

  // File writing helpers

  function _writeStringToArray (aString, targetArray, offset) {
    for (var i = 0; i < aString.length; ++i)
      targetArray[offset + i] = aString.charCodeAt(i);
  }

  function _writeInt16ToArray (aNumber, targetArray, offset) {
    aNumber = Math.floor(aNumber);
    targetArray[offset + 0] = aNumber & 255;          // byte 1
    targetArray[offset + 1] = (aNumber >> 8) & 255;   // byte 2
  }

  function _writeInt32ToArray (aNumber, targetArray, offset) {
    aNumber = Math.floor(aNumber);
    targetArray[offset + 0] = aNumber & 255;          // byte 1
    targetArray[offset + 1] = (aNumber >> 8) & 255;   // byte 2
    targetArray[offset + 2] = (aNumber >> 16) & 255;  // byte 3
    targetArray[offset + 3] = (aNumber >> 24) & 255;  // byte 4
  }

  // Return the bits of the float as a 32-bit integer value.  This
  // produces the raw bits; no intepretation of the value is done.
  function _floatBits (f) {
    var buf = new ArrayBuffer(4);
    (new Float32Array(buf))[0] = f;
    var bits = (new Uint32Array(buf))[0];
    // Return as a signed integer.
    return bits | 0;
  }

  // TODO: Does 32 bit float work??
  function _writeAudioBufferToArray (audioBuffer, targetArray, offset, bitDepth) {
    var index = 0, channel = 0;
    var length = audioBuffer.length;
    var channels = audioBuffer.numberOfChannels;
    var channelData, sample;

    // Clamping samples onto the 16-bit resolution.
    for (index = 0; index < length; ++index) {
      for (channel = 0; channel < channels; ++channel) {
        channelData = audioBuffer.getChannelData(channel);

        // Branches upon the requested bit depth
        if (bitDepth === 16) {
          sample = channelData[index] * 32768.0;
          if (sample < -32768) 
            sample = -32768;
          else if (sample > 32767)
            sample = 32767;
          _writeInt16ToArray(sample, targetArray, offset);
          offset += 2;
        } else if (bitDepth === 32) {
          // This assumes we're going to out 32-float, not 32-bit linear.
          sample = _floatBits(channelData[index]);
          _writeInt32ToArray(sample, targetArray, offset);
          offset += 4;
        } else {
          Canopy.LOG('Invalid bit depth for PCM encoding.');
          return;
        }

      }
    }
  }

  function _createWaveFileBlobFromAudioBuffer (audioBuffer, asFloat) {
    // Encoding setup.
    var frameLength = audioBuffer.length;
    var numberOfChannels = audioBuffer.numberOfChannels;
    var sampleRate = audioBuffer.sampleRate;
    var bitsPerSample = asFloat ? 32 : 16;
    var bytesPerSample = bitsPerSample / 8;
    var byteRate = sampleRate * numberOfChannels * bitsPerSample / 8;
    var blockAlign = numberOfChannels * bitsPerSample / 8;
    var wavDataByteLength = frameLength * numberOfChannels * bytesPerSample;
    var headerByteLength = 44;
    var totalLength = headerByteLength + wavDataByteLength;
    var waveFileData = new Uint8Array(totalLength);
    var subChunk1Size = 16;
    var subChunk2Size = wavDataByteLength;
    var chunkSize = 4 + (8 + subChunk1Size) + (8 + subChunk2Size);

    _writeStringToArray('RIFF', waveFileData, 0);
    _writeInt32ToArray(chunkSize, waveFileData, 4);
    _writeStringToArray('WAVE', waveFileData, 8);
    _writeStringToArray('fmt ', waveFileData, 12);
    _writeInt32ToArray(subChunk1Size, waveFileData, 16);    // SubChunk1Size (4)
    _writeInt16ToArray(asFloat ? 3 : 1, waveFileData, 20);                // AudioFormat (2)
    _writeInt16ToArray(numberOfChannels, waveFileData, 22); // NumChannels (2)
    _writeInt32ToArray(sampleRate, waveFileData, 24);       // SampleRate (4)
    _writeInt32ToArray(byteRate, waveFileData, 28);         // ByteRate (4)
    _writeInt16ToArray(blockAlign, waveFileData, 32);       // BlockAlign (2)
    _writeInt32ToArray(bitsPerSample, waveFileData, 34);    // BitsPerSample (4)
    _writeStringToArray('data', waveFileData, 36);
    _writeInt32ToArray(subChunk2Size, waveFileData, 40);    // SubChunk2Size (4)

    // Write actual audio data starting at offset 44.
    _writeAudioBufferToArray(audioBuffer, waveFileData, 44, bitsPerSample);

    return new Blob([waveFileData], { 
      type: 'audio/wave' 
    });
  }

  /**
   * [createLinkFromAudioBuffer description]
   * @param  {[type]} anchorElement [description]
   * @param  {[type]} audioBuffer   [description]
   * @return {[type]}               [description]
   */
  Exporter.createLinkFromAudioBuffer = function (anchorElement, audioBuffer) {
    var blob = _createWaveFileBlobFromAudioBuffer(audioBuffer, true);
    anchorElement.href = window.URL.createObjectURL(blob);
    anchorElement.download = 'canopy-export-' + (new Date()).toJSON() + '.wav';
  };

  Canopy.Exporter = Exporter;

})(Canopy);
