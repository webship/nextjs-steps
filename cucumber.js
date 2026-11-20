// A feature file, a scenario (file:line), a folder or a rerun file named on
// the command line of cucumber-js runs alone: `npx cucumber-js
// tests/features/session.feature`. cucumber-js 12 adds the paths of the
// command line to the `paths` of this file instead of using them alone, so
// `paths` is left empty when the command line names any, as in webship-js.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  // Only when cucumber-js itself runs, not when another script reads this file.
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

// The default is the local DDEV project that .github/scripts/build-ddev-site.sh
// builds (project "nextjssteps"), never an app of somebody else: the suite logs
// in with the accounts below. LAUNCH_URL points it at another one.
const launchUrl = process.env.LAUNCH_URL || 'https://nextjssteps.ddev.site';

// The app the build script built (APP=learn, default or pages) and how it is
// served (SERVER_MODE=production or development): each feature is tagged with
// the apps it runs on (@learn, @default-app, @pages-router), and the scenarios
// of the development server with @development.
const app = { learn: '@learn', default: '@default-app', pages: '@pages-router' }[process.env.APP || 'learn'] || '@learn';
const development = process.env.SERVER_MODE === 'development';

// An account of the users registry, overridable with <HANDLE>_EMAIL,
// <HANDLE>_PASSWORD and <HANDLE>_NAME.
function account(handle, name) {
  const env = handle.toUpperCase();
  return {
    email: process.env[`${env}_EMAIL`] || `${handle}@example.com`,
    password: process.env[`${env}_PASSWORD`] || process.env.ACCOUNT_PASSWORD || 'dD.123123ddd',
    name: process.env[`${env}_NAME`] || name,
  };
}

module.exports = {
  default: {
    // The step timeout is webship-js's (45 s, set when it loads): WEBSHIP_STEP_TIMEOUT=<milliseconds> changes it; a `timeout` key here is ignored.
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions (auto HTML report on exit; disable: WEBSHIP_REPORT_DISABLE=1).
      'tests/step-definitions/**/*.js',                                  // The step definitions of this pack.
    ],
    // FEATURES=tests/features/a.feature,tests/features/b.feature runs a subset too.
    paths: process.env.FEATURES ? process.env.FEATURES.split(',') : (commandLinePaths().length ? [] : ['tests/features/**/*.feature']),
    // CUCUMBER_TAGS=@critical runs a lane. The default runs the scenarios of the app that was
    // built, and leaves out work in progress and the assertions that must fail
    // (tests/check-must-fail.js runs them).
    tags: process.env.CUCUMBER_TAGS || `${app} and ${development ? '@development' : 'not @development'} and not @wip and not @must-fail`,
    format: [
      '@cucumber/pretty-formatter',
      // REPORT_NAME=must-fail keeps the report of another run (tests/check-must-fail.js) apart.
      `json:tests/reports/${process.env.REPORT_NAME || 'cucumber_report'}.json`,
    ],
    formatOptions: {
      // Colours follow the terminal (GitHub Actions counts as one); FORCE_COLOR=1
      // or FORCE_COLOR=0 sets them. cucumber-js 12 deprecated `colorsEnabled`.
      theme: {
        'feature keyword': ['bold', 'blue'],
        'feature name': ['blue', 'underline'],
        'feature description': ['blueBright'],
        'scenario keyword': ['bold', 'magenta'],
        'scenario name': ['magenta', 'underline'],
        'step keyword': ['bold', 'green'],
        'step text': ['greenBright', 'italic'],
      },
    },
    worldParameters: {
      launchUrl,
      // The app's login page, and the address that answers with the session of the browser
      // (the app's authentication library: null when nobody is signed in).
      loginPath: process.env.LOGIN_PATH || '/login',
      sessionPath: process.env.SESSION_PATH || '/api/auth/session',
      // An account that logged in once keeps its session for the rest of the run: later scenarios take it
      // over instead of filling in the login form again.
      reuseSessions: process.env.REUSE_SESSIONS !== 'false',
      // Video of the browser: 'off', 'on', 'on-failure' or 'tag' (scenarios tagged @video; @no-video opts out).
      video: { mode: process.env.WEBSHIP_VIDEO || 'off', dir: './videos', size: { width: 1280, height: 720 }, filenamePattern: '{datetime}.{feature_file}.{scenario}.{status}.{ext}' },
      // JavaScript errors the page raises: 'warn' reports them, 'fail' fails the scenario, 'off' ignores them;
      // @js-fail, @js-warn and @js-off per scenario. The scenarios that open an error page carry @js-off: the
      // browser logs "Failed to load resource: the server responded with a status of 404" (or 500) for each of
      // them. The Pages Router example ships no favicon.ico: the browser's 404 for it is ignored.
      javascript: { mode: process.env.WEBSHIP_JS_ERROR_MODE || 'warn', levels: ['error'], ignore: 'favicon\\.ico', beforeScenario: false, afterScenario: true },
      // The accounts that "I am a logged in user with the ... user" uses, by handle. They are configuration,
      // not test data: the build of the app creates them once (.github/scripts/build-ddev-site.sh) and a
      // feature never creates or deletes users. `name` is the name the app keeps for the account.
      users: {
        // Both accounts have the same rights in the Learn app, which has no roles.
        administrator: account('administrator', 'Administrator'),
        editor: account('editor', 'Editor'),
      },
      minWaitTime: {
        page: 3000,
        before_scenario: 0,
        after_scenario: 0,
        before_step: 0,
        after_step: 0,
      },
      selectors: {
        css: {},
        xpath: {},
        filesPath: './tests/selectors/',
        files: [],
        offset: 60,
        breakpoints: {
          xs:   { width: 375,  height: 667  },
          sm:   { width: 576,  height: 800  },
          md:   { width: 768,  height: 1024 },
          lg:   { width: 992,  height: 768  },
          xl:   { width: 1200, height: 900, default: true },
          xxl:  { width: 1400, height: 900  },
          xxxl: { width: 1920, height: 1080 },
        },
      },
      screenshot: {
        dir: './screenshots',
        purge: false,
        onFailed: true,
        onEveryStep: false,
        alwaysFullscreen: false,
        failedPrefix: 'failed_',
        filenamePattern: '{datetime}.{feature_file}.feature_{step_line}.{ext}',
        filenamePatternFailed: '{failed_prefix}{datetime}.{feature_file}.feature_{step_line}.{ext}',
        infoTypes: '',
      },
    },
  },
};
