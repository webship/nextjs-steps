@default-app
Feature: A new app made with the defaults
  As a developer starting a new app
  I want its first page to be a hydrated production build with images that load the right way
  So that the app starts from what the framework promises

  Scenario: The start page is a hydrated, prerendered production build of the app router
    Given I am on "/"
    Then the site should be served as a production build
    And the page should be served by the app router
    And I should see a hydrated page
    And there should be no hydration errors
    And the page should be prerendered
    And the page should have a route announcer
    And the development tools should not be on the page

  Scenario: The logo is preloaded and loads at once; the other image waits until it is near
    Given I am on "/"
    Then the image "logo" should be preloaded
    And the image "logo" should not load lazily
    And the image "logo" should have loaded
    And the image "logo" should not be optimized
    And the image "logo" should be served as "image/svg+xml"
    And the image "logomark" should load lazily
    And the image "logomark" should not be preloaded
    And the image "logomark" should have a width and a height

  @js-off
  Scenario: An address with no route shows the default not-found page
    When I go to "/no-such-page"
    Then I should be on a 404 page
    And I should be on the default 404 page
    And the response status code should be 404
