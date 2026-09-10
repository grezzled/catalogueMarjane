import {
  ShoppingCart,
  Flame,
  Cpu,
  Refrigerator,
  Coffee,
  Home,
  Wine,
  Droplets,
  Apple,
  Shirt,
  Baby,
  BookOpen,
  Package,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Supermarchés": ShoppingCart,
  "Promotions Maroc": Flame,
  "High-Tech": Cpu,
  "Électroménager": Refrigerator,
  "Épicerie": Coffee,
  "Maison": Home,
  "Boissons": Wine,
  "Hygiène": Droplets,
  "Alimentation": Apple,
  "Mode": Shirt,
  "Bébé": Baby,
  "Fournitures scolaires": BookOpen,
};

const DEFAULT_ICON = Package;

export function getCategoryIcon(categoryName: string): LucideIcon {
  return CATEGORY_ICONS[categoryName] ?? DEFAULT_ICON;
}
