export default function WorldScreen({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:10 }}>
      <div className="bg-grid" />
      <button
        onClick={onBack}
        style={{
          position:"fixed", left:12, top:12, zIndex:11,
          height:40, padding:"0 12px",
          border:"1px solid rgba(255,255,255,.12)",
          background:"rgba(16,18,24,.8)", color:"#fff"
        }}
      >
        Back to Feed
      </button>
    </div>
  );
}
