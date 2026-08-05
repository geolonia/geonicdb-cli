@extended-api
Feature: Admin deployment routing management
  As a super admin
  I want to manage hostname to MongoDB cluster routing rows
  So that large tenants can be isolated onto dedicated clusters without editing DynamoDB by hand

  # Server API: geolonia/geonicdb#1775 (Epic #1485 / parent #1492)

  Scenario: List deployment rows
    Given I am logged in as super admin
    When I run `geonic admin deployments list`
    Then the exit code should be 0
    And stdout should be valid JSON

  Scenario: Create a deployment row backed by a secret
    Given I am logged in as super admin
    When I run `geonic admin deployments create dep-a.example.com --database dep_a --plan PREMIUM --secret geonicdb/dep-a/mongodb-uri`
    Then the exit code should be 0
    And the output should contain "Deployment created."
    # The convergence window must not be hidden behind a bare success message.
    And the output should contain "per-instance"

  # The row is a database credential holder; the plaintext URI must never come back.
  Scenario: The response reports only whether a connection string is configured
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-b.example.com --database dep_b --plan STANDARD --secret geonicdb/dep-b/mongodb-uri`
    When I run `geonic admin deployments get dep-b.example.com`
    Then the exit code should be 0
    And the JSON output should have key "mongodbUriConfigured"
    And the JSON output key "mongodbUriSecretArn" should be "geonicdb/dep-b/mongodb-uri"
    And the output should not contain "mongodb+srv://"

  Scenario: Hostnames are matched case-insensitively
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-c.example.com --database dep_c --plan STANDARD --secret geonicdb/dep-c/mongodb-uri`
    When I run `geonic admin deployments get DEP-C.Example.COM`
    Then the exit code should be 0
    And the JSON output key "hostname" should be "dep-c.example.com"

  Scenario: Create a row disabled and enable it afterwards
    Given I am logged in as super admin
    When I run `geonic admin deployments create dep-d.example.com --database dep_d --plan STANDARD --secret geonicdb/dep-d/mongodb-uri --disabled`
    Then the exit code should be 0
    When I run `geonic admin deployments get dep-d.example.com`
    Then the JSON output key "enabled" should be "false"
    When I run `geonic admin deployments update dep-d.example.com --enable`
    Then the exit code should be 0
    And the output should contain "Deployment updated."
    When I run `geonic admin deployments get dep-d.example.com`
    Then the JSON output key "enabled" should be "true"

  Scenario: Filter the listing by enabled state
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-on.example.com --database dep_on --plan STANDARD --secret geonicdb/dep-on/uri`
    And I run `geonic admin deployments create dep-off.example.com --database dep_off --plan STANDARD --secret geonicdb/dep-off/uri --disabled`
    When I run `geonic admin deployments list --disabled`
    Then the exit code should be 0
    And the output should contain "dep-off.example.com"
    And the output should not contain "dep-on.example.com"

  Scenario: Update the quota plan and metadata
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-e.example.com --database dep_e --plan STANDARD --secret geonicdb/dep-e/uri`
    When I run `geonic admin deployments update dep-e.example.com --plan ENTERPRISE --metadata '{"owner":"sales"}'`
    Then the exit code should be 0
    When I run `geonic admin deployments get dep-e.example.com`
    Then the JSON output key "defaultQuotaPlan" should be "ENTERPRISE"
    And the output should contain "sales"

  # --clear-* sends an explicit null, the server's "remove this field" signal.
  Scenario: Clear an optional field
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-f.example.com --database dep_f --plan STANDARD --secret geonicdb/dep-f/uri --rate-limit-table rl-dep-f`
    When I run `geonic admin deployments update dep-f.example.com --clear-rate-limit-table`
    Then the exit code should be 0
    When I run `geonic admin deployments get dep-f.example.com`
    Then the JSON output key "rateLimitTableName" should be "null"

  Scenario: Delete a deployment row
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-g.example.com --database dep_g --plan STANDARD --secret geonicdb/dep-g/uri`
    When I run `geonic admin deployments delete dep-g.example.com --yes`
    Then the exit code should be 0
    And the output should contain "Deployment deleted."
    When I run `geonic admin deployments get dep-g.example.com`
    Then the exit code should be 1

  # Deleting a row takes an entire hostname offline, so a non-interactive run
  # must not proceed on its own.
  Scenario: Delete refuses to run unconfirmed in a non-interactive shell
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-h.example.com --database dep_h --plan STANDARD --secret geonicdb/dep-h/uri`
    When I run `geonic admin deployments delete dep-h.example.com`
    Then the exit code should be 1
    And stderr should contain "--yes"
    When I run `geonic admin deployments get dep-h.example.com`
    Then the exit code should be 0

  Scenario: Creating a duplicate hostname is reported as a conflict
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-i.example.com --database dep_i --plan STANDARD --secret geonicdb/dep-i/uri`
    When I run `geonic admin deployments create dep-i.example.com --database dep_i --plan STANDARD --secret geonicdb/dep-i/uri`
    Then the exit code should be 1
    And stderr should contain "already exists"

  # The server's message names the reason; the CLI must not flatten it.
  Scenario: A hostname that could never be routed is rejected with the server's reason
    Given I am logged in as super admin
    When I run `geonic admin deployments create localhost --database dep_x --plan STANDARD --secret geonicdb/dep-x/uri`
    Then the exit code should be 1
    And stderr should contain "DEFAULT_DEPLOYMENT_HOSTNAMES"

  Scenario: Getting an unknown hostname reports not found
    Given I am logged in as super admin
    When I run `geonic admin deployments get nope.example.com`
    Then the exit code should be 1
    And stderr should contain "not found"

  # Client-side guards — these must fail before any request is sent.
  Scenario: Create without a connection source is refused
    Given I am logged in as super admin
    When I run `geonic admin deployments create dep-j.example.com --database dep_j --plan STANDARD`
    Then the exit code should be 1
    And stderr should contain "--secret or --mongodb-uri"

  Scenario: Create without a database is refused
    Given I am logged in as super admin
    When I run `geonic admin deployments create dep-k.example.com --plan STANDARD --secret geonicdb/dep-k/uri`
    Then the exit code should be 1
    And stderr should contain "--database is required"

  Scenario: An unknown quota plan is refused
    Given I am logged in as super admin
    When I run `geonic admin deployments create dep-l.example.com --database dep_l --plan GOLD --secret geonicdb/dep-l/uri`
    Then the exit code should be 1
    And stderr should contain "--plan must be one of"

  Scenario: An update with no fields is refused
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-m.example.com --database dep_m --plan STANDARD --secret geonicdb/dep-m/uri`
    When I run `geonic admin deployments update dep-m.example.com`
    Then the exit code should be 1
    And stderr should contain "Nothing to update"

  Scenario: Setting and clearing the same field in one update is refused
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-n.example.com --database dep_n --plan STANDARD --secret geonicdb/dep-n/uri`
    When I run `geonic admin deployments update dep-n.example.com --secret other/secret --clear-secret`
    Then the exit code should be 1
    And stderr should contain "--clear-secret"

  Scenario: Enabling and disabling in one update is refused
    Given I am logged in as super admin
    And I run `geonic admin deployments create dep-o.example.com --database dep_o --plan STANDARD --secret geonicdb/dep-o/uri`
    When I run `geonic admin deployments update dep-o.example.com --enable --disable`
    Then the exit code should be 1
    And stderr should contain "--enable and --disable"

  Scenario: Invalid metadata JSON is refused before the request
    Given I am logged in as super admin
    When I run `geonic admin deployments create dep-p.example.com --database dep_p --plan STANDARD --secret geonicdb/dep-p/uri --metadata '[1,2]'`
    Then the exit code should be 1
    And stderr should contain "--metadata must be a JSON object"

  # A plaintext connection string on the command line is captured by shell history.
  Scenario: Passing a plaintext connection string warns about the exposure
    Given I am logged in as super admin
    When I run `geonic admin deployments create dep-q.example.com --database dep_q --plan STANDARD --mongodb-uri mongodb://user:pw@127.0.0.1:27017`
    Then the exit code should be 0
    And stderr should contain "shell history"
    When I run `geonic admin deployments get dep-q.example.com`
    Then the JSON output key "mongodbUriConfigured" should be "true"
    And the output should not contain "user:pw"

  Scenario: A non-super-admin cannot manage deployment rows
    Given I am logged in
    When I run `geonic admin deployments list`
    Then the exit code should be 1
