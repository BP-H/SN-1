function SwitchBtn({activeBE, setActiveBE}) {
    return (
        <button
            type="button"
            onClick={() => setActiveBE(false)}
            aria-label="Live backend enabled"
            title="Live backend enabled"
            className="cursor-not-allowed bg-[var(--blue)] flex justify-end shadow-sm rounded-full p-[2px] w-14 opacity-90"
        >
            <div className="rounded-full shadow-sm bg-white h-7 w-7"></div>
        </button>
    )
}

export default SwitchBtn
