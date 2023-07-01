import fs from 'fs-extra';
import path from 'path';
import arg from 'arg';
import chalk from 'chalk';
import execa from 'execa';
import { getNextronConfig } from './webpack/helpers';
import log from './logger';

const args = arg({
  '--help': Boolean,
  '--version': Boolean,
  '--all': Boolean,
  '--win': Boolean,
  '--mac': Boolean,
  '--linux': Boolean,
  '--x64': Boolean,
  '--ia32': Boolean,
  '--armv7l': Boolean,
  '--arm64': Boolean,
  '--universal': Boolean,
  '--config': String,
  '--publish': String,
  '--no-pack': Boolean,
  '--next13': Boolean,
  '-h': '--help',
  '-v': '--version',
  '-w': '--win',
  '-m': '--mac',
  '-l': '--linux',
  '-c': '--config',
  '-p': '--publish',
});

if (args['--help']) {
  console.log(chalk`
    {bold.cyan nextron build} - Build and export the application for production deployment

    {bold USAGE}

      {bold $} {cyan nextron build} --help
      {bold $} {cyan nextron build} [options]

    {bold OPTIONS}

      --help,    -h  show this help message
      --version, -v  display the current version of nextron
      --all          build for Windows, macOS and Linux
      --win,     -w  build for Windows, accepts target list (see https://goo.gl/jYsTEJ)
      --mac,     -m  build for macOS, accepts target list (see https://goo.gl/5uHuzj)
      --linux,   -l  build for Linux, accepts target list (see https://goo.gl/4vwQad) 
      --x64          build for x64
      --ia32         build for ia32
      --armv7l       build for armv7l
      --arm64        build for arm64
      --universal    build for mac universal binary
      --no-pack      skip electron-builder pack command
      --next13       use next@13
      --publish, -p  publish artifacts (see https://goo.gl/tSFycD)
                     [choices: "onTag", "onTagOrDraft", "always", "never", undefined]

  `);
  process.exit(0);
}

const cwd = process.cwd();
const execaOptions: execa.Options = {
  cwd,
  stdio: 'inherit',
};

async function build() {
  // Ignore missing dependencies
  process.env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = 'true';

  const appdir = path.join(cwd, 'app');
  const distdir = path.join(cwd, 'dist');
  const rendererSrcDir = getNextronConfig().rendererSrcDir || 'renderer';

  try {
    log('Clearing previous builds');
    fs.removeSync(appdir);
    fs.removeSync(distdir);

    log('Building renderer process');
    await execa(
      'next',
      ['build', path.join(cwd, rendererSrcDir)],
      execaOptions
    );

    if (args['--next13']) {
      const nextoutdir = path.join(cwd, rendererSrcDir, 'out');
      fs.copy(nextoutdir, appdir, {
        overwrite: true,
      });
    } else {
      await execa(
        'next',
        ['export', '-o', appdir, path.join(cwd, rendererSrcDir)],
        execaOptions
      );
    }

    log('Building main process');
    await execa(
      'node',
      [path.join(__dirname, 'webpack.config.js')],
      execaOptions
    );

    if (args['--no-pack']) {
      log('Skip Packaging...');
    } else {
      log('Packaging - please wait a moment');
      await execa('electron-builder', createBuilderArgs(), execaOptions);
    }

    log('See `dist` directory');
  } catch (err) {
    console.log(chalk`

{bold.red Cannot build electron packages:}
{bold.yellow ${err}}
`);
    process.exit(1);
  }
}

function createBuilderArgs() {
  let results = [];
  if (args['--config']) {
    results.push('--config');
    results.push(args['--config'] || 'electron-builder.yml');
  }
  if (args['--publish']) {
    results.push('--publish');
    results.push(args['--publish']);
  }
  if (args['--all']) {
    results.push('-wml');
    results.push(...createArchArgs());
  } else {
    args['--win'] && results.push('--win');
    args['--mac'] && results.push('--mac');
    args['--linux'] && results.push('--linux');
    results.push(...createArchArgs());
  }
  return results;
}

function createArchArgs() {
  let archArgs = [];
  args['--x64'] && archArgs.push('--x64');
  args['--ia32'] && archArgs.push('--ia32');
  args['--armv7l'] && archArgs.push('--armv7l');
  args['--arm64'] && archArgs.push('--arm64');
  args['--universal'] && archArgs.push('--universal');
  return archArgs;
}

build();
