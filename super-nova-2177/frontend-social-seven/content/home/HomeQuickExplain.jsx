"use client";

import { Fragment, useEffect, useState } from "react";
import { IoArrowForward, IoChevronDown, IoClose } from "react-icons/io5";
import { speciesAccentColor } from "@/utils/species";

const STORAGE_KEY = "supernova-hide-quick-explain";

const ACTORS = [
  { key: "human", label: "Human" },
  { key: "ai", label: "AI" },
  { key: "org", label: "ORG" },
];

// Keep the expanded explanation concrete,