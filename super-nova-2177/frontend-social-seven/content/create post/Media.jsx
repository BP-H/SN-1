"use client";

export default function MediaInput({
  type,
  icon,
  accept,
  handleFileChange,
}) {
  const titleMap = {
    image: "Upload Image",
    video: "Upload Video",
    file: "Upload File",
  };

  const inputId = `${type}Input`;

  return (
    <div className="relative group">
      <label
        htmlFor={inputId}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-[var(--text-black)] shadow-sm hover:bg-[rgba(255,255,255,0.12)] transition-colors"
        title={titleMap[type]}
      >
        {icon}
        <span className="absolute bottom-full mb-1 hidden w-max rounded bg-black px-2 py-1 text-[0.6em] text-white group-hover:block">
          {titleMap[type]}
        </span>
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
