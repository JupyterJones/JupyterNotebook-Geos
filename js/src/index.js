// Entry point for the notebook bundle containing custom model definitions.
//
// Setup notebook base URL
//
// Some static assets may be required by the custom widget javascript. The base
// url for the notebook is not known at build time and is therefore computed
// dynamically.
var _ = require('lodash');

// Export widget models and views, and the npm package version number.
module.exports = _.extend({}, require('./k3d.js'));
module.exports.version = require('./version').version;
