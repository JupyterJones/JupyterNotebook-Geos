#include <clipping_planes_pars_fragment>

uniform sampler2D map;
uniform sampler2D colormap;
uniform float low;
uniform float high;

varying vec2 vUv;

void main() {
    #include <clipping_planes_fragment>

    vec4 tcolor = texture2D(map, vUv);
    float value = ( tcolor.x - low ) / ( high - low);

    vec4 color = texture2D(colormap, vec2(value, 0.5));
    gl_FragColor = vec4(color.xyz, 1.0);
}