// Atropa DEX — network + address configuration.
//
// Defaults are seeded from solidity/addresses.sol and the constants baked into
// the minter contracts. Anything left blank is filled in at runtime: first from
// /api/config (dex section), then from whatever the operator types into a
// panel's address bar (persisted to localStorage).

export const NETWORK = {
    chainId: 369,
    chainIdHex: "0x171",
    name: "PulseChain",
    currency: { name: "Pulse", symbol: "PLS", decimals: 18 },
    rpcUrls: ["https://rpc.pulsechain.com"],
    explorer: "https://scan.pulsechain.com"
};

// Well-known contracts from solidity/addresses.sol.
export const KNOWN = {
    WM: "0xA1BEe1daE9Af77dAC73aA0459eD63b4D93fC6d29",       // minter fee / parent token
    FED: "0x1D177CB9EfEEa49A8B97ab1C72785a3A37ABc9Ff",      // federal root parent
    GAI: "0xd6077A029Fb5BEF33b02391D7f0349c345F6DDb1",
    ATROPA: "0xCc78A0acDF847A2C1714D2A925bB4477df5d48a6",
    CROWS: "0x203e366A1821570b2f84Ff5ae8B3BdeB48Dc4fa1",
    ATROPA_MATH: "0xB680F0cc810317933F234f67EB6A9E923407f05D"
};

// Per-tab default contract addresses, keyed by "<wing>/<tab>".
// Blank means "operator supplies it" — the panel address bar handles that.
export const DEFAULT_ADDRESSES = {
    "dysnomia/lau": "",
    "dysnomia/qing": "",
    "dysnomia/yue": "",
    "minters/personal": "",
    // Named as constants inside the minter contracts themselves.
    "minters/index": "0x0c4F73328dFCECfbecf235C9F78A4494a7EC5ddC",
    "minters/federal": "0xc15c5F699Daf5e1135732139f05D2c05b3EF4354"
};

const STORAGE_PREFIX = "atropa.dex.addr.";
const overrides = {};

/** Merge address overrides served by scripts/server.js at /api/config. */
export async function loadRemoteConfig() {
    try {
        const res = await fetch("/api/config");
        if (!res.ok) return null;
        const cfg = await res.json();
        const dex = cfg.dex || (cfg.networks && cfg.networks.pulsechain && cfg.networks.pulsechain.dex);
        if (dex && typeof dex === "object") {
            Object.entries(dex).forEach(([key, value]) => {
                if (value) overrides[key] = value;
            });
        }
        return cfg;
    } catch (err) {
        return null;
    }
}

/** Resolution order: localStorage (operator) > /api/config > compiled default. */
export function getAddress(key) {
    let stored = null;
    try {
        stored = window.localStorage.getItem(STORAGE_PREFIX + key);
    } catch (err) {
        stored = null;
    }
    return stored || overrides[key] || DEFAULT_ADDRESSES[key] || "";
}

export function setAddress(key, value) {
    const trimmed = (value || "").trim();
    try {
        if (trimmed) window.localStorage.setItem(STORAGE_PREFIX + key, trimmed);
        else window.localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (err) {
        overrides[key] = trimmed;
    }
}
