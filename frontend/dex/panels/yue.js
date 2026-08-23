// Dysnomia wing → YUE. The exchange engine: Hong buys a QING asset along a
// route, Hung redeems back out. Source: solidity/dysnomia/domain/yue.sol.

import { YUE_ABI } from "../abi.js";
import * as core from "../core.js";
import { actionButton, card, field, grid, note, readout, row } from "../ui.js";
import { approveRow, tokenMeta, tokenReadout } from "./common.js";

export default {
    id: "yue",
    label: "YUE",
    sigil: "月",
    tagline: "Exchange engine — route pricing, Hong purchases, Hung redemptions.",
    addressLabel: "YUE contract address",

    build(ctx) {
        const host = document.createElement("div");
        host.className = "dex-grid";
        host.appendChild(engineCard(ctx));
        host.appendChild(hongCard(ctx));
        host.appendChild(hungCard(ctx));
        host.appendChild(barCard(ctx));
        return host;
    }
};

function engineCard(ctx) {
    const { card: node, body } = card("<span class='icon'>⚙️</span> Engine", "The YUE contract itself.");

    const name = readout("Name");
    const type = readout("Type");
    const origin = readout("Origin");
    const chan = readout("Chan");
    const supply = readout("Total supply");
    const held = readout("Your balance");
    [name, type, origin, chan, supply, held].forEach((r) => body.appendChild(r.row));

    ctx.onRefresh(async () => {
        if (!core.isAddress(ctx.address)) {
            [name, type, origin, chan, supply, held].forEach((r) => r.set("—"));
            return;
        }
        const yue = core.readContract(ctx.address, YUE_ABI);
        const decimals = await yue.decimals().then(Number).catch(() => 18);
        const [n, s, t, o, c, total] = await Promise.all([
            yue.name().catch(() => "?"),
            yue.symbol().catch(() => "?"),
            yue.Type().catch(() => "?"),
            yue.Origin().catch(() => null),
            yue.Chan().catch(() => null),
            yue.totalSupply().catch(() => null)
        ]);
        name.set(`${n} (${s})`);
        type.set(t);
        origin.set(o || "—");
        chan.set(c || "—");
        supply.set(total === null ? "—" : core.formatAmount(total, decimals));
        if (core.state.account) held.set(core.formatAmount(await yue.balanceOf(core.state.account), decimals));
        else held.set("connect wallet");
    });

    return node;
}

/** Shared route inspector: validity + rate + the cost the contract will compute. */
function routeReadout() {
    const valid = readout("Route valid");
    const rate = readout("Asset rate");
    const cost = readout("Counter-value");
    return { valid, rate, cost, rows: [valid.row, rate.row, cost.row] };
}

async function quoteRoute(ctx, route, qingAddress, integrativeAddress, amountText, mode) {
    if (!core.isAddress(ctx.address) || !core.isAddress(qingAddress) || !core.isAddress(integrativeAddress)) {
        core.log("Enter the YUE, QING and counter-asset addresses first.", "warning");
        return null;
    }
    const yue = core.readContract(ctx.address, YUE_ABI);
    const decimals = await yue.decimals().then(Number).catch(() => 18);

    const isValid = await core.safeRead("IsValidAsset", () => yue.IsValidAsset(qingAddress, integrativeAddress));
    route.valid.set(isValid === null ? "—" : String(isValid));

    const assetRate = await core.safeRead("GetAssetRate", () => yue.GetAssetRate(qingAddress, integrativeAddress));
    if (assetRate === null) return null;
    route.rate.set(core.formatAmount(assetRate, decimals));
    if (assetRate === 0n) {
        route.cost.set("no rate — the call reverts");
        return null;
    }

    const counter = await tokenMeta(integrativeAddress).catch(() => ({ symbol: "?", decimals: 18 }));
    const qing = await tokenMeta(qingAddress).catch(() => ({ symbol: "?", decimals: 18 }));
    try {
        // Both directions denominate the typed amount in the QING asset.
        const units = core.parseAmount(amountText, qing.decimals);
        const value = (units * assetRate) / 10n ** BigInt(decimals);
        route.cost.set(
            mode === "hong"
                ? `you pay ≈ ${core.formatAmount(value, counter.decimals)} ${counter.symbol}`
                : `you receive ≈ ${core.formatAmount(value, counter.decimals)} ${counter.symbol}`
        );
        return { units, assetRate, value, decimals };
    } catch (err) {
        route.cost.set("enter an amount");
        return null;
    }
}

function hongCard(ctx) {
    const { card: node, body } = card("<span class='icon'>🟢</span> Hong — Purchase", "Spend a counter-asset to receive a QING asset along its route.");

    const spend = field("Spend asset", { placeholder: "0x… token you pay with" });
    const qing = field("QING asset", { placeholder: "0x… token you receive" });
    const amount = field("QING amount to buy", { placeholder: "1.0" });
    body.appendChild(grid([spend.group, qing.group]));
    body.appendChild(amount.group);

    const route = routeReadout();
    route.rows.forEach((r) => body.appendChild(r));

    const spendInfo = tokenReadout("Spend", () => spend.input.value.trim());
    spendInfo.rows.forEach((r) => body.appendChild(r));

    // Hong pulls `cost` of the spend asset, so the allowance must cover the
    // counter-value rather than the QING amount typed above.
    const costEstimate = { text: "0" };
    const approval = approveRow(
        "Approve spend asset",
        () => spend.input.value.trim(),
        () => ctx.address,
        () => costEstimate.text
    );
    body.appendChild(approval.status);
    body.appendChild(approval.node);

    body.appendChild(row([
        actionButton("Quote", async () => {
            const quote = await quoteRoute(ctx, route, qing.input.value.trim(), spend.input.value.trim(), amount.input.value, "hong");
            if (quote) {
                const counter = await tokenMeta(spend.input.value.trim()).catch(() => ({ decimals: 18 }));
                costEstimate.text = core.formatAmount(quote.value, counter.decimals, 18);
            }
            await spendInfo.refresh();
            await approval.refresh();
        }, "btn-secondary"),
        actionButton("Hong", async () => {
            const yue = core.writeContract(ctx.address, YUE_ABI);
            const meta = await tokenMeta(qing.input.value.trim());
            const units = core.parseAmount(amount.input.value, meta.decimals);
            const receipt = await core.sendTx("Hong", () => yue.Hong(spend.input.value.trim(), qing.input.value.trim(), units));
            if (receipt) ctx.refresh();
        })
    ]));
    body.appendChild(note("Quote first: the approval must cover the counter-value YUE pulls, not the QING amount you asked for. Approve a little over the quote to absorb rate drift."));

    ctx.onRefresh(async () => {
        await spendInfo.refresh();
        await approval.refresh();
    });

    return node;
}

function hungCard(ctx) {
    const { card: node, body } = card("<span class='icon'>🔴</span> Hung — Redeem", "Return a QING asset and take the counter-asset back out.");

    const qing = field("QING asset", { placeholder: "0x… token you return" });
    const receive = field("Receive asset", { placeholder: "0x… token you get back" });
    const amount = field("QING amount to redeem", { placeholder: "1.0" });
    body.appendChild(grid([qing.group, receive.group]));
    body.appendChild(amount.group);

    const route = routeReadout();
    route.rows.forEach((r) => body.appendChild(r));

    const qingInfo = tokenReadout("QING", () => qing.input.value.trim());
    qingInfo.rows.forEach((r) => body.appendChild(r));

    // Hung pulls the QING amount itself, so the typed amount is the allowance.
    const approval = approveRow(
        "Approve QING asset",
        () => qing.input.value.trim(),
        () => ctx.address,
        () => amount.input.value
    );
    body.appendChild(approval.status);
    body.appendChild(approval.node);

    body.appendChild(row([
        actionButton("Quote", async () => {
            await quoteRoute(ctx, route, qing.input.value.trim(), receive.input.value.trim(), amount.input.value, "hung");
            await qingInfo.refresh();
            await approval.refresh();
        }, "btn-secondary"),
        actionButton("Hung", async () => {
            const yue = core.writeContract(ctx.address, YUE_ABI);
            const meta = await tokenMeta(qing.input.value.trim());
            const units = core.parseAmount(amount.input.value, meta.decimals);
            const receipt = await core.sendTx("Hung", () => yue.Hung(qing.input.value.trim(), receive.input.value.trim(), units));
            if (receipt) ctx.refresh();
        })
    ]));
    body.appendChild(note("YUE pays out of its own holdings — a redemption larger than its balance of the receive asset reverts."));

    ctx.onRefresh(async () => {
        await qingInfo.refresh();
        await approval.refresh();
    });

    return node;
}

function barCard(ctx) {
    const { card: node, body } = card("<span class='icon'>📊</span> Bar &amp; React", "Per-QING hypogram/epigram depth, and the reaction that advances it.");

    const target = field("QING address", { placeholder: "0x…" });
    body.appendChild(target.group);

    const hypo = readout("Hypogram");
    const epi = readout("Epigram");
    body.appendChild(hypo.row);
    body.appendChild(epi.row);

    body.appendChild(row([
        actionButton("Read Bar", async () => {
            const yue = core.readContract(ctx.address, YUE_ABI);
            const result = await core.safeRead("Bar", () => yue.Bar(target.input.value.trim()));
            if (!result) return;
            hypo.set(result[0].toString());
            epi.set(result[1].toString());
        }, "btn-secondary"),
        actionButton("React", async () => {
            const yue = core.writeContract(ctx.address, YUE_ABI);
            const receipt = await core.sendTx("React", () => yue.React(target.input.value.trim()));
            if (receipt) ctx.refresh();
        })
    ]));
    body.appendChild(note("React is owners-only and reverts with ZeroHoldings unless tx.origin holds YUE."));

    return node;
}
