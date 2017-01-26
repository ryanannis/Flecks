# Voronoi Stippling

## Warning:  This is a Work in Progress

### What is this?
This is an nearly-pure WebGL implementation of Voronoi Stippling as described in [this](https://www.cs.ubc.ca/labs/imager/tr/2002/secord2002b/secord.2002b.pdf) paper.
Most of the core algorithm could be done in WebGL which makes this very fast. However unfortunately due to sketchy feedback transform support in WebGL
(Feedback Transform is an extension in WebGL 1.0 and may not be supported everywhere), the transforms on the Voronoi points must be done on-cpu by 
grabbing pixel data off canvas.

### What does this do?
This is an artistic photo filter.  By inputting an image it will output a [stippled](https://en.wikipedia.org/wiki/Stippling) version.

### Usage

### Images

### Attribution 

Credits to Adrian Secord for the original paper and [Matt Keeter](www.mattkeeter.com) for his approach to generating centroidal Voronoi diagrams on GPU.