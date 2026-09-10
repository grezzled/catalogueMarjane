import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ category: string }>;
}

export default async function OldCategoryRedirect({ params }: Props) {
  const { category } = await params;
  const cat = await prisma.category.findUnique({ where: { slug: category } });
  if (cat) {
    redirect(`/category/${category}`);
  }
  redirect("/promotions-marjane");
}
