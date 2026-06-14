/**
 * PegasusAI - Gulp Build System
 * Baseado no build system do Code-OSS com adaptações para PegasusAI
 */

const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const esbuild = require('gulp-esbuild');
const ts = require('gulp-typescript');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const filter = require('gulp-filter');
const plumber = require('gulp-plumber');
const sourcemaps = require('gulp-sourcemaps');
const merge = require('merge-stream');

// Configurações
const ROOT = path.dirname(__dirname);
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'out');
const INTEGRATION_DIR = path.join(ROOT, 'integration');

// Carrega configurações do package.json
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// TypeScript config
const tsConfig = {
  ...require('./tsconfig.json').compilerOptions,
  outDir: OUT_DIR
};

const tsProject = ts.createProject('tsconfig.json', tsConfig);

/**
 * Task: Limpeza
 */
function clean() {
  const del = require('rimraf');
  return del.sync([OUT_DIR, 'build/dist']);
}

/**
 * Task: Compilação TypeScript
 */
function compileTS() {
  return gulp.src(['src/**/*.ts', 'src/**/*.tsx', 'integration/**/*.ts'])
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(sourcemaps.write('.', { includeContent: true }))
    .pipe(gulp.dest(OUT_DIR));
}

/**
 * Task: Build Electron Main Process
 */
function buildMain() {
  return gulp.src('src/main/main.ts')
    .pipe(esbuild({
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      outfile: 'out/main.js',
      external: [
        'electron',
        'better-sqlite3',
        'node-pty',
        'vscode-regexpp',
        'vscode-textmate'
      ],
      minify: false,
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"production"',
        'PEGASUSAI_VERSION': `"${pkg.version}"`,
        'PEGASUSAI_PRODUCT_NAME': `"${pkg.productName}"`
      }
    }));
}

/**
 * Task: Build Renderer Process
 */
function buildRenderer() {
  return gulp.src('src/renderer/renderer.tsx')
    .pipe(esbuild({
      bundle: true,
      platform: 'browser',
      target: 'chrome114',
      format: 'iife',
      outfile: 'out/renderer.js',
      external: ['vscode'],
      minify: false,
      sourcemap: true,
      loader: { '.tsx': 'tsx', '.css': 'css' }
    }));
}

/**
 * Task: Copiar recursos
 */
function copyResources() {
  return gulp.src('resources/**/*')
    .pipe(gulp.dest('out/resources'));
}

/**
 * Task: Rebranding - Substituir referências VS Code para PegasusAI
 */
function rebrand() {
  const replacements = [
    ['Visual Studio Code', 'PegasusAI'],
    ['vscode', 'pegasusai'],
    ['VSCode', 'PegasusAI'],
    ['Code-OSS', 'PegasusAI']
  ];

  let stream = gulp.src(['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.json']);
  
  replacements.forEach(([from, to]) => {
    stream = stream.pipe(replace(new RegExp(from, 'g'), to));
  });

  return stream.pipe(gulp.dest('src'));
}

/**
 * Task: Watch
 */
function watch() {
  gulp.watch(['src/**/*.ts', 'src/**/*.tsx'], compileTS);
  gulp.watch(['resources/**/*'], copyResources);
}

/**
 * Task: Build completo
 */
const build = gulp.series(
  clean,
  compileTS,
  buildMain,
  buildRenderer,
  copyResources
);

/**
 * Task: Default
 */
const defaultTask = gulp.series(build, watch);

// Export tasks
exports.clean = clean;
exports.compile = compileTS;
exports['build-main'] = buildMain;
exports['build-renderer'] = buildRenderer;
exports.copy = copyResources;
exports.rebrand = rebrand;
exports.watch = watch;
exports.build = build;
exports.default = defaultTask;

// Metadata
console.log(`\n🦅 PegasusAI Build System v${pkg.version}`);
console.log(`   Product: ${pkg.productName}`);
console.log(`   Platform: ${process.platform}-${process.arch}\n`);
