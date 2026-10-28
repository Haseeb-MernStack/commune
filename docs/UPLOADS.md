# Image uploads

How a photo gets from a phone to a post:

1. **Shrink in the browser** (`apps/web/src/lib/images.ts`). Photos up to 25 MB are accepted, then resized
   (posts: 1600 px, profile photos: 512 px square) and saved as WebP, usually a few hundred KB. GIFs are sent
   as they are and must be 4 MB or smaller.
2. **Upload straight to Cloudinary** (`apps/web/src/lib/upload.ts`). The API hands out a signed, single-use
   ticket (`POST /api/uploads/sign`); the browser uploads with a progress bar; then `POST /api/uploads/complete`
   confirms it and returns the `/uploads/<id>.<ext>` reference stored on the post.
3. **Fallback.** If direct upload is unavailable or fails, the file is sent through the API
   (`POST /api/uploads`, 4 MB limit, which fits Vercel's 4.5 MB request limit).

## Production checklist
- On the **API** Vercel project set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
  then redeploy. Without them uploads fall back to local disk, which does not work on Vercel.
- Check `https://<api>/api/uploads/sign` is not called without login (401 is expected in a browser tab).
- Cloudinary dashboard: Settings > Security, make sure "Restricted image types" / allowed formats do not
  block png, jpg, gif and webp.

Pasting an image into the composer and dragging a file onto it also work.
