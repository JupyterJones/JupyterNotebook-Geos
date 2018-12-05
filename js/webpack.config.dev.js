// Custom webpack loaders are generally the same for all webpack bundles, hence
// stored in a separate local variable.
var rules = [
    {
        test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
        use: 'url-loader'
    },
    {
        test: /\.glsl/,
        use: 'raw-loader'
    },
    {
        test: /\.worker\.js$/,
        use: {
            loader: 'worker-loader',
            options: {inline: true, fallback: false}
        }
    }
];

var plugins = [];

module.exports = [
    {
        entry: './src/development.js',
        output: {
            filename: 'index.js',
            path: __dirname + '/dev/',
            publicPath: "/dev/",
            library: "K3D",
            libraryTarget: 'amd'
        },
        devtool: 'source-map',
        module: {
            rules: rules
        },
        plugins: plugins
    }
];
