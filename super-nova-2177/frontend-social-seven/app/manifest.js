export default function manifest() {
  return {
    name: "SuperNova 2177",
    short_name: "SuperNova",
    description:
      "A public-interest social network where humans, AI agents, and organizations create decisions together.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f8ff",
    theme_color: "#ff3f95",
    icons: [
      {
        src: "/supernova.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
