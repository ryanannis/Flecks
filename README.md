# Flecks

## Warning:  This is a Work in Progress.  It is currently functional but has many limitations that are being ironed out currently.

### What is this?
This is an nearly-pure WebGL implementation of Voronoi Stippling as described in [this](https://www.cs.ubc.ca/labs/imager/tr/2002/secord2002b/secord.2002b.pdf) paper.
Most of the core algorithm could be done in WebGL which makes this very fast compared to similar implementations.

### What does this do?
This is an artistic photo filter.  By inputting an image it will output a [stippled](https://en.wikipedia.org/wiki/Stippling) version.

### Usage

### Images

###  WebGL Limitations

The number of stipples that can be generated is limited to the maximum horizontal texture size, which is dependant on the client.  This is usually
4096 for newer mobile devices or 16834 for 

The implementation is also much slower than it could be in WebGL 2.0 (which is not uniformly supported across major browser vendors) due to lack of 
instancing and tranform feedback.

### Attribution 

Credits to Adrian Secord for the original paper and [Matt Keeter](www.mattkeeter.com) for his approach to generating centroidal Voronoi diagrams on GPU.

### License 

[!License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](http://creativecommons.org/licenses/by-nc/4.0/)

