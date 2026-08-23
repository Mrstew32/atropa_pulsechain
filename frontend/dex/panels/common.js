// Helpers shared by every panel: token metadata lookups and the approve step
// that DYSNOMIA's Purchase/Redeem and YUE's Hong/Hung both depend on.

import { ERC20_ABI } from "../abi.js";
import * as core from "../core.js";
import { actionButton, readout, row } from "../ui.js";

const metaCache = new Map();

/** name/symbol/decimals for an ERC20, cached per address. */
export async function tokenMeta(address) {
    if (!core.isAddress(address)) throw new Error(`Not a contract address: ${address || "(blank)"}`);
    const key = address.toLowerCase();
    if (metaCache.has(key)) return metaCache.get(key);
    const token = core.readContract(address, ERC20_ABI);
    const [name, symbol, decimals] = await Promise.all([
        token.name().catch(() => "?"),
        token.symbol().catch(() => "?"),
        token.decimals().then(Number).catch(() => 18)
    ]);
    const meta = { address, name, symbol, decimals };
    metaCache.set(key, meta);
    return meta;
}

export async function decimalsOf(address) {
    return (await tokenMeta(address)).decimals;
}

export async function balanceOf(address, holder) {
    const token = core.readContract(address, ERC20_ABI);
    return token.balanceOf(holder);
}

/**
 * "Approve <token> for <spender>" row. Both are read at click time via the
 * supplied getters, so the row keeps working as the operator retypes addresses.
 */
export function approveRow(label, getToken, getSpender, getAmount) {
    const status = readout("Allowance", "—");

    async function refresh() {
        try {
            const token = getToken();
            const spender = getSpender();
            if (!core.isAddress(token) || !core.isAddress(spender) || !core.state.account) {
                status.set("—");
                return;
            }
            const meta = await tokenMeta(token);
            const allowance = await core.readContract(token, ERC20_ABI).allowance(core.state.account, spender);
            status.set(`${core.formatAmount(allowance, meta.decimals)} ${meta.symbol}`);
        } catch (err) {
            status.set("—");
        }
    }

    const approve = actionButton(label, async () => {
        try {
            const token = getToken();
            const spender = getSpender();
            const meta = await tokenMeta(token);
            const amount = core.parseAmount(getAmount(), meta.decimals);
            const receipt = await core.sendTx(
                `Approve ${core.formatAmount(amount, meta.decimals)} ${meta.symbol}`,
                () => core.writeContract(token, ERC20_ABI).approve(spender, amount)
            );
            if (receipt) await refresh();
        } catch (err) {
            core.log(`Approve failed: ${core.describeError(err)}`, "error");
        }
    }, "btn-secondary");

    return { node: row([approve]), status: status.row, refresh };
}

/** Live name/symbol/balance readout for a token address the operator types in. */
export function tokenReadout(labelPrefix, getAddress) {
    const info = readout(`${labelPrefix} token`, "—");
    const held = readout(`${labelPrefix} balance`, "—");

    async function refresh() {
        const address = getAddress();
        if (!core.isAddress(address)) {
            info.set("—");
            held.set("—");
            return;
        }
        try {
            const meta = await tokenMeta(address);
            info.set(`${meta.name} (${meta.symbol})`);
            if (core.state.account) {
                const raw = await balanceOf(address, core.state.account);
                held.set(`${core.formatAmount(raw, meta.decimals)} ${meta.symbol}`);
            } else {
                held.set("connect wallet");
            }
        } catch (err) {
            info.set("unreadable");
            held.set("—");
        }
    }

    return { rows: [info.row, held.row], refresh };
}
