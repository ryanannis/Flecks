[![Flecks Logo](https://minimumcut.github.io/Flecks/static/logo.png)](https://minimumcut.github.io/Flecks/)

## What is this?
This is an pure WebGL implementation of Voronoi Stippling as described in [this](https://www.cs.ubc.ca/labs/imager/tr/2002/secord2002b/secord.2002b.pdf) paper.
The entire core algorithm is implemented in WebGL which makes this very fast compared to similar implementations.

## What does this do?
This is an artistic photo filter.  By inputting an image it will output a [stippled](https://en.wikipedia.org/wiki/Stippling) version.  There are configurations for parameters such as supersampling, and number of points.

## Usage

Visit the application at https://minimumcut.github.io/Flecks/

## Images

![Sample Image 1](https://minimumcut.github.io/Flecks/static/samples/lenna_stipples.png)

![Sample Image 2](https://minimumcut.github.io/Flecks/static/samples/tiger.png)

![Sample Image 3](https://minimumcut.github.io/Flecks/static/samples/cat.png)

## System Requirements

The algorithm is very system intensive and will require significant amounts of GPU memory.  You should avoid heavy loads when not using a dedicated GPU.

Additionally, your graphics card and browser must support WebGL 2 and the EXT_color_buffer_float extension.  Edge and Safari do not support this but the latest versions of Mozilla Firefox, Google Chrome, Opera and Google Ultron do.

## Attribution 

Credits to Adrian Secord for the original paper this implementation was based off, [Matt Keeter](www.mattkeeter.com) for his approach to generating centroidal Voronoi diagrams on GPU and http://www.comp.nus.edu.sg/~tants/pba.html for the information on generating centroidal Voronoi graphs on the GPU.

## License 

GPL V2