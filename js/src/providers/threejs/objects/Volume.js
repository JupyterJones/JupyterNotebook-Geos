'use strict';

var lut = require('./../../../core/lib/helpers/lut');
var _ = require('lodash');
var closestPowOfTwo = require('./../helpers/Fn').closestPowOfTwo;

/**
 * Loader strategy to handle Volume object
 * @method Volume
 * @memberof K3D.Providers.ThreeJS.Objects
 * @param {Object} config all configurations params from JSON
 * @param {K3D}
 * @return {Object} 3D object ready to render
 */
module.exports = function (config, K3D) {
    config.samples = config.samples || 512.0;
    config.alpha_coef = config.alpha_coef || 50.0;
    config.gradient_step = config.gradient_step || 0.005;
    config.shadow = config.shadow || 'off';
    config.shadow_delay = config.shadow_delay || 500;
    config.shadow_res = closestPowOfTwo(config.shadow_res || 128);

    // config.shadow_res = 256;
    // config.shadow = 'dynamic';
    // config.samples = 512;

    var gl = K3D.getWorld().renderer.context,
        geometry = new THREE.BoxBufferGeometry(1, 1, 1),
        modelMatrix = new THREE.Matrix4(),
        translation = new THREE.Vector3(),
        rotation = new THREE.Quaternion(),
        scale = new THREE.Vector3(),
        maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE),
        lightMapSize = config.shadow_res,
        lightMapRenderTargetSize,
        colorMap = (config.color_map && config.color_map.data) || null,
        colorRange = config.color_range,
        samples = config.samples,
        sceneRTT,
        cameraRTT,
        quadRTT,
        textureRTT,
        object,
        texture,
        jitterTexture,
        listenersId,
        timeoutId,
        lastShadowMapUpdated = 0;

    lightMapSize = (lightMapSize > 512 ? 512 : lightMapSize);
    lightMapRenderTargetSize = closestPowOfTwo(Math.sqrt(lightMapSize * lightMapSize * lightMapSize));

    if (lightMapRenderTargetSize > maxTextureSize) {
        throw new Error('To big light map size. gl.MAX_TEXTURE_SIZE=' + maxTextureSize);
    }

    modelMatrix.set.apply(modelMatrix, config.model_matrix.data);
    modelMatrix.decompose(translation, rotation, scale);

    texture = new THREE.Texture3D(
        new Float32Array(config.volume.data),
        config.volume.shape[2],
        config.volume.shape[1],
        config.volume.shape[0],
        THREE.RedFormat,
        THREE.FloatType);

    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    jitterTexture = new THREE.DataTexture(
        new Uint8Array(_.range(32 * 32).map(function () {
            return 255.0 * Math.random();
        })),
        32, 32, THREE.RedFormat, THREE.UnsignedByteType);
    jitterTexture.minFilter = THREE.LinearFilter;
    jitterTexture.magFilter = THREE.LinearFilter;
    jitterTexture.wrapS = jitterTexture.wrapT = THREE.RepeatWrapping;
    jitterTexture.generateMipmaps = false;
    jitterTexture.needsUpdate = true;

    var canvas = lut(colorMap, 1024);
    var colormap = new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.ClampToEdgeWrapping,
        THREE.ClampToEdgeWrapping, THREE.NearestFilter, THREE.NearestFilter);
    colormap.needsUpdate = true;

    if (config.shadow !== 'off') {
        textureRTT = new THREE.WebGLRenderTarget(lightMapRenderTargetSize, lightMapRenderTargetSize, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RedFormat,
            type: THREE.UnsignedByteType,
            generateMipmaps: false,
            stencilBuffer: false,
            depthBuffer: false
        });
    }

    var uniforms = {
        lightMapSize: {value: new THREE.Vector3(lightMapSize, lightMapSize, lightMapSize)},
        volumeMapSize: {value: new THREE.Vector3(config.volume.shape[2], config.volume.shape[1], config.volume.shape[0])},
        lightMapRenderTargetSize: {value: new THREE.Vector2(lightMapRenderTargetSize, lightMapRenderTargetSize)},
        low: {value: colorRange[0]},
        high: {value: colorRange[1]},
        samples: {value: samples},
        alpha_coef: {value: config.alpha_coef},
        gradient_step: {value: config.gradient_step},
        translation: {value: translation},
        rotation: {value: rotation},
        scale: {value: scale},
        volumeTexture: {type: 't', value: texture},
        shadowTexture: {type: 't', value: (textureRTT ? textureRTT.texture : null)},
        colormap: {type: 't', value: colormap},
        jitterTexture: {type: 't', value: jitterTexture}
    };

    var material = new THREE.ShaderMaterial({
        uniforms: _.merge(
            uniforms,
            THREE.UniformsLib.lights
        ),
        defines: {
            USE_SPECULAR: 1,
            USE_SHADOW: (config.shadow !== 'off' ? 1 : 0)
        },
        vertexShader: require('./shaders/Volume.vertex.glsl'),
        fragmentShader: require('./shaders/Volume.fragment.glsl'),
        side: THREE.BackSide,
        depthTest: false,
        lights: true,
        clipping: true,
        transparent: true
    });

    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    object = new THREE.Mesh(geometry, material);
    object.applyMatrix(modelMatrix);
    object.updateMatrixWorld();

    /*
        Light Map support
     */
    if (config.shadow !== 'off') {
        sceneRTT = new THREE.Scene();
        quadRTT = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(lightMapRenderTargetSize, lightMapRenderTargetSize),
            new THREE.ShaderMaterial({
                uniforms: _.merge(
                    uniforms,
                    THREE.UniformsLib.lights,
                    {
                        lightDirection: {type: 'v3', value: new THREE.Vector3()}
                    }
                ),
                defines: {
                    USE_MAP: 1
                },
                vertexShader: require('./shaders/Volume.lightmap.vertex.glsl'),
                fragmentShader: require('./shaders/Volume.lightmap.fragment.glsl'),
                clipping: true,
                depthWrite: false,
                depthTest: false
            }));

        // for clipping planes
        quadRTT.applyMatrix(modelMatrix);
        quadRTT.updateMatrixWorld();

        cameraRTT = new THREE.OrthographicCamera(
            lightMapRenderTargetSize / -2, lightMapRenderTargetSize / 2,
            lightMapRenderTargetSize / 2, lightMapRenderTargetSize / -2,
            -10000, 10000);

        cameraRTT.position.z = 100;
        sceneRTT.add(quadRTT);

        object.refreshLightMap = function (direction) {
            if (textureRTT) {
                var renderer = K3D.getWorld().renderer;
                var cameraPosition = new THREE.Vector3();

                if (direction) {
                    quadRTT.material.uniforms.lightDirection.value.fromArray(direction).normalize();
                } else {
                    K3D.getWorld().camera.getWorldPosition(cameraPosition);
                    quadRTT.material.uniforms.lightDirection.value.copy(
                        translation.clone().sub(cameraPosition).normalize()
                    );
                }

                K3D.getWorld().camera.updateMatrixWorld();

                // quadRTT.material.uniforms.customModelViewMatrix.value.multiplyMatrices(
                //     K3D.getWorld().camera.matrixWorldInverse, quadRTT.matrixWorld
                // );
                //
                // console.log(quadRTT.material.uniforms.customModelViewMatrix.value, object.modelViewMatrix);

                quadRTT.material.uniformsNeedUpdate = true;

                renderer.clippingPlanes = [];
                K3D.parameters.clippingPlanes.forEach(function (plane) {
                    renderer.clippingPlanes.push(new THREE.Plane(new THREE.Vector3().fromArray(plane), plane[3]));
                });

                renderer.clearTarget(textureRTT, true, true, true);
                renderer.render(sceneRTT, cameraRTT, textureRTT);
            }
        };

        if (config.shadow === 'dynamic') {
            listenersId = K3D.on(K3D.events.BEFORE_RENDER, function () {
                var now = new Date().getTime();

                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                // check if we should updated shadow map because user interaction
                if (now - lastShadowMapUpdated >= config.shadow_delay) {
                    object.refreshLightMap();
                    lastShadowMapUpdated = now;
                } else {
                    // handle last update on end of user interaction
                    timeoutId = setTimeout(function () {
                        object.refreshLightMap();
                        lastShadowMapUpdated = now;
                        K3D.render();
                    }, Math.max(config.shadow_delay, 500));
                }
            });
        }

        object.refreshLightMap();
    }

    object.onRemove = function () {
        object.material.uniforms.volumeTexture.value.dispose();
        object.material.uniforms.volumeTexture.value = undefined;
        object.material.uniforms.colormap.value.dispose();
        object.material.uniforms.colormap.value = undefined;

        if (sceneRTT) {
            sceneRTT = undefined;
        }

        if (cameraRTT) {
            cameraRTT = undefined;
        }

        if (textureRTT) {
            textureRTT.dispose();
            textureRTT = undefined;
        }

        if (listenersId) {
            K3D.off(K3D.events.BEFORE_RENDER, listenersId);
        }
    };

    // PREVIEW
    // var objectGroup = new THREE.Group();
    // var quad = new THREE.Mesh(
    //     new THREE.PlaneBufferGeometry(150, 150),
    //     new THREE.MeshBasicMaterial({
    //         color: 0xffffff,
    //         map: textureRTT.texture
    //     })
    // );
    //
    // quad.position.x = -200;
    // quad.geometry.computeBoundingSphere();
    // quad.geometry.computeBoundingBox();
    //
    // objectGroup.add(object);
    // objectGroup.add(quad);
    //
    // var listenersId = K3D.on(K3D.events.RENDERED, function () {
    //     object.refreshLightMap();
    // });
    // object.refreshLightMap();
    //
    // objectGroup.onRemove = function () {
    //     K3D.off(K3D.events.RENDERED, listenersId);
    // };
    //
    // return Promise.resolve(objectGroup);

    return Promise.resolve(object);
};
