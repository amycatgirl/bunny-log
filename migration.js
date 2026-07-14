import { agent } from "#app/oauth";
import { makeXRPC, getATURIParts } from "#app";

/**
 * @template T
 * @typedef {Object} ListRecordsResponse
 * @prop {string} [cursor]
 * @prop {T[]} records
 */

/**
 * Split an array by `n` partitions
 * @template {unknown[]} T
 * @param {T} array
 * @param {number} n - Must be greater than 1
 * @returns {T[]}
 */
function partition(array, n) {
  let local_idx = 0
  let initial = true
  return Object.values(array.reduce((acc, val, idx) => {
    if (idx % n === 0 && !initial) local_idx++
    if (initial) { initial = false } // hack
    if (!acc[local_idx]) acc[local_idx] = []
    acc[local_idx].push(val)

    return acc
  }, {}))
}

/**
 * Check if target is eligible for the lexicon namespace migration (one-time)
 * @param {string} target
 * @returns {Promise<boolean>}
 */
export async function shouldMigrate(target) {
  /** @type {{ collections: string[], [string]: any}} */
  const { collections } = await fetch(makeXRPC("com.atproto.repo.describeRepo", {
    repo: target
  })).then(res => res.json())

  return collections.includes("space.bunniesin.micro.log")
}

/**
 * Retry with exponential backoff
 * @template {() => unknown} T
 * @param {T} fn - Function to call on retry
 * @param {{initialDelay: number, maxAttempts: number}} [options]
 * @async
 * @returns {ReturnType<T>}
 */
async function retry(fn, options = { initialDelay: 200, maxAttempts: 10 }) {
  const { initialDelay, maxAttempts } = options;
  let attempt = 1
  while (attempt <= maxAttempts) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxAttempts) throw err

      const t = initialDelay * Math.pow(2, attempt - 1);
      const j = Math.random() * initialDelay
      const d = t + j;

      await new Promise((r) => setTimeout(() => r(), d))
      attempt++
    }
  }
}

export async function queryAllRecordsToBeMigrated(target) {
  /** @type {string?} */
  let cursor = "";
  /** @type {(import("./app.js").BunnyLogEntry & { rkey: string })[]} */
  let records = [];

  /**
   * @returns {Promise<ListRecordsResponse<import("./app.js").BunnyLogEntry>>}
   */
  async function next() {
    const res = await fetch(
      makeXRPC("com.atproto.repo.listRecords", {
        repo: target,
        collection: "space.bunniesin.micro.log",
        cursor,
      }),
    );

    if (!res.ok) {
      return retry(next); // /technically/ recursive, but it isn't
    }

    return await res.json();
  }

  while (cursor != null) {
    let p = await next();
    cursor = p.cursor ?? null;
    records.push(...p.records.map(r => ({ value: r.value, rkey: getATURIParts(r.uri).rkey })))
  }

  return records
}

/**
 * @asnyc
 * @returns {boolean}
 */
export async function migrateRecordsToNewLexicon(target, batchSize = 50) {
  /** @type {(import("./app.js").BunnyLogEntry & { rkey: string })[]}*/
  const records =  await queryAllRecordsToBeMigrated(target);

  console.info("[MIGRATION]", "Records to be migrated:", records.length);

  let currentBatch = 1;
  // Part 2 --- Migrate them to the new namespace & lexicon using com.atproto.repo.applyWrites
  for (const rx of partition(records, batchSize)) {
    /** @type {any[]} */
    const creates = rx.reduce((acc, r) => {
      const { rkey, value } = {...r, value: {...r.value, $type: "space.bunniesin.log.entry" }} // this is stupid
      return [...acc,
        { $type: "com.atproto.repo.applyWrites#create", collection: "space.bunniesin.log.entry", rkey, value }];
    }, [])

    const deletes = rx.reduce((acc, r) => {
      return [...acc,  { $type: "com.atproto.repo.applyWrites#delete", collection: "space.bunniesin.micro.log", rkey: r.rkey}]
    }, [])

    let res = await agent.com.atproto.repo.applyWrites({
      repo: agent.did,
      writes: creates,
      validate: false // Most, if not all PDSes do not include our lexicons, so validation is not possible
    })

    if (!res.success) throw new Error(`FAILED TO CREATE RECORDS!!!!! FUCK!!!!!\n${JSON.stringify(res)}`);

    console.info("[MIGRATION]", `Created ${creates.length} records.`)

    
    res = await agent.com.atproto.repo.applyWrites({
      repo: agent.did,
      writes: deletes,
      validate: false 
    })

    if (!res.success) throw new Error(`FAILED TO DELETE OLD RECORDS!!!!! FUCK!!!!!\n${JSON.stringify(res)}`);

    console.info("[MIGRATION]", `Deleted ${deletes.length} old records.`)

    console.info("[MIGRATION]", `Batch ${currentBatch} was migrated without issue.`)
    currentBatch++
  }

  console.info("[MIGRATION]", "All batches were migrated successfully.")

  return true
}
