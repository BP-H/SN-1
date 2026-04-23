"use client";
import { useEffect, useState } from "react";
import ProposalCard from "@/content/proposal/content/ProposalCard";
import Loading from "@/app/Loading";
import Error from "@/content/Error";
import Notification from "@/content/Notification";
import { API_BASE_URL } from "@/utils/apiBase";

export default function ProposalClient({ id }) {
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [errorMsg, setErrorMsg] = useState([]);
  const [notify, setNotify] = useState([]);

  useEffect(() => {
    async function fetchProposal() {
      try {
        const res = await fetch(`${API_BASE_URL}/proposals/${id}`);
        if (!res.ok) throw new Error("Failed to fetch proposal");
        const data = await res.json();
        setProposal(data);
      } catch (err) {
        setFetchError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProposal();
  }, [id]);

  if (loading) return <Loading />;
  if (fetchError) return <p className="text-red-600">Error: {fetchError}</p>;
  if (!proposal) return <p>No proposal found.</p>;

  return (
    <div className="social-shell px-0">
      {errorMsg.length > 0 && <Error messages={errorMsg} />}
      {notify.length > 0 && <Notification messages={notify} />}
      <ProposalCard
        isDetailPage
        id={proposal.id}
        userName={proposal.userName}
        userInitials={proposal.userInitials}
        time={proposal.time}
        title={proposal.title}
        text={proposal.text}
        logo={proposal.author_img}
        media={proposal.media}
        likes={proposal.likes}
        dislikes={proposal.dislikes}
        comments={proposal.comments}
        specie={proposal.author_type}
        setErrorMsg={setErrorMsg}
        setNotify={setNotify}
      />
    </div>
  );
}
