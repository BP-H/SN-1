"use client";
import { useState, useEffect, useContext } from "react";
import LiquidGlass from "../liquid glass/LiquidGlass";
import Link from "next/link";
import { IoMdMenu, IoIosClose } from "react-icons/io";
import Settings from "./content/Settings";
import content from "@/assets/content.json";
import { useUser } from "../profile/UserContext";
import { IoHome } from "react-icons/io5";
import { IoSearch } from "react-icons/io5";

import { SearchInputContext } from "@/app/layout";

function Header({
  activeBE,
  setActiveBE,
  errorMsg,
  setErrorMsg,
  setNotify,
  showSettings,
  setShowSettings,
}) {
  const { userData } = useUser();
  const menuItems = Object.values(content.header.titles);
  const [openProfile, setOpenProfile] = useState(false);
  
  const iconsMap = {
    Proposals: IoHome,
    Search: IoSearch,
  };

  const { focusSearchInput } = useContext(SearchInputContext);

  const ToggleIcon = () =>
    showSettings ? (
      <IoIosClose
        className="text-[var(--pink)] [filter:drop-shadow(0_0_7px_var(--pink))]"
        onClick={(e) => {
          e.stopPropagation();
          setShowSettings(false);
        }}
      />
    ) : (
      <IoMdMenu
        className="text-[var(--pink)] [filter:drop-shadow(0_0_7px_var(--pink))]"
        onClick={(e) => {
          e.stopPropagation();
          setShowSettings(true);
        }}
      />
    );

  return (
    <div className="fixed hidden transform -translate-x-1/2 z-9002 lg:block top-5 left-1/2">
      <LiquidGlass className="flex items-center justify-center px-4 py-3 rounded-[33px]">
        <ul className="flex items-center justify-center gap-5 rounded-full">
          <li onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setOpenProfile(!openProfile); }}>
            {userData.avatar ? (
              <img className="rounded-full shadow-md min-w-13 w-13 h-13 min-h-13" src={userData.avatar} alt="user logo" />
            ) : userData.name ? (
              <button className="min-w-13 shadow-md w-13 h-13 min-h-13 rounded-full bg-[var(--gray)] flex items-center justify-center text-[0.8em] font-bold">
                {(() => {
                  if (!userData.name) return "";
                  const trimmed = userData.name.trim().replace(/\s+/g, " ");
                  const names = trimmed.split(" ");
                  if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
                  return names[0][0].toUpperCase() + names[1][0].toUpperCase();
                })()}
              </button>
            ) : (
              <img className="min-w-13 w-13" src="./supernova.png" alt="logo" />
            )}
          </li>
          {menuItems.map((item, index) => {
            const IconComponent = iconsMap[item];
            if (item === "Search") {
              return (
                <li
                  key={index}
                  className="h-12 p-2 px-5 py-2 transition-transform duration-300 transform rounded-full cursor-pointer bgGray hover:scale-105 flex items-center justify-center font-semibold text-[0.6em] text-[var(--text-black)]"
                  onClick={(e) => { e.stopPropagation(); focusSearchInput(); }}
                >
                  {IconComponent && (
                    <IconComponent className="mr-2 text-[var(--text-black)] text-xl [filter:drop-shadow(0_0_3px_var(--blue))]" />
                  )}
                  {item}
                </li>
              );
            }
            return (
              <li
                key={index}
                className="p-2 px-5 py-2 transition-transform duration-300 transform rounded-full cursor-pointer bgGray hover:scale-105"
              >
                <Link
                  href={`/${item.toLowerCase()}`}
                  className="cursor-pointer flex items-center justify-center font-semibold text-[0.6em] text-[var(--text-black)]"
                >
                  {IconComponent && (
                    <IconComponent className="mr-2 text-[var(--text-black)] text-xl [filter:drop-shadow(0_0_3px_var(--blue))]" />
                  )}
                  {index === 0 ? "Home" : item  }
                </Link>
              </li>
            );
          })}
          <div className="p-2 rounded-full cursor-pointer bgGray hover:scale-105">
            <ToggleIcon />
          </div>
        </ul>
      </LiquidGlass>

      {showSettings && (
        <div className="absolute right-0 flex justify-end mt-2 z-99290 w-fit">
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
  );
}

export default Header;
