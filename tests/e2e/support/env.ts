/**
 * Environment that must be in place **before** the `geonicdb` module is
 * imported. Some of its configuration is read at module-evaluation time, so
 * assigning these inside a `BeforeAll` hook is already too late — import this
 * module first from `hooks.ts`.
 */

/**
 * The E2E server runs in-process against an in-memory MongoDB. Left unset it
 * defaults to AWS mode and issues real DynamoDB calls for deployment routing,
 * rate limits and token invalidation, so the suite would either fail with
 * whatever credentials the machine happens to have or reach real tables.
 * Standalone is the intended mode for a local server and backs those stores
 * with the same MongoDB — which `admin deployments` (#176) needs to work at all.
 */
process.env.RUNTIME_MODE = "standalone";
