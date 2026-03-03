export default {
  requireModule: ["tsx"],
  paths: ["tests/e2e/**/*.feature"],
  import: ["tests/e2e/support/*.ts", "tests/e2e/step_definitions/*.ts"],
  format: ["progress-bar"],
  tags: "not @wip",
  publishQuiet: true,
  retry: process.env.CI ? 1 : 0,
};
