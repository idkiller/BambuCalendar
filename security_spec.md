# Bamboo Calendar Security Specification

## 1. Data Invariants
1. Every `Room` must be created by an authenticated, email-verified user (`request.auth.token.email_verified == true`) with `creatorId == request.auth.uid`, valid `YYYY-MM-DD` bounds (`startDate <= endDate`), and `createdAt == request.time`.
2. Users cannot list all rooms globally; `list` on `/rooms` is strictly restricted to `resource.data.creatorId == request.auth.uid`. Single-room `get` requires knowing the exact `roomId` and being signed in.
3. Every `Vote` belongs to an existing parent `Room`, has deterministic ID `{dateStr}__{request.auth.uid}` (guaranteeing at most one water per user per date), and its `dateStr` must fall strictly within `[parentRoom.startDate, parentRoom.endDate]`.
4. Only the vote's owner (`existing().userId == request.auth.uid`) may update their `nickname` or delete (cancel) their water vote.
5. No shadow fields or client-forged timestamps are accepted on any write.

## 2. Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Room Create**: `create /rooms/room1` with `auth == null`.
2. **Unverified Email Room Create**: `create /rooms/room1` with `email_verified == false`.
3. **Spoofed Creator ID**: `create /rooms/room1` where `creatorId != request.auth.uid`.
4. **Shadow Field Injection on Room**: `create /rooms/room1` including `{ isAdmin: true }`.
5. **Invalid Date Range**: `create /rooms/room1` where `startDate: "2026-12-10"`, `endDate: "2026-12-01"`.
6. **Global Room Scraping**: `list /rooms` without filtering to `creatorId == request.auth.uid`.
7. **Orphan Vote Creation**: `create /rooms/nonexistent/votes/2026-12-01__uid1` referencing a missing parent room.
8. **Out-of-Range Date Vote**: `create /rooms/room1/votes/2099-01-01__uid1` outside `[startDate, endDate]`.
9. **Duplicate / Arbitrary Vote ID Bypass**: `create /rooms/room1/votes/customId` not matching `{dateStr}__{request.auth.uid}`.
10. **Vote Identity Spoofing**: `create /rooms/room1/votes/2026-12-01__victimUid` by `attackerUid`.
11. **Unauthorized Vote Deletion**: `delete /rooms/room1/votes/2026-12-01__victimUid` by `attackerUid`.
12. **Immutable Field Tampering on Vote Update**: `update /rooms/room1/votes/2026-12-01__uid1` changing `dateStr` or `createdAt` or `userId`.
