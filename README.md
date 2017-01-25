# Voronoi Stippling

## Warning:  This is a Work in Progress

### What is this?
This is an nearly-pure WebGL implementation of Voronoi Stippling as described in [this](https://www.cs.ubc.ca/labs/imager/tr/2002/secord2002b/secord.2002b.pdf) paper.
Most of the core algorithm could be done in WebGL which makes this very fast, but a few parts had to be done on CPU due to lack of features in WebGL 1.0 (GLES 2.0).

### What does this do?
This is an artistic photo filter.  By inputting an image it will output a [stippled](https://en.wikipedia.org/wiki/Stippling) version.

### Usage

### Images