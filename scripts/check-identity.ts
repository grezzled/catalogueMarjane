import {
  buildIdentity,
  matchIdentity,
  legacyMatches,
  type MatchCandidate,
} from "../src/services/product-identity";

let failures = 0;

function candidate(name: string, brand?: string): MatchCandidate {
  const id = buildIdentity({ name, brand });
  return {
    brand: brand ?? null,
    modelNumber: id.modelNumber,
    size: id.size,
    sizeNum: id.sizeNum,
    variant: id.variant,
    identityKey: id.identityKey,
    coreName: id.coreName,
    normalizedName: name.toLowerCase(),
    name,
  };
}

function same(a: string, b: string, brandA?: string, brandB?: string) {
  const ia = buildIdentity({ name: a, brand: brandA });
  const tier = matchIdentity(ia, candidate(b, brandB));
  const ok = tier !== null;
  console.log(`${ok ? "PASS" : "FAIL"} same: "${a}" <> "${b}" [tier=${tier}]`);
  if (!ok) {
    console.log(`      A=${ia.identityKey}`);
    console.log(`      B=${candidate(b, brandB).identityKey}`);
    failures++;
  }
}

function different(a: string, b: string, brandA?: string, brandB?: string) {
  const ia = buildIdentity({ name: a, brand: brandA });
  const tier = matchIdentity(ia, candidate(b, brandB));
  const ok = tier === null;
  console.log(`${ok ? "PASS" : "FAIL"} diff: "${a}" <> "${b}" [tier=${tier}]`);
  if (!ok) failures++;
  void legacyMatches;
}

// User's core case: 4 spellings, 1 product
same('Samsung TV 55"', "Samsung 55 TV", "Samsung", "Samsung");
same("Samsung 55 TV", "TV Samsung 55 pouces", "Samsung", "Samsung");
same("TV Samsung 55 pouces", "Samsung TV 55", "Samsung", "Samsung");
// cm diagonal equivalence
same("TV Samsung 139 cm", "Samsung TV 55", "Samsung", "Samsung");
// attached vs spaced units
same("Coca-Cola 1L", "Coca-Cola 1 litre", "Coca-Cola", "Coca-Cola");
same("Riz 5kg", "Riz 5 kg", "Cémoi", "Cémoi");
// Model number tier
same("Montre connectée Citytek MF109422", "Citytek MF109422 montre sport", "Citytek", "Citytek");
same("TV Samsung UE55CU7172 Crystal", "Samsung UE55CU7172 55 pouces", "Samsung", "Samsung");
same("TV samsung ue55cu7172", "SAMSUNG UE55CU7172 139cm", "Samsung", "Samsung");
// Packs
same("Pinceaux aquarelle Lot de 3", "3 pinceaux aquarelle");
same("Lait Nido 400g", "Lait Nido 400 g", "Nestlé", "Nestlé");
same("12 feutres Faber-Castell", "Feutres Faber-Castell lot de 12", "Faber-Castell", "Faber-Castell");

// Must NOT merge
different("Samsung TV 55", "Samsung TV 65", "Samsung", "Samsung");
different("TV LED Samsung 55 Crystal UHD", "Samsung TV 55", "Samsung", "Samsung");
different("iPhone 14 128 Go", "iPhone 15 128 Go", "Apple", "Apple");
different("Coca-Cola 1L", "Coca-Cola 2L", "Coca-Cola", "Coca-Cola");
different("Pinceaux aquarelle Lot de 3", "Pinceaux aquarelle Lot de 6");
different("TV Samsung 55", "TV LG 55", "Samsung", "LG");
different("Riz 1 kg", "Riz 5 kg");
different("Lait Nido 400g", "Lait Nido 800g", "Nestlé", "Nestlé");

console.log(failures === 0 ? "\nALL OK" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
