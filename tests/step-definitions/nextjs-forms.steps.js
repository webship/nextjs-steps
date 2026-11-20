'use strict';

// Forms and their actions: a form sent with its button (the step waits for
// the form's action on the server and the page that follows), the errors the
// server sends back next to each field and for the whole form, a button that
// says the form is on its way, and a form handled in the page (no full page
// reload).

const { Then, When } = require('@cucumber/cucumber');
const {
  budget,
  same,
  listed,
  failure,
  shortUrl,
  requests,
  documentId,
  pageReady,
  afterAction,
  personClick,
  firstPresent,
  formMessages,
  eventually,
} = require('./nextjs-helpers');

/** A button by its name (exact, then containing the words), the visible one first. */
async function buttonByName(world, name, scope) {
  const root = scope || world.page;
  return firstPresent([
    root.getByRole('button', { name, exact: true }).filter({ visible: true }),
    root.getByRole('button', { name }).filter({ visible: true }),
    root.locator(`input[type="submit"][value="${String(name).replace(/"/g, '\\"')}"]`).filter({ visible: true }),
    root.getByRole('button', { name, exact: true }),
  ]);
}

/** The visible row of a table (or of a grid) that holds the text. */
async function rowWith(world, text) {
  return firstPresent([
    world.page.locator('tr, [role="row"]').filter({ hasText: text }).filter({ visible: true }),
    world.page.locator('tr, [role="row"]').filter({ hasText: text }),
  ]);
}

/** The names of the visible buttons of the page, for a failure message. */
async function buttonNames(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('button, input[type="submit"], [role="button"]')]
    .filter((b) => b.offsetWidth || b.offsetHeight)
    .map((b) => (b.getAttribute('aria-label') || b.textContent || b.value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 15)).catch(() => []);
}

/** The fields of a form the browser holds back (its own validation), with their messages. */
async function invalidFields(form) {
  return form.evaluate((f) => [...f.querySelectorAll('input, select, textarea')]
    .filter((el) => el.willValidate && !el.checkValidity())
    .map((el) => {
      const label = (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('aria-label') || el.name || el.id;
      return `"${String(label).replace(/\s+/g, ' ').trim()}" (${el.validationMessage})`;
    })).catch(() => []);
}

/**
 * Send a form with its button, by the button's name: the step waits for the
 * button to be hydrated, clicks it, and waits for the form's action on the
 * server and for the page that follows (the same page with its messages, or
 * the page the action sends the browser to). It fails when the browser holds
 * the form back (a required field left empty, an address that is not one).
 *
 * With "in the "…" row", the button is the one of the table row that holds
 * that text (a "Delete" button on each row of a list).
 *
 * Example #1: When I send the form with "Create Invoice"
 * Example #2: And we send the form with "Edit Invoice"
 * Example #3: When I send the form with "Log in"
 * Example #4: When I send the form with "Delete" in the "$42.17" row
 * Example #5: And I send the form with "Delete" in the "Oak Example" row
 */
When(/^(I |we )*send the form with "([^"]*)?"(?: in the "([^"]*)?" row)?$/, { timeout: 60000 }, async function (pronounCase, name, rowText) {
  await pageReady(this);
  let scope = null;
  if (rowText) {
    scope = await rowWith(this, rowText);
    if (!(await scope.count())) {
      throw failure(this, `Expected a row with "${rowText}" on ${this.page.url()}, but no row of a table holds it.`, 'The row is a table row (tr) or a row of a grid (role="row") whose text holds the words.');
    }
  }
  const button = await buttonByName(this, name, scope);
  if (!(await button.count())) {
    throw failure(this, `Expected a button "${name}"${rowText ? ` in the "${rowText}" row` : ''} on ${this.page.url()}, but there is none. Buttons on the page: ${listed(await buttonNames(this))}.`, 'A button is found by the name a person reads: its text, its value or its accessible name.');
  }
  const form = button.locator('xpath=ancestor::form[1]');
  const state = requests(this.page);
  const actionsBefore = state.started.action;
  const navigationsBefore = state.started.navigation + state.started.data;
  const documentsBefore = state.documents.length;
  const documentBefore = await documentId(this);
  const urlBefore = this.page.url();
  await afterAction(this, () => personClick(this, button, `the button "${name}"`));
  const sent = state.started.action > actionsBefore || state.documents.length > documentsBefore || state.started.navigation + state.started.data > navigationsBefore || this.page.url() !== urlBefore;
  if (!sent && (await form.count())) {
    const invalid = await invalidFields(form);
    if (invalid.length) {
      throw failure(this, `The form of "${name}" was not sent: the browser held it back. ${invalid.join('; ')}.`, 'Fill in the fields the browser asks for, or test the app\'s own messages with a value the browser accepts.');
    }
  }
  this.__lastForm = {
    name,
    sentByAction: state.started.action > actionsBefore,
    newDocument: state.documents.length > documentsBefore || (await documentId(this)) !== documentBefore,
    url: this.page.url(),
    answers: state.answers.filter((a) => a.kind === 'action').slice(-3),
  };
});

/**
 * The last form sent was handled in the page: its action ran on the server
 * through the app's own request, and the browser kept its document (no full
 * page reload, as a plain HTML form would do).
 *
 * Example #1: Then the form should have been sent without a full page reload
 * Example #2: And the form should have been sent without a full page reload
 * Example #3: Then form should have been sent without a full page reload
 * Example #4: And form should have been sent without a full page reload
 * Example #5: Then the form should have been sent without a full page reload
 */
Then(/^(?:the )?form should have been sent without a full page reload$/, async function () {
  const last = this.__lastForm;
  if (!last) {
    throw failure(this, 'Expected a form sent in this scenario, but none was: "When I send the form with "…"" comes first.', 'This step reads what the last "send the form" step saw.');
  }
  if (last.newDocument) {
    throw failure(this, `Expected the form of "${last.name}" to be sent without a full page reload, but the browser loaded a new document (${shortUrl(last.url)}).`, 'A form the app had not hydrated yet posts as plain HTML (and still works, by design): wait for the page to be ready before sending it, and look at the console for an error.');
  }
  if (!last.sentByAction) {
    throw failure(this, `Expected the form of "${last.name}" to run its action on the server, but no action request was sent.`, 'A form with a server action sends a request with the header next-action; a form handled only in the browser sends none.');
  }
});

/**
 * The control a person names by its label (or a group of radio buttons or
 * check boxes by its legend), and the texts that describe it: the elements its
 * aria-describedby and aria-errormessage name, and the live regions of its
 * group.
 */
async function fieldAndErrors(world, label) {
  const page = world.page;
  const control = await firstPresent([
    page.getByLabel(label, { exact: true }).filter({ visible: true }),
    page.getByRole('group', { name: label, exact: true }),
    page.getByLabel(label).filter({ visible: true }),
    page.getByRole('group', { name: label }),
  ]);
  if (!(await control.count())) return null;
  const texts = await control.evaluate((el) => {
    const read = (ids) => String(ids || '').split(/\s+/).filter(Boolean)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim());
    const out = [...read(el.getAttribute('aria-describedby')), ...read(el.getAttribute('aria-errormessage'))];
    const group = el.matches('fieldset, [role="group"], [role="radiogroup"]') ? el : null;
    if (group) {
      for (const n of group.querySelectorAll('[aria-live], [role="alert"]')) out.push((n.textContent || '').replace(/\s+/g, ' ').trim());
      for (const input of group.querySelectorAll('input, select, textarea')) out.push(...read(input.getAttribute('aria-describedby')), ...read(input.getAttribute('aria-errormessage')));
    }
    return out.filter(Boolean);
  });
  return { control, texts };
}

/**
 * The error a field shows: the text of the element its aria-describedby (or
 * aria-errormessage) names, as a screen reader reads it with the field; for a
 * group of radio buttons named by its legend, the messages of the group. The
 * step waits for the error to appear ("should not" for it to go).
 *
 * Example #1: Then the field "Choose customer" should show the error "Please select a customer."
 * Example #2: And the field "Choose an amount" should show the error "Please enter an amount greater than $0."
 * Example #3: And the field "Set the invoice status" should show the error "Please select an invoice status."
 * Example #4: Then the field "Choose customer" should not show the error "Please select a customer."
 * Example #5: Then field "Choose an amount" should not show the error "Please enter an amount greater than $0."
 */
Then(/^(?:the )?field "([^"]*)?" should( not)* show the error "([^"]*)?"$/, async function (label, notCase, error) {
  await pageReady(this);
  const read = () => fieldAndErrors(this, label);
  const has = (found) => !!found && found.texts.some((t) => same(t, error) || t.toLowerCase().includes(String(error).toLowerCase()));
  const first = await read();
  if (!first) {
    throw failure(this, `Expected a field "${label}" on ${this.page.url()}, but there is none.`, 'A field is found by its label (a <label for>, aria-label or aria-labelledby); a group of radio buttons by its <legend>.');
  }
  if (notCase) {
    if (has(first)) {
      throw failure(this, `Expected the field "${label}" not to show the error "${error}", but it does.`, 'The error is the text its aria-describedby names.');
    }
    return;
  }
  await eventually(this, read, has, (found) => ({
    message: `Expected the field "${label}" to show the error "${error}", but it shows ${listed(found ? found.texts : [])}.`,
    hint: 'The step reads the texts the field\'s aria-describedby (or aria-errormessage) names, as a screen reader does. An error shown next to the field but not tied to it is not announced with the field: tie it with aria-describedby.',
  }));
});

/**
 * A message of the form as a whole, in one of its live regions (aria-live, an
 * alert, a status): what the form's action sent back. The step waits for it
 * to appear ("should not" for it to go).
 *
 * Example #1: Then the form should show the message "Missing Fields. Failed to Create Invoice."
 * Example #2: And the form should show the message "Invalid credentials."
 * Example #3: Then the form should not show the message "Invalid credentials."
 * Example #4: Then form should show the message "Missing Fields. Failed to Update Invoice."
 * Example #5: And the form should not show the message "Missing Fields. Failed to Create Invoice."
 */
Then(/^(?:the )?form should( not)* show the message "([^"]*)?"$/, async function (notCase, message) {
  await pageReady(this);
  const read = async () => {
    const forms = this.page.locator('form').filter({ visible: true });
    const count = await forms.count();
    const all = [];
    for (let i = 0; i < count; i += 1) all.push(...(await formMessages(this, forms.nth(i))));
    return all;
  };
  const has = (messages) => messages.some((m) => same(m, message) || m.toLowerCase().includes(String(message).toLowerCase()));
  if (notCase) {
    const messages = await read();
    if (has(messages)) {
      throw failure(this, `Expected no message "${message}" in a form, but a form shows it.`, 'The message is in a live region of the form (aria-live, role="alert" or role="status").');
    }
    return;
  }
  await eventually(this, read, has, (messages) => ({
    message: `Expected a form to show the message "${message}", but its messages are ${listed(messages)}.`,
    hint: 'The step reads the live regions of the forms of the page (aria-live, role="alert", role="status"): the places a screen reader announces. A message outside them is not announced.',
  }));
});

/**
 * Whether a button says that its form is on its way: disabled, aria-disabled
 * or aria-busy while the form's action runs (the pending state of the form).
 * "should be busy" waits for it; "should not be busy" waits for it to end.
 *
 * Example #1: Then the "Log in" button should be busy
 * Example #2: And the "Log in" button should not be busy
 * Example #3: Then the "Create Invoice" button should not be busy
 * Example #4: Then "Log in" button should be busy
 * Example #5: And the "Edit Invoice" button should not be busy
 */
Then(/^(?:the )?"([^"]*)?" button should( not)* be busy$/, async function (name, notCase) {
  const button = await buttonByName(this, name);
  if (!(await button.count())) {
    throw failure(this, `Expected a button "${name}" on ${this.page.url()}, but there is none. Buttons on the page: ${listed(await buttonNames(this))}.`, 'A button is found by the name a person reads.');
  }
  const read = () => button.evaluate((b) => ({
    disabled: !!b.disabled,
    ariaDisabled: b.getAttribute('aria-disabled') || '',
    ariaBusy: b.getAttribute('aria-busy') || '',
  })).catch(() => null);
  const busy = (s) => !!s && (s.disabled || s.ariaDisabled === 'true' || s.ariaBusy === 'true');
  await eventually(this, read, (s) => (notCase ? !busy(s) : busy(s)), (s) => ({
    message: `Expected the "${name}" button ${notCase ? 'not to be busy' : 'to be busy'}, but it is ${s ? `disabled: ${s.disabled}, aria-disabled: "${s.ariaDisabled}", aria-busy: "${s.ariaBusy}"` : 'gone'}.`,
    hint: notCase
      ? 'The button stays busy while the form\'s action runs: hold-back answers come through with "When the server\'s answers come through".'
      : 'A form says it is busy only while its action runs, and only if the app marks its button (disabled, aria-disabled or aria-busy, from the form\'s pending state). Hold the answers back first so the step can see it.',
  }), budget(this));
});
