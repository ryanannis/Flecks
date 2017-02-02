![Flecks Logo](https://cloud.githubusercontent.com/assets/4493022/22388211/42902c4a-e494-11e6-864a-dcdc03932f7a.png)

## What is this?
This is an pure WebGL implementation of Voronoi Stippling as described in [this](https://www.cs.ubc.ca/labs/imager/tr/2002/secord2002b/secord.2002b.pdf) paper.
The entire core algorithm could be done in WebGL which makes this very fast compared to similar implementations.

## What does this do?
This is an artistic photo filter.  By inputting an image it will output a [stippled](https://en.wikipedia.org/wiki/Stippling) version.

## Usage

Github pages is coming soon.

## Images

## System Requirements

### WebGL 2

Your graphics card and browser must support WebGL 2 and the EXT_color_buffer_float extension.  Edge and Safari do not support this but the latest versions of Mozilla Firefox, Google Chrome, Opera and Google Ultron do.

### Settings

This program is limited by GPU memory.  A less memory-intensive algorithm is possible but is very complicated to implement.  Most modern GPUs will work, but a discrete card is reccomended for high amounts of stipples (20k+), high-res input images or supersampling.

## Attribution 

Credits to Adrian Secord for the original paper this implementation was based off, [Matt Keeter](www.mattkeeter.com) for his approach to generating centroidal Voronoi diagrams on GPU and http://www.comp.nus.edu.sg/~tants/pba.html for the scanning GPU algorithm.

## License 

GPL
