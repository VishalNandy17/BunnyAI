const path = require('path');

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    target: 'node',
    entry: {
        extension: './src/extension.ts'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        libraryTarget: 'commonjs',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    devtool: 'nosources-source-map',
    externals: {
        vscode: 'commonjs vscode'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    },
    ignoreWarnings: [
        {
            module: /node_modules\/typescript/,
            message: /Critical dependency: the request of a dependency is an expression/
        }
    ]
};
