"use client";
import Proposal from "@/content/proposal/Proposal";
import { useActiveBE } from "@/content/ActiveBEContext";
import Notification from "@/content/Notification";
import Error from "@/content/Error";
import { useState } from "react";

export default function ProposalWrapper() {
  const { activeBE, setActiveBE } = useActiveBE();
  const [errorMsg, setErrorMsg] = useState([]);
  const [notify, setNotify] = useState([]);

  return (
    <>
      {errorMsg.length > 0 && <Error messages={errorMsg} />}
      {notify.length > 0 && <Notification messages={notify} />}
      <Proposal
        setErrorMsg={setErrorMsg}
        setNotify={setNotify}
        activeBE={activeBE}
        setActiveBE={setActiveBE}
      />
    </>
  );
}
