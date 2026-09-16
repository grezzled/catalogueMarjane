import DealPage, { dealMetadata } from "../_components/deal-page";

export const revalidate = 300;

export async function generateMetadata() {
  return dealMetadata("moins-de-100-dh");
}

export default async function MoinsDe100DhPage() {
  return <DealPage slug="moins-de-100-dh" />;
}
