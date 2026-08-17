/**
 * Body for POST /ngsi-ld/v1/jsonldContexts (Add @context).
 *
 * Must not include `kind`: geolonia/geonicdb#2297 rejects any client-supplied
 * kind with 400 — the entry is always Hosted (ETSI GS CIM 009 clause 5.13.2.4).
 * Cached / ImplicitlyCreated are broker-origin only.
 */
export function buildAddContextBody(
  url: string,
  context: unknown,
): { url: string; body: { "@context": unknown } } {
  return {
    url,
    body: { "@context": context },
  };
}
