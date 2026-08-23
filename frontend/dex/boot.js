// Shell wiring: wing rail, tab bar, hash routing and panel mounting.

import * as core from "./core.js";
import { DEFAULT_ROUTE, WINGS, findTab, findWing } from "./registry.js";
import { actionButton, el, readout, shortAddress } from "./ui.js";

const dom = {};
const mounted = new Map();   // "wing/tab" -> { node, ctx }
let active = { ...DEFAULT_ROUTE };

/* ------------------------------------------------------------- routing */

function parseHash() {
    const raw = (window.location.hash || "").replace(/^#\/?/, "");
    const [wingId, tabId] = raw.split("/");
    const wing = findWing(wingId);
    if (!wing) return { ...DEFAULT_ROUTE };
    const tab = findTab(wingId, tabId) || wing.tabs[0];
    return { wing: wing.id, tab: tab.id };
}

function navigate(wingId, tabId) {
    window.location.hash = `#/${wingId}/${tabId}`;
}

function onRouteChange() {
    const next = parseHash();
    active = next;
    paintRail();
    paintTabs();
    showPanel(next.wing, next.tab);
}

/* -------------------------------------------------------------- chrome */

function paintRail() {
    dom.rail.innerHTML = "";
    WINGS.forEach((wing) => {
        const isActive = wing.id === active.wing;
        const node = el("button", {
            class: `wing-button${isActive ? " is-active" : ""}`,
            type: "button",
            onclick: () => navigate(wing.id, wing.tabs[0].id)
        }, [
            el("span", { class: "wing-sigil", text: wing.sigil }),
            el("span", { class: "wing-label", text: wing.label }),
            el("span", { class: "wing-count", text: `${wing.tabs.length} tabs` })
        ]);
        dom.rail.appendChild(node);
    });
}

function paintTabs() {
    const wing = findWing(active.wing);
    dom.wingTitle.textContent = wing.label;
    dom.wingBlurb.textContent = wing.blurb;
    dom.tabBar.innerHTML = "";
    wing.tabs.forEach((tab) => {
        const isActive = tab.id === active.tab;
        dom.tabBar.appendChild(el("button", {
            class: `tab-button${isActive ? " is-active" : ""}`,
            type: "button",
            onclick: () => navigate(wing.id, tab.id)
        }, [
            el("span", { class: "tab-sigil", text: tab.sigil || "" }),
            el("span", { class: "tab-label", text: tab.label })
        ]));
    });
}

/* --------------------------------------------------------------- panels */

function buildContext(key, panel) {
    const refreshers = [];
    let addressInput = null;

    const ctx = {
        key,
        panel,
        get address() {
            return core.getAddress(key);
        },
        setAddress(value) {
            core.setAddress(key, value);
            if (addressInput) addressInput.value = core.getAddress(key);
            ctx.refresh();
        },
        getExtra(name) {
            return core.getAddress(`${key}:${name}`);
        },
        setExtra(name, value) {
            core.setAddress(`${key}:${name}`, value);
        },
        onRefresh(fn) {
            refreshers.push(fn);
        },
        async refresh() {
            for (const fn of refreshers) {
                try {
                    await fn();
                } catch (err) {
                    core.log(`${panel.label} refresh: ${core.describeError(err)}`, "error");
                }
            }
        },
        bindAddressInput(input) {
            addressInput = input;
        }
    };
    return ctx;
}

function addressBar(ctx, panel) {
    const input = el("input", {
        class: "input-glow",
        type: "text",
        placeholder: "0x…",
        value: ctx.address
    });
    input.value = ctx.address;
    ctx.bindAddressInput(input);

    const status = readout("Explorer", "—");

    const load = actionButton("Load", async () => {
        const value = input.value.trim();
        if (value && !core.isAddress(value)) {
            core.log(`${value} is not a valid address.`, "error");
            return;
        }
        core.setAddress(ctx.key, value);
        paintStatus();
        await ctx.refresh();
        core.log(`${panel.label} pointed at ${value || "(blank)"}.`, "info");
    });

    function paintStatus() {
        const value = ctx.address;
        status.value.innerHTML = "";
        if (core.isAddress(value)) {
            status.value.appendChild(el("a", {
                href: core.explorerLink(value),
                target: "_blank",
                rel: "noreferrer noopener",
                text: shortAddress(value)
            }));
        } else {
            status.value.textContent = "—";
        }
    }
    paintStatus();

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") load.click();
    });

    return el("section", { class: "card dex-address-bar" }, [
        el("div", { class: "dex-address-head" }, [
            el("h2", { text: panel.label }),
            el("p", { class: "description", text: panel.tagline })
        ]),
        el("div", { class: "dex-address-controls" }, [
            el("label", { text: panel.addressLabel }),
            input,
            load
        ]),
        status.row
    ]);
}

function showPanel(wingId, tabId) {
    const key = `${wingId}/${tabId}`;
    const panel = findTab(wingId, tabId);
    if (!panel) return;

    mounted.forEach((entry, mountedKey) => {
        entry.node.classList.toggle("is-hidden", mountedKey !== key);
    });

    if (!mounted.has(key)) {
        const ctx = buildContext(key, panel);
        const node = el("div", { class: "panel" });
        node.appendChild(addressBar(ctx, panel));
        node.appendChild(panel.build(ctx));
        dom.panelHost.appendChild(node);
        mounted.set(key, { node, ctx });
    }

    mounted.get(key).ctx.refresh();
}

function refreshActive() {
    const entry = mounted.get(`${active.wing}/${active.tab}`);
    if (entry) entry.ctx.refresh();
}

/* ----------------------------------------------------------------- boot */

async function main() {
    dom.rail = document.getElementById("wingRail");
    dom.tabBar = document.getElementById("tabBar");
    dom.panelHost = document.getElementById("panelHost");
    dom.wingTitle = document.getElementById("wingTitle");
    dom.wingBlurb = document.getElementById("wingBlurb");

    document.getElementById("btnConnect").addEventListener("click", async () => {
        await core.connect();
        refreshActive();
    });
    document.getElementById("btnNetwork").addEventListener("click", () => core.switchNetwork());
    document.getElementById("btnRefresh").addEventListener("click", () => refreshActive());
    document.getElementById("btnClearLogs").addEventListener("click", () => {
        document.getElementById("dexConsole").innerHTML = "";
        core.log("Console cleared.");
    });

    window.addEventListener("hashchange", onRouteChange);

    await core.boot();
    core.onWallet(() => refreshActive());
    onRouteChange();
    core.log("Atropa DEX ready. Pick a wing on the left.", "success");
}

main();
