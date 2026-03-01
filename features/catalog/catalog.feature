@extended-api
Feature: Catalog management
  As a CLI user
  I want to browse the data catalog
  So that I can discover available datasets

  Scenario: Get the catalog
    Given I am logged in
    When I run "geonic catalog get"
    Then the exit code should be 0

  Scenario: List datasets
    Given I am logged in
    When I run "geonic catalog datasets list"
    Then the exit code should be 0
