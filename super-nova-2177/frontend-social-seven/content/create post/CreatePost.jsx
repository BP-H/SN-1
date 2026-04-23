function CreatePost({ discard, setDiscard }) {
  const handleClick = () => {
    setDiscard(!discard);
    const element = document.getElementById("createPost");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      id="global-create-post-btn"
      type="button"
      onClick={handleClick}
      className="sr-only"
    >
      Toggle post composer
    </button>
  );
}

export default CreatePost;
