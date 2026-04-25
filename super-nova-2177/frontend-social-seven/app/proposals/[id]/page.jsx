import ProposalClient from "./ProposalClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProposalPage({ params }) {
  const { id } = await params;
  return <ProposalClient id={id} />;
}
