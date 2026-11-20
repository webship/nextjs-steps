@must-fail @learn
Feature: Must fail: the session and the forms
  Each scenario asserts something that is not true on the test app: its last step must fail, with the
  message its description announces and a hint (tests/check-must-fail.js checks both).

  Scenario: Logged in as one account, asserted as another
    Fails with: Expected to be logged in as "editor"
    Given I am a logged in user with the "administrator" user
    Then I should be logged in as "editor"

  Scenario: A refused login asserted as a session
    Fails with: Expected to be logged in, but nobody is signed in.
    When I log in with the email "administrator@example.com" and the password "wrong-password"
    Then I should be logged in

  Scenario: An open session asserted as none
    Fails with: Expected nobody to be signed in
    Given I am a logged in user with the "editor" user
    Then I should not be logged in

  Scenario: The login page asserted without its form
    Fails with: Expected no login form
    Given I am an anonymous user
    When I go to "/login"
    Then I should not see the login form

  Scenario: The login form asserted to send the person to another page
    Fails with: Expected the login form to send the person back to "/dashboard/customers"
    Given I am an anonymous user
    When I go to "/dashboard/invoices"
    Then the login form should send me back to "/dashboard/customers"

  Scenario: A field asserted with an error it does not show
    Fails with: Expected the field "Choose customer" to show the error "Please choose somebody."
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices/create"
    When I send the form with "Create Invoice"
    Then the field "Choose customer" should show the error "Please choose somebody."

  Scenario: A field asserted without the error it shows
    Fails with: Expected the field "Choose an amount" not to show the error
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices/create"
    When I send the form with "Create Invoice"
    Then the field "Choose an amount" should not show the error "Please enter an amount greater than $0."

  Scenario: A form asserted with a message it does not show
    Fails with: Expected a form to show the message "Invoice created."
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices/create"
    When I send the form with "Create Invoice"
    Then the form should show the message "Invoice created."

  Scenario: A button asserted busy with no form on its way
    Fails with: Expected the "Log in" button to be busy
    Given I fill in the login form as "editor"
    Then the "Log in" button should be busy

  Scenario: A field the page does not have
    Fails with: Expected a field "Due date"
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices/create"
    Then the field "Due date" should show the error "Please enter a date."

  Scenario: A button the page does not have
    Fails with: Expected a button "Save draft"
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices/create"
    When I send the form with "Save draft"

  Scenario: An account the registry does not have
    Fails with: The user "auditor" is not in the users registry.
    Given I am a logged in user with the "auditor" user
