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
      className={`p-4 text-[var(--text-black)] ${
        className ? "" : "rounded-[25px]"
      } bg-white shadow-md w-100 md:w-130 lg:w-150 xl:w-200 flex flex-col items-center gap-4 ${className}`}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center justify-start w-full gap-2">
          {logo ? (
            <img
              src={getFullImageUrl(logo)}
              alt="user avatar"
              className="w-8 h-8 rounded-full shadow-md"
            />
          ) : (
            <div className="rounded-full bg-[var(--gray)] shadow-sm p-2 w-8 h-8 flex items-center justify-center">
              <p className="text-[0.8em]">{userInitials}</p>
            </div>
          )}
          <p>{userName}</p>
          <p>-</p>
          <p>{time}</p>
        </div>

        <p
          className={`${
            specie === "human" && "bg-[var(--pink)] shadow-[var(--shadow-pink)]"
          } ${
            specie === "company" &&
            "bg-[var(--blue)] shadow-[var(--shadow-blue)]"
          } ${
            specie === "ai" && "bg-[var(--blue)] shadow-[var(--shadow-pink)]"
          } text-white rounded-full capitalize px-2`}
        >
          {specie}
        </p>
      </div>

      <div className="flex flex-col w-full gap-3">
        <Link href={`/proposals/${id}`} className="flex flex-col gap-3">
          <h1 className="text-[1.5em] my-[-10px] break-words">{title}</h1>

          {media.image && (
            <>
              {!imageLoaded && (
                <div className="bg-[var(--gray)] rounded-md shadow-sm flex items-center justify-center h-50 w-full">
                  <img src="./spinner.svg" alt="loading" />
                </div>
              )}
              <div
                className={`rounded-md shadow-sm w-full items-center justify-center flex flex-col ${
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
                  className={`rounded-md shadow-sm max-h-150 w-fit ${
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
                <div className="bg-[var(--gray)] rounded-md shadow-sm flex items-center justify-center h-50 md:h-65 lg:h-80 xl:h-100 w-full">
                  <img
                    src={className ? "../spinner.svg" : "./spinner.svg"}
                    alt="loading"
                  />
                </div>
              )}
              <div
                className={`rounded-md shadow-sm w-full bg-[var(--gray)] ${
                  videoLoaded ? "" : "hidden"
                } aspect-video`}
              >
                <iframe
                  src={getEmbedUrl(media.video)}
                  title="Video"
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
            <p className="flex flex-col items-start post-text text-[0.9em] w-full">
              {text.length > 250 && !readMore ? (
                <>
                  {text.slice(0, 250) + "..."}{" "}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setReadMore(true);
                    }}
                    className="text-blue-400"
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
                        className="text-blue-400"
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
            className="cursor-pointer flex items-center bg-[var(--blue)] text-white shadow-[var(--shadow-blue)] w-fit px-2 py-2 rounded-full"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.open(getFullImageUrl(media.file), "_blank");
              }
            }}
          >
            <FaFileAlt className="text-[2em]" />
            <p>Download file</p>
          </span>
        )}

        <div className="relative flex justify-between w-full">
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
