"use client";

import { useState } from "react";
import { useActiveBE } from "@/content/ActiveBEContext";
import Notification from "@/content/Notification";
import ErrorBanner from "@/content/Error";
import HomeFeed from "./HomeFeed";

export default function HomeWrapper() {
  const { activeBE } = useActiveBE();
  const [errorMsg, setErrorMsg] = useState([]);
  const [notify, setNotify] = useState([]);

  return (
    <>
      {errorMsg.length > 0 && <ErrorBanner messages={errorMsg} />}
      {notify.length > 0 && <Notification messages={notify} />}
      <HomeFeed
        setErrorMsg={setErrorMsg}
        setNotify={setNotify}
        activeBE={activeBE}
      />
    </>
  );
}
