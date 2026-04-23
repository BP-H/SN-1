"use client";

import { useContext, useState } from "react";
import Link from "next/link";
import { IoHome, IoSearch } from "react-icons/io5";
import { IoIosClose, IoMdMenu } from "react-icons/io";
import LiquidGlass from "../liquid glass/LiquidGlass";
import Settings from "./content/Settings";
import content from "@/assets/content.json";
import { useUser } from "../profile/UserContext";
import { SearchInputContext } from "@/app/layout";

function getInitials(name) {
  if (!name) return "";
  const trimmed = name.trim().replace(/\s+/g, " ");
  const names = trimmed.split(" ");
  if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
  return names[0][0].toUpperCase() + names[1][0].toUpperCase();
}

export default function Header({
  activeBE,
  setActiveBE,
  errorMsg,
  setErrorMsg,
  setNotify,
  showSettings,
  setShowSettings,
}) {
  const { userData, isAuthenticated } = useUser();
  const { focusSearchInput } = useContext(SearchInputContext);
  const menuItems = Object.values(content.header.titles);
  const [openProfile, setOpenProfile] = useState(false);

  const iconsMap = {
    Proposals: IoHome,
    Search: IoSearch,
  };

  return (
    <div className="fixed top-5 left-1/2 z-[9002] hidden -translate-x-1/2 lg:block">
      <div className="relative">
        <LiquidGlass className="rounded-[36px] px-4 py-3">
          <ul className="flex items-center justify-center gap-4 rounded-full">
            <li
              onClick={(event) => {
                event.stopPropagation();
                setShowSettings((value) => !value);
                setOpenProfile((value) => !value);
              }}
              className="cursor-pointer"
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

            {menuItems.map((item, index) => {
              const IconComponent = iconsMap[item];
              if (item === "Search") {
                return (
                  <li
                    key={index}
                className="flex h-12 cursor-pointer items-center justify-center rounded-full bgGray px-5 py-2 text-[0.75rem] font-semibold text-[var(--text-black)] transition-transform duration-300 hover:scale-105"
                    onClick={(event) => {
                      event.stopPropagation();
                      focusSearchInput();
                    }}
                  >
                    {IconComponent && (
                      <IconComponent className="mr-2 text-xl text-[var(--text-black)] [filter:drop-shadow(0_0_3px_var(--blue))]" />
                    )}
                    {item}
                  </li>
                );
              }

              return (
                <li
                  key={index}
                  className="cursor-pointer rounded-full bgGray px-5 py-2 transition-transform duration-300 hover:scale-105"
                >
                  <Link
                    href={item === "Proposals" ? "/" : `/${item.toLowerCase()}`}
                  className="flex items-center justify-center text-[0.75rem] font-semibold text-[var(--text-black)]"
                  >
                    {IconComponent && (
                      <IconComponent className="mr-2 text-xl text-[var(--text-black)] [filter:drop-shadow(0_0_3px_var(--blue))]" />
                    )}
                    {index === 0 ? "Home" : item}
                  </Link>
                </li>
              );
            })}

            <li className="rounded-full bgGray p-2 transition-transform duration-300 hover:scale-105">
              {showSettings ? (
                <IoIosClose
                  className="cursor-pointer text-[var(--pink)] [filter:drop-shadow(0_0_7px_var(--pink))]"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowSettings(false);
                  }}
                />
              ) : (
                <IoMdMenu
                  className="cursor-pointer text-[var(--pink)] [filter:drop-shadow(0_0_7px_var(--pink))]"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowSettings(true);
                  }}
                />
              )}
            </li>
          </ul>
        </LiquidGlass>

        {showSettings && (
          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[99290] flex justify-end">
            <Settings
              setNotify={setNotify}
              errorMsg={errorMsg}
              setErrorMsg={setErrorMsg}
              activeBE={activeBE}
              setActiveBE={setActiveBE}
              openProfile={openProfile}
            />
          </div>
        )}
      </div>
    </div>
  );
}
