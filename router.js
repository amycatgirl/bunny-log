const ROOT = document.querySelector('main[data-currentpage]');

export function navigate(where) {
    ROOT.dispatchEvent(new CustomEvent('router-navigate', {
        detail: {
            where
        }
    }));
}

function broadcastMessage(message) {
    console.info("[ROUTER]", "broadcasting", {
        detail: {
            type: message
        }
    })
    ROOT.dispatchEvent(new CustomEvent('broadcast', {
        detail: {
            type: message
        }
    }))
}

function receiveRouterBroadcast(data) {
    ROOT.setAttribute('data-currentpage', data.where);
    console.info("[ROUTER]", "Navigated to", data.where);
    triggerNavigationHooksInOrder(data.where)
}

/** @type {Map<string, Set<{id: number, fn: () => void}>>}*/
const NAV_HOOKS = new Map();
let nav_hook_idx = 0;

function triggerNavigationHooksInOrder(route) {
    const hooks_for_route = NAV_HOOKS.get(route);

    hooks_for_route.keys().forEach(hook => hook.fn())
}

function routerLinkHandler(action, data) {
    switch (action) {
        case 'navigate':
            console.info("[ROUTER]", "Navigated to", data);
            ROOT.setAttribute('data-currentpage', data);
            triggerNavigationHooksInOrder(data)
            break;
        case 'broadcast':
            broadcastMessage(data);
            break;
        default:
            console.warn("Unknown action type:", action)
            break;
    }
}

function registerLinks() {
    const anchors = ROOT.querySelectorAll('a.router-link');

    for (const anchor of anchors) {
        const action_type = anchor.getAttribute('data-action');
        const action_data = anchor.getAttribute('data-argument');

        anchor.addEventListener('click', (event) => {
            event.preventDefault();

            routerLinkHandler(action_type, action_data);
        })
    }
}

function registerPages() {
    const pages = ROOT.querySelectorAll('.page');

    for (const page of pages) {
        NAV_HOOKS.set(page.id, new Set());
    }
}

export function defineNavigationHook(route, callback) {
    const hooks = NAV_HOOKS.get(route);
    hooks.add({
        id: nav_hook_idx++,
        fn: callback
    })
}

registerPages();
registerLinks();

ROOT.addEventListener('router-navigate', ({detail}) => receiveRouterBroadcast(detail))