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
    <div className="fixed z-100 bottom-0 md:top-0 left-0 lg:relative lg:mt-[-70px]">
      {errorMsg.length > 0 && <Error messages={errorMsg} />}
      <LiquidGlass className="lg:p-5 h-auto bgGrayDark w-screen lg:w-150 xl:w-200 lg:rounded-[30px]">
        <div className="w-screen pt-30 lg:pt-0 p-5 lg:p-0 m-auto h-screen lg:h-auto lg:w-140 xl:w-190 flex text-[var(--text-black)] flex-col gap-4">
          <h1>Title</h1>
          <input
            type="text"
            placeholder="Insert Title"
            value={title}
            maxLength={50}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-white rounded-full shadow-md px-4 py-1 w-full text-[0.6em]"
          />
          <textarea
            placeholder="Insert Text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="bg-white rounded-[20px] h-50 shadow-md px-4 py-1 w-full text-[0.5em]"
          />
          <div className="flex gap-3 text-[0.6em] items-center">
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
          <div className="text-[0.6em] flex gap-3 text-white">
            <button
              className="hover:scale-95 cursor-pointer shadow-[var(--shadow-pink)] bg-[var(--pink)] rounded-full px-3 w-30"
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
              className="hover:scale-95 cursor-pointer shadow-[var(--shadow-blue)] bg-[var(--blue)] rounded-full px-3 w-30"
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
