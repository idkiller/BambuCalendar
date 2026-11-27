# Bamboo Calendar Security Specification (Panda Edition)

## 1. Data Invariants
1. Every `Room` must be created by an authenticated user (including Firebase Anonymous Auth) with `creatorId == request.auth.uid`, valid `YYYY-MM-DD` bounds (`startDate <= endDate`), a valid `voteDeadline`, and `createdAt == request.time`.
2. Users cannot list all rooms globally; `list` on `/rooms` is strictly restricted to `resource.data.creatorId == request.auth.uid`.
3. Every `Vote` belongs to an existing parent `Room`, has deterministic ID `{dateStr}__{request.auth.uid}`, falls within `[parentRoom.startDate, parentRoom.endDate]`, and can only be created or deleted when the participant has not locked their state (`isDone == false`).
4. Every `Participant` belongs to an existing parent `Room`, has deterministic ID `{request.auth.uid}`, valid `poseIndex` (0–5), and can only be created, updated (`nickname`, `isDone`, `updatedAt`), or deleted by its owner (`request.auth.uid`).
5. No shadow fields or client-forged timestamps are accepted on any write.

## 2. Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Room Create**: `create /rooms/room1` with `auth == null`.
2. **Spoofed Creator ID**: `create /rooms/room1` where `creatorId != request.auth.uid`.
3. **Shadow Field Injection on Room**: `create /rooms/room1` including `{ isAdmin: true }`.
4. **Invalid Date Range**: `create /rooms/room1` where `startDate > endDate` or invalid `voteDeadline`.
5. **Global Room Scraping**: `list /rooms` without filtering to `creatorId == request.auth.uid`.
6. **Orphan Vote/Participant Creation**: `create` under missing parent room.
7. **Out-of-Range Date Vote**: `create /rooms/room1/votes/2099-01-01__uid1` outside `[startDate, endDate]`.
8. **Duplicate / Arbitrary Vote ID Bypass**: `create /rooms/room1/votes/customId` not matching `{dateStr}__{request.auth.uid}`.
9. **Vote Mutation While Locked (`isDone == true`)**: `create` or `delete` vote when participant's `isDone == true`.
10. **Unauthorized Vote/Participant Deletion**: `delete` by `attackerUid != existing().userId`.
11. **Participant Pose/Owner Tampering**: `update /rooms/room1/participants/uid1` changing `poseIndex` or `userId`.
12. **Immutable Field Tampering on Vote Update**: `update /rooms/room1/votes/2026-12-01__uid1` changing `dateStr` or `createdAt`.
