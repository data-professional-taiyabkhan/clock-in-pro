import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function buildServer() {
  try {
    await build({
      entryPoints: ['server/index.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outdir: 'dist',
      packages: 'external',
      // Exclude Python files and directories from bundling
      external: [
        '*.py',
        './server/*.py'
      ],
      // Ignore Python files during the build process
      ignoreAnnotations: true,
      // Don't try to resolve Python imports
      resolveExtensions: ['.ts', '.js', '.json'],
      // Add sourcemap for debugging
      sourcemap: true,
      // Set target Node.js version
      target: 'node18',
    });
    console.log('✅ Server build completed successfully');
  } catch (error) {
    console.error('❌ Server build failed:', error);
    process.exit(1);
  }
}

buildServer();
