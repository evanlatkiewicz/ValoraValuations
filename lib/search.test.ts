import { describe, expect, it } from "vitest";
import { rankCompanies, resolveTyped } from "./search";

const LIST = [
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "APLE", name: "Apple Hospitality REIT, Inc." },
  { ticker: "MSFT", name: "Microsoft Corp" },
  { ticker: "KO", name: "Coca-Cola Co" },
  { ticker: "COKE", name: "Coca-Cola Consolidated, Inc." },
  { ticker: "GOOGL", name: "Alphabet Inc." },
  { ticker: "GOOG", name: "Alphabet Inc." },
  { ticker: "BRK-B", name: "Berkshire Hathaway Inc" },
  { ticker: "BRK-A", name: "Berkshire Hathaway Inc" },
  { ticker: "PINEAPPLE", name: "Pineapple Energy" },
  { ticker: "A", name: "Agilent Technologies, Inc." },
];

describe("rankCompanies", () => {
  it("puts the exact ticker first", () => {
    expect(rankCompanies(LIST, "ko")[0].ticker).toBe("KO");
    expect(rankCompanies(LIST, "a")[0].ticker).toBe("A");
  });
  it("finds companies by name", () => {
    const r = rankCompanies(LIST, "apple");
    expect(r[0].ticker).toBe("AAPL");
    expect(r.map((h) => h.ticker)).toContain("APLE");
    expect(rankCompanies(LIST, "coca cola")[0].ticker).toBe("KO");
    expect(rankCompanies(LIST, "micro")[0].ticker).toBe("MSFT");
  });
  it("shows one row per company", () => {
    const r = rankCompanies(LIST, "alphabet");
    expect(r).toHaveLength(1);
    expect(r[0].ticker).toBe("GOOG");
    expect(rankCompanies(LIST, "berkshire")).toHaveLength(1);
  });
  it("matches inside words only for 3+ letters", () => {
    expect(rankCompanies(LIST, "pple").map((h) => h.ticker)).toContain("PINEAPPLE");
    expect(rankCompanies(LIST, "pp")).toHaveLength(0);
  });
});

describe("resolveTyped", () => {
  it("keeps a typed ticker and maps a name to the top hit", () => {
    expect(resolveTyped("KO", rankCompanies(LIST, "KO"))).toBe("KO");
    expect(resolveTyped("apple", rankCompanies(LIST, "apple"))).toBe("AAPL");
    expect(resolveTyped("ZZZ", [])).toBe("ZZZ");
  });
});
