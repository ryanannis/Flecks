# WebGL Voroni Approximator

### What is this?
A Voronoi diagram partitions a plane into a set of regions based off the distance from a set of points (look at the pictures).

This is a utilty for efficiently generating approximations of Voronoi diagrams using WebGL.

### Usage

#### Installation
Using the included CommonJS Imports

```
import VoroniRendere = require('VoroniRender');
```

The bundled copy can also be directly copied out of dist/bundle.js and then used in a script tag.
 
#### Usage

The renderer is initialized as an object which is passed a the resolution of the generated diagram, and the number of edges to use in the approximation (default 100).

addPoint() adds a source at point (x,y) and render() renders the diagram.
```
VoroniRenderer(width, height, approximationEdges);
VoroniRender.addPoint(x,y);
VoroniRender.render();
```

### Examples
Basic
```
const voroni = new VoroniRenderer(500, 500, 200);
const body = document.getElementsByTagName("BODY")[0];
voroni.addPoint(20,30);
voroni.addPoint(10,15);
voroni.addPoint(430,320);
voroni.render();
body.appendChild(voroni.getCanvasDOMNode());
```

### Images

### Why was this created?

I originally created this repository because I needed a Voronoi implementation to implement Voronoi stippling over [here](https://github.com/minimumcut/Mazes).
