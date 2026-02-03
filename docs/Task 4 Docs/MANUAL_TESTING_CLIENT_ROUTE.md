# Manual Testing Guide: Client Access Route

This guide walks you through manually testing the `/api/client/[token]` route handler step by step.

## Overview

The client access route allows clients to view their album gallery using a secure token in the URL. This guide shows you how to:
1. Create test data (User, Photographer, Album, AlbumClient with token)
2. Test the route handler with various scenarios
3. Clean up test data

## Quick Start (Automated)

The easiest way to test is using the helper script:

```bash
# 1. Create test data and get instructions
npm run test:client-route

# 2. Start your dev server (in another terminal)
npm run dev

# 3. Test the route using the token provided by the script
curl http://localhost:3000/api/client/[TOKEN_FROM_SCRIPT]

# 4. Clean up when done
npm run cleanup:test-data [CLIENT_ID]
```

## Step-by-Step Manual Process

### Step 1: Create Test Data

You have two options:

#### Option A: Use the Helper Script (Recommended)

```bash
npm run test:client-route
```

This will:
- Create a test User, Photographer, Album, and AlbumClient
- Generate a secure token
- Print the token and testing instructions
- Create some test photos and a photo selection

#### Option B: Create Data Manually

If you want to create the data yourself, here's what you need:

1. **Create a User** (better-auth User):
   ```typescript
   const user = await prisma.user.create({
     data: {
       id: `test-user-${Date.now()}`,
       email: `test-photographer-${Date.now()}@example.com`,
       emailVerified: true,
       name: "Test Photographer",
     },
   });
   ```

2. **Create a Photographer**:
   ```typescript
   const photographer = await prisma.photographer.create({
     data: {
       userId: user.id,
       name: "Test Photographer",
     },
   });
   ```

3. **Create an Album** (must be OPEN status for clients to access):
   ```typescript
   const album = await prisma.album.create({
     data: {
       title: "Test Album",
       description: "Test album description",
       photographerId: photographer.id,
       status: "OPEN", // Important: Must be OPEN, not DRAFT
     },
   });
   ```

4. **Create an AlbumClient with Token**:
   ```typescript
   import { generateClientToken } from "@/lib/auth/client-token";
   
   const token = generateClientToken(); // 64-character hex string
   const client = await prisma.albumClient.create({
     data: {
       clientName: "Test Client",
       clientEmail: "test-client@example.com",
       accessToken: token,
       albumId: album.id,
       expiresAt: null, // No expiration, or set a future date
     },
   });
   ```

5. **Save the token** - You'll need it to test the route!

### Step 2: Start Your Development Server

In a terminal, start your Next.js dev server:

```bash
npm run dev
```

The server should start on `http://localhost:3000` (or the port configured in your environment).

### Step 3: Test the Route Handler

Now you can test the route using the token you created. Here are several ways to do it:

#### Method 1: Using curl (Terminal)

```bash
# Replace [TOKEN] with your actual token
curl http://localhost:3000/api/client/[TOKEN]
```

For pretty-printed JSON (if you have `jq` installed):
```bash
curl http://localhost:3000/api/client/[TOKEN] | jq
```

#### Method 2: Using Browser

Simply open the URL in your browser:
```
http://localhost:3000/api/client/[TOKEN]
```

The browser will display the JSON response.

#### Method 3: Using Browser Console (JavaScript)

Open your browser's developer console and run:
```javascript
fetch('http://localhost:3000/api/client/[TOKEN]')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

#### Method 4: Using Postman or Insomnia

1. Create a new GET request
2. URL: `http://localhost:3000/api/client/[TOKEN]`
3. Send the request

### Step 4: Verify the Response

A successful response (200 OK) should look like this:

```json
{
  "album": {
    "id": "clx...",
    "title": "Test Album",
    "description": "Test album description",
    "status": "OPEN",
    "createdAt": "2026-02-03T...",
    "updatedAt": "2026-02-03T..."
  },
  "client": {
    "id": "clx...",
    "name": "Test Client",
    "email": "test-client@example.com"
  },
  "photos": [
    {
      "id": "clx...",
      "filename": "test-photo-1.jpg",
      "originalFilename": "test-photo-1.jpg",
      "mimeType": "image/jpeg",
      "size": 1024000,
      "width": 1920,
      "height": 1080,
      "storageKey": "albums/.../review/test-photo-1.jpg",
      "thumbnailStorageKey": null,
      "createdAt": "2026-02-03T...",
      "isSelected": true,
      "selection": {
        "photoId": "clx...",
        "selectionDate": "2026-02-03T...",
        "notes": "This is a test selection"
      },
      ...
    },
    ...
  ],
  "totalPhotos": 3,
  "selectedCount": 1
}
```

**Key things to verify:**
- ✅ Status code is 200
- ✅ Album data is present and correct
- ✅ Client data matches what you created
- ✅ Photos array contains the album's photos
- ✅ `isSelected` and `selection` fields are populated for selected photos
- ✅ `totalPhotos` and `selectedCount` are correct

### Step 5: Test Error Scenarios

#### Test Invalid Token

Try accessing with a non-existent token:
```bash
curl http://localhost:3000/api/client/invalid-token-12345
```

**Expected Response:**
- Status: 401 Unauthorized
- Body: `{ "error": "Invalid or expired client access token", ... }`

#### Test Expired Token

1. Update the client's `expiresAt` to a past date:
   ```typescript
   await prisma.albumClient.update({
     where: { id: client.id },
     data: {
       expiresAt: new Date('2020-01-01'), // Past date
     },
   });
   ```

2. Try accessing the route with the token:
   ```bash
   curl http://localhost:3000/api/client/[TOKEN]
   ```

**Expected Response:**
- Status: 401 Unauthorized
- Body: `{ "error": "Invalid or expired client access token", ... }`

#### Test DRAFT Album

1. Update the album status to DRAFT:
   ```typescript
   await prisma.album.update({
     where: { id: album.id },
     data: {
       status: "DRAFT",
     },
   });
   ```

2. Try accessing the route:
   ```bash
   curl http://localhost:3000/api/client/[TOKEN]
   ```

**Expected Response:**
- Status: 404 Not Found
- Body: `{ "error": "Album is not yet available", ... }`

### Step 6: Clean Up Test Data

When you're done testing, clean up the test data:

#### Option A: Use the Cleanup Script

```bash
# Clean up specific client (and related data)
npm run cleanup:test-data [CLIENT_ID]

# Clean up all test data (users/photographers/albums/clients with "test" in name/email)
npm run cleanup:test-data
```

#### Option B: Manual Cleanup

Delete the records in this order (due to foreign key constraints):

```typescript
// 1. Delete photo selections
await prisma.photoSelection.deleteMany({
  where: { clientId: client.id },
});

// 2. Delete client
await prisma.albumClient.delete({
  where: { id: client.id },
});

// 3. Delete photos
await prisma.photo.deleteMany({
  where: { albumId: album.id },
});

// 4. Delete album
await prisma.album.delete({
  where: { id: album.id },
});

// 5. Delete photographer
await prisma.photographer.delete({
  where: { id: photographer.id },
});

// 6. Delete user
await prisma.user.delete({
  where: { id: user.id },
});
```

## Testing Checklist

Use this checklist to ensure you've tested everything:

- [ ] **Valid Token Test**
  - [ ] Route returns 200 OK
  - [ ] Album data is correct
  - [ ] Client data is correct
  - [ ] Photos are included
  - [ ] Photo selections are included

- [ ] **Invalid Token Test**
  - [ ] Route returns 401 Unauthorized
  - [ ] Error message is clear

- [ ] **Expired Token Test**
  - [ ] Route returns 401 Unauthorized
  - [ ] Error message indicates expiration

- [ ] **DRAFT Album Test**
  - [ ] Route returns 404 Not Found
  - [ ] Error message indicates album not available

- [ ] **Response Structure**
  - [ ] All expected fields are present
  - [ ] Data types are correct
  - [ ] Nested objects are properly structured

## Troubleshooting

### Issue: "Token parameter is required"
- **Cause**: The route handler isn't receiving the token parameter
- **Solution**: Make sure the URL format is `/api/client/[token]` and the token is in the URL path, not query params

### Issue: "Invalid or expired client access token"
- **Cause**: Token doesn't exist in database or has expired
- **Solution**: 
  - Verify the token exists: `SELECT * FROM album_clients WHERE access_token = '[TOKEN]'`
  - Check if `expires_at` is in the past

### Issue: "Album is not yet available"
- **Cause**: Album status is DRAFT
- **Solution**: Update album status to OPEN: `UPDATE albums SET status = 'OPEN' WHERE id = '[ALBUM_ID]'`

### Issue: Route returns 500 error
- **Cause**: Database connection issue or missing data
- **Solution**: 
  - Check database connection
  - Verify all related records exist (album, client, photos)
  - Check server logs for detailed error messages

## Additional Notes

- **Token Format**: Tokens are 64-character hex strings (32 bytes, hex-encoded)
- **Token Security**: Tokens are stored directly (not hashed) and looked up by unique index
- **Album Status**: Only albums with status `OPEN`, `CLOSED`, or `ARCHIVED` are accessible to clients. `DRAFT` albums are blocked.
- **Expiration**: If `expiresAt` is `null`, the token never expires. Otherwise, tokens expire at the specified date/time.

## Next Steps

After manual testing:
1. ✅ Verify all test scenarios pass
2. ✅ Check error handling works correctly
3. ✅ Verify response structure matches expectations
4. ✅ Test with real data (if available)
5. ✅ Consider adding integration tests to your test suite
