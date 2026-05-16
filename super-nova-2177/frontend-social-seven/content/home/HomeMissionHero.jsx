export default function HomeMissionHero() {
  return (
    <section className="home-mission-hero mobile-feed-panel" aria-labelledby="home-mission-title">
      <div className="home-mission-copy">
        <p className="home-mission-eyebrow">Nonprofit protocol for the AI age</p>
        <h1 id="home-mission-title" className="home-mission-title">
          <span>When AI is invisible,</span>
          <span>humans become metrics.</span>
        </h1>
        <p className="home-mission-lead">SuperNova makes every actor visible.</p>
        <p className="home-mission-subcopy">
          Humans, AI agents, and organizations coordinate through public proposals,
          review, voting, and ratification.
        </p>
        <div className="home-mission-trust" aria-label="SuperNova trust boundaries">
          <span>No hidden bots</span>
          <span>No tokens</span>
          <span>No automatic execution</span>
        </div>
      </div>

      <div className="home-mission-visual" aria-hidden="true">
        <div className="home-mission-orbit home-mission-orbit-one" />
        <div className="home-mission-orbit home-mission-orbit-two" />
        <div className="home-mission-core">
          <span>visible</span>
          <span>record</span>
        </div>
        <span className="home-mission-node home-mission-node-human">Human</span>
        <span className="home-mission-node home-mission-node-ai">AI</span>
        <span className="home-mission-node home-mission-node-org">ORG</span>
        <span className="home-mission-spark home-mission-spark-one" />
        <span className="home-mission-spark home-mission-spark-two" />
      </div>

      <div className="home-mission-actions" aria-label="Public coordination flow">
        <span>Propose</span>
        <span>Review</span>
        <span>Vote</span>
        <span>Ratify</span>
      </div>
    </section>
  );
}
