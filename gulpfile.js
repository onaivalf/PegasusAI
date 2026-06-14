const gulp = require('gulp');
const { series, parallel } = require('gulp');
const ts = require('gulp-typescript');
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const tsProject = ts.createProject('tsconfig.json');

// Clean build output
function clean() {
  return new Promise((resolve) => {
    const dirs = ['out', 'dist'];
    dirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    resolve();
  });
}

// Compile TypeScript
function compile() {
  return tsProject.src()
    .pipe(tsProject())
    .js.pipe(gulp.dest('out'));
}

// Build main process with esbuild
async function buildMain() {
  await esbuild.build({
    entryPoints: ['src/main/main.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: 'out/main.js',
    format: 'cjs',
    sourcemap: true,
    external: ['electron', 'sqlite3']
  });
}

// Build renderer process with esbuild
async function buildRenderer() {
  await esbuild.build({
    entryPoints: ['src/renderer/index.tsx'],
    bundle: true,
    platform: 'browser',
    target: 'chrome114',
    outfile: 'out/renderer.js',
    format: 'iife',
    sourcemap: true,
    jsx: 'automatic'
  });
}

// Copy resources
function copyResources() {
  return gulp.src('resources/**/*')
    .pipe(gulp.dest('out/resources'));
}

// Copy product.json
function copyProduct() {
  return gulp.src('product.json')
    .pipe(gulp.dest('out'));
}

// Watch for changes
function watch() {
  gulp.watch('src/**/*', series(compile, buildMain, buildRenderer));
  gulp.watch('resources/**/*', copyResources);
}

// Rebrand task
async function rebrand() {
  console.log('Running PegasusAI rebrand...');
  const rebrandScript = require('./scripts/rebrand');
  await rebrandScript.run();
}

exports.clean = clean;
exports.compile = compile;
exports.buildMain = buildMain;
exports.buildRenderer = buildRenderer;
exports.copyResources = copyResources;
exports.copyProduct = copyProduct;
exports.watch = watch;
exports.rebrand = rebrand;

exports.build = series(clean, parallel(compile, buildMain, buildRenderer), copyResources, copyProduct);
exports.default = series(exports.build);
