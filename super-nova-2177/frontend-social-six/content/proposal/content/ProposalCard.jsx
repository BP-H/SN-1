"use client";

import LikesDeslikes from "./LikesDeslikes";
import Comments from "./Comments";
import BookShare from "./BookShare";
import DisplayComments from "./DisplayComments";
import { useState } from "react";
import { FaFileAlt } from "react-icons/fa";
import { useUser } from "@/content/profile/UserContext";
import InsertComment from "./InsertComment";
import { IoMdArrowRoundBack } from "react-icons/io";
import Link from "next/link";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";

function ProposalCard({
  id,
  userName,
  userInitials,
  time,
  title,
  text,
  media = {},
  logo,
  likes,
  dislikes,
  comments = [],
  setErrorMsg,
  setNotify,
  specie,
  className,
}) {
  const [showComments, setShowComments] = useState(false);
  const [localComments, setLocalComments] = useState(comments);
  const [readMore, setReadMore] = useState(false);

  const { userData } = useUser();
  const backendUrl = API_BASE_URL;

  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [imageZoom, setImageZoom] = useState(false);
  const getFullImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return absoluteApiUrl(url);
  };

  const getEmbedUrl = (url) => {
    if (!url) return "";
    try {
      if (url.includes("youtube.com/embed/")) return url;
      const regExp =
        /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      const match = url.match(regExp);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
      return url;
    } catch {
      return url;
    }
  };

  return (
    <div
      className={`bgWhiteTrue mx-auto flex w-full max-w-3xl flex-col gap-5 rounded-[28px] p-5 text-[var(--text-black)] shadow-sm ${
        className ? "" : "hover:shadow-md"
      } ${className || ""}`}
    >
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center justify-start gap-2">
          {logo ? (
            <img
              src={getFullImageUrl(logo)}
              alt="user avatar"
              className="h-9 w-9 rounded-full object-cover shadow-md"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gray)] p-2 shadow-sm">
              <p className="text-[0.78em] font-semibold">{userInitials}</p>
            </div>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.9rem]">
            <p className="truncate font-semibold text-[var(--text-black)]">{userName}</p>
            <p className="text-[var(--text-gray-light)]">•</p>
            <p className="text-[var(--text-gray-light)]">{time}</p>
          </div>
        </div>

        <p
          className={`${
            specie === "human" && "bg-[var(--pink)] shadow-[var(--shadow-pink)]"
          } ${
            specie === "company" &&
            "bg-[var(--blue)] shadow-[var(--shadow-blue)]"
          } ${
            specie === "ai" && "bg-[var(--blue)] shadow-[var(--shadow-pink)]"
          } w-fit rounded-full px-3 py-1 text-[0.78rem] font-semibold text-white capitalize`}
        >
          {specie}
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Link href={`/proposals/${id}`} className="flex flex-col gap-3">
          <h1 className="break-words text-[1.32rem] font-bold leading-tight sm:text-[1.5rem]">
            {title}
          </h1>

          {media.image && (
            <>
              {!imageLoaded && (
                  <div className="flex h-50 w-full items-center justify-center rounded-[18px] bg-[var(--gray)] shadow-sm">
                  <img src="./spinner.svg" alt="loading" />
                </div>
              )}
              <div
                className={`flex w-full flex-col items-center justify-center rounded-[18px] shadow-sm ${
                  !imageZoom
                    ? "bg-[var(--gray)] max-h-150"
                    : "bg-black fixed w-screen h-screen rounded-[0px] p-5 top-0 left-0 z-9999"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setImageZoom(true);
                }}
              >
                {imageZoom && (
                  <IoMdArrowRoundBack
                    className="absolute text-3xl text-white cursor-pointer top-5 left-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setImageZoom(false);
                    }}
                  />
                )}
                <img
                  src={getFullImageUrl(media.image)}
                  alt={title}
                  className={`max-h-150 w-fit rounded-[18px] shadow-sm ${
                    imageLoaded ? "" : "hidden"
                  } ${!imageZoom ? "bg-[var(--gray)] max-h-150" : "bg-black"}`}
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            </>
          )}
          {media.video && (
            <>
              {!videoLoaded && (
                <div className="flex h-50 w-full items-center justify-center rounded-[18px] bg-[var(--gray)] shadow-sm md:h-65 lg:h-80 xl:h-100">
                  <img
                    src={className ? "../spinner.svg" : "./spinner.svg"}
                    alt="loading"
                  />
                </div>
              )}
              <div
                className={`aspect-video w-full rounded-[18px] bg-[var(--gray)] shadow-sm ${
                  videoLoaded ? "" : "hidden"
                }`}
              >
                <iframe
                  src={getEmbedUrl(media.video)}
                  title="Video"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => setVideoLoaded(true)}
                  className="w-full h-full rounded-md"
                ></iframe>
              </div>
            </>
          )}
          {text && (
            <p className="post-text flex w-full flex-col items-start text-[0.95rem] leading-6 text-[var(--transparent-black)]">
              {text.length > 250 && !readMore ? (
                <>
                  {text.slice(0, 250) + "..."}{" "}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setReadMore(true);
                    }}
                    className="text-[var(--neon-blue)]"
                  >
                    Show More
                  </button>
                </>
              ) : (
                <>
                  {text.length > 250 && readMore ? (
                    <>
                      {text}
                      <button
                        className="text-[var(--neon-blue)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setReadMore(false);
                        }}
                      >
                        Show Less
                      </button>
                    </>
                  ) : (
                    text
                  )}
                </>
              )}
            </p>
          )}
        </Link>
        {media.link && (
          <a
            href={media.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
            onClick={(e) => e.stopPropagation()}
          >
            {media.link}
          </a>
        )}

        {media.file && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              window.open(getFullImageUrl(media.file), "_blank");
            }}
            className="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-[var(--blue)] px-3 py-2 text-white shadow-[var(--shadow-blue)]"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.open(getFullImageUrl(media.file), "_blank");
              }
            }}
          >
            <FaFileAlt className="text-[1.35rem]" />
            <p>Download file</p>
          </span>
        )}

        <div className="relative flex w-full items-center justify-between gap-3">
          <div
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <LikesDeslikes
              setErrorMsg={setErrorMsg}
              initialLikes={likes.length}
              initialDislikes={dislikes.length}
              initialClicked={
                likes.some(l => l.voter === userData?.name) 
                  ? "like" 
                  : dislikes.some(l => l.voter === userData?.name) 
                    ? "dislike" 
                    : null
              }
              proposalId={id}
              className={className}
            />
          </div>
          <div
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <Comments
              commentsNum={localComments.length}
              onClick={() => setShowComments(!showComments)}
              className="mx-auto"
            />
          </div>
          <div
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <BookShare proposalId={id} title={title} />
          </div>
        </div>

        {showComments || className ? (
          <div className="flex flex-col gap-2 rounded-[15px] p-2">
            <div
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <InsertComment
                setErrorMsg={setErrorMsg}
                setNotify={setNotify}
                proposalId={id}
                setLocalComments={setLocalComments}
              />
            </div>
            {localComments.map((c, i) => (
              <DisplayComments
                key={i}
                name={c.user}
                image={c.user_img}
                comment={c.comment}
                userSpecie={c.species}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ProposalCard;
