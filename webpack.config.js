const path = require("path");
// PugPlugin is a plugin that simplifies creation of HTML files to serve your webpack bundles.
const PugPlugin = require("pug-plugin");
// CleanWebpackPlugin is a plugin that removes/cleans build folders and unused assets when rebuilding.
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

// Webpack configuration
module.exports = {
  output: {
    path: path.resolve(__dirname, "dist"),
    publicPath: "/",
    assetModuleFilename: "assets/[name][ext]",
  },

  optimization: {
    minimize: false,
  },

  plugins: [
    // Clean dist folder
    new CleanWebpackPlugin(),
    // Generate multiple html pages and extract css into files
    new PugPlugin({
      entry: [
        // add pages here
        {
          import: 'src/views/index/index.pug', // Pug template
          filename: 'index.html', // output HTML into dist/index.html
          data: { title: 'Homepage' }, // pass external data into template
        },
        {
          import: 'src/views/about/about.pug',
          filename: 'about/index.html',
          data: { title: 'About' },
        },
      ],
      js: {
        filename: '[name].[contenthash:8].js', // JS output filename
      },
      css: {
        filename: '[name].[contenthash:8].css', // CSS output filename
      },
    }),
  ],

  module: {
    rules: [
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Translates CSS into CommonJS
          "css-loader",
          // Compiles Sass to CSS
          {
            loader: "sass-loader",
            options: {
              // Mute the deprecation warning
              sassOptions: {
                quietDeps: true,
              },
            },
          },
        ],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|webp|avif)$/i,
        // Webpack 5 asset modules
        type: "asset/resource",
      },
    ],
  },

  resolve: {
    alias: {
      "@components": path.resolve(__dirname, "src/components"),
      "@layouts": path.resolve(__dirname, "src/layouts"),
      "@images": path.resolve(__dirname, "src/assets/images"),
      "@scss": path.resolve(__dirname, "src/scss"),
      "@js": path.resolve(__dirname, "src/js"),
    },
  },

  devServer: {
    static: {
      directory: path.join(__dirname, "./dist"),
    },
    // watch ffiles for live reload
    watchFiles: {
      paths: ['src/**/*.*'],
      options: {
        usePolling: true,
      },
    },
    open: true,
    compress: true,
    liveReload: true,
    hot: true,
    port: 9000,
  },
};
