![Flecks Logo](https://cloud.githubusercontent.com/assets/4493022/22388211/42902c4a-e494-11e6-864a-dcdc03932f7a.png)

## Warning:  This is a Work in Progress.  It is currently functional but has many limitations that are being ironed out currently.

## What is this?
This is an nearly-pure WebGL implementation of Voronoi Stippling as described in [this](https://www.cs.ubc.ca/labs/imager/tr/2002/secord2002b/secord.2002b.pdf) paper.
Most of the core algorithm could be done in WebGL which makes this very fast compared to similar implementations.

## What does this do?
This is an artistic photo filter.  By inputting an image it will output a [stippled](https://en.wikipedia.org/wiki/Stippling) version.

## Usage

Todo: Github Pages

## Images

## System Requirements

Your graphics card and browser must support at least WebGL 1.0 and the EXT_color_buffer_float extension.  WebGL 2.0 support is highly recommended.  The lastest versions of Mozilla Firefox, Google Chrome, Opera and Google Ultron support WebGL 2.0.

##  WebGL Limitations

The number of stipples that can be generated is limited to the maximum horizontal texture size, which is dependant on the client.  This is usually
4096 for newer mobile devices, 16834 for modern desktops or up to 67336 for high end desktop.

The implementation is also significantly slower and has much lower precision when using the WebGL 1.0 fallback due to lack of transform feedback support in GLES 2.0.

## Attribution 

Credits to Adrian Secord for the original paper, [Matt Keeter](www.mattkeeter.com) for his approach to generating centroidal Voronoi diagrams on GPU and http://www.comp.nus.edu.sg/~tants/pba.html for the scanning GPU algorithm.

## License 

GPL

