"use client";
import { useState } from "react";
import imageCompression from "browser-image-compression";
import LiquidGlass from "../liquid glass/LiquidGlass";
import { FaImage, FaVideo } from "react-icons/fa6";
import { FaLink, FaFileAlt } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { useUser } from "../profile/UserContext";
import Error from "../Error";
import MediaInput from "./Media";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/utils/apiBase";

function InputFields({ setDiscard, setPosts, refetchPosts, activeBE }) {
  const { userData } = useUser();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [errorMsg, setErrorMsg] = useState([]);
  const [mediaType, setMediaType] = useState("");
  const [mediaValue, setMediaValue] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleRemoveMedia = () => {
    setMediaType("");
    setMediaValue("");
    setInputValue("");
    setSelectedFile(null);
  };

  const handleFileChange = async (e, type) => {
    const fileObj = e.target.files && e.target.files[0];
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
    } else {
      // For other types or mismatched file type, do not set media
      return;
    }
    // Clear input value to allow re-upload of same file if needed
    e.target.value = null;
  };

  const handleFileChangeFile = (e) => {
    const fileObj = e.target.files && e.target.files[0];
    if (!fileObj) return;
    setSelectedFile(fileObj);
    setMediaType("file");
    setMediaValue(fileObj.name);
    e.target.value = null;
  };

  const handleFileInputChange = (e) => setInputValue(e.target.value);
  const handleSaveInputMedia = (type) => {
    if (!inputValue.trim()) return;
    setMediaValue(inputValue.trim());
    setMediaType(type);
    setInputValue("");
  };

  const getApiError = async (response, fallback) => {
    try {
      const payload = await response.json();
      return payload?.detail || payload?.message || fallback;
    } catch {
      try {
        const text = await response.text();
        return text || fallback;
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
      formData.append("userInitials", (newPost.userName || "").slice(0,2).toUpperCase());
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
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      if (refetchPosts) {
        refetchPosts();
      }
      setDiscard(true);
      handleRemoveMedia();
      setTitle("");
      setText("");
    },
    onError: (error) => setErrorMsg([error.message]),
  });

  return (
    <div className="fixed bottom-0 left-0 z-[9100] w-full lg:relative lg:z-auto lg:mt-0">
      {errorMsg.length > 0 && <Error messages={errorMsg} />}
      <LiquidGlass className="bgGrayDark h-auto w-screen rounded-t-[28px] px-4 pb-5 pt-24 lg:w-full lg:max-w-3xl lg:rounded-[30px] lg:p-5">
        <div className="m-auto flex h-[calc(100vh-4rem)] w-full max-w-3xl flex-col gap-4 overflow-y-auto px-1 pb-8 text-[var(--text-black)] lg:h-auto lg:max-w-none lg:overflow-visible lg:px-0 lg:pb-0">
          <h1 className="text-[1.1rem] font-bold">Create a post</h1>
          <input
            type="text"
            placeholder="Give your post a clear title"
            value={title}
            maxLength={50}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-full bg-white px-4 py-3 text-[0.95rem] shadow-md outline-none"
          />
          <textarea
            placeholder="Share your idea, update, or question"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-52 w-full rounded-[24px] bg-white px-4 py-3 text-[0.95rem] shadow-md outline-none"
          />
          <div className="flex flex-wrap items-center gap-3 text-[0.78rem]">
            <MediaInput
              type="image"
              icon={<FaImage className="text-2xl" />}
              mediaType={mediaType}
              setMediaType={setMediaType}
              mediaValue={mediaValue}
              setMediaValue={setMediaValue}
              inputValue={inputValue}
              setInputValue={setInputValue}
              handleRemoveMedia={handleRemoveMedia}
              handleFileChange={(e) => handleFileChange(e, "image")}
              handleFileInputChange={handleFileInputChange}
              handleSaveInputMedia={() => handleSaveInputMedia("image")}
            />
            <MediaInput
              type="video"
              icon={<FaVideo className="text-2xl" />}
              mediaType={mediaType}
              setMediaType={setMediaType}
              mediaValue={mediaValue}
              setMediaValue={setMediaValue}
              inputValue={inputValue}
              setInputValue={setInputValue}
              handleRemoveMedia={handleRemoveMedia}
              handleFileChange={(e) => handleFileChange(e, "video")}
              handleFileInputChange={handleFileInputChange}
              handleSaveInputMedia={() => handleSaveInputMedia("video")}
            />
            <MediaInput
              type="link"
              icon={<FaLink className="text-2xl" />}
              mediaType={mediaType}
              setMediaType={setMediaType}
              mediaValue={mediaValue}
              setMediaValue={setMediaValue}
              inputValue={inputValue}
              setInputValue={setInputValue}
              handleRemoveMedia={handleRemoveMedia}
              handleFileChange={() => {}}
              handleFileInputChange={handleFileInputChange}
              handleSaveInputMedia={() => handleSaveInputMedia("link")}
            />
            <MediaInput
              type="file"
              icon={<FaFileAlt className="text-2xl" />}
              mediaType={mediaType}
              setMediaType={setMediaType}
              mediaValue={mediaValue}
              setMediaValue={setMediaValue}
              inputValue={inputValue}
              setInputValue={setInputValue}
              handleRemoveMedia={handleRemoveMedia}
              handleFileChange={handleFileChangeFile}
              handleFileInputChange={handleFileInputChange}
              handleSaveInputMedia={() => handleSaveInputMedia("file")}
              setSelectedFile={setSelectedFile}
            />
          </div>
          <div className="flex gap-3 pt-1 text-[0.82rem] text-white">
            <button
              className="w-32 rounded-full bg-[var(--pink)] px-4 py-2.5 shadow-[var(--shadow-pink)] hover:scale-95"
              onClick={async () => {
                const errors = [];
                if (!title.trim()) errors.push("No post Title found.");
                if (!text.trim() && !mediaValue && !selectedFile) errors.push("No post Media found.");
                if (!userData?.name) errors.push("Enter username in profile settings before publishing.");
                if (!userData?.species) errors.push("Enter your species in profile settings before publishing.");
                if (errors.length > 0) {
                  setErrorMsg(errors);
                  return;
                }
                setErrorMsg([]);

                const newPost = {
                  title,
                  text,
                  userName: userData.name,
                  author_type: userData.species,
                  author_img: userData.avatar || "",
                  date: new Date().toISOString(),
                  image: mediaType === "image" ? selectedFile : null,
                  file: mediaType === "file" ? selectedFile : null,
                  video: mediaType === "video" ? (selectedFile || mediaValue) : "",
                  link: mediaType === "link" ? mediaValue : "",
                };

                mutation.mutate(newPost);
              }}
            >
              Publish
            </button>
            <button
              onClick={() => setDiscard(true)}
              className="w-32 rounded-full bg-[var(--blue)] px-4 py-2.5 shadow-[var(--shadow-blue)] hover:scale-95"
            >
              Discard
            </button>
          </div>
        </div>
      </LiquidGlass>
    </div>
  );
}

export default InputFields;
