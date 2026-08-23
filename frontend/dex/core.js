// Atropa DEX runtime: wallet plumbing, contract helpers, console logging.
// Deliberately free of any panel/registry imports so panels can import it back.

import { NETWORK, getAddress, setAddress, loadRemoteConfig } from "./config.js";
import { el, shortAddress } from "./ui.js";

const ethers = window.ethers;

export const state = {
    provider: null,      // read provider: injected wallet, else public RPC
    signer: null,
    account: null,
    chainId: null
};

const walletListeners = new Set();

/* ------------------------------------------------------------------ logging */

let consoleBody = null;

export function log(message, type = "info") {
    if (!consoleBody) consoleBody = document.getElementById("dexConsole");
    if (!consoleBody) return;
    const time = new Date().toLocaleTimeString();
    consoleBody.appendChild(el("div", { class: `log-line ${type}`, text: `[${time}] ${message}` }));
    consoleBody.scrollTop = consoleBody.scrollHeight;
}

/** Pull the most human-readable string out of an ethers/provider error. */
export function describeError(err) {
    if (!err) return "Unknown error";
    if (err.reason) return err.reason;
    if (err.shortMessage) return err.shortMessage;
    if (err.info && err.info.error && err.info.error.message) return err.info.error.message;
    return err.message || String(err);
}

/* ----------------------------------------------------------------- provider */

function readProvider() {
    if (state.provider) return state.provider;
    if (window.ethereum) state.provider = new ethers.BrowserProvider(window.ethereum);
    else state.provider = new ethers.JsonRpcProvider(NETWORK.rpcUrls[0]);
    return state.provider;
}

export function onWallet(listener) {
    walletListeners.add(listener);
    listener(state);
    return () => walletListeners.delete(listener);
}

function announce() {
    walletListeners.forEach((listener) => {
        try {
            listener(state);
        } catch (err) {
            log(`Wallet listener failed: ${describeError(err)}`, "error");
        }
    });
}

function paintBadge() {
    const badge = document.getElementById("networkBadge");
    if (!badge) return;
    if (!state.account) {
        badge.textContent = "Disconnected";
        badge.classList.remove("connected");
        return;
    }
    const onTarget = Number(state.chainId) === NETWORK.chainId;
    badge.textContent = onTarget
        ? `${NETWORK.name} · ${shortAddress(state.account)}`
        : `Chain ${state.chainId} · ${shortAddress(state.account)}`;
    badge.classList.toggle("connected", onTarget);
}

export async function connect() {
    if (!window.ethereum) {
        log("No injected wallet found. Reads use the public PulseChain RPC; writes need a wallet.", "warning");
        return null;
    }
    try {
        state.provider = new ethers.BrowserProvider(window.ethereum);
        await state.provider.send("eth_requestAccounts", []);
        state.signer = await state.provider.getSigner();
        state.account = await state.signer.getAddress();
        const network = await state.provider.getNetwork();
        state.chainId = Number(network.chainId);
        log(`Connected ${state.account} on chain ${state.chainId}.`, "success");
        if (state.chainId !== NETWORK.chainId) {
            log(`Expected ${NETWORK.name} (${NETWORK.chainId}). Switch networks before sending transactions.`, "warning");
        }
        paintBadge();
        announce();
        return state.account;
    } catch (err) {
        log(`Connect failed: ${describeError(err)}`, "error");
        return null;
    }
}

export async function switchNetwork() {
    if (!window.ethereum) return;
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: NETWORK.chainIdHex }]
        });
    } catch (err) {
        if (err && err.code === 4902) {
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: NETWORK.chainIdHex,
                    chainName: NETWORK.name,
                    nativeCurrency: NETWORK.currency,
                    rpcUrls: NETWORK.rpcUrls,
                    blockExplorerUrls: [NETWORK.explorer]
                }]
            });
        } else {
            log(`Network switch failed: ${describeError(err)}`, "error");
        }
    }
}

function watchWallet() {
    if (!window.ethereum || !window.ethereum.on) return;
    window.ethereum.on("accountsChanged", async (accounts) => {
        if (!accounts.length) {
            state.signer = null;
            state.account = null;
            log("Wallet disconnected.", "warning");
        } else {
            state.signer = await state.provider.getSigner();
            state.account = accounts[0];
            log(`Active account is now ${state.account}.`, "info");
        }
        paintBadge();
        announce();
    });
    window.ethereum.on("chainChanged", () => window.location.reload());
}

/* ---------------------------------------------------------------- contracts */

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function isAddress(value) {
    return !!value && ethers.isAddress(value);
}

/** Read-only contract handle. Throws with a readable message on a bad address. */
export function readContract(address, abi) {
    if (!isAddress(address)) throw new Error(`Not a contract address: ${address || "(blank)"}`);
    return new ethers.Contract(address, abi, readProvider());
}

/** Signer-bound contract handle for state-changing calls. */
export function writeContract(address, abi) {
    if (!state.signer) throw new Error("Connect a wallet first.");
    if (!isAddress(address)) throw new Error(`Not a contract address: ${address || "(blank)"}`);
    return new ethers.Contract(address, abi, state.signer);
}

/** Submit, log the hash, await the receipt. Returns null (already logged) on failure. */
export async function sendTx(label, build) {
    try {
        log(`${label}: submitting…`);
        const tx = await build();
        log(`${label}: ${tx.hash}`, "info");
        const receipt = await tx.wait();
        log(`${label}: confirmed in block ${receipt.blockNumber}.`, "success");
        return receipt;
    } catch (err) {
        log(`${label} failed: ${describeError(err)}`, "error");
        return null;
    }
}

/** Run a read and surface failures on the console instead of the JS log. */
export async function safeRead(label, fn, fallback = null) {
    try {
        return await fn();
    } catch (err) {
        log(`${label}: ${describeError(err)}`, "error");
        return fallback;
    }
}

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const ZERO_WORD = "0x" + "0".repeat(64);

/**
 * Minter New()/NewGai() return the fresh token address, but a normal tx receipt
 * cannot carry a return value. Every new TT mints in its constructor, so the
 * first mint-shaped Transfer log names the deployed contract.
 */
export function newTokenFromReceipt(receipt) {
    if (!receipt || !receipt.logs) return null;
    const minted = receipt.logs.filter(
        (entry) => entry.topics && entry.topics[0] === TRANSFER_TOPIC && entry.topics[1] === ZERO_WORD
    );
    if (!minted.length) return null;
    return minted[minted.length - 1].address;
}

/* -------------------------------------------------------- units + addresses */

export function parseAmount(value, decimals = 18) {
    const raw = (value || "").trim();
    if (!raw) throw new Error("Amount is required.");
    return ethers.parseUnits(raw, decimals);
}

export function formatAmount(value, decimals = 18, places = 6) {
    if (value === null || value === undefined) return "—";
    const text = ethers.formatUnits(value, decimals);
    if (!text.includes(".")) return text;
    const [whole, frac] = text.split(".");
    const trimmed = frac.slice(0, places).replace(/0+$/, "");
    return trimmed ? `${whole}.${trimmed}` : whole;
}

export function explorerLink(address) {
    return `${NETWORK.explorer}/address/${address}`;
}

export { getAddress, setAddress, shortAddress };

export async function boot() {
    readProvider();
    watchWallet();
    await loadRemoteConfig();
    if (window.ethereum) {
        // Reconnect silently if the wallet already authorised this origin.
        try {
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            if (accounts && accounts.length) await connect();
        } catch (err) {
            /* no pre-existing authorisation */
        }
    } else {
        log("Read-only mode: using public PulseChain RPC.", "warning");
    }
    paintBadge();
}
