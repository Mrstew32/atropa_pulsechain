// Dysnomia wing → LAU. The user token: identity, presence and the personal
// market rates it trades on. Source: solidity/dysnomia/11_lau.sol.

import { LAU_ABI, LAU_FACTORY_ABI } from "../abi.js";
import * as core from "../core.js";
import { actionButton, card, field, grid, note, readout, row } from "../ui.js";
import { approveRow, tokenMeta, tokenReadout } from "./common.js";

export default {
    id: "lau",
    label: "LAU",
    sigil: "厶",
    tagline: "User token — identity, presence and personal market rates.",
    addressLabel: "LAU token address",

    build(ctx) {
        const host = document.createElement("div");
        host.className = "dex-grid";
        host.appendChild(identityCard(ctx));
        host.appendChild(marketCard(ctx));
        host.appendChild(presenceCard(ctx));
        host.appendChild(deployCard(ctx));
        return host;
    }
};

function identityCard(ctx) {
    const { card: node, body } = card("<span class='icon'>🪪</span> Identity &amp; Supply", "Everything the LAU contract reports about itself.");

    const name = readout("Name");
    const type = readout("Type");
    const username = readout("Username");
    const supply = readout("Total supply");
    const cap = readout("Max supply");
    const held = readout("Your balance");
    [name, type, username, supply, cap, held].forEach((r) => body.appendChild(r.row));

    const newName = field("New username", { placeholder: "handle" });
    body.appendChild(newName.group);
    body.appendChild(row([
        actionButton("Set Username", async () => {
            const contract = core.writeContract(ctx.address, LAU_ABI);
            const receipt = await core.sendTx("Set Username", () => contract["Username(string)"](newName.input.value.trim()));
            if (receipt) ctx.refresh();
        }),
        actionButton("Mint To Cap", async () => {
            const contract = core.writeContract(ctx.address, LAU_ABI);
            const receipt = await core.sendTx("mintToCap", () => contract.mintToCap());
            if (receipt) ctx.refresh();
        }, "btn-secondary")
    ]));
    body.appendChild(note("Username, Rename and mintToCap are onlyOwners calls — they revert unless your account owns this LAU."));

    ctx.onRefresh(async () => {
        if (!core.isAddress(ctx.address)) {
            [name, type, username, supply, cap, held].forEach((r) => r.set("—"));
            return;
        }
        const lau = core.readContract(ctx.address, LAU_ABI);
        const decimals = await lau.decimals().then(Number).catch(() => 18);
        const [n, s, t, u, total, max] = await Promise.all([
            lau.name().catch(() => "?"),
            lau.symbol().catch(() => "?"),
            lau.Type().catch(() => "?"),
            lau["Username()"]().catch(() => "(owners only)"),
            lau.totalSupply().catch(() => null),
            lau.maxSupply().catch(() => null)
        ]);
        name.set(`${n} (${s})`);
        type.set(t);
        username.set(u);
        supply.set(total === null ? "—" : core.formatAmount(total, decimals));
        cap.set(max === null ? "—" : max.toString());
        if (core.state.account) held.set(core.formatAmount(await lau.balanceOf(core.state.account), decimals));
        else held.set("connect wallet");
    });

    return node;
}

function marketCard(ctx) {
    const { card: node, body } = card("<span class='icon'>⇄</span> Purchase &amp; Redeem", "Trade against the market rate this LAU holds for a counter-asset.");

    const asset = field("Counter-asset address", { placeholder: "0x… token you pay with / receive" });
    const amount = field("LAU amount", { placeholder: "1.0" });
    body.appendChild(grid([asset.group, amount.group]));

    const rate = readout("Market rate");
    const cost = readout("Cost at rate");
    body.appendChild(rate.row);
    body.appendChild(cost.row);

    const counter = tokenReadout("Counter", () => asset.input.value.trim());
    counter.rows.forEach((r) => body.appendChild(r));

    const quote = async () => {
        const target = asset.input.value.trim();
        if (!core.isAddress(ctx.address) || !core.isAddress(target)) return;
        const lau = core.readContract(ctx.address, LAU_ABI);
        const decimals = await lau.decimals().then(Number).catch(() => 18);
        const marketRate = await core.safeRead("GetMarketRate", () => lau.GetMarketRate(target));
        if (marketRate === null) return;
        const meta = await tokenMeta(target).catch(() => ({ symbol: "?", decimals: 18 }));
        rate.set(`${core.formatAmount(marketRate, decimals)} ${meta.symbol} per LAU`);
        if (marketRate === 0n) {
            cost.set("no rate — Purchase/Redeem revert");
            return;
        }
        try {
            const units = core.parseAmount(amount.input.value, decimals);
            cost.set(`${core.formatAmount((units * marketRate) / 10n ** BigInt(decimals), meta.decimals)} ${meta.symbol}`);
        } catch (err) {
            cost.set("enter an amount");
        }
        await counter.refresh();
    };

    const buyApproval = approveRow(
        "Approve counter-asset",
        () => asset.input.value.trim(),
        () => ctx.address,
        () => amount.input.value
    );
    const sellApproval = approveRow(
        "Approve LAU (self)",
        () => ctx.address,
        () => ctx.address,
        () => amount.input.value
    );

    body.appendChild(buyApproval.status);
    body.appendChild(buyApproval.node);
    body.appendChild(row([
        actionButton("Quote", quote, "btn-secondary"),
        actionButton("Purchase LAU", async () => {
            const lau = core.writeContract(ctx.address, LAU_ABI);
            const decimals = await core.readContract(ctx.address, LAU_ABI).decimals().then(Number);
            const units = core.parseAmount(amount.input.value, decimals);
            const receipt = await core.sendTx("Purchase", () => lau.Purchase(asset.input.value.trim(), units));
            if (receipt) ctx.refresh();
        })
    ]));

    body.appendChild(sellApproval.status);
    body.appendChild(sellApproval.node);
    body.appendChild(row([
        actionButton("Redeem LAU", async () => {
            const lau = core.writeContract(ctx.address, LAU_ABI);
            const decimals = await core.readContract(ctx.address, LAU_ABI).decimals().then(Number);
            const units = core.parseAmount(amount.input.value, decimals);
            const receipt = await core.sendTx("Redeem", () => lau.Redeem(asset.input.value.trim(), units));
            if (receipt) ctx.refresh();
        }, "btn-secondary")
    ]));
    body.appendChild(note("Purchase pulls the counter-asset from you (approve it first). Redeem pulls LAU from you, so LAU must approve itself as spender."));

    ctx.onRefresh(async () => {
        await counter.refresh();
        await buyApproval.refresh();
        await sellApproval.refresh();
    });

    return node;
}

function presenceCard(ctx) {
    const { card: node, body } = card("<span class='icon'>💬</span> Presence", "Chat lines and the alias book carried by this LAU.");

    const chat = field("Chat line", { placeholder: "say something" });
    body.appendChild(chat.group);
    body.appendChild(row([
        actionButton("Chat", async () => {
            const lau = core.writeContract(ctx.address, LAU_ABI);
            await core.sendTx("Chat", () => lau.Chat(chat.input.value));
        })
    ]));

    const aliasFor = field("Alias — address", { placeholder: "0x…" });
    const aliasValue = field("Alias — value", { placeholder: "friendly name" });
    body.appendChild(grid([aliasFor.group, aliasValue.group]));

    const aliasOut = readout("Stored alias");
    body.appendChild(aliasOut.row);
    body.appendChild(row([
        actionButton("Read Alias", async () => {
            const lau = core.readContract(ctx.address, LAU_ABI);
            const value = await core.safeRead("Alias", () => lau["Alias(address)"](aliasFor.input.value.trim()));
            aliasOut.set(value === null ? "—" : value || "(empty)");
        }, "btn-secondary"),
        actionButton("Set Alias", async () => {
            const lau = core.writeContract(ctx.address, LAU_ABI);
            await core.sendTx("Set Alias", () => lau["Alias(address,string)"](aliasFor.input.value.trim(), aliasValue.input.value));
        })
    ]));

    return node;
}

function deployCard(ctx) {
    const { card: node, body } = card("<span class='icon'>✨</span> New LAU", "Mint a fresh user token through LAUFactory.");

    const factory = field("LAUFactory address", { placeholder: "0x…", value: ctx.getExtra("factory") });
    factory.input.addEventListener("change", () => ctx.setExtra("factory", factory.input.value.trim()));
    const name = field("Name", { placeholder: "My LAU" });
    const symbol = field("Symbol", { placeholder: "LAU" });
    body.appendChild(factory.group);
    body.appendChild(grid([name.group, symbol.group]));

    const created = readout("Deployed at");
    body.appendChild(created.row);
    body.appendChild(row([
        actionButton("Deploy LAU", async () => {
            const target = factory.input.value.trim();
            ctx.setExtra("factory", target);
            const contract = core.writeContract(target, LAU_FACTORY_ABI);
            const receipt = await core.sendTx("LAUFactory.New", () => contract.New(name.input.value, symbol.input.value));
            if (!receipt) return;
            const deployed = core.newTokenFromReceipt(receipt);
            if (deployed) {
                created.set(deployed);
                core.log(`New LAU at ${deployed} — loading it into this tab.`, "success");
                ctx.setAddress(deployed);
            } else {
                created.set("see transaction logs");
            }
        })
    ]));

    return node;
}
