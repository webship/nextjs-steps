@learn
Feature: Search and pagination in the address
  As a person who looks for an invoice
  I want the search and the page of the list to be in the address
  So that a link, a reload or the back button gives me the same list

  # The search box of the app has a label that is not tied to it (its "for" names no field): the
  # scenarios fill it in by its placeholder, and read it back by a selector.

  Scenario: Searching puts the words in the address and lists what matches
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard/invoices"
    When I fill in "Search invoices..." with "Example"
    And I wait for the page to be ready
    Then current url should have the "query" parameter with the "Example" value
    And current url should have the "page" parameter with the "1" value
    And I should see "Ivy Example"
    And I should see "Oak Example"
    And I should see "$120.00"

  Scenario: A search in the address fills in the search box
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/invoices?query=Oak"
    Then the "input[placeholder='Search invoices...']" field should contain "Oak"
    And I should see "Oak Example"
    And I should not see "Ivy Example"

  Scenario: The next page of the list is a page of its own
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard/invoices"
    When I click the link "2" without a full page reload
    Then current url should have the "page" parameter with the "2" value
    When I click the link "3" without a full page reload
    Then current url should have the "page" parameter with the "3" value
    And I should see "Ivy Example"
    When I go back without a full page reload
    Then current url should have the "page" parameter with the "2" value
