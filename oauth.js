import { BrowserOAuthClient } from '@atproto/oauth-client-browser'
import { Agent } from '@atproto/api'
import { displayError, constructApiUrl, ALLOWED_DIDS } from "#app"
import { navigate } from "#app/router"

const OAUTH_SCOPES = "atproto repo:app.bsky.feed.post?action:create repo:space.bunniesin.micro.log?action=create";
const ROOT = document.querySelector("main[data-currentpage]");

function clientID() {
    const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (isLocal) {
        // see https://atproto.com/specs/oauth#localhost-client-development
        return `http://localhost?${new URLSearchParams({
            scope: OAUTH_SCOPES,
            redirect_uri: Object.assign(new URL(window.location.origin), { hostname: '127.0.0.1' }).href,
        })}`
    }
    return `https://${window.location.host}/oauth-client-metadata.json`
}

const CLIENT_ID = clientID();

let oauthClient;
let agent;

async function beforeLogin(identifier) {
    console.debug("[OAUTH]", "performing beforeLogin check for handle", identifier);

    const res = await fetch(
        constructApiUrl("com.atproto.identity.resolveHandle", {
            handle: identifier
        }, "https://api.bsky.app")
    ).then(async (res) => await res.json())


    if (!ALLOWED_DIDS.includes(res.did)) {
        console.warn("[OAUTH]", "Unauthorized DID", res.did);

        navigate("log-unauthorized");
        return false
    }

    return true
}

async function setupOAuth() {
    try {
        oauthClient = await BrowserOAuthClient.load({
            clientId: CLIENT_ID,
            handleResolver: "https://bsky.social",
        })

        const result = await oauthClient.init();

        if (!result) return

        const { session, state } = result
        if (state != null) {
            console.debug("[OAUTH]", "Authenticated", session.sub, `(state: ${state})`)
        } else {
            console.info("[OAUTH]", "Restored session", session.sub)
        }

        agent = new Agent(session);

        const res = await agent.com.atproto.server.getSession();
        if (!res.success) {
            console.error("[OAUTH]", "Could not acquire session", res);
            throw new Error(JSON.stringify(res));
        }

        console.info("[OAUTH]", "Agent initialized")
        ROOT.setAttribute("data-state", "authorized");
    } catch (error) {
        displayError("oauth", error)
    }
}

async function performLogin(identifier, form) {
    form.querySelectorAll('button').forEach(input => {
        input.setAttribute('aria-busy', "true");
        input.setAttribute("disabled", true);
    })

    try {
        if (!await beforeLogin(identifier)) return;

        await oauthClient.signIn(identifier, {
            state: window.crypto.randomUUID(),
            signal: new AbortController().signal
        })
    } catch (err) {
        displayError("login", err);
        console.error(err);

    } finally {
        form.querySelectorAll('button').forEach(input => {
            input.removeAttribute('aria-busy');
            input.removeAttribute("disabled");
        })
    }
}

function revokeSession() {
    if (!agent?.did) return; // do not revoke if we aren't logged in lol

    oauthClient.revoke(agent.did);
    window.location.reload();
}

async function createLog(content, form) {
    form.querySelectorAll('button').forEach(input => {
        input.setAttribute('aria-busy', "true");
        input.setAttribute("disabled", true);
    })

    try {
        await agent.com.atproto.repo.createRecord({
            repo: agent.did,
            collection: 'space.bunniesin.micro.log',
            record: {
                "$type": "space.bunniesin.micro.log",
                "content": content,
                createdAt: new Date().toISOString(),
            }
        })

        navigate("log-preview");
    } catch (err) {
        displayError("create", err);
        console.error(err);

    } finally {
        form.querySelectorAll('button').forEach(input => {
            input.removeAttribute('aria-busy');
            input.removeAttribute("disabled");
        })
    }
}

ROOT.addEventListener('broadcast', (ev) => {
    console.info("[ATPROTO]", "received", ev)
    switch (ev.detail.type) {
        case 'destroy':
            revokeSession();
            break;
        default:
            console.warn("Unknown broadcasted type", ev.type);
            break;
    }
})

document.getElementById('log-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ROOT.querySelector('form#log-form');
    const content = form.querySelector('textarea#log-content').value;

    createLog(content, form)
})

document.getElementById('login-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ROOT.querySelector('form#login-form');
    const identifier = form.querySelector('input[name="handle"]').value;
    performLogin(identifier, form)
})

setupOAuth()