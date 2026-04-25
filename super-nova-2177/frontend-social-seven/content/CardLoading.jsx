function CardLoading() {
    return (
        <div className="mobile-post-card social-panel-compact bgWhiteTrue flex w-full max-w-none flex-col items-center gap-8 rounded-[1.75rem] p-5 text-[var(--text-black)] shadow-md">
            <div className="flex gap-2 w-full items-center">
                <div className="load w-10 h-10"></div>
                <div className="load h-5 w-40"></div>
            </div>
            <div className="w-full flex flex-col gap-5">
                <div className="load h-10 w-40"></div>
                <div className="load w-full h-40"></div>
            </div>
            <div className="w-full flex justify-between gap-5">
                <div className="load w-28 h-9"></div>
                <div className="load w-12 h-9"></div>
                <div className="load w-20 h-9"></div>
              
            </div>
               
        </div>
    )
}

export default CardLoading
