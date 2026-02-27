Feature: Config management
  As a CLI user
  I want to manage CLI configuration
  So that I can set default values

  Scenario: Set and get a config value
    Given no config file exists
    When I run "config set url http://localhost:1026"
    Then the exit code should be 0
    And the output should contain "Set url"
    When I run "config get url"
    Then the exit code should be 0
    And stdout should contain "http://localhost:1026"

  Scenario: List all config values
    Given the CLI is configured with:
      """
      { "url": "http://localhost:1026", "service": "myservice" }
      """
    When I run "config list"
    Then the exit code should be 0
    And stdout should contain "url"
    And stdout should contain "http://localhost:1026"
    And stdout should contain "service"
    And stdout should contain "myservice"

  Scenario: Delete a config value
    Given the CLI is configured with:
      """
      { "url": "http://localhost:1026", "service": "myservice" }
      """
    When I run "config delete service"
    Then the exit code should be 0
    And the output should contain "Deleted"
    And the config should not have key "service"
    And the config should have key "url"
