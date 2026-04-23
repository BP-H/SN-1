import content from "@/assets/content.json";
import { FaUser, FaBriefcase } from "react-icons/fa";
import { BsFillCpuFill } from "react-icons/bs";
import { useState } from "react";
import { IoClose } from "react-icons/io5";
import { FaPlus } from "react-icons/fa6";
import { useUser } from "./UserContext";
import Notification from "../Notification";
import Error from "../Error";
import { API_BASE_URL, absoluteApiUrl } from "@/utils/apiBase";

const typeIcons = {
  human: <FaUser />,
  company: <FaBriefcase />,
  ai: <BsFillCpuFill />,
};

function Profile({errorMsg, setErrorMsg, setNotify}) {
  const { userData, setUserData } = useUser();
  const settings = content.header.profile;
  const [open, setOpen] = useState(userData.species || "");
  const [getAvatar, setGetAvatar] = useState(userData.avatar || "");
  const [getName, setGetName] = useState(userData.name || "");

  function handleUser() {
    const errors = [];
    const notify = [];
    if (!getName) errors.push("Invalid user name.");
    if (!open) errors.push("No species selected.");
    if (open && getName) notify.push("User created successfully!");
    setErrorMsg([]);
    setUserData({
      species: open,
      avatar: getAvatar,
      name: getName,
    });
    if (errors.length > 0) {
      setErrorMsg(errors);
      return;
    }
    if (notify.length > 0) {
      setNotify(notify);
      return;
    }
  }

  function handleReset() {
    setGetAvatar("");
    setGetName("");
    setOpen("");
  }

  async function handleAvatarSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/upload-image`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload avatar");
    const data = await res.json();
    
    setGetAvatar(absoluteApiUrl(data.url));
  } catch (err) {
    console.error("Avatar upload failed:", err);
  }
}

  return (
    <div className="text-[var(--text-black)] bgWhiteTrue shadow-md p-2 rounded-[20px]">
      <div className="fixed bottom-0 right-0">
      </div>
      <h1>{settings.profile}</h1>
      <div className="text-[0.55em] flex flex-col gap-3">
        <div>
          <h1>{settings.species}</h1>
          <div className="flex gap-2">
            {Object.entries(settings.types).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setOpen(key);
                }}
                className={`flex hover:scale-98 cursor-pointer rounded-full p-1 pr-2 items-center gap-2 ${
                  open === key ? "bgPink text-white" : "bgGray"
                }`}
              >
                <div
                  className={`text-[0.8em] bg-white text-[var(--text-black)] rounded-full w-8 h-8 md:w-10 md:h-10 shadow-sm flex items-center justify-center`}
                >
                  <span>{typeIcons[key]}</span>
                </div>
                <p className="font-[900] text-[0.8em]">{label}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-start justify-start gap-4">
          <div className="flex flex-col items-start justify-center">
            <h1>{settings.avatar}</h1>
            <div className="flex flex-col items-center gap-2 avatar-selection">
              <input
                type="file"
                id="avatarInput"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              {getAvatar ? (
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={getAvatar}
                    alt="Avatar"
                    className="w-12 h-12 rounded-full"
                  />
                  <button
                    onClick={() => setGetAvatar(null)}
                    className="bg-red-500 rounded-full text-white text-[0.7em] underline cursor-pointer"
                  >
                    <IoClose />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="avatarInput"
                  className="bgWhite items-center justify-center flex font-[900] text-[1.2em] rounded-full w-10 h-10 cursor-pointer"
                >
                  <FaPlus />
                </label>
              )}
            </div>
          </div>
          <div>
            <h1>{settings.name}</h1>
            <input
              className="bgWhite rounded-full h-10 text-[0.7em] px-5 w-63 md:w-67"
              type="text"
              value={getName}
              onChange={(e) => setGetName(e.target.value)}
              placeholder="User Name"
            />
          </div>
        </div>
        <div className="flex gap-3 font-bold">
          <button
            onClick={handleUser}
            className="bg-[var(--pink)] shadow-[var(--shadow-pink)] mt-2 text-[0.8em] rounded-full text-white hover:scale-98 w-20 py-1 px-2"
          >
            Save
          </button>
          <button
            onClick={handleReset}
            className="bg-[var(--blue)] shadow-[var(--shadow-blue)] mt-2 text-[0.8em] rounded-full text-white hover:scale-98 w-20 py-1 px-2"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
