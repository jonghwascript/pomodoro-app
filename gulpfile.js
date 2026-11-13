const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const fileInclude = require('gulp-file-include');
const browserSync = require('browser-sync').create();

const DIST_DIR = 'dist';
const PRETTIER_GLOBS = [
  'src/**/*.html',
  'src/scss/**/*.scss',
  'src/js/**/*.js',
  'gulpfile.js',
];
const STATIC_FILES = [
  'src/*.json',
  'src/{js,images,fonts}/**/*',
];

async function cleanTask() {
  const { rm } = await import('node:fs/promises');
  await rm(DIST_DIR, { recursive: true, force: true });
}

function scssTask() {
  return gulp
    .src('src/scss/style.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(`${DIST_DIR}/css`));
}

function htmlTask() {
  return gulp
    .src('src/pages/*.html')
    .pipe(
      fileInclude({
        prefix: '@@',
        basepath: '@file',
      }),
    )
    .pipe(gulp.dest(DIST_DIR));
}

function staticTask() {
  return gulp
    .src(STATIC_FILES, { base: 'src', encoding: false })
    .pipe(gulp.dest(DIST_DIR));
}

async function prettierTask() {
  const { default: prettier } = await import('gulp-prettier');
  return gulp
    .src(PRETTIER_GLOBS, { base: '.' })
    .pipe(prettier())
    .on('error', function (error) {
      console.error('[prettier]', error.message);
      this.emit('end');
    })
    .pipe(gulp.dest('.'));
}

const buildTask = gulp.series(
  cleanTask,
  gulp.parallel(scssTask, htmlTask, staticTask),
);

function serveTask(done) {
  browserSync.init(
    {
      server: {
        baseDir: DIST_DIR,
        directory: true,
        serveStaticOptions: { index: false },
      },
      files: [`${DIST_DIR}/**/*`, `!${DIST_DIR}/**/*.map`],
      watchEvents: ['add', 'change', 'unlink'],
      port: 3000,
      open: true,
      ui: false,
      notify: false,
    },
    done,
  );
}

function watchTask() {
  gulp.watch('src/scss/**/*.scss', scssTask);
  gulp.watch(['src/pages/**/*.html', 'src/partials/**/*.html'], htmlTask);
  gulp.watch(STATIC_FILES, staticTask);
}

exports.clean = cleanTask;
exports.scss = scssTask;
exports.html = htmlTask;
exports.static = staticTask;
exports.prettier = prettierTask;
exports.build = buildTask;
exports.default = gulp.series(buildTask, serveTask, watchTask);
