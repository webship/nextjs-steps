@learn
Feature: Client-side navigation
  As a person who moves around the dashboard
  I want each page to open at once, in the page I already have
  So that the app stays quick and a screen reader still hears where I am

  Scenario: The side navigation opens each page without a full page reload
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard"
    When I click the link "Invoices" without a full page reload
    Then the path should be "/dashboard/invoices"
    And the route announcer should announce "Invoices | Acme Dashboard"
    When I click the link "Customers" without a full page reload
    Then the path should be "/dashboard/customers"
    And the route announcer should announce "Customers"
    And I should see "Ivy Example"

  Scenario: Back and forward keep the page the browser has
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices"
    When I click the link "Customers" without a full page reload
    And I go back without a full page reload
    Then the path should be "/dashboard/invoices"
    And the route announcer should announce "Invoices"
    When I go forward without a full page reload
    Then the path should be "/dashboard/customers"

  Scenario: The pages of the side navigation are fetched ahead of a click
    Given I am a logged in user with the "administrator" user
    When I go to "/dashboard"
    Then the page "/dashboard/invoices" should be prefetched
    And the page "/dashboard/customers" should be prefetched

  Scenario: Every page has a route announcer, which says nothing on the first page of a visit
    Given I am an anonymous user
    When I go to "/"
    Then the page should have a route announcer
    And the route announcer should not announce "Acme Dashboard"
    And I should see a hydrated page

  Scenario: A page opened from its address stands on its own
    Given I am a logged in user with the "editor" user
    When I go to "/dashboard/invoices?page=3"
    Then I should see a hydrated page
    And current url should have the "page" parameter with the "3" value
    And I should see "Oak Example"
