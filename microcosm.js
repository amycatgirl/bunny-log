// microcosm.js --- Bindings for the Microcosm Constellation API
// Author: Amelia Bunny <amy+git@amogus.cloud>
// Licence: Expat
// Code:
import { makeXRPC } from "#app";

/**
 * @template T
 * @typedef {Object} ConstellationPaginatedResponse
 * @property {number} total Amount of items in the response
 * @property {T[]} records
 * @property {string?} cursor Cursor to get the next page
 */

/**
 * @typedef {Object} GetBacklinksOptions
 * @property {string[]} did Filter to those specific users.
 * @property {number} limit
 * @property {boolean} reverse
 */

/**
 * @typedef {Object} GetBacklinksResponse
 * @property {string} did
 * @property {string} collection
 * @property {string} rkey
 */

// backlinks begin
/** Constellation API Root */
const CONSTELLATION_ROOT = "https://constellation.microcosm.blue";

/**
 * Get a list of records that link back to a `subject`.
 * @param {string} subject A record, identity or a URI (eg. https://example.com)
 * @param {string} source Where to find the subject, must be a collection:path value
 * @param {GetBacklinksOptions} options Aditional options for this XRPC endpoint
 * @returns {Promise<ConstellationPaginatedResponse<GetBacklinksResponse>>}
 * @example
 * const backlinks = await getBacklinks("at://did:plc:vc7f4oafdgxsihk4cry2xpze/app.bsky.feed.post/3lgwdn7vd722r", "app.bsky.feed.like:subject.uri");
 * console.log(`In this page there are ${backlinks.total} backlinks; the first one:`, backlinks.records.at(0));
 */
async function getBacklinks(subject, source, options = {}) {
  const request_url = makeXRPC(
    "blue.microcosm.links.getBacklinks",
    { subject, source, ...options },
    CONSTELLATION_ROOT,
  );

  const response = await fetch(request_url);
  if (!response.ok) throw new Error("Failed to fetch:", response);

  return await response.json();
}

/**
 * Get the amount of backlinks pointing to `subject`.
 * @param {string} subject - A record, identity or URI
 * @param {string} source  - Where to find the link, in collection:path format.
 * @returns {Promise<number>}
 */
async function getBacklinksCount(subject, source) {
  const request_url = makeXRPC(
    "blue.microcosm.links.getBacklinksCount",
    { subject, source },
    CONSTELLATION_ROOT,
  );

  const response = await fetch(request_url);
  if (!response.ok) throw new Error("Failed to fetch:", response);

  const { total } = await response.json();

  return total;
}

export { getBacklinks, getBacklinksCount };
// microcosm.js ends here
