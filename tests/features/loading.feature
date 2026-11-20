@learn
Feature: Loading states and streaming
  As a person on a slow connection
  I want the page to show what is coming while its parts arrive
  So that I know the app is working, and the tests wait for the app rather than for a clock

  # The 15.x line keeps the old list while a search streams in, and shows the new one at once: no
  # loading state in between. This scenario runs on 16.x (the 15.x lane leaves out @since-16).
  @since-16
  Scenario: On a slow network the list shows its loading state, then its rows
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard/invoices"
    And the network is slow
    When I fill in "Search invoices..." with "Oak"
    Then a part of the page should show its loading state
    When I wait for the page to finish loading
    Then no part of the page should show its loading state
    And I should see "Oak Example"
    And the network is no longer slow

  Scenario: The parts of a page stream in one after the other on a slow network
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices"
    And the network is slow
    When I start to go to "/dashboard/invoices?query=Example"
    Then a part of the page should show its loading state
    When I wait for the page to finish loading
    Then no part of the page should show its loading state
    And I should see a hydrated page
    And I should see "Ivy Example"
    And the network is no longer slow

  Scenario: While the answer is on its way, the router keeps the page it shows
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard/invoices"
    And the server's answers are held back
    When I click "Customers"
    Then the page should be waiting for the server
    And the path should be "/dashboard/invoices"
    When the server's answers come through
    Then the path should be "/dashboard/customers"
    And the page should not be waiting for the server
    And no part of the page should show its loading state
