const path = require("path");
// MiniCssExtractPlugin is a plugin that extracts CSS into separate files. It creates a CSS file per JS file which contains CSS.
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
// HtmlWebpackPlugin is a plugin that simplifies creation of HTML files to serve your webpack bundles.
const HtmlWebpackPlugin = require("html-webpack-plugin");

// multipage website
// Pages array for HtmlWebpackPlugin
const pages = ["index", "about"];

// Webpack configuration
module.exports = {
  // Define dynamically an entry for each page
  // -------------------------------
  // entry: pages.reduce((config, page) => {
  //   config[page] = `./src/js/${page}.js`;
  //   return config;
  // }, {}),
  entry: "./src/index.js",

  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    publicPath: "/",
    assetModuleFilename: "assets/[name][ext]",
  },

  optimization: {
    minimize: false,
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
  ].concat(
    // Generate multiple html pages
    // For each page name in `pages` array, create a new HtmlWebpackPlugin
    // that uses the corresponding html template in the `src/views` folder
    pages.map(
      (page) =>
        new HtmlWebpackPlugin({
          inject: "body",
          title: `${page} Page`,
          filename: `${page}.html`,
          template: `./src/views/${page}.html`,
        })
    )
  ),

  module: {
    rules: [
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: "/",
            },
          },
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

  devServer: {
    static: {
      directory: path.join(__dirname, "./dist"),
    },
    devMiddleware: {
      writeToDisk: true,
    },
    open: true,
    compress: true,
    liveReload: true,
    hot: true,
    port: 9000,
  },
};
