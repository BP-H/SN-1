"use client";

import { useContext, useState } from "react";
import Link from "next/link";
import { IoHome, IoSearch, IoMenu } from "react-icons/io5";
import { IoIosClose } from "react-icons/io";
import LiquidGlass from "../liquid glass/LiquidGlass";
import Settings from "./content/Settings";
import { useUser } from "../profile/UserContext";
import { SearchInputContext } from "@/app/layout";

function getInitials(name) {
  if (!name) return "";
  const trimmed = name.trim().replace(/\s+/g, " ");
  const names = trimmed.split(" ");
  if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
  return names[0][0].toUpperCase() + names[1][0].toUpperCase();
}

export default function HeaderMobile({
  activeBE,
  setActiveBE,
  errorMsg,
  setErrorMsg,
  setNotify,
  showSettings,
  setShowSettings,
  focusSearchInput,
}) {
  const [openProfile, setOpenProfile] = useState(false);
  const { userData, isAuthenticated } = useUser();
  const { focusSearchInput: contextFocusSearchInput } = useContext(SearchInputContext);

  return (
    <div className="fixed bottom-3 left-1/2 z-[9000] w-[calc(100vw-1rem)] max-w-[26rem] -translate-x-1/2 lg:hidden">
      <div className="relative">
        <LiquidGlass className="rounded-[33px] border border-white px-4 py-3">
          <ul className="flex items-center justify-between gap-2.5">
            <li
              className="cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
                setShowSettings((value) => !value);
                setOpenProfile((value) => !value);
              }}
            >
              {userData.avatar ? (
                <img
                  className={`h-12 w-12 min-w-12 rounded-full object-cover shadow-md ${isAuthenticated ? "ring-2 ring-[var(--pink)]" : ""}`}
                  src={userData.avatar}
                  alt="user logo"
                />
              ) : userData.name ? (
                <button
                  className={`flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-[var(--gray)] text-[0.8em] font-bold shadow-md ${isAuthenticated ? "ring-2 ring-[var(--pink)]" : ""}`}
                >
                  {getInitials(userData.name)}
                </button>
              ) : (
                <img className="w-12 min-w-12" src="./supernova.png" alt="logo" />
              )}
            </li>

            <li className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bgGray transition-transform duration-300 hover:scale-105">
              <Link href="/" className="flex h-full w-full items-center justify-center">
                <IoHome className="text-2xl text-[var(--text-black)] [filter:drop-shadow(0_0_3px_var(--blue))]" />
              </Link>
            </li>

            <li
              className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-[18px] bgGray transition-transform duration-300 hover:scale-105"
              onClick={(event) => {
                event.stopPropagation();
                (focusSearchInput || contextFocusSearchInput)();
              }}
            >
              <IoSearch className="text-2xl text-[var(--text-black)] [filter:drop-shadow(0_0_3px_var(--blue))]" />
            </li>

            <li className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bgGray transition-transform duration-300 hover:scale-105">
              {showSettings ? (
                <IoIosClose
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowSettings(false);
                  }}
                  className="cursor-pointer text-4xl text-[var(--pink)] [filter:drop-shadow(0_0_7px_var(--pink))]"
                />
              ) : (
                <IoMenu
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowSettings(true);
                  }}
                  className="cursor-pointer text-2xl text-[var(--pink)] [filter:drop-shadow(0_0_7px_var(--pink))]"
                />
              )}
            </li>
          </ul>
        </LiquidGlass>

        {showSettings && (
          <div className="absolute bottom-[calc(100%+0.75rem)] left-1/2 z-[120] flex w-full -translate-x-1/2 justify-center">
            <Settings
              setNotify={setNotify}
              errorMsg={errorMsg}
              setErrorMsg={setErrorMsg}
              setActiveBE={setActiveBE}
              activeBE={activeBE}
              openProfile={openProfile}
            />
          </div>
        )}
      </div>
    </div>
  );
}
