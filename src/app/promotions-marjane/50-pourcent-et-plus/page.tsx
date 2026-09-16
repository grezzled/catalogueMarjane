import DealPage, { dealMetadata } from "../_components/deal-page";

export const revalidate = 300;

export async function generateMetadata() {
  return dealMetadata("50-pourcent-et-plus");
}

export default async function CinquantePourcentEtPlusPage() {
  return <DealPage slug="50-pourcent-et-plus" />;
}
