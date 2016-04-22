/**
 * foa-spatializer.js
 *
 * @fileOverview First-order-ambisonics (B-format) spatializer in Web Audio API.
 * @author Hongchan Choi
 * @license Please see LICENSE for the detail.
 */

var FOASpatializer = (function (AudioContextPrototype) {

  'use strict';

  /**
   * NOTE: The canonical usage of FOA Spatializer class:
   * MediaElementSourceNode -> Rotator -> PhaseMatchedFilter -> Decoder ->
   * -> VirtualSpeaker.
   */

  /**
   * @class rotator
   * @description First-order-ambisonic decoder based on gain node network.
   * @param {AudioContext} context    Associated AudioContext.
   * @param {AudioNode} source        FOA ambisonic stream source.
   *                                  (i.e. MediaElementSourceNode with
   *                                  ambisonic audio stream.)
   */
  function Rotator (context) {
    this._context = context;

    this._splitter = this._context.createChannelSplitter(4);
    this._inX = this._context.createGain();
    this._inY = this._context.createGain();
    this._inZ = this._context.createGain();
    this._m0 = this._context.createGain();
    this._m1 = this._context.createGain();
    this._m2 = this._context.createGain();
    this._m3 = this._context.createGain();
    this._m4 = this._context.createGain();
    this._m5 = this._context.createGain();
    this._m6 = this._context.createGain();
    this._m7 = this._context.createGain();
    this._m8 = this._context.createGain();
    this._outX = this._context.createGain();
    this._outY = this._context.createGain();
    this._outZ = this._context.createGain();
    this._merger = this._context.createChannelMerger(4);

    // Transform 1: audio space to world space.
    this._splitter.connect(this._inZ, 1); // X (1) -> -Z
    this._splitter.connect(this._inX, 2); // Y (2) -> -X
    this._splitter.connect(this._inY, 3); // Z (3) ->  Y
    this._inX.gain.value = -1;
    this._inZ.gain.value = -1;

    // Transform 2: 3x3 rotation matrix.
    // |X|   | m0  m3  m6 |   | X * m0 + Y * m3 + Z * m6 |   | X |
    // |Y| * | m1  m4  m7 | = | X * m1 + Y * m4 + Z * m7 | = | Y |
    // |Z|   | m2  m5  m8 |   | X * m2 + Y * m5 + Z * m8 |   | Z |
    this._inX.connect(this._m0);
    this._inX.connect(this._m1);
    this._inX.connect(this._m2);
    this._inY.connect(this._m3);
    this._inY.connect(this._m4);
    this._inY.connect(this._m5);
    this._inZ.connect(this._m6);
    this._inZ.connect(this._m7);
    this._inZ.connect(this._m8);
    this._m0.connect(this._outX);
    this._m1.connect(this._outY);
    this._m2.connect(this._outZ);
    this._m3.connect(this._outX);
    this._m4.connect(this._outY);
    this._m5.connect(this._outZ);
    this._m6.connect(this._outX);
    this._m7.connect(this._outY);
    this._m8.connect(this._outZ);

    // Transform 3: world space to audio space.
    this._splitter.connect(this._merger, 0, 0); // W -> W (0)
    this._outX.connect(this._merger, 0, 2); // outX -> -Y (2)
    this._outY.connect(this._merger, 0, 3); // outY ->  Z (3)
    this._outZ.connect(this._merger, 0, 1); // outZ -> -X (1)
    this._outX.gain.value = -1;
    this._outZ.gain.value = -1;

    this.setRotationMatrix(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));

    // input, output proxy.
    this.input = this._splitter;
    this.output = this._merger;
  }

  /**
   * Set 3x3 matrix for soundfield rotation.
   * @param {Array} rotationMatrix    A 3x3 matrix of soundfield rotation. The
   *                                  matrix is in the row-major representation.
   */
  Rotator.prototype.setRotationMatrix = function (rotationMatrix) {
    this._m0.gain.value = rotationMatrix[0];
    this._m1.gain.value = rotationMatrix[1];
    this._m2.gain.value = rotationMatrix[2];
    this._m3.gain.value = rotationMatrix[3];
    this._m4.gain.value = rotationMatrix[4];
    this._m5.gain.value = rotationMatrix[5];
    this._m6.gain.value = rotationMatrix[6];
    this._m7.gain.value = rotationMatrix[7];
    this._m8.gain.value = rotationMatrix[8];
  };


  /**
   * @class PhaseMatchedFilter
   * @description A set of filters (LP/HP) with a crossover frequency to
   *              compensate the gain of high frequency contents without a phase
   *              difference.
   * @param {AudioContext} context        Associated AudioContext.
   * @param {Object} options              Options for filters.
   * @param {Number} options.frequency    Crossover frequency for filters.
   * @param {Array} options.coefficients  Gain compensation frequency for high
   *                                      frequency content.
   */
  function PhaseMatchedFilter (context, options) {
    this._context = context;

    this._input = this._context.createGain();
    // this._lpf = this._context.createBiquadFilter();
    // this._hpf = this._context.createBiquadFilter();
    this._lpf = this._context.createIIRFilter(
      [0.00058914319, 0.0011782864, 0.00058914319],
      [1, -1.9029109, 0.90526748]
    );
    this._hpf = this._context.createIIRFilter(
      [0.95204461, -1.9040892, 0.95204461],
      [1, -1.9029109, 0.90526748]
    );
    this._splitterLow = this._context.createChannelSplitter(4);
    this._splitterHigh = this._context.createChannelSplitter(4);
    this._gainHighW = this._context.createGain();
    this._gainHighX = this._context.createGain();
    this._gainHighY = this._context.createGain();
    this._gainHighZ = this._context.createGain();
    this._merger = this._context.createChannelMerger(4);

    this._input.connect(this._hpf);
    this._hpf.connect(this._splitterHigh);
    this._splitterHigh.connect(this._gainHighW, 0);
    this._splitterHigh.connect(this._gainHighX, 1);
    this._splitterHigh.connect(this._gainHighY, 2);
    this._splitterHigh.connect(this._gainHighZ, 3);
    this._gainHighW.connect(this._merger, 0, 0);
    this._gainHighX.connect(this._merger, 0, 1);
    this._gainHighY.connect(this._merger, 0, 2);
    this._gainHighZ.connect(this._merger, 0, 3);

    this._input.connect(this._lpf);
    this._lpf.connect(this._splitterLow);
    this._splitterLow.connect(this._merger, 0, 0);
    this._splitterLow.connect(this._merger, 0, 1);
    this._splitterLow.connect(this._merger, 0, 2);
    this._splitterLow.connect(this._merger, 0, 3);

    // this._hpf.frequency.value = options.frequency;
    // this._hpf.type = 'highpass';
    // this._lpf.frequency.value = options.frequency;

    // Apply gain correction to hi-passed pressure and velocity components:
    // Inverting sign is necessary as the low-passed and high-passed portion are
    // out-of-phase after the filtering.
    this._gainHighW.gain.value = -1 * options.coefficients[0];
    this._gainHighX.gain.value = -1 * options.coefficients[1];
    this._gainHighY.gain.value = -1 * options.coefficients[2];
    this._gainHighZ.gain.value = -1 * options.coefficients[3];

    // Input/output Proxy.
    this.input = this._input;
    this.output = this._merger;
  }


  /**
   * @class VirtualSpeaker
   * @description A virtual speaker with ambisonic decoding gain coefficients
   *              and HRTF convolution for first-order-ambisonics stream.
   *              Note that the subgraph directly connects to context's
   *              destination.
   * @param {AudioContext} context        Associated AudioContext.
   * @param {Object} options              Options for speaker.
   * @param {Array} options.coefficients  Decoding coefficients for (W,X,Y,Z).
   * @param {AudioBuffer} options.IR      Stereo IR buffer for HRTF convolution.
   * @param {Number} options.gain         Post-gain for the speaker.
   */
  function VirtualSpeaker (context, options) {
    if (options.IR.numberOfChannels !== 2)
      throw 'IR does not have 2 channels. cannot proceed.';

    this._context = context;

    this._input = this._context.createChannelSplitter(4);
    this._cW = this._context.createGain();
    this._cX = this._context.createGain();
    this._cY = this._context.createGain();
    this._cZ = this._context.createGain();
    this._convolver = this._context.createConvolver();
    this._gain = this._context.createGain();

    this._input.connect(this._cW, 0);
    this._input.connect(this._cX, 1);
    this._input.connect(this._cY, 2);
    this._input.connect(this._cZ, 3);
    this._cW.connect(this._convolver);
    this._cX.connect(this._convolver);
    this._cY.connect(this._convolver);
    this._cZ.connect(this._convolver);
    this._convolver.connect(this._gain);
    this._gain.connect(context.destination);

    this._convolver.buffer = options.IR;
    this._gain.gain.value = options.gain;

    // Set gain coefficients for FOA ambisonic streams.
    this._cW.gain.value = options.coefficients[0];
    this._cX.gain.value = options.coefficients[1];
    this._cY.gain.value = options.coefficients[2];
    this._cZ.gain.value = options.coefficients[3];

    // Input proxy.
    this.input = this._input;
  }


  /**
   * Streamlined audio file loader supports Promise.
   * @param {Object} context          AudioContext
   * @param {Object} audioFileData    Audio file info as [{name, url}]
   * @param {Function} resolve        Resolution handler for promise.
   * @param {Function} reject         Rejection handler for promise.
   * @param {Function} progress       Progress event handler.
   */
  function AudioBufferManager(context, audioFileData, resolve, reject, progress) {
    this._context = context;

    this._buffers = new Map();
    this._loadingTasks = {};

    this._resolve = resolve;
    this._reject = reject;
    this._progress = progress;

    // Iterating file loading.
    for (var i = 0; i < audioFileData.length; i++) {
      var fileInfo = audioFileData[i];

      // Check for duplicates filename and quit if it happens.
      if (this._loadingTasks.hasOwnProperty(fileInfo.name)) {
        console.log('[AudioBufferManager] Duplicated filename when loading: '
          + fileInfo.name);
        return;
      }

      // Mark it as pending (0)
      this._loadingTasks[fileInfo.name] = 0;
      this._loadAudioFile(fileInfo);
    }
  }

  AudioBufferManager.prototype._loadAudioFile = function (fileInfo) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', fileInfo.url);
    xhr.responseType = 'arraybuffer';

    var that = this;
    xhr.onload = function () {
      if (xhr.status === 200) {
        that._context.decodeAudioData(xhr.response,
          function (buffer) {
            console.log('[AudioBufferManager] File loaded: ' + fileInfo.url);
            that._done(fileInfo.name, buffer);
          },
          function (message) {
            console.log('[AudioBufferManager] Decoding failure: '
              + fileInfo.url + ' (' + message + ')');
            that._done(fileInfo.name, null);
          });
      } else {
        console.log('[AudioBufferManager] XHR Error: ' + fileInfo.url + ' ('
          + xhr.statusText + ')');
        that._done(fileInfo.name, null);
      }
    };

    xhr.onerror = function (event) {
      console.log('[AudioBufferManager] XHR Network failure: ' + fileInfo.url);
      me._done(fileInfo.name, null);
    };

    xhr.send();
  };

  AudioBufferManager.prototype._done = function (filename, buffer) {
    // Label the loading task.
    this._loadingTasks[filename] = buffer !== null ? 'loaded' : 'failed';

    // A failed task will be a null buffer.
    this._buffers.set(filename, buffer);

    this._updateProgress(filename);
  };

  AudioBufferManager.prototype._updateProgress = function (filename) {
    var numberOfFinishedTasks = 0, numberOfFailedTask = 0;
    var numberOfTasks = 0;

    for (var task in this._loadingTasks) {
      numberOfTasks++;
      if (this._loadingTasks[task] === 'loaded')
        numberOfFinishedTasks++;
      else if (this._loadingTasks[task] === 'failed')
        numberOfFailedTask++;
    }

    if (typeof this._progress === 'function')
      this._progress(filename, numberOfFinishedTasks, numberOfTasks);

    if (numberOfFinishedTasks === numberOfTasks)
      this._resolve(this._buffers);

    if (numberOfFinishedTasks + numberOfFailedTask === numberOfTasks)
      this._reject(this._buffers);
  };


  /**
   * Load an audio file asynchronously.
   * @param {Array} dataModel           Array of audio file info: [{name, url}].
   * @param {Function} onprogress       Callback function for reporting the
   *                                    progress.
   * @return {Promise}
   */
  AudioContextPrototype.loadAudioFiles = function (dataModel, onprogress) {
    return new Promise(function (resolve, reject) {
      new AudioBufferManager(this, dataModel, resolve, reject, onprogress);
    }.bind(this));
  };

  // Factory.
  return {

    /**
     * Create an instance of Rotator. For parameters, refer the
     * definition of Rotator class.
     * @return {Object}
     */
    createRotator: function (context) {
      return new Rotator(context);
    },

    /**
     * Create an instance of PhaseMatchedFilter. For parameters, refer the
     * definition of PhaseMatchedFilter class.
     * @return {Object}
     */
    createPhaseMatchedFilter: function (context, options) {
      return new PhaseMatchedFilter(context, options);
    },

    /**
     * Create an instance of VirtualSpeaker. For parameters, refer the
     * definition of VirtualSpeaker class.
     * @return {Object}
     */
    createVirtualSpeaker: function (context, options) {
      return new VirtualSpeaker(context, options);
    }

  };

})(window.AudioContext.prototype);
