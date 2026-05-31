import { defineNavigationHook } from "#app/router"

const DEFAULT_PREVIEW_HANDLE = "bunniesin.space";
const DEFAULT_PREVIEW_DID = "did:plc:gijpvbkdbr56kazbdjhfvb3d";
const DEFAULT_PREVIEW_DID_PDS = "https://eurosky.social"
export const ALLOWED_DIDS = ["did:plc:gijpvbkdbr56kazbdjhfvb3d"];
const INSTANCE_OPERATOR_HANDLE = "bunniesin.space";
const INSTANCE_OPERATOR_CONTACTS = [{
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

const PLACEHOLDER_MAP = {
    "unauth-op-contact-list": INSTANCE_OPERATOR_CONTACTS.map(({type, value}) => `<li>${type}: ${value}</li>`).join("\n"),
    "unauth-op-contacts-msg": INSTANCE_OPERATOR_HANDLE,
    "preview-latest-handle": DEFAULT_PREVIEW_HANDLE,
}

const ROOT = document.getElementById('root');
const POST_LIST = document.getElementById('postlist-wrapper');
const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeStyle: "long",
    dateStyle: "short"
})

function replacePlaceholders() {
    ROOT.querySelectorAll('.with-holder').forEach(el => {
        const pKeys = el.innerHTML.match(/{([a-z-]+)}/g).map(k => k.substring(1, k.length - 1))
        let replaced = el.innerHTML;

        for (const key of pKeys) {
            replaced = replaced.replace(`{${key}}`, PLACEHOLDER_MAP[key])
        }

        el.innerHTML = replaced;
    })
}

function toggleLoading() {
    const loader = document.getElementById('loader');

    loader.classList.toggle('hidden');
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
    const res = await fetch(constructApiUrl("com.atproto.repo.listRecords", {
        repo: DEFAULT_PREVIEW_DID,
        collection: "space.bunniesin.micro.log",
        cursor: previous_cursor,
    }))

    if (!res.ok) {
        console.error("[APP]", "failed to fetch latest logs:", res.statusText)
        return;
    }

    const {cursor, records} = await parseResponseBody(res)
    preview_cursor = cursor;

    return records.map(record => record.value);
}

function displayLog(record) {
    const logElement = document.createElement('div');
    logElement.classList.add('log');
    const rendered_log = record.content.split("\n\n").map(line => `<p>${line}</p>`).join("\n")
    logElement.innerHTML = `${rendered_log}\n<time datetime=${record.createdAt}>${DATE_FORMATTER.format(new Date(record.createdAt))}</time>`;

    return logElement
}


export async function fetchAndDisplayLatestLogs(cursor) {
    toggleLoading()
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

document.addEventListener("DOMContentLoaded", () => {
    replacePlaceholders();
    fetchAndDisplayLatestLogs()
})

defineNavigationHook("log-preview", () => {
    fetchAndDisplayLatestLogs()
})

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
            errorKind = "Error while fetching latest logs:";
            break;
        default:
            errorKind = "Unknown error:";
            break;
    }

    alert(errorKind + " " + message)
}