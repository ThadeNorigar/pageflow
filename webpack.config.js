const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const frontendDir = path.resolve(__dirname, 'src/frontend');

module.exports = {
  context: frontendDir,
  entry: './index.tsx',
  output: {
    path: path.resolve(frontendDir, 'build'),
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
