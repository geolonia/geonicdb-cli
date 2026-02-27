export default {
  requireModule: ["tsx"],
  import: ["features/support/*.ts", "features/step_definitions/*.ts"],
  format: ["progress-bar"],
  tags: "not @wip",
  publishQuiet: true,
};
