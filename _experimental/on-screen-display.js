/*<!-- on-screen guide overlay -->
    <svg id="eOnScreenGuideSVG" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask id="eSpotMasks">
          <rect width="100%" height="100%" fill="white" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#eSpotMasks)" />
    </svg>
*/


      _displayOnScreenGuide: function () {
        var targets = [{
          element: this.$.eBtnStop,
          info: 'nice and cool UI elements!'
        }, {
          element: this.$.eBtnPlay,
          info: 'nice and cool UI elements!'
        }, {
          element: this.$.eBtnLoop,
          info: 'nice and cool UI elements!'
        }, {
          element: this.$.eBtnExport,
          info: 'nice and cool UI elements!'
        }, {
          element: this.$.eMiniMap,
          info: 'nice and cool UI elements!'
        }, {
          element: this.$.eWaveform,
          info: 'nice and cool UI elements!'
        }, {
          element: this.$.eSplitter,
          info: 'nice and cool UI elements!'
        }, {
          element: this.$.eBtnRender,
          info: 'nice and cool UI elements!'
        }, {
          element: this.$.eBtnViewChange,
          info: 'nice and cool UI elements!'
        }, {
          element: this.$.eBtnOpenLocalFile,
          info: 'nice and cool UI elements!'
        }, {
          element: this.$.eBtnOpenGist,
          info: 'nice and cool UI elements!'
        }];

        for (var i = 0; i < targets.length; ++i) {
          var bbox = targets[i].element.getBoundingClientRect();
          
          var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          circle.setAttribute('cx', bbox.left + (bbox.right - bbox.left) / 2);
          circle.setAttribute('cy', bbox.top + (bbox.bottom - bbox.top) / 2);
          circle.setAttribute('r', 16);
          circle.setAttribute('fill', 'black');
          this.$.eSpotMasks.appendChild(circle);

          var tooltip = document.createElementNS("http://www.w3.org/2000/svg", "text");
          tooltip.setAttribute('x', bbox.right + 10);
          tooltip.setAttribute('y', bbox.top + (bbox.bottom - bbox.top) / 2);
          tooltip.setAttribute('style', 'font-family: Arial; font-size: 14px; fill: #fff');
          tooltip.textContent = targets[i].info;
          this.$.eOnScreenGuideSVG.appendChild(tooltip);
        }
      },
