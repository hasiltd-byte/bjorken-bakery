# Cloudinary image storage

New image flow:

1. An authenticated administrator chooses a photo in `/admin/menu`.
2. The browser prepares a preview and reduces large photos; the Next.js Route Handler independently checks the file (JPEG, PNG or WebP, maximum 3 MB after client compression, maximum 40 million decoded pixels).
3. The server corrects orientation, strips source metadata through re-encoding, and limits dimensions to 1600 px without upscaling.
4. `lib/server/cloudinary.mjs` uploads the image using the server-side cloud name and upload preset. Requests have a 30-second timeout. There is no fallback that writes new image bytes to MongoDB.
5. Cloudinary returns `secure_url`; the product editor sends that URL in the normal product save request. The Mongoose `MenuItem.image` field stores the string, and all public/admin views use it on refresh.

Configuration:

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset
```

The supplied preset was tested successfully. Two-variable uploads require an **Unsigned** preset, as described in [Cloudinary's Upload API](https://cloudinary.com/documentation/image_upload_api_reference#unsigned_upload_parameters). The application does not expose the preset in client code. Uploads through the app require an admin session, pass origin checks and are rate limited. Misconfigured presets, network failures, invalid files and unexpected Cloudinary responses produce visible errors in the editor.

Only HTTPS Cloudinary image-upload delivery URLs belonging to the configured cloud are accepted for products or the hero image. Previously saved local/legacy URLs continue to work. Replacement uploads a new image and saves its new URL; it does not overwrite or delete existing Cloudinary assets. No API key/secret was required for this setup. Automatic management/deletion of existing cloud assets is not implemented with the two supplied variables.

Verification performed:

- Build and TypeScript passed.
- Unit tests cover multipart upload construction, secure URL validation, missing configuration, signed-preset errors, network failures and malformed responses.
- Isolated MongoDB integration tests confirm the Cloudinary URL is saved and returned publicly, and no GridFS image is created. External storage is mocked in these automated tests.
- Browser checks cover upload previews, save, editing, hiding/restoring and responsive rendering; external image storage is mocked there.
- A real upload was performed through the authenticated admin screen using the existing cinnamon-roll photograph. The returned URL was verified directly in Atlas; reopening the editor and public delivery both worked, with **zero new GridFS files**. The uploaded photo remains in use by the cinnamon product.

The site remains in Preview, and the existing verified WhatsApp number and business settings are unchanged.
