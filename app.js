import {defineNavigationHook, navigate} from "#app/router"

// @atcute/tid START
const TID_RE = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;
const S32_CHAR = '234567abcdefghijklmnopqrstuvwxyz';

let lastTimestamp = 0;
let lastCurrentTime = 0;

const S32_2CHAR_TABLE = (() => {
  /** @type {string[1024]} */
	const table = Array.from({ length: 1024 });
	for (let i = 0; i < 1024; i++) {
		const hi = S32_CHAR.charAt((i >> 5) & 31);
		const lo = S32_CHAR.charAt(i & 31);
		table[i] = hi + lo;
	}
	return table;
})();

/**
 * @param {number} i
 * @returns {string}
 */ 
const s32encode = (i) => {
	let s = '';
	while (i) {
		const c = i % 32;
		i = Math.floor(i / 32);
		s = S32_CHAR.charAt(c) + s;
	}

	return s;
}

const random = (max) => {
	return Math.floor(Math.random() * max);
};

const validateTID = (tid) => {
    return tid.length === 13 && TID_RE.test(tid);
};

/**
 * Creates a TID based off provided timestamp and clockid, with no validation.
 * @param {number} timestamp
 * @param {number} clockid
 * @returns {string}
 */
export const createRaw = (timestamp, clockid) => {
	return s32encode(timestamp).padStart(11, '2') + S32_2CHAR_TABLE[clockid];
};

/**
 * Creates a TID based off provided timestamp and clockid
 * @param {number} timestamp
 * @param {number} clockid
 * @returns {string}
 */
export const create = (timestamp, clockid) => {
	if (timestamp < 0 || !Number.isSafeInteger(timestamp)) {
		throw new Error(`invalid timestamp`);
	}
	if (clockid < 0 || clockid > 1023) {
		throw new Error(`invalid clockid`);
	}
	return createRaw(timestamp, clockid);
};

/**
 * Return a TID based on current time
 * @returns {string}
 */
export const now = () => {
	const currentTime = Date.now() * 1_000;
	let timestamp;
	if (currentTime === lastCurrentTime) {
		// same time; increment to avoid collision
		timestamp = lastTimestamp + 1;
	} else {
		// time changed
		timestamp = currentTime;
		lastCurrentTime = currentTime;
	}
	lastTimestamp = timestamp;
	return createRaw(timestamp, random(1024));
};

// @atcute/tid END

const TYPEAHEAD_PROVIDER = "https://typeahead.waow.tech";
const DEFAULT_PREVIEW_HANDLE = "bunniesin.space";
const DEFAULT_PREVIEW_DID = "did:plc:gijpvbkdbr56kazbdjhfvb3d";
const DEFAULT_PREVIEW_DID_PDS = "https://eurosky.social"
export const ALLOWED_DIDS = ["did:plc:gijpvbkdbr56kazbdjhfvb3d", "did:plc:5xgmly2j6ak2v2edj75pszeg"];
const INSTANCE_OPERATOR_HANDLE = "bunniesin.space";
const INSTANCE_OPERATOR_CONTACTS = [
    {
        type: "stoat",
        value: "amybunnygirl#0122"
    },
    {
        type: "irc",
        value: "amybunny"
    },
    {
        type: "bluesky",
        value: "@bunniesin.space"
    }
];

let preview_cursor;

/* placeholder replacement map */
const PLACEHOLDER_MAP = {
    "unauth-op-contact-list": INSTANCE_OPERATOR_CONTACTS.map(({
                                                                  type,
                                                                  value
                                                              }) => `<li>${type}: ${value}</li>`).join("\n"),
    "unauth-op-contacts-msg": INSTANCE_OPERATOR_HANDLE,
    "preview-latest-handle": DEFAULT_PREVIEW_HANDLE,
    "log-perma-date": (date) => DATE_FORMATTER.format(date),
}

/* elements!! */
const ROOT = document.getElementById('root');
const POST_LIST = document.getElementById('postlist-wrapper');
const TYPEAHEAD_ELEMENTS = document.querySelectorAll('input[type="text"].with-typeahead');

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeStyle: "long",
    dateStyle: "short"
})

/**
 * utf16 -> utf8 segments -> utf16 segments for processing in native js
 * @type {string} string
 * @type {string} [lang] - Language to use for segmenter, defaults to "en".
 * @type {Intl.SegmenterOptions} [options] - Options to pass to `Intl.Segmenter`
 * @returns {string[]}
 */
export function toGraphemeSegments(string, lang = "en", options = { granularity: "grapheme" }) {
    return [...new Intl.Segmenter(lang, options).segment(string)].map(s => s.segment);
}

function replacePlaceholders() {
    ROOT.querySelectorAll('.with-holder:not(.lazy)').forEach(el => {
        const pKeys = el.innerHTML.match(/{([a-z-]+)}/g).map(k => k.substring(1, k.length - 1))
        let replaced = el.innerHTML;

        for (const key of pKeys) {
            if (typeof PLACEHOLDER_MAP[key] === "function") continue; // unsupported

            console.info("[APP]", "Applying placeholder", key)
            replaced = replaced.replace(`{${key}}`, PLACEHOLDER_MAP[key])
        }

        el.innerHTML = replaced;
    })
}

function replacePlaceholderFor(element, name, data) {
    if (!element.classList.contains("with-holder") && !element.classList.contains("lazy")) return;
    const pKeys = element.innerHTML.match(/{([a-z-]+)}/g).map(k => k.substring(1, k.length - 1))
    let replaced = element.innerHTML;

    for (const key of pKeys) {
        if (key === name) {
            const placeholder = PLACEHOLDER_MAP[key];
            if (typeof placeholder === "function") {
                console.info("[APP]", "Applying placeholder", name, "with string", `"${data}"`)
                replaced = replaced.replace(`{${key}}`, placeholder(data))
            } else {
                console.info("[APP]", "Applying placeholder", name)
                replaced = replaced.replace(`{${key}}`, placeholder)
            }
        }
    }

    element.innerHTML = replaced;
}

// do this asap
replacePlaceholders();

function toggleLoading() {
    const loader = document.getElementById('loader');

    loader.classList.toggle('hidden');
}


function extractRkeyFromPlainAtURI(uri) {
    return uri.split("/").at(-1)
}

export function constructApiUrl(endpoint_nsid, options, api = DEFAULT_PREVIEW_DID_PDS) {
    const url = new URL(`${api}/xrpc/${endpoint_nsid}`);
    for (const [key, value] of Object.entries(options)) {
        if (!value) continue;
        url.searchParams.set(key, value)
    }

    return url.toString()
}

async function parseResponseBody(response) {
    return await response.json()
}

async function fetchPostsFromPreviewDID(previous_cursor) {
    console.info("[APP]", "Fetching posts from preview DID", DEFAULT_PREVIEW_DID)
    const res = await fetch(constructApiUrl("com.atproto.repo.listRecords", {
        repo: DEFAULT_PREVIEW_DID,
        collection: "space.bunniesin.micro.log",
        cursor: previous_cursor,
    }))

    if (!res.ok) {
        console.error("[APP]", "failed to fetch latest logs:", res.statusText)
        displayError("fetchPreviewList", JSON.stringify(res))
        return;
    }

    const {cursor, records} = await parseResponseBody(res)
    preview_cursor = cursor;

    return records.map(record => ({...record.value, rkey: extractRkeyFromPlainAtURI(record.uri)}));
}

/** @param {string} rkey - Record key */
async function fetchSinglePostFromPreviewDID(rkey) {
    console.info("[APP]", "Fetching", rkey)
    const res = await fetch(constructApiUrl("com.atproto.repo.getRecord", {
        repo: DEFAULT_PREVIEW_DID,
        collection: "space.bunniesin.micro.log",
        rkey
    }))

    if (!res.ok) {
        console.error("[APP]", "failed to fetch log:", res.statusText)
        displayError("fetchPreviewList", res.statusText)
        navigate("log-preview")
        return;
    }

    const {value, uri} = await parseResponseBody(res);

    return {...value, rkey: extractRkeyFromPlainAtURI(uri)}
}

function displayLog(record) {
    if (record["$type"] !== "space.bunniesin.micro.log") throw new Error(`Invalid record type ${record["$type"]}`)
    console.info("[APP]", "Rendering log", record.rkey)

    const logElement = document.createElement('div');
    logElement.classList.add('log');
    const rendered_log = record.content.split("\n\n").map(line => `<p>${line.replace(/\n|\n\r/g, "<br />")}</p>`).join("")

    const permalink = new URL(window.location);
    permalink.searchParams.set("log", record.rkey);

    logElement.innerHTML = `${rendered_log}
<time datetime=${record.createdAt}>${DATE_FORMATTER.format(new Date(record.createdAt))}</time>
<button class="show-hover" onclick="navigator.clipboard.writeText('${permalink.toString()}');this.innerHTML='copied! ✨'">copy permalink</button>`;

    return logElement
}


export async function fetchAndDisplayLatestLogs(cursor) {
    toggleLoading()
    console.info("[APP]", "Loading latest logs")
    POST_LIST.innerHTML = "";

    try {
        const logs = await fetchPostsFromPreviewDID(cursor);

        for (const log of logs) {
            POST_LIST.appendChild(displayLog(log));
        }
    } catch (err) {
        displayError("fetchPreview", err);
        POST_LIST.innerHTML = "<code>:(</code>";
    } finally {
        toggleLoading()
    }
}

export function displayError(context, message) {
    let errorKind;
    switch (context) {
        case "login":
            errorKind = "Login error:";
            break;
        case "oauth":
            errorKind = "OAuth Error:";
            break;
        case "create":
            errorKind = "Error while creating micro.json:";
            break;
        case "fetchPreview":
            errorKind = "Error while fetching log:";
            break;
        case "fetchPreviewList":
            errorKind = "Error while fetching latest logs:";
            break;
        default:
            errorKind = "Unknown error:";
            break;
    }

    alert(errorKind + " " + message)
}

async function handlePermalink() {
    const tid = new URL(window.location).searchParams.get("log");
    if (!tid) return; //this is not for us.
    if (!validateTID(tid)) return;


    const permalinkPage = document.getElementById("log-permalink")
    const permalinkWrapper = permalinkPage.querySelector(".wrapper");

    const title = permalinkPage.querySelector(".with-holder")
    try {
        const post = await fetchSinglePostFromPreviewDID(tid);

        console.info("[APP]", "Opening permalink for", tid)

        replacePlaceholderFor(title, "log-perma-date", new Date(post.createdAt))

        permalinkWrapper.replaceChildren(displayLog(post));
        navigate("log-permalink")
    } catch (err) {
        console.error(err)
        displayError("fetchPreview", err);
    }
}

// from https://tangled.org/zzstoatzz.io/typeahead/blob/main/src/pages/home.ts
// TODO: MASSIVE CODE CLEANUP, I CAN DO BETTER THAN THIS
function registerTypeahead(element) {
    const results = ROOT.querySelector(`.typeahead-results[data-for="${element.id}"]`);
    if (!results) return;

    let timer = null;
    element.addEventListener('input', () => {
        clearTimeout(timer);
        const v = element.value.trim();
        if (v.length < 2) {
            results.classList.remove('show');
            return;
        }
        timer = setTimeout(async () => {
            try {
                const r = await fetch(
                    constructApiUrl('app.bsky.actor.searchActorsTypeahead',
                        {
                            q: encodeURIComponent(v),
                            limit: 3
                        },
                        TYPEAHEAD_PROVIDER));
                const data = await r.json();
                const actors = data.actors || [];
                if (actors.length === 0) {
                    results.innerHTML = '<div class="empty">no results</div>';
                } else {
                    results.innerHTML = actors.map(a =>
                        `<div class="result" onclick="document.getElementById('${element.id}').value='${a.handle}';document.querySelector('.typeahead-results[data-for=${element.id}]').classList.remove('show')">` +
                        (a.avatar ? '<img src="' + a.avatar + '" alt="">' : '<div class="placeholder"></div>') +
                        '<div class="info"><div class="name">' + esc(a.displayName || a.handle) + '</div>' +
                        '<div class="handle">@' + esc(a.handle) + '</div></div></div>'
                    ).join('');
                }
                results.classList.add('show');
            } catch (e) {
            }
        }, 200);
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.search-wrap')) results.classList.remove('show');
    });
    element.addEventListener('focus', () => {
        if (results.innerHTML) results.classList.add('show');
    });

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
}

async function setupTypeaheadElements() {
    for (const element of TYPEAHEAD_ELEMENTS) {
        registerTypeahead(element);
    }
}

defineNavigationHook("log-preview", () => {
    fetchAndDisplayLatestLogs()
})

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.search) {
        handlePermalink();
    }
    setupTypeaheadElements();
    fetchAndDisplayLatestLogs();
})

document.getElementById("log-content").addEventListener('input', (ev) => {
    if (ev.currentTarget.value.length > 300) {
        document.getElementById("do-crosspost").disabled = true;
        document.getElementById("do-crosspost").checked = false;
    } else {
        document.getElementById("do-crosspost").disabled = false;
    }
})
