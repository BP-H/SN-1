"use client";
import { useState, useRef, useEffect } from "react";
import { RiVoiceAiFill } from "react-icons/ri";
import { MdKeyboardVoice } from "react-icons/md";
import { IoChatbox } from "react-icons/io5";
import { AiFillLike } from "react-icons/ai";
import { RiEdit2Fill } from "react-icons/ri";

export default function AssistantOrb() {
  const orbRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragged, setDragged] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [popup, setPopup] = useState(null);
  const [listening, setListening] = useState(false);

  const popupTimeoutRef = useRef(null);
  let recognitionRef = useRef(null);

  useEffect(() => {
  const width = window.innerWidth;
  if (width < 1024) {
    setPos({ x: width - 70, y: window.innerHeight - 160 });
  } else {
    setPos({ x: width - 90, y: window.innerHeight - 90 });
  }
}, []);

  useEffect(() => {
    function handleMove(e) {
      if (!dragging) return;
      setDragged(true);
      setPos({ x: e.clientX - 40, y: e.clientY - 40 });
    }

    function handleTouchMove(e) {
      if (!dragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      setDragged(true);
      setPos({ x: touch.clientX - 40, y: touch.clientY - 40 });
    }

    function handleUp() {
      setDragging(false);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [dragging]);

  function toggleMenu() {
    setMenuOpen(v => !v);
  }

  function handleMouseDown() {
    setDragging(true);
    setDragged(false); // reset para novo drag
  }

  function handleClick() {
    if (!dragged) {
      toggleMenu(); 
    }
  }

  function simulateSpeak(text) {
    setPopup(text);
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = setTimeout(() => {
      setPopup(null);
      popupTimeoutRef.current = null;
    }, 5000);
  }

  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      simulateSpeak("Your browser does not support voice recognition");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-PT";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
      simulateSpeak("🎙️ Listening...");
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      simulateSpeak("You said: " + transcript);

      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: transcript }),
        });
        const data = await response.json();
        simulateSpeak("🤖 " + data.reply);
      } catch {
        simulateSpeak("Error getting AI response");
      }
    };

    recognition.onerror = () => {
      simulateSpeak("Voice recognition error");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  const menuStyle = (() => {
    if (typeof window === "undefined") return {};
    if (window.innerWidth < 1024) {
      return { left: pos.x - 170, top: pos.y - 70 };
    } else {
      return { right: 130, top: pos.y };
    }
  })();

  return (
    <div className="fixed flex z-999999"
      style={{
        left: pos.x,
        top: pos.y,
        position: "fixed",
      }}>
      <button
        ref={orbRef}
        onClick={handleClick}
        onDoubleClick={listening ? stopListening : startListening}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        className={`items-center justify-center flex rounded-full w-15 h-15 shadow-l z-[1000] cursor-${dragging ? "grabbing" : "grab"} ${
          listening
            ? "bg-white rounded-full listening-border"
            : "bg-white shadow-sm"
        }`}
      >
        {listening ? (
          <MdKeyboardVoice className="text-4xl animate-pulse" />
        ) : (
          <RiVoiceAiFill className="aiShadow text-[var(--transparent-white)] text-4xl" />
        )}
      </button>

      {menuOpen && (
        <div
          className="orb bg-white ml-[-230px] shadow-sm bg-opacity-70 p-2.5 rounded-[20px] flex gap-2.5 z-[1001]"
          style={menuStyle}
        >
          <button onClick={() => simulateSpeak("Opening chat...")} className={btnClass}><IoChatbox/></button>
          <button onClick={() => simulateSpeak("Reacting to this post...")} className={btnClass}><AiFillLike/></button>
          <button onClick={() => simulateSpeak("Commenting on this post...")} className={btnClass}><RiEdit2Fill/></button>
        </div>
      )}   

      {popup && (
        <div
          className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-85 text-white px-5 py-3 rounded-[20px] text-sm max-w-[80%] text-center z-[2000]"
        >
          {popup}
        </div>
      )}
    </div>
  );
}

const btnClass =
  "border-[var(--gray)] h-10 w-10 bg-[var(--gray)] shadow-sm border rounded-[14px] px-2.5 py-2 cursor-pointer text-[var(--text-black)]";