module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': '../..',
            '@/packages': '../../packages',
            '@/services': './src/services',
            '@/components': './src/components',
            '@/screens': './src/screens',
            '@/context': './src/context',
            '@/hooks': './src/hooks',
            '@/utils': './src/utils',
            '@/types': './src/types',
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        },
      ],
    ],
  };
};
