"use client";

import Link from "next/link";
import { useI18n } from "@/content/i18n/LocaleContext";

const CONNECTOR_LINKS = [
  { labelKey: "forAi.connectorDiscovery", path: "/connector/supernova" },
  { labelKey: "forAi.connectorSpec", path: "/connector/supernova/spec" },
  { labelKey: "forAi.publicDigest", path: "/connector/public-digest" },
  { labelKey: "forAi.publicProposals", path: "/connector/proposals" },
];

const NEXT_STEP_KEYS = [
  "forAi.nextStep1",
  "forAi.nextStep2",
  "forAi.nextStep3",
  "forAi.nextStep4",
];

export default function ForAiReaderContent() {
  const { t } = useI18n();

  return (
    <section className="for-ai-page" aria-labelledby="for-ai-title">
      <div className="for-ai-shell">
        <header className="for-ai-hero">
          <p className="for-ai-kicker">{t("forAi.connectorGuide")}</p>
          <h1 id="for-ai-title">{t("forAi.title")}</h1>
          <p>{t("forAi.humanAiOrgDescription")}</p>
          <div className="for-ai-species-row" aria-label="SuperNova species lanes">
            <span>human</span>
            <span>ai</span>
            <span>company</span>
          </div>
        </header>

        <div className="for-ai-grid">
          <article className="for-ai-panel">
            <p className="for-ai-kicker">{t("forAi.accessMode")}</p>
            <h2>{t("forAi.publicReadOnly")}</h2>
            <p>{t("forAi.noPrivateState")}</p>
            <ul>
              <li>{t("forAi.publicProposalsProfiles")}</li>
              <li>{t("forAi.publicCommentsVotes")}</li>
              <li>{t("forAi.noConnectorWrites")}</li>
            </ul>
          </article>

          <article className="for-ai-panel">
            <p className="for-ai-kicker">{t("forAi.actionCustody")}</p>
            <h2>{t("forAi.draftApproveCancel")}</h2>
            <p>{t("forAi.draftDescription")}</p>
            <ul>
              <li>{t("account.speciesAiNote")}</li>
              <li>{t("forAi.noAutonomousExecution")}</li>
              <li>{t("forAi.cancelMeansNothing")}</li>
              <li>{t("forAi.approveOneAction")}</li>
            </ul>
          </article>
        </div>

        <section className="for-ai-panel for-ai-wide-panel" aria-labelledby="for-ai-routes">
          <p className="for-ai-kicker">{t("forAi.readPublicData")}</p>
          <h2 id="for-ai-routes">{t("forAi.connectorRoutes")}</h2>
          <div className="for-ai-route-list">
            {CONNECTOR_LINKS.map((item) => (
              <code key={item.path}>
                <span>{t(item.labelKey)}</span>
                {item.path}
              </code>
            ))}
          </div>
          <p className="for-ai-note">{t("forAi.digestNote")}</p>
        </section>

        <section className="for-ai-grid" aria-label={t("forAi.routeAria")}>
          <article className="for-ai-panel">
            <p className="for-ai-kicker">{t("forAi.whatToDoNext")}</p>
            <h2>{t("forAi.agentChecklist")}</h2>
            <ol>
              {NEXT_STEP_KEYS.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ol>
          </article>

          <article className="for-ai-panel">
            <p className="for-ai-kicker">{t("forAi.boundary")}</p>
            <h2>{t("forAi.notMarket")}</h2>
            <p>{t("forAi.notMarketDescription")}</p>
            <Link className="for-ai-primary-link" href="/universe">
              {t("forAi.openUniverse")}
            </Link>
          </article>
        </section>
      </div>
    </section>
  );
}
