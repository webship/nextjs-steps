@learn
Feature: The session
  As a person who works in the dashboard
  I want to log in, to be refused with a wrong password, and to log out
  So that only the people with an account see the invoices

  # The accounts are configuration (worldParameters.users in cucumber.js); no scenario creates one.

  @critical
  Scenario: A visitor who asks for a page of the dashboard is sent to the login form
    Given I am an anonymous user
    When I go to "/dashboard/invoices"
    Then I should see the login form
    And the login form should send me back to "/dashboard/invoices"
    And I should not be logged in

  @critical
  Scenario Outline: The <account> account logs in through the form
    When I log in as "<account>" with the login form
    Then I should be logged in as "<account>"
    And the path should be "/dashboard"

    Examples:
      | account       |
      | administrator |
      | editor        |

  Scenario: A wrong password is refused with the form's own message
    When I log in with the email "administrator@example.com" and the password "wrong-password"
    Then the form should show the message "Invalid credentials."
    And I should see the login form
    And I should not be logged in

  Scenario: An address the app does not know is refused the same way
    When I log in with the email "nobody@example.com" and the password "wrong-password"
    Then the form should show the message "Invalid credentials."
    And I should not be logged in

  Scenario: The button of the login form is busy while the login is on its way
    Given I fill in the login form as "editor"
    And the server's answers are held back
    When I press "Log in"
    Then the "Log in" button should be busy
    And the page should be waiting for the server
    When the server's answers come through
    Then I should be logged in as "editor"
    And the page should not be waiting for the server

  Scenario: A session opened earlier in the run is taken over
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/customers"
    Then I should be logged in as "editor"
    And I should not see the login form

  Scenario: Logging out ends the session
    Given I am a logged in user with the "administrator" user
    When I log out
    Then I should not be logged in
    And the path should be "/"
