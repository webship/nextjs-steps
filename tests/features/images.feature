@learn
Feature: Images
  As a person on any screen
  I want the images sized for my screen, and loaded only when I come to them
  So that the pages stay fast and do not move while they load

  Scenario: The picture of the start page is optimized, sized and lazy; the one for small screens is not loaded
    Given I am an anonymous user
    When I go to "/"
    Then the image "Screenshots of the dashboard project showing desktop version" should load lazily
    And the image "Screenshots of the dashboard project showing desktop version" should be optimized
    And the image "Screenshots of the dashboard project showing desktop version" should have a width and a height
    And the image "Screenshots of the dashboard project showing desktop version" should have loaded
    And the image "Screenshots of the dashboard project showing desktop version" should be served as "image/webp"
    And the image "Screenshots of the dashboard project showing desktop version" should not be preloaded
    And the image "Screenshot of the dashboard project showing mobile version" should not have loaded

  # A lazy image that is hidden (display: none) never loads; an eager one would. The browser also loads a
  # lazy image some way ahead of the window (more than a screen), so the pages of this app are too short
  # to see one wait below the fold: the hidden picture of the other screen size shows it instead.
  Scenario: On a small screen the picture made for it loads, and the wide one does not
    Given I set the viewport to 375 by 667
    And I am an anonymous user
    When I go to "/"
    Then the image "Screenshot of the dashboard project showing mobile version" should load lazily
    When I scroll the image "Screenshot of the dashboard project showing mobile version" into view
    Then the image "Screenshot of the dashboard project showing mobile version" should have loaded
    And the image "Screenshots of the dashboard project showing desktop version" should not have loaded

  Scenario: The pictures of a list are optimized, sized and lazy
    Given I am a logged in user with the "administrator" user
    When I go to "/dashboard/customers"
    Then the image "Oak Example's profile picture" should load lazily
    And the image "Oak Example's profile picture" should be optimized
    And the image "Oak Example's profile picture" should have a width and a height
    When I scroll the image "Oak Example's profile picture" into view
    Then the image "Oak Example's profile picture" should have loaded
    And the image "Oak Example's profile picture" should be served as "image/webp"
