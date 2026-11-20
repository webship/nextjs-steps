'use strict';

// The session of an app with a login form: logging in by a handle of the users
// registry (a session taken over when the account already has one), through
// the form, or with an address and a password; filling in the form without
// sending it; logging out; who is signed in; the login form, and where it
// sends a person back to.
//
// Accounts are configuration, not test data: they are listed in cucumber.js
// (`worldParameters.users`) and created once by the build of the app. A
// feature never creates or deletes users. Who is signed in is read from the
// app's session address (`worldParameters.sessionPath`, /api/auth/session, the
// one of the app's authentication library).

const { Given, Then, When } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  same,
  listed,
  failure,
  shortUrl,
  currentPath,
  pathOf,
  pageReady,
  afterAction,
  personClick,
  waitHydrated,
  firstPresent,
  resolveUser,
  loginPath,
  sessionPath,
  loginForm,
  currentSession,
  LOGIN_HINT,
  CUT_REQUEST_HINT,
  openLoginForm,
  submitLogin,
  logInAs,
  forgetSession,
  eventually,
} = require('./nextjs-helpers');

/**
 * Log in as an account of the users registry (`worldParameters.users` in
 * cucumber.js), by its handle. An account that logged in earlier in the run
 * takes its session over; otherwise the step logs in through the login form.
 * The browser ends on the page the app shows after a login.
 *
 * Example #1: Given I am a logged in user with the "administrator" user
 * Example #2: Given we are a logged in user with the "editor" user
 * Example #3: Given I am a logged in user with "administrator"
 * Example #4: And I am a logged in user with the "editor" user
 * Example #5: Given we are a logged in user with the "administrator" user
 */
Given(/^(I am |we are )*a logged in user with( the)* "([^"]*)"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, handle, userCase) {
  await logInAs(this, handle);
});

/**
 * Log in through the login form as an account of the users registry, as a
 * person does: a new session, never one taken over. For the scenarios that
 * test the form itself; the step fails when the app refuses the login.
 *
 * Example #1: When I log in as "administrator" with the login form
 * Example #2: When we log in as "editor" with the login form
 * Example #3: And I log in as "editor" with the login form
 * Example #4: When I log in as "administrator" with the login form
 * Example #5: And we log in as "administrator" with the login form
 */
When(/^(I |we )*log in as "([^"]*)" with the login form$/, { timeout: 120000 }, async function (pronounCase, handle) {
  const user = resolveUser(this, handle);
  forgetSession(this);
  const outcome = await submitLogin(this, user.login, user.password);
  if (outcome.error) {
    throw friendly({
      message: `The login form refused "${handle}" (${user.login}): ${outcome.error}`,
      hint: outcome.cut ? CUT_REQUEST_HINT : 'Check the address and the password of the account in worldParameters.users, and that the build of the app created the account.',
    });
  }
  this.__signedInAs = handle;
});

/**
 * Send the login form with an address and a password as typed: for the
 * refusals (a wrong password, an address the app does not know). The step
 * does not fail when the app refuses; the next steps say what it shows.
 *
 * Example #1: When I log in with the email "administrator@example.com" and the password "wrong-password"
 * Example #2: When we log in with the email "nobody@example.com" and the password "wrong-password"
 * Example #3: And I log in with the email "editor@example.com" and the password "not-the-password"
 * Example #4: When I log in with the email "administrator@example.com" and the password "123"
 * Example #5: When I log in with the email "not-an-address" and the password "wrong-password"
 */
When(/^(I |we )*log in with the email "([^"]*)" and the password "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, login, password) {
  forgetSession(this);
  const outcome = await submitLogin(this, login, password);
  if (outcome.cut) {
    throw friendly({ message: `The login could not be sent: ${outcome.error}`, hint: CUT_REQUEST_HINT });
  }
});

/**
 * Open the login page as a new visitor and fill in its form with an account
 * of the users registry, without sending it: for the scenarios that look at
 * the form while it is sent (its button busy, the answers held back).
 *
 * Example #1: When I fill in the login form as "administrator"
 * Example #2: And we fill in the login form as "editor"
 * Example #3: Given I fill in the login form as "editor"
 * Example #4: When I fill in the login form as "editor"
 * Example #5: And I fill in the login form as "administrator"
 */
When(/^(I |we )*fill in the login form as "([^"]*)"$/, { timeout: 60000 }, async function (pronounCase, handle) {
  const user = resolveUser(this, handle);
  forgetSession(this);
  await openLoginForm(this);
  const form = loginForm(this);
  const field = form.locator('input[type="email"], input[name="email"], input[name="username"], input[autocomplete="username"], input[type="text"]').first();
  await waitHydrated(this, field, 'the address field of the login form');
  await field.fill(user.login);
  await form.locator('input[type="password"]').first().fill(user.password);
});

/**
 * Log out with the app's own button or link ("Sign Out", "Log out"), and wait
 * for the page the app shows after it. The session of the account is
 * forgotten for the rest of the run.
 *
 * Example #1: When I log out
 * Example #2: And we log out
 * Example #3: Then I log out
 * Example #4: When we log out
 * Example #5: And I log out
 */
When(/^(I |we )*log out$/, { timeout: 60000 }, async function (pronounCase) {
  await pageReady(this);
  const names = /^\s*(sign ?out|log ?out)\s*$/i;
  const control = await firstPresent([
    this.page.getByRole('button', { name: names }).filter({ visible: true }),
    this.page.getByRole('link', { name: names }).filter({ visible: true }),
    this.page.getByRole('menuitem', { name: names }).filter({ visible: true }),
  ]);
  if (!(await control.count())) {
    throw failure(this, `Expected a button or a link to log out ("Sign Out", "Log out") on ${shortUrl(this.page.url())}, but there is none.`, 'Log in first, and open a page of the app that offers it.');
  }
  await afterAction(this, () => personClick(this, control, 'the button to log out'));
  forgetSession(this);
});

/**
 * Whether anybody is signed in: the app's session address answers with a user
 * (or null). With "not", nobody is.
 *
 * Example #1: Then I should be logged in
 * Example #2: Then I should not be logged in
 * Example #3: And we should be logged in
 * Example #4: And I should not be logged in
 * Example #5: Then we should not be logged in
 */
Then(/^(I |we )*should( not)* be logged in$/, async function (pronounCase, notCase) {
  await pageReady(this);
  if (!sessionPath(this)) {
    throw failure(this, 'Expected to read who is signed in, but worldParameters.sessionPath is empty.', 'Set worldParameters.sessionPath in cucumber.js to the address that answers with the session (/api/auth/session for the app\'s authentication library).');
  }
  const session = await eventually(this, () => currentSession(this), (s) => s.known && (notCase ? !s.user : !!s.user), (s) => ({
    message: !s.known
      ? `Expected to read the session at ${sessionPath(this)}, but it answered ${s.status || 'nothing'}.`
      : (notCase ? `Expected nobody to be signed in, but ${s.user.email || s.user.name || 'an account'} is.` : 'Expected to be logged in, but nobody is signed in.'),
    hint: !s.known ? 'worldParameters.sessionPath is the address of the app that answers with the session as JSON (null when nobody is signed in).' : 'Who is signed in is what the app\'s session address says for the cookies of the browser.',
  }));
  if (!notCase) this.__signedInAs = this.__signedInAs || (session.user && session.user.email);
});

/**
 * Who is signed in: the session address answers with the account of the
 * users registry the handle names (its address).
 *
 * Example #1: Then I should be logged in as "administrator"
 * Example #2: And we should be logged in as "editor"
 * Example #3: Then I should be logged in as "editor"
 * Example #4: And I should be logged in as "administrator"
 * Example #5: Then we should be logged in as "administrator"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (pronounCase, handle) {
  await pageReady(this);
  const user = resolveUser(this, handle);
  await eventually(this, () => currentSession(this), (s) => s.known && !!s.user && same(s.user.email || '', user.email || user.login), (s) => ({
    message: !s.known
      ? `Expected to read the session at ${sessionPath(this)}, but it answered ${s.status || 'nothing'}.`
      : `Expected to be logged in as "${handle}" (${user.email || user.login}), but ${s.user ? `${s.user.email || s.user.name} is` : 'nobody is'} signed in.`,
    hint: 'Who is signed in is what the app\'s session address says for the cookies of the browser.',
  }));
});

/**
 * The page shows the app's login form (a visible form with a password field),
 * at the login page (`worldParameters.loginPath`).
 *
 * Example #1: Then I should see the login form
 * Example #2: And we should see the login form
 * Example #3: Then I should not see the login form
 * Example #4: And I should see the login form
 * Example #5: Then we should see the login form
 */
Then(/^(I |we )*should( not)* see the login form$/, async function (pronounCase, notCase) {
  await pageReady(this);
  const form = loginForm(this);
  if (notCase) {
    if ((await form.count()) > 0) {
      throw failure(this, `Expected no login form, but ${shortUrl(this.page.url())} shows one.`, 'A page for signed-in accounts only sends a visitor to the login form.');
    }
    return;
  }
  try {
    await form.waitFor({ state: 'visible', timeout: budget(this) });
  } catch {
    throw failure(this, `Expected the login form, but ${shortUrl(this.page.url())} shows none.`, LOGIN_HINT);
  }
  if (currentPath(this) !== pathOf(loginPath(this))) {
    throw failure(this, `Expected the login form at ${loginPath(this)}, but the form is at ${shortUrl(this.page.url())}.`, 'Set worldParameters.loginPath in cucumber.js to the app\'s login page.');
  }
});

/**
 * Where the login form will send the person back to once logged in: the page
 * they asked for, kept in the address of the login page (callbackUrl,
 * redirect, next, returnTo, from).
 *
 * Example #1: Then the login form should send me back to "/dashboard"
 * Example #2: And the login form should send us back to "/dashboard/invoices"
 * Example #3: Then login form should send me back to "/dashboard/customers"
 * Example #4: And the login form should send me back to "/dashboard/invoices?page=2"
 * Example #5: Then the login form should send me back to "/dashboard"
 */
Then(/^(?:the )?login form should send (?:me|us) back to "([^"]*)"$/, async function (path) {
  await pageReady(this);
  const url = new URL(this.page.url());
  const kept = ['callbackUrl', 'callbackurl', 'redirect', 'redirectTo', 'next', 'returnTo', 'from']
    .map((name) => url.searchParams.get(name))
    .filter(Boolean);
  const wanted = new URL(path, url.origin);
  const back = kept.some((value) => {
    try {
      const target = new URL(value, url.origin);
      return target.pathname.replace(/\/+$/, '') === wanted.pathname.replace(/\/+$/, '') && (!wanted.search || target.search === wanted.search);
    } catch {
      return false;
    }
  });
  if (!back) {
    throw failure(this, `Expected the login form to send the person back to "${path}", but its address keeps ${listed(kept)} (${shortUrl(this.page.url())}).`, 'A page for signed-in accounts sends a visitor to the login page with the page asked for in its address (callbackUrl for the app\'s authentication library).');
  }
});
