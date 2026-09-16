import DealPage, { dealMetadata } from "../_components/deal-page";

export const revalidate = 300;

export async function generateMetadata() {
  return dealMetadata("meilleures-promotions");
}

export default async function MeilleuresPromotionsPage() {
  return <DealPage slug="meilleures-promotions" />;
}
