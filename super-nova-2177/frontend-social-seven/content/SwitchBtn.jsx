function SwitchBtn({ activeBE, setActiveBE }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setActiveBE(!activeBE);
      }}
      aria-label={activeBE ? "Live backend enabled" : "Local backend enabled"}
      title={activeBE ? "Live backend enabled" : "Local backend enabled"}
      className={`flex w-14 rounded-full p-[2px] shadow-sm opacity-90 ${
        activeBE ? "justify-end bg-[var(--blue)]" : "justify-start bg-[var(--pink)]"
      }`}
    >
      <div className="h-7 w-7 rounded-full bg-white shadow-sm"></div>
    </button>
  );
}

export default SwitchBtn;
