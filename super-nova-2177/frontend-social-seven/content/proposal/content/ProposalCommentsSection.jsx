"use client";

import { IoSparklesOutline } from "react-icons/io5";
import DisplayComments from "./DisplayComments";
import InsertComment from "./InsertComment";

export default function ProposalCommentsSection({
  aiActionModalMode,
  commentsById = new Map(),
  currentUsername,
  deletingCommentId,
  isDetailPage,
  localComments = [],
  onAskAi,
  onCancelReply,
  onDeleteComment,
  onEditComment,
  onGenerateAiComment,
  onReply,
  onToggleThread,
  proposalId,
  replyTarget,
  setErrorMsg,
  setLocalComments,
  setNotify,
  showComments,
  threadedComments = [],
}) {
  if (!showComments && !isDetailPage) return null;

  return (
    <div className="comments-section flex min-w-0 flex-col gap-2 rounded-[15px] bg-[rgba(255,255,255,0.03)] p-2">
      <div className="flex min-w-0 items-center justify-between gap-3 px-1">
        <span className="truncate text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-gray-light)]">
          Comments
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onGenerateAiComment();
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--horizontal-line)] text-[var(--text-black)] hover:border-[var(--pink)] hover:text-[var(--pink)]"
            aria-label="Generate AI comment"
            title="Generate AI comment"
            aria-expanded={aiActionModalMode === "comment"}
          >
            <IoSparklesOutline className="text-[0.82rem]" />
          </button>
          <span className="rounded-full bg-white/[0.055] px-2.5 py-1 text-[0.68rem] font-bold text-[var(--text-gray-light)]">
            {localComments.length}
          </span>
        </div>
      </div>
      <div onClick={(event) => { event.stopPropagation(); event.preventDefault(); }}>
        <InsertComment
          setErrorMsg={setErrorMsg}
          setNotify={setNotify}
          proposalId={proposalId}
          setLocalComments={setLocalComments}
          parentComment={null}
          onCancelReply={onCancelReply}
        />
      </div>
      <div className="comments-thread-list flex min-w-0 flex-col gap-2">
        {threadedComments.length === 0 ? (
          <div className="rounded-[0.9rem] border border-[var(--horizontal-line)] bg-white/[0.035] px-3 py-3 text-[0.78rem] leading-5 text-[var(--text-gray-light)]">
            <p className="font-semibold text-[var(--text-black)]">No comments yet.</p>
            <p className="mt-1">Start the discussion, or ask an AI delegate to draft one for approval.</p>
          </div>
        ) : threadedComments.map(({ comment, index, depth, isLastChild, hasChildren, ancestorRailDepths, collapsed, replyCount }) => {
          const commentId = comment.id ?? "";
          const parent = comment.parent_comment_id == null ? null : commentsById.get(String(comment.parent_comment_id));
          const isActiveReplyTarget = Boolean(
            replyTarget?.id && commentId && String(replyTarget.id) === String(commentId)
          );
          const isDeletedComment = Boolean(comment.deleted || comment.user === "[deleted]");
          const isCommentAuthor = Boolean(
            comment.user &&
              currentUsername &&
              String(comment.user).toLowerCase() === String(currentUsername).toLowerCase()
          );
          const canDeleteComment = Boolean(!isDeletedComment && commentId && isCommentAuthor);

          return (
            <DisplayComments
              key={commentId || `${comment.user || "comment"}-${index}`}
              commentId={commentId}
              proposalId={proposalId}
              name={comment.user}
              image={comment.user_img}
              species={comment.species}
              comment={comment.comment}
              likes={comment.likes}
              dislikes={comment.dislikes}
              canDelete={canDeleteComment}
              canEdit={Boolean(!isDeletedComment && commentId && isCommentAuthor)}
              deleting={String(deletingCommentId || "") === String(commentId)}
              onDelete={() => onDeleteComment(commentId)}
              onEdit={onEditComment}
              onReply={onReply}
              onAskAi={onAskAi}
              replyingToName={parent?.user || ""}
              depth={depth}
              isLastChild={isLastChild}
              hasChildren={hasChildren}
              ancestorRailDepths={ancestorRailDepths}
              collapsed={collapsed}
              replyCount={replyCount}
              onToggleThread={onToggleThread}
              setErrorMsg={setErrorMsg}
              setNotify={setNotify}
            >
              {isActiveReplyTarget && (
                <div onClick={(event) => { event.stopPropagation(); event.preventDefault(); }}>
                  <InsertComment
                    setErrorMsg={setErrorMsg}
                    setNotify={setNotify}
                    proposalId={proposalId}
                    setLocalComments={setLocalComments}
                    parentComment={replyTarget}
                    onCancelReply={onCancelReply}
                  />
                </div>
              )}
            </DisplayComments>
          );
        })}
      </div>
    </div>
  );
}
