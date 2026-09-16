import type { ProductData } from "@/types";
import prisma from "@/lib/prisma";
import { buildIdentity, matchIdentity, normalizeProductName } from "@/services/product-identity";

// Single source of truth lives in product-identity.ts; re-exported here so
// existing imports (`@/services/categories`) keep working.
export { normalizeProductName };

const CATEGORY_MAP: Record<string, string[]> = {
  Alimentation: [
    "alimentation",
    "nourriture",
    "aliments",
    "conserves",
    "pâtes",
    "riz",
    "céréales",
    "huile",
    "sucre",
    "sel",
    "épices",
    "condiments",
  ],
  Boissons: [
    "boissons",
    "eau",
    "jus",
    "soda",
    "thé",
    "café",
    "lait",
    "boisson",
  ],
  "Épicerie": [
    "épicerie",
    "épicerie fine",
    "confiserie",
    "chocolat",
    "biscuits",
    "snacks",
    "fruits secs",
  ],
  "Produits laitiers": [
    "produits laitiers",
    "yaourt",
    "fromage",
    "beurre",
    "crème",
    "lait",
    "margarine",
  ],
  Hygiène: [
    "hygiène",
    "savon",
    "shampooing",
    "dentifrice",
    "déodorant",
    "serviettes",
    "hygiène buccale",
  ],
  Beauté: [
    "beauté",
    "cosmétiques",
    "maquillage",
    "parfum",
    "crème",
    "soin",
    "solaire",
  ],
  Bébé: [
    "bébé",
    "couches",
    "lait bébé",
    "biberon",
    "purée",
    "nounours",
    "enfant",
  ],
  Maison: [
    "maison",
    "décoration",
    "rangement",
    "nettoyage",
    "linge",
    "cuisine maison",
    "textile",
  ],
  Cuisine: [
    "cuisine",
    "ustensiles",
    "casseroles",
    "poêles",
    "vaisselle",
    "serviette",
    "table",
  ],
  Électroménager: [
    "électroménager",
    "réfrigérateur",
    "lave-linge",
    "lave-vaisselle",
    "four",
    "micro-ondes",
    "aspirateur",
    "climatisation",
    "machine à laver",
    "sèche-linge",
    "congélateur",
    " cuisinière",
  ],
  "High-Tech": [
    "high-tech",
    "informatique",
    "ordinateur",
    "laptop",
    "pc",
    "imprimante",
    "accessoires",
  ],
  Télévision: [
    "télévision",
    "tv",
    "écran",
    "téléviseur",
    "smart tv",
    "led",
    "oled",
  ],
  Téléphones: [
    "téléphone",
    "smartphone",
    "mobile",
    "tablette",
    "accessoire téléphone",
    "samsung",
    "iphone",
    "apple",
  ],
  Mode: [
    "mode",
    "vêtements",
    "habillement",
    "pantalon",
    "chemise",
    "robe",
    "t-shirt",
  ],
  Chaussures: [
    "chaussures",
    "sneakers",
    "sandales",
    "baskets",
    "talons",
    "chaussure",
  ],
  "Fournitures scolaires": [
    "fournitures",
    "scolaire",
    "cahier",
    "stylo",
    "cartable",
    "règle",
    "sac",
  ],
  Jouets: [
    "jouets",
    "jouet",
    "puzzle",
    "peluche",
    "figurine",
    "jeu",
    "enfant",
  ],
  Jardin: [
    "jardin",
    "plante",
    "arrosage",
    "mobilier jardin",
    "terrasse",
    "balcon",
  ],
  Bricolage: [
    "bricolage",
    "outils",
    "perceuse",
    "vis",
    "peinture",
    "rénovation",
  ],
  Sport: [
    "sport",
    "fitness",
    "musculation",
    "vélot",
    "ballon",
    "sportif",
  ],
  Voyage: ["valise", "sac de voyage", "voyage", "cabin"],
  Automobile: ["auto", "voiture", "accessoire auto", "pneu"],
};

export function detectCategory(text: string): string {
  const lower = text.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }

  return "Other";
}

export async function ensureCategoriesExist(categoryNames: string[]): Promise<void> {
  for (const name of categoryNames) {
    if (!name || name === "Other") continue;
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }
}

export function normalizeBrand(brand: string | null): string | null {
  if (!brand) return null;
  return brand
    .trim()
    .toLowerCase()
    .replace(/^\s+|\s+$/g, "");
}

const BRAND_PATTERNS: Record<string, string[]> = {
  samsung: ["samsung"],
  apple: ["apple", "iphone", "ipad", "macbook"],
  lg: ["lg"],
  bosch: ["bosch"],
  philips: ["philips"],
  tefal: ["tefal"],
  rowenta: ["rowenta"],
  moulinex: ["moulinex"],
  hitachi: ["hitachi"],
  sony: ["sony"],
  toshiba: ["toshiba"],
  haier: ["haier"],
  whirlpool: ["whirlpool"],
  dell: ["dell"],
  hp: ["hp", "hewlett"],
  lenovo: ["lenovo"],
  asus: ["asus"],
  xiaomi: ["xiaomi"],
  huawei: ["huawei"],
  nokia: ["nokia"],
  oppo: ["oppo"],
  realme: ["realme"],
  nestle: ["nestlé", "nestle"],
  danone: ["danone"],
  mlc: ["mlc"],
  marjane: ["marjane"],
};

export function detectBrand(name: string): string | null {
  const lower = name.toLowerCase();

  for (const [brand, patterns] of Object.entries(BRAND_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return brand.charAt(0).toUpperCase() + brand.slice(1);
      }
    }
  }

  return null;
}

export function mergeProducts(
  existing: ProductData[],
  incoming: ProductData[]
): ProductData[] {
  const merged = [...existing];
  const identities = merged.map((p) =>
    buildIdentity({
      name: p.name,
      brand: p.brand,
      aiModelNumber: p.modelNumber,
      specs: p.features,
    })
  );

  for (const product of incoming) {
    const identity = buildIdentity({
      name: product.name,
      brand: product.brand,
      aiModelNumber: product.modelNumber,
      specs: product.features,
    });
    const existingIndex = identities.findIndex((id, i) => {
      if (
        matchIdentity(identity, {
          brand: merged[i].brand ?? null,
          modelNumber: id.modelNumber,
          size: id.size,
          sizeNum: id.sizeNum,
          variant: id.variant,
          identityKey: id.identityKey,
          coreName: id.coreName,
          normalizedName: normalizeProductName(merged[i].name),
          name: merged[i].name,
        })
      ) {
        return true;
      }
      return normalizeProductName(merged[i].name) === normalizeProductName(product.name);
    });

    if (existingIndex === -1) {
      merged.push(product);
      identities.push(identity);
    }
  }

  return merged;
}
