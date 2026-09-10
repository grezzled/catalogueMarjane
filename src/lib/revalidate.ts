import { revalidatePath } from "next/cache";

export function revalidateSite() {
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  revalidatePath("/catalogue-marjane");
  revalidatePath("/promotions-marjane");
  revalidatePath("/articles");
}
