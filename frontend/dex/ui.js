// Small DOM helpers so panel modules stay declarative.

export function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
        if (value === null || value === undefined || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "html") node.innerHTML = value;
        else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? "" : value);
    });
    (Array.isArray(children) ? children : [children])
        .filter(Boolean)
        .forEach((child) => node.appendChild(typeof child === "string" ? document.createTextNode(child) : child));
    return node;
}

/** A titled glass card; returns { card, body } so callers can keep filling it. */
export function card(title, subtitle) {
    const body = el("div", { class: "dex-card-body" });
    const head = [el("h2", { html: title })];
    if (subtitle) head.push(el("p", { class: "description", text: subtitle }));
    const node = el("section", { class: "card dex-card" }, [...head, body]);
    return { card: node, body };
}

export function field(label, opts = {}) {
    const input = el("input", {
        class: "input-glow",
        type: opts.type || "text",
        placeholder: opts.placeholder || "",
        value: opts.value || ""
    });
    if (opts.value) input.value = opts.value;
    const group = el("div", { class: "form-group" }, [el("label", { text: label }), input]);
    return { group, input };
}

/** Read-only key/value line whose value can be updated later. */
export function readout(label, initial = "—") {
    const value = el("span", { class: "dex-readout-value", text: initial });
    const row = el("div", { class: "dex-readout" }, [el("span", { class: "dex-readout-key", text: label }), value]);
    return { row, value, set: (text) => { value.textContent = text === "" || text === null || text === undefined ? "—" : String(text); } };
}

export function button(label, onClick, variant = "btn-primary") {
    return el("button", { class: `btn ${variant}`, onclick: onClick, type: "button" }, [label]);
}

export function row(children, className = "btn-group") {
    return el("div", { class: className }, children);
}

export function grid(children) {
    return el("div", { class: "grid-form" }, children);
}

export function note(text) {
    return el("p", { class: "dex-note", text });
}

/** Disable a button while its async handler runs, so a slow tx can't double-fire. */
export function guard(btn, handler) {
    return async (...args) => {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.classList.add("is-busy");
        try {
            await handler(...args);
        } finally {
            btn.disabled = false;
            btn.classList.remove("is-busy");
        }
    };
}

/** button() + guard() in one call. */
export function actionButton(label, handler, variant = "btn-primary") {
    const btn = button(label, null, variant);
    btn.addEventListener("click", guard(btn, handler));
    return btn;
}

export function shortAddress(addr) {
    if (!addr || addr.length < 12) return addr || "—";
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
