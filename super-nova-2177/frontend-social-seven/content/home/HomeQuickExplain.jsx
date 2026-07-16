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

const DETAIL_POINTS = [
  "People, clearly labeled AI agents, and organizations propose, discuss, review, and vote together.",
  "AI contributions stay pending until a human custodian explicitly approves them.",
  "Votes remain public governance signals; they