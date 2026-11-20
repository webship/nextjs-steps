@must-fail @learn
Feature: Must fail: navigation, loading and waiting
  Each scenario asserts something that is not true on the test app: its last step must fail, with the
  message its description announces and a hint.

  Scenario: The route announcer asserted with another page's title
    Fails with: Expected the route announcer to announce "Customers"
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard"
    When I click the link "Invoices" without a full page reload
    Then the route announcer should announce "Customers"

  Scenario: The route announcer asserted silent after a navigation
    Fails with: Expected the route announcer not to announce "Invoices"
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard"
    When I click the link "Invoices" without a full page reload
    Then the route announcer should not announce "Invoices"

  Scenario: A link the page does not have
    Fails with: Expected a link "Reports"
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard"
    When I click the link "Reports" without a full page reload

  Scenario: A page no link leads to asserted as prefetched
    Fails with: Expected the page "/dashboard/reports" to be prefetched
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard"
    Then the page "/dashboard/reports" should be prefetched

  Scenario: A page the router fetched asserted as not prefetched
    Fails with: Expected the page "/dashboard/invoices" not to be prefetched
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard"
    And the page "/dashboard/invoices" should be prefetched
    Then the page "/dashboard/invoices" should not be prefetched

  Scenario: Going back out of the app
    Fails with: Expected going back without a full page reload, but the browser loaded a new document
    Given I am an anonymous user
    When I go back without a full page reload

  Scenario: A page asserted without a route announcer
    Fails with: Expected no route announcer
    Given I am an anonymous user
    When I go to "/"
    Then the page should not have a route announcer

  Scenario: A page that has finished asserted as loading
    Fails with: Expected a part of the page to show its loading state, but none did
    Given I am a logged in user with the "administrator" user
    When I go to "/dashboard/invoices"
    Then a part of the page should show its loading state

  Scenario: Answers held back asserted as come through
    Fails with: Expected the page not to wait for the server
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard/invoices"
    And the server's answers are held back
    When I click "Customers"
    Then the page should not be waiting for the server

  Scenario: A quiet page asserted as waiting for the server
    Fails with: Expected the page to wait for the server
    Given I am a logged in user with the "administrator" user
    When I go to "/dashboard/customers"
    Then the page should be waiting for the server

  Scenario: Answers let go that were never held back
    Fails with: Expected answers of the server held back, but none were
    Given I am a logged in user with the "administrator" user
    When the server's answers come through

  Scenario: Answers held back the page waits for
    Fails with: The page did not get ready within
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard/invoices"
    And the server's answers are held back
    When I click "Customers"
    And I wait for the page to be ready

  Scenario: A hydrated page asserted as not hydrated
    Fails with: Expected the page not to be hydrated
    Given I am an anonymous user
    When I go to "/"
    Then I should not see a hydrated page
