import os
from typing import Callable, Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Response, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session


def create_uploads_router(
    *,
    get_db: Callable,
    uploads_dir: str,
    image_upload_extensions: set[str],
    document_upload_extensions: set[str],
    upload_avatar_max_bytes: int,
    upload_document_max_bytes: int,
    harmonizer_model,
    upload_matches: Callable[[UploadFile, str, set[str]], bool],
    safe_upload_extension: Callable[[UploadFile], str],
    save_upload_file: Callable,
    require_token_identity_match: Callable,
    sync_user_avatar_references: Callable,
    load_fallback_image: Callable,
) -> APIRouter:
    router = APIRouter()

    @router.get("/uploads-fallback/{proposal_id}/{index}")
    def read_uploads_fallback_image(
        proposal_id: int,
        index: int,
        db: Session = Depends(get_db),
    ):
        """Stream a proposal's stored data-URL fallback image as real bytes.

        Feed JSON links here instead of inlining base64 when the original
        upload is missing from disk; the stored fallback never changes, so
        the response is immutable-cacheable. Public read, like /uploads.
        """
        loaded = load_fallback_image(db, proposal_id, index)
        if not loaded:
            raise HTTPException(status_code=404, detail="Fallback image not found")
        image_bytes, media_type = loaded
        return Response(
            content=image_bytes,
            media_type=media_type,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    @router.post("/upload-image")
    async def upload_image(
        file: UploadFile = File(...),
        username: Optional[str] = Form(None),
        user_id: Optional[str] = Form(None),
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        os.makedirs(uploads_dir, exist_ok=True)
        if not upload_matches(file, "image/", image_upload_extensions):
            raise HTTPException(status_code=400, detail="Uploaded file must be an image")

        clean_username = (username or "").strip()
        clean_user_id = (user_id or "").strip()
        sync_error = ""
        user = None
        if (clean_username or clean_user_id) and harmonizer_model is not None:
            try:
                if clean_user_id:
                    try:
                        user = db.query(harmonizer_model).filter(harmonizer_model.id == int(clean_user_id)).first()
                    except (TypeError, ValueError):
                        user = None
                if user is None and clean_username:
                    user = db.query(harmonizer_model).filter(
                        func.lower(harmonizer_model.username) == clean_username.lower()
                    ).first()
                if user is not None:
                    require_token_identity_match(authorization, db, getattr(user, "username", ""))
            except HTTPException:
                raise
            except Exception as exc:
                db.rollback()
                sync_error = str(exc)

        unique_name = save_upload_file(
            file,
            image_upload_extensions,
            ".jpg",
            upload_avatar_max_bytes,
        )

        avatar_url = f"/uploads/{unique_name}"
        profile_synced = False
        if user is not None:
            try:
                user.profile_pic = avatar_url
                db.add(user)
                db.commit()
                db.refresh(user)
                sync_user_avatar_references(db, user.username, avatar_url, getattr(user, "id", None))
                profile_synced = True
            except Exception as exc:
                db.rollback()
                sync_error = str(exc)

        return {
            "filename": unique_name,
            "url": avatar_url,
            "content_type": file.content_type,
            "profile_synced": profile_synced,
            "sync_error": sync_error,
        }

    @router.post("/upload-file")
    async def upload_file(file: UploadFile = File(...)):
        os.makedirs(uploads_dir, exist_ok=True)
        if safe_upload_extension(file) not in document_upload_extensions:
            raise HTTPException(status_code=400, detail="Uploaded file type is not supported")
        unique_name = save_upload_file(
            file,
            document_upload_extensions,
            max_bytes=upload_document_max_bytes,
        )
        return {"filename": unique_name, "url": f"/uploads/{unique_name}"}

    return router
