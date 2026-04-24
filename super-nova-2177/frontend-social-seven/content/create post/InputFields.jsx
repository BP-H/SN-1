"use client";

import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { FaFileAlt } from "react-icons/fa";
import { FaImage, FaVideo } from "react-icons/fa6";
import { IoClose } from "react-icons/io5";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import LiquidGlass from "../liquid glass/LiquidGlass";
import { useUser } from "../profile/UserContext";
import ErrorMessage from "../Error";
import MediaInput from "./Media";
import { API_BASE_URL } from "@/utils/apiBase";

function InputFields({ setDiscard, setPosts, refetchPosts, embedded = false, autoFocus = false }) {
  const { userData } = useUser();
  const queryClient = useQueryClient();

  const [text, setText] = useState("");
  const [errorMsg, setErrorMsg] = useState([]);
  const [mediaType, setMediaType] = useState("");
  const [mediaValue, setMediaValue] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const textAreaRef = useRef(null);

  useEffect(() => {
    if (autoFocus && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [autoFocus]);

  /* Auto-detect URLs in text and set as link media */
  useEffect(() => {
    if (mediaType && mediaType !== "link") return; // don't override image/video/file
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = text.match(urlRegex);
    if (urls && urls.length > 0) {
      const firstUrl = urls[0];
      if (!mediaValue || mediaType === "link") {
        setMediaType("link");
        setMediaValue(firstUrl);
      }
    } else if (mediaType === "link") {
      // Clear auto-detected link if URL was removed from text
      setMediaType("");
      setMediaValue("");
    }
  }, [text, mediaType, mediaValue]);

  const handleRemoveMedia = () => {
    setMediaType("");
    setMediaValue("");
    setSelectedFile(null);
  };

  const handleFileChange = async (event, type) => {
    const fileObj = event.target.files?.[0];
    if (!fileObj) return;

    if (type === "image" && fileObj.type.startsWith("image/")) {
      try {
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true };
        const compressedFile = await imageCompression(fileObj, options);
        setSelectedFile(compressedFile);
        setMediaType("image");
        setMediaValue(compressedFile.name);
      } catch {
        setSelectedFile(fileObj);
        setMediaType("image");
        setMediaValue(fileObj.name);
      }
    } else if (type === "video" && fileObj.type.startsWith("video/")) {
      setSelectedFile(fileObj);
      setMediaType("video");
      setMediaValue(fileObj.name);
    } else if (type === "file") {
      setSelectedFile(fileObj);
      setMediaType("file");
      setMediaValue(fileObj.name);
    }

    event.target.value = null;
  };

  const getApiError = async (response, fallback) => {
    try {
      const payload = await response.json();
      return payload?.detail || payload?.message || fallback;
    } catch {
      try {
        const textResponse = await response.text();
        return textResponse || fallback;
      } catch {
        return fallback;
      }
    }
  };

  const mutation = useMutation({
    mutationFn: async (newPost) => {
      const formData = new FormData();
      formData.append("title", newPost.title);
      formData.append("body", newPost.text);
      formData.append("author", newPost.userName);
      formData.append("userName", newPost.userName);
      formData.append("userInitials", (newPost.userName || "").slice(0, 2).toUpperCase());
      formData.append("author_type", newPost.author_type);
      formData.append("author_img", newPost.author_img);
      formData.append("date", newPost.date);

      if (newPost.image) formData.append("image", newPost.image);
      if (newPost.file) formData.append("file", newPost.file);
      if (newPost.video) formData.append("video", newPost.video);
      if (newPost.link) formData.append("link", newPost.link);

      const response = await fetch(`${API_BASE_URL}/proposals`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await getApiError(
          response,
          `Failed to create post: ${response.status} ${response.statusText}`
        );
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (setPosts) {
        setPosts((oldPosts) => [data, ...oldPosts]);
      }
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      refetchPosts?.();
      setDiscard(true);
      handleRemoveMedia();
      setText("");
    },
    onError: (error) => setErrorMsg([error.message]),
  });

  const publish = () => {
    const errors = [];
    if (!text.trim() && !mediaValue && !selectedFile) {
      errors.push("Add text or media before publishing.");
    }
    if (!userData?.name) errors.push("Add your display name in profile settings first.");
    if (!userData?.species) errors.push("Pick a species in profile settings first.");

    if (errors.length > 0) {
      setErrorMsg(errors);
      return;
    }

    setErrorMsg([]);
    const derivedTitle = text.trim()
      ? text.trim().replace(/\s+/g, " ").slice(0, 70)
      : mediaType === "video"
      ? "Shared a video"
      : mediaType === "image"
      ? "Shared an image"
      : mediaType === "file"
      ? "Shared a file"
      : mediaType === "link"
      ? "Shared a link"
      : "New Post";

    mutation.mutate({
      title: derivedTitle,
      text,
      userName: userData.name,
      author_type: userData.species,
      author_img: userData.avatar || "",
      date: new Date().toISOString(),
      image: mediaType === "image" ? selectedFile : null,
      file: mediaType === "file" ? selectedFile : null,
      video: mediaType === "video" ? selectedFile : "",
      link: mediaType === "link" ? mediaValue : "",
    });
  };

  const isYouTube = (url) => {
    return url?.includes("youtube.com") || url?.includes("youtu.be");
  };

  const getYouTubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url?.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const renderMediaPreview = () => {
    if (!mediaType) return null;

    return (
      <div className="relative mt-2 overflow-hidden rounded-[1rem] border border-[var(--horizontal-line)] bg-[rgba(255,255,255,0.02)] p-1">
        <button
          type="button"
          onClick={handleRemoveMedia}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
          title="Remove attachment"
        >
          <IoClose />
        </button>

        {mediaType === "image" && selectedFile && (
          <img
            src={URL.createObjectURL(selectedFile)}
            alt="Preview"
            className="max-h-64 w-full rounded-[0.8rem] object-contain"
          />
        )}

        {mediaType === "video" && selectedFile && (
          <video
            src={URL.createObjectURL(selectedFile)}
            controls
            className="max-h-64 w-full rounded-[0.8rem] object-contain"
          />
        )}

        {mediaType === "link" && isYouTube(mediaValue) && (
          <div className="aspect-video w-full rounded-[0.8rem] overflow-hidden">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${getYouTubeId(mediaValue)}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {mediaType === "link" && !isYouTube(mediaValue) && (
          <div className="flex items-center gap-3 rounded-[0.8rem] bg-[rgba(255,255,255,0.05)] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-white shadow-lg">
              <FaFileAlt className="text-[1.2rem]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.85rem] font-medium text-[var(--text-black)]">
                Link Attached
              </p>
              <a
                href={mediaValue}
                target="_blank"
                rel="noreferrer"
                className="truncate text-[0.75rem] text-[var(--blue)] hover:underline"
              >
                {mediaValue}
              </a>
            </div>
          </div>
        )}

        {mediaType === "file" && (
          <div className="flex items-center gap-3 rounded-[0.8rem] bg-[rgba(255,255,255,0.05)] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--pink)] text-white shadow-lg">
              <FaFileAlt className="text-[1.2rem]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.85rem] font-medium text-[var(--text-black)]">
                {mediaValue}
              </p>
              <p className="text-[0.7rem] text-[var(--text-gray-light)]">Document attached</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => (
    <div className="flex flex-col gap-3 text-[var(--text-black)]">
      <textarea
        ref={textAreaRef}
        placeholder="Share your idea, update, or question"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-[7.4rem] w-full rounded-[1.1rem] border border-[var(--horizontal-line)] bg-[rgba(255,255,255,0.06)] px-4 py-3 text-[0.92rem] outline-none placeholder:text-[var(--text-gray-light)]"
      />

      {renderMediaPreview()}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.78rem]">
        <div className="flex items-center gap-2">
          {!mediaType && (
            <>
              <MediaInput
                type="image"
                icon={<FaImage className="text-[1rem]" />}
                accept="image/*"
                handleFileChange={(event) => handleFileChange(event, "image")}
              />
              <MediaInput
                type="video"
                icon={<FaVideo className="text-[1rem]" />}
                accept="video/*"
                handleFileChange={(event) => handleFileChange(event, "video")}
              />
              <MediaInput
                type="file"
                icon={<FaFileAlt className="text-[0.95rem]" />}
                handleFileChange={(event) => handleFileChange(event, "file")}
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1 text-[0.82rem] text-white">
          <button
            type="button"
            onClick={() => setDiscard(true)}
            className="rounded-full bg-[rgba(255,255,255,0.08)] px-4 py-2.5 font-semibold text-[var(--text-black)] hover:bg-[rgba(255,255,255,0.12)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={mutation.isPending}
            className="rounded-full bg-[var(--pink)] px-4 py-2.5 font-semibold text-white shadow-[var(--shadow-pink)] hover:scale-105 transition-transform disabled:opacity-60 disabled:hover:scale-100"
          >
            {mutation.isPending ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {errorMsg.length > 0 && <ErrorMessage messages={errorMsg} />}
      {embedded ? (
        renderContent()
      ) : (
        <LiquidGlass className="rounded-[1.45rem] px-3 py-3 sm:px-4 sm:py-4">
          {renderContent()}
        </LiquidGlass>
      )}
    </div>
  );
}

export default InputFields;
