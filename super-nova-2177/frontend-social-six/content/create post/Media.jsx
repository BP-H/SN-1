"use client";
import { IoClose } from "react-icons/io5";

export default function MediaInput({
  type,
  icon,
  accept,
  mediaType,
  setMediaType,
  mediaValue,
  setMediaValue,
  inputValue,
  setInputValue,
  handleRemoveMedia,
  handleFileChange,
  handleFileInputChange,
  handleSaveInputMedia,
  setSelectedFile,
}) {
  const isActive = mediaType === type;
  const isDisabled = false; // Allow multiple media types to be active simultaneously
  const titleMap = {
    image: "Insert Image",
    video: "Insert Video",
    link: "Insert Link",
    file: "Insert File",
  };
  const acceptAttr = accept || undefined;

  function handleFileChangeFile(e) {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setMediaValue(file);
      setMediaType("file");
    }
  }

  if (isActive && mediaValue) {
    return (
      <div>
        <button
          className="bg-red-600 cursor-pointer rounded-full w-10 h-10 flex items-center justify-center text-white text-xs"
          onClick={handleRemoveMedia}
          title={`Remove ${type.charAt(0).toUpperCase() + type.slice(1)}`}
        >
          <IoClose />
        </button>
      </div>
    );
  }

  if (type === "image" || type === "file") {
    const inputId = type === "image" ? "imageInput" : "fileInput";
    const onChangeHandler =
      type === "image" ? handleFileChange : handleFileChangeFile;

    return (
      <div className="relative group">
        <label
          htmlFor={inputId}
          className={`bg-white shadow-sm cursor-pointer rounded-full w-10 h-10 flex items-center justify-center`}
          title={titleMap[type]}
          onClick={() => {
            if (!mediaType || mediaType === type) setMediaType(type);
          }}
        >
          {icon}
          <span className="absolute bottom-full w-20 mb-1 hidden group-hover:block bg-black text-white text-[0.6em] rounded px-2 py-1">
            {titleMap[type]}
          </span>
        </label>
        <input
          id={inputId}
          type="file"
          accept={acceptAttr}
          className="hidden"
          onChange={(e) => {
            onChangeHandler(e);
            // Removed resetting e.target.value to allow multiple file inputs
          }}
        />
      </div>
    );
  }

  // For video and link inputs
  return (
    <div className="relative group flex items-center gap-1">
      {!isActive ? (
        <button
          className={`bg-white shadow-sm cursor-pointer rounded-full w-10 h-10 flex items-center justify-center`}
          onClick={() => {
            if (!mediaType || mediaType !== type) setMediaType(type);
          }}
          title={titleMap[type]}
        >
          {icon}
          <span className="absolute bottom-full w-20 mb-1 hidden group-hover:block bg-black text-white text-[0.6em] rounded px-2 py-1">
            {titleMap[type]}
          </span>
        </button>
      ) : (
        <>
          <input
            type="text"
            placeholder={`Enter ${type} URL`}
            className="px-2 shadow-sm bg-white rounded-full py-1 text-[0.6em]"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button
            className="bg-[var(--pink)] rounded-full text-white px-2 py-1 text-[0.6em]"
            onClick={() => {
              handleSaveInputMedia();
              setMediaType(type);
            }}
            disabled={inputValue.trim() === ""}
          >
            Save
          </button>
          <button
            className="bg-[var(--blue)] cursor-pointer rounded-full w-7 h-7 flex items-center justify-center text-white text-xs"
            onClick={handleRemoveMedia}
            title={`Remove ${type.charAt(0).toUpperCase() + type.slice(1)}`}
          >
            <IoClose />
          </button>
        </>
      )}
    </div>
  );
}