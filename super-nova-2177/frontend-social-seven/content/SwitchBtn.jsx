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
      className={`flex w-14 justify-start rounded-full p-[2px] shadow-sm opacity-90 transition-colors duration-200 ${
        activeBE ? "bg-[var(--blue)]" : "bg-[var(--pink)]"
      }`}
    >
      <div
        className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
          activeBE ? "translate-x-[calc(1.75rem-4px)]" : "translate-x-0"
        }`}
      ></div>
    </button>
  );
}

export default SwitchBtn;
