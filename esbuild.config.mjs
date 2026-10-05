import { build } from 'esbuild';

// Plugin that replaces optional/unavailable packages with empty modules
// instead of marking them as external (which requires runtime require())
const optionalDepsPlugin = {
  name: 'optional-deps',
  setup(build) {
    const optionalDeps = [
      '@nestjs/microservices',
      '@nestjs/websockets',
      '@nestjs/platform-socket.io',
      '@nestjs/platform-fastify',
      'class-transformer/storage',
      'pg-native',
    ];

    // Create a filter regex that matches the optional deps and their sub-paths
    const filter = new RegExp(
      '^(' + optionalDeps.map(d => d.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')).join('|') + ')(\/.*)?$'
    );

    build.onResolve({ filter }, (args) => ({
      path: args.path,
      namespace: 'optional-dep',
    }));

    build.onLoad({ filter: /.*/, namespace: 'optional-dep' }, () => ({
      contents: 'module.exports = {};',
      loader: 'js',
    }));
  },
};

await build({
  entryPoints: ['dist/worker.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  outfile: 'dist/_worker.mjs',
  minify: true,
  plugins: [optionalDepsPlugin],
  // Provide a working require() for dynamic requires of Node.js built-ins
  // (e.g. require('stream') in pg/ioredis). Uses a fixed path since
  // import.meta.url is undefined in Cloudflare Workers.
  banner: {
    js: `import{createRequire as __cf_cjsRequire}from"node:module";const require=__cf_cjsRequire("file:///");`,
  },
});

console.log('Worker bundle built: dist/_worker.mjs');
