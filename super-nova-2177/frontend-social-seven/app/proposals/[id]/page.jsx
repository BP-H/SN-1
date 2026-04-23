import ProposalClient from "./ProposalClient";
export async function generateStaticParams() {

  return [
    { id: "1" },
    { id: "2" },
    { id: "3" }
  ];
}
export default async function ProposalPage({ params }) {
  const { id } = await params;
  return <ProposalClient id={id} />;
}