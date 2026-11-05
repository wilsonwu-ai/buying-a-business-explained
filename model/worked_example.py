#!/usr/bin/env python3
"""Worked example behind the explainer pages and the video.

An illustrative company, not a real deal. Round numbers so every step can be followed by hand.
Run: python3 model/worked_example.py   -> writes model/worked_example.json and model/worked_example.md

Simplifications (stated on the site too):
- SBA rules follow one SBA loan broker's reading of SOP 50 10 8.1 (Oct 2026): the 10% minimum injection,
  at least half of it from the buyer's own unborrowed cash, the other half allowed from "limited sources"
  such as a seller note on full standby. Verify with a lender.
- Ignores the SBA guaranty fee, lender fees and working-capital swings.
- Cash taxes are a flat 10% of EBITDA; capex is 2% of revenue.
- The standby seller note takes no payments while the SBA loan is outstanding; interest accrues at 6% and is
  repaid from the sale.
- Not investment, legal or tax advice.
"""
import json
from pathlib import Path

# ---------- inputs ----------
EBITDA = 1_000_000          # yearly earnings before interest, taxes, depreciation, amortization
REVENUE = 5_000_000
TAX = 0.10                  # cash taxes as a share of EBITDA (proxy)
CAPEX = 0.02                # capex as a share of revenue
CLOSING = 250_000           # closing costs + working-capital reserve
SBA_RATE, SBA_YEARS = 0.0975, 10   # assumed: Prime 7.00% + 2.75%, 10-year, monthly payments
STANDBY_RATE = 0.06
INJECTION = 0.10            # minimum equity injection, share of project cost
OWN_CASH = 0.05             # share that must be the buyer's own cash (one broker's reading of SOP 50 10 8.1)
DSCR_FLOOR = 1.25           # what most lenders underwrite to
SBA_CAP = 5_000_000         # SBA 7(a) maximum loan
PREF, STEP_UP = 0.10, 2.0   # investor terms used in the example (market ranges: 8-12% pref, 1.5-2.5x step-up)
HOLD = 5                    # years until a sale in the example


def cfads(ebitda=EBITDA, revenue=REVENUE):
    """Cash flow available for debt service = EBITDA - cash taxes - capex."""
    return ebitda * (1 - TAX) - CAPEX * revenue


def annual_payment(loan, rate=SBA_RATE, years=SBA_YEARS):
    r, n = rate / 12, years * 12
    return 12 * loan * r / (1 - (1 + r) ** -n)


def balance(loan, years_paid, rate=SBA_RATE, years=SBA_YEARS):
    r, n = rate / 12, years * 12
    m = loan * r / (1 - (1 + r) ** -n)
    left = n - 12 * years_paid
    return 0.0 if left <= 0 else m * (1 - (1 + r) ** -left) / r


def loan_for_payment(payment, rate=SBA_RATE, years=SBA_YEARS):
    r, n = rate / 12, years * 12
    return (payment / 12) * (1 - (1 + r) ** -n) / r


def irr(cfs):
    lo, hi = -0.99, 5.0
    npv = lambda x: sum(cf / (1 + x) ** i for i, cf in enumerate(cfs))
    for _ in range(300):
        mid = (lo + hi) / 2
        if npv(lo) * npv(mid) <= 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def stack(price, investors=0.0):
    project = price + CLOSING
    own = OWN_CASH * project
    standby = (INJECTION - OWN_CASH) * project
    sba = project - own - standby - investors
    pay = annual_payment(sba)
    return {"price": price, "multiple": price / EBITDA, "project_cost": project,
            "buyer_cash": own, "standby_seller_note": standby, "investor_equity": investors,
            "sba_loan": sba, "sba_share_of_project": sba / project,
            "annual_sba_payment": pay, "cfads": cfads(), "dscr": cfads() / pay,
            "cash_left_after_payment": cfads() - pay, "sba_cap_ok": sba <= SBA_CAP}


def paydown(price, growth=0.0, exit_multiple=None, years=10):
    s = stack(price)
    m = exit_multiple or price / EBITDA
    rows = []
    for t in range(0, years + 1):
        e = EBITDA * (1 + growth) ** t
        debt = balance(s["sba_loan"], t)
        standby = s["standby_seller_note"] * (1 + STANDBY_RATE) ** t
        ev = m * e
        rows.append({"year": t, "ebitda": e, "company_value": ev, "sba_balance": debt,
                     "standby_note_balance": standby, "owner_equity": ev - debt - standby})
    return rows


def waterfall(price, investors, growth=0.0, exit_multiple=None, years=HOLD):
    """Participating preferred: each year's cash after the SBA payment pays (1) the investors' pref,
    compounding if unpaid, (2) their money back, (3) the rest split by common ownership.
    Investor common % = step-up x investor dollars / price. At the sale, the company value pays off
    the SBA balance and the standby note first; what is left runs through the same waterfall."""
    s = stack(price, investors)
    m = exit_multiple or price / EBITDA
    common_inv = STEP_UP * investors / price if investors else 0.0
    unreturned, accrued = investors, 0.0
    inv, own = [-investors], [-s["buyer_cash"]]
    for t in range(1, years + 1):
        e = EBITDA * (1 + growth) ** t
        rev = REVENUE * (1 + growth) ** t
        dist = max(0.0, cfads(e, rev) - s["annual_sba_payment"])
        if t == years:
            debt = balance(s["sba_loan"], t) + s["standby_seller_note"] * (1 + STANDBY_RATE) ** t
            dist += max(0.0, m * e - debt)
        i = o = 0.0
        due = accrued + PREF * (unreturned + accrued)
        p = min(dist, due); i += p; dist -= p; accrued = due - p
        r = min(dist, unreturned); i += r; dist -= r; unreturned -= r
        i += common_inv * dist; o += (1 - common_inv) * dist
        inv.append(i); own.append(o)
    out = {"investor_common": common_inv, "buyer_common": 1 - common_inv,
           "buyer_cash_in": s["buyer_cash"], "buyer_cash_back": sum(own[1:]),
           "buyer_irr": irr(own), "buyer_moic": sum(own[1:]) / s["buyer_cash"]}
    if investors:
        out.update({"investor_cash_in": investors, "investor_cash_back": sum(inv[1:]),
                    "investor_irr": irr(inv), "investor_moic": sum(inv[1:]) / investors})
    return out


if __name__ == "__main__":
    a = stack(4_000_000)
    b = stack(5_000_000)
    need = (b["project_cost"] * (1 - INJECTION)) - loan_for_payment(cfads() / DSCR_FLOOR)
    c = stack(5_000_000, need)
    max_loan = loan_for_payment(cfads() / DSCR_FLOOR)
    price_ok = max_loan / (1 - INJECTION) - CLOSING
    d = stack(price_ok)

    res = {
        "inputs": {"ebitda": EBITDA, "revenue": REVENUE, "tax_share_of_ebitda": TAX, "capex_share_of_revenue": CAPEX,
                   "closing_and_reserve": CLOSING, "sba_rate": SBA_RATE, "sba_years": SBA_YEARS,
                   "standby_accrual": STANDBY_RATE, "injection": INJECTION, "own_cash": OWN_CASH,
                   "dscr_floor": DSCR_FLOOR, "sba_cap": SBA_CAP, "pref": PREF, "step_up": STEP_UP, "hold_years": HOLD},
        "cfads": cfads(),
        "A_4x_no_investors": a,
        "B_5x_no_investors": b,
        "C_5x_with_investors": {**c, "investor_equity_needed": need},
        "D_price_that_works_no_investors": d,
        "cash_to_max_project": {str(x): x / OWN_CASH for x in (100_000, 250_000, 500_000)},
        "paydown_4x_flat": paydown(4_000_000),
        "paydown_4x_growth5": paydown(4_000_000, growth=0.05),
        "returns_C_flat": waterfall(5_000_000, need),
        "returns_C_growth5": waterfall(5_000_000, need, growth=0.05),
        "returns_D_flat": waterfall(price_ok, 0.0),
        "returns_D_growth5": waterfall(price_ok, 0.0, growth=0.05),
        "returns_A_flat": waterfall(4_000_000, 0.0),
    }
    here = Path(__file__).parent
    (here / "worked_example.json").write_text(json.dumps(res, indent=2))

    k = lambda x: f"${x/1000:,.0f}K" if abs(x) < 1_000_000 else f"${x/1_000_000:,.2f}M"
    pct = lambda x: f"{x*100:.1f}%"
    L = ["# Worked example (illustrative company, not a real deal)", "",
         f"EBITDA {k(EBITDA)} · revenue {k(REVENUE)} · cash for debt service (CFADS) = EBITDA x (1 - {TAX:.0%}) - {CAPEX:.0%} x revenue = {k(cfads())}",
         f"SBA loan {SBA_RATE:.2%} over {SBA_YEARS} years (assumed) · closing + reserve {k(CLOSING)} · lenders want DSCR >= {DSCR_FLOOR}x", "",
         "| Case | Price | Project cost | Buyer cash (5%) | Standby seller note (5%) | Investors | SBA loan | Yearly SBA payment | DSCR |",
         "|---|---|---|---|---|---|---|---|---|"]
    for name, s in (("A. 4.0x, no investors", a), ("B. 5.0x, no investors", b), ("C. 5.0x + investors above the 10%", c),
                    (f"D. {d['multiple']:.2f}x, no investors", d)):
        L.append(f"| {name} | {k(s['price'])} | {k(s['project_cost'])} | {k(s['buyer_cash'])} | {k(s['standby_seller_note'])} | "
                 f"{k(s['investor_equity'])} | {k(s['sba_loan'])} | {k(s['annual_sba_payment'])} | {s['dscr']:.2f}x |")
    L += ["", f"Investor money needed at 5.0x to reach {DSCR_FLOOR}x: {k(need)}. Price that reaches {DSCR_FLOOR}x with no investors: {k(price_ok)} ({price_ok/EBITDA:.2f}x).",
          "", "## 5% test: largest project each amount of cash supports", ""]
    for x in (100_000, 250_000, 500_000):
        L.append(f"- {k(x)} of your own cash -> project up to {k(x / OWN_CASH)} (SBA 7(a) loans cap at {k(SBA_CAP)}).")
    L += ["", "## Paying down the loan (case A, sale value held at 4.0x EBITDA)", "",
          "| Year | EBITDA flat | SBA balance | Standby note | Owner equity (flat) | Owner equity (+5%/yr EBITDA) |", "|---|---|---|---|---|---|"]
    for r0, r5 in zip(res["paydown_4x_flat"], res["paydown_4x_growth5"]):
        if r0["year"] in (0, 1, 3, 5, 7, 10):
            L.append(f"| {r0['year']} | {k(r0['ebitda'])} | {k(r0['sba_balance'])} | {k(r0['standby_note_balance'])} | {k(r0['owner_equity'])} | {k(r5['owner_equity'])} |")
    L += ["", f"## Who gets what after {HOLD} years (sale at the entry multiple)", "",
          "| Case | Growth | Buyer owns | Buyer cash in | Buyer cash back | Buyer IRR | Investor cash in | Investor cash back | Investor IRR |",
          "|---|---|---|---|---|---|---|---|---|"]
    for name, rr in (("C. 5.0x + investors", res["returns_C_flat"]), ("C. 5.0x + investors", res["returns_C_growth5"]),
                     (f"D. {d['multiple']:.2f}x, no investors", res["returns_D_flat"]), (f"D. {d['multiple']:.2f}x, no investors", res["returns_D_growth5"])):
        g = "0%" if rr in (res["returns_C_flat"], res["returns_D_flat"]) else "5%/yr"
        L.append(f"| {name} | {g} | {pct(rr['buyer_common'])} | {k(rr['buyer_cash_in'])} | {k(rr['buyer_cash_back'])} | {pct(rr['buyer_irr'])} | "
                 f"{k(rr.get('investor_cash_in', 0))} | {k(rr.get('investor_cash_back', 0))} | {pct(rr['investor_irr']) if 'investor_irr' in rr else 'n/a'} |")
    L += ["", f"Investor terms in case C: {PREF:.0%} preferred return, money back first, then a {STEP_UP:.1f}x step-up "
          f"(investor ownership = {STEP_UP:.1f} x investor dollars / price = {pct(res['returns_C_flat']['investor_common'])})."]
    (here / "worked_example.md").write_text("\n".join(L) + "\n")
    print("\n".join(L))
