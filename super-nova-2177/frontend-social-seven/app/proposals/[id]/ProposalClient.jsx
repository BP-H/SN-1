"use client";
import { useEffect, useState } from "react";
import ProposalCard from "@/content/proposal/content/ProposalCard";
import Loading from "@/app/Loading";
import ErrorBanner from "@/content/Error";
import Notification from "@/content/Notification";
import { API_BASE_URL } from "@/utils/apiBase";

function formatRelativeTime(dateString) {
  if (!dateString) return "now";
  const raw = String(dateString);
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return "now";
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffSec >= 10 && diffSec < 60) return `${diffSec}s`;
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMin > 0) return `${diffMin}m`;
  return "now";
}

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
      {errorMsg.length > 0 && <ErrorBanner messages={errorMsg} />}
      {notify.length > 0 && <Notification messages={notify} />}
      <ProposalCard
        isDetailPage
        id={proposal.id}
        userName={proposal.userName}
        userInitials={proposal.userInitials}
        time={formatRelativeTime(proposal.time)}
        title={proposal.title}
        text={proposal.text}
        logo={proposal.author_img}
        media={proposal.media}
        likes={proposal.likes}
        dislikes={proposal.dislikes}
        comments={proposal.comments}
        collabs={proposal.collabs}
        profileUrl={proposal.profile_url}
        domainAsProfile={proposal.domain_as_profile}
        specie={proposal.author_type}
        setErrorMsg={setErrorMsg}
        setNotify={setNotify}
      />
    </div>
  );
}
