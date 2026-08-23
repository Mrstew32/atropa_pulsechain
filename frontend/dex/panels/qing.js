// Dysnomia wing → QING. The venue token: door policy, market rates and the
// chat log YUE prices against. Source: solidity/dysnomia/domain/dan/03_qing.sol.

import { QING_ABI } from "../abi.js";
import * as core from "../core.js";
import { actionButton, card, field, grid, note, readout, row } from "../ui.js";
import { approveRow, tokenMeta } from "./common.js";

export default {
    id: "qing",
    label: "QING",
    sigil: "青",
    tagline: "Venue token — door policy, market rates, chat log.",
    addressLabel: "QING contract address",

    build(ctx) {
        const host = document.createElement("div");
        host.className = "dex-grid";
        host.appendChild(venueCard(ctx));
        host.appendChild(doorCard(ctx));
        host.appendChild(ratesCard(ctx));
        host.appendChild(bouncerCard(ctx));
        return host;
    }
};

function venueCard(ctx) {
    const { card: node, body } = card("<span class='icon'>🏛️</span> Venue", "What this QING is and what it costs to be inside it.");

    const name = readout("Name");
    const asset = readout("Integrative asset");
    const waat = readout("Waat");
    const entropy = readout("Entropy");
    const gwat = readout("GWAT");
    const cover = readout("Cover charge");
    const divisor = readout("Bouncer divisor");
    const crows = readout("CROWS blocked");
    const supply = readout("Total supply");
    const held = readout("Your balance");
    [name, asset, waat, entropy, gwat, cover, divisor, crows, supply, held].forEach((r) => body.appendChild(r.row));

    ctx.onRefresh(async () => {
        if (!core.isAddress(ctx.address)) {
            [name, asset, waat, entropy, gwat, cover, divisor, crows, supply, held].forEach((r) => r.set("—"));
            return;
        }
        const qing = core.readContract(ctx.address, QING_ABI);
        const decimals = await qing.decimals().then(Number).catch(() => 18);
        const [n, s, assetAddr, w, e, g, c, d, noCrows, total] = await Promise.all([
            qing.name().catch(() => "?"),
            qing.symbol().catch(() => "?"),
            qing.Asset().catch(() => null),
            qing.Waat().catch(() => null),
            qing.Entropy().catch(() => null),
            qing.GWAT().catch(() => null),
            qing.CoverCharge().catch(() => null),
            qing.BouncerDivisor().catch(() => null),
            qing.NoCROWS().catch(() => null),
            qing.totalSupply().catch(() => null)
        ]);
        name.set(`${n} (${s})`);
        waat.set(w === null ? "—" : w.toString());
        entropy.set(e === null ? "—" : e.toString());
        gwat.set(g === null ? "—" : String(g));
        divisor.set(d === null ? "—" : d.toString());
        crows.set(noCrows === null ? "—" : String(noCrows));
        supply.set(total === null ? "—" : core.formatAmount(total, decimals));

        if (assetAddr) {
            const meta = await tokenMeta(assetAddr).catch(() => null);
            asset.set(meta ? `${meta.symbol} · ${assetAddr}` : assetAddr);
            cover.set(c === null ? "—" : `${core.formatAmount(c, meta ? meta.decimals : 18)} ${meta ? meta.symbol : ""}`.trim());
        } else {
            asset.set("—");
            cover.set(c === null ? "—" : c.toString());
        }

        if (core.state.account) held.set(core.formatAmount(await qing.balanceOf(core.state.account), decimals));
        else held.set("connect wallet");
    });

    return node;
}

function doorCard(ctx) {
    const { card: node, body } = card("<span class='icon'>🚪</span> Door", "Join with a LAU, then speak. Admission lasts one day per cover charge.");

    const userToken = field("Your LAU address", { placeholder: "0x…" });
    body.appendChild(userToken.group);

    const admitted = readout("Admitted");
    body.appendChild(admitted.row);

    // Cover is charged in the venue's integrative Asset, approved to the QING.
    let assetAddress = "";
    const coverApproval = approveRow(
        "Approve cover charge",
        () => assetAddress,
        () => ctx.address,
        () => coverAmount.input.value
    );
    const coverAmount = field("Cover amount to approve", { placeholder: "matches CoverCharge" });
    body.appendChild(coverAmount.group);
    body.appendChild(coverApproval.status);
    body.appendChild(coverApproval.node);

    body.appendChild(row([
        actionButton("Check Admission", async () => {
            const qing = core.readContract(ctx.address, QING_ABI);
            const ok = await core.safeRead("Admitted", () => qing.Admitted(userToken.input.value.trim()));
            admitted.set(ok === null ? "—" : String(ok));
        }, "btn-secondary"),
        actionButton("Join", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            const receipt = await core.sendTx("Join", () => qing.Join(userToken.input.value.trim()));
            if (receipt) ctx.refresh();
        })
    ]));

    const message = field("Chat line", { placeholder: "spoken as your LAU username" });
    body.appendChild(message.group);
    body.appendChild(row([
        actionButton("Chat", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            await core.sendTx("Chat", () => qing.Chat(userToken.input.value.trim(), message.input.value));
        })
    ]));
    body.appendChild(note("Join reverts unless the QING's Cho has verified your LAU. Chat emits LogEvent — it costs gas but writes no state."));

    ctx.onRefresh(async () => {
        if (!core.isAddress(ctx.address)) return;
        const qing = core.readContract(ctx.address, QING_ABI);
        const [addr, charge] = await Promise.all([
            qing.Asset().catch(() => ""),
            qing.CoverCharge().catch(() => null)
        ]);
        assetAddress = addr || "";
        if (charge !== null && assetAddress && !coverAmount.input.value) {
            const meta = await tokenMeta(assetAddress).catch(() => ({ decimals: 18 }));
            coverAmount.input.value = core.formatAmount(charge, meta.decimals);
        }
        await coverApproval.refresh();
    });

    return node;
}

function ratesCard(ctx) {
    const { card: node, body } = card("<span class='icon'>📈</span> Market Rates", "The per-asset rates YUE walks when it prices a route.");

    const contract = field("Counter-asset address", { placeholder: "0x…" });
    const rate = field("Rate (whole tokens)", { placeholder: "1.0" });
    body.appendChild(grid([contract.group, rate.group]));

    const current = readout("Current rate");
    const ceiling = readout("Maximum allowed");
    body.appendChild(current.row);
    body.appendChild(ceiling.row);

    body.appendChild(row([
        actionButton("Read Rate", async () => {
            const qing = core.readContract(ctx.address, QING_ABI);
            const target = contract.input.value.trim();
            const decimals = await qing.decimals().then(Number).catch(() => 18);
            const value = await core.safeRead("GetMarketRate", () => qing.GetMarketRate(target));
            current.set(value === null ? "—" : core.formatAmount(value, decimals));
            const supply = await core.safeRead("totalSupply", () => core.readContract(target, QING_ABI).totalSupply());
            ceiling.set(supply === null ? "—" : core.formatAmount(supply / 777n, decimals));
        }, "btn-secondary"),
        actionButton("Add Market Rate", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            const decimals = await core.readContract(ctx.address, QING_ABI).decimals().then(Number);
            const units = core.parseAmount(rate.input.value, decimals);
            const receipt = await core.sendTx("AddMarketRate", () => qing.AddMarketRate(contract.input.value.trim(), units));
            if (receipt) ctx.refresh();
        })
    ]));
    body.appendChild(note("AddMarketRate is owners-only, monotonic (rates can only rise) and capped at the counter-asset's totalSupply / 777."));

    return node;
}

function bouncerCard(ctx) {
    const { card: node, body } = card("<span class='icon'>🛡️</span> Bouncer Controls", "Door staff, guest list and treasury — all bouncer-gated.");

    const who = field("Address", { placeholder: "0x… staff or guest" });
    body.appendChild(who.group);

    const isBouncer = readout("Is bouncer");
    body.appendChild(isBouncer.row);
    body.appendChild(row([
        actionButton("Check Bouncer", async () => {
            const qing = core.readContract(ctx.address, QING_ABI);
            const value = await core.safeRead("bouncer", () => qing.bouncer(who.input.value.trim()));
            isBouncer.set(value === null ? "—" : String(value));
        }, "btn-secondary"),
        actionButton("Add Guest", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            await core.sendTx("setGuestlist", () => qing.setGuestlist(who.input.value.trim()));
        }, "btn-secondary"),
        actionButton("Remove Guest", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            await core.sendTx("removeGuest", () => qing.removeGuest(who.input.value.trim()));
        }, "btn-secondary"),
        actionButton("Grant Staff", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            await core.sendTx("setStaff(true)", () => qing.setStaff(who.input.value.trim(), true));
        }, "btn-secondary"),
        actionButton("Revoke Staff", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            await core.sendTx("setStaff(false)", () => qing.setStaff(who.input.value.trim(), false));
        }, "btn-secondary")
    ]));

    const newCover = field("Cover charge (raw units)", { placeholder: "0" });
    const newDivisor = field("Bouncer divisor", { placeholder: "32" });
    body.appendChild(grid([newCover.group, newDivisor.group]));
    body.appendChild(row([
        actionButton("Set Cover", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            const receipt = await core.sendTx("setCoverCharge", () => qing.setCoverCharge(BigInt(newCover.input.value.trim() || "0")));
            if (receipt) ctx.refresh();
        }),
        actionButton("Set Divisor", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            const receipt = await core.sendTx("setBouncerDivisor", () => qing.setBouncerDivisor(Number(newDivisor.input.value.trim() || "32")));
            if (receipt) ctx.refresh();
        }),
        actionButton("Block CROWS", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            const receipt = await core.sendTx("AllowCROWS(false)", () => qing.AllowCROWS(false));
            if (receipt) ctx.refresh();
        }, "btn-secondary"),
        actionButton("Allow CROWS", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            const receipt = await core.sendTx("AllowCROWS(true)", () => qing.AllowCROWS(true));
            if (receipt) ctx.refresh();
        }, "btn-secondary")
    ]));

    const withdrawToken = field("Withdraw token", { placeholder: "0x…" });
    const withdrawAmount = field("Withdraw amount (raw units)", { placeholder: "0" });
    body.appendChild(grid([withdrawToken.group, withdrawAmount.group]));
    body.appendChild(row([
        actionButton("Withdraw", async () => {
            const qing = core.writeContract(ctx.address, QING_ABI);
            await core.sendTx("Withdraw", () => qing.Withdraw(withdrawToken.input.value.trim(), BigInt(withdrawAmount.input.value.trim() || "0")));
        }, "btn-secondary")
    ]));
    body.appendChild(note("Cover charge and withdrawals take raw base units — the contract does no decimal scaling here. Withdraw asserts !GWAT."));

    return node;
}
