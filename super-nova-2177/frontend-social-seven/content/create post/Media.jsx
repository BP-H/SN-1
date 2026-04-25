"use client";

export default function MediaInput({
  type,
  icon,
  accept,
  handleFileChange,
  multiple = false,
  inputRef,
  className = "",
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
        className={`composer-icon-button flex h-9 w-9 cursor-pointer items-center justify-center rounded-full shadow-sm transition-colors ${className}`}
        title={titleMap[type]}
      >
        {icon}
        <span className="absolute bottom-full mb-1 hidden w-max rounded bg-black px-2 py-1 text-[0.6em] text-white group-hover:block">
          {titleMap[type]}
        </span>
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
