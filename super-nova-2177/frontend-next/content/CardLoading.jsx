function CardLoading() {
    return (
        <div className="p-4 text-[var(--text-black)] rounded-[25px] bg-white shadow-md w-100 md:w-130 lg:w-150 xl:w-200 flex flex-col items-center gap-8">
            <div className="flex gap-2 w-full items-center">
                <div className="load w-10 h-10"></div>
                <div className="load w-50 h-5"></div>
            </div>
            <div className="w-full flex flex-col gap-5">
                <div className="load w-50 h-10"></div>
                <div className="load w-full h-40"></div>
            </div>
            <div className="w-full flex justify-between gap-5">
                <div className="load w-35 h-9"></div>
                <div className="load w-12 h-9"></div>
                <div className="load w-20 h-9"></div>
              
            </div>
               
        </div>
    )
}

export default CardLoading
