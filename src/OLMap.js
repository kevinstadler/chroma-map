import React from 'react';
import 'ol/ol.css';

import Map from 'ol/Map.js';
import View from 'ol/View.js';
import {FullScreen, Rotate, ScaleLine, Zoom} from 'ol/control';
import {DragRotateAndZoom, defaults as defaultInteractions} from 'ol/interaction';

import {Image as ImageLayer, Tile as TileLayer, VectorTile as VectorTileLayer} from 'ol/layer';
import {VectorTile, XYZ} from 'ol/source';
import RasterSource from 'ol/source/Raster';

class OLMap extends React.Component {

  constructor(props) {
    super(props);
    this.state = {}
  }

  componentDidMount() {
    this.map = new Map({
      layers: [],
      controls: [
        new Zoom(),
        new FullScreen(),
        new Rotate(),
//        new Rotate({ autoHide: false, resetNorth: resetToEitherPole }),
//        new GenericControl(document.getElementById('attributions'), this.props.toggleOverlay),
        // new LayerSwitcher({
        //   reverse: false,
        //   tipLabel: 'community overlays', // Optional label for button
        //   groupSelectStyle: 'none' // Can be 'children' [default], 'group' or 'none'
        // }),
        new ScaleLine({
          units: 'metric'
        }),
      ],
      interactions: defaultInteractions().extend([new DragRotateAndZoom()]),
      target: this.props.id,
      view: new View({
        center: [0, 0],
        zoom: 3,
        minZoom: 0,
        maxZoom: 20
      })
    });

    const operation = (inputs, params) => {
      const out = new ImageData(inputs[0].width, inputs[0].height);
      const operationNames = ['sortValues', 'sortByHue', 'sortByR', 'sortbyG', 'sortByB', 'sortByLightness', 'shufflePixels', 'shuffleEverything', 'shuffleChannelsSeparately'];
      const operations = [
        (all) => [all],
        (all) => {
          const vs = new Array(all.length / 4);
          let delta, mx;
          for (let i = 0; i < vs.length; i++) {
            mx = Math.max(...all.slice(4*i, 4*i + 3));
            delta = (mx - Math.min(...all.slice(4*i, 4*i + 3))) / 255;
            vs[i] = (mx === all[4*i]) ? ((all[4*i + 1] - all[4*i + 2]) / delta % 6) : // max = R: G-B
              ((mx === all[4*i + 1]) ? ((all[4*i + 2] - all[4*i]) / delta + 2): // max = G: B-R
                ((all[4*i] - all[4*i + 1]) / delta + 4)); // max = B: R - G
          }
          return [vs];
        },
        (all) => [all.filter((el, i) => i % 4 === 0)],
        (all) => [all.filter((el, i) => i % 4 === 1)],
        (all) => [all.filter((el, i) => i % 4 === 2)],
        (all) => {
          const vs = new Array(all.length / 4);
          for (let i = 0; i < vs.length; i++) {
            vs[i] = -(all[4*i] + all[4*i + 1] + all[4*i + 2]);
          }
          return [vs];
        },
        (all) => [ (new Array(all.length/4)).fill(0).map(() => Math.random()) ],
        (all) => [ all.map(() => Math.random()) ],
        (all) => new Array(4).fill(0).map(() => (new Array(all.length/4)).fill(0).map(() => Math.random())),
      ];
      let opIndex = operationNames.indexOf(params.operation);

      // split into chunks
      let rowwiseOffsets, effectiveChunkHeight, effectiveChunkWidth, chunk, perChannelValues, repetitions, perChannelOrder, totalOrder;
      for (let x = 0; x < inputs[0].width; x = x + params.chunkWidth) {
        for (let y = 0; y < inputs[0].height; y = y + params.chunkHeight) {
          // gotta take (up to) chunkHeight slices of width 4*chunkWidth
          // the offset of the first such slice is at y*4*inputs[0].width + x, every 4*inputs[0].width
          effectiveChunkHeight = Math.min(y + params.chunkHeight, inputs[0].height) - y;
          rowwiseOffsets = new Array(effectiveChunkHeight).fill().map((el, i) => 4 * ((y + i) * inputs[0].width + x));
          // sometimes chunkwidth is too far
          effectiveChunkWidth = Math.min(params.chunkWidth, inputs[0].width - x);

          chunk = rowwiseOffsets.flatMap((offset) => Array.from(inputs[0].data.subarray(offset, offset + 4 * effectiveChunkWidth)));

          if (params.operation === 'demo') {
//            opIndex = Math.floor(operations.length * Math.random());
            opIndex = (opIndex + 1) % operations.length;
          }
//          console.log('imposing order');
          perChannelValues = operations[opIndex](chunk).map((vs) => vs.map((v, i) => [v, i]));
          // the result is an array of 1 OR 4 subarrays (which are the different channels that should be interleaved)
          repetitions = chunk.length / (perChannelValues.length * perChannelValues[0].length);
          perChannelOrder = perChannelValues.map((channelValues) => channelValues.sort((a, b) => a[0] - b[0]).map((el) => el[1]));

          // totalOrder = perChannelOrder[0].flatMap((e, i) => new Array(repetitions).fill(0).flatMap(() => perChannelOrder).map((all, channel) => repetitions * perChannelOrder.length * all[i] + channel));
          // totalOrder.forEach((ind, i) => out.data[rowwiseOffsets[Math.floor(i / (4*effectiveChunkWidth))] + i % (4*effectiveChunkWidth)] = chunk[ind]);
          // avoid flatMap if we have just one channel (in which case the type of array might still be correct)
//          console.log('interleave order');
          if (perChannelOrder[0].length === chunk.length) {
            // TODO could do this the other way around, rowwiseOffsets.map((offset, row) => ...)
            perChannelOrder[0].forEach((ind, i) => out.data[rowwiseOffsets[Math.floor(i / (4*effectiveChunkWidth))] + i % (4*effectiveChunkWidth)] = chunk[ind]);
          } else if (perChannelOrder.length === 1) {
            // FIXME this is broken
            perChannelOrder[0].forEach((ind, i) => out.data.set(chunk.slice(4*ind, 4*ind + 4), rowwiseOffsets[Math.floor(i / (4*effectiveChunkWidth))] + i % (4*effectiveChunkWidth)));
          // rowwiseOffsets.forEach((offset, i) => {
          //   out.data.set(array, )
          // });
          // TODO if the channels are too few, use set() instead of individual assignment??
          // TODO ignore indexes %4 = 3, they should always be 255
          } else {
            console.log('TODO');
            // the full interleave shebang...
            // otherwise: interleave (and repeat if not enough data)
            // FIXME this is the inefficient bit, just repeat the forEach loop below instead of actually creating the damn arrays...
//            perChannelOrder[0].flatMap((e, i) => new Array(repetitions).fill(0).flatMap(() => perChannelOrder).map((all, channel) => repetitions * perChannelOrder.length * all[i] + channel)).forEach((ind, i) => out.data[rowwiseOffsets[Math.floor(i / (4*effectiveChunkWidth))] + i % (4*effectiveChunkWidth)] = chunk[ind]);
          }
        }
      }
      return out;
    };

    const source = new RasterSource({
      operationType: 'image',
      operation: operation,
      // lib: { // doesn't work with webpack or something!?
      //   operations: operations,
      // },
//      threads: 0,
      sources: [new XYZ({
//        url: 'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png?access_token=pk.eyJ1Ijoia2V2aW5zdGFkbGVyIiwiYSI6ImNrY2VpeXdhdTA4djMydXN3MDV0ZDJ0amIifQ.6b5eLFc7eI7UcMuaj7e2LQ',
        url: 'https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key=y2DjYn124z5IfjLvXdb3',
        maxZoom: 20,
        attributions: 'TODO',
        crossOrigin: 'anonymous',
      })],
    });
    source.on('beforeoperations', (e) => {
      e.data.operation = 'demo';//'sortByLightness';
      e.data.chunkWidth = 64;
      e.data.chunkHeight = 64;
      // e.data.chunkWidth = this.map.getSize()[0]/2;
      // e.data.chunkHeight = this.map.getSize()[1]/2;
    });

    this.map.addLayer(new ImageLayer({
      source: source,
      title: 'TODO',
    }));
  }

  shouldComponentUpdate(newProps, newState) {
    // if (newState !== this.state || newProps.debug !== this.props.debug) {
    //   return true;
    // }
    this.map.updateSize();
    return false;
  }

  render() {
    return (
      <div className="map" id={this.props.id} style={{ height: this.props.height + 'px' }}>
        <div id="attributions" className="ol-unselectable ol-control"><button type="button" title="What is this map?"><span>?</span></button></div>
      </div>
    );
  }
}

export default OLMap;
