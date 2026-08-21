const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const frontendDir = path.resolve(__dirname, 'src/frontend');

module.exports = {
  context: frontendDir,
  entry: './index.tsx',
  output: {
    // Bewusst AUSSERHALB von src/: Forge CLI 13 typ-lintet jede Datei unter src/
    // gegen die Root-tsconfig. Ein Webpack-Bundle steht in keiner tsconfig, und
    // `forge lint` (und damit `forge deploy`) bricht dann ab.
    path: path.resolve(__dirname, 'static/frontend'),
    filename: 'bundle.js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(frontendDir, 'tsconfig.json'),
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttf$/,
        type: 'asset/inline',
        generator: {
          // pdfMake.vfs erwartet rohes Base64 ohne data:-Prefix
          dataUrl: (content) => content.toString('base64'),
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(frontendDir, 'public/index.html'),
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
  },
};
